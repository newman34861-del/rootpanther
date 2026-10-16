import type { ActivityItem, Tone } from "@rootpanther/ui";
import { minutesAgo } from "./time";
import { users } from "./users";

export type RangeId = "7d" | "30d" | "90d" | "12m";

export const RANGES: { id: RangeId; days: number; long: string }[] = [
  { id: "7d", days: 7, long: "7 days" },
  { id: "30d", days: 30, long: "30 days" },
  { id: "90d", days: 90, long: "90 days" },
  { id: "12m", days: 365, long: "12 months" },
];

export const PRICE = { monthly: 49, annual: 490 / 12, team: 39 };

const N = 760;
const DAY = 86400000;
// Mock "as of" time of day: today's flows cover this share of a full day.
const TODAY_FRACTION = 0.58;
const STRIPE_RATE = 0.034;
const ONYX_PER_MTOKEN = 4.56;
const AZURE_PER_LAB_HOUR = 0.405;
const AZURE_FIXED_DAY = 104;
const ORPHAN_COST = [168, 196, 214, 231];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(48151623);
const noise = (amp: number) => 1 + (rnd() - 0.5) * 2 * amp;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const grow = (a: number, b: number, t: number) => a * Math.pow(b / a, t);

function counter() {
  let carry = 0;
  return (x: number) => {
    carry += x;
    const n = Math.floor(carry);
    carry -= n;
    return n;
  };
}

const today = new Date();
today.setHours(0, 0, 0, 0);
const dates: Date[] = Array.from({ length: N }, (_, i) => new Date(today.getTime() - (N - 1 - i) * DAY));

const SIGNUP_DOW = [0.98, 1.12, 1.08, 1.04, 1.0, 0.9, 0.88];
const ACTIVE_DOW = [1.14, 0.95, 0.94, 0.95, 0.96, 0.98, 1.12];

interface Day {
  visitors: number;
  signups: number;
  trials: number;
  paid: number;
  churned: number;
  lostMrr: number;
  churnedMrr: number;
  subs: number;
  activeTrials: number;
  mrr: number;
  mrrMonthly: number;
  mrrAnnual: number;
  dau: number;
  wau: number;
  mau: number;
  labHours: number;
  peak: number;
  concurrent: number;
  azure: number;
  onyx: number;
  failed: number;
  tickets: number;
}

