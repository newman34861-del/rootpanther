import { onyxKpis } from "./onyx-ops";
import { firstOfThisMonth } from "./time";

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export const PAYMENT_FEE = { percent: 2.9, fixed: 0.3 };

export interface CalcInputs {
  price: number;
  users: number;
  hours: number;
  compute: number;
  onyx: number;
  fixed: number;
}

export const CALC_LIMITS: Record<keyof CalcInputs, { min: number; max: number; step: number }> = {
  price: { min: 9, max: 149, step: 0.5 },
  users: { min: 0, max: 10000, step: 10 },
  hours: { min: 1, max: 80, step: 0.5 },
  compute: { min: 0.1, max: 2, step: 0.01 },
  onyx: { min: 0, max: 1.5, step: 0.01 },
  fixed: { min: 0, max: 60000, step: 100 },
};

const now = new Date();
const monthStart = new Date(firstOfThisMonth());
const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
const elapsed = Math.min(daysInMonth, Math.max(1, (now.getTime() - new Date(monthStart).setHours(0, 0, 0, 0)) / 86400000));

export const period = {
  monthStart: monthStart.toISOString(),
  daysInMonth,
  elapsedDays: round(elapsed, 1),
  fraction: elapsed / daysInMonth,
};

export interface PlanMargin {
  id: string;
  plan: string;
  billing: string;
  users: number;
  pricePerMonth: number;
  hours: number;
  charge: number;
  chargesPerYear: number;
}

export const planMargins: PlanMargin[] = [
  { id: "prac-m", plan: "Practitioner", billing: "Monthly", users: 812, pricePerMonth: 49, hours: 24.6, charge: 49, chargesPerYear: 12 },
  { id: "prac-y", plan: "Practitioner", billing: "Annual, $468", users: 428, pricePerMonth: 39, hours: 20.6, charge: 468, chargesPerYear: 1 },
  { id: "trial", plan: "Trial", billing: "7 days, 5 h cap", users: 186, pricePerMonth: 0, hours: 4.8, charge: 0, chargesPerYear: 0 },
  { id: "comp", plan: "Comped", billing: "Staff and partners", users: 22, pricePerMonth: 0, hours: 9.5, charge: 0, chargesPerYear: 0 },
];

export function feePerMonth(charge: number, chargesPerYear: number): number {
  if (charge === 0 || chargesPerYear === 0) return 0;
  return ((charge * PAYMENT_FEE.percent) / 100 + PAYMENT_FEE.fixed) * (chargesPerYear / 12);
}

const paid = planMargins.filter((p) => p.pricePerMonth > 0);
const paidUsers = paid.reduce((a, p) => a + p.users, 0);
const allHours = planMargins.reduce((a, p) => a + p.users * p.hours, 0);
const paidHours = paid.reduce((a, p) => a + p.users * p.hours, 0);

export type CostCategory = "azure" | "stripe" | "ai" | "fixed";

export const COST_CATEGORY_LABEL: Record<CostCategory, string> = {
  azure: "Azure lab infrastructure",
  stripe: "Stripe fees",
  ai: "AI tokens",
  fixed: "Fixed infrastructure",
};

export interface CostLine {
  id: string;
  category: CostCategory;
  label: string;
  detail: string;
  monthRate: number;
  lastMonth: number;
  href?: string;
}

const onyxMonth = round(onyxKpis.projectedMonth, 0);
const cardFees = round(
  paid.reduce((a, p) => a + p.users * feePerMonth(p.charge, p.chargesPerYear), 0),
  0,
);

