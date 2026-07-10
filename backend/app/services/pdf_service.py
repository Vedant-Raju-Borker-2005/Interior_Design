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
