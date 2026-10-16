import { daysAgo, daysFromNow, hoursAgo, minutesAgo } from "./time";

export const STRIPE = "https://dashboard.stripe.com";

export type SubStatus = "active" | "trialing" | "past_due" | "paused" | "canceled";
export type PriceId = "price_1PrMo49xQk" | "price_1PrAn490Qk" | "price_1NfLg39zRk";

export const SUB_STATUS_LABEL: Record<SubStatus, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  paused: "Paused",
  canceled: "Canceled",
};

export interface Price {
  id: PriceId;
  nickname: string;
  amount: number;
  interval: "month" | "year";
  trialDays: number;
  active: boolean;
  createdAt: string;
}

export const prices: Price[] = [
  { id: "price_1PrMo49xQk", nickname: "Practitioner monthly", amount: 49, interval: "month", trialDays: 7, active: true, createdAt: daysAgo(214) },
  { id: "price_1PrAn490Qk", nickname: "Practitioner annual", amount: 490, interval: "year", trialDays: 7, active: true, createdAt: daysAgo(214) },
  { id: "price_1NfLg39zRk", nickname: "Founding member monthly", amount: 39, interval: "month", trialDays: 0, active: false, createdAt: daysAgo(402) },
];

export const product = {
  id: "prod_QhPr4cT1tnR",
  name: "Practitioner",
  description: "Lab access, Onyx at every help level, report exports",
  taxCode: "txcd_10103001",
  metadata: [
    { key: "entitlement", value: "practitioner" },
    { key: "lab_hours_month", value: "60" },
    { key: "onyx_levels", value: "all" },
    { key: "max_concurrent_labs", value: "1" },
  ],
  updatedAt: daysAgo(31),
};

export type CouponCode = "LAUNCH25" | "STUDENT20" | "WINBACK50" | "OSCPWEEK" | "BETA100";

export interface Coupon {
  code: CouponCode;
  id: string;
  percentOff: number;
  duration: "once" | "repeating" | "forever";
  months?: number;
  redemptions: number;
  maxRedemptions?: number;
  expiresAt?: string;
  status: "active" | "expired" | "archived";
  createdAt: string;
}

export const coupons: Coupon[] = [
  { code: "STUDENT20", id: "co_StU20fvR", percentOff: 20, duration: "forever", redemptions: 0, status: "active", createdAt: daysAgo(190) },
  { code: "LAUNCH25", id: "co_La25r3mQ", percentOff: 25, duration: "repeating", months: 3, redemptions: 0, maxRedemptions: 500, expiresAt: daysFromNow(16), status: "active", createdAt: daysAgo(75) },
  { code: "WINBACK50", id: "co_Wb50oNe1", percentOff: 50, duration: "once", redemptions: 0, status: "active", createdAt: daysAgo(48) },
  { code: "OSCPWEEK", id: "co_OsWk15aX", percentOff: 15, duration: "repeating", months: 2, redemptions: 0, maxRedemptions: 200, expiresAt: daysAgo(22), status: "expired", createdAt: daysAgo(36) },
  { code: "BETA100", id: "co_Bt100fRe", percentOff: 100, duration: "repeating", months: 1, redemptions: 0, maxRedemptions: 50, expiresAt: daysAgo(240), status: "archived", createdAt: daysAgo(400) },
];

