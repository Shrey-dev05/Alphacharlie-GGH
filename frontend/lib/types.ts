export type Role = "field_inspector" | "ecommerce_auditor" | "manufacturer" | "super_admin";

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  organization: string | null;
  state: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: Role;
  full_name: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Violation {
  id: string;
  rule_id: string;
  rule_reference: string;
  regulation: string;
  field: string;
  severity: "minor" | "major" | "critical";
  description: string;
  detection_method: "regex" | "keyword" | "ml_classifier" | "both" | "cv_measurement" | "ai_vision" | "ensemble" | "none";
  bounding_box: BoundingBox | null;
  passed: boolean;
  ignored?: boolean;
  override_reason?: string | null;
  overridden_by?: string | null;
  overridden_at?: string | null;
}

export type ComplianceStatus = "compliant" | "non_compliant" | "partial";

export interface ScanResult {
  id: string;
  status: string;
  compliance_status: ComplianceStatus | null;
  compliance_score: number | null;
  inspector_override?: boolean;
  inspector_override_notes?: string | null;
  brand_name: string | null;
  product_name: string | null;
  image_url: string;
  annotated_image_url: string | null;
  violations: Violation[];
  extracted_text: string;
  barcode_value: string | null;
  barcode_symbology: string | null;
  product_lookup_source: string | null;
  product_lookup_found: boolean;
  brand_product_source: "manual" | "barcode_lookup" | "ai_vision" | "not_provided";
  extracted_declarations?: Record<string, string | null>;
  created_at: string;
}

export interface ScanListItem {
  id: string;
  brand_name: string | null;
  product_name: string | null;
  compliance_status: ComplianceStatus | null;
  compliance_score: number | null;
  state: string | null;
  barcode_value: string | null;
  created_at: string;
  inspector_name: string | null;
}

export interface ChatResponse {
  reply: string;
  cited_rules: string[];
}

export interface ViolationBreakdown {
  rule_reference: string;
  count: number;
}

export interface StateCompliance {
  state: string;
  total_scans: number;
  compliant: number;
  non_compliant: number;
  compliance_rate: number;
}

export interface AnalyticsSummary {
  total_scans: number;
  compliant_scans: number;
  non_compliant_scans: number;
  partial_scans: number;
  average_compliance_score: number;
  top_violations: ViolationBreakdown[];
  state_breakdown: StateCompliance[];
}

// ---------- Consumer Ingredient Intelligence ----------
export interface ChemicalDetection {
  name: string;
  code: string;
  category: string;
  severity: "low" | "moderate" | "high";
  purpose: string;
  health_risks: string;
  condition_risks: Record<string, string>;
}

export interface ConditionAssessment {
  condition_key: string;
  condition_name: string;
  status: "safe" | "caution" | "high_risk";
  reasons: string[];
  offending_chemicals: string[];
}

export interface IngredientQualityReport {
  raw_ingredients_text: string;
  parsed_ingredients: string[];
  total_ingredients_count: number;
  detected_chemicals: ChemicalDetection[];
  preservatives_count: number;
  artificial_colors_count: number;
  artificial_sweeteners_count: number;
  emulsifiers_count: number;
  wholesome_ingredients_count: number;
  quality_score: number;
  quality_grade: "A" | "B" | "C" | "D" | "E";
  cleanliness_tier: string;
  summary_verdict: string;
  condition_assessments: Record<string, ConditionAssessment>;
}

export interface ProductComparisonItem {
  product_id: string;
  product_name: string;
  brand_name: string | null;
  ingredients_text: string;
  report: IngredientQualityReport;
  pros: string[];
  cons: string[];
  rank: number;
}

export interface MultiProductComparisonResult {
  products: ProductComparisonItem[];
  winner_product_id: string;
  winner_product_name: string;
  verdict_explanation: string;
  comparison_matrix: Array<Record<string, any>>;
  recommendation_summary: string;
}

// ---------- Samadhan AI Label Generator ----------
export interface SamadhanLabelRequest {
  product_name: string;
  brand_name: string;
  net_quantity: string;
  mrp: string;
  ingredients: string;
  manufacturer_name_address: string;
  customer_care: string;
  fssai_license?: string;
  mfg_date?: string;
  expiry_date?: string;
  is_veg?: boolean;
  barcode?: string;
  design_prompt?: string;
  category?: string;
  color_palette?: string;
}

export interface SamadhanLabelResponse {
  label_id: string;
  image_url: string;
  storage_key: string;
  model_used: string;
  design_prompt: string;
  statutory_checklist: Array<{
    rule: string;
    title: string;
    status: string;
    declaration: string;
    notes: string;
  }>;
  specification_summary: Record<string, any>;
}

export interface SamadhanTemplate {
  category: string;
  product_name: string;
  brand_name: string;
  net_quantity: string;
  mrp: string;
  ingredients: string;
  manufacturer_name_address: string;
  customer_care: string;
  fssai_license: string;
  mfg_date: string;
  expiry_date: string;
  is_veg: boolean;
  barcode: string;
  color_palette: string;
}

export interface SamadhanPromptParseResponse {
  product_name?: string | null;
  brand_name?: string | null;
  category?: string | null;
  net_quantity?: string | null;
  mrp?: string | null;
  ingredients?: string | null;
  manufacturer_name_address?: string | null;
  customer_care?: string | null;
  fssai_license?: string | null;
  mfg_date?: string | null;
  expiry_date?: string | null;
  is_veg?: boolean;
  barcode?: string | null;
  color_palette?: string;
  extracted_fields_count: number;
}

export interface ConsumerLabelScanResponse {
  success: boolean;
  extracted_ingredients: string;
  product_name?: string | null;
  brand_name?: string | null;
  method: string;
  report: IngredientQualityReport;
}
