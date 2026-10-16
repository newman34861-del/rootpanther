import type { Invoice, Plan } from "@rootpanther/ui";
import { formatDate } from "@rootpanther/ui";
import { currentUser, scenariosCompleted, sessionHistory } from "./account";
import { daysAgo, daysFromNow, firstOfNextMonth, firstOfThisMonth } from "./time";

export type Interval = "month" | "year";
export type PlanId = "free" | "practitioner" | "team";
export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "unknown";

export const CURRENCY = "USD";
export const TRIAL_DAYS = 7;
export const LAB_HOURS = 60;
export const IDLE_SHUTDOWN_MIN = 30;
export const SESSION_MAX_HOURS = 4;
export const BILLING_EMAIL = "billing@rootpanther.com";

const DAY = 86400000;

export function now(): string {
  return daysFromNow(0);
}

export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso) + n * DAY).toISOString();
}

export function addMonths(iso: string, n: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + n);
  return d.toISOString();
}

export function addBusinessDays(iso: string, n: number): string {
  const d = new Date(iso);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return d.toISOString();
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function dayMonth(iso: string): string {
  return formatDate(iso, { day: "numeric", month: "short" });
}

export function longDate(iso: string): string {
  return formatDate(iso);
}

export interface SeatPlan extends Plan {
  minSeats: number;
}

export const freePlan: Plan = {
  id: "free",
  name: "Free",
  priceMonthly: 0,
  currency: CURRENCY,
  summary: "Primers, drills and Onyx mentor mode. No labs.",
  labHours: null,
  features: ["C1 concept primers", "Drills, no lab needed", "Methodology playbooks", "Onyx mentor mode, 10 messages a day"],
  ctaLabel: "Create free account",
};

export const practitionerPlan: Plan = {
  id: "practitioner",
  name: "Practitioner",
  priceMonthly: 49,
  priceAnnualMonthly: 40.83,
  priceAnnualTotal: 490,
  currency: CURRENCY,
  summary: "Every lab and Onyx at every help level. 7-day trial.",
  labHours: LAB_HOURS,
  recommended: true,
  features: [
    "Every AD set, standalone and exam simulation",
    "In-browser Kali or your own Kali over OpenVPN",
    "Onyx at every help level, not metered",
    "A debrief after every lab",
    "Report exports in PDF and Markdown",
    "All primers, drills and playbooks",
  ],
  ctaLabel: "Start 7-day trial",
};

export const teamPlan: SeatPlan = {
  id: "team",
  name: "Team",
  priceMonthly: 45,
  priceAnnualMonthly: 37.5,
  priceAnnualTotal: 450,
  currency: CURRENCY,
  summary: "Practitioner for 3 or more people, managed in one place.",
  labHours: LAB_HOURS,
  minSeats: 3,
  features: ["Everything in Practitioner, per seat", "Assign and reassign seats", "Team progress: tiers, labs and reports", "One invoice for all seats"],
  ctaLabel: "Buy seats",
};

export const plans: Plan[] = [freePlan, practitionerPlan, teamPlan];

export function planById(id: string | null | undefined): Plan | undefined {
  return plans.find((p) => p.id === id);
}

export function intervalLabel(i: Interval): string {
  return i === "year" ? "annual" : "monthly";
}

export function periodPrice(planId: string, interval: Interval, seats = 1): number {
  const plan = planById(planId);
  if (!plan || plan.priceMonthly === 0) return 0;
  const unit = interval === "year" ? plan.priceAnnualTotal ?? plan.priceMonthly * 12 : plan.priceMonthly;
  return unit * (planId === "team" ? seats : 1);
}

export function annualSaving(plan: Plan): number {
  return plan.priceMonthly * 12 - (plan.priceAnnualTotal ?? plan.priceMonthly * 12);
}

export interface Subscription {
  id: string;
  planId: PlanId;
  interval: Interval;
  seats: number;
  amount: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  customerSince: string;
  paymentMethodId: string;
  email: string;
}

export const subscription: Subscription = {
  id: "sub_1Q7Hk2pQ4mX9a",
  planId: "practitioner",
  interval: "month",
  seats: 1,
  amount: 49,
  currentPeriodStart: firstOfThisMonth(),
  currentPeriodEnd: firstOfNextMonth(),
  customerSince: addMonths(firstOfThisMonth(), -6),
  paymentMethodId: "pm_1Q4417",
  email: currentUser.email,
};

export interface PaymentMethod {
  id: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  name: string;
  isDefault: boolean;
}

export const CARD_BRAND_LABEL: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  unknown: "Card",
};

