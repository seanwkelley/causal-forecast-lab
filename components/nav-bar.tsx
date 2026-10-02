"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ApiKeySettings } from "./api-key-settings";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/explore", label: "Questions" },
  { href: "/live", label: "Run your own" },
  { href: "/about", label: "About" },
];

/** Three causes feeding one outcome. */
function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="shrink-0">
      <path d="M5 5 C11 5 11 11 17 11 M5 11 L17 11 M5 17 C11 17 11 11 17 11" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-ink-3" />
      <circle cx="4.5" cy="5" r="2.5" className="fill-accent" />
      <circle cx="4.5" cy="11" r="2.5" className="fill-accent" />
      <circle cx="4.5" cy="17" r="2.5" className="fill-accent" />
      <rect x="15" y="8" width="6" height="6" rx="1.5" className="fill-ink" />
    </svg>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/85 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-ink">
          <Mark />
          <span className="font-display text-[17px] font-medium tracking-tight">Causal Forecast Lab</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive(l.href) ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ApiKeySettings />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-rule text-ink-2 md:hidden"
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </nav>
      {open && (
        <div className="border-t border-rule bg-paper px-4 py-2 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={cn(
                "block rounded-md px-2 py-2.5 text-sm",
                isActive(l.href) ? "text-ink" : "text-ink-2"
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
