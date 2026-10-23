"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ScanLine,
  History,
  MessageSquareText,
  LogOut,
  ShieldCheck,
  Award,
  ChevronRight,
  ExternalLink,
  HeartPulse,
  Scale,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import clsx from "clsx";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "National Dashboard",
    icon: LayoutDashboard,
    badge: "Central",
    roles: ["field_inspector", "ecommerce_auditor", "manufacturer", "super_admin"],
  },
  {
    href: "/upload",
    label: "New Compliance Scan",
    icon: ScanLine,
    badge: "AI Vision",
    roles: ["field_inspector", "ecommerce_auditor", "manufacturer"],
  },
  {
    href: "/history",
    label: "National Repository",
    icon: History,
    badge: null,
    roles: ["field_inspector", "ecommerce_auditor", "manufacturer", "super_admin"],
  },
  {
    href: "/chatbot",
    label: "Paramarsh AI",
    icon: MessageSquareText,
    badge: "RAG AI",
    roles: ["field_inspector", "ecommerce_auditor", "manufacturer", "super_admin"],
  },
  {
    href: "/consumer",
    label: "Consumer Health Hub",
    icon: HeartPulse,
    badge: "Ingredients",
    roles: ["field_inspector", "ecommerce_auditor", "manufacturer", "super_admin"],
  },
  {
    href: "/consumer?tab=compare",
    label: "Product Comparison",
    icon: Scale,
    badge: "AI Verdict",
    roles: ["field_inspector", "ecommerce_auditor", "manufacturer", "super_admin"],
  },
  {
    href: "/samadhan",
    label: "Samadhan AI Studio",
    icon: Sparkles,
    badge: "Label Gen",
    roles: ["field_inspector", "ecommerce_auditor", "manufacturer", "super_admin"],
  },
];

const ROLE_LABELS: Record<string, string> = {
  field_inspector: "Field Inspector (Govt.)",
  ecommerce_auditor: "E-Commerce Regulatory Auditor",
  manufacturer: "Manufacturer (QA Compliance)",
  super_admin: "Super Admin (Central DCA)",
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <aside className="hidden md:flex h-screen w-64 lg:w-72 flex-col justify-between border-r border-slate-800 bg-gov-navy text-slate-100 sticky top-0 shrink-0 select-none shadow-xl">
      {/* 1. Portal Brand / Insignia Header */}
      <div>
        <div className="border-b border-slate-700/70 px-5 py-4 bg-gov-navy-dark/80">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white p-1 flex items-center justify-center shadow-md shrink-0 border border-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/label-ai-logo.png"
                alt="Label AI Official Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="text-[17px] font-black text-white tracking-wide leading-tight flex items-center gap-1">
                <span>Label</span>
                <span className="text-cyan-400">AI</span>
              </div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400 leading-snug">
                Analyze • Decode
              </div>
            </div>
          </div>

          {/* Verification chip */}
          <div className="mt-3 flex items-center justify-between rounded bg-slate-900/60 border border-slate-700/60 px-2.5 py-1 text-[10.5px]">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              National Grid Active
            </span>
            <span className="text-slate-400 font-mono text-[10px]">Sec. 18 / 36</span>
          </div>
        </div>

        {/* 2. Official Navigation Menu */}
        <nav className="mt-4 px-3 space-y-1">
          <div className="px-3 mb-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
            Enforcement &amp; Compliance
          </div>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-white/12 text-white font-semibold shadow-xs border-l-4 border-gov-saffron"
                    : "text-slate-300 hover:bg-white/6 hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={18}
                    className={clsx(
                      "transition-colors duration-200",
                      active ? "text-gov-saffron" : "text-slate-400 group-hover:text-slate-200"
                    )}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span
                    className={clsx(
                      "rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider font-mono",
                      active
                        ? "bg-gov-saffron text-gov-navy"
                        : "bg-slate-800 text-slate-400 group-hover:bg-slate-700"
                    )}
                  >
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight
                    size={14}
                    className={clsx(
                      "opacity-0 transition-opacity group-hover:opacity-100",
                      active ? "opacity-100 text-gov-saffron" : "text-slate-500"
                    )}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 3. Official User Session Card & Sign Out */}
      <div className="border-t border-slate-700/80 bg-gov-navy-dark/90 p-4">
        <div className="mb-3 rounded-lg border border-slate-700/70 bg-slate-900/40 p-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
              {user.full_name?.charAt(0)?.toUpperCase() || "O"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{user.full_name}</div>
              <div className="text-[11px] text-gov-saffron font-medium truncate">
                {ROLE_LABELS[user.role] ?? user.role}
              </div>
            </div>
          </div>
          {user.state && (
            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[10.5px] text-slate-400">
              <span>Jurisdiction:</span>
              <span className="font-semibold text-slate-200">{user.state}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-300 transition-all hover:bg-rose-950/40 hover:border-rose-800/60 hover:text-rose-200"
        >
          <LogOut size={14} />
          <span>Exit Regulatory Session</span>
        </button>
      </div>
    </aside>
  );
}
