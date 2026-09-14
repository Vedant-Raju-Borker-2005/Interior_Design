"""End-to-end checks for the September 2026 stakeholder feedback.

Runs the real FastAPI app against a throwaway SQLite database, so the dev
database is never touched. One test per feedback area; each asserts the
behaviour the reviewer asked for, plus the guard rails around it.

    cd backend
    .venv\\Scripts\\python -m pytest tests -q
"""
from __future__ import annotations

import io
import os
import re
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]


# ─────────────────────────────────────────────────────────────── fixtures ──
@pytest.fixture(scope="module")
def client():
    tmp = tempfile.mkdtemp(prefix="interiorai-test-")
    os.environ["DATABASE_URL"] = f"sqlite:///{Path(tmp, 'test.db').as_posix()}"
    os.environ["PDF_OUTPUT_DIR"] = tmp
    os.environ.pop("GEMINI_KEY", None)           # never call a paid API from tests
    os.chdir(BACKEND)                            # StaticFiles and assets are CWD-relative
    sys.path.insert(0, str(BACKEND))

    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as c:                   # runs lifespan: migrate + seed
        yield c


def login(client, email: str, role: str | None = None) -> dict:
    body = {"email": email}
    if role:
        body["role"] = role
    r = client.post("/api/v1/auth/login", json=body)
    assert r.status_code == 200, r.text
    r = client.post("/api/v1/auth/verify-otp", json={**body, "otp": r.json()["dev_otp"]})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def auth(client):
    return {
        "customer": login(client, "customer@example.com", "customer"),
        "admin": login(client, "admin@example.com", "admin"),
        "vendor": login(client, "vendor@example.com", "vendor"),
        "team": login(client, "team@example.com", "team"),
    }


def db_session():
    from app.db import SessionLocal
    return SessionLocal()


def make_project(client, headers, name="Feedback Test Home", with_item=True, custom=False):
    r = client.post("/api/v1/projects", headers=headers, json={
        "bhk_type": "3 BHK", "property_name": name, "city": "Mumbai",
        "budget": 1500000, "material_preference": "standard",
        "interior_material_preference": "Walnut Laminate",
        "fabric_preference": "Linen", "timeline": "3-6 months",
        "color_preferences": ["Royal Navy Blue", "Warm Beige"],
    })
    assert r.status_code == 200, r.text
    pid = r.json()["project_id"]
    r = client.post(f"/api/v1/projects/{pid}/rooms", headers=headers,
                    json={"room_type": "living_room"})
    assert r.status_code == 200, r.text
    detail = client.get(f"/api/v1/projects/{pid}", headers=headers).json()
    room_id = detail["rooms"][0]["id"]
    if with_item:
        products = client.get("/api/v1/catalog/products", params={"limit": 5}).json()
        products = products["items"]
        payload = {"product_id": products[0]["id"], "qty": 2}
        if custom:
            payload.update(custom_color="Emerald Green", custom_fabric="Velvet")
        r = client.post(f"/api/v1/projects/{pid}/rooms/{room_id}/items", headers=headers, json=payload)
        assert r.status_code == 200, r.text
    return pid


# ═════════════════════════════════════════════════ existing flows intact ═══
def test_existing_endpoints_still_work(client, auth):
    assert client.get("/api/v1/ai/health").status_code == 200
    assert client.get("/api/v1/catalog/packages").status_code == 200
    assert client.get("/api/v1/projects", headers=auth["customer"]).status_code == 200
    assert client.get("/api/v1/admin/stats", headers=auth["admin"]).status_code in (200, 404)
    assert client.post("/api/v1/ai/design", json={"bhk": "2 BHK", "style": "Modern"}).status_code == 200


# ════════════════════════════════════════ viewer: inputs routed, no panel ═══
def test_viewer_uses_onboarding_answers_and_hides_controls(client, auth):
    pid = make_project(client, auth["customer"], name="Viewer Routing Home")

    html = client.get(f"/api/v1/ai/interactive-viewer/{pid}").text
    m = re.search(r"window\.__EMBED__ = (\{.*?\});</script>", html)
    assert m, "project viewer must inject the brief"
    import json
    embed = json.loads(m.group(1))
    assert embed["chrome"] is False                       # control panel suppressed
    assert embed["brief"]["bhk"] == "3 BHK"
    assert embed["brief"]["city"] == "Mumbai"
    assert embed["brief"]["budget"] == "₹12L–₹20L"
    assert embed["brief"]["timeline"] == "3–6 months"
    assert embed["brief"]["wood"] == "Walnut Laminate"
    assert embed["brief"]["fabric"] == "Linen"
    assert embed["brief"]["colors"] == ["Royal Blue", "Clay Beige"]
    assert "Viewer Routing Home" in html[:4000]           # branded

    with_controls = client.get(f"/api/v1/ai/interactive-viewer/{pid}?controls=true").text
    assert '"chrome": true' in with_controls

    # Standalone explorer is unchanged.
    assert "__EMBED__ = " not in client.get("/api/v1/ai/interactive-viewer").text

    brief = client.get(f"/api/v1/ai/viewer-brief/{pid}").json()
    assert brief["source"]["city"] == "Mumbai" and brief["brief"]["city"] == "Mumbai"


