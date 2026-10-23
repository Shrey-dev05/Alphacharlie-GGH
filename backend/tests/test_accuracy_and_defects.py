import sys
import os
from pathlib import Path

# Add backend root to sys.path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from app.services.ocr_service import OcrResult, OcrWord
from app.services.validation_engine import (
    check_mandatory_declarations,
    run_full_validation,
    is_valid_declaration_value,
)


def make_dummy_ocr(text: str) -> OcrResult:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    words = []
    top = 10
    for line in lines:
        left = 10
        for w in line.split():
            words.append(
                OcrWord(text=w, left=left, top=top, width=len(w) * 8, height=14, confidence=90.0)
            )
            left += len(w) * 8 + 5
        top += 20
    return OcrResult(full_text=text, words=words, lines=lines, image_width=800, image_height=600)


def get_check(checks, field_name):
    for c in checks:
        if c.field == field_name:
            return c
    return None


def test_net_quantity_counts_and_units():
    # Count-based (Piece / Unit / Number)
    ocr_count = make_dummy_ocr("Product: Toothbrush\nNet Qty: 4 N\nMRP Rs. 100.00")
    checks = check_mandatory_declarations(ocr_count)
    c = get_check(checks, "net_quantity")
    assert c is not None and c.passed, f"Failed for count net_qty '4 N': {c}"

    ocr_units = make_dummy_ocr("Wet Wipes\nNet Quantity: 72 Units\nMRP Rs. 199.00")
    checks = check_mandatory_declarations(ocr_units)
    c = get_check(checks, "net_quantity")
    assert c is not None and c.passed, f"Failed for count net_qty '72 Units': {c}"

    # Metric weight/volume
    ocr_metric = make_dummy_ocr("Whole Wheat Atta\nNet Weight: 5 kg\nMRP Rs. 275.00")
    checks = check_mandatory_declarations(ocr_metric)
    c = get_check(checks, "net_quantity")
    assert c is not None and c.passed, f"Failed for metric net_qty '5 kg': {c}"

    # Invalid / Missing net quantity
    ocr_missing = make_dummy_ocr("Whole Wheat Atta\nNet Weight: ---\nMRP Rs. 275.00")
    checks = check_mandatory_declarations(ocr_missing)
    c = get_check(checks, "net_quantity")
    assert c is not None and not c.passed, f"Should fail for missing digits in net quantity: {c}"


def test_mrp_numeric_requirement_and_defects():
    # Valid MRP with numeric price and tax statement
    ocr_valid = make_dummy_ocr("MRP Rs. 150.00 (inclusive of all taxes)\nNet Wt 500g")
    checks = check_mandatory_declarations(ocr_valid)
    c = get_check(checks, "mrp")
    assert c is not None and c.passed, f"Failed for valid MRP: {c}"

    # Valid MRP with Indian Rupee symbol
    ocr_valid_symbol = make_dummy_ocr("M.R.P. ₹ 99.00 (INCL. OF ALL TAXES)\nNet Wt 200g")
    checks = check_mandatory_declarations(ocr_valid_symbol)
    c = get_check(checks, "mrp")
    assert c is not None and c.passed, f"Failed for valid ₹ MRP: {c}"

    # Defect: Template without price amount (must FAIL Rule 6(1)(e))
    ocr_template_only = make_dummy_ocr("MRP ₹ (INCL. OF ALL TAXES)\nNet Wt 500g")
    ai_decls = {"mrp": "Value missing/not declared"}
    checks = check_mandatory_declarations(ocr_template_only, ai_declarations=ai_decls)
    c = get_check(checks, "mrp")
    assert c is not None and not c.passed, f"Should fail for template without numeric price: {c}"
    assert "lacks a numeric price" in c.description or "NOT detected" in c.description


def test_date_formats():
    # DD/MM/YYYY
    ocr_ddmmyyyy = make_dummy_ocr("Mfg Date: 15/01/2025\nNet Wt 500g")
    checks = check_mandatory_declarations(ocr_ddmmyyyy)
    c = get_check(checks, "mfg_date")
    assert c is not None and c.passed, f"Failed for DD/MM/YYYY: {c}"

    # MM/YY
    ocr_mmyy = make_dummy_ocr("Pkd on: 08/26\nNet Wt 500g")
    checks = check_mandatory_declarations(ocr_mmyy)
    c = get_check(checks, "mfg_date")
    assert c is not None and c.passed, f"Failed for MM/YY: {c}"

    # Month Year
    ocr_mon = make_dummy_ocr("Manufactured: Aug 2026\nNet Wt 500g")
    checks = check_mandatory_declarations(ocr_mon)
    c = get_check(checks, "mfg_date")
    assert c is not None and c.passed, f"Failed for Aug 2026: {c}"


