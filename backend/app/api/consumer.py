"""
Consumer Health & Ingredient Intelligence API Endpoints
=========================================================
Provides:
  - Deep ingredient inspection, additive detection & quality rating.
  - Scan-based ingredient extraction.
  - Multi-product comparison ("Which is Better to Consume").
"""
from __future__ import annotations

from typing import Any
import io
import re
import cv2
import numpy as np
from PIL import Image, ImageOps
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Scan
from app.schemas.schemas import (
    ConsumerLabelScanResponse,
    IngredientAnalysisRequest,
    IngredientQualityReportOut,
    MultiProductComparisonRequest,
    MultiProductComparisonResponse,
)
from app.services import ai_vision_service, ingredient_intelligence_service, ocr_service

router = APIRouter(prefix="/consumer", tags=["consumer"])


def _decode_consumer_image(file_bytes: bytes) -> np.ndarray:
    try:
        pil_img = Image.open(io.BytesIO(file_bytes))
        pil_img = ImageOps.exif_transpose(pil_img)
        if pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")
        image = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    except Exception:
        arr = np.frombuffer(file_bytes, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(400, "Could not decode image. Supported formats: JPEG, PNG, WEBP.")

    h, w = image.shape[:2]
    max_side = max(h, w)
    if max_side > 2200:
        factor = 2200.0 / max_side
        image = cv2.resize(image, (int(w * factor), int(h * factor)), interpolation=cv2.INTER_AREA)

    return image


@router.post("/scan-image", response_model=ConsumerLabelScanResponse)
async def scan_label_image(
    file: UploadFile = File(...),
    product_name: str | None = Form(None),
) -> Any:
    """Extracts ingredients from an uploaded packaging label image or camera photo
    using the Paramarsh Multimodal Vision ensemble and High-Recall OCR, then runs
    deep ingredient intelligence and health condition assessment."""
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(400, "Empty image file received.")

    image = _decode_consumer_image(raw_bytes)

    extracted_ingredients = ""
    extracted_product = product_name
    extracted_brand = None
    method = "Paramarsh Multimodal Vision"

    # Step 1: Multimodal Vision Inspection
    ai_analysis = ai_vision_service.analyze_packaging_label(image)
    if ai_analysis.success and ai_analysis.declarations:
        decls = ai_analysis.declarations
        if decls.get("ingredients"):
            extracted_ingredients = decls["ingredients"]
        if not extracted_product and decls.get("product_name"):
            extracted_product = decls["product_name"]
        if decls.get("brand_name"):
            extracted_brand = decls["brand_name"]

    # Step 2: Fallback / Augment with OCR if ingredients not yet extracted
    if not extracted_ingredients or len(extracted_ingredients.strip()) < 10:
        ocr_res = ocr_service.extract_text(image)
        full_text = f"{ai_analysis.transcription or ''}\n{ocr_res.full_text or ''}".strip()

        # Regex search for Ingredients panel
        match = re.search(
            r"(?:ingredients?|ingrediente?s?|ingred)\s*[:\-]\s*(.*?)(?:\n\n|\n[A-Z\s]{4,}:|\.\s*\n|[A-Z\s]{4,}\s*:|$)",
            full_text,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if match:
            cand = match.group(1).strip()
            clean_cand = re.sub(r"\s+", " ", cand).strip()
            if len(clean_cand) > 10:
                extracted_ingredients = clean_cand
                method = "Paramarsh Multimodal Vision + Multi-Pass OCR"

        if not extracted_ingredients and full_text:
            lines = [l.strip() for l in full_text.splitlines() if len(l.strip()) > 15]
            for l in lines:
                if "," in l and any(k in l.lower() for k in ["water", "sugar", "salt", "oil", "flour", "extract", "acid", "preservative", "ins", "flavor", "colour"]):
                    extracted_ingredients = l
                    method = "Multi-Pass OCR Ensemble"
                    break

        if not extracted_ingredients and full_text:
            extracted_ingredients = full_text[:400].strip()
            method = "Packaging Text Stream Extraction"

    if not extracted_ingredients or len(extracted_ingredients.strip()) < 3:
        raise HTTPException(
            status_code=400,
            detail="Could not detect readable ingredient text on this packaging label image. Please make sure the ingredient list is in focus, well-lit, and try again.",
        )

    # Step 3: Run comprehensive ingredient & health analysis
    report = ingredient_intelligence_service.analyze_ingredients(
        text=extracted_ingredients,
        product_name=extracted_product or "Scanned Product",
    )

    import dataclasses
    report_dict = dataclasses.asdict(report) if dataclasses.is_dataclass(report) else report

    return ConsumerLabelScanResponse(
        success=True,
        extracted_ingredients=extracted_ingredients,
        product_name=extracted_product,
        brand_name=extracted_brand,
        method=method,
        report=report_dict,
    )


@router.post("/analyze-ingredients", response_model=IngredientQualityReportOut)
def analyze_ingredients_text(payload: IngredientAnalysisRequest) -> Any:
    """Performs deep regulatory and biochemical safety analysis on given ingredients."""
    report = ingredient_intelligence_service.analyze_ingredients(
        text=payload.ingredients_text,
        product_name=payload.product_name,
    )
    return report


@router.get("/scan/{scan_id}/ingredients", response_model=IngredientQualityReportOut)
def analyze_scan_ingredients(scan_id: str, db: Session = Depends(get_db)) -> Any:
    """Pulls extracted text / declarations from an existing scan and analyzes the ingredients."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Packaging scan not found.")

    raw = scan.raw_analysis or {}
    decls = raw.get("extracted_declarations") or {}

    # Try explicit ingredients declaration first, then fallback to OCR text
    ingredients_text = decls.get("ingredients") or decls.get("fssai_allergen") or ""

    if not ingredients_text:
        # Fallback to search inside extracted_text
        extracted = raw.get("extracted_text") or scan.image_storage_key or ""
        # Search for "Ingredients:" block
        import re
        match = re.search(r"ingredients?\s*[:\-](.*?)(?:\n\n|\n[A-Z\s]{4,}:|$)", extracted, flags=re.IGNORECASE | re.DOTALL)
        if match:
            ingredients_text = match.group(1).strip()
        else:
            ingredients_text = extracted[:500]

    if not ingredients_text:
        raise HTTPException(
            status_code=400,
            detail="No declared ingredients could be identified on this packaging scan. Please provide ingredient text manually.",
        )

    product_name = scan.product_name or "Scanned Product"
    return ingredient_intelligence_service.analyze_ingredients(ingredients_text, product_name=product_name)


@router.post("/compare-products", response_model=MultiProductComparisonResponse)
def compare_products(payload: MultiProductComparisonRequest) -> Any:
    """Compares 2 or more products, ranking them by quality and recommending which is better to consume."""
    items_data = [item.dict() for item in payload.products]
    try:
        result = ingredient_intelligence_service.compare_multiple_products(items_data)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