# ═══════════════════════════════════════════════════════ 1.x  B2C flow ══════
def test_b2c_quotation_lifecycle(client, auth):
    cust, admin = auth["customer"], auth["admin"]

    # 1.3 — GST validated and stored
    bad = client.put("/api/v1/auth/me", headers=cust, json={"gst_number": "NOT-A-GSTIN"})
    assert bad.status_code == 400
    ok = client.put("/api/v1/auth/me", headers=cust, json={
        "gst_number": "27aapfu0939f1zv", "company_name": "Goundadkar & Sons",
        "billing_address": "12 MG Road", "billing_city": "Mumbai",
        "billing_state": "Maharashtra", "billing_pincode": "400001",
    })
    assert ok.status_code == 200, ok.text
    assert ok.json()["gst_number"] == "27AAPFU0939F1ZV"
    assert ok.json()["pan_number"] == "AAPFU0939F"            # derived from GSTIN

    pid = make_project(client, cust, name="B2C Lifecycle Home")

    # 1.7 — free AI rendering is available before any payment
    ent = client.get(f"/api/v1/ai/render-entitlement/{pid}", headers=cust).json()
    assert ent["free_ai_rendering"]["available"] is True
    assert ent["premium_rendering"]["unlocked"] is False
    assert client.post(f"/api/v1/ai/premium-render/{pid}", headers=cust, json={"count": 2}).status_code == 402

    # 1.4 / 1.3 — numbered quotation carrying the billing identity
    q = client.post(f"/api/v1/quotations/{pid}/generate", headers=cust)
    assert q.status_code == 200, q.text
    q = q.json()
    assert re.fullmatch(r"QT-\d{4}-\d{5}", q["quotation_no"])
    assert q["gst_number"] == "27AAPFU0939F1ZV"
    assert q["billing"]["company_name"] == "Goundadkar & Sons"
    pdfs = list(Path(os.environ["PDF_OUTPUT_DIR"]).glob(f"quotation_{q['quotation_no']}.pdf"))
    assert pdfs and pdfs[0].stat().st_size > 1000                # "&" did not break the PDF

    q2 = client.post(f"/api/v1/quotations/{pid}/generate", headers=cust).json()
    assert q2["quotation_no"] != q["quotation_no"]              # unique

    # 1.5 — admin search by number, GST and customer, with links to both sides
    assert client.get("/api/v1/quotation-admin/search", headers=cust).status_code == 403
    for needle in (q["quotation_no"], "27AAPFU0939F1ZV", "customer@example.com"):
        hits = client.get("/api/v1/quotation-admin/search", headers=admin, params={"q": needle}).json()
        row = next((h for h in hits["quotations"] if h["id"] == q["id"]), None)
        assert row, f"search for {needle!r} missed the quotation"
        assert row["project"]["id"] == pid and row["customer"]["id"]

    # 1.10 — cannot convert before payment
    assert client.post(f"/api/v1/quotation-admin/{q['id']}/convert-to-project",
                       headers=admin, json={}).status_code == 400

    # 1.9 / 1.11 — admin records offline full payment
    assert client.post(f"/api/v1/quotation-admin/{q['id']}/mark-paid", headers=admin,
                       json={"payment_mode": "CARRIER_PIGEON"}).status_code == 400
    paid = client.post(f"/api/v1/quotation-admin/{q['id']}/mark-paid", headers=admin,
                       json={"payment_mode": "BANK_TRANSFER", "payment_reference": "UTR123"})
    assert paid.status_code == 200, paid.text
    assert paid.json()["status"] == "paid"
    from app.models import Payment
    s = db_session()
    try:
        pay = s.query(Payment).filter(Payment.quotation_id == q["id"]).one()
        assert pay.payment_type == "FULL" and pay.amount == q["total"]
    finally:
        s.close()

    # 1.8 — payment unlocks up to 20 premium renders
    ent = client.get(f"/api/v1/ai/render-entitlement/{pid}", headers=cust).json()
    assert ent["premium_rendering"]["unlocked"] and ent["premium_rendering"]["credits_remaining"] == 20
    assert client.post(f"/api/v1/ai/premium-render/{pid}", headers=cust, json={"count": 21}).status_code == 422
    batch = client.post(f"/api/v1/ai/premium-render/{pid}", headers=cust, json={"count": 2})
    assert batch.status_code == 200, batch.text
    status = client.get(f"/api/v1/ai/premium-render/batch/{batch.json()['batch_id']}").json()
    assert status["total"] == 2

    # 1.10 — conversion creates a project that enters the approval queue (4.2)
    conv = client.post(f"/api/v1/quotation-admin/{q['id']}/convert-to-project", headers=admin, json={})
    assert conv.status_code == 200, conv.text
    new_pid = conv.json()["project_id"]
    assert conv.json()["approval_status"] == "PENDING"
    from app.models import Project, VendorAssignment
    s = db_session()
    try:
        delivery = s.query(Project).filter(Project.id == new_pid).one()
        # Not mistaken for an enterprise flat, but still traceable to its source.
        assert delivery.parent_project_id is None and delivery.flat_id is None
        assert delivery.defaults["converted_from_project_id"] == pid
        # 4.2 — no supplier has been handed the work yet.
        assert s.query(VendorAssignment).filter(VendorAssignment.project_id.in_([pid, new_pid])).count() == 0
    finally:
        s.close()
    queue = client.get("/api/v1/approvals/queue", headers=admin).json()
    assert any(p["id"] == new_pid for p in queue["projects"])
    assert client.post(f"/api/v1/quotation-admin/{q['id']}/convert-to-project",
                       headers=admin, json={}).status_code == 400


