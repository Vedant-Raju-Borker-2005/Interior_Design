"""
PDF generation service using ReportLab.
Produces a professional quotation PDF for interior design projects.
"""
import os
import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

PDF_DIR = os.getenv("PDF_OUTPUT_DIR", "./pdfs")

# Color palette
INDIGO = colors.HexColor("#4F46E5")
INDIGO_LIGHT = colors.HexColor("#EEF2FF")
AMBER = colors.HexColor("#D97706")
DARK = colors.HexColor("#1E1B4B")
GREY = colors.HexColor("#6B7280")
LIGHT_GREY = colors.HexColor("#F9FAFB")
WHITE = colors.white
BLACK = colors.black


def generate_quotation_pdf(
    quotation_id: str,
    project,
    user,
    line_items: list,
    subtotal: float,
    gst: float,
    total: float,
    valid_until: str,
) -> str:
    os.makedirs(PDF_DIR, exist_ok=True)
    filename = f"quotation_{quotation_id[:8]}.pdf"
    filepath = os.path.join(PDF_DIR, filename)

    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    header_data = [
        [
            Paragraph("<b><font color='#4F46E5' size='18'>🏠 InteriorAI</font></b>", styles["Normal"]),
            Paragraph(
                f"<font color='#6B7280' size='9'>QUOTATION #{quotation_id[:8].upper()}<br/>"
                f"Date: {datetime.datetime.utcnow().strftime('%d %b %Y')}<br/>"
                f"Valid until: {valid_until}</font>",
                ParagraphStyle("right", alignment=TA_RIGHT, fontSize=9),
            ),
        ]
    ]
    header_table = Table(header_data, colWidths=[100 * mm, 70 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), INDIGO_LIGHT),
        ("PADDING", (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [8, 8, 8, 8]),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 6 * mm))

    # ── Client & Project Info ─────────────────────────────────────────────────
    info_style = ParagraphStyle("info", fontSize=9, leading=14)
    info_data = [
        [
            Paragraph(
                f"<b>CLIENT</b><br/>"
                f"{user.name or 'Customer'}<br/>"
                f"{user.phone or user.email or ''}<br/>"
                f"{user.city or ''}",
                info_style,
            ),
            Paragraph(
                f"<b>PROJECT</b><br/>"
                f"{project.property_name}<br/>"
                f"{project.bhk_type} | {project.city}<br/>"
                f"Budget: ₹{project.budget:,.0f}",
                info_style,
            ),
        ]
    ]
    info_table = Table(info_data, colWidths=[85 * mm, 85 * mm])
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_GREY),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 6 * mm))

    # ── Line Items Table ───────────────────────────────────────────────────────
    story.append(Paragraph(
        "<b><font color='#1E1B4B' size='11'>Scope of Work</font></b>",
        styles["Normal"]
    ))
    story.append(Spacer(1, 3 * mm))

    headers = ["#", "Room", "Item", "Category", "Qty", "Unit Price (₹)", "Total (₹)"]
    table_data = [headers]

    for i, item in enumerate(line_items, 1):
        table_data.append([
            str(i),
            item.get("room", ""),
            item.get("name", ""),
            item.get("category", "").replace("_", " ").title(),
            str(item.get("qty", 1)),
            f"{item.get('unit_price', 0):,.0f}",
            f"{item.get('total', 0):,.0f}",
        ])

    col_widths = [8*mm, 28*mm, 55*mm, 25*mm, 10*mm, 22*mm, 22*mm]
    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("PADDING", (0, 0), (-1, 0), 6),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        # Body
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("PADDING", (0, 1), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E5E7EB")),
        ("ALIGN", (4, 1), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 5 * mm))

    # ── Summary ────────────────────────────────────────────────────────────────
    summary_data = [
        ["", "", "", "", "", "Subtotal:", f"₹{subtotal:,.0f}"],
        ["", "", "", "", "", f"GST (18%):", f"₹{gst:,.0f}"],
        ["", "", "", "", "", "TOTAL:", f"₹{total:,.0f}"],
    ]
    summary_table = Table(summary_data, colWidths=col_widths)
    summary_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (5, 0), (6, -1), "RIGHT"),
        ("FONTNAME", (5, 2), (6, 2), "Helvetica-Bold"),
        ("FONTSIZE", (5, 2), (6, 2), 10),
        ("TEXTCOLOR", (5, 2), (6, 2), INDIGO),
        ("BACKGROUND", (5, 2), (6, 2), INDIGO_LIGHT),
        ("PADDING", (5, 0), (6, -1), 5),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 8 * mm))

    # ── Terms ─────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E5E7EB")))
    story.append(Spacer(1, 4 * mm))
    terms_style = ParagraphStyle("terms", fontSize=7.5, textColor=GREY, leading=12)
    story.append(Paragraph("<b>Terms & Conditions</b>", ParagraphStyle("th", fontSize=8, fontName="Helvetica-Bold")))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        "1. This quotation is valid for 30 days from the date of issue.  "
        "2. 50% advance payment required to initiate work.  "
        "3. Balance payable on project completion.  "
        "4. All products carry manufacturer warranty.  "
        "5. Prices are inclusive of installation & basic civil work.  "
        "6. GST @ 18% applicable on all items.",
        terms_style,
    ))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        "<font color='#4F46E5'><b>InteriorAI Platform</b></font>  |  "
        "support@interiorai.in  |  +91-98765-43210  |  www.interiorai.in",
        ParagraphStyle("footer", fontSize=8, alignment=TA_CENTER, textColor=GREY),
    ))

    doc.build(story)
    print(f"[PDF] Generated: {filepath}")
    return filepath