function simulate(): Day[] {
  const c = { signup: counter(), trial: counter(), paid: counter(), m: counter(), a: counter(), chM: counter(), chA: counter(), chT: counter(), sw: counter(), fail: counter() };
  let monthly = 600;
  let annual = 190;
  let team = 52;
  const trialLog: number[] = [];
  const out: Day[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const f = i === N - 1 ? TODAY_FRACTION : 1;
    const dow = dates[i].getDay();
    const signups = c.signup(grow(14.2, 34.5, t) * SIGNUP_DOW[dow] * noise(0.14) * f);
    const trials = c.trial(signups * lerp(0.385, 0.412, t) * noise(0.06));
    trialLog.push(trials);
    const cohort = i >= 7 ? trialLog[i - 7] : trials;
    const paid = c.paid(cohort * lerp(0.375, 0.42, t) * noise(0.08) * f);
    const toM = c.m(paid * 0.62);
    const toA = Math.min(paid - toM, c.a(paid * 0.25));
    const toT = paid - toM - toA;
    const churnM = c.chM(monthly * (lerp(0.037, 0.0335, t) / 30) * noise(0.35) * f);
    const churnA = c.chA(annual * (0.0105 / 30) * noise(0.5) * f);
    const churnT = c.chT(team * (0.015 / 30) * noise(0.5) * f);
    const switches = c.sw(monthly * (0.0042 / 30) * noise(0.5) * f);
    monthly += toM - churnM - switches;
    annual += toA - churnA + switches;
    team += toT - churnT;
    const subs = monthly + annual + team;
    const activeTrials = trialLog.slice(Math.max(0, i - 6), i + 1).reduce((x, y) => x + y, 0);
    const churnedMrr = churnM * PRICE.monthly + churnA * PRICE.annual + churnT * PRICE.team;
    const pool = subs + activeTrials;
    const dau = Math.round(pool * 0.402 * ACTIVE_DOW[dow] * noise(0.05));
    const mau = Math.round(pool * 1.118 * noise(0.006));
    const labHours = Math.round(dau * 1.74 * noise(0.07) * f);
    const orphan = i >= N - ORPHAN_COST.length ? ORPHAN_COST[i - (N - ORPHAN_COST.length)] * f : 0;
    const peak = Math.round((labHours / f / 24) * 2.9 * noise(0.06));
    out.push({
      visitors: Math.round(signups / (lerp(0.0232, 0.0246, t) * noise(0.05))),
      signups,
      trials,
      paid,
      churned: churnM + churnA + churnT,
      churnedMrr,
      lostMrr: churnedMrr + switches * (PRICE.monthly - PRICE.annual),
      subs,
      activeTrials,
      mrr: monthly * PRICE.monthly + annual * PRICE.annual + team * PRICE.team,
      mrrMonthly: monthly * PRICE.monthly,
      mrrAnnual: annual * PRICE.annual,
      dau,
      wau: Math.round(mau * 0.692 * noise(0.012)),
      mau,
      labHours,
      peak,
      concurrent: Math.round(peak * 0.62 * noise(0.1)),
      azure: labHours * AZURE_PER_LAB_HOUR + AZURE_FIXED_DAY * f + orphan,
      onyx: labHours * 0.121 * noise(0.08),
      failed: c.fail(subs * 0.00026 * noise(0.6) * f),
      tickets: Math.round(subs * 0.0095 * noise(0.14)),
    });
  }
  out[N - 1].tickets = 23;
  return out;
}

const days = simulate();
const L = N - 1;
const now = days[L];

function sum(key: keyof Day, from: number, to: number): number {
  let s = 0;
  for (let i = Math.max(0, from); i <= to; i++) s += days[i][key];
  return s;
}

function avg(key: keyof Day, from: number, to: number): number {
  return sum(key, from, to) / (to - Math.max(0, from) + 1);
}

function windowOf(range: RangeId) {
  const len = RANGES.find((r) => r.id === range)!.days;
  return { len, start: L - len + 1, base: L - len, prevStart: L - 2 * len + 1, prevEnd: L - len };
}

function trend(range: RangeId, fn: (i: number) => number, max = 30): number[] {
  const from = windowOf(range).base;
  const span = L - 1 - from;
  const n = Math.min(max, span + 1);
  return Array.from({ length: n }, (_, k) => fn(from + Math.round((k / Math.max(1, n - 1)) * span)));
}

const smoothed = (key: keyof Day, w = 7) => (i: number) => avg(key, i - w + 1, i);
const pct = (a: number, b: number) => (b === 0 ? 0 : ((a - b) / b) * 100);
const round1 = (n: number) => Math.round(n * 10) / 10;

const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
const dayOfMonth = today.getDate();
const monthStart = L - (dayOfMonth - 1);
const prevMonthFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1);
const prevMonthStart = L - Math.round((today.getTime() - prevMonthFirst.getTime()) / DAY);
const prevMonthDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
const prevSame = prevMonthStart + Math.min(dayOfMonth, prevMonthDays) - 1;
const elapsed = dayOfMonth - 1 + TODAY_FRACTION;
const prevElapsed = Math.min(dayOfMonth, prevMonthDays) - 1 + TODAY_FRACTION;

const mtd = (key: keyof Day) => sum(key, monthStart, L);
const prevMtd = (key: keyof Day) => sum(key, prevMonthStart, prevSame - 1) + days[prevSame][key] * TODAY_FRACTION;
const project = (key: keyof Day) => mtd(key) + (daysInMonth - elapsed) * avg(key, L - 7, L - 1);

