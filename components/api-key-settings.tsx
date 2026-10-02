"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { useApiKey } from "@/lib/api-key-context";
import { cn } from "@/lib/utils";

/** Inline key entry, reused in the nav popover and wherever a key is needed. */
export function ApiKeyField({ compact = false }: { compact?: boolean }) {
  const { apiKey, setApiKey } = useApiKey();
  const [draft, setDraft] = useState(apiKey);
  useEffect(() => setDraft(apiKey), [apiKey]);

  return (
    <div>
      <label htmlFor={compact ? "api-key-inline" : "api-key"} className="block text-xs font-medium text-ink">
        OpenRouter API key
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={compact ? "api-key-inline" : "api-key"}
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== apiKey && setApiKey(draft.trim())}
          onKeyDown={(e) => e.key === "Enter" && setApiKey(draft.trim())}
          placeholder="sk-or-…"
          className="min-w-0 flex-1 rounded-md border border-rule bg-paper px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        {apiKey ? (
          <button
            type="button"
            onClick={() => {
              setApiKey("");
              setDraft("");
            }}
            className="rounded-md border border-rule px-2.5 text-xs text-ink-2 hover:text-ink"
          >
            Clear
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setApiKey(draft.trim())}
            disabled={!draft.trim()}
            className="rounded-md bg-ink px-3 text-xs font-medium text-paper disabled:opacity-40"
          >
            Save
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">
        Stored only in this browser and sent with your requests to OpenRouter. Create one at{" "}
        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          openrouter.ai/keys
        </a>
        ; consider revoking it when you are done.
      </p>
    </div>
  );
}

export function ApiKeySettings() {
  const { apiKey } = useApiKey();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
          apiKey
            ? "border-rule text-ink-2 hover:text-ink"
            : "border-accent/40 bg-accent-soft text-accent-ink hover:border-accent"
        )}
      >
        <KeyRound size={14} aria-hidden />
        <span className="hidden sm:inline">{apiKey ? "Key saved" : "Add API key"}</span>
        {apiKey && <span className="h-1.5 w-1.5 rounded-full bg-[#2f9e6b]" aria-hidden />}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="OpenRouter API key"
          className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-rule bg-surface p-4 shadow-xl"
        >
          <ApiKeyField />
          <p className="mt-3 border-t border-rule pt-3 text-[11px] leading-relaxed text-ink-3">
            Needed only to run new probes or your own questions. Browsing the 116 questions needs no key.
          </p>
        </div>
      )}
    </div>
  );
}
