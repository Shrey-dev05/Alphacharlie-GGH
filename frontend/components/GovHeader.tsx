"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PhoneCall, ShieldCheck, Sparkles, Smartphone, QrCode, X, Copy, Check, Camera } from "lucide-react";

export function GovHeader() {
  const [fontSizeLevel, setFontSizeLevel] = useState<"small" | "normal" | "large">("normal");
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [phoneUrl, setPhoneUrl] = useState("http://10.137.212.98:3000");
  const [qrCodeUrl, setQrCodeUrl] = useState("/qr-phone.png");

  useEffect(() => {
    // If the user is accessing via an IP or domain already, use that
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
        setPhoneUrl(`http://${hostname}:${window.location.port || "3000"}`);
      }
    }

    // Fetch dynamically detected LAN IP from backend
    fetch("/api/v1/system/network-info")
      .then((res) => res.json())
      .then((data) => {
        if (data?.url) {
          setPhoneUrl(data.url);
          setQrCodeUrl(`/api/v1/system/qr-code.png?t=${Date.now()}`);
        }
      })
      .catch(() => {
        if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
          setPhoneUrl(`http://${window.location.hostname}:${window.location.port || "3000"}`);
        }
      });
  }, [showPhoneModal]);

  useEffect(() => {
    const root = document.documentElement;
    if (fontSizeLevel === "small") {
      root.style.setProperty("--gov-font-size", "92%");
    } else if (fontSizeLevel === "large") {
      root.style.setProperty("--gov-font-size", "108%");
    } else {
      root.style.setProperty("--gov-font-size", "100%");
    }
  }, [fontSizeLevel]);

  return (
    <header className="w-full border-b border-gov-border bg-white text-ink shadow-sm">
      {/* 1. Label AI Brand Color Gradient Ribbon */}
      <div className="h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 w-full" />

      {/* 2. Top Accessibility & Utility Strip */}
      <div className="border-b border-slate-200/70 bg-slate-50 px-3 py-1 text-[11px] sm:px-6 sm:py-1.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          {/* Left: Brand Identity claim */}
          <div className="flex items-center gap-2 font-medium text-slate-700">
            <span className="font-extrabold text-blue-700 tracking-wide">Label AI Platform</span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="hidden sm:inline text-slate-600">AI Packaging Intelligence &amp; Statutory Compliance</span>
          </div>

          {/* Right: Accessibility toolbar + Helpline */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Screen Reader Skip */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:rounded focus:bg-gov-navy focus:px-2 focus:py-1 focus:text-white"
            >
              Skip to main content
            </a>

            {/* Font Sizer */}
            <div className="flex items-center gap-0.5 rounded border border-slate-300 bg-white px-1 py-0.5 shadow-2xs">
              <span className="px-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:inline">Text:</span>
              <button
                type="button"
                onClick={() => setFontSizeLevel("small")}
                title="Decrease text size"
                className={`px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
                  fontSizeLevel === "small" ? "bg-gov-navy text-white rounded-xs" : "text-slate-600 hover:text-gov-navy"
                }`}
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setFontSizeLevel("normal")}
                title="Normal text size"
                className={`px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
                  fontSizeLevel === "normal" ? "bg-gov-navy text-white rounded-xs" : "text-slate-600 hover:text-gov-navy"
                }`}
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontSizeLevel("large")}
                title="Increase text size"
                className={`px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
                  fontSizeLevel === "large" ? "bg-gov-navy text-white rounded-xs" : "text-slate-600 hover:text-gov-navy"
                }`}
              >
                A+
              </button>
            </div>

            {/* Open on Phone / QR Code Shortcut */}
            <button
              type="button"
              onClick={() => setShowPhoneModal(true)}
              className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs hover:border-gov-navy hover:text-gov-navy transition-all"
              title="Connect your mobile phone to scan labels directly with your phone camera"
            >
              <Smartphone size={12} className="text-gov-saffron" />
              <span>Use on Phone</span>
            </button>

            {/* Helpline */}
            <a
              href="tel:1915"
              className="hidden sm:flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 transition-all hover:bg-amber-100 hover:border-amber-300"
              title="National Consumer Helpline"
            >
              <PhoneCall size={12} className="text-amber-700" />
              <span>NCH: <strong className="font-bold text-amber-900">1915</strong></span>
            </a>

            {/* Security Pill */}
            <span className="hidden lg:inline-flex items-center gap-1 text-[10.5px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
              <ShieldCheck size={11} className="text-blue-600" />
              Secure AI System
            </span>
          </div>
        </div>
      </div>

      {/* 3. Label AI Masthead */}
      <div className="bg-white px-3 py-2.5 sm:px-6 sm:py-3.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          {/* Label AI Brand Mark */}
          <Link href="/dashboard" className="flex items-center gap-3 sm:gap-4 group">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white border border-slate-200/90 shadow-sm p-1 shrink-0 transition-transform group-hover:scale-105 duration-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/label-ai-logo.png"
                alt="Label AI Official Logo"
                className="h-full w-full object-contain"
              />
            </div>

            <div className="border-l border-slate-300 pl-3 sm:pl-4 py-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h1 className="text-[19px] sm:text-[22px] lg:text-[25px] font-black leading-tight tracking-tight text-slate-900 flex items-center gap-1">
                  <span>Label</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">AI</span>
                </h1>
                <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700 font-mono">
                  v4.0
                </span>
              </div>
              <div className="text-[10.5px] sm:text-[11.5px] font-bold tracking-wider text-slate-500 uppercase mt-0.5">
                Analyze • Decode • Inform
              </div>
            </div>
          </Link>

          {/* Right: AI Engine Status */}
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-800">
                Paramarsh + Samadhan
              </div>
              <div className="text-[10px] text-slate-500">
                Statutory Vision Ensemble
              </div>
            </div>
            <div className="h-8 w-8 rounded-full border border-purple-200 bg-purple-50 flex items-center justify-center text-purple-700 shadow-2xs">
              <Sparkles size={16} />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Open on Mobile Phone QR Modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative flex flex-col w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-gov-navy px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-gov-saffron" />
                <span className="text-sm font-bold tracking-tight">Open on Mobile Phone</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPhoneModal(false)}
                className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 text-center space-y-4">
              <div className="inline-block p-2 bg-slate-50 border border-slate-200 rounded-xl shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCodeUrl}
                  alt="Scan QR Code to open Label AI on phone"
                  className="h-44 w-44 object-contain mx-auto"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-gov-navy">
                  1. Connect phone to the same Wi-Fi
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  2. Scan QR code or visit this address in phone browser:
                </p>
              </div>

              {/* URL Pill with Copy Button */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <span className="font-mono font-semibold text-gov-navy select-all truncate mr-2">
                  {phoneUrl}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(phoneUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10.5px] font-bold text-slate-700 border border-slate-300 hover:border-gov-navy hover:text-gov-navy transition-colors shrink-0"
                >
                  {copied ? (
                    <>
                      <Check size={12} className="text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900 text-left">
                <div className="font-bold flex items-center gap-1">
                  <Camera size={13} className="text-amber-700" />
                  <span>Mobile Camera Ready:</span>
                </div>
                <div className="text-[10.5px] text-amber-800 mt-0.5">
                  Tap <strong>Camera Scan</strong> on your phone to photograph package labels directly with your phone lens!
                </div>
              </div>

              <div className="rounded-lg bg-blue-50/60 border border-blue-200/60 p-2 text-[10px] text-slate-600 text-left">
                <span className="font-semibold text-gov-navy">Network Tip:</span> Ensure your laptop Wi-Fi profile is set to <strong>&ldquo;Private network&rdquo;</strong> in Windows Settings if your phone cannot reach this IP.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-right">
              <button
                type="button"
                onClick={() => setShowPhoneModal(false)}
                className="rounded-lg bg-gov-navy hover:bg-gov-navy-light text-white px-4 py-1.5 text-xs font-semibold shadow-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