function revenueBetween(from: number, to: number, dim: number): number {
  let s = 0;
  for (let i = from; i <= to; i++) s += (days[i].mrr / dim) * (i === to ? TODAY_FRACTION : 1);
  return s;
}

const marginOf = (rev: number, cost: number) => ((rev - cost - rev * STRIPE_RATE) / rev) * 100;

export const MTD_COMPARE = `vs 1 to ${Math.min(dayOfMonth, prevMonthDays)} ${prevMonthFirst.toLocaleDateString("en-GB", { month: "short" }).slice(0, 3)}`;

export interface Kpis {
  mrr: number;
  arr: number;
  subs: number;
  netSubs: number;
  trials: number;
  trialStarts: number;
  paid: number;
  conversion: number;
  nrr: number;
  logoChurn: number;
  revenueChurn: number;
  signups: number;
  signupsToday: number;
  signups7d: number;
  signups30d: number;
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
  concurrent: number;
  peakToday: number;
  labHoursToday: number;
  labHoursMonth: number;
  azureMtd: number;
  azureProjected: number;
  revenueMtd: number;
  grossMargin: number;
  costPerUser: number;
  onyxMtd: number;
  onyxTokensMtd: number;
  failed: number;
  dunning: number;
  mrrAtRisk: number;
  ticketsOpen: number;
  ticketsStale: number;
  deltas: Record<string, number>;
  sparks: Record<string, number[]>;
}

function churnRates(start: number, end: number, base: number, len: number) {
  const scale = 30 / len;
  return {
    logo: (sum("churned", start, end) / days[base].subs) * 100 * scale,
    revenue: (sum("churnedMrr", start, end) / days[base].mrr) * 100 * scale,
    nrr: 100 - (sum("lostMrr", start, end) / days[base].mrr) * 100 * scale,
  };
}

const pastDue = users.filter((u) => u.status === "past-due");
const MRR_OF = { free: 0, practitioner: PRICE.monthly, "practitioner-annual": PRICE.annual, team: PRICE.team };

