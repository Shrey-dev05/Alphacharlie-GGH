"""
Validation Engine
==================
Pure business logic: takes OCR output (+ optional font-size measurements)
and the rules dataset, and produces a list of pass/fail checks. Kept
free of DB/HTTP concerns so it's easy to unit test in isolation.

Detection is an ENSEMBLE of two independent signals, combined with OR logic
(a declaration counts as present if either one finds it):
  1. Regex/keyword matching against the full OCR text -- exact, fast, but
     brittle to phrasing variation and OCR noise.
  2. A trained ML text classifier (see app/ml/) scored per OCR line -- robust
     to phrasing variation and OCR noise, but only trusted above a confidence
     threshold (see field_classifier_service.DEFAULT_CONFIDENCE_THRESHOLD).
The `detection_method` field on each CheckResult records which signal (or
both) found the declaration, so a human reviewer can audit exactly why a
check passed -- important for a tool whose output may end up in a legal
notice.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, asdict
from pathlib import Path

from app.services.cv_service import Calibration, px_height_to_mm
from app.services.ocr_service import OcrResult
from app.ml import field_classifier_service

RULES_PATH = Path(__file__).resolve().parent.parent / "data" / "legal_metrology_rules.json"


@dataclass
class CheckResult:
    rule_id: str
    rule_reference: str
    regulation: str
    field: str
    label: str
    severity: str
    passed: bool
    description: str
    detection_method: str = "none"  # "regex" | "keyword" | "ml_classifier" | "both" | "none"
    bounding_box: dict | None = None


def _load_rules() -> dict:
    with open(RULES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _find_keyword_box(ocr: OcrResult, keywords: list[str]) -> tuple[bool, dict | None]:
    text_lower = ocr.full_text.lower()
    for kw in keywords:
        if kw in text_lower:
            first_token = kw.split()[0]
            for w in ocr.words:
                if first_token in w.text.lower():
                    return True, {"x": w.left, "y": w.top, "w": w.width, "h": w.height}
            return True, None
    return False, None


def _find_regex_box(ocr: OcrResult, pattern: str) -> tuple[bool, dict | None]:
    match = re.search(pattern, ocr.full_text, flags=re.IGNORECASE)
    if not match:
        return False, None
    matched_token = match.group(0).split()[0] if match.group(0).split() else None
    if matched_token:
        for w in ocr.words:
            if matched_token.lower() in w.text.lower():
                return True, {"x": w.left, "y": w.top, "w": w.width, "h": w.height}
    return True, None


def extract_manufacturer_address_text(text: str) -> str | None:
    """Extracts manufacturer, packer, or marketer name and address from OCR transcription stream."""
    if not text:
        return None
    pattern = (
        r"(?:(?:manufactured|mfg\.?|mfd\.?|marketed|packed|pkd\.?|imported)\s*(?:and\s*packed\s*)?by\s*[:\-]?\s*)"
        r"([^\n]+(?:\n(?!\s*(?:customer\s*care|consumer\s*care|care@|toll[- ]?free|helpline|phone|email|website|www\.|mrp|net\s*wt|net\s*quantity|batch|exp|best\s*before|mfg\b|\(barcode))[^\n]+){0,5})"
    )
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        cleaned = m.group(0).strip()
        lines = [line.strip().rstrip(",").strip() for line in cleaned.splitlines() if line.strip()]
        res = ", ".join(lines)
        return re.sub(r",\s*,+", ", ", res)
    return None


def _applies(regulation_key: str, regulations: dict, is_food_product: bool, is_plastic_packaging: bool) -> bool:
    applicability = regulations.get(regulation_key, {}).get("applicability", "always")
    if applicability == "always":
        return True
    if applicability == "food":
        return is_food_product
    if applicability == "plastic_packaging":
        return is_plastic_packaging
    return True


NEGATIVE_DECLARATION_PATTERNS = [
    r"^null$",
    r"^none\b",
    r"^not\s+(mentioned|stated|explicitly|found|visible|present|available|provided|printed|declared|specified)",
    r"^n/?a$",
    r"^absent$",
    r"^unknown$",
    r"^unspecified$",
    r"^cannot\s+be\s+determined",
    r"^not\s+applicable",
]

PLACEHOLDER_OR_DEFECT_PATTERNS = [
    r"\b(?:value\s+is\s+|numeric\s+value\s+is\s+|price\s+is\s+|actual\s+value\s+is\s+)?missing\b",
    r"\bplaceholder\b",
    r"\bobliterated\b",
    r"\billegible\b",
    r"\bunreadable\b",
    r"\bnot\s+(?:printed|stamped|embossed|visible|present|available|provided|found|declared|specified|stated|readable)\b",
    r"\bno\s+(?:numeric\s+)?(?:value|price)\b",
    r"\blacks?\s+(?:a\s+)?numeric\s+(?:value|price)\b",
    r"\bto\s+be\s+printed\b",
    r"\bblank\b",
]

MRP_NUMERIC_PRICE_PATTERN = re.compile(
    r"(?:(?:₹|rs\.?|inr)\s*:?\s*\d+(?:[.,]\d{1,2})?(?:\s*\/-)?|\b\d+(?:[.,]\d{1,2})?\s*(?:\/-\s*)?(?:₹|rs\.?|inr)\b|(?:mrp|m\.r\.p|retail price|max\.?\s*retail price)[^\d\n]{0,25}\b\d+(?:[.,]\d{1,2})?(?:\s*\/-)?)",
    re.IGNORECASE,
)


def is_valid_declaration_value(val: str | None, field_name: str | None = None) -> bool:
    """Validates that an extracted declaration is meaningful and not a negative/placeholder note."""
    if not val:
        return False
    s = str(val).strip()
    if not s:
        return False
    s_lower = s.lower()
    for pat in NEGATIVE_DECLARATION_PATTERNS:
        if re.search(pat, s_lower):
            return False
    for pat in PLACEHOLDER_OR_DEFECT_PATTERNS:
        if re.search(pat, s_lower):
            return False

    if field_name == "mrp":
        # Rule 6(1)(e): MRP MUST contain an actual numeric price amount (e.g. ₹20.00, Rs. 150)
        if not MRP_NUMERIC_PRICE_PATTERN.search(s):
            return False

    if field_name == "net_quantity":
        # Rule 6(1)(c): Net quantity must contain digits
        if not re.search(r"\d", s):
            return False

    if field_name in ("fssai_veg_nonveg", "veg_non_veg"):
        # Indicator must explicitly specify veg, vegetarian, non_veg, non-vegetarian
        return s_lower in ("veg", "vegetarian", "pure veg", "non_veg", "non-veg", "non_vegetarian", "non-vegetarian", "contains egg")

    return True


FIELD_TO_AI_KEY = {
    "manufacturer_details": ["manufacturer_address", "packer_address", "importer_address"],
    "common_name": ["product_name", "brand_name"],
    "net_quantity": ["net_quantity"],
    "mfg_date": ["mfg_date", "expiry_date"],
    "best_before": ["best_before", "expiry_date"],
    "expiry_date": ["expiry_date", "best_before"],
    "mrp": ["mrp"],
    "consumer_care": ["consumer_care"],
    "country_of_origin": ["country_of_origin"],
    "unit_sale_price": ["unit_sale_price"],
    "fssai_license": ["fssai_license"],
    "fssai_nutrition": ["fssai_nutrition", "nutrition_info"],
    "nutrition_info": ["nutrition_info", "fssai_nutrition"],
    "fssai_veg_nonveg": ["veg_non_veg", "veg_non_veg_logo", "fssai_veg_nonveg"],
    "veg_non_veg": ["veg_non_veg", "veg_non_veg_logo"],
    "veg_non_veg_logo": ["veg_non_veg"],
    "fssai_allergen": ["fssai_allergen", "allergen_info"],
    "allergen_info": ["allergen_info", "fssai_allergen"],
    "plastic_material_code": ["plastic_packaging_info", "plastic_material_code"],
    "plastic_epr_number": ["plastic_packaging_info", "plastic_epr_number"],
    "plastic_recycled_content": ["plastic_packaging_info", "plastic_recycled_content"],
    "plastic_packaging": ["plastic_packaging_info"],
    "epr_registration": ["plastic_packaging_info"],
}


def _check_ai_declaration(field_name: str, ai_decls: dict | None) -> tuple[bool, str | None]:
    if not ai_decls:
        return False, None
    keys = FIELD_TO_AI_KEY.get(field_name, [field_name])
    for k in keys:
        val = ai_decls.get(k)
        if is_valid_declaration_value(val, field_name):
            return True, str(val).strip()
    return False, None


def check_mandatory_declarations(
    ocr: OcrResult,
    is_food_product: bool = False,
    is_plastic_packaging: bool = False,
    use_ml_classifier: bool = True,
    ai_declarations: dict | None = None,
    brand_name: str | None = None,
    product_name: str | None = None,
    detected_defects: list[dict] | None = None,
) -> list[CheckResult]:
    data = _load_rules()
    rules = data["mandatory_declarations"]
    regulations = data.get("regulations", {})
    results: list[CheckResult] = []

    for rule in rules:
        regulation_key = rule.get("regulation", "legal_metrology")
        if not _applies(regulation_key, regulations, is_food_product, is_plastic_packaging):
            continue  # rule doesn't apply to this product category -- skip, don't fail it

        field_name = rule["field"]
        ai_found, ai_val = _check_ai_declaration(field_name, ai_declarations)

        # Fallback for common_name from user-entered or barcode-resolved product/brand name
        if field_name == "common_name" and not (ai_found and ai_val):
            declared_name = product_name or brand_name
            if declared_name and is_valid_declaration_value(declared_name, "common_name"):
                ai_found = True
                ai_val = declared_name

        # Fallback address extraction for manufacturer_details from OCR transcription stream
        if field_name == "manufacturer_details" and not (ai_found and ai_val):
            extracted_addr = extract_manufacturer_address_text(ocr.full_text)
            if extracted_addr:
                ai_found = True
                ai_val = extracted_addr

        regex_match_val = None
        if rule["match_type"] == "presence":
            regex_passed, box = _find_keyword_box(ocr, rule.get("keywords", []))
            method = "keyword" if regex_passed else "none"
        elif rule["match_type"] == "regex":
            regex_passed, box = _find_regex_box(ocr, rule["pattern"])
            method = "regex" if regex_passed else "none"
            if regex_passed:
                m_match = re.search(rule["pattern"], ocr.full_text, flags=re.IGNORECASE)
                if m_match:
                    regex_match_val = m_match.group(0).strip()
        else:
            regex_passed, box, method = False, None, "none"

        passed = regex_passed
        ml_note = ""

        # Ensemble Signal 2: Trained ML classifier
        if not passed and use_ml_classifier and field_classifier_service.is_available():
            match = field_classifier_service.find_best_match(ocr.lines, field_name)
            if match:
                line_text, confidence = match
                passed = True
                method = "ml_classifier"
                ml_note = f" (ML matched \"{line_text}\" with {confidence:.0%} confidence)"
        elif passed and use_ml_classifier and field_classifier_service.is_available():
            match = field_classifier_service.find_best_match(ocr.lines, field_name)
            if match:
                method = "both"

        # Ensemble Signal 3: Multimodal AI Vision
        if ai_found:
            if passed:
                method = "ensemble"
            else:
                passed = True
                method = "ai_vision"

            # If box wasn't located by regex, try finding the detected token in OCR words
            if box is None and ai_val:
                tokens = re.findall(r"\b\w{3,}\b", ai_val)
                for t in tokens[:4]:
                    for w in ocr.words:
                        if t.lower() in w.text.lower():
                            box = {"x": w.left, "y": w.top, "w": w.width, "h": w.height}
                            break
                    if box:
                        break

        # Statutory gate for MRP (Rule 6(1)(e)):
        # MRP must contain a numeric price amount. A template without digits is not compliant.
        if field_name == "mrp":
            ocr_has_numeric_price = bool(MRP_NUMERIC_PRICE_PATTERN.search(ocr.full_text))
            ai_has_valid_price = ai_found and ai_val and is_valid_declaration_value(ai_val, "mrp")

            if not ai_has_valid_price and not ocr_has_numeric_price:
                # Packaging bears only template/placeholder text without an actual price.
                # Under Rule 6(1)(e), this is a critical statutory non-compliance.
                passed = False
                method = "none"

        # Statutory gate for Net Quantity (Rule 6(1)(c)):
        # Net Quantity must declare a numeric magnitude (weight, measure, or count).
        if field_name == "net_quantity":
            ai_has_valid_qty = ai_found and ai_val and is_valid_declaration_value(ai_val, "net_quantity")
            ocr_has_qty = regex_passed and bool(re.search(r"\d", ocr.full_text))
            if not ai_has_valid_qty and not ocr_has_qty:
                passed = False
                method = "none"

        # Check if AI Vision explicitly flagged a defect for this field
        field_defect = None
        if detected_defects:
            for d in detected_defects:
                if d.get("field") == field_name:
                    field_defect = d
                    break

        # Description construction
        if passed:
            val_to_show = ai_val or regex_match_val
            if val_to_show:
                desc = f"{rule['label']} detected: '{val_to_show}'."
            elif ml_note:
                desc = f"{rule['label']} detected on the package.{ml_note}"
            else:
                desc = f"{rule['label']} detected on the package."
        else:
            if field_defect and field_defect.get("issue"):
                desc = f"{rule['label']} non-compliance: {field_defect['issue']}. Required under {rule['rule_reference']}."
            elif field_name == "mrp":
                raw_mrp = (ai_declarations or {}).get("mrp")
                if raw_mrp and not is_valid_declaration_value(raw_mrp, "mrp"):
                    desc = f"Retail Sale Price / MRP declaration lacks a numeric price (detected placeholder/template: '{raw_mrp}'). Required under Rule 6(1)(e)."
                elif regex_match_val:
                    desc = f"Retail Sale Price / MRP declaration lacks a numeric price (packaging bears template without price: '{regex_match_val}'). Required under Rule 6(1)(e)."
                else:
                    desc = f"{rule['label']} was NOT detected with a valid numeric price. Required under {rule['rule_reference']}."
            elif field_name == "net_quantity":
                desc = f"{rule['label']} was NOT detected with a valid numeric weight, volume, or count. Required under {rule['rule_reference']}."
            else:
                desc = f"{rule['label']} was NOT detected. Required under {rule['rule_reference']}."

        results.append(
            CheckResult(
                rule_id=rule["rule_id"],
                rule_reference=rule["rule_reference"],
                regulation=regulations.get(regulation_key, {}).get("name", regulation_key),
                field=field_name,
                label=rule["label"],
                severity=rule["severity"],
                passed=passed,
                detection_method=method,
                description=desc,
                bounding_box=box,
            )
        )
    return results


def check_font_size_compliance(
    ocr: OcrResult, calibration: Calibration | None, pdp_area_cm2: float | None
) -> list[CheckResult]:
    """Checks numeral/letter heights against Rule 7's area-banded table.
    Requires a calibration (px-per-mm) to be meaningful; if none is
    supplied, returns an informational (non-blocking) result so the
    rest of the pipeline still completes.
    """
    font_rule = _load_rules()["font_size_rules"]
    results: list[CheckResult] = []
    regulation_name = "Legal Metrology (Packaged Commodities) Rules, 2011"

    if calibration is None:
        results.append(
            CheckResult(
                rule_id=font_rule["rule_id"],
                rule_reference=font_rule["rule_reference"],
                regulation=regulation_name,
                field="font_size",
                label="Font/Numeral Size Compliance",
                severity="minor",
                passed=False,
                detection_method="none",
                description=(
                    "No calibration reference (ID card / known pack dimensions / DPI) was "
                    "provided, so font height could not be measured in millimetres. Provide "
                    "a calibration reference for a definitive Rule 7 check."
                ),
                bounding_box=None,
            )
        )
        return results

    bands = font_rule["numeral_height_by_pdp_area_mm"]
    applicable_band = bands[-1]
    if pdp_area_cm2 is not None:
        for band in bands:
            if band["max_area_cm2"] is None or pdp_area_cm2 <= band["max_area_cm2"]:
                applicable_band = band
                break
    min_numeral_mm = applicable_band["min_numeral_height_mm"]

    numeral_words = [w for w in ocr.words if w.text.strip(".,").isdigit()]
    undersized = [w for w in numeral_words if px_height_to_mm(w.height, calibration) < min_numeral_mm]

    if numeral_words and undersized:
        for w in undersized[:5]:
            actual_mm = px_height_to_mm(w.height, calibration)
            results.append(
                CheckResult(
                    rule_id=font_rule["rule_id"],
                    rule_reference=font_rule["rule_reference"],
                    regulation=regulation_name,
                    field="font_size",
                    label=f"Numeral '{w.text}' height",
                    severity="major",
                    passed=False,
                    detection_method="cv_measurement",
                    description=(
                        f"Numeral '{w.text}' measures ~{actual_mm}mm tall; Rule 7 requires "
                        f"at least {min_numeral_mm}mm for a PDP of this size."
                    ),
                    bounding_box={"x": w.left, "y": w.top, "w": w.width, "h": w.height},
                )
            )
    else:
        results.append(
            CheckResult(
                rule_id=font_rule["rule_id"],
                rule_reference=font_rule["rule_reference"],
                regulation=regulation_name,
                field="font_size",
                label="Numeral Height Compliance",
                severity="major",
                passed=True,
                detection_method="cv_measurement",
                description=f"All detected numerals meet the {min_numeral_mm}mm minimum for this PDP band.",
                bounding_box=None,
            )
        )

    return results


def compute_compliance_score(checks: list[CheckResult]) -> tuple[float, str]:
    weights = {"critical": 4, "major": 2, "minor": 1}
    total_weight = sum(weights.get(c.severity, 1) for c in checks) or 1
    earned = sum(weights.get(c.severity, 1) for c in checks if c.passed)
    score = round((earned / total_weight) * 100, 1)

    critical_failed = any(c.severity == "critical" and not c.passed for c in checks)
    if score >= 90.0:
        status = "compliant"
    elif critical_failed:
        status = "non_compliant"
    elif score >= 50.0:
        status = "partial"
    else:
        status = "non_compliant"
    return score, status


def run_full_validation(
    ocr: OcrResult,
    calibration: Calibration | None = None,
    pdp_area_cm2: float | None = None,
    is_food_product: bool = False,
    is_plastic_packaging: bool = False,
    ai_declarations: dict | None = None,
    brand_name: str | None = None,
    product_name: str | None = None,
    detected_defects: list[dict] | None = None,
) -> dict:
    # Rule 7 font-size checking is removed from the label checking protocol.
    # Label validation focuses on mandatory declarations under Rule 6, FSSAI, and packaging rules.
    checks = check_mandatory_declarations(
        ocr,
        is_food_product=is_food_product,
        is_plastic_packaging=is_plastic_packaging,
        ai_declarations=ai_declarations,
        brand_name=brand_name,
        product_name=product_name,
        detected_defects=detected_defects,
    )
    score, status = compute_compliance_score(checks)
    return {
        "compliance_score": score,
        "compliance_status": status,
        "checks": [asdict(c) for c in checks],
    }
