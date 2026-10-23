"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Camera,
  LayoutDashboard,
  ScanLine,
  History,
  MessageSquareText,
  LogOut,
  ShieldCheck,
  User,
  ChevronRight,
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
    roles: ["field_inspector", "ecommerce_auditor", "manufacturer", "super_admin"],
  },
  {
    href: "/upload",
    label: "New Compliance Scan",
    icon: ScanLine,
    roles: ["field_inspector", "ecommerce_auditor", "manufacturer"],
  },
  {
    href: "/history",
    label: "National Repository",
    icon: History,
    roles: ["field_inspector", "ecommerce_auditor", "manufacturer", "super_admin"],
  },
  {
    href: "/chatbot",
    label: "Paramarsh AI",
    icon: MessageSquareText,
    roles: ["field_inspector", "ecommerce_auditor", "manufacturer", "super_admin"],
  },
  {
    href: "/consumer",
    label: "Consumer Health Hub",
    icon: HeartPulse,
    roles: ["field_inspector", "ecommerce_auditor", "manufacturer", "super_admin"],
  },
  {
    href: "/consumer?tab=compare",
    label: "Product Comparison",
    icon: Scale,
    roles: ["field_inspector", "ecommerce_auditor", "manufacturer", "super_admin"],
  },
  {
    href: "/samadhan",
    label: "Samadhan AI Studio",
    icon: Sparkles,
    roles: ["field_inspector", "ecommerce_auditor", "manufacturer", "super_admin"],
  },
];

const ROLE_LABELS: Record<string, string> = {
  field_inspector: "Field Inspector (Govt.)",
  ecommerce_auditor: "E-Commerce Regulatory Auditor",
  manufacturer: "Manufacturer (QA Compliance)",
  super_admin: "Super Admin (Central DCA)",
};

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const allowedItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <div className="md:hidden w-full border-b border-gov-border bg-gov-navy text-white sticky top-0 z-40 shadow-sm">
      {/* Mobile Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open mobile navigation menu"
            className="rounded-md p-1.5 text-slate-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-gov-saffron"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-white p-0.5 flex items-center justify-center text-white shrink-0 border border-white/20 shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/label-ai-logo.png" alt="Label AI Logo" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <span className="text-[16px] font-black tracking-tight block">
                Label <span className="text-cyan-400">AI</span>
              </span>
              <span className="text-[9.5px] font-bold tracking-wider uppercase text-slate-400 block">
                Analyze • Decode
              </span>
            </div>
          </div>
        </div>

        {/* Quick Direct Camera Scan shortcut on mobile header */}
        <Link
          href="/upload?camera=1"
          className="flex items-center gap-1.5 text-[11.5px] font-bold bg-gov-saffron text-gov-navy px-2.5 py-1 rounded shadow-xs hover:bg-gov-saffron/90 transition-colors"
        >
          <Camera size={13} />
          <span>Camera Scan</span>
        </Link>
      </div>

      {/* Slide-over Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative flex w-4/5 max-w-xs flex-1 flex-col bg-gov-navy text-white shadow-2xl animate-slide-right">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-white p-0.5 flex items-center justify-center text-white shrink-0 border border-white/20 shadow-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/label-ai-logo.png" alt="Label AI Logo" className="h-full w-full object-contain" />
                </div>
                <div>
                  <div className="text-sm font-black flex items-center gap-1">
                    <span>Label</span>
                    <span className="text-cyan-400">AI</span>
                  </div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Analyze • Decode • Inform</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* User Profile Badge in Drawer */}
            <div className="border-b border-slate-700/60 bg-gov-navy-dark/60 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-200">
                  <User size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate text-white">
                    {user.full_name}
                  </div>
                  <div className="text-[10.5px] text-gov-saffron font-medium truncate">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </div>
                  {user.state && (
                    <div className="text-[10px] text-slate-400">Jurisdiction: {user.state}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Nav links */}
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Official Navigation
              </div>
              {allowedItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={clsx(
                      "flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-white/15 text-white font-semibold border-l-3 border-gov-saffron"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} className={active ? "text-gov-saffron" : "text-slate-400"} />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-500" />
                  </Link>
                );
              })}
            </nav>

            {/* Bottom Actions */}
            <div className="border-t border-slate-700/60 p-4">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition-colors"
              >
                <LogOut size={16} />
                Sign Out from Regulatory Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