export function kpis(range: RangeId): Kpis {
  const w = windowOf(range);
  const b = days[w.base];
  const paid = sum("paid", w.start, L);
  const trialStarts = sum("trials", w.start, L);
  const prevConversion = (sum("paid", w.prevStart, w.prevEnd) / sum("trials", w.prevStart, w.prevEnd)) * 100;
  const cur = churnRates(w.start, L, w.base, w.len);
  const prev = churnRates(w.prevStart, w.prevEnd, w.prevStart - 1, w.len);
  const signups = sum("signups", w.start, L);
  const conversion = (paid / trialStarts) * 100;

  const mrr = Math.round(now.mrr);
  const revenueMtd = revenueBetween(monthStart, L, daysInMonth);
  const prevRevenue = revenueBetween(prevMonthStart, prevSame, prevMonthDays);
  const azureMtd = mtd("azure");
  const onyxMtd = mtd("onyx");
  const grossMargin = marginOf(revenueMtd, azureMtd + onyxMtd);
  const prevMargin = marginOf(prevRevenue, prevMtd("azure") + prevMtd("onyx"));
  const azureProjected = project("azure");
  const costPerUser = (azureProjected + project("onyx")) / now.mau;
  const prevCostPerUser = (((prevMtd("azure") + prevMtd("onyx")) / prevElapsed) * prevMonthDays) / days[prevSame].mau;
  const stickiness = (now.dau / now.mau) * 100;
  const failed = sum("failed", w.start, L);

  return {
    mrr,
    arr: mrr * 12,
    subs: now.subs,
    netSubs: now.subs - b.subs,
    trials: now.activeTrials,
    trialStarts,
    paid,
    conversion,
    nrr: cur.nrr,
    logoChurn: cur.logo,
    revenueChurn: cur.revenue,
    signups,
    signupsToday: now.signups,
    signups7d: sum("signups", L - 6, L),
    signups30d: sum("signups", L - 29, L),
    dau: now.dau,
    wau: now.wau,
    mau: now.mau,
    stickiness,
    concurrent: now.concurrent,
    peakToday: now.peak,
    labHoursToday: now.labHours,
    labHoursMonth: mtd("labHours"),
    azureMtd,
    azureProjected,
    revenueMtd,
    grossMargin,
    costPerUser,
    onyxMtd,
    onyxTokensMtd: (onyxMtd / ONYX_PER_MTOKEN) * 1e6,
    failed,
    dunning: pastDue.length,
    mrrAtRisk: Math.round(pastDue.reduce((a, u) => a + MRR_OF[u.plan], 0)),
    ticketsOpen: now.tickets,
    ticketsStale: 4,
    deltas: {
      mrr: pct(now.mrr, b.mrr),
      subs: pct(now.subs, b.subs),
      trials: pct(now.activeTrials, b.activeTrials),
      conversion: round1(conversion) - round1(prevConversion),
      nrr: round1(cur.nrr) - round1(prev.nrr),
      logoChurn: round1(cur.logo) - round1(prev.logo),
      signups: pct(signups, sum("signups", w.prevStart, w.prevEnd)),
      dau: pct(now.dau, b.dau),
      mau: pct(now.mau, b.mau),
      stickiness: round1(stickiness) - round1((b.dau / b.mau) * 100),
      concurrent: pct(now.concurrent, b.concurrent),
      labHours: pct(mtd("labHours"), prevMtd("labHours")),
      azure: pct(azureMtd, prevMtd("azure")),
      margin: round1(grossMargin) - round1(prevMargin),
      costPerUser: pct(costPerUser, prevCostPerUser),
      onyx: pct(onyxMtd, prevMtd("onyx")),
      failed: pct(failed, sum("failed", w.prevStart, w.prevEnd)),
      tickets: pct(now.tickets, b.tickets),
    },
    sparks: {
      mrr: trend(range, (i) => days[i].mrr),
      subs: trend(range, (i) => days[i].subs),
      trials: trend(range, (i) => days[i].activeTrials),
      conversion: trend(range, (i) => (sum("paid", i - 29, i) / sum("trials", i - 29, i)) * 100),
      nrr: trend(range, (i) => 100 - (sum("lostMrr", i - 29, i) / days[i - 30].mrr) * 100),
      logoChurn: trend(range, (i) => (sum("churned", i - 29, i) / days[i - 30].subs) * 100),
      signups: trend(range, smoothed("signups")),
      dau: trend(range, smoothed("dau")),
      mau: trend(range, (i) => days[i].mau),
      stickiness: trend(range, (i) => (avg("dau", i - 6, i) / days[i].mau) * 100),
      concurrent: trend(range, smoothed("peak")),
      labHours: trend(range, smoothed("labHours")),
      azure: trend(range, smoothed("azure")),
      margin: trend(range, (i) => marginOf(days[i].mrr / 30, avg("azure", i - 6, i) + avg("onyx", i - 6, i))),
      costPerUser: trend(range, (i) => ((avg("azure", i - 6, i) + avg("onyx", i - 6, i)) * 30) / days[i].mau),
      onyx: trend(range, smoothed("onyx")),
      failed: trend(range, smoothed("failed", 14)),
      tickets: trend(range, (i) => days[i].tickets),
    },
  };
}

export type RevenueRange = "90d" | "12m" | "24m";

export interface RevenueSeries {
  x: string[];
  monthly: number[];
  annual: number[];
  team: number[];
}

const monthLabel = (d: Date) => d.toLocaleDateString("en-GB", { month: "short" }).slice(0, 3);

