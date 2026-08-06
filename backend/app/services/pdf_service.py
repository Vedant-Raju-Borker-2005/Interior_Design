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
            
        story.append(Spacer(1, 20*mm))

    doc.build(story)
    return filepath


# ─── Floor Plan Blueprint Helper ──────────────────────────────────────────────

def _draw_room_blueprint(room_name: str, products: list):
    """
    Draw a top-down floor plan vector blueprint showing ONLY the user-selected
    products placed on a clean room shell (walls, door arc, windows) matching the room type.
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
    C_FSTK = colors.HexColor("#374151")
    C_WIN  = colors.HexColor("#BFDBFE")
    C_PTR  = colors.HexColor("#4F46E5")
    C_LBL  = colors.HexColor("#1E1B4B")
    C_DIM  = colors.HexColor("#6B7280")
    C_LAMP = colors.HexColor("#F59E0B")

    # Dynamic Color Selection based on user product customization (e.g. mattress color)
    def get_custom_color_hex(category_keywords, default_hex):
        for p in products:
            p_cat = (p.get("category") or "").lower()
            p_name = (p.get("name") or "").lower()
            if any(kw in p_cat or kw in p_name for kw in category_keywords):
                c = (p.get("custom_color") or "").lower()
                if "warm beige" in c or "beige" in c:
                    return colors.HexColor("#E5D3C0") # Warm Beige
                elif "dark brown" in c or "brown" in c:
                    return colors.HexColor("#8B5A2B") # Dark Brown
                elif "golden brown" in c or "golden" in c or "teak" in c or "oak" in c:
                    return colors.HexColor("#CD853F") # Golden Brown
                elif c:
                    try:
                        if c.startswith("#"):
                            return colors.HexColor(c)
                    except:
                        pass
        return colors.HexColor(default_hex)

    # Grid
    for gx in range(x0, x1 + 1, 20):
        draw.add(Line(gx, y0, gx, y1, strokeColor=C_GRID, strokeWidth=0.4))
    for gy in range(y0, y1 + 1, 20):
        draw.add(Line(x0, gy, x1, gy, strokeColor=C_GRID, strokeWidth=0.4))

    # Room type determination
    rt = room_name.lower().replace(" ", "_").replace("master_", "").replace("kid_", "").replace("guest_", "")

    # ── Full Floor Texture (herringbone wood) ─────────────────────────────────
    # Warm wood base colour – or use custom rug colour if selected
    C_FLOOR_BASE = colors.HexColor("#D9B98A")  # warm oak base
    C_FLOOR_LINE = colors.HexColor("#B8966A")  # plank divider line
    draw.add(Rect(x0, y0, rw, rh, fillColor=C_FLOOR_BASE, strokeColor=None))

    # Herringbone plank lines — diagonal at 45°
    plank_w = 18  # gap between diagonal lines
    # NW-SE diagonals (/)  
    for offset in range(-(rh), rw + rh, plank_w):
        px1 = x0 + offset
        py1 = y0
        px2 = x0 + offset + rh
        py2 = y1
        # clip to room bounds
        if px1 < x0:
            py1 += (x0 - px1)
            px1 = x0
        if px2 > x1:
            py2 -= (px2 - x1)
            px2 = x1
        if px1 <= x1 and px2 >= x0 and py1 <= y1 and py2 >= y0:
            draw.add(Line(px1, py1, px2, py2,
                          strokeColor=C_FLOOR_LINE, strokeWidth=0.5))
    # NE-SW diagonals (\)
    for offset in range(x0 - rh, x1 + rh, plank_w * 2):
        px1 = offset
        py1 = y0
        px2 = offset - rh
        py2 = y1
        if px1 < x0:
            delta = x0 - px1
            py1 += delta; px1 = x0
        if px2 < x0:
            delta = x0 - px2
            py2 -= delta; px2 = x0
        if px1 > x1:
            delta = px1 - x1
            py1 += delta; px1 = x1
        if px2 > x1:
            delta = px2 - x1
            py2 -= delta; px2 = x1
        if py1 <= y1 and py2 >= y0:
            draw.add(Line(px1, py1, px2, py2,
                          strokeColor=C_FLOOR_LINE, strokeWidth=0.3))

    draw.add(Rect(x0, y0, rw, rh, fillColor=None, strokeColor=C_WALL, strokeWidth=3))

    # Custom door and windows per room type
    if "living" in rt:
        # Door bottom-left (South)
        draw.add(Rect(x0 + 60, y0 - 2, 45, 5, fillColor=C_BG, strokeColor=None))
        draw.add(Line(x0 + 60, y0, x0 + 60 + 45, y0 + 45, strokeColor=C_DIM, strokeWidth=0.9))
        draw.add(String(x0 + 64, y0 + 6, "DOOR", fontName="Helvetica", fontSize=6, fillColor=C_DIM))
        # North Window
        draw.add(Rect(x0 + 120, y1 - 4, 110, 8, fillColor=C_WIN, strokeColor=C_WALL, strokeWidth=1.2))
        # East Window
        draw.add(Rect(x1 - 4, y0 + 80, 8, 90, fillColor=C_WIN, strokeColor=C_WALL, strokeWidth=1.2))
    elif "bedroom" in rt or "bed" in rt:
        # Door West wall (left bottom)
        draw.add(Rect(x0 - 2, y0 + 40, 5, 45, fillColor=C_BG, strokeColor=None))
        draw.add(Line(x0, y0 + 40, x0 + 45, y0 + 40 + 45, strokeColor=C_DIM, strokeWidth=0.9))
        draw.add(String(x0 + 6, y0 + 44, "DOOR", fontName="Helvetica", fontSize=6, fillColor=C_DIM))
        # Window East wall (right middle)
        draw.add(Rect(x1 - 4, y0 + 100, 8, 80, fillColor=C_WIN, strokeColor=C_WALL, strokeWidth=1.2))
    elif "kitchen" in rt:
        # Door bottom (South)
        draw.add(Rect(x0 + 120, y0 - 2, 45, 5, fillColor=C_BG, strokeColor=None))
        # Window North wall (top above platform)
        draw.add(Rect(x0 + 100, y1 - 4, 120, 8, fillColor=C_WIN, strokeColor=C_WALL, strokeWidth=1.2))
    elif "bathroom" in rt or "bath" in rt:
        # Door South wall
        draw.add(Rect(x0 + 20, y0 - 2, 40, 5, fillColor=C_BG, strokeColor=None))
        # East ventilation window
        draw.add(Rect(x1 - 4, y0 + 80, 8, 40, fillColor=C_WIN, strokeColor=C_WALL, strokeWidth=1.2))
    elif "balcony" in rt:
        # sliding door West (left)
        draw.add(Rect(x0 - 2, y0 + 40, 5, 80, fillColor=C_WIN, strokeColor=C_WALL, strokeWidth=1.2))
        # Railing North
        draw.add(Line(x0, y1, x1, y1, strokeColor=C_WALL, strokeWidth=1.5))
    else: # Dining/others
        # Door West
        draw.add(Rect(x0 - 2, y0 + 80, 5, 45, fillColor=C_BG, strokeColor=None))
        # Window North
        draw.add(Rect(x0 + 100, y1 - 4, 100, 8, fillColor=C_WIN, strokeColor=C_WALL, strokeWidth=1.2))

    # Product list normalization
    all_txt = " ".join((p.get("category", "") + " " + p.get("name", "")).lower() for p in products)

    def sel(*kw):
        return any(k in all_txt for k in kw)

    labels = []
    def add_lbl(txt, px, py, lx, ly, anchor="end"):
        labels.append((txt, px, py, lx, ly, anchor))

    # Custom furniture colors based on user product selections
    c_bed       = get_custom_color_hex(["bed", "mattress", "cot"], "#E8E9F5")
    c_sidetable = get_custom_color_hex(["side table", "nightstand", "bedside"], "#E8E9F5")
    c_wardrobe  = get_custom_color_hex(["wardrobe", "closet", "cupboard", "almirah", "cabinet"], "#F3F4F6")
    c_sofa      = get_custom_color_hex(["sofa", "couch", "sectional", "loveseat"], "#E8E9F5")
    c_coffeetable = get_custom_color_hex(["coffee table", "centre table", "center table"], "#F9FAFB")
    c_desk      = get_custom_color_hex(["study", "desk", "work table"], "#F9FAFB")
    c_dining    = get_custom_color_hex(["dining table", "dining set"], "#E8E9F5")

    # 1. BED (Centered on East/North wall depending on room)
    if sel("bed", "mattress", "cot"):
        bx, by, bw, bh = x0 + 102, y1 - 140, 150, 130
        draw.add(Rect(bx, by, bw, bh, fillColor=c_bed, strokeColor=C_FSTK, strokeWidth=1.5))
        draw.add(Rect(bx, by + bh - 15, bw, 15, fillColor=colors.HexColor("#D1D5DB"), strokeColor=C_FSTK, strokeWidth=1))
        # Pillows
        draw.add(Rect(bx + 15, by + bh - 28, 50, 10, fillColor=colors.white, strokeColor=C_DIM, strokeWidth=0.7))
        draw.add(Rect(bx + 85, by + bh - 28, 50, 10, fillColor=colors.white, strokeColor=C_DIM, strokeWidth=0.7))
        add_lbl("Double Bed", bx + bw // 2, by + bh // 2, x0 - 5, by + bh // 2)

    # 2. BEDSIDE TABLES
    if sel("side table", "nightstand", "bedside"):
        if sel("bed", "mattress", "cot"):
            # Position L & R of the bed
            draw.add(Rect(x0 + 50, y1 - 45, 40, 40, fillColor=c_sidetable, strokeColor=C_FSTK, strokeWidth=1))
            draw.add(Rect(x0 + 260, y1 - 45, 40, 40, fillColor=c_sidetable, strokeColor=C_FSTK, strokeWidth=1))
            add_lbl("Bedside L", x0 + 70, y1 - 25, x0 - 5, y1 - 25)
            add_lbl("Bedside R", x0 + 280, y1 - 25, x1 + 5, y1 - 25, "start")
        else:
            draw.add(Rect(x0 + 20, y0 + 150, 40, 40, fillColor=c_sidetable, strokeColor=C_FSTK, strokeWidth=1))
            add_lbl("Side Table", x0 + 40, y0 + 170, x0 - 5, y0 + 170)

    # 3. WARDROBE (Along Bottom Wall for Bedroom)
    if sel("wardrobe", "closet", "cupboard", "almirah", "cabinet"):
        if "bedroom" in rt:
            # Draw 2-shutter wardrobes at bottom-left and bottom-right
            draw.add(Rect(x0 + 15, y0 + 15, 90, 45, fillColor=c_wardrobe, strokeColor=C_FSTK, strokeWidth=1.5))
            draw.add(Line(x0 + 60, y0 + 15, x0 + 60, y0 + 60, strokeColor=C_DIM, strokeWidth=0.8))
            draw.add(Rect(x1 - 105, y0 + 15, 90, 45, fillColor=c_wardrobe, strokeColor=C_FSTK, strokeWidth=1.5))
            draw.add(Line(x1 - 60, y0 + 15, x1 - 60, y0 + 60, strokeColor=C_DIM, strokeWidth=0.8))
            add_lbl("Wardrobe L", x0 + 60, y0 + 38, x0 - 5, y0 + 38)
            add_lbl("Wardrobe R", x1 - 60, y0 + 38, x1 + 5, y0 + 38, "start")
        else:
            wx2, wy2, ww2, wh2 = x0 + 10, y0 + 90, 45, 140
            draw.add(Rect(wx2, wy2, ww2, wh2, fillColor=c_wardrobe, strokeColor=C_FSTK, strokeWidth=1.5))
            draw.add(Line(wx2 + ww2 // 2, wy2, wx2 + ww2 // 2, wy2 + wh2, strokeColor=C_DIM, strokeWidth=0.8))
            add_lbl("Wardrobe", wx2 + ww2 // 2, wy2 + wh2 // 2, x0 - 5, wy2 + wh2 // 2)

    # 4. STUDY DESK & STUDY CHAIR (Centered at bottom spacing)
    if sel("study", "desk", "work table", "computer table"):
        dx, dy = x0 + 130, y0 + 15
        draw.add(Rect(dx, dy, 95, 40, fillColor=c_desk, strokeColor=C_FSTK, strokeWidth=1.2))
        add_lbl("Study Desk", dx + 47, dy + 20, x1 + 5, dy + 20, "start")
        # Draw study chair facing table
        cx, cy = x0 + 177, y0 + 75
        draw.add(Circle(cx, cy, 14, fillColor=colors.white, strokeColor=C_FSTK, strokeWidth=1))
        draw.add(Rect(cx - 9, cy + 14, 18, 5, fillColor=colors.white, strokeColor=C_FSTK))

    # 5. SOFA (Aligned along South wall for Living Room)
    if sel("sofa", "couch", "sectional", "loveseat"):
        sx, sy, sw, sh = x0 + 100, y0 + 30, 160, 60
        draw.add(Rect(sx, sy, sw, sh, fillColor=c_sofa, strokeColor=C_FSTK, strokeWidth=1.5))
        draw.add(Rect(sx, sy, sw, 15, fillColor=colors.HexColor("#D1D5DB"), strokeColor=C_FSTK, strokeWidth=1))
        add_lbl("Sofa", sx + sw // 2, sy + sh // 2, x0 - 5, sy + sh // 2)

    # 6. COFFEE TABLE (In front of Sofa)
    if sel("coffee table", "centre table", "center table"):
        ctx, cty = x0 + 115, y0 + 105
        draw.add(Rect(ctx, cty, 130, 50, fillColor=c_coffeetable, strokeColor=C_FSTK, strokeWidth=1.2))
        add_lbl("Coffee Table", ctx + 65, cty + 25, x0 - 5, cty + 25)

    # 7. TV UNIT / ENTERTAINMENT CONSOLE (Facing Sofa)
    if sel("tv", "television", "entertainment", "media unit", "tv unit"):
        tx, ty = x0 + 100, y1 - 40, 160, 30
        draw.add(Rect(tx, ty, 160, 30, fillColor=colors.HexColor("#374151"), strokeColor=C_FSTK, strokeWidth=1))
        add_lbl("TV Console", tx + 80, ty + 15, x1 + 5, ty + 15, "start")

    # 8. DINING TABLE (Centered)
    if sel("dining table", "dining set"):
        dtx, dty, dtw, dth = x0 + 100, y0 + 90, 150, 90
        draw.add(Rect(dtx, dty, dtw, dth, fillColor=c_dining, strokeColor=C_FSTK, strokeWidth=1.5))
        # Chairs
        for ci in range(2):
            draw.add(Rect(dtx + 20 + ci * 70, dty - 18, 40, 18, fillColor=colors.white, strokeColor=C_FSTK))
            draw.add(Rect(dtx + 20 + ci * 70, dty + dth, 40, 18, fillColor=colors.white, strokeColor=C_FSTK))
        add_lbl("Dining Table", dtx + dtw // 2, dty + dth // 2, x0 - 5, dty + dth // 2)

    # 9. KITCHEN PLATFORM
    if "kitchen" in rt and sel("counter", "modular", "hob", "sink"):
        # L-shape counter top
        draw.add(Rect(x0 + 5, y1 - 40, rw - 10, 35, fillColor=colors.HexColor("#F3F4F6"), strokeColor=C_FSTK, strokeWidth=1.5))
        draw.add(Rect(x0 + 5, y0 + 5, 35, rh - 10, fillColor=colors.HexColor("#F3F4F6"), strokeColor=C_FSTK, strokeWidth=1.5))
        add_lbl("Kitchen Platform", x0 + 18, y0 + 120, x0 - 5, y0 + 120)

    # 10. WC / BATHROOM VANITY
    if "bathroom" in rt:
        if sel("toilet", "wc"):
            draw.add(Rect(x1 - 50, y0 + 20, 35, 45, fillColor=colors.white, strokeColor=C_FSTK, rx=8, ry=8))
            add_lbl("WC", x1 - 32, y0 + 42, x1 + 5, y0 + 42, "start")
        if sel("bathtub", "tub"):
            draw.add(Rect(x0 + 10, y1 - 80, 120, 70, fillColor=C_WIN, strokeColor=C_FSTK, rx=10, ry=10))
            add_lbl("Bathtub", x0 + 70, y1 - 45, x0 - 5, y1 - 45)

    # 11. SHOE RACK (near door, Living Room / Bedroom)
    if sel("shoe rack", "shoe", "footwear", "entryway"):
        # Place near the door bottom-left corner
        draw.add(Rect(x0 + 65, y0 + 8, 55, 18,
                      fillColor=colors.HexColor("#E5E7EB"), strokeColor=C_FSTK, strokeWidth=1))
        draw.add(Line(x0 + 87, y0 + 8, x0 + 87, y0 + 26, strokeColor=C_DIM, strokeWidth=0.7))
        add_lbl("Shoe Rack", x0 + 92, y0 + 17, x0 - 5, y0 + 17)

    # Leader lines + labels
    for (txt, px, py, lx, ly, anchor) in labels:
        draw.add(Circle(px, py, 2.5, fillColor=C_PTR, strokeColor=None))
        draw.add(Line(px, py, lx, ly, strokeColor=C_PTR, strokeWidth=0.8))
        draw.add(Line(lx - (5 if anchor == "end" else -5), ly, lx, ly, strokeColor=C_PTR, strokeWidth=1.2))
        draw.add(String(lx + (-4 if anchor == "end" else 4), ly + 2, txt,
                        fontName="Helvetica-Bold", fontSize=7, fillColor=C_LBL, textAnchor=anchor))

    # Room name watermark (bottom-right)
    draw.add(String(x1 - 5, y0 + 6, room_name.upper(),
                    fontName="Helvetica-Bold", fontSize=8, fillColor=colors.HexColor("#9CA3AF"), textAnchor="end"))

    # ── Left Dimensions (Vertical side ticks) ──────────────────────────────────
    ldx = x0 - 35
    # Draw vertical line
    draw.add(Line(ldx, y0, ldx, y1, strokeColor=C_DIM, strokeWidth=0.8))
    # Vertical intervals matching first screenshot: Bed depth (2050mm), Spacing (900mm), Wardrobe depth (600mm)
    y_ticks = [y1, y1 - 165, y0 + 60, y0]
    labels_y = ["2050", "900", "600"]
    
    for yt in y_ticks:
        draw.add(Line(ldx - 4, yt, ldx + 4, yt, strokeColor=C_DIM, strokeWidth=1))
        draw.add(Line(ldx - 3, yt - 3, ldx + 3, yt + 3, strokeColor=C_DIM, strokeWidth=0.8))
        
    for i in range(3):
        mid_y = (y_ticks[i] + y_ticks[i+1]) / 2
        draw.add(String(ldx - 8, mid_y - 2, labels_y[i], fontName="Helvetica", fontSize=6.5, fillColor=C_DIM, textAnchor="end"))

    # ── Top Dimensions (Horizontal top ticks) ──────────────────────────────────
    tdy = y1 + 20
    # Draw horizontal line
    draw.add(Line(x0, tdy, x1, tdy, strokeColor=C_DIM, strokeWidth=0.8))
    # Ticks matching top of first screenshot: Side Table (750mm), Bed (1600mm), Side Table (750mm)
    x_ticks = [x0, x0 + 75, x1 - 75, x1]
    labels_x = ["750", "1600", "750"]
    
    for xt in x_ticks:
        draw.add(Line(xt, tdy - 4, xt, tdy + 4, strokeColor=C_DIM, strokeWidth=1))
        draw.add(Line(xt - 3, tdy - 3, xt + 3, tdy + 3, strokeColor=C_DIM, strokeWidth=0.8))
        
    for i in range(3):
        mid_x = (x_ticks[i] + x_ticks[i+1]) / 2
        draw.add(String(mid_x, tdy + 6, labels_x[i], fontName="Helvetica", fontSize=6.5, fillColor=C_DIM, textAnchor="middle"))

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

        # Custom floor plan blueprint or fallback vector layout
        custom_fp_url = r.get("custom_floor_plan_url")
        if custom_fp_url:
            from reportlab.platypus import Image as RLImage
            import urllib.request
            import tempfile
            try:
                if custom_fp_url.startswith("/static/"):
                    local_path = custom_fp_url.replace("/static/", "")
                    if os.path.exists(local_path):
                        story.append(RLImage(local_path, width=170*mm, height=113*mm))
                    else:
                        story.append(_draw_room_blueprint(room_name, products))
                else:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tf:
                        urllib.request.urlretrieve(custom_fp_url, tf.name)
                        story.append(RLImage(tf.name, width=170*mm, height=113*mm))
            except Exception as e:
                print(f"[PDF] Could not load custom floor plan image {custom_fp_url}: {e}")
                story.append(_draw_room_blueprint(room_name, products))
        else:
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