export const paymentMethods: PaymentMethod[] = [
  { id: "pm_1Q4417", brand: "visa", last4: "4417", expMonth: 8, expYear: 2028, name: currentUser.name, isDefault: true },
  { id: "pm_1Q0261", brand: "mastercard", last4: "0261", expMonth: 11, expYear: 2027, name: currentUser.name, isDefault: false },
];

export function cardLabel(pm: Pick<PaymentMethod, "brand" | "last4">): string {
  return `${CARD_BRAND_LABEL[pm.brand]} ending ${pm.last4}`;
}

export function cardExpiry(pm: Pick<PaymentMethod, "expMonth" | "expYear">): string {
  return `${String(pm.expMonth).padStart(2, "0")}/${String(pm.expYear).slice(-2)}`;
}

const INVOICE_NUMBERS = ["INV-2026-0918", "INV-2026-0794", "INV-2026-0671", "INV-2026-0552", "INV-2026-0430", "INV-2026-0318", "INV-2026-0207"];

export const invoices: Invoice[] = INVOICE_NUMBERS.map((number, i) => {
  const start = addMonths(firstOfThisMonth(), -i);
  return {
    id: `in_${number.slice(-4)}`,
    number,
    date: start,
    amount: 49,
    currency: CURRENCY,
    status: "paid",
    description: `Practitioner, monthly. ${dayMonth(start)} to ${dayMonth(addMonths(start, 1))}`,
  };
});

export const NEXT_INVOICE_NUMBER = "INV-2026-1015";

export interface BillingAddress {
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  taxId: string;
}

export const billingAddress: BillingAddress = {
  name: currentUser.name,
  line1: "1450 NW Raleigh St",
  line2: "Apt 12",
  city: "Portland",
  region: "OR",
  postalCode: "97209",
  country: "US",
  taxId: "",
};

export interface Country {
  code: string;
  name: string;
  tax?: { label: string; rate: number };
  postal?: boolean;
}

export const COUNTRIES: Country[] = [
  { code: "AU", name: "Australia", tax: { label: "GST", rate: 10 }, postal: true },
  { code: "AT", name: "Austria", tax: { label: "VAT", rate: 20 } },
  { code: "BE", name: "Belgium", tax: { label: "VAT", rate: 21 } },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada", tax: { label: "GST", rate: 5 }, postal: true },
  { code: "DK", name: "Denmark", tax: { label: "VAT", rate: 25 } },
  { code: "FI", name: "Finland", tax: { label: "VAT", rate: 25.5 } },
  { code: "FR", name: "France", tax: { label: "VAT", rate: 20 } },
  { code: "DE", name: "Germany", tax: { label: "VAT", rate: 19 } },
  { code: "IN", name: "India", tax: { label: "GST", rate: 18 } },
  { code: "IE", name: "Ireland", tax: { label: "VAT", rate: 23 } },
  { code: "IT", name: "Italy", tax: { label: "VAT", rate: 22 } },
  { code: "JP", name: "Japan", tax: { label: "Consumption tax", rate: 10 } },
  { code: "NL", name: "Netherlands", tax: { label: "VAT", rate: 21 } },
  { code: "NZ", name: "New Zealand", tax: { label: "GST", rate: 15 } },
  { code: "NG", name: "Nigeria", tax: { label: "VAT", rate: 7.5 } },
  { code: "NO", name: "Norway", tax: { label: "VAT", rate: 25 } },
  { code: "PL", name: "Poland", tax: { label: "VAT", rate: 23 } },
  { code: "PT", name: "Portugal", tax: { label: "VAT", rate: 23 } },
  { code: "SG", name: "Singapore", tax: { label: "GST", rate: 9 } },
  { code: "ZA", name: "South Africa", tax: { label: "VAT", rate: 15 } },
  { code: "ES", name: "Spain", tax: { label: "VAT", rate: 21 } },
  { code: "SE", name: "Sweden", tax: { label: "VAT", rate: 25 } },
  { code: "CH", name: "Switzerland", tax: { label: "VAT", rate: 8.1 } },
  { code: "AE", name: "United Arab Emirates", tax: { label: "VAT", rate: 5 } },
  { code: "GB", name: "United Kingdom", tax: { label: "VAT", rate: 20 }, postal: true },
  { code: "US", name: "United States", postal: true },
];

export function countryByCode(code: string | null | undefined): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function taxFor(code: string | null | undefined): { label: string; rate: number; place: string } {
  const c = countryByCode(code);
  return { label: c?.tax?.label ?? "Tax", rate: c?.tax?.rate ?? 0, place: c?.name ?? "No country selected" };
}

