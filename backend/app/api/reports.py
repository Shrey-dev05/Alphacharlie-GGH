from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.security import TokenData, get_current_user
from app.db.database import get_db
from app.models.models import Report, Scan, User
from app.services import pdf_service, storage_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/scans/{scan_id}/generate")
def generate_report(scan_id: str, current: TokenData = Depends(get_current_user), db: Session = Depends(get_db)):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(404, "Scan not found")

    inspector = db.query(User).filter(User.id == current.username).first()
    image_bytes = None
    key = scan.annotated_image_storage_key or scan.image_storage_key
    if key:
        try:
            image_bytes = storage_service.load_bytes(key)
        except FileNotFoundError:
            image_bytes = None

    checks = (scan.raw_analysis or {}).get("checks", [])
    brand_product_source = (scan.raw_analysis or {}).get("brand_product_source", "manual")
    pdf_bytes, checksum = pdf_service.generate_compliance_report(
        scan_id=scan.id,
        brand_name=scan.brand_name,
        product_name=scan.product_name,
        compliance_status=scan.compliance_status or "partial",
        compliance_score=scan.compliance_score or 0.0,
        checks=checks,
        image_bytes=image_bytes,
        inspector_name=inspector.full_name if inspector else "Unknown",
        barcode_value=scan.barcode_value,
        barcode_symbology=scan.barcode_symbology,
        brand_product_source=brand_product_source,
        inspector_override=bool(scan.inspector_override),
        override_notes=scan.inspector_override_notes,
    )
    pdf_key = storage_service.save_bytes(pdf_bytes, prefix="reports", extension="pdf")

    report = Report(
        scan_id=scan.id,
        generated_by=current.username,
        pdf_storage_key=pdf_key,
        checksum_sha256=checksum,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {"report_id": report.id, "checksum_sha256": checksum, "download_url": f"/api/v1/reports/{report.id}/download"}


@router.get("/{report_id}/download")
def download_report(report_id: str, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    pdf_bytes = storage_service.load_bytes(report.pdf_storage_key)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=compliance_report_{report.scan_id}.pdf"},
    )
