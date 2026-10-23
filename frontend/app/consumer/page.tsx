"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  HeartPulse,
  Scale,
  Sparkles,
  HelpCircle,
  Award,
  ChevronRight,
  Activity,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  BookOpen,
  Apple,
  Baby,
  Flame,
  Droplet,
  Layers,
  Camera,
  Upload,
  Image as ImageIcon,
  Zap,
  FileText,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/ui";
import { api } from "@/lib/api";
import type {
  IngredientQualityReport,
  MultiProductComparisonResult,
  ScanListItem,
} from "@/lib/types";

// Preset samples for fast demonstration
const SAMPLE_PRODUCTS = [
  {
    name: "Carbonated Orange Soda",
    brand: "FizzMax",
    ingredients:
      "Carbonated Water, Sugar, Acidity Regulator (INS 330), Preservative (INS 211), Synthetic Food Colour (INS 110, INS 102), Artificial Flavouring Substances (Orange), Antioxidant (INS 300)",
  },
  {
    name: "Commercial Packaged Biscuits",
    brand: "CrunchyBites",
    ingredients:
      "Refined Wheat Flour (Maida 42%), Sugar, Refined Palm Oil, Invert Sugar Syrup, Raising Agents (INS 503(ii), INS 500(ii)), Emulsifiers (INS 322, INS 471), Artificial Vanilla Flavour, Preservative (INS 223)",
  },
  {
    name: "Cold-Pressed Alphonso Mango Juice",
    brand: "Pramaan Organics",
    ingredients:
      "Water, Alphonso Mango Pulp (50%), Raw Honey, Lemon Juice, Cardamom, Turmeric Extract",
  },
  {
    name: "Instant Masala Noodles",
    brand: "QuickMeal",
    ingredients:
      "Refined Wheat Flour (Maida), Palm Oil, Iodised Salt, Wheat Gluten, Thickeners (INS 508, INS 412), Acidity Regulators (INS 501(i), INS 500(i)), Flavor Enhancer (INS 621, INS 627, INS 631), Caramel Color (INS 150d), Preservative (INS 320)",
  },
  {
    name: "100% Whole Wheat Multi-Millet Atta",
    brand: "Shree Ann Dhanya",
    ingredients:
      "Whole Wheat (Atta 70%), Finger Millet (Ragi 10%), Sorghum (Jowar 10%), Pearl Millet (Bajra 5%), Foxtail Millet (5%)",
  },
];

const HEALTH_CONDITION_TAGS = [
  { key: "asthma", label: "Asthma & Respiratory", icon: Flame },
  { key: "children_adhd", label: "Children & ADHD", icon: Baby },
  { key: "hypertension", label: "Hypertension / High BP", icon: HeartPulse },
  { key: "diabetes", label: "Diabetes & Blood Sugar", icon: Droplet },
  { key: "kidney", label: "Chronic Kidney Disease", icon: Activity },
  { key: "celiac_gluten", label: "Celiac / Gluten Allergy", icon: ShieldAlert },
  { key: "gut_health", label: "Gut Health & IBS / IBD", icon: Layers },
  { key: "pregnancy", label: "Pregnancy & Lactation", icon: HeartPulse },
  { key: "dairy_lactose", label: "Lactose Intolerance", icon: Apple },
];

function ConsumerDashboardContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "compare" ? "compare" : "inspect";

  const [activeTab, setActiveTab] = useState<"inspect" | "compare">(initialTab);

  // --- Single Product Inspector State ---
  const [productName, setProductName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<IngredientQualityReport | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<string>("asthma");
  const [scansList, setScansList] = useState<ScanListItem[]>([]);
  const [selectedScanId, setSelectedScanId] = useState("");

  // --- Label Camera & Image Upload State ---
  const [isScanningImage, setIsScanningImage] = useState(false);
  const [imageScanNotice, setImageScanNotice] = useState<string | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);

  // Compare file upload refs
  const compareFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const compareCameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const [compareTargetIdx, setCompareTargetIdx] = useState<number | null>(null);

  // --- Comparison State ---
  const [compareItems, setCompareItems] = useState<Array<{ id: string; name: string; brand: string; ingredients: string }>>([
    {
      id: "prod_1",
      name: SAMPLE_PRODUCTS[0].name,
      brand: SAMPLE_PRODUCTS[0].brand,
      ingredients: SAMPLE_PRODUCTS[0].ingredients,
    },
    {
      id: "prod_2",
      name: SAMPLE_PRODUCTS[2].name,
      brand: SAMPLE_PRODUCTS[2].brand,
      ingredients: SAMPLE_PRODUCTS[2].ingredients,
    },
  ]);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<MultiProductComparisonResult | null>(null);

  // Load existing scans on mount
  useEffect(() => {
    api
      .listScans({ limit: "15" })
      .then((scans) => setScansList(scans))
      .catch(() => {});
  }, []);

  // Quick load from scan picker
  async function handleLoadFromScan(scanId: string) {
    if (!scanId) return;
    setSelectedScanId(scanId);
    setIsAnalyzing(true);
    try {
      const res = await api.getScanIngredients(scanId);
      setReport(res);
      setIngredientsText(res.raw_ingredients_text);
      const matched = scansList.find((s) => s.id === scanId);
      if (matched) {
        setProductName(matched.product_name || "Scanned Product");
        setBrandName(matched.brand_name || "");
      }
    } catch {
      // Fallback: load scan details and let user edit
      api.getScan(scanId).then((s) => {
        setProductName(s.product_name || "");
        setBrandName(s.brand_name || "");
        const fallbackText = s.extracted_declarations?.ingredients || s.extracted_text || "";
        setIngredientsText(fallbackText);
        if (fallbackText) {
          api.analyzeIngredients({ ingredients_text: fallbackText, product_name: s.product_name || undefined }).then(setReport);
        }
      });
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Handle label image / camera photo upload
  async function handleLabelImageUpload(file: File) {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setUploadedImagePreview(previewUrl);
    setIsScanningImage(true);
    setImageScanNotice(null);

    try {
      const res = await api.scanConsumerLabel(file, productName || undefined);
      setIngredientsText(res.extracted_ingredients);
      if (res.product_name) setProductName(res.product_name);
      if (res.brand_name) setBrandName(res.brand_name);
      setReport(res.report);
      setImageScanNotice(
        `✨ Extracted via ${res.method}! Calculated Quality Score: ${res.report.quality_score}/100 (Grade ${res.report.quality_grade})`
      );
    } catch (err: any) {
      alert(err.message || "Failed to extract ingredients from label photo.");
    } finally {
      setIsScanningImage(false);
    }
  }

  // Handle comparison label photo upload
  async function handleCompareLabelUpload(file: File, index: number) {
    if (!file) return;
    setIsComparing(true);
    try {
      const res = await api.scanConsumerLabel(file);
      setCompareItems((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          name: res.product_name || updated[index].name || `Scanned Product ${index + 1}`,
          brand: res.brand_name || updated[index].brand || "",
          ingredients: res.extracted_ingredients,
        };
        return updated;
      });
      alert(`✨ Extracted ingredients for Product ${index + 1} from packaging image!`);
    } catch (err: any) {
      alert(err.message || "Failed to scan packaging photo for comparison.");
    } finally {
      setIsComparing(false);
    }
  }

  // Handle single inspection
  async function handleAnalyze() {
    if (!ingredientsText.trim()) return;
    setIsAnalyzing(true);
    try {
      const res = await api.analyzeIngredients({
        ingredients_text: ingredientsText,
        product_name: productName || undefined,
        brand_name: brandName || undefined,
      });
      setReport(res);
    } catch (e: any) {
      alert(e.message || "Failed to analyze ingredients.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Handle multi-product comparison
  async function handleRunComparison() {
    if (compareItems.length < 2) {
      alert("Please provide at least 2 products to compare.");
      return;
    }
    setIsComparing(true);
    try {
      const payload = compareItems.map((item, idx) => ({
        id: item.id || `prod_${idx + 1}`,
        product_name: item.name || `Product ${idx + 1}`,
        brand_name: item.brand || undefined,
        ingredients: item.ingredients || "",
      }));
      const res = await api.compareProducts(payload);
      setComparisonResult(res);
    } catch (e: any) {
      alert(e.message || "Comparison failed. Please verify the ingredients.");
    } finally {
      setIsComparing(false);
    }
  }

  // Helpers for Grade Colors
  function getGradeBadge(grade: string) {
    switch (grade) {
      case "A":
        return { bg: "bg-emerald-500", text: "text-emerald-50", border: "border-emerald-600", label: "Grade A: Pure / Wholesome" };
      case "B":
        return { bg: "bg-teal-500", text: "text-teal-50", border: "border-teal-600", label: "Grade B: Generally Safe" };
      case "C":
        return { bg: "bg-amber-500", text: "text-amber-50", border: "border-amber-600", label: "Grade C: Moderate Caution" };
      case "D":
        return { bg: "bg-orange-500", text: "text-orange-50", border: "border-orange-600", label: "Grade D: Heavily Processed" };
      default:
        return { bg: "bg-rose-500", text: "text-rose-50", border: "border-rose-600", label: "Grade E: High Chemical Load" };
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Header Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-gov relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-sm hidden sm:flex">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/label-ai-logo.png" alt="Label AI Logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-xs font-semibold text-emerald-800">
                  <HeartPulse size={13} className="text-emerald-600" />
                  <span>Label AI • Consumer Health &amp; Safety Intelligence</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gov-navy mt-1.5 tracking-tight">
                  Consumer Ingredient &amp; Health Intelligence Hub
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
                  Inspect product ingredients for synthetic chemicals, hidden preservatives (INS codes), and coal-tar dyes.
                  Assess condition-specific side effects for family health, and compare competing products side-by-side to know
                  which one is better to consume.
                </p>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 self-stretch sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("inspect")}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
                  activeTab === "inspect"
                    ? "bg-white text-gov-navy shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-gov-navy"
                }`}
              >
                <Activity size={16} className={activeTab === "inspect" ? "text-emerald-600" : "text-slate-400"} />
                <span>Ingredient Inspector</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("compare")}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
                  activeTab === "compare"
                    ? "bg-white text-gov-navy shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-gov-navy"
                }`}
              >
                <Scale size={16} className={activeTab === "compare" ? "text-gov-saffron" : "text-slate-400"} />
                <span>Product Comparison</span>
                <span className="rounded-full bg-amber-100 text-amber-900 text-[10px] px-1.5 py-0.2 font-bold">VS</span>
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            TAB 1: SINGLE PRODUCT INGREDIENT & CHEMICAL INSPECTOR
           ========================================================================= */}
        {activeTab === "inspect" && (
          <div className="space-y-6">
            {/* Input Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-gov space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-gov-navy flex items-center gap-2">
                  <Search size={18} className="text-emerald-600" />
                  <span>Inspect Packaging Ingredients</span>
                </h2>

                {/* Scan Selector (if scans exist) */}
                {scansList.length > 0 && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Load from Scan:</span>
                    <select
                      value={selectedScanId}
                      onChange={(e) => handleLoadFromScan(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 focus:border-gov-navy focus:bg-white focus:outline-none"
                    >
                      <option value="">Select a previous scan...</option>
                      {scansList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.product_name || s.brand_name || "Scan"} ({new Date(s.created_at).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Photo & Label Upload Dropzone */}
              <div className="rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-4 transition-all">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLabelImageUpload(f);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLabelImageUpload(f);
                    e.target.value = "";
                  }}
                />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {uploadedImagePreview ? (
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-emerald-300 bg-white shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={uploadedImagePreview} alt="Label preview" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <Camera size={24} />
                      </div>
                    )}
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-gov-navy">
                        Auto-Extract Ingredients from Photo / Label
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Take a photo of the packaging label or upload an image — Paramarsh Multimodal Vision &amp; OCR will parse the ingredients and assess health risks automatically.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isScanningImage}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                    >
                      <Camera size={14} />
                      <span>Take Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isScanningImage}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
                    >
                      <Upload size={14} className="text-slate-500" />
                      <span>Upload Image</span>
                    </button>
                  </div>
                </div>

                {/* Active Scanning Indicator */}
                {isScanningImage && (
                  <div className="mt-3 rounded-lg bg-white border border-emerald-200 p-2.5 flex items-center gap-2.5 shadow-2xs animate-pulse">
                    <RefreshCw size={14} className="animate-spin text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-900">
                      Extracting ingredients using Paramarsh Multimodal Vision &amp; High-Recall OCR...
                    </span>
                  </div>
                )}

                {/* Extraction Success Banner */}
                {imageScanNotice && !isScanningImage && (
                  <div className="mt-3 rounded-lg bg-emerald-100/80 border border-emerald-300 p-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-900 animate-fadeIn">
                    <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
                    <span>{imageScanNotice}</span>
                  </div>
                )}
              </div>

              {/* Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name (Optional)</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Orange Carbonated Beverage"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-gov-navy focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name (Optional)</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. FizzMax"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-gov-navy focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ingredients List (paste text from packaging label or type manually)
                </label>
                <textarea
                  rows={3}
                  value={ingredientsText}
                  onChange={(e) => setIngredientsText(e.target.value)}
                  placeholder="e.g. Water, Sugar, Mango Pulp, Preservative (INS 211), Synthetic Food Colour (INS 110), Acidity Regulator (INS 330)..."
                  className="w-full rounded-lg border border-slate-300 p-3 text-xs sm:text-sm font-mono text-slate-800 placeholder-slate-400 focus:border-gov-navy focus:outline-none"
                />
              </div>

              {/* Quick Preset Demonstrators */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-500 mr-1">Sample Presets:</span>
                {SAMPLE_PRODUCTS.map((sp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setProductName(sp.name);
                      setBrandName(sp.brand);
                      setIngredientsText(sp.ingredients);
                    }}
                    className="rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors"
                  >
                    {sp.name}
                  </button>
                ))}
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !ingredientsText.trim()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gov-navy hover:bg-gov-navy-light text-white font-bold text-xs sm:text-sm px-6 py-2.5 shadow-md transition-all disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin text-gov-saffron" />
                      <span>Analyzing Chemicals &amp; Health Hazards...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} className="text-gov-saffron" />
                      <span>Analyze Ingredients &amp; Chemical Hazards</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Results Presentation */}
            {report && (
              <div className="space-y-6">
                {/* 1. Quality Rating Overview Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Quality Score Gauge Card */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-gov flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Quality Rating</span>
                        <span className={`rounded-lg px-2.5 py-0.5 text-xs font-extrabold border ${getGradeBadge(report.quality_grade).bg} ${getGradeBadge(report.quality_grade).text} ${getGradeBadge(report.quality_grade).border}`}>
                          {getGradeBadge(report.quality_grade).label}
                        </span>
                      </div>

                      <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-5xl font-black text-gov-navy tracking-tight">{report.quality_score}</span>
                        <span className="text-slate-400 font-bold text-lg">/ 100</span>
                      </div>

                      <p className="text-xs font-bold text-slate-700 mt-2 flex items-center gap-1.5">
                        <Layers size={14} className="text-gov-navy" />
                        <span>{report.cleanliness_tier}</span>
                      </p>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-5 space-y-1.5 border-t border-slate-100 pt-3">
                      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            report.quality_score >= 80
                              ? "bg-emerald-500"
                              : report.quality_score >= 60
                              ? "bg-teal-500"
                              : report.quality_score >= 40
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          }`}
                          style={{ width: `${report.quality_score}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>0 (Hazardous)</span>
                        <span>50 (Moderate)</span>
                        <span>100 (Pure/Clean)</span>
                      </div>
                    </div>
                  </div>

                  {/* Chemical & Additive Load Metric Card */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-gov flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Additive &amp; Preservative Load</span>
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-center">
                          <span className="text-2xl font-black text-rose-600 block">{report.preservatives_count}</span>
                          <span className="text-[11px] font-semibold text-slate-600">Preservatives</span>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-center">
                          <span className="text-2xl font-black text-amber-600 block">{report.artificial_colors_count}</span>
                          <span className="text-[11px] font-semibold text-slate-600">Artificial Dyes</span>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-center">
                          <span className="text-2xl font-black text-purple-600 block">{report.artificial_sweeteners_count}</span>
                          <span className="text-[11px] font-semibold text-slate-600">Sweeteners</span>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-center">
                          <span className="text-2xl font-black text-emerald-600 block">{report.wholesome_ingredients_count}</span>
                          <span className="text-[11px] font-semibold text-slate-600">Wholesome</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-3 mt-3 flex items-center justify-between">
                      <span>Total Declared Ingredients:</span>
                      <span className="font-bold text-slate-800">{report.total_ingredients_count} items</span>
                    </div>
                  </div>

                  {/* Summary Verdict Callout */}
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6 shadow-gov flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Regulatory &amp; Health Verdict</span>
                      <p className="text-xs sm:text-sm text-slate-700 mt-3 leading-relaxed">
                        {report.summary_verdict}
                      </p>
                    </div>

                    <div className="border-t border-slate-200 pt-3 mt-4 flex items-center gap-2 text-xs text-slate-500">
                      <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                      <span>Evaluated against Legal Metrology &amp; FSSAI Safety Standards</span>
                    </div>
                  </div>
                </div>

                {/* 2. Detected Chemicals & Preservatives Deep Dive */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-gov">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <div>
                      <h3 className="text-base font-bold text-gov-navy flex items-center gap-2">
                        <AlertTriangle size={18} className="text-amber-500" />
                        <span>Identified Chemicals, Preservatives &amp; Synthetic Additives</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Detailed breakdown of industrial compounds, international INS codes, and verified clinical hazards.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {report.detected_chemicals.length} Detected
                    </span>
                  </div>

                  {report.detected_chemicals.length === 0 ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center text-emerald-800 text-xs sm:text-sm font-semibold">
                      ✓ Clean formulation! No synthetic chemical preservatives, artificial azo dyes, or harmful additives were detected in this product.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {report.detected_chemicals.map((chem, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all"
                        >
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-gov-navy">{chem.name}</span>
                              <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-mono font-bold text-slate-800">
                                {chem.code}
                              </span>
                              <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                                {chem.category}
                              </span>
                            </div>

                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                                chem.severity === "high"
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : chem.severity === "moderate"
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                            >
                              {chem.severity} Risk
                            </span>
                          </div>

                          <div className="mt-2.5 text-xs space-y-1">
                            <p className="text-slate-600">
                              <span className="font-semibold text-slate-800">Purpose in Product: </span>
                              {chem.purpose}
                            </p>
                            <p className="text-rose-900 font-medium">
                              <span className="font-semibold text-rose-800">Health Impact &amp; Side Effects: </span>
                              {chem.health_risks}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Personalized Health Condition Risk Matrix */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-gov space-y-5">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-gov-navy flex items-center gap-2">
                      <HeartPulse size={18} className="text-rose-500" />
                      <span>Consumer Health Condition Risk Analyzer</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select specific health profiles or family medical conditions to evaluate customized side effect warnings.
                    </p>
                  </div>

                  {/* Condition Selector Pills */}
                  <div className="flex flex-wrap gap-2">
                    {HEALTH_CONDITION_TAGS.map((tag) => {
                      const Icon = tag.icon;
                      const isSelected = selectedCondition === tag.key;
                      const assessment = report.condition_assessments[tag.key];
                      const isHighRisk = assessment?.status === "high_risk";
                      const isCaution = assessment?.status === "caution";

                      return (
                        <button
                          key={tag.key}
                          type="button"
                          onClick={() => setSelectedCondition(tag.key)}
                          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all border ${
                            isSelected
                              ? "bg-gov-navy text-white border-gov-navy shadow-sm"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          <Icon size={14} className={isSelected ? "text-gov-saffron" : "text-slate-500"} />
                          <span>{tag.label}</span>
                          {isHighRisk && (
                            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" title="High Risk detected" />
                          )}
                          {isCaution && !isHighRisk && (
                            <span className="h-2 w-2 rounded-full bg-amber-400" title="Caution advised" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Condition Detailed Card */}
                  {selectedCondition && report.condition_assessments[selectedCondition] && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gov-navy">
                            {report.condition_assessments[selectedCondition].condition_name}
                          </span>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                            report.condition_assessments[selectedCondition].status === "high_risk"
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : report.condition_assessments[selectedCondition].status === "caution"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          }`}
                        >
                          {report.condition_assessments[selectedCondition].status === "high_risk"
                            ? "⚠️ High Risk / Contraindicated"
                            : report.condition_assessments[selectedCondition].status === "caution"
                            ? "⚡ Caution Advised"
                            : "✓ Generally Safe"}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-700">
                        {report.condition_assessments[selectedCondition].reasons.map((r, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-slate-400 font-bold">•</span>
                            <span className="leading-relaxed">{r}</span>
                          </div>
                        ))}
                      </div>

                      {report.condition_assessments[selectedCondition].offending_chemicals.length > 0 && (
                        <div className="pt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700">Flagged Ingredients:</span>
                          {report.condition_assessments[selectedCondition].offending_chemicals.map((chem, idx) => (
                            <span key={idx} className="rounded bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 font-bold">
                              {chem}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2: MULTI-PRODUCT COMPARISON ("WHICH IS BETTER?")
           ========================================================================= */}
        {activeTab === "compare" && (
          <div className="space-y-6">
            {/* Multi-Product Builder Box */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-gov space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-gov-navy flex items-center gap-2">
                    <Scale size={18} className="text-gov-saffron" />
                    <span>Product Comparison Studio (Which One is Better to Consume?)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Compare 2 or more competing packaging labels. Our AI evaluates ingredients, chemical additives, and safety
                    to deliver an unambiguous, evidence-backed verdict.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setCompareItems((prev) => [
                      ...prev,
                      {
                        id: `prod_${prev.length + 1}`,
                        name: `Product ${prev.length + 1}`,
                        brand: "",
                        ingredients: "",
                      },
                    ])
                  }
                  disabled={compareItems.length >= 4}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
                >
                  <Plus size={14} className="text-gov-navy" />
                  <span>Add Another Product</span>
                </button>
              </div>

              {/* Hidden inputs for compare item camera & file upload */}
              <input
                ref={compareCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && compareTargetIdx !== null) handleCompareLabelUpload(f, compareTargetIdx);
                  e.target.value = "";
                }}
              />
              <input
                ref={compareFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && compareTargetIdx !== null) handleCompareLabelUpload(f, compareTargetIdx);
                  e.target.value = "";
                }}
              />

              {/* Product Comparison Cards Input Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {compareItems.map((item, index) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 relative space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gov-navy text-white text-xs font-bold">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCompareItems((prev) =>
                              prev.map((it) => (it.id === item.id ? { ...it, name: val } : it))
                            );
                          }}
                          placeholder={`Product ${index + 1} Name`}
                          className="font-bold text-sm text-gov-navy bg-transparent border-b border-dashed border-slate-300 focus:border-gov-navy focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setCompareTargetIdx(index);
                            compareCameraInputRef.current?.click();
                          }}
                          className="inline-flex items-center gap-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold transition-all"
                          title="Snap label photo using camera"
                        >
                          <Camera size={11} className="text-emerald-600" />
                          <span>Snap</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCompareTargetIdx(index);
                            compareFileInputRef.current?.click();
                          }}
                          className="inline-flex items-center gap-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold transition-all"
                          title="Upload packaging photo"
                        >
                          <Upload size={11} className="text-slate-500" />
                          <span>Upload</span>
                        </button>

                        {compareItems.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setCompareItems((prev) => prev.filter((it) => it.id !== item.id))}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            title="Remove product"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={item.brand}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCompareItems((prev) =>
                            prev.map((it) => (it.id === item.id ? { ...it, brand: val } : it))
                          );
                        }}
                        placeholder="Brand Name (e.g. Brand X)"
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none"
                      />
                    </div>

                    <div>
                      <textarea
                        rows={3}
                        value={item.ingredients}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCompareItems((prev) =>
                            prev.map((it) => (it.id === item.id ? { ...it, ingredients: val } : it))
                          );
                        }}
                        placeholder="Paste ingredients list here..."
                        className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-xs font-mono text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Compare CTA */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleRunComparison}
                  disabled={isComparing || compareItems.some((it) => !it.ingredients.trim())}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gov-navy hover:bg-gov-navy-light text-white font-bold text-xs sm:text-sm px-6 py-2.5 shadow-md transition-all disabled:opacity-50"
                >
                  {isComparing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin text-gov-saffron" />
                      <span>Evaluating Products Side-by-Side...</span>
                    </>
                  ) : (
                    <>
                      <Scale size={16} className="text-gov-saffron" />
                      <span>Execute Multi-Product Comparison</span>
                    </>
                  )}
                </button>

                <span className="text-xs text-slate-500 hidden sm:inline">
                  Comparing {compareItems.length} products
                </span>
              </div>
            </div>

            {/* Comparison Results */}
            {comparisonResult && (
              <div className="space-y-6 animate-fade-in">
                {/* 🏆 Winner Banner */}
                <div className="rounded-2xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-6 shadow-gov">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shrink-0">
                        <Award size={28} />
                      </div>
                      <div>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 block">
                          AI Comparative Recommendation
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-emerald-950 mt-0.5">
                          {comparisonResult.winner_product_name} is Better to Consume
                        </h3>
                        <p className="text-xs sm:text-sm text-emerald-900 mt-1.5 leading-relaxed max-w-3xl">
                          {comparisonResult.verdict_explanation}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white/90 border border-emerald-200 px-4 py-2.5 text-center shrink-0">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Top Rank</span>
                      <span className="text-lg font-black text-emerald-700">Rank #1 Choice</span>
                    </div>
                  </div>
                </div>

                {/* Side-by-Side Ranked Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                  {comparisonResult.products.map((p) => {
                    const isWinner = p.product_id === comparisonResult.winner_product_id;
                    const badge = getGradeBadge(p.report.quality_grade);

                    return (
                      <div
                        key={p.product_id}
                        className={`rounded-2xl border bg-white p-5 shadow-gov relative flex flex-col justify-between ${
                          isWinner ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                  isWinner ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                #{p.rank}
                              </span>
                              <h4 className="font-extrabold text-base text-gov-navy">{p.product_name}</h4>
                            </div>

                            <span className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${badge.bg} ${badge.text}`}>
                              {p.report.quality_score}/100 ({p.report.quality_grade})
                            </span>
                          </div>

                          {p.brand_name && <p className="text-xs text-slate-500 mt-1">Brand: {p.brand_name}</p>}

                          <p className="text-xs font-semibold text-slate-700 mt-2 flex items-center gap-1.5">
                            <Layers size={13} className="text-gov-navy" />
                            <span>{p.report.cleanliness_tier}</span>
                          </p>

                          {/* Quick Stats Grid */}
                          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                              <span className="text-xs text-slate-400 block">Preservatives</span>
                              <span className="text-sm font-bold text-slate-800">{p.report.preservatives_count}</span>
                            </div>
                            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                              <span className="text-xs text-slate-400 block">Colors/Dyes</span>
                              <span className="text-sm font-bold text-slate-800">{p.report.artificial_colors_count}</span>
                            </div>
                            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                              <span className="text-xs text-slate-400 block">Sweeteners</span>
                              <span className="text-sm font-bold text-slate-800">{p.report.artificial_sweeteners_count}</span>
                            </div>
                          </div>

                          {/* Pros & Cons */}
                          <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                            {p.pros.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[11px] font-bold text-emerald-700 uppercase block">Advantages:</span>
                                {p.pros.map((pro, i) => (
                                  <div key={i} className="flex items-center gap-1.5 text-xs text-emerald-900">
                                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                    <span>{pro}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {p.cons.length > 0 && (
                              <div className="space-y-1 pt-1">
                                <span className="text-[11px] font-bold text-rose-700 uppercase block">Health Concerns:</span>
                                {p.cons.map((con, i) => (
                                  <div key={i} className="flex items-center gap-1.5 text-xs text-rose-900">
                                    <XCircle size={13} className="text-rose-600 shrink-0" />
                                    <span>{con}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Ingredients footnote */}
                        <div className="border-t border-slate-100 pt-3 mt-4 text-[11px] text-slate-500 font-mono truncate">
                          <span className="font-semibold text-slate-600">Formula: </span>
                          {p.ingredients_text}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Detailed Comparison Matrix Table */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-gov overflow-x-auto">
                  <h4 className="text-base font-bold text-gov-navy mb-4 flex items-center gap-2">
                    <BookOpen size={18} className="text-gov-navy" />
                    <span>Statutory &amp; Biochemical Feature Matrix</span>
                  </h4>

                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="py-2.5 px-4 font-bold text-slate-700">Safety Metric</th>
                        {comparisonResult.products.map((p) => (
                          <th key={p.product_id} className="py-2.5 px-4 font-bold text-gov-navy">
                            {p.product_name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comparisonResult.comparison_matrix.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-semibold text-slate-700">{row.feature}</td>
                          {comparisonResult.products.map((p) => (
                            <td key={p.product_id} className="py-2.5 px-4 text-slate-800">
                              {row[p.product_id]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function ConsumerDashboardPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="py-20 text-center text-xs text-slate-500 animate-pulse">
            Loading Consumer Health Intelligence Hub...
          </div>
        </AppShell>
      }
    >
      <ConsumerDashboardContent />
    </Suspense>
  );
}