def test_floor_plan_upload_during_visualisation(client, auth):
    """1.1"""
    pid = make_project(client, auth["customer"], name="Plan Upload Home", with_item=False)
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), "white").save(buf, "PNG")
    r = client.post(f"/api/v1/ai/floor-plan/{pid}", headers=auth["customer"],
                    files={"file": ("plan.png", buf.getvalue(), "image/png")})
    assert r.status_code == 200, r.text
    assert r.json()["plan_specific_rendering"] is True
    assert client.post(f"/api/v1/ai/floor-plan/{pid}", headers=auth["customer"],
                       files={"file": ("plan.exe", b"MZ", "application/octet-stream")}).status_code == 400

    # Gemini renders are locked for an unpaid customer...
    room_id = client.get(f"/api/v1/projects/{pid}", headers=auth["customer"]).json()["rooms"][0]["id"]
    locked = client.post("/api/v1/ai/render", headers=auth["customer"],
                         json={"room_id": room_id, "style": "modern", "mode": "template"})
    assert locked.status_code == 402

    # ...and when a render does run, it receives the uploaded plan (1.1).
    job = client.post("/api/v1/ai/render", headers=auth["admin"],
                      json={"room_id": room_id, "style": "modern", "mode": "template"})
    assert job.status_code == 200, job.text
    assert job.json()["plan_specific"] is True

    from app.models import Render
    s = db_session()
    try:
        prompt = s.query(Render).filter(Render.id == job.json()["job_id"]).one().prompt
        assert "floor plan" in prompt
    finally:
        s.close()

    # Once the plan is removed, renders go back to the stock base views.
    client.delete(f"/api/v1/ai/floor-plan/{pid}", headers=auth["customer"])
    job2 = client.post("/api/v1/ai/render", headers=auth["admin"],
                       json={"room_id": room_id, "style": "modern", "mode": "template"})
    assert job2.json()["plan_specific"] is False


def test_product_images_are_light_and_resolve(client):
    """1.6"""
    data = client.get("/api/v1/catalog/products", params={"limit": 50}).json()
    products = data["items"]
    catalog = [p for p in products if "/static/assets/catalog/" in (p.get("thumbnail_url") or "")]
    assert catalog, "expected catalog-backed products"
    for p in catalog[:10]:
        path = p["thumbnail_url"].split("localhost:8000", 1)[-1]
        r = client.get(path)
        assert r.status_code == 200, path
        assert r.headers["content-type"] == "image/webp"
        assert len(r.content) < 500_000, f"{path} is {len(r.content)} bytes"
    # A legacy .png link still resolves to the WebP twin.
    assert client.get("/static/assets/catalog/Sofa%20Set%20Charcoal%20Grey.png").status_code == 200


# ═══════════════════════════════════════════════════════ 2.x  B2B pricing ═══
def test_b2b_discount_and_unit_pricing(client, auth):
    pid = make_project(client, auth["customer"], name="B2B Tower", custom=True)
    from app.models import Project
    s = db_session()
    try:
        s.query(Project).filter(Project.id == pid).update({"total_units": 4})
        s.commit()
    finally:
        s.close()

    base = client.get(f"/api/v1/approvals/projects/{pid}/pricing", headers=auth["admin"]).json()
    per_unit = base["original_unit_price"]
    assert base["units"] == 4 and base["discount_amount"] == 0

    assert client.post(f"/api/v1/approvals/projects/{pid}/discount", headers=auth["customer"],
                       json={"discount_type": "PERCENT", "discount_value": 10}).status_code == 403
    assert client.post(f"/api/v1/approvals/projects/{pid}/discount", headers=auth["admin"],
                       json={"discount_type": "BOGUS", "discount_value": 10}).status_code == 400
    assert client.post(f"/api/v1/approvals/projects/{pid}/discount", headers=auth["admin"],
                       json={"discount_type": "PERCENT", "discount_value": 150}).status_code == 400

    # 2.1 — e.g. "₹15L per unit offered at ₹10L": flat per-unit reduction
    cut = round(per_unit / 3, 2)
    r = client.post(f"/api/v1/approvals/projects/{pid}/discount", headers=auth["admin"],
                    json={"discount_type": "FLAT_PER_UNIT", "discount_value": cut})
    assert r.status_code == 200, r.text
    priced = r.json()
    # 2.2 — original, discounted and savings all present
    assert priced["original_unit_price"] == per_unit
    assert priced["savings_per_unit"] == pytest.approx(cut, abs=0.02)
    assert priced["discounted_unit_price"] == pytest.approx(per_unit - cut, abs=0.02)
    # 2.3 — unit-wise and total
    assert priced["discounted_total"] == pytest.approx((per_unit - cut) * 4, abs=0.1)
    # 2.4 — customisations surfaced
    assert priced["customisations"] and priced["customisations"][0]["customisations"]["colour"] == "Emerald Green"

    # Product prices were not touched.
    assert client.get(f"/api/v1/approvals/projects/{pid}/pricing", headers=auth["admin"]).json()["original_unit_price"] == per_unit


