from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------
class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str
    organization: str | None = None
    state: str | None = None


class UserOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    role: str
    organization: str | None
    state: str | None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str


# ---------- Violations ----------
class BoundingBox(BaseModel):
    x: int
    y: int
    w: int
    h: int


class ViolationOut(BaseModel):
    id: str
    rule_id: str
    rule_reference: str
    regulation: str
    field: str
    severity: str
    description: str
    detection_method: str
    bounding_box: BoundingBox | None
    passed: bool
    ignored: bool = False
    override_reason: str | None = None
    overridden_by: str | None = None
    overridden_at: datetime | None = None

    class Config:
        from_attributes = True


class ViolationOverrideRequest(BaseModel):
    ignored: bool = True
    reason: str | None = None


class ScanOverrideAllRequest(BaseModel):
    reason: str | None = None


# ---------- Scans ----------
class ScanCreateResponse(BaseModel):
    scan_id: str
    status: str


class ScanResult(BaseModel):
    id: str
    status: str
    compliance_status: str | None
    compliance_score: float | None
    inspector_override: bool = False
    inspector_override_notes: str | None = None
    brand_name: str | None
    product_name: str | None
    image_url: str
    annotated_image_url: str | None
    violations: list[ViolationOut]
    extracted_text: str
    barcode_value: str | None
    barcode_symbology: str | None
    product_lookup_source: str | None
    product_lookup_found: bool
    brand_product_source: str  # "manual" | "barcode_lookup" | "not_provided" | "ai_vision"
    extracted_declarations: dict[str, Any] | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ScanListItem(BaseModel):
    id: str
    brand_name: str | None
    product_name: str | None
    compliance_status: str | None
    compliance_score: float | None
    state: str | None
    barcode_value: str | None
    created_at: datetime
    inspector_name: str | None = None

    class Config:
        from_attributes = True


# ---------- Chatbot ----------
class ChatRequest(BaseModel):
    session_id: str
    message: str = Field(..., min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    reply: str
    cited_rules: list[str]


# ---------- Analytics ----------
class ViolationBreakdown(BaseModel):
    rule_reference: str
    count: int


class StateCompliance(BaseModel):
    state: str
    total_scans: int
    compliant: int
    non_compliant: int
    compliance_rate: float


class AnalyticsSummary(BaseModel):
    total_scans: int
    compliant_scans: int
    non_compliant_scans: int
    partial_scans: int
    average_compliance_score: float
    top_violations: list[ViolationBreakdown]
    state_breakdown: list[StateCompliance]


# ---------- Consumer Ingredient Intelligence ----------
class IngredientAnalysisRequest(BaseModel):
    ingredients_text: str = Field(..., min_length=2, max_length=10000)
    product_name: str | None = None
    brand_name: str | None = None


class ChemicalDetectionOut(BaseModel):
    name: str
    code: str
    category: str
    severity: str
    purpose: str
    health_risks: str
    condition_risks: dict[str, str] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class ConditionAssessmentOut(BaseModel):
    condition_key: str
    condition_name: str
    status: str
    reasons: list[str] = Field(default_factory=list)
    offending_chemicals: list[str] = Field(default_factory=list)

    class Config:
        from_attributes = True


class IngredientQualityReportOut(BaseModel):
    raw_ingredients_text: str
    parsed_ingredients: list[str]
    total_ingredients_count: int
    detected_chemicals: list[ChemicalDetectionOut]
    preservatives_count: int
    artificial_colors_count: int
    artificial_sweeteners_count: int
    emulsifiers_count: int
    wholesome_ingredients_count: int
    quality_score: float
    quality_grade: str
    cleanliness_tier: str
    summary_verdict: str
    condition_assessments: dict[str, ConditionAssessmentOut]

    class Config:
        from_attributes = True


# ---------- Multi-Product Comparison ----------
class ProductComparisonInputItem(BaseModel):
    id: str | None = None
    product_name: str
    brand_name: str | None = None
    ingredients: str


class MultiProductComparisonRequest(BaseModel):
    products: list[ProductComparisonInputItem] = Field(..., min_length=2, max_length=6)


class ProductComparisonItemOut(BaseModel):
    product_id: str
    product_name: str
    brand_name: str | None
    ingredients_text: str
    report: IngredientQualityReportOut
    pros: list[str]
    cons: list[str]
    rank: int


class MultiProductComparisonResponse(BaseModel):
    products: list[ProductComparisonItemOut]
    winner_product_id: str
    winner_product_name: str
    verdict_explanation: str
    comparison_matrix: list[dict[str, Any]]
    recommendation_summary: str


# ---------- Samadhan AI Label Generator ----------
class SamadhanLabelGenerateRequest(BaseModel):
    product_name: str = ""
    brand_name: str = ""
    net_quantity: str = ""
    mrp: str = ""
    ingredients: str = ""
    manufacturer_name_address: str = ""
    customer_care: str = ""
    fssai_license: str = ""
    mfg_date: str = ""
    expiry_date: str = ""
    is_veg: bool = True
    barcode: str = ""
    design_prompt: str | None = None
    category: str = "Food & Beverage"
    color_palette: str = "royal_navy"


class SamadhanPromptParseRequest(BaseModel):
    prompt: str = Field(..., min_length=1)


class SamadhanPromptParseResponse(BaseModel):
    product_name: str | None = None
    brand_name: str | None = None
    category: str | None = None
    net_quantity: str | None = None
    mrp: str | None = None
    ingredients: str | None = None
    manufacturer_name_address: str | None = None
    customer_care: str | None = None
    fssai_license: str | None = None
    mfg_date: str | None = None
    expiry_date: str | None = None
    is_veg: bool = True
    barcode: str | None = None
    color_palette: str = "royal_navy"
    extracted_fields_count: int = 0


class SamadhanLabelGenerateResponse(BaseModel):
    label_id: str
    image_url: str
    storage_key: str
    model_used: str
    design_prompt: str
    statutory_checklist: list[dict[str, Any]]
    specification_summary: dict[str, Any]


# ---------- Consumer Label Image Scan ----------
class ConsumerLabelScanResponse(BaseModel):
    success: bool
    extracted_ingredients: str
    product_name: str | None = None
    brand_name: str | None = None
    method: str
    report: IngredientQualityReportOut