export function revenue(range: RevenueRange): RevenueSeries {
  const pts: { idx: number; label: string }[] = [];
  if (range === "90d") {
    for (let k = 12; k >= 0; k--) {
      const idx = L - k * 7;
      pts.push({ idx, label: `${dates[idx].getDate()} ${monthLabel(dates[idx])}` });
    }
  } else {
    const months = range === "12m" ? 12 : 24;
    for (let k = months - 1; k >= 0; k--) {
      const end = new Date(today.getFullYear(), today.getMonth() - k + 1, 0);
      const idx = k === 0 ? L : L - Math.round((today.getTime() - end.getTime()) / DAY);
      pts.push({ idx, label: `${monthLabel(dates[idx])} ${String(dates[idx].getFullYear()).slice(2)}` });
    }
  }
  const monthly = pts.map((p) => Math.round(days[p.idx].mrrMonthly));
  const annual = pts.map((p) => Math.round(days[p.idx].mrrAnnual));
  return {
    x: pts.map((p) => p.label),
    monthly,
    annual,
    team: pts.map((p, i) => Math.round(days[p.idx].mrr) - monthly[i] - annual[i]),
  };
}

export interface FunnelData {
  visitors: number;
  signups: number;
  trials: number;
  paid: number;
  active: number;
}

export function funnel(range: RangeId): FunnelData {
  const w = windowOf(range);
  const paid = sum("paid", w.start, L);
  return {
    visitors: sum("visitors", w.start, L),
    signups: sum("signups", w.start, L),
    trials: sum("trials", w.start, L),
    paid,
    active: Math.round(paid * 0.874),
  };
}

export interface Cohort {
  label: string;
  size: number;
  values: (number | null)[];
}

const RETENTION = [100, 88.4, 82.1, 78.6, 74.2, 69.5, 66.8, 64.9, 63.1, 61.6, 60.4, 59.5];

export function cohorts(): Cohort[] {
  const r = mulberry32(1015);
  const out: Cohort[] = [];
  for (let c = 11; c >= 0; c--) {
    const first = new Date(today.getFullYear(), today.getMonth() - c, 1);
    const last = new Date(today.getFullYear(), today.getMonth() - c + 1, 0);
    const s = L - Math.round((today.getTime() - first.getTime()) / DAY);
    const e = c === 0 ? L : L - Math.round((today.getTime() - last.getTime()) / DAY);
    const size = sum("paid", s, e);
    const lift = (11 - c) * 0.11;
    const values: (number | null)[] = RETENTION.map((v, k) => {
      if (k > c) return null;
      if (k === 0) return 100;
      const retained = Math.round(((v + lift * Math.min(k, 4) + (r() - 0.5) * 2.4) / 100) * size);
      return round1((retained / size) * 100);
    });
    for (let k = 2; k < values.length; k++) {
      const p = values[k - 1];
      const v = values[k];
      if (v !== null && p !== null && v > p) values[k] = p;
    }
    out.push({ label: `${monthLabel(first)} ${first.getFullYear()}`, size, values });
  }
  return out;
}

export function retentionAt(rows: Cohort[], month: number): number {
  const vals = rows.flatMap((c) => (c.values[month] === null ? [] : [{ v: c.values[month] as number, n: c.size }]));
  const n = vals.reduce((a, x) => a + x.n, 0);
  return vals.reduce((a, x) => a + x.v * x.n, 0) / n;
}

export interface Alert {
  id: string;
  severity: "crit" | "high" | "med";
  title: string;
  detail: string;
  at: string;
  action: { label: string; to: string };
}

export const SEVERITY: Record<Alert["severity"], { label: string; tone: Tone }> = {
  crit: { label: "Critical", tone: "crit" },
  high: { label: "High", tone: "high" },
  med: { label: "Medium", tone: "med" },
};

