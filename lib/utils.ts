import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MINUS = "−";

/** 0.12 -> "12%", 0.125 -> "12.5%" */
export function formatProbability(p: number): string {
  const pct = p * 100;
  const rounded = Math.round(pct * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

/** Signed percentage-point change: +12pp, −3.5pp, 0pp */
export function formatDelta(delta: number, digits = 1): string {
  const pp = delta * 100;
  if (Math.abs(pp) < 0.05) return "0pp";
  const abs = Math.abs(pp);
  const text = Number.isInteger(Math.round(abs * 10) / 10) ? abs.toFixed(0) : abs.toFixed(digits);
  return `${pp > 0 ? "+" : MINUS}${text}pp`;
}

/** Unsigned percentage points: 9.3pp */
export function formatPp(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}pp`;
}

export function formatSigned(value: number, digits = 2): string {
  if (Math.abs(value) < 0.5 * 10 ** -digits) return (0).toFixed(digits);
  return `${value > 0 ? "+" : MINUS}${Math.abs(value).toFixed(digits)}`;
}

/** Text colour class for a signed probability change. */
export function deltaClass(delta: number): string {
  if (Math.abs(delta) < 0.005) return "text-ink-3";
  return delta > 0 ? "text-up" : "text-down";
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1).trimEnd() + "…";
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
