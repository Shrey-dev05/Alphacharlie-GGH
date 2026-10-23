"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FileDown,
  CheckCircle2,
  XCircle,
  Loader2,
  Barcode,
  Sparkles,
  Copy,
  Check,
  ChevronLeft,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
  EyeOff,
  RotateCcw,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  Panel,
  ComplianceBadge,
  SeverityTag,
  RuleTag,
  DetectionMethodTag,
  ComplianceGauge,
  OfficialSealBadge,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { ScanResult, Violation } from "@/lib/types";

const DECLARATION_LABELS: Record<string, string> = {
  brand_name: "Brand / Trademark",
  product_name: "Generic Commodity Name",
  mrp: "Maximum Retail Price (MRP)",
  net_quantity: "Net Quantity (Standard Metric)",
  unit_sale_price: "Unit Sale Price (Rule 6(11))",
  mfg_date: "Date of Manufacture / Packing",
  expiry_date: "Expiry / Best Before Date",
  manufacturer_address: "Manufacturer Name & Address",
  packer_address: "Packer Name & Address",
  importer_address: "Importer Name & Address",
  consumer_care: "Consumer Care Contacts",
  country_of_origin: "Country of Origin",
  fssai_license: "FSSAI License / Registration",
  veg_non_veg: "Dietary Category (Veg/Non-Veg)",
  plastic_packaging_info: "Plastic Packaging / EPR Info",
};

const FRIENDLY_TITLES: Record<string, string> = {
  mrp: "Maximum Retail Price (MRP)",
  net_quantity: "Net Quantity in Standard Units",
  manufacturer: "Name & Address of Manufacturer / Packer",
  manufacturer_details: "Name & Address of Manufacturer / Packer",
  product_name: "Generic Commodity Name",
  common_name: "Generic Commodity Name",
  mfg_date: "Date / Month of Manufacture",
  expiry_date: "Expiry / Best Before Date",
  best_before: "Expiry / Best Before Date",
  unit_sale_price: "Unit Sale Price (USP)",
  consumer_care: "Consumer Care & Support Contact",
  country_of_origin: "Country of Origin",
  fssai_license: "FSSAI License & Registration Number",
  veg_non_veg: "Vegetarian / Non-Vegetarian Logo",
  fssai_veg_nonveg: "Vegetarian / Non-Vegetarian Logo",
  fssai_nutrition: "Nutritional Information Panel",
  nutrition_info: "Nutritional Information Panel",
  fssai_allergen: "Allergen Warning Declaration",
  allergen_info: "Allergen Warning Declaration",
  dual_dates: "Dual Mfg & Expiry Dates",
  plastic_material_code: "Plastic Material / Polymer Identification",
  plastic_epr_number: "CPCB EPR Registration Number",
  plastic_recycled_content: "Recycled Content / Compostability",
  plastic_packaging: "Plastic Packaging & EPR Thickness",
  plastic_packaging_info: "Plastic Packaging & EPR Thickness",
  font_size: "Numeral Height & Minimum Font Standards",
};

const PLACEHOLDER_PATTERNS = [
  /\b(?:value\s+is\s+|numeric\s+value\s+is\s+|price\s+is\s+|actual\s+value\s+is\s+)?missing\b/i,
  /\bplaceholder\b/i,
  /\bobliterated\b/i,
  /\billegible\b/i,
  /\bunreadable\b/i,
  /\bnot\s+(?:printed|stamped|embossed|visible|present|available|provided|found|declared|specified|stated|readable)\b/i,
  /\bno\s+(?:numeric\s+)?(?:value|price)\b/i,
  /\blacks?\s+(?:a\s+)?numeric\s+(?:value|price)\b/i,
  /\bto\s+be\s+printed\b/i,
  /\bblank\b/i,
];

function isValidDeclaration(val: unknown, fieldName?: string): boolean {
  if (!val) return false;
  const s = String(val).trim();
  if (!s) return false;
  const sLower = s.toLowerCase();
  if (sLower === "null" || sLower === "none" || sLower === "absent" || sLower === "n/a" || sLower === "unspecified") return false;
  if (/^not\s+(mentioned|stated|explicitly|found|visible|present|available|provided|printed|declared|specified)/i.test(sLower)) return false;
  if (/^cannot\s+be\s+determined/i.test(sLower)) return false;

  for (const pat of PLACEHOLDER_PATTERNS) {
    if (pat.test(s)) return false;
  }

  // Under Rule 6(1)(e), MRP must contain an actual numeric price amount
  if (fieldName === "mrp") {
    const hasPrice = /(?:(?:₹|rs\.?|inr)\s*:?\s*\d+|\b\d+(?:[.,]\d{1,2})?\s*(?:\/-\s*)?(?:₹|rs\.?|inr)\b|(?:mrp|m\.r\.p|retail price|maximum retail price)[^\d\n]{0,25}\b\d+)/i.test(s);
    if (!hasPrice) return false;
  }

  return true;
}

