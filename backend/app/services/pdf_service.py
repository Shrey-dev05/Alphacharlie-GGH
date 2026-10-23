"""
PDF Report Service
===================
Generates a tamper-evident, timestamped compliance/non-compliance
report: annotated image + a categorised pass/fail checklist. "Tamper
evident" here means we compute a SHA-256 checksum of the PDF bytes and
store it alongside the report record -- any later edit to the PDF will
no longer match the stored checksum. For a stronger legal guarantee,
layer on a digital signature (e.g. via `pyhanko`) using a government-
issued signing certificate.
"""
from __future__ import annotations

import hashlib
import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
)

styles = getSampleStyleSheet()
title_style = ParagraphStyle("TitleStyle", parent=styles["Title"], fontSize=16)
label_style = ParagraphStyle("LabelStyle", parent=styles["Normal"], textColor=colors.HexColor("#4A5568"))


def generate_compliance_report(
    *,
    scan_id: str,
    brand_name: str | None,
    product_name: str | None,
    compliance_status: str,
    compliance_score: float,
    checks: list[dict],
    image_bytes: bytes | None,
    inspector_name: str,
    barcode_value: str | None = None,
    barcode_symbology: str | None = None,
    brand_product_source: str = "manual",
    generated_for: str = "Official Compliance Record",
    inspector_override: bool = False,
    override_notes: str | None = None,
) -> tuple[bytes, str]:
    """Returns (pdf_bytes, sha256_checksum)."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    story = []

    now = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    story.append(Paragraph("Legal Metrology Compliance Report", title_style))
    story.append(Paragraph(f"Generated: {now} &nbsp;&nbsp;|&nbsp;&nbsp; Scan ID: {scan_id}", label_style))
    story.append(Paragraph(f"Inspector / Auditor: {inspector_name}", label_style))
    if inspector_override:
        story.append(Paragraph(f"<font color='#1B7F4C'><b>[Inspector Override Applied]</b> {override_notes or 'Defects reviewed and cleared under official inspector discretion'}</font>", label_style))
    story.append(Spacer(1, 10 * mm))

    status_color = {
        "compliant": colors.HexColor("#1B7F4C"),
        "non_compliant": colors.HexColor("#B3261E"),
        "partial": colors.HexColor("#C77D00"),
    }.get(compliance_status, colors.grey)

    source_label = {
        "barcode_lookup": "auto-filled from barcode",
        "manual": "manually entered",
        "not_provided": "not provided",
    }.get(brand_product_source, brand_product_source)

    status_display = compliance_status.replace("_", " ").upper()
    if inspector_override:
        status_display += " (INSPECTOR OVERRIDE)"

    summary_data = [
        ["Brand", f"{brand_name or '-'}  ({source_label})"],
        ["Product", f"{product_name or '-'}  ({source_label})"],
        ["Compliance Status", status_display],
        ["Compliance Score", f"{compliance_score}/100"],
    ]
    if barcode_value:
        summary_data.append(["Barcode", f"{barcode_value}  ({barcode_symbology or 'unknown format'})"])

    summary_table = Table(summary_data, colWidths=[50 * mm, 100 * mm])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F7F5F0")),
                ("TEXTCOLOR", (1, 2), (1, 2), status_color),
                ("FONTNAME", (1, 2), (1, 2), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8D3C7")),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 8 * mm))

    if image_bytes:
        try:
            img = RLImage(io.BytesIO(image_bytes), width=140 * mm, height=105 * mm, kind="proportional")
            story.append(img)
            story.append(Spacer(1, 8 * mm))
        except Exception:
            pass  # if the image can't be decoded, skip rather than fail the whole report

    story.append(Paragraph("Rule-by-Rule Checklist", styles["Heading2"]))
    story.append(Spacer(1, 3 * mm))

    cell_style = ParagraphStyle("CellStyle", parent=styles["Normal"], fontSize=8.5, leading=10.5)
    table_data = [["Rule", "Field", "Severity", "Result", "Notes"]]
    for c in checks:
        is_ignored = bool(c.get("ignored"))
        if is_ignored:
            result_text = "PASS*"
            desc = c.get("description", "")
            reason = c.get("override_reason", "Inspector discretionary clearance")
            notes = f"<b>Cleared by Inspector:</b> {reason} (<i>Original:</i> {desc})"
        elif c.get("passed"):
            result_text = "PASS"
            notes = c.get("description", "")
        else:
            result_text = "FAIL"
            notes = c.get("description", "")

        rule_cell = f"{c.get('rule_reference', '-')}<br/><font size=7 color='#7A8494'>{c.get('regulation', '')}</font>"
        table_data.append(
            [
                Paragraph(rule_cell, cell_style),
                Paragraph(c.get("label", c.get("field", "-")), cell_style),
                Paragraph(c.get("severity", "-").upper(), cell_style),
                Paragraph(result_text, cell_style),
                Paragraph(notes, cell_style),
            ]
        )

    checklist_table = Table(table_data, colWidths=[26 * mm, 34 * mm, 20 * mm, 16 * mm, 64 * mm], repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#14213D")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D8D3C7")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 5),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
    ]
    for i, c in enumerate(checks, start=1):
        if c.get("ignored"):
            color = colors.HexColor("#E8F5E9")  # light mint for overridden
        elif c.get("passed"):
            color = colors.HexColor("#E6F4EA")
        else:
            color = colors.HexColor("#FBE7E5")
        style_cmds.append(("BACKGROUND", (0, i), (-1, i), color))
    checklist_table.setStyle(TableStyle(style_cmds))
    story.append(checklist_table)

    story.append(Spacer(1, 10 * mm))
    story.append(
        Paragraph(
            f"This report was generated by {generated_for} and is timestamp-anchored. "
            "The SHA-256 checksum of this file is recorded in the system audit trail; any "
            "alteration to this document after issuance will not match that checksum.",
            label_style,
        )
    )

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    checksum = hashlib.sha256(pdf_bytes).hexdigest()
    return pdf_bytes, checksum