export interface Coupon {
  code: string;
  percentOff: number;
  description: string;
}

export const coupons: Coupon[] = [{ code: "RP-STUDY15", percentOff: 15, description: "15% off your first payment" }];

export function findCoupon(code: string): Coupon | undefined {
  return coupons.find((c) => c.code === code.trim().toUpperCase());
}

export const retentionOffer = { percentOff: 25, months: 3 };

export interface ChangeTarget {
  planId: PlanId;
  interval: Interval;
  seats?: number;
}

export interface ChangePreview {
  kind: "upgrade" | "downgrade" | "same";
  effectiveOn: string;
  unusedDays: number;
  periodDays: number;
  credit: number;
  newCharge: number;
  newPeriodStart: string;
  newPeriodEnd: string;
  dueToday: number;
  nextCharge: { amount: number; on: string } | null;
}

export function previewChange(target: ChangeTarget, sub: Subscription = subscription): ChangePreview {
  const today = now();
  const periodDays = Math.round((Date.parse(sub.currentPeriodEnd) - Date.parse(sub.currentPeriodStart)) / DAY);
  const unusedDays = Math.max(0, Math.round((Date.parse(sub.currentPeriodEnd) - Date.parse(today)) / DAY));
  const seats = target.seats ?? 1;
  const targetPrice = periodPrice(target.planId, target.interval, seats);
  const base = { unusedDays, periodDays };

  if (target.planId === sub.planId && target.interval === sub.interval && seats === sub.seats) {
    return { ...base, kind: "same", effectiveOn: today, credit: 0, newCharge: 0, newPeriodStart: sub.currentPeriodStart, newPeriodEnd: sub.currentPeriodEnd, dueToday: 0, nextCharge: { amount: sub.amount, on: sub.currentPeriodEnd } };
  }

  const downgrade = target.planId === "free" || (sub.interval === "year" && target.interval === "month") || (target.interval === sub.interval && targetPrice < sub.amount);
  if (downgrade) {
    return {
      ...base,
      kind: "downgrade",
      effectiveOn: sub.currentPeriodEnd,
      credit: 0,
      newCharge: 0,
      newPeriodStart: sub.currentPeriodEnd,
      newPeriodEnd: addMonths(sub.currentPeriodEnd, target.interval === "year" ? 12 : 1),
      dueToday: 0,
      nextCharge: targetPrice > 0 ? { amount: targetPrice, on: sub.currentPeriodEnd } : null,
    };
  }

  const credit = round2((sub.amount * unusedDays) / periodDays);
  if (target.interval !== sub.interval) {
    const end = addMonths(today, target.interval === "year" ? 12 : 1);
    return { ...base, kind: "upgrade", effectiveOn: today, credit, newCharge: targetPrice, newPeriodStart: today, newPeriodEnd: end, dueToday: round2(targetPrice - credit), nextCharge: { amount: targetPrice, on: end } };
  }
  const newCharge = round2((targetPrice * unusedDays) / periodDays);
  return { ...base, kind: "upgrade", effectiveOn: today, credit, newCharge, newPeriodStart: today, newPeriodEnd: sub.currentPeriodEnd, dueToday: round2(newCharge - credit), nextCharge: { amount: targetPrice, on: sub.currentPeriodEnd } };
}

export const usagePeriod = { onyxMessages: 214 };

export const failedPayment = {
  invoiceNumber: "INV-2026-1014",
  amount: 49,
  paymentMethodId: "pm_1Q4417",
  failedAt: daysAgo(1, 9),
  retries: [
    { id: "retry-2", label: "Retry 2", at: daysFromNow(2) },
    { id: "retry-3", label: "Final retry", at: daysFromNow(5) },
  ],
  accessPausesOn: daysFromNow(6),
};

export const pausedPayment = {
  failedAt: daysAgo(8, 9),
  retries: [
    { id: "retry-2", label: "Retry 2 declined", at: daysAgo(5, 9) },
    { id: "retry-3", label: "Final retry declined", at: daysAgo(2, 9) },
  ],
  pausedOn: daysAgo(1, 9),
};

export const lapsed = { endedOn: firstOfThisMonth() };

export const pendingDebit = {
  method: "ACH bank debit, account ending 6789",
  expectedBy: addBusinessDays(now(), 4),
};

export const retained = {
  tier: currentUser.tier,
  scenariosCompleted,
  reports: sessionHistory.filter((s) => s.reportId).length,
  debriefs: sessionHistory.filter((s) => s.debriefId).length,
};