def test_manufacturer_address_variants():
    ocr_mfd = make_dummy_ocr(
        "Mfd. by: Sunrise Foods Pvt Ltd, Plot 45, Industrial Area, Solan, H.P. - 173205\nNet Wt 500g"
    )
    checks = check_mandatory_declarations(ocr_mfd)
    c = get_check(checks, "manufacturer_details")
    assert c is not None and c.passed, f"Failed for Mfd. by: {c}"

    ocr_pkd = make_dummy_ocr(
        "Mfg & Pkd by: Himalayan Agro Ltd, Baddi, Himachal Pradesh\nNet Wt 1 kg"
    )
    checks = check_mandatory_declarations(ocr_pkd)
    c = get_check(checks, "manufacturer_details")
    assert c is not None and c.passed, f"Failed for Mfg & Pkd by: {c}"


def test_consumer_care_contact():
    ocr_tollfree = make_dummy_ocr(
        "For feedback contact Consumer Care: 1800-111-2222 or care@brand.com\nNet Wt 500g"
    )
    checks = check_mandatory_declarations(ocr_tollfree)
    c = get_check(checks, "consumer_care")
    assert c is not None and c.passed, f"Failed for consumer care toll-free/email: {c}"


def test_full_pipeline_validation():
    ocr_full = make_dummy_ocr(
        "HIMALAYAN HARVEST ORGANIC ATTA\n"
        "Net Quantity: 5 kg\n"
        "MRP: Rs. 275.00 (incl. of all taxes)\n"
        "Date of Mfg: 15/01/2025\n"
        "Best Before 9 Months from packaging\n"
        "Mfd. by: Himalayan Harvest Foods Ltd., Plot 45, Ind. Area, Solan, HP - 173205\n"
        "Consumer Care: 1800-111-2222 support@himalayan.in\n"
        "Country of Origin: India\n"
        "FSSAI Lic No. 10019011000543\n"
        "Nutritional Information per 100g: Energy 360 kcal, Protein 12g, Carbohydrate 72g\n"
        "Vegetarian"
    )
    ai_decls = {
        "brand_name": "HIMALAYAN HARVEST",
        "product_name": "ORGANIC ATTA",
        "net_quantity": "5 kg",
        "mrp": "Rs. 275.00 (incl. of all taxes)",
        "mfg_date": "15/01/2025",
        "best_before": "9 Months from packaging",
        "manufacturer_address": "Himalayan Harvest Foods Ltd., Plot 45, Ind. Area, Solan, HP - 173205",
        "consumer_care": "1800-111-2222 support@himalayan.in",
        "country_of_origin": "India",
        "fssai_license": "10019011000543",
        "fssai_nutrition": "Energy 360 kcal, Protein 12g, Carbohydrate 72g",
        "veg_non_veg": "veg",
    }
    result = run_full_validation(
        ocr=ocr_full,
        is_food_product=True,
        is_plastic_packaging=False,
        ai_declarations=ai_decls,
        brand_name="HIMALAYAN HARVEST",
        product_name="ORGANIC ATTA",
    )
    assert result["compliance_status"] == "compliant", f"Expected compliant, got: {result['compliance_status']}"
    assert result["compliance_score"] >= 95.0, f"Expected score >= 95, got {result['compliance_score']}"


if __name__ == "__main__":
    test_net_quantity_counts_and_units()
    print("[PASS] test_net_quantity_counts_and_units passed")
    test_mrp_numeric_requirement_and_defects()
    print("[PASS] test_mrp_numeric_requirement_and_defects passed")
    test_date_formats()
    print("[PASS] test_date_formats passed")
    test_manufacturer_address_variants()
    print("[PASS] test_manufacturer_address_variants passed")
    test_consumer_care_contact()
    print("[PASS] test_consumer_care_contact passed")
    test_full_pipeline_validation()
    print("[PASS] test_full_pipeline_validation passed")
    print("\nALL 6 ACCURACY AND DEFECT DETECTION TESTS PASSED!")