def generate_renders_pdf(project_id: str, project_name: str, renders_data: list) -> str:
    """
    Generates a multi-page PDF with all room renders and their associated product lists.
    renders_data: list of dicts like {"room_name": "Living Room", "image_url": "...", "products": [...]}
    """
    from reportlab.platypus import Image as RLImage
    import urllib.request
    import tempfile

    os.makedirs(PDF_DIR, exist_ok=True)
    filename = f"renders_{project_id[:8]}.pdf"
    filepath = os.path.join(PDF_DIR, filename)

    doc = SimpleDocTemplate(
        filepath, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm,
        topMargin=15*mm, bottomMargin=15*mm
    )
    styles = getSampleStyleSheet()
    story = []

    # Title Page
    story.append(Spacer(1, 40*mm))
    story.append(Paragraph(f"<b><font size='24' color='#4F46E5'>Design Proposal & Renders</font></b>", ParagraphStyle('Title', alignment=TA_CENTER)))
    story.append(Spacer(1, 10*mm))
    story.append(Paragraph(f"<font size='14' color='#1E1B4B'>{project_name}</font>", ParagraphStyle('SubTitle', alignment=TA_CENTER)))
    story.append(Spacer(1, 20*mm))
    story.append(Paragraph(f"<font size='10' color='#6B7280'>Generated on {datetime.datetime.utcnow().strftime('%d %b %Y')}</font>", ParagraphStyle('Date', alignment=TA_CENTER)))
    story.append(Spacer(1, 40*mm))
    
    # Renders pages
    for r in renders_data:
        story.append(Paragraph(f"<b><font size='16' color='#1E1B4B'>{r['room_name']}</font></b>", styles["Heading2"]))
        story.append(Spacer(1, 5*mm))

        img_url = r.get("image_url")
        if img_url:
            # Handle local static paths vs remote URLs
            try:
                if img_url.startswith("/static/"):
                    local_path = img_url.replace("/static/", "")
                    if os.path.exists(local_path):
                        story.append(RLImage(local_path, width=170*mm, height=113*mm))
                else:
                    # Download remote image temp
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tf:
                        urllib.request.urlretrieve(img_url, tf.name)
                        story.append(RLImage(tf.name, width=170*mm, height=113*mm))
            except Exception as e:
                print(f"[PDF] Could not add image {img_url}: {e}")
                story.append(Paragraph("<i>[Image could not be loaded]</i>", styles["Normal"]))
        
        story.append(Spacer(1, 10*mm))

        if r.get("products"):
            story.append(Paragraph("<b>Featured Items</b>", styles["Heading4"]))
            story.append(Spacer(1, 2*mm))
            
            headers = ["Item", "Category", "Specs"]
            table_data = [headers]
            for p in r["products"]:
                specs = f"Color: {p.get('custom_color','-')}"
                if p.get('custom_size'): specs += f" | Size: {p.get('custom_size')}"
                table_data.append([
                    Paragraph(p.get("name", ""), styles["Normal"]),
                    p.get("category", ""),
                    Paragraph(specs, styles["Normal"])
                ])
            
            t = Table(table_data, colWidths=[60*mm, 35*mm, 75*mm])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,0), INDIGO_LIGHT),
                ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
                ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
                ("PADDING", (0,0), (-1,-1), 5),
            ]))
            story.append(t)
            
            t = Table(table_data, colWidths=[60*mm, 35*mm, 75*mm])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,0), INDIGO_LIGHT),
                ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
                ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
                ("PADDING", (0,0), (-1,-1), 5),
            ]))
            story.append(t)
            
        story.append(Spacer(1, 20*mm))

    doc.build(story)
    return filepath