export function alerts(k: Kpis): Alert[] {
  const baseline = avg("azure", L - 11, L - 5);
  const yesterday = days[L - 1].azure;
  return [
    {
      id: "al-prov",
      severity: "crit",
      title: "Provisioning failures in uksouth",
      detail: "9 of 214 launches failed in the last hour, threshold 2%. Learners were not charged lab hours.",
      at: minutesAgo(12),
      action: { label: "Open fleet", to: "/fleet?region=uksouth" },
    },
    {
      id: "al-solve",
      severity: "crit",
      title: "Solve-test failed: Cinder v2.4.0",
      detail: "Unintended path through an SMB null session on CIN-FS01. Publishing is blocked.",
      at: minutesAgo(47),
      action: { label: "Open solve-test", to: "/content#solve-tests" },
    },
    {
      id: "al-cost",
      severity: "high",
      title: `Azure spend ${Math.round(pct(yesterday, baseline))}% above 7-day baseline`,
      detail: `3 orphaned tenants past max life cost $${ORPHAN_COST[ORPHAN_COST.length - 2]} yesterday. Month end projected at $${Math.round(k.azureProjected).toLocaleString("en-US")}.`,
      at: minutesAgo(184),
      action: { label: "Review orphans", to: "/fleet?filter=orphaned" },
    },
    {
      id: "al-dunning",
      severity: "med",
      title: `${k.dunning} accounts in dunning`,
      detail: `Past due after failed payments. $${k.mrrAtRisk} MRR at risk.`,
      at: minutesAgo(306),
      action: { label: "Open dunning", to: "/billing#dunning" },
    },
  ];
}

const SCENARIOS = ["Meridian", "Ironwood", "Basalt", "Juniper", "Granite", "Halcyon", "Kestrel", "Vesper", "Cinder", "Quarry"];
const REGIONS = ["eastus2", "uksouth", "westeurope", "centralindia", "australiaeast"];
const CANCEL_REASONS = ["passed the exam", "too expensive", "not enough time", "exam booked later"];
const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";

export function feedGenerator(seed = 7) {
  const r = mulberry32(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const tenant = () => `rp-t-${Array.from({ length: 6 }, () => B36[Math.floor(r() * 36)]).join("")}`;
  const active = users.filter((u) => u.status === "active" && u.plan !== "free");
  const trial = users.filter((u) => u.status === "trial");
  let n = 0;
  return (at: string): ActivityItem => {
    n += 1;
    const id = `ev-${seed}-${n}`;
    const x = r();
    const u = pick(active);
    const href = `/users/${u.id}`;
    if (x < 0.34) return { id, kind: "launch", title: `Lab launched: ${pick(SCENARIOS)}`, detail: `${u.email}, ${pick(REGIONS)}, ${tenant()}`, at, href };
    if (x < 0.48) return { id, kind: "proof", title: `Proof captured: ${pick(SCENARIOS)}`, detail: `${u.email}, proof.txt`, at, tone: "success", href };
    if (x < 0.62) {
      const t = pick(trial);
      return { id, kind: "signup", title: "Signup, trial started", detail: t.email, at, tone: "primary", href: `/users/${t.id}` };
    }
    if (x < 0.73) {
      const annual = r() < 0.3;
      return { id, kind: "upgrade", title: annual ? "Converted to Practitioner annual" : "Converted to Practitioner", detail: `${u.email}, ${annual ? "$490.00 a year" : "$49.00 a month"}`, at, tone: "primary", href };
    }
    if (x < 0.83) return { id, kind: "lab-ended", title: `Lab ended: ${pick(SCENARIOS)}`, detail: `${u.email}, ${(0.8 + r() * 3).toFixed(1)} h charged`, at, href };
    if (x < 0.89) return { id, kind: "cancel", title: "Subscription cancelled", detail: `${u.email}, reason: ${pick(CANCEL_REASONS)}`, at, href };
    if (x < 0.95) return { id, kind: "payment-failed", title: `Payment failed, retry ${1 + Math.floor(r() * 3)} of 4`, detail: `${u.email}, $49.00, card_declined`, at, tone: "high", href };
    const tn = tenant();
    return { id, kind: "provision-failed", title: `Provision failed: ${pick(SCENARIOS)}`, detail: `${tn}, uksouth, not charged`, at, tone: "crit", href: `/fleet?tenant=${tn}` };
  };
}

export function initialFeed(): ActivityItem[] {
  const gen = feedGenerator(3);
  return [0.4, 1, 2, 3, 5, 6, 8, 11, 13, 16, 19, 23, 27, 31, 36, 42, 49, 55, 61, 68].map((m) => gen(minutesAgo(m)));
}