export const costLines: CostLine[] = [
  { id: "vm", category: "azure", label: "Virtual machines", detail: "Lab hosts, B2ms and D2s_v5", monthRate: 11140, lastMonth: 10180, href: "/fleet" },
  { id: "disk", category: "azure", label: "Managed disks and snapshots", detail: "Premium SSD, image snapshots", monthRate: 2410, lastMonth: 2290, href: "/fleet" },
  { id: "fw", category: "azure", label: "Azure Firewall", detail: "Egress deny, 2 regions", monthRate: 1308, lastMonth: 1308 },
  { id: "logs", category: "azure", label: "Log Analytics", detail: "Lab telemetry, 30-day retention", monthRate: 1162, lastMonth: 1088 },
  { id: "net", category: "azure", label: "Networking", detail: "VNets, NAT gateway, public IPs", monthRate: 1040, lastMonth: 960 },
  { id: "blob", category: "azure", label: "Storage", detail: "Images, randomisation artefacts", monthRate: 508, lastMonth: 492 },
  {
    id: "card",
    category: "stripe",
    label: "Card processing",
    detail: `${PAYMENT_FEE.percent}% + $${PAYMENT_FEE.fixed.toFixed(2)} per charge`,
    monthRate: cardFees,
    lastMonth: 1842,
    href: "/billing",
  },
  { id: "billing", category: "stripe", label: "Stripe Billing and Tax", detail: "0.7% billing, 0.5% tax", monthRate: 676, lastMonth: 652, href: "/billing" },
  { id: "primary", category: "ai", label: "Primary model", detail: "Coach, Teach, Walkthrough, debriefs", monthRate: round(onyxMonth * 0.824, 0), lastMonth: 9420, href: "/onyx" },
  { id: "fast", category: "ai", label: "Fast model", detail: "Nudge, routing, spoiler checks", monthRate: round(onyxMonth * 0.176, 0), lastMonth: 1980, href: "/onyx" },
  { id: "aks", category: "fixed", label: "Control plane cluster", detail: "AKS, 3 system nodes", monthRate: 2160, lastMonth: 2160, href: "/system" },
  { id: "obs", category: "fixed", label: "Observability", detail: "Metrics, traces, uptime checks", monthRate: 1480, lastMonth: 1420 },
  { id: "pg", category: "fixed", label: "PostgreSQL", detail: "Flexible Server, zone redundant", monthRate: 1010, lastMonth: 1010, href: "/system" },
  { id: "ci", category: "fixed", label: "Solve-test CI runners", detail: "Nightly scenario verification", monthRate: 860, lastMonth: 910, href: "/content" },
  { id: "backup", category: "fixed", label: "Backups and DR", detail: "Geo-redundant, 35-day retention", monthRate: 390, lastMonth: 390 },
  { id: "misc", category: "fixed", label: "Email, DNS, domains", detail: "Transactional email, 4 zones", monthRate: 300, lastMonth: 296 },
];

export const costMtd = (c: CostLine) => round(c.monthRate * period.fraction, 0);

const total = (cat: CostCategory) => costLines.filter((c) => c.category === cat).reduce((a, c) => a + c.monthRate, 0);

export const actuals = {
  paidUsers,
  activeUsers: planMargins.reduce((a, p) => a + p.users, 0),
  lastMonthRevenue: 52880,
  revenue: round(
    paid.reduce((a, p) => a + p.users * p.pricePerMonth, 0),
    0,
  ),
  allHours: round(allHours, 0),
  paidHours: round(paidHours, 0),
  azure: total("azure"),
  ai: total("ai"),
  fixed: total("fixed"),
  stripe: total("stripe"),
};

export const VARIABLE_PER_HOUR = round((actuals.azure + actuals.ai) / allHours, 2);

export const CALC_DEFAULTS: CalcInputs = {
  price: Math.round((actuals.revenue / paidUsers) * 2) / 2,
  users: paidUsers,
  hours: Math.round((paidHours / paidUsers) * 2) / 2,
  compute: round(actuals.azure / allHours, 2),
  onyx: round(onyxKpis.spend30 / onyxKpis.hours30, 2),
  fixed: actuals.fixed,
};

export interface CohortMargin {
  month: string;
  signups: number;
  paying: number;
  hours: number;
  partial?: boolean;
}

function monthsAgo(n: number) {
  const d = new Date(monthStart);
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
}

export const cohortMargins: CohortMargin[] = [
  { month: monthsAgo(6), signups: 310, paying: 142, hours: 16.8 },
  { month: monthsAgo(5), signups: 284, paying: 151, hours: 18.2 },
  { month: monthsAgo(4), signups: 352, paying: 196, hours: 19.6 },
  { month: monthsAgo(3), signups: 398, paying: 233, hours: 21.0 },
  { month: monthsAgo(2), signups: 446, paying: 271, hours: 23.1 },
  { month: monthsAgo(1), signups: 512, paying: 214, hours: 25.4 },
  { month: monthsAgo(0), signups: 241, paying: 33, hours: 27.9, partial: true },
];