# ═════════════════════════════════════════════ 3.x  split item statuses ═════
def test_vendor_and_technician_tracks_are_separate(client, auth):
    pid = make_project(client, auth["customer"], name="Tracking Home", with_item=False)
    admin, vendor, team = auth["admin"], auth["vendor"], auth["team"]

    v = client.get("/api/v1/item-tracking/statuses", params={"role": "vendor"}).json()
    t = client.get("/api/v1/item-tracking/statuses", params={"role": "technician"}).json()
    vendor_values = {s["value"] for s in v["statuses"]}
    tech_values = {s["value"] for s in t["statuses"]}
    assert "INSTALLATION" in tech_values and "INSTALLATION" not in vendor_values   # 3.2/3.3
    assert "IN_PRODUCTION" in vendor_values and "IN_PRODUCTION" not in tech_values

    item = client.post("/api/v1/item-tracking", headers=admin, json={
        "project_id": pid, "room_name": "Living Room", "item_name": "Sofa"}).json()
    iid = item["id"]

    # Technician cannot act before handover, and cannot touch the vendor track.
    assert client.patch(f"/api/v1/item-tracking/{iid}/technician-status", headers=team,
                        json={"technician_status": "INSTALLATION"}).status_code == 400
    assert client.patch(f"/api/v1/item-tracking/{iid}/vendor-status", headers=team,
                        json={"vendor_status": "DISPATCHED"}).status_code == 403
    assert client.patch(f"/api/v1/item-tracking/{iid}/technician-status", headers=vendor,
                        json={"technician_status": "INSTALLED"}).status_code == 403
    assert client.patch(f"/api/v1/item-tracking/{iid}/vendor-status", headers=vendor,
                        json={"vendor_status": "INSTALLED"}).status_code == 400

    listed = client.get(f"/api/v1/item-tracking/project/{pid}", headers=team, params={"role": "technician"}).json()
    assert listed["items"] == []                                  # nothing handed over yet

    r = client.patch(f"/api/v1/item-tracking/{iid}/vendor-status", headers=vendor,
                     json={"vendor_status": "DELIVERED"})
    assert r.status_code == 200 and r.json()["technician_status"] == "RECEIVED"

    for step in ("INSTALLATION", "INSTALLED"):
        r = client.patch(f"/api/v1/item-tracking/{iid}/technician-status", headers=team,
                         json={"technician_status": step})
        assert r.status_code == 200, r.text
    assert r.json()["installed_at"] and r.json()["vendor_status"] == "DELIVERED"

    # 3.4/3.5 — photo on the same record, stored light
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (3000, 2000), "grey").save(buf, "JPEG", quality=95)
    up = client.post(f"/api/v1/item-tracking/{iid}/photos", headers=team,
                     params={"caption": "Fitted", "stage": "INSTALLED"},
                     files={"file": ("site.jpg", buf.getvalue(), "image/jpeg")})
    assert up.status_code == 200, up.text
    body = up.json()
    assert body["photo_count"] == 1 and body["photos"][0]["url"].endswith(".webp")
    assert body["technician_status"] == "INSTALLED"


# ═════════════════════════════════════ 4.x  availability, approval, supply ══
def test_vendor_availability_hides_from_marketplace(client, auth):
    from app.models import Product, Vendor, User
    s = db_session()
    try:
        me = s.query(User).filter(User.email == "vendor@example.com").one()
        mine = s.query(Vendor).filter(Vendor.user_id == me.id).one()
        own = s.query(Product).filter(Product.vendor_id == mine.id).first()
        other = s.query(Product).filter(Product.vendor_id != mine.id, Product.vendor_id.isnot(None)).first()
        own_id, other_id = own.id, (other.id if other else None)
    finally:
        s.close()

    def listed(pid):
        data = client.get("/api/v1/catalog/products", params={"limit": 500}).json()
        rows = data["items"]
        return any(p["id"] == pid for p in rows)

    if other_id:
        assert client.patch(f"/api/v1/vendor/products/{other_id}/availability", headers=auth["vendor"],
                            json={"is_available": False}).status_code == 403

    r = client.patch(f"/api/v1/vendor/products/{own_id}/availability", headers=auth["vendor"],
                     json={"is_available": False, "reason": "Out of stock"})
    assert r.status_code == 200 and r.json()["is_available"] is False
    assert not listed(own_id)
    assert client.get(f"/api/v1/catalog/products/{own_id}").json()["is_available"] is False

    client.patch(f"/api/v1/vendor/products/{own_id}/availability", headers=auth["vendor"],
                 json={"is_available": True})
    overview = client.get("/api/v1/vendor/availability", headers=auth["vendor"]).json()
    assert overview["counts"]["unavailable"] == 0


