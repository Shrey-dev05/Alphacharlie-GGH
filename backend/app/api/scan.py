from __future__ import annotations

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.security import Role, TokenData, get_current_user, require_roles
from app.db.database import get_db
from app.models.models import Scan, User, Violation
from app.schemas.schemas import (
    ScanListItem,
    ScanOverrideAllRequest,
    ScanResult,
    ViolationOut,
    ViolationOverrideRequest,
)
from app.services import (
    ai_vision_service,
    barcode_service,
    cv_service,
    ocr_service,
    storage_service,
    validation_engine,
)

router = APIRouter(prefix="/scans", tags=["scans"])


def _decode_image(file_bytes: bytes) -> np.ndarray:
    try:
        import io
        from PIL import Image, ImageOps

        pil_img = Image.open(io.BytesIO(file_bytes))
        pil_img = ImageOps.exif_transpose(pil_img)
        if pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")
        image = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    except Exception:
        arr = np.frombuffer(file_bytes, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(400, "Could not decode image. Supported formats: JPEG, PNG.")

    # Guard against massive images (e.g. 48MP smartphone raw captures) causing proxy timeouts or CPU starvation
    h, w = image.shape[:2]
    max_side = max(h, w)
    if max_side > 2400:
        factor = 2400.0 / max_side
        image = cv2.resize(image, (int(w * factor), int(h * factor)), interpolation=cv2.INTER_AREA)

    return image


@router.post("", response_model=ScanResult)
async def create_scan(
    file: UploadFile = File(...),
    brand_name: str | None = Form(None),
    product_name: str | None = Form(None),
    state: str | None = Form(None),
    source: str = Form("upload"),
    real_width_mm: float | None = Form(None),
    real_height_mm: float | None = Form(None),
    is_food_product: bool = Form(False),
    is_plastic_packaging: bool = Form(False),
    current: TokenData = Depends(
        require_roles(Role.FIELD_INSPECTOR, Role.ECOMMERCE_AUDITOR, Role.MANUFACTURER)
    ),
    db: Session = Depends(get_db),
):
    """Runs the full pipeline synchronously: preprocess -> barcode detect
    (+ product lookup) -> OCR -> CV calibration -> rule validation ->
    annotate -> persist -> PDF-ready result. For high volume (bulk
    e-commerce audits), move this to a background task/queue (Celery/RQ)
    and poll `GET /scans/{id}` for status -- the response `status` field
    already models "processing".
    """
    raw_bytes = await file.read()
    image = _decode_image(raw_bytes)

    image_key = storage_service.save_bytes(raw_bytes, prefix="scans/original", extension="jpg")

    # --- Barcode detection + auto-fill -------------------------------
    # Runs first and cheaply: if a retail barcode (EAN/UPC)
    # is found and the operator didn't already type in brand/product name,
    # try to resolve it via product lookup so they don't have to.
    # Manually entered values always win -- we never overwrite what the
    # operator typed, only fill in what they left blank.
    try:
        barcodes = barcode_service.detect_barcodes(image)
    except Exception:
        barcodes = []
    primary_barcode = barcodes[0] if barcodes else None

    lookup_result = None
    brand_product_source = "manual" if (brand_name or product_name) else "not_provided"
    if primary_barcode and not (brand_name and product_name):
        lookup_result = barcode_service.lookup_product(primary_barcode.value, primary_barcode.symbology)
        if lookup_result and lookup_result.found:
            if not brand_name and lookup_result.brand_name:
                brand_name = lookup_result.brand_name
            if not product_name and lookup_result.product_name:
                product_name = lookup_result.product_name
            if not (brand_name and product_name) and brand_product_source == "not_provided":
                brand_product_source = "manual"  # partially filled by user, rest untouched
            elif brand_product_source == "not_provided":
                brand_product_source = "barcode_lookup"

    ocr_result = ocr_service.extract_text(image)

    # --- AI Multimodal Vision Analysis -------------------------------
    # Deeply inspects the packaging image directly with Gemini Vision:
    # extracts verbatim text, structured declarations, and product details.
    ai_analysis = ai_vision_service.analyze_packaging_label(image)
    ai_decls = ai_analysis.declarations if ai_analysis.success else {}

    # Auto-fill brand & product name from AI Vision if not already set by operator or barcode
    if ai_analysis.success:
        if not brand_name and ai_decls.get("brand_name"):
            brand_name = ai_decls["brand_name"]
            if brand_product_source == "not_provided":
                brand_product_source = "ai_vision"
        if not product_name and ai_decls.get("product_name"):
            product_name = ai_decls["product_name"]
            if brand_product_source == "not_provided":
                brand_product_source = "ai_vision"

    # High-accuracy text unification: merge AI Vision's pristine line transcription
    # with OCR output so regex, keyword, and ML checks have access to both streams
    if ai_analysis.success and ai_analysis.transcription:
        final_extracted_text = ai_analysis.transcription
        ai_lines = [line.strip() for line in ai_analysis.transcription.splitlines() if line.strip()]
        # Prepend clean AI lines so they are inspected first by line classifiers
        ocr_result.lines = ai_lines + [l for l in ocr_result.lines if l not in ai_lines]
        ocr_result.full_text = f"{ai_analysis.transcription}\n{ocr_result.full_text}"
    else:
        final_extracted_text = ocr_result.full_text

    calibration = None
    pdp_area_cm2 = None
    if real_width_mm and real_height_mm:
        pdp_box = cv_service.estimate_pdp_contour(image)
        calibration = cv_service.calibrate_known_dims(pdp_box, real_width_mm, real_height_mm)
        pdp_area_cm2 = calibration.pdp_area_cm2
    else:
        calibration = cv_service.calibrate_reference_card(image)  # may be None if no card found

    validation = validation_engine.run_full_validation(
        ocr_result,
        calibration,
        pdp_area_cm2,
        is_food_product=is_food_product,
        is_plastic_packaging=is_plastic_packaging,
        ai_declarations=ai_decls,
        brand_name=brand_name,
        product_name=product_name,
        detected_defects=ai_analysis.detected_defects if ai_analysis.success else None,
    )

    boxes = [
        (c["bounding_box"]["x"], c["bounding_box"]["y"], c["bounding_box"]["w"], c["bounding_box"]["h"], c["passed"])
        for c in validation["checks"]
        if c.get("bounding_box")
    ]
    # Draw the barcode's own bounding box too (neutral gray -- it's not a
    # pass/fail compliance signal, just evidence of what was detected).
    annotated = cv_service.draw_annotations(image, boxes)
    if primary_barcode:
        bb = primary_barcode.bounding_box
        cv2.rectangle(
            annotated,
            (bb["x"], bb["y"]),
            (bb["x"] + bb["w"], bb["y"] + bb["h"]),
            (150, 150, 150),
            2,
        )
    _, annotated_encoded = cv2.imencode(".jpg", annotated)
    annotated_key = storage_service.save_bytes(annotated_encoded.tobytes(), prefix="scans/annotated", extension="jpg")

    scan = Scan(
        created_by=current.username,
        source=source,
        brand_name=brand_name,
        product_name=product_name,
        image_storage_key=image_key,
        annotated_image_storage_key=annotated_key,
        status="completed",
        compliance_status=validation["compliance_status"],
        compliance_score=validation["compliance_score"],
        raw_analysis={
            "ocr_text": final_extracted_text,
            "checks": validation["checks"],
            "brand_product_source": brand_product_source,
            "extracted_declarations": ai_decls,
            "ai_observations": ai_analysis.observations if ai_analysis.success else [],
        },
        state=state,
        barcode_value=primary_barcode.value if primary_barcode else None,
        barcode_symbology=primary_barcode.symbology if primary_barcode else None,
        product_lookup_source=lookup_result.source if lookup_result else None,
        product_lookup_found=bool(lookup_result and lookup_result.found),
    )
    db.add(scan)
    db.flush()  # get scan.id before creating dependent rows

    for c in validation["checks"]:
        db.add(
            Violation(
                scan_id=scan.id,
                rule_id=c["rule_id"],
                rule_reference=c["rule_reference"],
                regulation=c["regulation"],
                field=c["field"],
                severity=c["severity"],
                description=c["description"],
                detection_method=c["detection_method"],
                bounding_box=c.get("bounding_box"),
                passed=c["passed"],
            )
        )
    db.commit()
    db.refresh(scan)

    return _to_scan_result(scan)


def _recalculate_scan_compliance(scan: Scan):
    """Recalculates compliance score and compliance status based on current violations state."""
    weights = {"critical": 4, "major": 2, "minor": 1}
    violations = scan.violations
    if not violations:
        scan.compliance_score = 100.0
        scan.compliance_status = "compliant"
        return

    # A violation is satisfied if passed==True or ignored==True
    total_weight = sum(weights.get(v.severity, 1) for v in violations) or 1
    earned = sum(weights.get(v.severity, 1) for v in violations if (v.passed or v.ignored))
    score = round((earned / total_weight) * 100, 1)

    # Any non-ignored critical failure?
    critical_failed = any(v.severity == "critical" and not v.passed and not v.ignored for v in violations)
    all_satisfied = all(v.passed or v.ignored for v in violations)

    if all_satisfied or score >= 90.0:
        status = "compliant"
    elif critical_failed:
        status = "non_compliant"
    elif score >= 50.0:
        status = "partial"
    else:
        status = "non_compliant"

    scan.compliance_score = score
    scan.compliance_status = status

    # Synchronize raw_analysis["checks"]
    if scan.raw_analysis and "checks" in scan.raw_analysis:
        checks = scan.raw_analysis["checks"]
        v_map = {v.rule_id: v for v in violations}
        for c in checks:
            v = v_map.get(c.get("rule_id"))
            if v:
                c["passed"] = bool(v.passed or v.ignored)
                c["ignored"] = bool(v.ignored)
                c["override_reason"] = v.override_reason
        scan.raw_analysis["checks"] = checks
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(scan, "raw_analysis")


def _to_scan_result(scan: Scan) -> ScanResult:
    raw = scan.raw_analysis or {}
    return ScanResult(
        id=scan.id,
        status=scan.status,
        compliance_status=scan.compliance_status,
        compliance_score=scan.compliance_score,
        inspector_override=bool(scan.inspector_override),
        inspector_override_notes=scan.inspector_override_notes,
        brand_name=scan.brand_name,
        product_name=scan.product_name,
        image_url=storage_service.get_url(scan.image_storage_key),
        annotated_image_url=storage_service.get_url(scan.annotated_image_storage_key) if scan.annotated_image_storage_key else None,
        violations=[ViolationOut.model_validate(v) for v in scan.violations],
        extracted_text=raw.get("ocr_text", ""),
        barcode_value=scan.barcode_value,
        barcode_symbology=scan.barcode_symbology,
        product_lookup_source=scan.product_lookup_source,
        product_lookup_found=scan.product_lookup_found,
        brand_product_source=raw.get("brand_product_source", "manual"),
        extracted_declarations=raw.get("extracted_declarations"),
        created_at=scan.created_at,
    )


@router.patch("/{scan_id}/violations/{violation_id}", response_model=ScanResult)
def override_violation(
    scan_id: str,
    violation_id: str,
    payload: ViolationOverrideRequest,
    current: TokenData = Depends(require_roles(Role.FIELD_INSPECTOR, Role.ECOMMERCE_AUDITOR, Role.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """Allows an inspector to ignore a detected defect or revert an override."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(404, "Scan not found")

    violation = db.query(Violation).filter(Violation.id == violation_id, Violation.scan_id == scan_id).first()
    if not violation:
        raise HTTPException(404, "Violation not found")

    from datetime import datetime
    violation.ignored = payload.ignored
    if payload.ignored:
        violation.passed = True
        violation.override_reason = payload.reason or "Overridden by Inspector"
        violation.overridden_by = current.username
        violation.overridden_at = datetime.utcnow()
        scan.inspector_override = True
        if payload.reason:
            scan.inspector_override_notes = payload.reason
    else:
        violation.passed = False
        violation.override_reason = None
        violation.overridden_by = None
        violation.overridden_at = None
        has_any_override = any(v.ignored for v in scan.violations if v.id != violation.id)
        scan.inspector_override = has_any_override

    _recalculate_scan_compliance(scan)
    db.commit()
    db.refresh(scan)
    return _to_scan_result(scan)


@router.post("/{scan_id}/override-all", response_model=ScanResult)
def override_all_violations(
    scan_id: str,
    payload: ScanOverrideAllRequest,
    current: TokenData = Depends(require_roles(Role.FIELD_INSPECTOR, Role.ECOMMERCE_AUDITOR, Role.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """Allows an inspector to ignore all defects and approve the product as compliant."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(404, "Scan not found")

    from datetime import datetime
    reason = payload.reason or "Approved and marked compliant via Inspector discretion"
    for v in scan.violations:
        if not v.passed or not v.ignored:
            v.ignored = True
            v.passed = True
            v.override_reason = reason
            v.overridden_by = current.username
            v.overridden_at = datetime.utcnow()

    scan.inspector_override = True
    scan.inspector_override_notes = reason
    _recalculate_scan_compliance(scan)
    db.commit()
    db.refresh(scan)
    return _to_scan_result(scan)


def _reconcile_scan_declarations(scan: Scan, db: Session | None = None) -> bool:
    """Auto-reconciles any un-ignored failed violations where extracted_declarations
    actually has a verified declaration (e.g. expiry_date / best_before).
    Also ensures manufacturer_details description contains the exact extracted address in single quotes.
    Updates violation passed status, description, and recalculates compliance score.
    """
    raw = scan.raw_analysis or {}
    ai_decls = raw.get("extracted_declarations")
    if not isinstance(ai_decls, dict):
        ai_decls = {}
    ocr_text = raw.get("ocr_text", "")
    if not scan.violations:
        return False

    from app.services.validation_engine import (
        _check_ai_declaration,
        extract_manufacturer_address_text,
        is_valid_declaration_value,
        MRP_NUMERIC_PRICE_PATTERN,
    )
    changed = False

    # 0. Enforce Rule 6(1)(e) on MRP: If marked passed, but lacks an actual numeric price or is a placeholder, flag as defect
    for v in scan.violations:
        if v.field == "mrp" and not v.ignored:
            mrp_decl = ai_decls.get("mrp")
            ocr_has_numeric_price = bool(MRP_NUMERIC_PRICE_PATTERN.search(ocr_text)) if ocr_text else False
            ai_has_valid_price = is_valid_declaration_value(mrp_decl, "mrp") if mrp_decl else False

            if not ai_has_valid_price and not ocr_has_numeric_price:
                if v.passed:
                    v.passed = False
                    v.detection_method = "none"
                    if mrp_decl:
                        v.description = f"Retail Sale Price / MRP declaration lacks a numeric price (detected placeholder/template: '{mrp_decl}'). Required under Rule 6(1)(e)."
                    else:
                        v.description = "Retail Sale Price / MRP was NOT detected with a valid numeric price. Required under Rule 6(1)(e)."
                    changed = True

    # 1. Ensure manufacturer_details has the address in single quotes
    for v in scan.violations:
        if v.field in ("manufacturer_details", "manufacturer"):
            has_quote = "'" in (v.description or "")
            if not has_quote:
                ai_found, ai_val = _check_ai_declaration(v.field, ai_decls)
                if not (ai_found and ai_val) and ocr_text:
                    ai_val = extract_manufacturer_address_text(ocr_text)
                    if ai_val:
                        ai_found = True
                        ai_decls["manufacturer_address"] = ai_val
                        raw["extracted_declarations"] = ai_decls
                        from sqlalchemy.orm.attributes import flag_modified
                        flag_modified(scan, "raw_analysis")
                if ai_found and ai_val:
                    v.passed = True
                    v.description = f"Name & Address of Manufacturer/Packer/Importer detected: '{ai_val}'."
                    changed = True

    # 2. Check any other unpassed violations against ai_decls
    for v in scan.violations:
        if not v.passed and not v.ignored:
            ai_found, ai_val = _check_ai_declaration(v.field, ai_decls)
            if ai_found and ai_val:
                v.passed = True
                v.detection_method = "ai_vision"
                v.description = f"{v.field.replace('_', ' ').title()} detected: '{ai_val}'."
                changed = True

    if changed:
        _recalculate_scan_compliance(scan)
        if db:
            db.commit()
            db.refresh(scan)
    return changed


@router.get("/{scan_id}", response_model=ScanResult)
def get_scan(scan_id: str, current: TokenData = Depends(get_current_user), db: Session = Depends(get_db)):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(404, "Scan not found")
    _reconcile_scan_declarations(scan, db)
    return _to_scan_result(scan)


@router.get("", response_model=list[ScanListItem])
def list_scans(
    brand_name: str | None = Query(None),
    state: str | None = Query(None),
    compliance_status: str | None = Query(None),
    barcode_value: str | None = Query(None),
    limit: int = Query(50, le=200),
    current: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Historical Repository search: filter by brand, state, status, or
    barcode. Field inspectors/manufacturers see only their own scans;
    super_admin sees everything (matches the RBAC spec)."""
    q = db.query(Scan)
    if current.role != Role.SUPER_ADMIN.value:
        q = q.filter(Scan.created_by == current.username)
    if brand_name:
        q = q.filter(Scan.brand_name.ilike(f"%{brand_name}%"))
    if state:
        q = q.filter(Scan.state == state)
    if compliance_status:
        q = q.filter(Scan.compliance_status == compliance_status)
    if barcode_value:
        q = q.filter(Scan.barcode_value == barcode_value)

    scans = q.order_by(Scan.created_at.desc()).limit(limit).all()

    results = []
    for s in scans:
        inspector = db.query(User).filter(User.id == s.created_by).first()
        results.append(
            ScanListItem(
                id=s.id,
                brand_name=s.brand_name,
                product_name=s.product_name,
                compliance_status=s.compliance_status,
                compliance_score=s.compliance_score,
                state=s.state,
                barcode_value=s.barcode_value,
                created_at=s.created_at,
                inspector_name=inspector.full_name if inspector else None,
            )
        )
    return results


@router.delete("/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scan(
    scan_id: str,
    current: TokenData = Depends(require_roles(Role.FIELD_INSPECTOR, Role.ECOMMERCE_AUDITOR, Role.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """Deletes an individual scan inspection record and associated stored images and reports."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(404, "Scan not found")

    if current.role != Role.SUPER_ADMIN.value and scan.created_by != current.username:
        raise HTTPException(403, "You do not have permission to delete this inspection record.")

    storage_service.delete_file(scan.image_storage_key)
    storage_service.delete_file(scan.annotated_image_storage_key)
    for report in scan.reports:
        storage_service.delete_file(report.pdf_storage_key)

    db.delete(scan)
    db.commit()
    return None


@router.delete("", status_code=status.HTTP_200_OK)
def clear_all_scans(
    current: TokenData = Depends(require_roles(Role.SUPER_ADMIN, Role.FIELD_INSPECTOR)),
    db: Session = Depends(get_db),
):
    """Purges all scan inspection records and associated files across the portal."""
    scans = db.query(Scan).all()
    count = len(scans)

    for s in scans:
        storage_service.delete_file(s.image_storage_key)
        storage_service.delete_file(s.annotated_image_storage_key)
        for r in s.reports:
            storage_service.delete_file(r.pdf_storage_key)
        db.delete(s)

    db.commit()
    storage_service.purge_storage()
    return {"message": f"Successfully deleted {count} scan record(s) from the portal.", "deleted_count": count}

