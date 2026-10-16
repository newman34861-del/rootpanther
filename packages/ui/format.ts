import type { Tone } from "./types";

export function cx(...parts: unknown[]): string {
  return parts.filter((p) => typeof p === "string" && p).join(" ");
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${String(r).padStart(2, "0")}m`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const DAY = 86400000;

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  return new Date(iso).toLocaleDateString("en-GB", opts);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const wrap = (v: string) => (future ? `in ${v}` : `${v} ago`);
  if (abs < 60000) return future ? "in under a minute" : "just now";
  if (abs < 3600000) return wrap(`${Math.round(abs / 60000)}m`);
  if (abs < DAY) return wrap(`${Math.round(abs / 3600000)}h`);
  if (abs < 7 * DAY) return wrap(`${Math.round(abs / DAY)}d`);
  return formatDate(iso, { day: "numeric", month: "short" });
}

export function formatMoney(amount: number, currency = "USD", fractionDigits?: number): string {
  const digits = fractionDigits ?? (Number.isInteger(amount) ? 0 : 2);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(amount)
    .replace(/^-/, "\u2212");
}

export function formatCompactMoney(amount: number, currency = "USD"): string {
  if (Math.abs(amount) < 10000) return formatMoney(amount, currency, 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatNumber(n: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatPercent(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export function formatDelta(n: number, digits = 1, unit = "%"): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(digits)}${unit}`;
}

export function toneVar(tone: Tone | undefined): string {
  switch (tone) {
    case "primary":
      return "var(--primary)";
    case "success":
      return "var(--success)";
    case "info":
      return "var(--info)";
    case "med":
      return "var(--med)";
    case "high":
      return "var(--high)";
    case "crit":
      return "var(--crit)";
    case "premium":
      return "var(--premium)";
    default:
      return "var(--text-main)";
  }
}

export function toneInk(tone: Tone | undefined): string {
  return tone === "primary" ? "var(--primary-ink)" : toneVar(tone);
}