def test_approval_queue_then_supplier_allocation(client, auth):
    admin = auth["admin"]
    pid = make_project(client, auth["customer"], name="Approval Home")
    from app.models import Project, Vendor, VendorAssignment, User
    s = db_session()
    try:
        s.query(Project).filter(Project.id == pid).update({"status": "quoted"})
        s.commit()
        approved = s.query(Vendor).filter(Vendor.status == "APPROVED").first().id
        unapproved = s.query(Vendor).filter(Vendor.status != "APPROVED").first()
        unapproved = unapproved.id if unapproved else None
    finally:
        s.close()

    assert client.get("/api/v1/approvals/queue", headers=auth["customer"]).status_code == 403
    queue = client.get("/api/v1/approvals/queue", headers=admin).json()
    assert any(p["id"] == pid for p in queue["projects"])

    # 4.4 — allocation only after approval
    assert client.post(f"/api/v1/approvals/projects/{pid}/allocate", headers=admin,
                       json={"vendor_id": approved}).status_code == 400
    assert client.post(f"/api/v1/approvals/projects/{pid}/reject", headers=admin,
                       json={"reason": "  "}).status_code == 400

    r = client.post(f"/api/v1/approvals/projects/{pid}/approve", headers=admin, json={"note": "Looks good"})
    assert r.status_code == 200 and r.json()["approval_status"] == "APPROVED"

    if unapproved:
        assert client.post(f"/api/v1/approvals/projects/{pid}/allocate", headers=admin,
                           json={"vendor_id": unapproved}).status_code == 400

    # 4.2 — approved but not yet allocated: the vendor dashboard's sync must
    # not hand the items to anyone.
    client.get("/api/v1/vendor/dashboard", headers=auth["vendor"])
    s = db_session()
    try:
        assert s.query(VendorAssignment).filter(VendorAssignment.project_id == pid).count() == 0
    finally:
        s.close()

    r = client.post(f"/api/v1/approvals/projects/{pid}/allocate", headers=admin, json={"vendor_id": approved})
    assert r.status_code == 200, r.text
    assert r.json()["assignments_created"] >= 1                                     # 4.5
    client.get("/api/v1/vendor/dashboard", headers=auth["vendor"])                 # sync again
    s = db_session()
    try:
        vendors_with_work = {a.vendor_id for a in s.query(VendorAssignment).filter(VendorAssignment.project_id == pid)}
        assert vendors_with_work == {approved}                                      # only the allocated supplier
    finally:
        s.close()
    s = db_session()
    try:
        assert s.query(VendorAssignment).filter(VendorAssignment.project_id == pid,
                                                VendorAssignment.vendor_id == approved).count() >= 1
    finally:
        s.close()

    history = client.get(f"/api/v1/approvals/projects/{pid}/history", headers=admin).json()["events"]
    assert {e["action"] for e in history} >= {"APPROVED", "ALLOCATED"}


# ═══════════════════════════════════════════════ 5.x  special services ═════
def test_special_services_referral_flow(client, auth):
    admin = auth["admin"]
    types = client.get("/api/v1/special-services/types").json()["service_types"]
    assert {"House Design", "Survey Plan", "Special Vending Services", "Measurable Drawings"} <= set(types)

    # 5.2 — only admins onboard; onboarding provisions a consultant login
    payload = {"name": "Asha Rao", "company_name": "Rao Surveys", "email": "asha.rao@example.com",
               "phone": "+919811112222", "city": "Pune", "services": ["Survey Plan"],
               "commission_rate": 20}
    assert client.post("/api/v1/special-services/consultants", headers=auth["customer"], json=payload).status_code == 403
    assert client.post("/api/v1/special-services/consultants", headers=admin,
                       json={**payload, "services": ["Astrology"]}).status_code == 400
    asha = client.post("/api/v1/special-services/consultants", headers=admin, json=payload)
    assert asha.status_code == 200, asha.text
    asha = asha.json()
    other = client.post("/api/v1/special-services/consultants", headers=admin, json={
        "name": "Dev Iyer", "email": "dev.iyer@example.com", "services": ["House Design"]}).json()

    directory = client.get("/api/v1/special-services/consultants", params={"service_type": "Survey Plan"}).json()
    assert [c["id"] for c in directory["consultants"]] == [asha["id"]]            # 5.1

    # 5.3 — a public visitor can raise a lead
    lead = client.post("/api/v1/special-services/leads", json={
        "service_type": "Survey Plan", "customer_name": "Walk-in", "customer_phone": "+919000000001",
        "city": "Pune", "requirements": "Plot survey, 2400 sq ft"})
    assert lead.status_code == 200, lead.text
    lead = lead.json()
    assert re.fullmatch(r"SL-\d{4}-\d{5}", lead["lead_no"]) and lead["status"] == "NEW"

    assert client.post(f"/api/v1/special-services/leads/{lead['id']}/assign", headers=admin,
                       json={"consultant_id": other["id"]}).status_code == 400     # wrong service
    r = client.post(f"/api/v1/special-services/leads/{lead['id']}/assign", headers=admin,
                    json={"consultant_id": asha["id"]})
    assert r.status_code == 200 and r.json()["status"] == "ASSIGNED"

    # 5.4 — consultant signs in and sees only their own leads
    asha_h = login(client, "asha.rao@example.com", "consultant")
    dev_h = login(client, "dev.iyer@example.com", "consultant")
    mine = client.get("/api/v1/special-services/leads", headers=asha_h).json()["leads"]
    assert [l["id"] for l in mine] == [lead["id"]]
    assert client.get("/api/v1/special-services/leads", headers=dev_h).json()["leads"] == []

    # 5.5 — consultant moves it along; nobody else can
    assert client.patch(f"/api/v1/special-services/leads/{lead['id']}/status", headers=dev_h,
                        json={"status": "IN_PROGRESS"}).status_code == 403
    for step in ("CONTACTED", "IN_PROGRESS"):
        assert client.patch(f"/api/v1/special-services/leads/{lead['id']}/status", headers=asha_h,
                            json={"status": step}).status_code == 200
    done = client.patch(f"/api/v1/special-services/leads/{lead['id']}/status", headers=asha_h,
                        json={"status": "COMPLETED", "service_value": 100000, "note": "Delivered"}).json()

    # 5.6/5.7 — commission split recorded, earnings visible to admin
    assert done["commission_rate"] == 20
    assert done["platform_earning"] == 20000 and done["consultant_payout"] == 80000
    assert [e["status"] for e in done["events"]] == ["NEW", "ASSIGNED", "CONTACTED", "IN_PROGRESS", "COMPLETED"]

    ledger = client.get("/api/v1/special-services/earnings", headers=admin).json()
    assert ledger["summary"]["platform_earning"] >= 20000
    row = next(r for r in ledger["by_consultant"] if r["consultant_id"] == asha["id"])
    assert row["unpaid"] == 80000
    assert client.get("/api/v1/special-services/earnings", headers=auth["customer"]).status_code == 403

    client.patch(f"/api/v1/special-services/leads/{lead['id']}/payout", headers=admin, json={"payout_status": "PAID"})
    row = next(r for r in client.get("/api/v1/special-services/earnings", headers=admin).json()["by_consultant"]
               if r["consultant_id"] == asha["id"])
    assert row["unpaid"] == 0


