"""
Samadhan AI (समाधान AI) Packaging Label Generator API
======================================================
Provides:
  - Manufacturer packaging label generation using model 'gemini-nano-banana-2.1'.
  - Quick-start statutory compliant category templates.
"""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException

from app.schemas.schemas import (
    SamadhanLabelGenerateRequest,
    SamadhanLabelGenerateResponse,
    SamadhanPromptParseRequest,
    SamadhanPromptParseResponse,
)
from app.services import samadhan_service

router = APIRouter(prefix="/samadhan", tags=["samadhan"])


@router.post("/parse-prompt", response_model=SamadhanPromptParseResponse)
def parse_prompt(payload: SamadhanPromptParseRequest) -> Any:
    """Extracts statutory packaging declarations directly from a design prompt."""
    parsed = samadhan_service.parse_design_prompt(payload.prompt)
    count = len(parsed)
    return SamadhanPromptParseResponse(
        product_name=parsed.get("product_name"),
        brand_name=parsed.get("brand_name"),
        category=parsed.get("category"),
        net_quantity=parsed.get("net_quantity"),
        mrp=parsed.get("mrp"),
        ingredients=parsed.get("ingredients"),
        manufacturer_name_address=parsed.get("manufacturer_name_address"),
        customer_care=parsed.get("customer_care"),
        fssai_license=parsed.get("fssai_license"),
        mfg_date=parsed.get("mfg_date"),
        expiry_date=parsed.get("expiry_date"),
        is_veg=parsed.get("is_veg", True),
        barcode=parsed.get("barcode"),
        color_palette=parsed.get("color_palette", "royal_navy"),
        extracted_fields_count=count,
    )


@router.post("/generate-label", response_model=SamadhanLabelGenerateResponse)
def generate_label(payload: SamadhanLabelGenerateRequest) -> Any:
    """Generates a certified, photorealistic packaging label artwork using 'gemini-nano-banana-2.1'."""
    req = samadhan_service.LabelGenerationRequest(
        product_name=payload.product_name,
        brand_name=payload.brand_name,
        net_quantity=payload.net_quantity,
        mrp=payload.mrp,
        ingredients=payload.ingredients,
        manufacturer_name_address=payload.manufacturer_name_address,
        customer_care=payload.customer_care,
        fssai_license=payload.fssai_license,
        mfg_date=payload.mfg_date,
        expiry_date=payload.expiry_date,
        is_veg=payload.is_veg,
        barcode=payload.barcode,
        design_prompt=payload.design_prompt,
        category=payload.category,
        color_palette=payload.color_palette,
    )
    result = samadhan_service.generate_compliant_label(req)
    return result


@router.get("/templates")
def get_compliant_templates() -> list[dict[str, Any]]:
    """Returns quick-start statutory compliant packaging templates for manufacturers."""
    return [
        {
            "category": "Fruit Beverages & Juices",
            "product_name": "Alphonso Mango Nectar",
            "brand_name": "Pramaan Organics",
            "net_quantity": "1 L",
            "mrp": "Rs. 125.00 (incl. of all taxes)",
            "ingredients": "Water, Alphonso Mango Pulp (40%), Cane Sugar, Acidity Regulator (INS 330), Antioxidant (INS 300), Natural Mango Flavors.",
            "manufacturer_name_address": "Pramaan Agro Foods Pvt. Ltd., Plot 14, MIDC Industrial Area, Ratnagiri, Maharashtra - 415612",
            "customer_care": "Toll-Free: 1800-222-7777, care@pramaanorganics.com",
            "fssai_license": "10022022000456",
            "mfg_date": "11/2026",
            "expiry_date": "Best before 6 months from manufacture",
            "is_veg": True,
            "barcode": "8901030829141",
            "color_palette": "saffron_amber",
        },
        {
            "category": "Bakery & Biscuits",
            "product_name": "Whole Wheat Digestive Biscuits",
            "brand_name": "Swasthya Bakes",
            "net_quantity": "300 g",
            "mrp": "Rs. 60.00 (incl. of all taxes)",
            "ingredients": "Whole Wheat Flour (Atta 55%), Rolled Oats (15%), Edible Vegetable Oil (Mustard), Jaggery, Raising Agents (INS 500(ii)), Iodised Salt.",
            "manufacturer_name_address": "Swasthya Confectionery Ltd., GIDC Estate, Ankleshwar, Gujarat - 393002",
            "customer_care": "Phone: 022-28475900, support@swasthyabakes.in",
            "fssai_license": "10018021000987",
            "mfg_date": "10/2026",
            "expiry_date": "Best before 9 months from packaging",
            "is_veg": True,
            "barcode": "8902040918234",
            "color_palette": "royal_navy",
        },
        {
            "category": "Edible Vegetable Oils",
            "product_name": "Kachi Ghani Pure Mustard Oil",
            "brand_name": "Shuddh Dhara",
            "net_quantity": "1 L",
            "mrp": "Rs. 185.00 (incl. of all taxes)",
            "ingredients": "100% Pure Cold-Pressed Mustard Oil, Fortified with Vitamin A & Vitamin D2 as per FSSAI regulations.",
            "manufacturer_name_address": "Shuddh Dhara Mills, Khasra 442, Alwar Industrial Corridor, Rajasthan - 301001",
            "customer_care": "Toll-Free: 1800-419-8888, feedback@shuddhadhara.com",
            "fssai_license": "10019013000678",
            "mfg_date": "11/2026",
            "expiry_date": "Best before 12 months from packing",
            "is_veg": True,
            "barcode": "8903050123987",
            "color_palette": "forest_emerald",
        },
        {
            "category": "Snacks & Namkeen",
            "product_name": "Roasted Masala Makhana (Fox Nuts)",
            "brand_name": "Nirvaan Crunch",
            "net_quantity": "80 g",
            "mrp": "Rs. 99.00 (incl. of all taxes)",
            "ingredients": "Fox Nuts (Makhana 82%), Cold-Pressed Olive Oil (10%), Himalayan Pink Salt, Turmeric, Cumin, Black Pepper, Mint Leaves.",
            "manufacturer_name_address": "Nirvaan Nutri Foods, Plot 88, Food Park, Rai, Sonipat, Haryana - 131029",
            "customer_care": "Care Cell: +91-98765-43210, care@nirvaancrunch.com",
            "fssai_license": "10020064000321",
            "mfg_date": "11/2026",
            "expiry_date": "Best before 6 months from manufacture",
            "is_veg": True,
            "barcode": "8904060234123",
            "color_palette": "ruby_red",
        },
    ]