export interface Subscription {
  id: string;
  customerId: string;
  userId: string;
  email: string;
  priceId: PriceId;
  status: SubStatus;
  coupon?: CouponCode;
  discountEndsAt?: string;
  mrr: number;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["alex", "sam", "jordan", "priya", "tomas", "leah", "omar", "nina", "felix", "maya", "ravi", "ines", "oscar", "hana", "luca", "zara", "ben", "chloe", "dmitri", "ama", "kofi", "yuki", "sofia", "marco", "aisha", "erik", "lena", "noah", "ida", "jonas", "carla", "theo", "mei", "anton", "bea", "kai", "rosa", "adam", "elif", "ivan"];
const LAST = ["morgan", "baker", "kowalski", "ali", "ferreira", "schmidt", "obi", "lund", "ito", "nair", "garcia", "boateng", "rossi", "kaya", "novak", "evans", "dubois", "sato", "hughes", "mensah", "petrov", "silva", "weber", "jensen", "reid", "costa", "osei", "moreau", "park", "yilmaz"];
const DOMAINS = ["example.com", "example.org", "example.net"];
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789";

function stripeId(r: () => number, prefix: string, n = 14) {
  return prefix + Array.from({ length: n }, () => ALPHA[Math.floor(r() * ALPHA.length)]).join("");
}

function userId(r: () => number) {
  return "usr_" + Array.from({ length: 6 }, () => ALPHA[Math.floor(r() * ALPHA.length)]).join("");
}

function monthlyValue(priceId: PriceId): number {
  const p = prices.find((x) => x.id === priceId)!;
  return p.interval === "year" ? p.amount / 12 : p.amount;
}

const COUPON_PLAN: { code: CouponCode; count: number }[] = [
  { code: "STUDENT20", count: 88 },
  { code: "LAUNCH25", count: 52 },
  { code: "WINBACK50", count: 17 },
];

interface Named {
  userId: string;
  email: string;
  priceId: PriceId;
  status: SubStatus;
  periodEnd?: string;
}

export const NAMED: Named[] = [
  { userId: "usr_7Hk2pQ", email: "dana.reyes@example.com", priceId: "price_1PrMo49xQk", status: "active", periodEnd: daysFromNow(17) },
  { userId: "usr_2Lm8Zr", email: "m.okonkwo@example.com", priceId: "price_1PrAn490Qk", status: "active", periodEnd: daysFromNow(212) },
  { userId: "usr_9Qw3Ty", email: "s.lindqvist@example.com", priceId: "price_1PrMo49xQk", status: "trialing", periodEnd: daysFromNow(4) },
  { userId: "usr_4Fd6Gh", email: "a.haddad@example.com", priceId: "price_1PrMo49xQk", status: "past_due", periodEnd: daysFromNow(13) },
  { userId: "usr_8Jk1Xc", email: "t.nguyen@example.com", priceId: "price_1PrMo49xQk", status: "active", periodEnd: daysFromNow(6) },
];

const PAST_DUE: (Named & { coupon?: CouponCode })[] = [
  { userId: "usr_5Lw2Dd", email: "l.ng@example.com", priceId: "price_1PrMo49xQk", status: "past_due", periodEnd: daysFromNow(29.6) },
  { userId: "usr_3Pd8Xo", email: "p.duarte@example.org", priceId: "price_1PrMo49xQk", status: "past_due", periodEnd: daysFromNow(28.7) },
  { userId: "usr_9Ev1Hn", email: "e.virtanen@example.com", priceId: "price_1NfLg39zRk", status: "past_due", periodEnd: daysFromNow(27.8) },
  { userId: "usr_8Jw6Tb", email: "j.whitlock@example.org", priceId: "price_1PrMo49xQk", status: "past_due", periodEnd: daysFromNow(23) },
  { userId: "usr_2Rc5Gm", email: "r.castellano@example.com", priceId: "price_1PrMo49xQk", status: "past_due", periodEnd: daysFromNow(24), coupon: "STUDENT20" },
  { userId: "usr_6Ka3Fz", email: "k.amoah@example.net", priceId: "price_1PrMo49xQk", status: "past_due", periodEnd: daysFromNow(20) },
];

function buildSubscriptions(): Subscription[] {
  const r = prng(20261015);
  const plan: { priceId: PriceId; status: SubStatus; count: number }[] = [
    { priceId: "price_1PrMo49xQk", status: "active", count: 902 },
    { priceId: "price_1PrAn490Qk", status: "active", count: 244 },
    { priceId: "price_1NfLg39zRk", status: "active", count: 40 },
    { priceId: "price_1PrMo49xQk", status: "trialing", count: 64 },
    { priceId: "price_1PrMo49xQk", status: "paused", count: 18 },
    { priceId: "price_1PrMo49xQk", status: "canceled", count: 36 },
  ];
  const used = new Set<string>(NAMED.map((n) => n.email));
  const out: Subscription[] = [];
  const pushSub = (n: Named) => {
    const p = prices.find((x) => x.id === n.priceId)!;
    const periodEnd =
      n.periodEnd ??
      (n.status === "canceled"
        ? daysAgo(1 + Math.floor(r() * 29))
        : n.status === "trialing"
          ? daysFromNow(1 + Math.floor(r() * 7))
          : daysFromNow(1 + Math.floor(r() * (p.interval === "year" ? 360 : 29))));
    out.push({
      id: stripeId(r, "sub_1Q"),
      customerId: stripeId(r, "cus_Q", 12),
      userId: n.userId,
      email: n.email,
      priceId: n.priceId,
      status: n.status,
      mrr: 0,
      periodEnd,
      cancelAtPeriodEnd: n.status === "active" && r() < 0.035,
      createdAt: daysAgo(n.status === "trialing" ? Math.floor(r() * 7) : 20 + Math.floor(r() * (n.priceId === "price_1NfLg39zRk" ? 380 : 190))),
    });
  };
  NAMED.forEach(pushSub);
  PAST_DUE.forEach((n) => {
    pushSub(n);
    out[out.length - 1].coupon = n.coupon;
    used.add(n.email);
  });
  for (const row of plan) {
    const already = out.filter((s) => s.priceId === row.priceId && s.status === row.status).length;
    for (let i = already; i < row.count; i++) {
      let email = "";
      while (!email || used.has(email)) {
        const f = FIRST[Math.floor(r() * FIRST.length)];
        const l = LAST[Math.floor(r() * LAST.length)];
        const style = Math.floor(r() * 4);
        const local = style === 0 ? `${f}.${l}` : style === 1 ? `${f[0]}.${l}` : style === 2 ? `${f}${l}${Math.floor(r() * 90 + 10)}` : `${f}_${l}`;
        email = `${local}@${DOMAINS[Math.floor(r() * DOMAINS.length)]}`;
      }
      used.add(email);
      pushSub({ userId: userId(r), email, priceId: row.priceId, status: row.status });
    }
  }
  const eligible = out.filter((s) => s.status === "active" && s.priceId === "price_1PrMo49xQk" && !NAMED.some((n) => n.email === s.email));
  let cursor = 0;
  for (const c of COUPON_PLAN) {
    for (let i = 0; i < c.count; i++) {
      const s = eligible[(cursor += 7) % eligible.length];
      if (s.coupon) {
        i--;
        cursor++;
        continue;
      }
      s.coupon = c.code;
      if (c.code === "LAUNCH25") s.discountEndsAt = daysFromNow(10 + (i % 70));
      if (c.code === "WINBACK50") s.discountEndsAt = s.periodEnd;
    }
  }
  for (const s of out) {
    if (s.status === "active" || s.status === "past_due") {
      const base = monthlyValue(s.priceId);
      const off = s.coupon ? coupons.find((c) => c.code === s.coupon)!.percentOff / 100 : 0;
      s.mrr = Math.round(base * (1 - off) * 100) / 100;
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const subscriptions: Subscription[] = buildSubscriptions();

export function priceById(id: PriceId): Price {
  return prices.find((p) => p.id === id)!;
}

export const mrr = Math.round(subscriptions.reduce((a, s) => a + s.mrr, 0));

export const mrrTrend = [41120, 42380, 43050, 44410, 45230, 46380, 47920, 48760, 49850, 51120, 52040, 53310, mrr];

export const couponStats = coupons.map((c) => {
  const subs = subscriptions.filter((s) => s.coupon === c.code && (s.status === "active" || s.status === "past_due"));
  const fullValue = subs.reduce((a, s) => a + monthlyValue(s.priceId), 0);
  const discounted = subs.reduce((a, s) => a + s.mrr, 0);
  const historical: Record<CouponCode, number> = { STUDENT20: 131, LAUNCH25: 214, WINBACK50: 61, OSCPWEEK: 143, BETA100: 50 };
  const lapsedMrr: Record<CouponCode, number> = { STUDENT20: 0, LAUNCH25: 0, WINBACK50: 0, OSCPWEEK: 2989, BETA100: 1176 };
  return {
    ...c,
    redemptions: historical[c.code],
    activeOn: subs.length,
    discountPerMonth: Math.round((fullValue - discounted) * 100) / 100,
    attributedMrr: Math.round(discounted + lapsedMrr[c.code]),
  };
});

export type InvoiceState = "paid" | "open" | "void" | "uncollectible" | "refunded";

export interface BillingInvoice {
  id: string;
  number: string;
  email: string;
  amount: number;
  status: InvoiceState;
  description: string;
  createdAt: string;
  attempts: number;
}

function buildInvoices(): BillingInvoice[] {
  const r = prng(77);
  const paying = subscriptions.filter((s) => s.status === "active");
  const out: BillingInvoice[] = [];
  let n = 18406;
  for (let i = 0; i < 64; i++) {
    const s = paying[Math.floor(r() * paying.length)];
    const p = priceById(s.priceId);
    const off = s.coupon ? coupons.find((c) => c.code === s.coupon)!.percentOff / 100 : 0;
    out.push({
      id: stripeId(r, "in_1Q"),
      number: `RP-${n--}`,
      email: s.email,
      amount: Math.round(p.amount * (1 - off) * 100) / 100,
      status: "paid",
      description: `${p.nickname}${s.coupon ? `, ${s.coupon}` : ""}`,
      createdAt: hoursAgo(i * 2.6 + r() * 2),
      attempts: 1,
    });
  }
  const set = (i: number, patch: Partial<BillingInvoice>) => (out[i] = { ...out[i], ...patch });
  set(4, { email: "l.ng@example.com", status: "open", amount: 49, description: "Practitioner monthly", attempts: 1, createdAt: hoursAgo(9) });
  set(11, { email: "p.duarte@example.org", status: "open", amount: 49, description: "Practitioner monthly", attempts: 1, createdAt: hoursAgo(31) });
  set(13, { status: "refunded" });
  set(18, { email: "e.virtanen@example.com", status: "open", amount: 39, description: "Founding member monthly", attempts: 1, createdAt: hoursAgo(52) });
  set(22, { status: "void", description: "Practitioner monthly, duplicate draft" });
  set(40, { status: "refunded" });
  set(45, { email: "j.whitlock@example.org", status: "open", amount: 49, description: "Practitioner monthly", attempts: 2, createdAt: daysAgo(7) });
  set(62, { email: "r.castellano@example.com", status: "open", amount: 39.2, description: "Practitioner monthly, STUDENT20", attempts: 2, createdAt: daysAgo(6) });
  out.push(
    { id: "in_1QAa7cPx4", number: "RP-18319", email: "k.amoah@example.net", amount: 49, status: "open", description: "Practitioner monthly", createdAt: daysAgo(10), attempts: 3 },
    { id: "in_1Q9u2dRm8", number: "RP-18277", email: "a.haddad@example.com", amount: 49, status: "uncollectible", description: "Practitioner monthly", createdAt: daysAgo(17), attempts: 4 },
  );
  return out;
}

export const invoices: BillingInvoice[] = buildInvoices();

export type DisputeReason = "fraudulent" | "product_not_received" | "subscription_canceled" | "duplicate" | "credit_not_processed";
export type RefundReason = "requested_by_customer" | "duplicate" | "fraudulent";

export const DISPUTE_REASON: Record<DisputeReason, string> = {
  fraudulent: "Fraudulent",
  product_not_received: "Product not received",
  subscription_canceled: "Subscription canceled",
  duplicate: "Duplicate",
  credit_not_processed: "Credit not processed",
};

export const REFUND_REASON: Record<RefundReason, string> = {
  requested_by_customer: "Requested by customer",
  duplicate: "Duplicate",
  fraudulent: "Fraudulent",
};

export interface QueueCase {
  id: string;
  kind: "dispute" | "refund-request";
  email: string;
  amount: number;
  reason: string;
  stage: "needs_response" | "under_review" | "pending_approval";
  dueAt?: string;
  openedAt: string;
  note: string;
  charge: string;
}

export const caseQueue: QueueCase[] = [
  { id: "dp_1QAx7Lm2Rk", kind: "dispute", email: "v.okafor@example.net", amount: 490, reason: DISPUTE_REASON.subscription_canceled, stage: "needs_response", dueAt: daysFromNow(3), openedAt: daysAgo(4), note: "Annual renewal 12 days after a cancel request sent to support", charge: "ch_3QAw1pFz" },
  { id: "dp_1Q9tC0sYhe", kind: "dispute", email: "g.lindgren@example.com", amount: 49, reason: DISPUTE_REASON.fraudulent, stage: "needs_response", dueAt: daysFromNow(9), openedAt: daysAgo(2), note: "18 lab hours used from the same IP as signup", charge: "ch_3Q9s8dQe" },
  { id: "dp_1Q7mR4dWq2", kind: "dispute", email: "c.ferraro@example.org", amount: 49, reason: DISPUTE_REASON.product_not_received, stage: "under_review", openedAt: daysAgo(11), note: "Evidence submitted: session logs, 3 completed labs", charge: "ch_3Q7m0bNa" },
  { id: "rr_7Kq2Mt", kind: "refund-request", email: "h.becker@example.com", amount: 490, reason: "Annual plan bought by mistake, wanted monthly", stage: "pending_approval", openedAt: hoursAgo(5), note: "Upgraded 2 days ago, 0.4 lab hours used", charge: "ch_3QBa4kLr" },
  { id: "rr_7Kp9Xa", kind: "refund-request", email: "s.ivanova@example.net", amount: 49, reason: "Lab failed to start twice", stage: "pending_approval", openedAt: hoursAgo(19), note: "2 failed provisions, not charged lab hours. 6.2 lab hours used", charge: "ch_3QB2hTy8" },
];

export interface Refund {
  id: string;
  email: string;
  amount: number;
  reason: RefundReason;
  by: string;
  at: string;
  status: "succeeded" | "pending";
}

export const refunds: Refund[] = [
  { id: "re_3QBc1Ym", email: "o.nakamura@example.com", amount: 49, reason: "requested_by_customer", by: "priya@rootpanther.com", at: hoursAgo(26), status: "pending" },
  { id: "re_3QAz8Kd", email: "b.adler@example.org", amount: 490, reason: "requested_by_customer", by: "priya@rootpanther.com", at: daysAgo(3), status: "succeeded" },
  { id: "re_3QAt2Wn", email: "f.mbatha@example.com", amount: 49, reason: "duplicate", by: "billing-bot", at: daysAgo(5), status: "succeeded" },
  { id: "re_3QAm5Ph", email: "t.horvath@example.net", amount: 36.75, reason: "requested_by_customer", by: "marcus@rootpanther.com", at: daysAgo(8), status: "succeeded" },
  { id: "re_3QAd9Lc", email: "y.osman@example.com", amount: 49, reason: "fraudulent", by: "billing-bot", at: daysAgo(11), status: "succeeded" },
  { id: "re_3Q9x1Fb", email: "e.kruger@example.org", amount: 49, reason: "requested_by_customer", by: "marcus@rootpanther.com", at: daysAgo(14), status: "succeeded" },
  { id: "re_3Q9q7Ts", email: "n.okeke@example.com", amount: 39.2, reason: "requested_by_customer", by: "priya@rootpanther.com", at: daysAgo(17), status: "succeeded" },
  { id: "re_3Q9g3Zv", email: "r.lopez@example.net", amount: 49, reason: "duplicate", by: "billing-bot", at: daysAgo(19), status: "succeeded" },
  { id: "re_3Q9a6Mj", email: "k.sorensen@example.com", amount: 490, reason: "requested_by_customer", by: "priya@rootpanther.com", at: daysAgo(23), status: "succeeded" },
  { id: "re_3Q8w2Hq", email: "d.achieng@example.org", amount: 24.5, reason: "requested_by_customer", by: "marcus@rootpanther.com", at: daysAgo(26), status: "succeeded" },
  { id: "re_3Q8p8Ge", email: "m.varga@example.com", amount: 49, reason: "requested_by_customer", by: "marcus@rootpanther.com", at: daysAgo(28), status: "succeeded" },
];

export const refunds30d = {
  total: Math.round(refunds.reduce((a, r) => a + r.amount, 0) * 100) / 100,
  count: refunds.length,
  prev: 1024.5,
};

export const disputes30d = { won: 1, lost: 1, lostAmount: 49 };

export type DunningStage = "failed-once" | "second-retry" | "final-retry" | "grace-ended";

export const DUNNING_STAGES: { id: DunningStage; label: string; detail: string }[] = [
  { id: "failed-once", label: "Failed once", detail: "1 attempt, next on day 3" },
  { id: "second-retry", label: "Second retry", detail: "2 attempts, next on day 8" },
  { id: "final-retry", label: "Final retry", detail: "3 attempts, last on day 15" },
  { id: "grace-ended", label: "Grace ended", detail: "Lab launches paused" },
];

export type DeclineCode = "insufficient_funds" | "expired_card" | "do_not_honor" | "authentication_required" | "card_velocity_exceeded";

export const DECLINE_LABEL: Record<DeclineCode, string> = {
  insufficient_funds: "Insufficient funds",
  expired_card: "Expired card",
  do_not_honor: "Do not honor",
  authentication_required: "3DS authentication required",
  card_velocity_exceeded: "Card velocity exceeded",
};

export interface DunningCase {
  id: string;
  invoice: string;
  userId: string;
  email: string;
  amount: number;
  stage: DunningStage;
  decline: DeclineCode;
  card: string;
  failedAt: string;
  nextRetryAt?: string;
  accessPausedAt?: string;
  emailedAt?: string;
  retryWillSucceed: boolean;
}

export const dunning: DunningCase[] = [
  { id: "dn_01", invoice: "RP-18402", userId: "usr_5Lw2Dd", email: "l.ng@example.com", amount: 49, stage: "failed-once", decline: "insufficient_funds", card: "Visa 4242", failedAt: hoursAgo(9), nextRetryAt: daysFromNow(2.6), retryWillSucceed: true },
  { id: "dn_02", invoice: "RP-18395", userId: "usr_3Pd8Xo", email: "p.duarte@example.org", amount: 49, stage: "failed-once", decline: "authentication_required", card: "Mastercard 5100", failedAt: hoursAgo(31), nextRetryAt: daysFromNow(1.7), retryWillSucceed: false },
  { id: "dn_03", invoice: "RP-18388", userId: "usr_9Ev1Hn", email: "e.virtanen@example.com", amount: 39, stage: "failed-once", decline: "do_not_honor", card: "Visa 1881", failedAt: hoursAgo(52), nextRetryAt: daysFromNow(0.8), retryWillSucceed: true },
  { id: "dn_04", invoice: "RP-18361", userId: "usr_8Jw6Tb", email: "j.whitlock@example.org", amount: 49, stage: "second-retry", decline: "insufficient_funds", card: "Visa 0077", failedAt: daysAgo(4), nextRetryAt: daysFromNow(1), emailedAt: daysAgo(4), retryWillSucceed: true },
  { id: "dn_05", invoice: "RP-18344", userId: "usr_2Rc5Gm", email: "r.castellano@example.com", amount: 39.2, stage: "second-retry", decline: "expired_card", card: "Amex 1005", failedAt: daysAgo(3), nextRetryAt: daysFromNow(2), emailedAt: daysAgo(3), retryWillSucceed: false },
  { id: "dn_06", invoice: "RP-18319", userId: "usr_6Ka3Fz", email: "k.amoah@example.net", amount: 49, stage: "final-retry", decline: "card_velocity_exceeded", card: "Mastercard 2223", failedAt: daysAgo(2), nextRetryAt: daysFromNow(5), emailedAt: daysAgo(2), retryWillSucceed: true },
  { id: "dn_07", invoice: "RP-18277", userId: "usr_4Fd6Gh", email: "a.haddad@example.com", amount: 49, stage: "grace-ended", decline: "expired_card", card: "Visa 3184", failedAt: daysAgo(2), accessPausedAt: daysAgo(2), emailedAt: daysAgo(2), retryWillSucceed: false },
];

export const lastSyncAt = minutesAgo(2);