# ═════════════════════════════════════ 1.11 payment model · 1.12 checkout ═══
def test_full_payment_for_b2c_and_pre_checkout_capture(client, auth):
    cust = auth["customer"]
    pid = make_project(client, cust, name="Checkout Home")
    client.post(f"/api/v1/quotations/{pid}/generate", headers=cust)

    # 1.11 — a B2C project has one full payment, not a milestone schedule
    pay = client.get(f"/api/v1/customer/projects/{pid}/payments", headers=cust).json()
    assert pay["paymentModel"] == "FULL"
    assert [m["name"] for m in pay["milestones"]] == ["Full Payment"]
    assert pay["milestones"][0]["amount"] == pay["contractValue"]
    assert pay["quotationNo"] and "offlinePayment" in pay

    # 1.12 — confirmations are mandatory
    bad = client.post(f"/api/v1/special-services/checkout/{pid}", headers=cust, json={
        "services": [], "confirmations": {"site_access": True}})
    assert bad.status_code == 400

    body = {
        "services": [{"service_type": "Measurable Drawings", "requirements": "Kitchen elevations"}],
        "confirmations": {"site_access": True, "scope_final": True, "full_payment_terms": True},
        "site_access_from": "2026-10-01",
    }
    first = client.post(f"/api/v1/special-services/checkout/{pid}", headers=cust, json=body)
    assert first.status_code == 200, first.text
    assert first.json()["complete"] is True and len(first.json()["created_leads"]) == 1

    # Revisiting checkout does not raise a duplicate lead.
    again = client.post(f"/api/v1/special-services/checkout/{pid}", headers=cust, json=body).json()
    assert again["created_leads"] == [] and len(again["leads"]) == 1

    saved = client.get(f"/api/v1/special-services/checkout/{pid}", headers=cust).json()
    assert saved["saved"]["site_access_from"] == "2026-10-01"
    assert saved["leads"][0]["project_id"] == pid

    # Another customer cannot read or write this project's checkout.
    assert client.get(f"/api/v1/special-services/checkout/{pid}", headers=auth["vendor"]).status_code == 403