function getRuleCategory(v: Violation): "rule6" | "fssai" | "specs" {
  const f = (v.field || "").toLowerCase();
  const ref = (v.rule_reference || "").toLowerCase();
  if (
    f === "fssai_license" ||
    f === "veg_non_veg" ||
    f === "fssai_veg_nonveg" ||
    f === "fssai_nutrition" ||
    f === "nutrition_info" ||
    f === "fssai_allergen" ||
    f === "allergen_info" ||
    f === "dual_dates" ||
    ref.includes("fss")
  ) {
    return "fssai";
  }
  if (
    f === "plastic_packaging" ||
    f === "plastic_packaging_info" ||
    f === "plastic_material_code" ||
    f === "plastic_epr_number" ||
    f === "plastic_recycled_content" ||
    f === "epr_registration" ||
    ref.includes("pwm")
  ) {
    return "specs";
  }
  return "rule6";
}

function extractAddressFromText(text?: string): string {
  if (!text) return "";
  const pattern =
    /(?:(?:manufactured|mfg\.?|mfd\.?|marketed|packed|pkd\.?|imported)\s*(?:and\s*packed\s*)?by\s*[:\-]?\s*)([^\n]+(?:\n(?!\s*(?:customer\s*care|consumer\s*care|care@|toll[- ]?free|helpline|phone|email|website|www\.|mrp|net\s*wt|net\s*quantity|batch|exp|best\s*before|mfg\b|\(barcode))[^\n]+){0,5})/i;
  const m = text.match(pattern);
  if (m) {
    const cleaned = m[0].trim();
    const lines = cleaned
      .split("\n")
      .map((l) => l.trim().replace(/,+$/, "").trim())
      .filter(Boolean);
    return lines.join(", ").replace(/,\s*,+/g, ", ");
  }
  return "";
}

function parseCheckDetails(
  v: Violation,
  extractedDeclarations?: Record<string, any>,
  extractedText?: string
) {
  const title = FRIENDLY_TITLES[v.field] || v.rule_reference || "Statutory Declaration";
  const category = getRuleCategory(v);
  const categoryLabel =
    category === "rule6"
      ? "Rule 6 Mandatory"
      : category === "fssai"
      ? "FSSAI Food Safety"
      : "Plastic Waste & EPR";

  let detectedValue = "";
  const quoteMatch = v.description.match(/'([^']+)'/);
  if (quoteMatch) {
    const candidate = quoteMatch[1];
    if (isValidDeclaration(candidate, v.field)) {
      detectedValue = candidate;
    }
  }

  if (!detectedValue) {
    if (extractedDeclarations) {
      const isExpiry = v.field === "best_before" || v.field === "expiry_date";
      const expVal = extractedDeclarations.expiry_date || extractedDeclarations.best_before;
      if (isExpiry && isValidDeclaration(expVal, "best_before")) {
        detectedValue = String(expVal);
      } else if (v.field === "mfg_date" && isValidDeclaration(extractedDeclarations.mfg_date, "mfg_date")) {
        detectedValue = String(extractedDeclarations.mfg_date);
      } else if (v.field === "net_quantity" && isValidDeclaration(extractedDeclarations.net_quantity, "net_quantity")) {
        detectedValue = String(extractedDeclarations.net_quantity);
      } else if (v.field === "mrp" && isValidDeclaration(extractedDeclarations.mrp, "mrp")) {
        detectedValue = String(extractedDeclarations.mrp);
      } else if (v.field === "unit_sale_price" && isValidDeclaration(extractedDeclarations.unit_sale_price, "unit_sale_price")) {
        detectedValue = String(extractedDeclarations.unit_sale_price);
      } else if (
        v.field === "manufacturer_details" ||
        v.field === "manufacturer" ||
        v.field === "packer_address" ||
        v.field === "manufacturer_address"
      ) {
        const mfgVal =
          extractedDeclarations.manufacturer_address ||
          extractedDeclarations.packer_address ||
          extractedDeclarations.importer_address ||
          extractedDeclarations.manufacturer ||
          extractedDeclarations.manufacturer_name;
        if (isValidDeclaration(mfgVal, "manufacturer_details")) {
          detectedValue = String(mfgVal);
        }
      }
    }

    if (
      !detectedValue &&
      (v.field === "manufacturer_details" ||
        v.field === "manufacturer" ||
        v.field === "packer_address" ||
        v.field === "manufacturer_address")
    ) {
      const fromText = extractAddressFromText(extractedText);
      if (fromText && isValidDeclaration(fromText, "manufacturer_details")) {
        detectedValue = fromText;
      }
    }
  }

  let cleanSummary = v.description;
  if (v.passed) {
    if (detectedValue) {
      cleanSummary = `Verified and present on packaging.`;
    } else {
      cleanSummary = `Verified compliant with statutory rules.`;
    }
  } else {
    cleanSummary = v.description
      .replace(/\. Required under.*$/, ".")
      .replace(/was NOT detected\..*$/, "was not found on packaging artwork.");
  }

  return {
    title,
    category,
    categoryLabel,
    detectedValue,
    cleanSummary,
  };
}

