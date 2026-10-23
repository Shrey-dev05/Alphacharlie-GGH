"use client";

import React, { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  Loader2,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  ShieldCheck,
  FileText,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Info,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/ui";
import { CameraCaptureModal } from "@/components/CameraCaptureModal";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/**
 * Optimizes packaging images before upload to ensure fast transfer,
 * eliminate mobile socket timeouts, and maintain sharp text for OCR inspection.
 */
async function optimizeImageForUpload(file: File): Promise<File> {
  if (file.size <= 1.5 * 1024 * 1024 && !file.type.includes("heic")) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 2048;
      let { width, height } = img;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(file);

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file);
          const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
          resolve(new File([blob], cleanName, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.88
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export default function UploadPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileDetails, setFileDetails] = useState<{ name: string; size: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [productName, setProductName] = useState("");
  const [state, setState] = useState(user?.state ?? "");
  const [isFoodProduct, setIsFoodProduct] = useState(false);
  const [isPlasticPackaging, setIsPlasticPackaging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Auto-trigger camera if opened with ?camera=1 or ?camera=true
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("camera") === "1" || params.get("camera") === "true") {
        setIsCameraOpen(true);
      }
    }
  }, []);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    const sizeMb = (f.size / (1024 * 1024)).toFixed(2);
    setFileDetails({ name: f.name, size: `${sizeMb} MB` });
    setError(null);
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFile(dropped);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select or capture a packaging image first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSubmissionStep("Optimizing image resolution for mobile & optical inspection...");

    try {
      const uploadFile = await optimizeImageForUpload(file);
      setSubmissionStep("Preprocessing artwork & extracting high-res regions...");

      const form = new FormData();
      form.append("file", uploadFile);
      if (brandName) form.append("brand_name", brandName);
      if (productName) form.append("product_name", productName);
      if (state) form.append("state", state);
      form.append("source", "upload");
      form.append("is_food_product", String(isFoodProduct));
      form.append("is_plastic_packaging", String(isPlasticPackaging));

      // Visual progress feedback
      const timer = setTimeout(() => {
        setSubmissionStep("Executing Paramarsh Multimodal Vision + Multi-Pass OCR Ensemble...");
      }, 1800);

      const result = await api.createScan(form);
      clearTimeout(timer);
      setSubmissionStep("Validating Legal Metrology (PC) Rules & generating certificate...");
      router.push(`/results/${result.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Packaging scan failed. Please verify the image and try again.");
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header Title Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-gov">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-xs hidden sm:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/label-ai-logo.png" alt="Label AI Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span className="h-2 w-2 rounded-full bg-gov-saffron" />
                <span>Label AI • Statutory Verification Portal • Rule 6 Inspection</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gov-navy mt-1 tracking-tight">
                New Packaging Compliance Scan
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Upload or photograph the Principal Display Panel (PDP) of any pre-packaged commodity. The Multimodal Vision
                ensemble extracts mandatory declarations (MRP, Net Quantity, Mfg Date, Expiry, Manufacturer Address, FSSAI)
                and performs automatic statutory validation.
              </p>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
            <div className="rounded-md bg-slate-50 border border-slate-200 p-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gov-navy block">1. Upload</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">PDP Image</span>
            </div>
            <div className="rounded-md bg-slate-50 border border-slate-200 p-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gov-navy block">2. Classify</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">Food / Plastic</span>
            </div>
            <div className="rounded-md bg-slate-50 border border-slate-200 p-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gov-navy block">3. AI Audit</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">Rule 6 Report</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Packaging Image Upload Dropzone */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-gov">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gov-navy">
                Packaging Image / Artwork
              </h3>
              <span className="text-[11px] text-slate-500">Supports JPEG, PNG, WEBP</span>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 sm:p-8 text-center transition-all ${
                dragActive
                  ? "border-gov-saffron bg-amber-50/50 scale-[1.005]"
                  : "border-slate-300 bg-slate-50/60 hover:border-gov-navy hover:bg-slate-50"
              }`}
            >
              {/* Hidden file inputs */}
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              {previewUrl ? (
                <div className="space-y-4 w-full flex flex-col items-center relative">
                  <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm max-h-80 w-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Selected packaging"
                      className="max-h-72 object-contain"
                    />
                    {submitting && (
                      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-gov-saffron to-transparent animate-scan-laser pointer-events-none shadow-md" />
                    )}
                  </div>

                  {fileDetails && (
                    <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600">
                      <span className="font-medium text-gov-navy">{fileDetails.name}</span>
                      <span>•</span>
                      <span className="font-mono text-slate-400">{fileDetails.size}</span>
                      <div className="flex items-center gap-2 ml-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsCameraOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gov-navy px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-gov-navy-light transition-colors shadow-2xs"
                        >
                          <Camera size={12} className="text-gov-saffron" /> Retake Photo
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            inputRef.current?.click();
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-300 transition-colors"
                        >
                          <RefreshCw size={11} /> Change File
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4" onClick={() => inputRef.current?.click()}>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gov-navy-light/10 text-gov-navy border border-gov-navy/15">
                    <UploadCloud size={28} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gov-navy">
                      Drag &amp; drop packaging image here, or capture with camera
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Ensure the Principal Display Panel (PDP) declarations are clear and legible
                    </p>
                  </div>

                  {/* Camera & Upload Buttons */}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCameraOpen(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-gov-navy px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-gov-navy-light transition-all hover:scale-[1.02] active:scale-100"
                    >
                      <Camera size={16} className="text-gov-saffron" />
                      <span>Take Photo with Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        inputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                    >
                      <ImageIcon size={16} className="text-slate-500" />
                      <span>Upload from Device</span>
                    </button>
                  </div>

                  {/* Subtitle feature badge */}
                  <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 pt-1">
                    <Sparkles size={12} className="text-gov-saffron" />
                    <span>Works directly on laptop webcams &amp; mobile front/rear cameras</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Optional Scan Metadata & Classification */}
          <Panel
            title="Commodity Classification & Optional Overrides"
            subtitle="The AI vision model will automatically detect Brand & Product names if left blank"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Brand Name (Optional)
                </label>
                <input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Auto-detected from label if blank"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm outline-none transition-colors focus:border-gov-navy focus:ring-1 focus:ring-gov-navy"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Product / Commodity Name (Optional)
                </label>
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Auto-detected from label if blank"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm outline-none transition-colors focus:border-gov-navy focus:ring-1 focus:ring-gov-navy"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Jurisdiction / State of Audit
                </label>
                <input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Maharashtra, Delhi, Karnataka"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm outline-none transition-colors focus:border-gov-navy focus:ring-1 focus:ring-gov-navy"
                />
              </div>

              {/* Special Category Checkboxes */}
              <div className="sm:col-span-2 space-y-3 pt-3 border-t border-slate-100">
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 hover:bg-slate-50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFoodProduct}
                    onChange={(e) => setIsFoodProduct(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gov-navy focus:ring-gov-saffron accent-gov-navy"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-gov-navy block">
                      Pre-Packaged Food Product (Apply FSSAI Labelling Rules)
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5 leading-snug">
                      Enforces FSSAI 14-digit license verification, Veg/Non-Veg logo check, nutritional facts panel, and dual mfg/expiry date requirements under FSS (Labelling and Display) Regulations, 2020.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 hover:bg-slate-50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPlasticPackaging}
                    onChange={(e) => setIsPlasticPackaging(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gov-navy focus:ring-gov-saffron accent-gov-navy"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-gov-navy block">
                      Plastic Packaging Material (Apply EPR / PWM Rules)
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5 leading-snug">
                      Checks for mandatory thickness declaration (&ge;50/120 microns), Extended Producer Responsibility (EPR) registration number, and plastic resin identification code under Plastic Waste Management Rules.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </Panel>

          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs sm:text-sm font-medium text-rose-900 shadow-2xs">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={!file || submitting}
            className="w-full rounded-xl bg-gov-navy hover:bg-gov-navy-light text-white py-3.5 px-6 font-semibold text-sm sm:text-base shadow-gov-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none flex flex-col items-center justify-center gap-1"
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin text-gov-saffron" />
                <span>Processing Label Compliance Audit...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-gov-saffron" />
                <span>Execute Statutory AI Compliance Scan</span>
              </div>
            )}
            {submitting && submissionStep && (
              <span className="text-[11px] text-slate-300 font-mono font-normal">
                {submissionStep}
              </span>
            )}
          </button>
        </form>
      </div>

      {/* Direct Optical Camera Scanner Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleFile}
      />
    </AppShell>
  );
}
