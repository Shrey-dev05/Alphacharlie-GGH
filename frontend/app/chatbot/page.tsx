"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Send,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Scale,
  Sparkles,
  Copy,
  Check,
  HelpCircle,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RuleTag } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  citedRules?: string[];
  isError?: boolean;
}

const SUGGESTIONS = [
  "I am a manufacturer. Help me design a compliant label for Mango Juice with ingredients.",
  "What is the minimum font size for net quantity on a 500g package?",
  "Is Unit Sale Price (USP) mandatory for all packaged goods under Rule 6(11)?",
  "What must the MRP declaration include (taxes, stickers, overcharging)?",
  "Can a retailer alter or paste a higher price sticker over the MRP?",
  "Kya manufacturing date aur expiry date dono likhna zaroori hai?",
];

function cleanLatexAndUnits(text: string): string {
  return text
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/cm\^2/g, "cm²")
    .replace(/cm\^3/g, "cm³")
    .replace(/\\%/g, "%");
}

function formatInline(rawText: string): React.ReactNode {
  const text = cleanLatexAndUnits(rawText);
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-gov-navy">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={index} className="italic text-slate-700">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] text-gov-navy">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function FormattedContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentUl: React.ReactNode[] = [];
  let currentOl: React.ReactNode[] = [];

  const flushLists = () => {
    if (currentUl.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="my-1.5 space-y-1 pl-5 list-disc text-slate-700">
          {currentUl}
        </ul>
      );
      currentUl = [];
    }
    if (currentOl.length > 0) {
      elements.push(
        <ol key={`ol-${elements.length}`} className="my-1.5 space-y-1 pl-5 list-decimal text-slate-700">
          {currentOl}
        </ol>
      );
      currentOl = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushLists();
      return;
    }

    if (trimmed.startsWith("### ")) {
      flushLists();
      elements.push(
        <h4 key={idx} className="mt-3 mb-1 text-[15px] font-bold text-gov-navy tracking-tight">
          {formatInline(trimmed.slice(4))}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      flushLists();
      elements.push(
        <h3 key={idx} className="mt-3 mb-1.5 text-base font-bold text-gov-navy tracking-tight">
          {formatInline(trimmed.slice(3))}
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      flushLists();
      elements.push(
        <h2 key={idx} className="mt-3 mb-1.5 text-lg font-bold text-gov-navy tracking-tight">
          {formatInline(trimmed.slice(2))}
        </h2>
      );
    } else if (trimmed === "---" || trimmed === "***") {
      flushLists();
      elements.push(<hr key={idx} className="my-2 border-slate-200" />);
    } else if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      if (currentOl.length > 0) flushLists();
      currentUl.push(
        <li key={idx} className="text-xs sm:text-sm leading-relaxed">
          {formatInline(trimmed.slice(2))}
        </li>
      );
    } else if (/^\d+\.\s+/.test(trimmed)) {
      if (currentUl.length > 0) flushLists();
      const textAfterNumber = trimmed.replace(/^\d+\.\s+/, "");
      currentOl.push(
        <li key={idx} className="text-xs sm:text-sm leading-relaxed">
          {formatInline(textAfterNumber)}
        </li>
      );
    } else {
      flushLists();
      elements.push(
        <p key={idx} className="my-1 text-xs sm:text-sm leading-relaxed text-slate-700">
          {formatInline(trimmed)}
        </p>
      );
    }
  });

  flushLists();

  return <div className="space-y-1">{elements}</div>;
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Namaste. I am **Paramarsh AI (परामर्श AI)**, your Legal Metrology Regulatory Intelligence Assistant. Ask any legal question regarding the Legal Metrology Act 2009, Packaged Commodities Rules 2011, or FSSAI labeling mandates — I will answer with exact statutory rule references in English, Hindi, or Hinglish.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const sessionId = useRef(`session-${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    try {
      const res = await api.askChatbot(sessionId.current, text);
      setMessages((m) => [...m, { role: "assistant", content: res.reply, citedRules: res.cited_rules }]);
    } catch (err: any) {
      let errMsg = "I could not process that inquiry at the moment. Please verify backend service availability.";
      if (err instanceof ApiError && err.message) {
        errMsg = `Error (${err.status}): ${err.message}`;
      } else if (err?.message) {
        errMsg = err.message;
      }
      setMessages((m) => [...m, { role: "assistant", content: errMsg, isError: true }]);
    } finally {
      setSending(false);
    }
  }

  function copyMessage(idx: number, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  function resetChat() {
    sessionId.current = `session-${Date.now()}`;
    setMessages([
      {
        role: "assistant",
        content:
          "Conversation reset with **Paramarsh AI (परामर्श AI)**. Please enter your inquiry on Legal Metrology regulations, penalties under Section 36, or packaging compliance standards.",
      },
    ]);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-4">
        {/* Header Title Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-gov flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-14 w-14 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-xs hidden sm:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/label-ai-logo.png" alt="Label AI Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span className="h-2 w-2 rounded-full bg-gov-saffron" />
                <span>Label AI • Regulatory Intelligence Assistant</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-gov-navy mt-1 tracking-tight">
                Paramarsh AI (परामर्श AI)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Legal Metrology Intelligence Assistant indexed with the Legal Metrology Act, 2009 &amp; PCR, 2011.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={resetChat}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors shrink-0"
          >
            <RefreshCw size={13} />
            <span>Reset Conversation</span>
          </button>
        </div>

        {/* Chat Messages Box */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-gov flex flex-col h-[520px] sm:h-[580px]">
          {/* Scrollable messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="h-8 w-8 rounded-lg bg-gov-navy text-gov-saffron flex items-center justify-center shrink-0 shadow-2xs mt-0.5 overflow-hidden p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/label-ai-icon.png" alt="Label AI" className="h-full w-full object-contain" />
                  </div>
                )}

                <div
                  className={`group relative max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 transition-all shadow-xs ${
                    m.role === "user"
                      ? "bg-gov-navy text-white rounded-tr-xs"
                      : m.isError
                      ? "bg-rose-50 border border-rose-300 text-rose-900 rounded-tl-xs"
                      : "bg-slate-50 border border-slate-200/80 text-gov-navy rounded-tl-xs"
                  }`}
                >
                  {/* Content */}
                  {m.role === "assistant" ? (
                    <div>
                      <FormattedContent content={m.content} />
                      {m.citedRules && m.citedRules.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Statutory Citations:
                          </span>
                          {m.citedRules.map((r, rIdx) => (
                            <RuleTag key={rIdx} reference={r} />
                          ))}
                        </div>
                      )}

                      {/* Samadhan AI Direct Studio Link */}
                      {(m.content.includes("Samadhan AI") || m.content.includes("gemini-nano-banana-2.1")) && (
                        <div className="mt-3 pt-2 border-t border-purple-200/60 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                            <Sparkles size={13} className="text-purple-600" />
                            <span>Samadhan AI Label Generator Ready</span>
                          </span>
                          <Link
                            href="/samadhan"
                            className="inline-flex items-center gap-1 rounded-md bg-gov-navy hover:bg-gov-navy-light text-white font-bold text-[11px] px-2.5 py-1 shadow-2xs transition-colors"
                          >
                            <span>Open in Samadhan AI Studio</span>
                            <ArrowUpRight size={12} />
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm font-medium leading-relaxed">{m.content}</p>
                  )}

                  {/* Copy Button */}
                  {m.role === "assistant" && !m.isError && (
                    <button
                      type="button"
                      onClick={() => copyMessage(idx, m.content)}
                      title="Copy response"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-gov-navy transition-all"
                    >
                      {copiedIdx === idx ? (
                        <Check size={13} className="text-emerald-600" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gov-navy text-gov-saffron flex items-center justify-center shrink-0">
                  <Scale size={16} />
                </div>
                <div className="rounded-2xl rounded-tl-xs bg-slate-50 border border-slate-200 p-3.5 flex items-center gap-2 text-xs text-slate-600">
                  <Loader2 size={14} className="animate-spin text-gov-saffron" />
                  <span>Searching statutory corpus &amp; generating legal guidance...</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50/70 overflow-x-auto flex items-center gap-2 text-xs">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
              Suggested:
            </span>
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => send(s)}
                disabled={sending}
                className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-gov-navy hover:text-gov-navy hover:bg-slate-50 transition-all shadow-2xs"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="border-t border-slate-200 p-3 sm:p-4 bg-white rounded-b-2xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about Rule 6 declarations, MRP overcharging, FSSAI rules..."
                className="flex-1 rounded-xl border border-slate-300 bg-slate-50/70 py-2.5 px-4 text-xs sm:text-sm outline-none transition-colors focus:border-gov-navy focus:bg-white focus:ring-1 focus:ring-gov-navy"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="rounded-xl bg-gov-navy hover:bg-gov-navy-light text-white p-2.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-semibold shadow-xs transition-all disabled:opacity-40 flex items-center gap-1.5"
              >
                <Send size={15} className="text-gov-saffron" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
