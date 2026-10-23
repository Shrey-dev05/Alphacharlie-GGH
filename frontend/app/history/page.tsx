"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Barcode,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Calendar,
  Layers,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Panel, ComplianceBadge } from "@/components/ui";
import { api } from "@/lib/api";
import type { ScanListItem } from "@/lib/types";

export default function HistoryPage() {
  const [scans, setScans] = useState<ScanListItem[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function load(filters: Record<string, string> = {}) {
    setLoading(true);
    api
      .listScans(filters)
      .then(setScans)
      .finally(() => setLoading(false));
  }

  async function handleClearAll() {
    if (!window.confirm("Are you sure you want to delete ALL inspection records from the portal? This cannot be undone.")) {
      return;
    }
    setClearing(true);
    try {
      await api.clearAllScans();
      setScans([]);
    } catch (err) {
      alert("Failed to clear scan records.");
    } finally {
      setClearing(false);
    }
  }

  async function handleDeleteOne(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Delete this inspection record?")) return;
    try {
      await api.deleteScan(id);
      setScans((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert("Failed to delete record.");
    }
  }

  function runSearch(filterOverride?: string) {
    const currentStatus = filterOverride !== undefined ? filterOverride : statusFilter;
    const filters: Record<string, string> = {};

    if (query.trim()) {
      const isBarcodeLike = /^\d{8,14}$/.test(query.trim());
      if (isBarcodeLike) {
        filters.barcode_value = query.trim();
      } else {
        filters.brand_name = query.trim();
      }
    }

    if (currentStatus && currentStatus !== "all") {
      filters.compliance_status = currentStatus;
    }

    load(filters);
  }

  function handleFilterClick(status: string) {
    setStatusFilter(status);
    runSearch(status);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-gov">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-xs hidden sm:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/label-ai-logo.png" alt="Label AI Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span className="h-2 w-2 rounded-full bg-gov-saffron" />
                <span>Label AI • Statutory Central Database • National Register</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gov-navy mt-1 tracking-tight">
                Central Packaging Compliance Repository
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Archive of all regulatory inspections conducted across state enforcement directorates under the Legal
                Metrology Act, 2009. Query by brand, commodity name, GS1 barcode number, or compliance status.
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar & Filter Controls */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-gov space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Search by brand name or GS1 barcode number..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50/70 py-2.5 pl-10 pr-4 text-xs sm:text-sm outline-none transition-all focus:border-gov-navy focus:bg-white focus:ring-1 focus:ring-gov-navy"
              />
            </div>
            <button
              type="button"
              onClick={() => runSearch()}
              className="rounded-xl bg-gov-navy hover:bg-gov-navy-light text-white px-5 py-2.5 text-xs sm:text-sm font-semibold shadow-xs transition-all hover:-translate-y-0.5"
            >
              Execute Search
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
              Filter:
            </span>
            <button
              type="button"
              onClick={() => handleFilterClick("all")}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${
                statusFilter === "all"
                  ? "bg-gov-navy text-white font-semibold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Records ({scans.length})
            </button>
            <button
              type="button"
              onClick={() => handleFilterClick("compliant")}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${
                statusFilter === "compliant"
                  ? "bg-emerald-700 text-white font-semibold"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              Compliant Only
            </button>
            <button
              type="button"
              onClick={() => handleFilterClick("non_compliant")}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${
                statusFilter === "non_compliant"
                  ? "bg-rose-700 text-white font-semibold"
                  : "bg-rose-50 text-rose-800 hover:bg-rose-100"
              }`}
            >
              Violations Only
            </button>
          </div>
        </div>

        {/* Results Container: Table on Desktop, Cards on Mobile */}
        <Panel
          title="Inspection Audit Register"
          subtitle={`Displaying ${scans.length} verified packaging scan records`}
          action={
            scans.length > 0 ? (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={clearing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} className="text-rose-600" />
                <span>{clearing ? "Clearing..." : "Clear All Records"}</span>
              </button>
            ) : undefined
          }
        >
          {loading ? (
            <div className="py-16 text-center space-y-2">
              <Loader2 size={24} className="animate-spin text-gov-saffron mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Querying National Repository...</p>
            </div>
          ) : scans.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <ShieldAlert size={32} className="text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-gov-navy">No Matching Records Found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No packaging inspection entries matched your search query or filter criteria.
              </p>
            </div>
          ) : (
            <div>
              {/* 1. Desktop / Laptop Table View (hidden on small mobile screens) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-3">Brand &amp; Commodity</th>
                      <th className="py-3 px-3">GS1 Barcode</th>
                      <th className="py-3 px-3">Jurisdiction</th>
                      <th className="py-3 px-3">Inspector</th>
                      <th className="py-3 px-3">Statutory Status</th>
                      <th className="py-3 px-3">Timestamp</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scans.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        <td className="py-3 px-3 font-semibold text-gov-navy">
                          <Link
                            href={`/results/${s.id}`}
                            className="hover:underline flex flex-col"
                          >
                            <span className="text-xs font-bold text-gov-navy group-hover:text-gov-navy-light">
                              {s.brand_name || "Unbranded Commodity"}
                            </span>
                            {s.product_name && (
                              <span className="text-[11px] font-normal text-slate-500">
                                {s.product_name}
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {s.barcode_value ? (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 border border-slate-200">
                              {s.barcode_value}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {s.state || "National"}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {s.inspector_name || "Enforcement Officer"}
                        </td>
                        <td className="py-3 px-3">
                          <ComplianceBadge status={s.compliance_status} score={s.compliance_score} size="sm" />
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                          {new Date(s.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <Link
                              href={`/results/${s.id}`}
                              className="inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-gov-navy hover:text-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors"
                            >
                              <span>Inspect</span>
                              <ArrowUpRight size={12} />
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteOne(s.id, e)}
                              title="Delete inspection record"
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 2. Mobile Cards View (displayed on phones < 768px) */}
              <div className="md:hidden divide-y divide-slate-100">
                {scans.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col gap-2 py-3.5 px-1 hover:bg-slate-50 transition-colors"
                  >
                    <Link href={`/results/${s.id}`} className="block">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-gov-navy">
                            {s.brand_name || "Unbranded Commodity"}
                          </div>
                          {s.product_name && (
                            <div className="text-[11px] text-slate-500">{s.product_name}</div>
                          )}
                        </div>
                        <ComplianceBadge status={s.compliance_status} score={s.compliance_score} size="sm" />
                      </div>
                    </Link>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-slate-500 font-mono">
                        {s.barcode_value && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 border border-slate-200">
                            EAN: {s.barcode_value}
                          </span>
                        )}
                        <span>{s.state || "National"}</span>
                        <span>•</span>
                        <span>{new Date(s.created_at).toLocaleDateString()}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteOne(s.id, e)}
                        title="Delete inspection record"
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
