"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { GovHeader } from "./GovHeader";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { ShieldCheck, Loader2, Sparkles } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 text-slate-900">
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <div className="relative mb-2">
            <div className="h-28 w-28 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/label-ai-logo.png"
                alt="Label AI Official Logo"
                className="h-20 w-20 object-contain drop-shadow-md animate-pulse"
              />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            <span>Label</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">AI</span>
          </div>
          <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            Analyze • Decode • Inform
          </p>
          <p className="text-xs text-slate-500 max-w-xs mt-1">
            Loading Label AI workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      {/* 1. Portal Header */}
      <GovHeader />

      {/* 2. Mobile Nav Bar (Visible on mobile/tablet screens) */}
      <MobileNav />

      {/* 3. Core Workspace Layout */}
      <div className="flex flex-1 w-full max-w-[1920px] mx-auto">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Main Content Viewport */}
        <main
          id="main-content"
          className="flex-1 min-w-0 overflow-y-auto px-3.5 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 transition-all animate-fade-in"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