export default function ResultsPage() {
  const params = useParams<{ scanId: string }>();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [activeStatusTab, setActiveStatusTab] = useState<"all" | "violations" | "passed">("all");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "rule6" | "fssai" | "specs">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCitationIds, setExpandedCitationIds] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Inspector Defect Override States
  const [overridingId, setOverridingId] = useState<string | null>(null);
  const [overrideReasonInput, setOverrideReasonInput] = useState("");
  const [isOverridingAll, setIsOverridingAll] = useState(false);
  const [activeOverridePromptId, setActiveOverridePromptId] = useState<string | null>(null);
  const [overrideSuccessMsg, setOverrideSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .getScan(params.scanId)
      .then(setScan)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load scan result."));
  }, [params.scanId]);

  async function handleDownloadReport() {
    if (!scan) return;
    setGeneratingReport(true);
    try {
      const { download_url } = await api.generateReport(scan.id);
      window.open(download_url, "_blank");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate statutory PDF report.");
    } finally {
      setGeneratingReport(false);
    }
  }

  async function handleToggleIgnore(violation: Violation, reason?: string) {
    if (!scan) return;
    const newIgnored = !violation.ignored;
    setOverridingId(violation.id);
    try {
      const finalReason = reason || overrideReasonInput.trim() || (newIgnored ? "Physical label verified directly by Inspector" : undefined);
      const updated = await api.overrideViolation(
        scan.id,
        violation.id,
        newIgnored,
        finalReason
      );
      setScan(updated);
      setActiveOverridePromptId(null);
      setOverrideReasonInput("");
      setOverrideSuccessMsg(
        newIgnored
          ? `Defect ignored. Product recalculated as ${updated.compliance_status?.toUpperCase()} (${updated.compliance_score}%).`
          : "Override reverted. Defect re-flagged."
      );
      setTimeout(() => setOverrideSuccessMsg(null), 4500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update defect override.");
    } finally {
      setOverridingId(null);
    }
  }

  async function handleApproveAll(reason?: string) {
    if (!scan) return;
    setIsOverridingAll(true);
    try {
      const finalReason = reason || "All defects reviewed and cleared under official Inspector discretion";
      const updated = await api.overrideAllViolations(scan.id, finalReason);
      setScan(updated);
      setOverrideSuccessMsg("All defects cleared. Product marked as fully COMPLIANT (100%).");
      setTimeout(() => setOverrideSuccessMsg(null), 4500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to approve product.");
    } finally {
      setIsOverridingAll(false);
    }
  }

  function copyToClipboard(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function toggleCitation(id: string) {
    setExpandedCitationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Harmonize violations against extracted_declarations so declared fields (like Expiry Date, Manufacturer) never false-fail
  const harmonizedViolations = useMemo(() => {
    if (!scan) return [];
    const decls = scan.extracted_declarations || {};
    return scan.violations.map((v) => {
      const isExpiry = v.field === "best_before" || v.field === "expiry_date";
      const expVal = decls.expiry_date || decls.best_before;
      if (!v.passed && !v.ignored && isExpiry && isValidDeclaration(expVal)) {
        return {
          ...v,
          passed: true,
          detection_method: "ensemble" as const,
          description: `Best Before / Expiry Date detected: '${expVal}'.`,
        };
      }

      const isMfg = v.field === "manufacturer_details" || v.field === "manufacturer";
      if (isMfg) {
        const addr =
          (isValidDeclaration(decls.manufacturer_address) ? String(decls.manufacturer_address) : "") ||
          (isValidDeclaration(decls.packer_address) ? String(decls.packer_address) : "") ||
          (isValidDeclaration(decls.importer_address) ? String(decls.importer_address) : "") ||
          extractAddressFromText(scan.extracted_text);

        if (addr) {
          if (!v.passed && !v.ignored) {
            return {
              ...v,
              passed: true,
              detection_method: "ensemble" as const,
              description: `Name & Address of Manufacturer/Packer/Importer detected: '${addr}'.`,
            };
          } else if (v.passed && !v.description.includes("'")) {
            return {
              ...v,
              description: `Name & Address of Manufacturer/Packer/Importer detected: '${addr}'.`,
            };
          }
        }
      }

      // Harmonize MRP: If marked passed, but lacks a numeric price or is a placeholder, flag as defect
      if (v.field === "mrp" && !v.ignored) {
        const mrpDecl = decls.mrp ? String(decls.mrp) : "";
        const mrpValid = isValidDeclaration(mrpDecl, "mrp");
        const ocrHasPrice = /(?:(?:₹|rs\.?|inr)\s*:?\s*\d+(?:[.,]\d{1,2})?|(?:mrp|m\.r\.p|retail price|maximum retail price)[^\d\n]{0,25}\b\d+)/i.test(scan.extracted_text || "");

        if (!mrpValid && !ocrHasPrice) {
          return {
            ...v,
            passed: false,
            severity: "critical" as const,
            detection_method: "none" as const,
            description: mrpDecl
              ? `Retail Sale Price / MRP declaration lacks a numeric price (detected placeholder/template: '${mrpDecl}'). Required under Rule 6(1)(e).`
              : `Retail Sale Price / MRP was NOT detected with a valid numeric price. Required under Rule 6(1)(e).`,
          };
        }
      }

      return v;
    });
  }, [scan]);

  // Filter checks cleanly (considering ignored as compliant)
  const filteredChecks = useMemo(() => {
    if (!scan) return [];
    return harmonizedViolations.filter((v) => {
      const isPassedOrIgnored = Boolean(v.passed || v.ignored);
      // 1. Status Tab filter
      if (activeStatusTab === "violations" && isPassedOrIgnored) return false;
      if (activeStatusTab === "passed" && !isPassedOrIgnored) return false;

      // 2. Category filter
      if (selectedCategory !== "all" && getRuleCategory(v) !== selectedCategory) return false;

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const details = parseCheckDetails(v, scan.extracted_declarations, scan.extracted_text);
        const matchTitle = details.title.toLowerCase().includes(q);
        const matchDesc = v.description.toLowerCase().includes(q);
        const matchRule = (v.rule_reference || "").toLowerCase().includes(q);
        const matchField = (v.field || "").toLowerCase().includes(q);
        const matchVal = (details.detectedValue || "").toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchRule && !matchField && !matchVal) {
          return false;
        }
      }
      return true;
    });
  }, [scan, harmonizedViolations, activeStatusTab, selectedCategory, searchQuery]);

  if (error) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl rounded-xl border border-rose-300 bg-rose-50 p-6 text-center">
          <AlertTriangle size={32} className="mx-auto text-rose-600 mb-2" />
          <h2 className="text-lg font-bold text-rose-900">Inspection Record Not Accessible</h2>
          <p className="mt-1 text-xs sm:text-sm text-rose-700">{error}</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gov-navy px-4 py-2 text-xs font-semibold text-white shadow-xs"
          >
            <ChevronLeft size={14} /> Return to Label AI Dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!scan) {
    return (
      <AppShell>
        <div className="flex h-96 flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 size={28} className="animate-spin text-gov-saffron" />
          <p className="text-xs sm:text-sm font-medium">Retrieving verified Label AI inspection record...</p>
        </div>
      </AppShell>
    );
  }

  const allSatisfied = harmonizedViolations.length > 0 && harmonizedViolations.every((v) => v.passed || v.ignored);
  const effectiveScore =
    allSatisfied && (!scan.compliance_score || scan.compliance_score < 100)
      ? 100.0
      : scan.compliance_score || 0;
  const effectiveStatus =
    allSatisfied || (effectiveScore && effectiveScore >= 90.0)
      ? "compliant"
      : scan.compliance_status;
  const isCompliant = effectiveStatus === "compliant";

  const passed = harmonizedViolations.filter((v) => v.passed || v.ignored);
  const failed = harmonizedViolations.filter((v) => !v.passed && !v.ignored);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Back Link & Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-gov-navy transition-colors"
          >
            <ChevronLeft size={14} /> Back to Label AI Dashboard
          </Link>
          <OfficialSealBadge compliant={isCompliant} scanId={scan.id} />
        </div>

        {/* 1. Official Statutory Certificate Header */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-gov">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-xs hidden sm:flex">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/label-ai-logo.png" alt="Label AI Logo" className="h-full w-full object-contain" />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-gov-navy/10 px-2 py-0.5 font-mono text-[10px] font-bold text-gov-navy uppercase tracking-wider">
                    Label AI Statutory Audit Certificate
                  </span>
                  <span className="font-mono text-xs text-slate-400">Scan ID: {scan.id}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(scan.created_at).toLocaleString()}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-gov-navy tracking-tight">
                  {scan.brand_name || "Unbranded Commodity"}
                  {scan.product_name ? ` — ${scan.product_name}` : ""}
                </h1>

              {scan.barcode_value && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-1">
                  <div className="inline-flex items-center gap-1 font-mono rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-slate-700">
                    <Barcode size={13} />
                    <span>{scan.barcode_value}</span>
                    <span className="text-[10px] text-slate-400">({scan.barcode_symbology})</span>
                  </div>
                  {scan.brand_product_source === "barcode_lookup" && (
                    <span className="text-emerald-700 font-medium">✓ Auto-identified from GS1 database</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {failed.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleApproveAll()}
                  disabled={isOverridingAll}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-3 text-xs sm:text-sm font-semibold shadow-gov transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                  title="Inspector discretion: clear all detected defects and certify product compliant"
                >
                  {isOverridingAll ? (
                    <Loader2 size={16} className="animate-spin text-emerald-200" />
                  ) : (
                    <ShieldCheck size={16} className="text-emerald-300" />
                  )}
                  <span>Approve Product (Ignore All Defects)</span>
                </button>
              )}

              {scan.inspector_override && (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-300 px-3.5 py-2.5 text-xs font-bold text-emerald-800 shadow-2xs">
                  <ShieldCheck size={15} className="text-emerald-600" />
                  <span>Inspector Approved</span>
                </span>
              )}

              <button
                type="button"
                onClick={handleDownloadReport}
                disabled={generatingReport}
                className="inline-flex items-center gap-2 rounded-xl bg-gov-navy hover:bg-gov-navy-light text-white px-5 py-3 text-xs sm:text-sm font-semibold shadow-gov transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
              >
                {generatingReport ? (
                  <Loader2 size={16} className="animate-spin text-gov-saffron" />
                ) : (
                  <FileDown size={16} className="text-gov-saffron" />
                )}
                <span>Download Gazetted PDF Report</span>
              </button>
            </div>
          </div>
        </div>

        {/* Override Status Banner */}
        {overrideSuccessMsg && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 flex items-center justify-between text-xs text-emerald-900 font-semibold shadow-xs animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{overrideSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setOverrideSuccessMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* 2. Top Summary KPI Grid (Score Gauge + Metrics) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Animated Circular Compliance Gauge */}
          <div className="md:col-span-1">
            <ComplianceGauge score={effectiveScore} />
          </div>

          {/* Key Audit Metrics */}
          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-gov">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Statutory Status</div>
              <div className="mt-1.5">
                <ComplianceBadge status={effectiveStatus} score={effectiveScore} size="sm" />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-gov">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Mandatory Rules</div>
              <div className="mt-1 text-xl font-extrabold text-gov-navy tracking-tight">
                {passed.length} / {harmonizedViolations.length} <span className="text-xs font-normal text-slate-500">Passed</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-gov">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Actionable Defects</div>
              <div className={`mt-1 text-xl font-extrabold tracking-tight ${failed.length > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {failed.length} <span className="text-xs font-normal text-slate-500">Defects</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-gov col-span-2 sm:col-span-3">
              <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                <span>Statutory Compliance Progress</span>
                <span className="font-mono text-gov-navy font-bold">{effectiveScore?.toFixed(1)}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    isCompliant ? "bg-emerald-600" : effectiveScore >= 50 ? "bg-amber-500" : "bg-rose-600"
                  }`}
                  style={{ width: `${effectiveScore}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                <span>Mandatory declarations verified against <strong>Rule 6</strong> of Legal Metrology (PC) Rules, 2011.</span>
                {(scan.compliance_score || 0) >= 90 && (
                  <span className="text-emerald-700 font-semibold">✓ Meets ≥90% Compliance Standard</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Core Inspection Panels: Artwork Viewer & Declarations Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Annotated Packaging Image & Transcription */}
          <div className="lg:col-span-5 space-y-4">
            <Panel
              title="Principal Display Panel (PDP)"
              subtitle="Computer Vision bounding box detections & calibration"
            >
              <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-900 shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={scan.annotated_image_url || scan.image_url}
                  alt="Annotated packaging inspection"
                  className="w-full object-contain max-h-[440px] mx-auto"
                />
              </div>

              {/* Bounding Box Legend */}
              <div className="mt-3.5 flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Compliant Field
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> Missing / Defect
                </span>
                {scan.barcode_value && (
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Barcode EAN
                  </span>
                )}
              </div>
            </Panel>

            {/* Verbatim Transcription */}
            <Panel
              title="Packaging Transcription Stream"
              subtitle="Character extraction from Paramarsh Multimodal Vision & OCR"
            >
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 max-h-48 overflow-y-auto">
                <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-700">
                  {scan.extracted_text || "No text extracted."}
                </p>
              </div>
            </Panel>
          </div>

          {/* Right Column: Extracted Packaging Declarations & Redesigned Rule Audit */}
          <div className="lg:col-span-7 space-y-6">
            {/* Structured Declarations Card Grid */}
            {scan.extracted_declarations && Object.values(scan.extracted_declarations).some(Boolean) && (
              <Panel
                title="Extracted Packaging Declarations"
                subtitle="High-accuracy extraction by Paramarsh Multimodal Vision + Multi-Pass OCR"
                action={
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                    <Sparkles size={11} /> Paramarsh Vision Ensemble
                  </span>
                }
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(scan.extracted_declarations)
                    .filter(([_, val]) => Boolean(val))
                    .map(([key, val]) => (
                      <div
                        key={key}
                        className="group relative rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 hover:bg-white hover:border-gov-navy/40 hover:shadow-gov transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate mr-2">
                            {DECLARATION_LABELS[key] || key.replace(/_/g, " ")}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(key, String(val))}
                            title="Copy declaration value"
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-gov-navy transition-opacity shrink-0"
                          >
                            {copiedKey === key ? (
                              <Check size={12} className="text-emerald-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                        <p className="mt-1 text-xs sm:text-sm font-semibold text-gov-navy break-words">
                          {String(val)}
                        </p>
                      </div>
                    ))}
                </div>
              </Panel>
            )}

            {/* 4. REDESIGNED STATUTORY RULE-BY-RULE CHECKLIST (NO OVERLAPPING, ZERO CLUTTER) */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-gov overflow-hidden">
              {/* Header Bar */}
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[17px] font-bold text-gov-navy tracking-tight">
                      Statutory Rule-by-Rule Checklist
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Statutory audit under Legal Metrology (PC) Rules, 2011 &amp; FSSAI standards
                    </p>
                  </div>

                  {/* Summary Counter Pills */}
                  <div className="flex items-center gap-2 text-xs shrink-0">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-emerald-800 font-semibold text-[11px]">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      <span>{passed.length} Passed</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-1 text-rose-800 font-semibold text-[11px]">
                      <XCircle size={13} className="text-rose-600" />
                      <span>{failed.length} Action Needed</span>
                    </span>
                  </div>
                </div>

                {/* Filter Toolbar: Perfectly aligned in stacked rows to eliminate overlapping */}
                <div className="mt-4 space-y-3 pt-3 border-t border-slate-200/70">
                  {/* Row 1: Status Tabs and Search Input */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Status Tabs */}
                    <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setActiveStatusTab("all")}
                        className={`flex-1 text-center py-1 font-semibold rounded transition-all ${
                          activeStatusTab === "all"
                            ? "bg-gov-navy text-white shadow-xs"
                            : "text-slate-600 hover:text-gov-navy"
                        }`}
                      >
                        All ({harmonizedViolations.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveStatusTab("violations")}
                        className={`flex-1 text-center py-1 font-semibold rounded transition-all ${
                          activeStatusTab === "violations"
                            ? "bg-rose-700 text-white shadow-xs"
                            : "text-rose-700 hover:bg-rose-50"
                        }`}
                      >
                        Defects ({failed.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveStatusTab("passed")}
                        className={`flex-1 text-center py-1 font-semibold rounded transition-all ${
                          activeStatusTab === "passed"
                            ? "bg-emerald-700 text-white shadow-xs"
                            : "text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        Passed ({passed.length})
                      </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search rules (e.g. MRP, FSSAI, date)..."
                        className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-gov-navy focus:ring-1 focus:ring-gov-navy transition-colors"
                      />
                    </div>
                  </div>

                  {/* Row 2: Category Filter Pills */}
                  <div className="flex items-center gap-1.5 text-[11px] overflow-x-auto pb-1">
                    <span className="text-slate-400 font-medium shrink-0 mr-1">Section:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("all")}
                      className={`shrink-0 rounded-full px-2.5 py-0.5 font-medium transition-colors ${
                        selectedCategory === "all"
                          ? "bg-slate-800 text-white font-semibold"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      All Sections
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("rule6")}
                      className={`shrink-0 rounded-full px-2.5 py-0.5 font-medium transition-colors ${
                        selectedCategory === "rule6"
                          ? "bg-gov-navy text-white font-semibold"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Rule 6 Mandatory
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("fssai")}
                      className={`shrink-0 rounded-full px-2.5 py-0.5 font-medium transition-colors ${
                        selectedCategory === "fssai"
                          ? "bg-blue-800 text-white font-semibold"
                          : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                      }`}
                    >
                      FSSAI Food Safety
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("specs")}
                      className={`shrink-0 rounded-full px-2.5 py-0.5 font-medium transition-colors ${
                        selectedCategory === "specs"
                          ? "bg-purple-800 text-white font-semibold"
                          : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                      }`}
                    >
                      Plastic Waste &amp; EPR
                    </button>
                  </div>
                </div>
              </div>

              {/* Checklist Cards Stream with Clean Multi-Tier Layout */}
              <div className="p-4 sm:p-5 space-y-3 max-h-[640px] overflow-y-auto">
                {filteredChecks.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No statutory rules match your current filter or search criteria.
                  </div>
                ) : (
                  filteredChecks.map((v) => {
                    const { title, categoryLabel, detectedValue, cleanSummary } = parseCheckDetails(
                      v,
                      scan.extracted_declarations,
                      scan.extracted_text
                    );
                    const isExpanded = expandedCitationIds.has(v.id);

                    return (
                      <div
                        key={v.id}
                        className={`rounded-xl border transition-all p-3.5 shadow-2xs space-y-2.5 ${
                          v.passed
                            ? "border-emerald-200 bg-white hover:border-emerald-300"
                            : "border-rose-200 bg-white hover:border-rose-300"
                        }`}
                      >
                        {/* Tier 1: Badge Bar (Guaranteed No Collisions) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {v.ignored ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider">
                                <ShieldCheck size={11} strokeWidth={2.5} className="text-emerald-700" /> Compliant (Inspector Override)
                              </span>
                            ) : v.passed ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider">
                                <Check size={11} strokeWidth={3} /> Compliant
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider">
                                <AlertTriangle size={11} strokeWidth={3} /> Action Needed
                              </span>
                            )}
                            <RuleTag reference={v.rule_reference} />
                            <SeverityTag severity={v.severity} />
                          </div>

                          <span className="text-[10px] font-mono text-slate-400 font-medium">
                            {categoryLabel}
                          </span>
                        </div>

                        {/* Tier 2: Title & Human Summary */}
                        <div>
                          <h4 className="text-sm sm:text-[15px] font-bold text-gov-navy tracking-tight">
                            {title}
                          </h4>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{cleanSummary}</p>
                        </div>

                        {/* Tier 3: Value, Defect, or Inspector Override Box */}
                        {v.ignored ? (
                          <div className="rounded-lg bg-emerald-50/90 border border-emerald-300/90 p-2.5 space-y-1.5 animate-fade-in">
                            <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                              <span className="flex items-center gap-1">
                                <ShieldCheck size={12} className="text-emerald-700" />
                                <span>Cleared by Inspector Discretion:</span>
                              </span>
                              <span className="text-[9.5px] font-mono text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded font-bold">
                                {v.overridden_by ? `Officer: ${v.overridden_by}` : "Override Approved"}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-emerald-950">
                              {v.override_reason || "Physical label verified directly by Inspector."}
                            </div>
                            <div className="text-[11px] text-slate-500 pt-0.5 border-t border-emerald-200/60">
                              <span className="font-medium">Original finding:</span> {v.description}
                            </div>
                            <div className="pt-1 flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => handleToggleIgnore(v)}
                                disabled={overridingId === v.id}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-rose-700 transition-colors"
                                title="Re-activate this defect"
                              >
                                <RotateCcw size={11} />
                                <span>Revert Override</span>
                              </button>
                            </div>
                          </div>
                        ) : v.passed && detectedValue ? (
                          <div className="rounded-lg bg-emerald-50/80 border border-emerald-200/90 p-2.5 space-y-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                              <span>Verified Packaging Value:</span>
                              {v.detection_method && v.detection_method !== "none" && (
                                <DetectionMethodTag method={v.detection_method} />
                              )}
                            </div>
                            <div className="text-xs font-semibold text-emerald-950 font-mono break-all sm:break-words">
                              {detectedValue}
                            </div>
                          </div>
                        ) : !v.passed ? (
                          <div className="space-y-2">
                            <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 space-y-1">
                              <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] font-bold uppercase tracking-wider text-rose-800">
                                <span>Defect Identified:</span>
                                <span className="font-mono text-[9.5px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold">
                                  Sec. 36 Liability
                                </span>
                              </div>
                              <div className="text-xs font-medium text-rose-950 leading-relaxed">
                                {v.description}
                              </div>
                            </div>

                            {/* Inspector Ignore / Override Action Bar */}
                            {activeOverridePromptId !== v.id ? (
                              <div className="flex items-center justify-between gap-2 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveOverridePromptId(v.id);
                                    setOverrideReasonInput("Physical packaging inspected and verified directly by inspector.");
                                  }}
                                  disabled={overridingId === v.id}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
                                >
                                  <EyeOff size={13} className="text-amber-700" />
                                  <span>Ignore Defect (Mark Compliant)</span>
                                </button>
                                <span className="text-[10px] text-slate-400 italic">Inspector discretion</span>
                              </div>
                            ) : (
                              <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 space-y-2.5 animate-fade-in text-xs shadow-xs">
                                <div className="flex items-center justify-between font-bold text-amber-950 text-xs">
                                  <span className="flex items-center gap-1.5">
                                    <ShieldCheck size={14} className="text-amber-700" />
                                    <span>Inspector Clearance Justification</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveOverridePromptId(null)}
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>

                                <p className="text-[11px] text-amber-900 leading-snug">
                                  Select a standard statutory justification or enter remarks to mark this declaration compliant:
                                </p>

                                <div className="flex flex-wrap gap-1.5">
                                  {[
                                    "Physical label verified directly by Inspector.",
                                    "Declaration present on outer packaging / carton.",
                                    "Exempt under PCR, 2011 Rule 26 provisions.",
                                    "Manufacturer declaration & invoice verified.",
                                  ].map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() => setOverrideReasonInput(preset)}
                                      className={`rounded-md px-2 py-1 text-[10px] font-medium border text-left transition-colors ${
                                        overrideReasonInput === preset
                                          ? "bg-amber-200/90 border-amber-400 text-amber-950 font-bold"
                                          : "bg-white border-amber-200 text-amber-800 hover:bg-amber-100/60"
                                      }`}
                                    >
                                      {preset}
                                    </button>
                                  ))}
                                </div>

                                <input
                                  type="text"
                                  value={overrideReasonInput}
                                  onChange={(e) => setOverrideReasonInput(e.target.value)}
                                  placeholder="Enter official justification..."
                                  className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-amber-500"
                                />

                                <div className="flex items-center justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setActiveOverridePromptId(null)}
                                    className="rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200/60"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleIgnore(v, overrideReasonInput)}
                                    disabled={overridingId === v.id}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1 text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                                  >
                                    {overridingId === v.id ? (
                                      <Loader2 size={13} className="animate-spin text-white" />
                                    ) : (
                                      <Check size={13} strokeWidth={2.5} />
                                    )}
                                    <span>Confirm &amp; Clear Defect</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}

                        {/* Tier 4: Collapsible Legal Regulation Citation */}
                        <div className="pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => toggleCitation(v.id)}
                            className="w-full flex items-center justify-between text-[11px] text-slate-500 hover:text-gov-navy font-medium transition-colors py-0.5"
                          >
                            <span className="flex items-center gap-1.5">
                              <Info size={12} className="text-gov-saffron-dark shrink-0" />
                              <span>Statutory Legal Reference</span>
                            </span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-[11px] space-y-1 font-mono break-words">
                              <div className="font-semibold text-gov-navy leading-snug">
                                {v.regulation}
                              </div>
                              <div className="text-slate-500 text-[10px]">
                                Rule Code: {v.rule_reference} | Severity: {v.severity.toUpperCase()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