# ─── Floor Plan Blueprint Helper ──────────────────────────────────────────────

def _draw_room_blueprint(room_name: str, products: list):
    """
    Draw a top-down floor plan vector blueprint showing ONLY the user-selected
    products placed on a clean room shell (walls, door arc, windows).
    Returns a ReportLab Drawing object.
    """
    from reportlab.graphics.shapes import Drawing, Rect, Line, Circle, String

    W, H = 490, 340
    draw = Drawing(W, H)

    x0, y0 = 68, 25
    rw, rh = 355, 288
    x1 = x0 + rw
    y1 = y0 + rh

    C_WALL = colors.HexColor("#1E1B4B")
    C_BG   = colors.HexColor("#F8F9FF")
    C_GRID = colors.HexColor("#ECEEF8")
    C_FURN = colors.HexColor("#E8E9F5")
    C_FSTK = colors.HexColor("#374151")
    C_WIN  = colors.HexColor("#BFDBFE")
    C_PTR  = colors.HexColor("#4F46E5")
    C_LBL  = colors.HexColor("#1E1B4B")
    C_DIM  = colors.HexColor("#6B7280")
    C_LAMP = colors.HexColor("#F59E0B")

    # Grid
    for gx in range(x0, x1 + 1, 20):
        draw.add(Line(gx, y0, gx, y1, strokeColor=C_GRID, strokeWidth=0.4))
    for gy in range(y0, y1 + 1, 20):
        draw.add(Line(x0, gy, x1, gy, strokeColor=C_GRID, strokeWidth=0.4))

    # Room shell
    draw.add(Rect(x0, y0, rw, rh, fillColor=C_BG, strokeColor=None))
    draw.add(Rect(x0, y0, rw, rh, fillColor=None, strokeColor=C_WALL, strokeWidth=3))

    # Door (bottom-left)
    door_w = 42
    draw.add(Rect(x0 + 1, y0 - 1, door_w - 1, 5, fillColor=C_BG, strokeColor=None))
    draw.add(Line(x0, y0 + door_w, x0 + door_w, y0, strokeColor=C_DIM, strokeWidth=0.9))
    draw.add(String(x0 + 4, y0 + 4, "DOOR", fontName="Helvetica", fontSize=6, fillColor=C_DIM))

    # Window (top wall)
    wx = x0 + rw // 2 - 55
    draw.add(Rect(wx, y1 - 5, 110, 10, fillColor=C_WIN, strokeColor=C_WALL, strokeWidth=1.5))
    draw.add(Line(wx + 55, y1 - 5, wx + 55, y1 + 5, strokeColor=C_WALL, strokeWidth=0.8))
    draw.add(String(wx + 55, y1 + 7, "WINDOW", fontName="Helvetica", fontSize=6,
                    fillColor=C_DIM, textAnchor="middle"))

    # Product text
    all_txt = " ".join(
        (p.get("category", "") + " " + p.get("name", "")).lower()
        for p in products
    )

    def sel(*kw):
        return any(k in all_txt for k in kw)

    labels = []

    def add_lbl(txt, px, py, lx, ly, anchor="end"):
        labels.append((txt, px, py, lx, ly, anchor))

    # 1. BED
    if sel("bed", "mattress", "cot"):
        bx, by, bw, bh = x0 + 110, y0 + 120, 155, 130
        draw.add(Rect(bx, by, bw, bh, fillColor=C_FURN, strokeColor=C_FSTK, strokeWidth=1.5))
        draw.add(Rect(bx, by + bh - 20, bw, 20,
                      fillColor=colors.HexColor("#D1D5DB"), strokeColor=C_FSTK, strokeWidth=1))
        draw.add(Rect(bx + 15, by + bh - 36, 55, 13,
                      fillColor=colors.white, strokeColor=C_DIM, strokeWidth=0.7))
        draw.add(Rect(bx + 85, by + bh - 36, 55, 13,
                      fillColor=colors.white, strokeColor=C_DIM, strokeWidth=0.7))
        draw.add(Line(bx, by + 85, bx + bw, by + 85, strokeColor=C_DIM, strokeWidth=0.7))
        add_lbl("Double Bed", bx + bw // 2, by + bh // 2, x0 - 5, by + bh // 2 + 20)

    # 2. SIDE TABLE
    if sel("side table", "nightstand", "bedside"):
        draw.add(Rect(x0 + 58, y0 + 178, 42, 42, fillColor=C_FURN, strokeColor=C_FSTK, strokeWidth=1))
        draw.add(Circle(x0 + 79, y0 + 199, 8, fillColor=colors.white, strokeColor=C_LAMP, strokeWidth=1.2))
        draw.add(Rect(x0 + 275, y0 + 178, 42, 42, fillColor=C_FURN, strokeColor=C_FSTK, strokeWidth=1))
        draw.add(Circle(x0 + 296, y0 + 199, 8, fillColor=colors.white, strokeColor=C_LAMP, strokeWidth=1.2))
        add_lbl("Side Tables", x0 + 79, y0 + 199, x0 - 5, y0 + 199)

    # 3. WARDROBE
    if sel("wardrobe", "closet", "cupboard", "almirah", "cabinet"):
        wx2, wy2, ww2, wh2 = x0 + 5, y0 + 95, 48, 150
        draw.add(Rect(wx2, wy2, ww2, wh2,
                      fillColor=colors.HexColor("#F3F4F6"), strokeColor=C_FSTK, strokeWidth=1.5))
        draw.add(Line(wx2 + ww2 // 2, wy2, wx2 + ww2 // 2, wy2 + wh2,
                      strokeColor=C_DIM, strokeWidth=0.8))
        draw.add(Circle(wx2 + ww2 // 2 - 8, wy2 + wh2 // 2, 3, fillColor=C_DIM, strokeColor=None))
        draw.add(Circle(wx2 + ww2 // 2 + 8, wy2 + wh2 // 2, 3, fillColor=C_DIM, strokeColor=None))
        add_lbl("Wardrobe", wx2 + ww2 // 2, wy2 + wh2 // 2, x0 - 5, wy2 + wh2 // 2 - 10)

    # 4. DRESSING TABLE
    if sel("dressing", "dresser", "vanity table", "makeup"):
        draw.add(Rect(x0 + 80, y0 + 5, 95, 38, fillColor=C_FURN, strokeColor=C_FSTK, strokeWidth=1.2))
        draw.add(Rect(x0 + 92, y0 + 43, 70, 5, fillColor=C_WIN, strokeColor=C_FSTK, strokeWidth=0.8))
        add_lbl("Dressing Table", x0 + 127, y0 + 24, x0 - 5, y0 + 24)

    # 5. STUDY DESK
    if sel("study", "desk", "work table", "computer table", "writing table"):
        dx, dy = x0 + 280, y0 + 5
        draw.add(Rect(dx, dy, 100, 45,
                      fillColor=colors.HexColor("#F9FAFB"), strokeColor=C_FSTK, strokeWidth=1.2))
        draw.add(String(dx + 50, dy + 19, "DESK", fontName="Helvetica", fontSize=7,
                        fillColor=C_DIM, textAnchor="middle"))
        add_lbl("Study Desk", dx + 50, dy + 22, x1 + 5, dy + 22, "start")

    # 6. CHAIR
    if sel("chair", "stool", "office chair"):
        cx2, cy2 = x0 + 330, y0 + 68
        draw.add(Circle(cx2, cy2, 17, fillColor=colors.white, strokeColor=C_FSTK, strokeWidth=1))
        draw.add(Rect(cx2 - 11, cy2 + 17, 22, 6, fillColor=colors.white, strokeColor=C_FSTK))
        add_lbl("Chair", cx2, cy2, x1 + 5, cy2, "start")

    # 7. SOFA
    if sel("sofa", "couch", "sectional", "loveseat"):
        sx, sy, sw, sh = x0 + 55, y0 + 55, 250, 88
        draw.add(Rect(sx, sy, sw, sh, fillColor=C_FURN, strokeColor=C_FSTK, strokeWidth=1.5))
        draw.add(Rect(sx, sy + sh - 20, sw, 20,
                      fillColor=colors.HexColor("#D1D5DB"), strokeColor=C_FSTK, strokeWidth=1))
        for i in range(3):
            draw.add(Rect(sx + 10 + i * 80, sy + 8, 72, 55,
                          fillColor=colors.white, strokeColor=C_DIM, strokeWidth=0.8))
        add_lbl("Sofa", sx + sw // 2, sy + sh // 2, x0 - 5, sy + sh // 2)

    # 8. COFFEE TABLE
    if sel("coffee table", "centre table", "center table", "ottoman"):
        ctx, cty = x0 + 120, y0 + 165
        draw.add(Rect(ctx, cty, 130, 65,
                      fillColor=colors.HexColor("#F9FAFB"), strokeColor=C_FSTK, strokeWidth=1.2))
        add_lbl("Coffee Table", ctx + 65, cty + 32, x0 - 5, cty + 32)

    # 9. TV UNIT
    if sel("tv", "television", "entertainment", "media unit", "tv unit"):
        tx, ty = x0 + 70, y1 - 38
        draw.add(Rect(tx, ty, 230, 28,
                      fillColor=colors.HexColor("#374151"), strokeColor=C_FSTK, strokeWidth=1))
        draw.add(Rect(tx + 8, ty + 5, 214, 16,
                      fillColor=colors.HexColor("#6B7280"), strokeColor=None))
        add_lbl("TV Unit", tx + 115, ty + 14, x1 + 5, ty + 14, "start")

    # 10. BOOKSHELF
    if sel("bookshelf", "bookcase", "shelf", "rack", "display unit"):
        bsx, bsy = x1 - 42, y0 + 55
        draw.add(Rect(bsx, bsy, 37, 135, fillColor=C_FURN, strokeColor=C_FSTK, strokeWidth=1.2))
        for row in range(4):
            draw.add(Line(bsx, bsy + row * 33, bsx + 37, bsy + row * 33,
                          strokeColor=C_DIM, strokeWidth=0.6))
        add_lbl("Bookshelf", bsx + 18, bsy + 67, x1 + 5, bsy + 67, "start")

    # 11. ARMCHAIR
    if sel("armchair", "accent chair", "recliner", "lounge chair"):
        ax, ay = x0 + 318, y0 + 170
        draw.add(Rect(ax, ay, 55, 55, fillColor=C_FURN, strokeColor=C_FSTK, strokeWidth=1.2))
        draw.add(Rect(ax, ay + 43, 55, 12,
                      fillColor=colors.HexColor("#D1D5DB"), strokeColor=C_FSTK, strokeWidth=0.8))
        add_lbl("Armchair", ax + 27, ay + 27, x1 + 5, ay + 27, "start")

    # 12. DINING TABLE
    if sel("dining table", "dining set", "6 seater", "4 seater"):
        dtx, dty, dtw, dth = x0 + 100, y0 + 95, 180, 105
        draw.add(Rect(dtx, dty, dtw, dth, fillColor=C_FURN, strokeColor=C_FSTK, strokeWidth=1.5))
        for ci in range(2):
            draw.add(Rect(dtx + 25 + ci * 85, dty - 26, 55, 22,
                          fillColor=colors.white, strokeColor=C_FSTK, strokeWidth=1))
            draw.add(Rect(dtx + 25 + ci * 85, dty + dth + 4, 55, 22,
                          fillColor=colors.white, strokeColor=C_FSTK, strokeWidth=1))
        draw.add(Rect(dtx - 26, dty + 28, 22, 50,
                      fillColor=colors.white, strokeColor=C_FSTK, strokeWidth=1))
        draw.add(Rect(dtx + dtw + 4, dty + 28, 22, 50,
                      fillColor=colors.white, strokeColor=C_FSTK, strokeWidth=1))
        add_lbl("Dining Table + Chairs", dtx + dtw // 2, dty + dth // 2, x0 - 5, dty + dth // 2)

    # 13. KITCHEN COUNTER
    if sel("kitchen", "counter", "modular kitchen", "hob", "chimney", "overhead cabinet"):
        draw.add(Rect(x0 + 5, y0 + 38, 28, rh - 70,
                      fillColor=colors.HexColor("#F3F4F6"), strokeColor=C_FSTK, strokeWidth=1.5))
        draw.add(Rect(x0 + 5, y0 + 5, rw - 35, 28,
                      fillColor=colors.HexColor("#F3F4F6"), strokeColor=C_FSTK, strokeWidth=1.5))
        draw.add(Circle(x0 + 19, y0 + 200, 11,
                        fillColor=colors.white, strokeColor=C_FSTK, strokeWidth=1))
        draw.add(String(x0 + 19, y0 + 196, "S", fontName="Helvetica-Bold", fontSize=7,
                        fillColor=C_DIM, textAnchor="middle"))
        for bx3 in [x0 + 110, x0 + 150, x0 + 190, x0 + 230]:
            draw.add(Circle(bx3, y0 + 19, 9,
                            fillColor=colors.HexColor("#E5E7EB"), strokeColor=C_FSTK, strokeWidth=1))
        add_lbl("Modular Kitchen Counter", x0 + 19, y0 + 185, x0 - 5, y0 + 185)

    # 14. REFRIGERATOR
    if sel("refrigerator", "fridge"):
        draw.add(Rect(x1 - 52, y0 + 5, 42, 60,
                      fillColor=C_FURN, strokeColor=C_FSTK, strokeWidth=1.5))
        draw.add(Line(x1 - 52, y0 + 35, x1 - 10, y0 + 35, strokeColor=C_DIM, strokeWidth=0.8))
        draw.add(Circle(x1 - 20, y0 + 20, 3, fillColor=C_DIM))
        draw.add(Circle(x1 - 20, y0 + 50, 3, fillColor=C_DIM))
        add_lbl("Refrigerator", x1 - 31, y0 + 32, x1 + 5, y0 + 32, "start")

    # 15. BATHTUB
    if sel("bathtub", "bath tub", "tub"):
        btx, bty = x0 + 8, y1 - 95
        draw.add(Rect(btx, bty, 110, 80,
                      fillColor=C_WIN, strokeColor=C_FSTK,
                      strokeWidth=1.5, rx=10, ry=10))
        draw.add(Circle(btx + 100, bty + 70, 6, fillColor=colors.white, strokeColor=C_FSTK, strokeWidth=1))
        add_lbl("Bathtub", btx + 55, bty + 40, x0 - 5, bty + 40)

    # 16. SHOWER
    if sel("shower", "shower cubicle"):
        shx, shy = x1 - 85, y1 - 90
        draw.add(Rect(shx, shy, 75, 80,
                      fillColor=colors.HexColor("#EFF6FF"), strokeColor=C_FSTK, strokeWidth=1.5))
        draw.add(Circle(shx + 37, shy + 55, 14,
                        fillColor=C_WIN, strokeColor=C_FSTK, strokeWidth=1))
        draw.add(Line(shx + 37, shy + 69, shx + 37, shy + 80,
                      strokeColor=C_FSTK, strokeWidth=1.2))
        add_lbl("Shower", shx + 37, shy + 40, x1 + 5, shy + 40, "start")

    # 17. WASH BASIN
    if sel("wash basin", "basin", "vanity unit", "sink"):
        draw.add(Rect(x0 + 8, y0 + 8, 50, 38,
                      fillColor=colors.white, strokeColor=C_FSTK,
                      strokeWidth=1.2, rx=6, ry=6))
        draw.add(Circle(x0 + 33, y0 + 27, 6, fillColor=C_WIN, strokeColor=C_FSTK, strokeWidth=0.8))
        add_lbl("Wash Basin", x0 + 33, y0 + 27, x0 - 5, y0 + 27)

    # 18. TOILET
    if sel("toilet", "wc", "commode", "water closet"):
        draw.add(Rect(x1 - 62, y0 + 8, 48, 60,
                      fillColor=colors.white, strokeColor=C_FSTK,
                      strokeWidth=1.5, rx=12, ry=12))
        draw.add(Rect(x1 - 57, y0 + 53, 38, 10,
                      fillColor=colors.HexColor("#F3F4F6"), strokeColor=C_FSTK, strokeWidth=0.8))
        add_lbl("WC / Toilet", x1 - 38, y0 + 35, x1 + 5, y0 + 35, "start")

    # Leader lines + labels
    for (txt, px, py, lx, ly, anchor) in labels:
        draw.add(Circle(px, py, 2.8, fillColor=C_PTR, strokeColor=None))
        draw.add(Line(px, py, lx, ly, strokeColor=C_PTR, strokeWidth=0.9))
        draw.add(Line(lx - (5 if anchor == "end" else -5), ly,
                      lx, ly, strokeColor=C_PTR, strokeWidth=1.2))
        draw.add(String(lx + (-4 if anchor == "end" else 4), ly + 2, txt,
                        fontName="Helvetica-Bold", fontSize=7,
                        fillColor=C_LBL, textAnchor=anchor))

    # Room name watermark (bottom-right)
    draw.add(String(x1 - 5, y0 + 6, room_name.upper(),
                    fontName="Helvetica-Bold", fontSize=8,
                    fillColor=colors.HexColor("#9CA3AF"), textAnchor="end"))

    # Scale bar
    draw.add(Line(x0, 10, x0 + 100, 10, strokeColor=C_WALL, strokeWidth=1.2))
    draw.add(Line(x0, 6, x0, 14, strokeColor=C_WALL, strokeWidth=1))
    draw.add(Line(x0 + 100, 6, x0 + 100, 14, strokeColor=C_WALL, strokeWidth=1))
    draw.add(String(x0 + 50, 13, "~3 m", fontName="Helvetica", fontSize=6.5,
                    fillColor=C_WALL, textAnchor="middle"))

    return draw


def generate_floor_plan_pdf(project_id: str, project, user, rooms_data: list) -> str:
    """
    Generates a professional Design Presentation PDF.
    Each room page shows a vector blueprint with ONLY the user-selected
    products placed on a clean room shell, plus a specifications table.
    """
    from reportlab.platypus import PageBreak

    os.makedirs(PDF_DIR, exist_ok=True)
    filename = f"floorplan_{project_id[:8]}.pdf"
    filepath = os.path.join(PDF_DIR, filename)

    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    story = []

    # ── Title page ────────────────────────────────────────────────────────
    story.append(Spacer(1, 30 * mm))
    story.append(Paragraph(
        "<b><font size='26' color='#4F46E5'>Design Presentation &amp; Layout Plan</font></b>",
        ParagraphStyle("FPTitle", alignment=TA_CENTER, leading=32)
    ))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(
        f"<font size='14' color='#1E1B4B'>{project.property_name or 'My Home'}</font>",
        ParagraphStyle("FPSub", alignment=TA_CENTER)
    ))
    story.append(Spacer(1, 15 * mm))

    meta = [
        [Paragraph("<b>Client Name:</b>",  styles["Normal"]),
         Paragraph(user.name or "Valued Client", styles["Normal"])],
        [Paragraph("<b>BHK Type:</b>",     styles["Normal"]),
         Paragraph(project.bhk_type or "N/A", styles["Normal"])],
        [Paragraph("<b>City:</b>",         styles["Normal"]),
         Paragraph(project.city or "N/A", styles["Normal"])],
        [Paragraph("<b>Date:</b>",         styles["Normal"]),
         Paragraph(datetime.datetime.utcnow().strftime("%d %b %Y"), styles["Normal"])],
    ]
    t_meta = Table(meta, colWidths=[40 * mm, 80 * mm])
    t_meta.setStyle(TableStyle([
        ("GRID",    (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_GREY),
    ]))
    story.append(KeepTogether([t_meta]))
    story.append(Spacer(1, 30 * mm))
    story.append(Paragraph(
        "<font size='9' color='#6B7280'>© InteriorAI Platform — Personalized Interior Design Proposals</font>",
        ParagraphStyle("FPFooter", alignment=TA_CENTER)
    ))
    story.append(PageBreak())

    # ── Room pages ─────────────────────────────────────────────────────────
    for r in rooms_data:
        room_name = r.get("room_name", "Room Layout")
        products  = r.get("products", [])

        story.append(Paragraph(
            f"<b><font size='18' color='#1E1B4B'>{room_name}</font></b>",
            styles["Heading2"]
        ))
        story.append(Spacer(1, 2 * mm))

        count = len(products)
        note = (
            f"<i><font size='9' color='#6B7280'>"
            f"{count} item{'s' if count != 1 else ''} selected — shown on floor plan below"
            f"</font></i>"
            if count else
            "<i><font size='9' color='#9CA3AF'>No products selected for this room yet.</font></i>"
        )
        story.append(Paragraph(note, styles["Normal"]))
        story.append(Spacer(1, 3 * mm))

        # Vector blueprint — only user-selected products
        story.append(_draw_room_blueprint(room_name, products))
        story.append(Spacer(1, 4 * mm))

        # Specifications table
        if products:
            story.append(Paragraph("<b>Selected Items — Specifications</b>", styles["Heading4"]))
            story.append(Spacer(1, 1.5 * mm))

            tdata = [["Item Name", "Category", "Style", "Custom Details"]]
            for p in products:
                customs = []
                if p.get("custom_color"):    customs.append(f"Color: {p['custom_color']}")
                if p.get("custom_material"): customs.append(f"Material: {p['custom_material']}")
                if p.get("custom_size"):     customs.append(f"Size: {p['custom_size']}")
                tdata.append([
                    Paragraph(p.get("name", "Custom Item"), styles["Normal"]),
                    p.get("category", "Furniture").replace("_", " ").title(),
                    p.get("style", "Modern").title(),
                    Paragraph(", ".join(customs) if customs else "Standard", styles["Normal"]),
                ])

            t_spec = Table(tdata, colWidths=[55*mm, 38*mm, 28*mm, 49*mm])
            t_spec.setStyle(TableStyle([
                ("BACKGROUND",    (0, 0), (-1, 0), INDIGO_LIGHT),
                ("TEXTCOLOR",     (0, 0), (-1, 0), DARK),
                ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE",      (0, 0), (-1, -1), 8.5),
                ("GRID",          (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
                ("PADDING",       (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS",(0, 1), (-1, -1),
                 [colors.white, colors.HexColor("#F8F9FF")]),
            ]))
            story.append(KeepTogether([t_spec]))

        story.append(Spacer(1, 8 * mm))
        story.append(PageBreak())

    doc.build(story)
    return filepath

