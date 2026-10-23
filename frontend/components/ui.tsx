import React from "react";
import clsx from "clsx";
import type { ComplianceStatus } from "@/lib/types";
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Award, type LucideIcon } from "lucide-react";

export function ComplianceBadge({
  status,
  score,
  size = "md",
}: {
  status: ComplianceStatus | null;
  score?: number | null;
  size?: "sm" | "md" | "lg";
}) {
  const config: Record<
    string,
    { label: string; classes: string; icon: LucideIcon }
  > = {
    compliant: {
      label: "Rule 6 Compliant",
      classes: "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs",
      icon: CheckCircle2,
    },
    non_compliant: {
      label: "Non-Compliant (Violations)",
      classes: "bg-rose-50 text-rose-800 border-rose-300 shadow-xs",
      icon: XCircle,
    },
    partial: {
      label: "Partial Compliance",
      classes: "bg-amber-50 text-amber-900 border-amber-300 shadow-xs",
      icon: AlertTriangle,
    },
  };

  const c = status
    ? config[status]
    : {
        label: "Processing Audit",
        classes: "bg-slate-100 text-slate-700 border-slate-300",
        icon: ShieldCheck,
      };

  const Icon = c.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-3 py-1 text-xs",
    lg: "px-4 py-1.5 text-sm font-semibold",
  }[size];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md border font-medium transition-transform duration-150",
        sizeClasses,
        c.classes
      )}
    >
      <Icon size={size === "lg" ? 16 : 14} className="shrink-0" />
      <span>{c.label}</span>
      {typeof score === "number" && (
        <span className="font-mono font-bold ml-1 rounded bg-black/5 px-1.5 py-0.2 text-[11px]">
          {score.toFixed(1)}%
        </span>
      )}
    </span>
  );
}

export function SeverityTag({ severity }: { severity: "minor" | "major" | "critical" }) {
  const classes = {
    critical: "text-rose-900 border-rose-300 bg-rose-50 font-bold",
    major: "text-amber-900 border-amber-300 bg-amber-50 font-semibold",
    minor: "text-slate-700 border-slate-300 bg-slate-100 font-medium",
  }[severity];

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider",
        classes
      )}
    >
      {severity}
    </span>
  );
}

export function RuleTag({ reference }: { reference: string }) {
  return (
    <span className="inline-flex items-center rounded border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-gov-navy shadow-2xs">
      {reference}
    </span>
  );
}

