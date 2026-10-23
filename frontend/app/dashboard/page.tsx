"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  ScanLine,
  Camera,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Activity,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  HeartPulse,
  Scale,
  Cpu,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Panel, ComplianceBadge, StatCard } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { AnalyticsSummary, ScanListItem } from "@/lib/types";

export default function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === "super_admin") {
    return (
      <AppShell>
        <AdminDashboard />
      </AppShell>
    );
  }
  return (
    <AppShell>
      <OperatorDashboard />
    </AppShell>
  );
}

function OperatorDashboard() {
  const { user } = useAuth();
  const [recent, setRecent] = useState<ScanListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listScans({ limit: "6" })
      .then(setRecent)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalScans = recent.length;
  const compliantCount = recent.filter((s) => s.compliance_status === "compliant").length;
  const violationCount = recent.filter((s) => s.compliance_status === "non_compliant").length;
  const avgScore = totalScans
    ? (recent.reduce((acc, s) => acc + (s.compliance_score || 0), 0) / totalScans).toFixed(1)
    : "0.0";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* 1. Official Officer Greeting & Mandate Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-gov relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-bl from-amber-100/50 to-transparent rounded-bl-full pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white border border-slate-200/90 p-1 flex items-center justify-center shrink-0 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/label-ai-logo.png"
                alt="Label AI Official Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Label AI • Analyze • Decode • Inform</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gov-navy mt-1 tracking-tight">
                Label AI Command: {user?.full_name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Real-time monitoring and legal metrology verification for packaged commodities across{" "}
                <strong>{user?.state || "National Jurisdiction"}</strong> under the Legal Metrology Act, 2009.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/upload?camera=1"
              className="inline-flex items-center gap-2 rounded-lg bg-gov-saffron hover:bg-gov-saffron-dark text-gov-navy font-bold px-4 py-2.5 text-xs sm:text-sm shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              <Camera size={16} />
              <span>Camera Scan</span>
            </Link>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-lg bg-gov-navy hover:bg-gov-navy-light text-white px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              <ScanLine size={16} className="text-gov-saffron" />
              <span>Upload Artwork</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Official KPI Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Recent Audits"
          value={totalScans}
          subtitle="Packaged items reviewed"
          icon={Activity}
          accent="navy"
        />
        <StatCard
          title="Rule 6 Compliant"
          value={compliantCount}
          subtitle="Passed mandatory declarations"
          icon={ShieldCheck}
          accent="green"
        />
        <StatCard
          title="Violations Flagged"
          value={violationCount}
          subtitle="Actionable statutory defects"
          icon={ShieldAlert}
          accent="red"
        />
        <StatCard
          title="Avg. Compliance"
          value={`${avgScore}%`}
          subtitle="Jurisdictional average"
          icon={Layers}
          accent="saffron"
        />
      </div>

      {/* 3. Action Callout & Quick Launch */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Scan Action Tile */}
        <div className="rounded-2xl border border-gov-navy bg-gradient-to-br from-gov-navy via-gov-navy to-gov-navy-light p-6 text-white shadow-gov-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 h-32 w-32 rounded-full bg-white/5 blur-xl pointer-events-none" />

          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-gov-saffron border border-white/10">
              <Sparkles size={13} />
              <span>Paramarsh Vision + OCR</span>
            </div>
            <h3 className="text-lg font-bold mt-3 text-white">
              Principal Display Panel Audit
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Upload packaging photos or label artwork. The ensemble extracts MRP, Net Quantity, Unit Sale Price,
              FSSAI license, and validates Rule 6 declarations with instant statutory reports.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-lg bg-gov-saffron text-gov-navy font-bold text-xs px-4 py-2 hover:bg-amber-300 transition-all shadow-sm"
            >
              <span>Scan New Packaging</span>
              <ArrowUpRight size={14} />
            </Link>
            <span className="text-[11px] text-slate-400 font-mono">Sec. 18 / Rule 6</span>
          </div>
        </div>

        {/* Recent Audits Table / Feed */}
        <div className="lg:col-span-2">
          <Panel
            title="Recent Regulatory Inspections"
            subtitle="Most recent compliance checks evaluated by the engine"
            action={
              <Link
                href="/history"
                className="text-xs font-semibold text-gov-navy hover:underline flex items-center gap-1"
              >
                <span>View Full Repository</span>
                <ChevronRight size={14} />
              </Link>
            }
          >
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                Loading regulatory inspection records...
              </div>
            ) : recent.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                No inspection records logged in this session yet. Start by uploading a package above.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recent.map((s) => (
                  <Link
                    key={s.id}
                    href={`/results/${s.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 hover:bg-slate-50/80 rounded-lg px-2.5 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-gov-navy group-hover:text-gov-navy-light transition-colors truncate">
                          {s.brand_name || "Unbranded Commodity"}
                        </span>
                        {s.product_name && (
                          <span className="text-xs text-slate-600 truncate">— {s.product_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span className="font-mono">{new Date(s.created_at).toLocaleDateString()}</span>
                        {s.barcode_value && (
                          <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-slate-600">
                            EAN: {s.barcode_value}
                          </span>
                        )}
                        <span className="font-mono text-slate-400">ID: {s.id.slice(0, 8)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <ComplianceBadge status={s.compliance_status} score={s.compliance_score} size="sm" />
                      <ChevronRight
                        size={16}
                        className="text-slate-400 group-hover:text-gov-navy transition-transform group-hover:translate-x-0.5"
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* 4. Consumer Health & Samadhan AI Showcase Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Consumer Health & Comparison Tile */}
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 p-6 shadow-gov relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-3 py-0.5 text-xs font-bold text-emerald-900">
                <HeartPulse size={13} className="text-emerald-700" />
                <span>Consumer Protection</span>
              </span>
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                <Scale size={13} /> Product Battle
              </span>
            </div>

            <h3 className="text-lg font-black text-gov-navy mt-3">
              Consumer Ingredient &amp; Health Intelligence Hub
            </h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Scan or paste ingredients to detect synthetic preservatives (INS 211, 224), coal-tar dyes, and check
              personalized side effects across 9+ health conditions. Compare 2+ products side-by-side to discover which one is better to consume.
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-emerald-100 flex items-center gap-3">
            <Link
              href="/consumer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 transition-all shadow-sm"
            >
              <span>Inspect Ingredients</span>
              <ChevronRight size={14} />
            </Link>
            <Link
              href="/consumer?tab=compare"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-xs px-3.5 py-2 transition-all shadow-2xs"
            >
              <span>Compare Products</span>
            </Link>
          </div>
        </div>

        {/* Samadhan AI Studio Tile */}
        <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/70 via-white to-indigo-50/50 p-6 shadow-gov relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 border border-purple-300 px-3 py-0.5 text-xs font-bold text-purple-900">
                <Sparkles size={13} className="text-purple-700" />
                <span>Samadhan AI Studio (समाधान AI)</span>
              </span>
              <span className="rounded-md bg-purple-200/80 text-purple-950 font-mono text-[10px] font-bold px-2 py-0.5">
                gemini-nano-banana-2.1
              </span>
            </div>

            <h3 className="text-lg font-black text-gov-navy mt-3">
              Manufacturer Statutory Packaging Label Studio
            </h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Design and generate commercial packaging label artwork ready for print. Enforces Legal Metrology Rule 6(1)(a)-(f)
              declaration box, FSSAI 14-digit license, green vegetarian symbol, and EAN-13 barcode.
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-purple-100 flex items-center gap-3">
            <Link
              href="/samadhan"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gov-navy hover:bg-gov-navy-light text-white font-bold text-xs px-4 py-2 transition-all shadow-sm"
            >
              <span>Launch Label Studio</span>
              <ChevronRight size={14} />
            </Link>
            <Link
              href="/chatbot"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-3.5 py-2 transition-all shadow-2xs"
            >
              <span>Get Rules from Paramarsh AI</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    api.analyticsSummary().then(setSummary).catch(() => {});
  }, []);

  if (!summary) {
    return (
      <div className="py-16 text-center text-sm text-slate-500 animate-pulse">
        Retrieving nationwide legal metrology analytics...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Official Admin Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-gov">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span className="h-2 w-2 rounded-full bg-gov-saffron" />
          <span>Central Regulatory Authority • Macro Analytics</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gov-navy mt-1 tracking-tight">
          Nationwide Compliance Command
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Aggregated statutory compliance metrics across all state enforcement directorates and authorized inspection officers.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Packaged Scans"
          value={summary.total_scans}
          subtitle="Central database records"
          icon={Activity}
          accent="navy"
        />
        <StatCard
          title="Compliant Items"
          value={summary.compliant_scans}
          subtitle="Passed all statutory checks"
          icon={ShieldCheck}
          accent="green"
        />
        <StatCard
          title="Defective / Violations"
          value={summary.non_compliant_scans}
          subtitle="Subject to Sec. 36 penalty"
          icon={ShieldAlert}
          accent="red"
        />
        <StatCard
          title="Average Compliance"
          value={`${summary.average_compliance_score}%`}
          subtitle="National aggregate index"
          icon={Layers}
          accent="saffron"
        />
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel
          title="Frequent Statutory Infractions"
          subtitle="Violations categorized by Legal Metrology (PC) Rules reference"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.top_violations} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis dataKey="rule_reference" type="category" width={80} tick={{ fontSize: 11, fill: "#0F2B48" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0F2B48", color: "#FFFFFF", borderRadius: "8px", border: "none", fontSize: "12px" }}
                />
                <Bar dataKey="count" fill="#B91C1C" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="State Enforcement Compliance Breakdown"
          subtitle="Jurisdictional compliance percentage across audited states"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.state_breakdown} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="state" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0F2B48", color: "#FFFFFF", borderRadius: "8px", border: "none", fontSize: "12px" }}
                />
                <Bar dataKey="compliance_rate" fill="#0F2B48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
