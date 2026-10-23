"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Download,
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  Layers,
  Palette,
  Package,
  Cpu,
  RefreshCw,
  Copy,
  ExternalLink,
  Info,
  Sliders,
  Check,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import type {
  SamadhanLabelResponse,
  SamadhanTemplate,
} from "@/lib/types";

export default function SamadhanAIPage() {
  const [templates, setTemplates] = useState<SamadhanTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  // Form Fields
  const [productName, setProductName] = useState("Alphonso Mango Nectar");
  const [brandName, setBrandName] = useState("Pramaan Organics");
  const [category, setCategory] = useState("Fruit Beverages & Juices");
  const [netQuantity, setNetQuantity] = useState("1 L");
  const [mrp, setMrp] = useState("Rs. 125.00 (incl. of all taxes)");
  const [ingredients, setIngredients] = useState(
    "Water, Alphonso Mango Pulp (40%), Cane Sugar, Acidity Regulator (INS 330), Antioxidant (INS 300), Natural Mango Flavors."
  );
  const [manufacturerAddress, setManufacturerAddress] = useState(
    "Pramaan Agro Foods Pvt. Ltd., Plot 14, MIDC Industrial Area, Ratnagiri, Maharashtra - 415612"
  );
  const [customerCare, setCustomerCare] = useState(
    "Toll-Free: 1800-222-7777, care@pramaanorganics.com"
  );
  const [fssaiLicense, setFssaiLicense] = useState("10022022000456");
  const [mfgDate, setMfgDate] = useState("11/2026");
  const [expiryDate, setExpiryDate] = useState("Best before 6 months from manufacture");
  const [isVeg, setIsVeg] = useState(true);
  const [barcode, setBarcode] = useState("8901030829141");
  const [colorPalette, setColorPalette] = useState("saffron_amber");
  const [customDesignPrompt, setCustomDesignPrompt] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [labelResult, setLabelResult] = useState<SamadhanLabelResponse | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isParsingPrompt, setIsParsingPrompt] = useState(false);
  const [autoFetchNotice, setAutoFetchNotice] = useState<string | null>(null);

  // Load templates on mount
  useEffect(() => {
    api
      .getSamadhanTemplates()
      .then((data) => {
        setTemplates(data);
        setIsLoadingTemplates(false);
      })
      .catch(() => setIsLoadingTemplates(false));
  }, []);

  function applyTemplate(t: SamadhanTemplate) {
    setProductName(t.product_name);
    setBrandName(t.brand_name);
    setCategory(t.category);
    setNetQuantity(t.net_quantity);
    setMrp(t.mrp);
    setIngredients(t.ingredients);
    setManufacturerAddress(t.manufacturer_name_address);
    setCustomerCare(t.customer_care);
    setFssaiLicense(t.fssai_license);
    setMfgDate(t.mfg_date);
    setExpiryDate(t.expiry_date);
    setIsVeg(t.is_veg);
    setBarcode(t.barcode);
    setColorPalette(t.color_palette);
  }

  async function handleAutoFetchFromPrompt() {
    if (!customDesignPrompt.trim()) {
      alert("Please enter or paste a packaging design prompt first.");
      return;
    }
    setIsParsingPrompt(true);
    try {
      const parsed = await api.parseSamadhanPrompt(customDesignPrompt);
      let count = 0;
      if (parsed.brand_name) { setBrandName(parsed.brand_name); count++; }
      if (parsed.product_name) { setProductName(parsed.product_name); count++; }
      if (parsed.category) { setCategory(parsed.category); count++; }
      if (parsed.net_quantity) { setNetQuantity(parsed.net_quantity); count++; }
      if (parsed.mrp) { setMrp(parsed.mrp); count++; }
      if (parsed.ingredients) { setIngredients(parsed.ingredients); count++; }
      if (parsed.manufacturer_name_address) { setManufacturerAddress(parsed.manufacturer_name_address); count++; }
      if (parsed.customer_care) { setCustomerCare(parsed.customer_care); count++; }
      if (parsed.fssai_license) { setFssaiLicense(parsed.fssai_license); count++; }
      if (parsed.mfg_date) { setMfgDate(parsed.mfg_date); count++; }
      if (parsed.expiry_date) { setExpiryDate(parsed.expiry_date); count++; }
      if (parsed.is_veg !== undefined) { setIsVeg(parsed.is_veg); }
      if (parsed.barcode) { setBarcode(parsed.barcode); count++; }
      if (parsed.color_palette) { setColorPalette(parsed.color_palette); }

      setAutoFetchNotice(`✨ Auto-fetched ${count} packaging declarations directly from your design prompt!`);
      setTimeout(() => setAutoFetchNotice(null), 6000);
    } catch (e: any) {
      alert(e.message || "Failed to auto-fetch specs from prompt.");
    } finally {
      setIsParsingPrompt(false);
    }
  }

  async function handleGenerateLabel() {
    setIsGenerating(true);
    try {
      const res = await api.generateSamadhanLabel({
        product_name: productName,
        brand_name: brandName,
        category,
        net_quantity: netQuantity,
        mrp,
        ingredients,
        manufacturer_name_address: manufacturerAddress,
        customer_care: customerCare,
        fssai_license: fssaiLicense,
        mfg_date: mfgDate,
        expiry_date: expiryDate,
        is_veg: isVeg,
        barcode,
        color_palette: colorPalette,
        design_prompt: customDesignPrompt.trim() || undefined,
      });
      setLabelResult(res);
    } catch (e: any) {
      alert(e.message || "Label generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCopyPrompt() {
    if (!labelResult) return;
    navigator.clipboard.writeText(labelResult.design_prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-gov relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-sm hidden sm:flex">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/label-ai-logo.png" alt="Label AI Logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-0.5 text-xs font-semibold text-blue-800">
                    <Sparkles size={13} className="text-blue-600" />
                    <span>Samadhan AI Studio (समाधान AI)</span>
                  </span>

                  {/* Model Badge */}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-3 py-0.5 text-xs font-bold text-purple-900 font-mono">
                    <Cpu size={12} className="text-purple-600" />
                    <span>Model: gemini-nano-banana-2.1</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-gov-navy mt-2 tracking-tight">
                  Statutory Packaging Label Artwork Generator
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
                  Empowering manufacturers to generate ready-to-print, photorealistic commercial packaging labels that
                  automatically satisfy every mandatory Legal Metrology (PC) Rules, 2011 and FSSAI statutory requirement.
                </p>
              </div>
            </div>

            {/* Link to Paramarsh AI for Guidance */}
            <Link
              href="/chatbot"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs self-stretch sm:self-auto text-center justify-center shrink-0"
            >
              <Info size={14} className="text-gov-saffron" />
              <span>Ask Paramarsh AI for Checklist</span>
            </Link>
          </div>

          {/* Quick-Start Compliant Templates */}
          {templates.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                Quick Category Templates:
              </span>
              <div className="flex flex-wrap gap-2">
                {templates.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-gov-navy px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all shadow-2xs"
                  >
                    ★ {tpl.category}: {tpl.product_name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Studio Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form: Manufacturer Packaging Specifications (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-gov space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-gov-navy flex items-center gap-2">
                <Sliders size={18} className="text-gov-saffron" />
                <span>Packaging Declarations &amp; Specs</span>
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">Rule 6 Verified</span>
            </div>

            {/* Design Prompt from Paramarsh AI */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>Design Prompt (Paste from Paramarsh AI or Freeform)</span>
                  <span className="text-[10px] text-purple-700 font-mono">gemini-nano-banana-2.1</span>
                </label>
                <button
                  type="button"
                  onClick={handleAutoFetchFromPrompt}
                  disabled={isParsingPrompt || !customDesignPrompt.trim()}
                  className="inline-flex items-center gap-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 text-[11px] font-bold transition-all disabled:opacity-40"
                  title="Extract declarations directly from prompt"
                >
                  <RefreshCw size={11} className={isParsingPrompt ? "animate-spin text-purple-600" : "text-purple-600"} />
                  <span>{isParsingPrompt ? "Extracting..." : "⚡ Auto-Fill Specs from Prompt"}</span>
                </button>
              </div>

              <textarea
                rows={3}
                value={customDesignPrompt}
                onChange={(e) => setCustomDesignPrompt(e.target.value)}
                placeholder="Paste the design prompt generated by Paramarsh AI here. Any fields left blank below will be automatically parsed from this prompt..."
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:border-gov-navy focus:outline-none"
              />

              {autoFetchNotice && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs font-semibold text-emerald-800 flex items-center gap-1.5 animate-fadeIn">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>{autoFetchNotice}</span>
                </div>
              )}

              <p className="text-[11px] text-slate-500 italic">
                Tip: Any declaration not explicitly specified in the form below will be fetched automatically from your prompt during label rendering.
              </p>
            </div>

            {/* Brand & Product Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name *</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-gov-navy focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name (Generic) *</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-gov-navy focus:outline-none"
                />
              </div>
            </div>

            {/* Net Quantity & MRP */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Net Quantity (Rule 6(1)(c)) *</label>
                <input
                  type="text"
                  value={netQuantity}
                  onChange={(e) => setNetQuantity(e.target.value)}
                  placeholder="e.g. 1 L, 500 g, 10 N"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-gov-navy focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">MRP (Rule 6(1)(e)) *</label>
                <input
                  type="text"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  placeholder="Rs. 120.00 (incl. of all taxes)"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-gov-navy focus:outline-none"
                />
              </div>
            </div>

            {/* Ingredients (Crucial for FSSAI) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ingredients List (In descending order of weight) *
              </label>
              <textarea
                rows={2}
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="Water, Mango Pulp (40%), Sugar, Citric Acid..."
                className="w-full rounded-md border border-slate-300 p-2 text-xs font-mono text-slate-800 focus:border-gov-navy focus:outline-none"
              />
            </div>

            {/* Manufacturer Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Manufacturer &amp; Packer Address (Rule 6(1)(a)) *
              </label>
              <input
                type="text"
                value={manufacturerAddress}
                onChange={(e) => setManufacturerAddress(e.target.value)}
                placeholder="Company Name, Plot No, Industrial Area, State, PIN"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-gov-navy focus:outline-none"
              />
            </div>

            {/* Consumer Care & FSSAI */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Consumer Care (Rule 6(1)(f))</label>
                <input
                  type="text"
                  value={customerCare}
                  onChange={(e) => setCustomerCare(e.target.value)}
                  placeholder="Toll-free / email"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-gov-navy focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">FSSAI License (14 digits)</label>
                <input
                  type="text"
                  value={fssaiLicense}
                  onChange={(e) => setFssaiLicense(e.target.value)}
                  placeholder="10022022000456"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-gov-navy focus:outline-none"
                />
              </div>
            </div>

            {/* Color Palette & Veg Symbol Toggle */}
            <div className="grid grid-cols-2 gap-3 items-center pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Color Theme</label>
                <select
                  value={colorPalette}
                  onChange={(e) => setColorPalette(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="royal_navy">Royal Navy (DCA Classic)</option>
                  <option value="saffron_amber">Saffron Amber (Warm/Beverages)</option>
                  <option value="forest_emerald">Forest Emerald (Organic/Green)</option>
                  <option value="ruby_red">Ruby Red (Snacks/Confectionery)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dietary Symbol</label>
                <div className="flex items-center gap-3 mt-1.5">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="dietary"
                      checked={isVeg}
                      onChange={() => setIsVeg(true)}
                    />
                    <span className="font-semibold text-emerald-700">Green Veg</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="dietary"
                      checked={!isVeg}
                      onChange={() => setIsVeg(false)}
                    />
                    <span className="font-semibold text-rose-700">Brown Non-Veg</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Generate Action Button */}
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleGenerateLabel}
                disabled={isGenerating || !productName || !brandName || !netQuantity}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gov-navy hover:bg-gov-navy-light text-white font-bold text-sm py-3 px-4 shadow-gov-md transition-all hover:-translate-y-0.5 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={18} className="animate-spin text-gov-saffron" />
                    <span>Rendering Label with gemini-nano-banana-2.1...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} className="text-gov-saffron" />
                    <span>Generate Compliant Label with Samadhan AI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Area: Generated Packaging Artwork & Checklist (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {labelResult ? (
              <div className="space-y-6 animate-fade-in">
                {/* Artwork Display Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-gov space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Generated Packaging Artwork
                      </span>
                      <h3 className="text-base font-extrabold text-gov-navy">
                        {labelResult.specification_summary.brand_name} {labelResult.specification_summary.product_name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-purple-100 text-purple-900 border border-purple-200 text-[11px] font-mono font-bold px-2.5 py-1">
                        {labelResult.model_used}
                      </span>
                      <a
                        href={labelResult.image_url}
                        download={`statutory_label_${labelResult.specification_summary.brand_name}.jpg`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 shadow-sm transition-all"
                      >
                        <Download size={14} />
                        <span>Download Artwork</span>
                      </a>
                    </div>
                  </div>

                  {/* High-Res Label Image Preview */}
                  <div className="relative rounded-xl border border-slate-300 bg-slate-900 overflow-hidden shadow-inner flex items-center justify-center p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={labelResult.image_url}
                      alt="Generated Packaging Label Artwork"
                      className="w-full h-auto object-contain rounded-lg shadow-md max-h-[500px]"
                    />
                  </div>

                  {/* Actions & Scan Audit Launcher */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-500">
                      Format: 1800 × 1100 px • 300 DPI Print Ready • Rule 6 Compliant
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyPrompt}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-medium"
                      >
                        {copiedPrompt ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        <span>{copiedPrompt ? "Copied" : "Copy Design Prompt"}</span>
                      </button>

                      <Link
                        href="/upload"
                        className="inline-flex items-center gap-1 rounded-md bg-gov-navy text-white px-2.5 py-1 font-bold text-xs hover:bg-gov-navy-light transition-all"
                      >
                        <span>Audit with Compliance Scan</span>
                        <ExternalLink size={12} />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Statutory Compliance Verification Checklist */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-gov space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="text-base font-bold text-gov-navy flex items-center gap-2">
                      <ShieldCheck size={18} className="text-emerald-600" />
                      <span>Statutory Pre-Print Verification Certificate</span>
                    </h4>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 text-xs font-bold">
                      100% Rules Satisfied
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {labelResult.statutory_checklist.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex items-start gap-3 text-xs"
                      >
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">{item.rule}: {item.title}</span>
                            <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              {item.status}
                            </span>
                          </div>
                          <p className="text-slate-600 mt-0.5 font-medium">Declared: {item.declaration}</p>
                          <p className="text-slate-400 text-[11px] mt-0.5">{item.notes}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Empty Placeholder State */
              <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-12 text-center shadow-sm flex flex-col items-center justify-center space-y-4 min-h-[460px]">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md text-purple-600 border border-slate-200">
                  <Cpu size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gov-navy">Packaging Artwork Canvas Awaiting Generation</h3>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                    Fill in the packaging declarations on the left or click a category preset, then press{" "}
                    <span className="font-bold text-gov-navy">"Generate Compliant Label with Samadhan AI"</span>.
                    The model <code className="font-mono text-purple-700">gemini-nano-banana-2.1</code> will render the full
                    commercial artwork.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span>Engine: Samadhan AI</span>
                  <span>•</span>
                  <span>Model: gemini-nano-banana-2.1</span>
                  <span>•</span>
                  <span>Output: 300 DPI</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