export function DetectionMethodTag({ method }: { method: string }) {
  const labels: Record<string, { name: string; bg: string; text: string; border: string }> = {
    ai_vision: { name: "Paramarsh Multimodal Vision", bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-200" },
    ensemble: { name: "Paramarsh Vision + Multi-Pass OCR", bg: "bg-purple-50", text: "text-purple-800", border: "border-purple-200" },
    regex: { name: "Pattern Matching", bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
    keyword: { name: "Keyword Verification", bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
    ml_classifier: { name: "ML Text Classifier", bg: "bg-indigo-50", text: "text-indigo-800", border: "border-indigo-200" },
    both: { name: "Pattern + Classifier", bg: "bg-cyan-50", text: "text-cyan-800", border: "border-cyan-200" },
    cv_measurement: { name: "Computer Vision Metric", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
    none: { name: "Not Detected", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  };

  const item = labels[method] ?? {
    name: method,
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium shadow-2xs",
        item.bg,
        item.text,
        item.border
      )}
    >
      {item.name}
    </span>
  );
}

export function Panel({
  title,
  subtitle,
  children,
  action,
  className,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        "rounded-xl border border-slate-200/80 bg-white shadow-gov transition-all duration-200 hover:shadow-gov-md",
        className
      )}
    >
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 bg-slate-50/50 rounded-t-xl">
          <div>
            <h3 className="text-[16px] font-bold text-gov-navy tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

/**
 * Animated Circular Compliance Gauge
 */
export function ComplianceGauge({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  let strokeColor = "#15803D"; // compliant green
  let statusText = "Compliant";
  let textColor = "text-emerald-700";
  let bgColor = "bg-emerald-50";

  if (clampedScore < 50) {
    strokeColor = "#B91C1C"; // violation red
    statusText = "Critical Violations";
    textColor = "text-rose-700";
    bgColor = "bg-rose-50";
  } else if (clampedScore < 90) {
    strokeColor = "#D97706"; // alert amber
    statusText = "Partial Compliance";
    textColor = "text-amber-700";
    bgColor = "bg-amber-50";
  }

  return (
    <div className={clsx("flex flex-col items-center justify-center rounded-2xl border border-slate-200 p-5", bgColor)}>
      <div className="relative h-32 w-32 flex items-center justify-center">
        <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 110 110">
          <circle
            cx="55"
            cy="55"
            r={radius}
            stroke="#E2E8F0"
            strokeWidth="9"
            fill="transparent"
          />
          <circle
            cx="55"
            cy="55"
            r={radius}
            stroke={strokeColor}
            strokeWidth="9"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className={clsx("text-3xl font-extrabold leading-none tracking-tight", textColor)}>
            {clampedScore.toFixed(0)}%
          </span>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-1">
            Score
          </span>
        </div>
      </div>
      <div className={clsx("mt-2 text-xs font-bold uppercase tracking-wider", textColor)}>
        {statusText}
      </div>
      <div className="text-[10.5px] text-slate-500 mt-0.5">
        Legal Metrology (PC) Rules, 2011
      </div>
    </div>
  );
}

/**
 * Official Government KPI Stat Card
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = "navy",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  accent?: "navy" | "saffron" | "green" | "red";
}) {
  const accentClasses = {
    navy: "border-l-4 border-gov-navy text-gov-navy",
    saffron: "border-l-4 border-gov-saffron text-amber-700",
    green: "border-l-4 border-gov-green text-emerald-700",
    red: "border-l-4 border-rose-600 text-rose-700",
  }[accent];

  const iconBg = {
    navy: "bg-slate-100 text-gov-navy",
    saffron: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-rose-50 text-rose-700",
  }[accent];

  return (
    <div
      className={clsx(
        "rounded-xl border border-slate-200 bg-white p-5 shadow-gov gov-card-interactive flex items-start justify-between gap-4",
        accentClasses
      )}
    >
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</div>
        <div className="text-2xl sm:text-3xl font-extrabold text-gov-navy mt-1.5 tracking-tight">{value}</div>
        {subtitle && <div className="text-[11.5px] text-slate-500 mt-1">{subtitle}</div>}
      </div>
      <div className={clsx("h-11 w-11 rounded-lg flex items-center justify-center shrink-0 shadow-2xs", iconBg)}>
        <Icon size={22} />
      </div>
    </div>
  );
}

/**
 * Official Digital Seal Badge
 */
export function OfficialSealBadge({
  compliant = true,
  scanId,
}: {
  compliant?: boolean;
  scanId?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-linear-to-r from-slate-50 to-white px-3.5 py-2 text-xs shadow-2xs">
      <div className="h-8 w-8 rounded-full bg-gov-navy flex items-center justify-center text-gov-saffron shrink-0 shadow-xs">
        <Award size={18} />
      </div>
      <div className="leading-tight">
        <div className="font-semibold text-gov-navy flex items-center gap-1">
          <span>{compliant ? "Statutory Compliance Seal" : "Regulatory Inspection Record"}</span>
          <span className="text-[9.5px] rounded bg-gov-navy/10 px-1 py-0.2 font-mono text-gov-navy font-bold">
            NIC-VERIFIED
          </span>
        </div>
        <div className="text-[10.5px] text-slate-500 font-mono mt-0.5">
          {scanId ? `Label AI ID: ${scanId.slice(0, 13)}...` : "Label AI Platform • Packaging Compliance Grid"}
        </div>
      </div>
    </div>
  );
}
