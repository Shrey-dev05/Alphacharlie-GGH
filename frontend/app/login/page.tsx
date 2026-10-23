"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Lock, Mail, ArrowRight, Loader2, AlertCircle, PhoneCall, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Authentication failed. Please verify your officer credentials."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      {/* 1. Label AI Brand Ribbon */}
      <div className="h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 w-full" />

      {/* Top Info Strip */}
      <div className="border-b border-slate-200 bg-white px-4 py-2 text-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2 font-medium text-slate-700">
            <span className="font-extrabold text-blue-700">Label AI</span>
            <span>•</span>
            <span className="text-slate-500">AI Packaging Compliance &amp; Studio</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>NCH Helpline: <strong className="text-amber-800">1915</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Centered Login Box */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Label AI Title & Badge */}
          <div className="flex flex-col items-center text-center">
            <div className="flex flex-col items-center justify-center mb-2">
              <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-3xl bg-white p-2 shadow-md border border-slate-200/80 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/label-ai-logo.png"
                  alt="Label AI Official Logo"
                  className="h-full w-full object-contain"
                />
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 mt-1">
              <span>Label</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">AI</span>
            </h1>
            <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-0.5">
              Analyze • Decode • Inform
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Next-generation AI packaging compliance inspection, ingredient intelligence, and statutory label generation.
            </p>
          </div>

          {/* Login Form Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-gov">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Official Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/60 py-2.5 pl-10 pr-3.5 text-xs sm:text-sm outline-none transition-colors focus:border-gov-navy focus:bg-white focus:ring-1 focus:ring-gov-navy"
                    placeholder="officer@department.gov.in"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Account Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/60 py-2.5 pl-10 pr-3.5 text-xs sm:text-sm outline-none transition-colors focus:border-gov-navy focus:bg-white focus:ring-1 focus:ring-gov-navy"
                    placeholder="••••••••••••"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800 font-medium">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gov-navy hover:bg-gov-navy-light text-white py-3 px-4 font-semibold text-xs sm:text-sm shadow-gov transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-gov-saffron" />
                    <span>Verifying Regulatory Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate &amp; Enter Portal</span>
                    <ArrowRight size={16} className="text-gov-saffron" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">New regulatory user?</span>
              <Link
                href="/register"
                className="font-bold text-gov-navy hover:underline underline-offset-2"
              >
                Request Authorization / Register
              </Link>
            </div>
          </div>

          {/* Security Notice */}
          <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Encrypted Session • Label AI Security Protocol</span>
          </div>
        </div>
      </div>
    </div>
  );
}