def test_bulk_project_is_priced_unit_by_unit(client, auth):
    """2.1-2.4 on a real bulk development: parent + per-flat unit projects."""
    from app.models import Flat, Project, User

    parent_id = make_project(client, auth["customer"], name="Tower A", with_item=False)
    unit_a = make_project(client, auth["customer"], name="Flat 101, Tower A")
    unit_b = make_project(client, auth["customer"], name="Flat 102, Tower A", custom=True)

    s = db_session()
    try:
        enterprise = s.query(User).filter(User.email == "customer@example.com").one()
        parent = s.query(Project).filter(Project.id == parent_id).one()
        parent.total_units = 2
        for n, uid in (("101", unit_a), ("102", unit_b)):
            flat = Flat(project_id=parent_id, flat_number=n, bhk_type="3 BHK")
            s.add(flat)
            s.flush()
            s.query(Project).filter(Project.id == uid).update(
                {"parent_project_id": parent_id, "flat_id": flat.id})
        s.commit()
    finally:
        s.close()

    before = client.get(f"/api/v1/approvals/projects/{parent_id}/pricing", headers=auth["customer"]).json()
    assert before["units_priced"] == 2 and len(before["unit_lines"]) == 2
    per_unit = [l["original_price"] for l in before["unit_lines"]]
    assert before["original_total"] == pytest.approx(sum(per_unit), abs=0.1)

    cut = round(min(per_unit) / 4, 2)
    after = client.post(f"/api/v1/approvals/projects/{parent_id}/discount", headers=auth["admin"],
                        json={"discount_type": "FLAT_PER_UNIT", "discount_value": cut}).json()
    for line in after["unit_lines"]:
        assert line["discount"] == pytest.approx(cut, abs=0.02)
        assert line["discounted_price"] == pytest.approx(line["original_price"] - cut, abs=0.02)
    assert after["discount_amount"] == pytest.approx(cut * 2, abs=0.05)

    # A unit inherits the development's discount on its own pricing and quotation.
    unit_pricing = client.get(f"/api/v1/approvals/projects/{unit_a}/pricing", headers=auth["customer"]).json()
    assert unit_pricing["discount_inherited"] is True
    assert unit_pricing["discount_amount"] == pytest.approx(cut, abs=0.02)
    q = client.post(f"/api/v1/quotations/{unit_a}/generate", headers=auth["customer"]).json()
    assert q["discount_amount"] == pytest.approx(cut, abs=0.02)
    assert q["original_total"] - q["discount_amount"] == pytest.approx(q["subtotal"], abs=0.05)

    # And bulk units keep the milestone schedule (1.11 is B2C only).
    pay = client.get(f"/api/v1/customer/projects/{unit_a}/payments", headers=auth["customer"]).json()
    assert pay["paymentModel"] == "MILESTONE"


def test_vendor_listing_toggle_syncs_marketplace(client, auth):
    """4.1 through the supplier's own listing, not just the catalogue row."""
    listing = client.get("/api/v1/vendor/products", headers=auth["vendor"]).json()
    rows = listing if isinstance(listing, list) else listing.get("products", [])
    target = next(r for r in rows if r.get("isAvailable") is not False)

    r = client.patch(f"/api/v1/vendor/my-products/{target['id']}/availability", headers=auth["vendor"],
                     json={"is_available": False, "reason": "Discontinued finish"})
    assert r.status_code == 200, r.text
    after = client.get("/api/v1/vendor/products", headers=auth["vendor"]).json()
    after = after if isinstance(after, list) else after.get("products", [])
    row = next(x for x in after if x["id"] == target["id"])
    assert row["isAvailable"] is False and row["unavailableReason"] == "Discontinued finish"

    if r.json()["marketplace_synced"]:
        data = client.get("/api/v1/catalog/products", params={"limit": 500}).json()
        assert all(p["sku"] != target["sku"] for p in data["items"])

    client.patch(f"/api/v1/vendor/my-products/{target['id']}/availability", headers=auth["vendor"],
                 json={"is_available": True})


def test_packages_found_for_either_bhk_spelling(client, auth):
    """Regression: '/packages?bhk=3 BHK' showed "No packages found" because
    packages are stored as '3BHK' and the lookup was an exact match."""
    spaced = client.get("/api/v1/catalog/packages", params={"bhk": "3 BHK", "budget": 2000000}).json()
    compact = client.get("/api/v1/catalog/packages", params={"bhk": "3BHK", "budget": 2000000}).json()
    assert spaced["total"] == compact["total"] > 0
    assert {p["tier"] for p in spaced["packages"]} == {"basic", "premium", "luxury"}

    reco = client.get("/api/v1/recommendations/packages", params={"bhk": "3 BHK", "budget": 2000000}).json()
    assert reco["total"] == compact["total"]

    # A project created with the spaced form still gets its default rooms.
    r = client.post("/api/v1/projects", headers=auth["customer"], json={
        "bhk_type": "3 BHK", "property_name": "Spaced BHK Home", "city": "Pune", "budget": 900000})
    assert r.status_code == 200, r.text
    assert len(r.json()["rooms"]) > 0


def test_customer_approval_does_not_assign_suppliers(client, auth):
    """4.2 — the customer's "Approve quotation" used to push every line item
    straight to vendors. It must now wait for admin approval + allocation."""
    from app.models import Project, VendorAssignment

    pid = make_project(client, auth["customer"], name="Straight Through Check")
    q = client.post(f"/api/v1/quotations/{pid}/generate", headers=auth["customer"]).json()
    r = client.put(f"/api/v1/customer/projects/{pid}/quotations/{q['id']}/status",
                   headers=auth["customer"], data={"status": "approved"})
    assert r.status_code == 200, r.text

    client.get("/api/v1/vendor/dashboard", headers=auth["vendor"])   # the old self-healing sync
    s = db_session()
    try:
        assert s.query(VendorAssignment).filter(VendorAssignment.project_id == pid).count() == 0
        assert s.query(Project).filter(Project.id == pid).one().approval_status == "PENDING"
    finally:
        s.close()

    queue = client.get("/api/v1/approvals/queue", headers=auth["admin"]).json()
    assert any(p["id"] == pid for p in queue["projects"])


# ═══════════════════════════════════════════════ full-page design studio ════
def _minimal_glb() -> bytes:
    import json, struct
    doc = json.dumps({"asset": {"version": "2.0"}, "scenes": [{"nodes": []}], "scene": 0}).encode()
    doc += b" " * ((4 - len(doc) % 4) % 4)
    chunk = struct.pack("<I4s", len(doc), b"JSON") + doc
    return struct.pack("<4sII", b"glTF", 2, 12 + len(chunk)) + chunk


