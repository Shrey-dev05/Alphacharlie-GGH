"""
AI Multimodal Vision Service
============================
Inspects packaging images directly using Paramarsh Vision models.
Extracts verbatim text, structured legal metrology & FSSAI declarations,
and identifies product attributes with high precision.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field

import cv2
import numpy as np

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

VISION_SYSTEM_PROMPT = """You are an expert Legal Metrology & Food Safety compliance inspection AI.
Your job is to examine images of Indian packaged commodities and perform an exhaustive, \
high-accuracy extraction of all printed label declarations according to the \
Legal Metrology (Packaged Commodities) Rules, 2011 and FSSAI Packaging & Labelling regulations.

Inspect every part of the packaging label carefully, including small print, borders, \
side panels, declaration boxes, and regulatory notices.

Return your analysis in valid JSON format with the following exact keys:
{
  "transcription": "Complete, accurate line-by-line transcription of all visible printed text on the packaging",
  "declarations": {
    "brand_name": "Brand or registered trademark (or null if absent)",
    "product_name": "Generic commodity or commercial product name (e.g. 'Wheat Flour', 'Atta', 'Biscuits') (or null if absent)",
    "mrp": "Exact Maximum Retail Price string including numeric amount and tax statement, e.g. 'MRP Rs. 150.00 (inclusive of all taxes)'. If the package only has a template like 'MRP ₹ (INCL. OF ALL TAXES)' without an actual numeric price, or if the price is blank/missing/unprinted, return 'Value missing/not declared'",
    "net_quantity": "Net weight, measure, or count with units, e.g. '500 g', '1 L', '10 N', '5 Units', '1 Pair' (or null if absent)",
    "unit_sale_price": "Unit sale price, e.g. 'Rs. 0.30 / g' or 'Rs. 55.00 / kg' (or null if absent)",
    "mfg_date": "Date/month and year of manufacture or packing, e.g. '15/01/2025' or '08/2026' or 'Pkd 08/26' (or null if absent)",
    "expiry_date": "Expiry date or use-by date if explicitly printed, e.g. 'EXP: 02/2027' (or null if absent)",
    "best_before": "Best before statement or duration, e.g. 'Best before 9 months from manufacture' or 'Best before 6 months from packaging' (or null if absent)",
    "manufacturer_address": "Complete name and physical address of the manufacturer or manufacturing facility, e.g. 'Manufactured By: ...' (or null if absent)",
    "packer_address": "Name and address of packer or marketer if distinct from manufacturer, e.g. 'Packed By: ...' or 'Marketed By: ...' (or null if absent)",
    "importer_address": "Name and complete address of Indian importer if product is imported (or null if absent)",
    "consumer_care": "Customer care details: phone/toll-free number, email address, postal address, or consumer cell designation (or null if absent)",
    "country_of_origin": "Country of origin / manufacture, e.g. 'India', 'Made in India', 'Product of India' (or null if absent)",
    "fssai_license": "FSSAI logo and 14-digit license number if present, e.g. '10019011000543' (or null if absent)",
    "fssai_nutrition": "Nutritional information declaration, e.g. energy, protein, carbohydrate, sugar, fat, sodium per 100g/serving (or null if absent)",
    "fssai_allergen": "Allergen warning or ingredient declaration, e.g. 'Contains wheat, gluten', 'May contain traces of nuts' (or null if absent)",
    "veg_non_veg": "Declared indicator: 'veg' if green dot inside green square symbol or 'Vegetarian' is visible, 'non_veg' if brown triangle inside square or 'Non-Vegetarian' is visible, or null if absent",
    "plastic_packaging_info": "Plastic polymer symbol/code (e.g. 'PET 01', 'PP 05'), EPR registration certificate number, or film thickness in microns (or null if absent)",
    "ingredients": "Complete verbatim list of ingredients declared on the package, e.g. 'Sugar, Refined Palm Oil, Cocoa Solids, Emulsifier (INS 322), Preservative (INS 211)...' (or null if absent)"
  },
  "detected_defects": [
    {
      "field": "Field name with non-compliance",
      "issue": "Specific statutory defect, e.g. 'MRP lacks numeric price' or 'Manufacturer address lacks PIN code/state'",
      "severity": "critical | major | minor"
    }
  ],
  "observations": [
    "List of notable compliance observations, discrepancies, or missing mandatory fields"
  ]
}

Ensure the response is strictly valid JSON without any wrapping other than standard JSON text or a ```json codeblock.
"""


@dataclass
class AiPackagingAnalysis:
    transcription: str = ""
    declarations: dict[str, str | None] = field(default_factory=dict)
    detected_defects: list[dict] = field(default_factory=list)
    observations: list[str] = field(default_factory=list)
    success: bool = False


def analyze_packaging_label(image_bgr: np.ndarray) -> AiPackagingAnalysis:
    """Runs multimodal vision inspection on the packaging image.
    Returns structured declarations and verbatim transcription.
    Never raises an exception -- gracefully falls back to empty result if offline.
    """
    if not settings.GEMINI_API_KEY:
        logger.info("GEMINI_API_KEY not configured; skipping AI vision inspection.")
        return AiPackagingAnalysis(success=False)

    try:
        from google import genai
        from google.genai import types

        # Encode image to JPEG
        success, encoded = cv2.imencode(".jpg", image_bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if not success:
            return AiPackagingAnalysis(success=False)

        jpeg_bytes = encoded.tobytes()

        # Candidate models in priority order
        candidates = []
        for m in [
            settings.GEMINI_MODEL,
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-3.1-flash-lite",
            "gemini-flash-latest",
        ]:
            if m and m not in candidates:
                candidates.append(m)

        raw_response_text = ""
        for model_name in candidates:
            try:
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
                resp = client.models.generate_content(
                    model=model_name,
                    contents=[
                        types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg"),
                        "Analyze this packaging image thoroughly for Legal Metrology and FSSAI compliance declarations as specified in the system instructions.",
                    ],
                    config=types.GenerateContentConfig(
                        system_instruction=VISION_SYSTEM_PROMPT,
                        max_output_tokens=2048,
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                    ),
                )
                if resp.text and resp.text.strip():
                    raw_response_text = resp.text.strip()
                    break
            except Exception as exc:
                logger.warning("Paramarsh Vision model %s failed (%s); trying fallback.", model_name, exc)
                continue

        if not raw_response_text:
            return AiPackagingAnalysis(success=False)

        # Clean markdown code block if present
        json_text = raw_response_text
        if "```" in json_text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", json_text)
            if match:
                json_text = match.group(1)

        data = json.loads(json_text)
        transcription = data.get("transcription", "")
        declarations = data.get("declarations", {})
        detected_defects = data.get("detected_defects", [])
        observations = data.get("observations", [])

        # Clean null strings or whitespace
        cleaned_decls = {}
        for k, v in declarations.items():
            if v and str(v).lower() not in ("null", "none", "not mentioned", "n/a"):
                cleaned_decls[k] = str(v).strip()
            else:
                cleaned_decls[k] = None

        return AiPackagingAnalysis(
            transcription=transcription,
            declarations=cleaned_decls,
            detected_defects=detected_defects,
            observations=observations,
            success=True,
        )

    except Exception as exc:
        logger.warning("AI vision label analysis encountered error: %s", exc)
        return AiPackagingAnalysis(success=False)