def test_design_studio_edit_updates_2d_3d_brief(client, auth):
    import json
    cust = auth["customer"]
    pid = make_project(client, cust, name="Studio Edit Home", with_item=False)

    # Onboarding's style choice is persisted and reaches the viewer.
    client.put(f"/api/v1/projects/{pid}", headers=cust, json={"style_tags": ["mediterranean"]})
    assert client.get(f"/api/v1/projects/{pid}", headers=cust).json()["style_tags"] == ["mediterranean"]

    brief = client.get(f"/api/v1/ai/design-brief/{pid}", headers=cust).json()
    assert brief["brief"]["style"] == "Mediterranean"
    assert brief["locks"]["bhk_type"] is None
    assert "Deep Emerald" in brief["options"]["colors"]

    bad = client.put(f"/api/v1/ai/design-brief/{pid}", headers=cust,
                     json={"style": "gothic", "colors": ["Neon Pink"]})
    assert bad.status_code == 400
    too_many = client.put(f"/api/v1/ai/design-brief/{pid}", headers=cust,
                          json={"colors": ["Teal", "Coral", "Sand", "Rust"]})
    assert too_many.status_code == 400

    edited = client.put(f"/api/v1/ai/design-brief/{pid}", headers=cust, json={
        "bhk_type": "2BHK", "style": "boho", "budget": 1200000, "quality": "premium",
        "wood": "Teak Laminate", "fabric": "Leatherette", "colors": ["Terracotta", "Sand"],
        "city": "Pune", "timeline": "6_months", "scope": "upgrade",
    })
    assert edited.status_code == 200, edited.text
    b = edited.json()["brief"]
    assert (b["bhk"], b["style"], b["budget"], b["quality"]) == ("2 BHK", "Boho", "₹8L–₹12L", "Premium")
    assert (b["wood"], b["fabric"], b["colors"], b["city"]) == ("Teak Laminate", "Leatherette", ["Terracotta", "Sand"], "Pune")
    assert (b["timeline"], b["scope"]) == ("3–6 months", "UPGRADING")

    # The 2D/3D viewer is served with the edited design.
    html = client.get(f"/api/v1/ai/interactive-viewer/{pid}").text
    embed = json.loads(re.search(r"window\.__EMBED__ = (\{.*?\});</script>", html).group(1))
    assert embed["brief"]["style"] == "Boho" and embed["brief"]["bhk"] == "2 BHK"

    # Rooms follow the style so room renders agree with the plan.
    rooms = client.get(f"/api/v1/projects/{pid}", headers=cust).json()["rooms"]
    assert rooms and all(r["style_preference"] == "boho" for r in rooms)

    # Once quoted, BHK is locked (rooms and prices are built per BHK)...
    client.post(f"/api/v1/quotations/{pid}/generate", headers=cust)
    after = client.get(f"/api/v1/ai/design-brief/{pid}", headers=cust).json()
    assert after["locks"]["bhk_type"]
    assert client.put(f"/api/v1/ai/design-brief/{pid}", headers=cust, json={"bhk_type": "4BHK"}).status_code == 400
    # ...but everything else is still editable.
    assert client.put(f"/api/v1/ai/design-brief/{pid}", headers=cust, json={"style": "luxury"}).status_code == 200

    # Someone else's project is off limits.
    assert client.get(f"/api/v1/ai/design-brief/{pid}", headers=auth["vendor"]).status_code == 403


def test_design_studio_glb_roundtrip(client, auth):
    cust = auth["customer"]
    pid = make_project(client, cust, name="GLB Home", with_item=False)

    assert client.get(f"/api/v1/ai/scene-glb/{pid}", headers=cust).status_code == 404
    fake = client.post(f"/api/v1/ai/scene-glb/{pid}", headers=cust,
                       files={"file": ("model.glb", b"not a model at all", "model/gltf-binary")})
    assert fake.status_code == 400

    glb = _minimal_glb()
    up = client.post(f"/api/v1/ai/scene-glb/{pid}", headers=cust,
                     files={"file": ("model.glb", glb, "model/gltf-binary")})
    assert up.status_code == 200, up.text
    assert up.json()["bytes"] == len(glb) and ".glb" in up.json()["url"]

    down = client.get(f"/api/v1/ai/scene-glb/{pid}", headers=cust)
    assert down.status_code == 200 and down.content == glb
    assert down.headers["content-type"].startswith("model/gltf-binary")

    info = client.get(f"/api/v1/ai/design-brief/{pid}", headers=cust).json()["glb"]
    assert info["url"] and info["updated_at"]

    # Editing the design marks the stored model stale until it is re-exported.
    client.put(f"/api/v1/ai/design-brief/{pid}", headers=cust, json={"fabric": "Linen"})
    from app.models import Project
    sess = db_session()
    try:
        assert sess.query(Project).filter(Project.id == pid).one().defaults["scene_glb_stale"] is True
    finally:
        sess.close()

    assert client.get(f"/api/v1/ai/scene-glb/{pid}", headers=auth["vendor"]).status_code == 403
