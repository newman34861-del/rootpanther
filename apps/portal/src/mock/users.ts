import type { HelpLevel, Invoice, ReportStatus, TierCode, Tone } from "@rootpanther/ui";
import { daysAgo, daysFromNow, firstOfThisMonth, hoursAgo, minutesAgo } from "./time";

export type UserStatus = "trial" | "active" | "past-due" | "lapsed";
export type PlanId = "free" | "practitioner" | "practitioner-annual" | "team";

export const PLANS: Record<PlanId, { name: string; interval: "mo" | "yr" | null; price: number; label: string }> = {
  free: { name: "Free", interval: null, price: 0, label: "Free" },
  practitioner: { name: "Practitioner", interval: "mo", price: 49, label: "Practitioner monthly" },
  "practitioner-annual": { name: "Practitioner", interval: "yr", price: 490, label: "Practitioner annual" },
  team: { name: "Team", interval: "mo", price: 39, label: "Team seat" },
};

export const PLAN_ORDER: PlanId[] = ["free", "practitioner", "practitioner-annual", "team"];

export const STATUS_META: Record<UserStatus, { label: string; tone: Tone; hollow?: boolean }> = {
  trial: { label: "Trial", tone: "info" },
  active: { label: "Active", tone: "primary" },
  "past-due": { label: "Past due", tone: "high" },
  lapsed: { label: "Lapsed", tone: "neutral", hollow: true },
};

export const STATUS_ORDER: UserStatus[] = ["trial", "active", "past-due", "lapsed"];

export type SessionOutcome = "running" | "completed" | "partial" | "abandoned" | "expired" | "failed-provision";

export const OUTCOME_META: Record<SessionOutcome, { label: string; tone: Tone; hollow?: boolean }> = {
  running: { label: "Running", tone: "primary" },
  completed: { label: "Completed", tone: "success" },
  partial: { label: "Partial", tone: "info" },
  abandoned: { label: "Abandoned", tone: "neutral", hollow: true },
  expired: { label: "Expired", tone: "med" },
  "failed-provision": { label: "Launch failed", tone: "crit" },
};

export interface PortalSession {
  id: string;
  tenantId: string;
  scenario: string;
  region: string;
  startedAt: string;
  durationMin: number;
  hostsOwned: number;
  hostsTotal: number;
  outcome: SessionOutcome;
  chargedHours: number;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  initials: string;
  handle: string;
  plan: PlanId;
  status: UserStatus;
  tier: TierCode;
  signupAt: string;
  lastActiveAt: string;
  labHours: number;
  ltv: number;
  country: string;
  region: string;
  twoFactor: boolean;
  stripeCustomer: string;
  team?: string;
  trialEndsAt?: string;
  paidPeriods: number;
  sessions: PortalSession[];
}

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

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type Rng = () => number;

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";

function token(r: Rng, n: number, alphabet = B62): string {
  let s = "";
  for (let i = 0; i < n; i++) s += alphabet[Math.floor(r() * alphabet.length)];
  return s;
}

function pick<T>(r: Rng, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)];
}

function weighted<T>(r: Rng, items: readonly [T, number][]): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [v, w] of items) {
    x -= w;
    if (x <= 0) return v;
  }
  return items[items.length - 1][0];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

const FIRST = [
  "Aisha", "Ben", "Carlos", "Chen", "Daniel", "Elena", "Farah", "Gabriel", "Hannah", "Hiroshi", "Ifeoma", "Isaac", "Jakub", "Jamal", "Javier",
  "Jin", "Julia", "Kai", "Kemi", "Laura", "Leon", "Lucia", "Mateo", "Maya", "Mehmet", "Mia", "Nadia", "Nikhil", "Noah", "Olu", "Omar", "Pavel",
  "Rafael", "Rania", "Ravi", "Rosa", "Ryan", "Samir", "Sofia", "Tariq", "Tom", "Uchenna", "Valentina", "Victor", "Wei", "Yara", "Yusuf", "Zoe",
  "Anders", "Bianca", "Chidi", "Diego", "Emeka", "Fatima", "Grace", "Hugo", "Ines", "Joon", "Kwame", "Lina", "Marta", "Niamh", "Oscar", "Petra",
];

const LAST = [
  "Adeyemi", "Alvarez", "Andersson", "Bakker", "Banerjee", "Becker", "Bianchi", "Brennan", "Castillo", "Chowdhury", "Costa", "Dubois", "Eriksen",
  "Farouk", "Fischer", "Garcia", "Hansen", "Hughes", "Ibrahim", "Ivanova", "Jensen", "Kaur", "Kim", "Kowalski", "Larsen", "Lee", "Lopez",
  "Mahmoud", "Martins", "Mensah", "Moreau", "Murphy", "Nakamura", "Novak", "Nwosu", "O'Brien", "Okafor", "Olsen", "Patel", "Petrov", "Quinn",
  "Ramos", "Rossi", "Sato", "Schmidt", "Silva", "Singh", "Sokolov", "Tanaka", "Torres", "Usman", "Varga", "Walsh", "Weber", "Wong", "Yilmaz",
  "Zhang", "Ziegler",
];

const DOMAINS: [string, number][] = [
  ["example.com", 58],
  ["example.org", 16],
  ["example.net", 16],
  ["mail.example", 10],
];

const TEAMS = ["northwind.example", "halden.example", "cobalt-labs.example"];

const COUNTRIES: [string, string, number][] = [
  ["US", "eastus2", 26],
  ["GB", "uksouth", 16],
  ["IN", "centralindia", 12],
  ["DE", "westeurope", 8],
  ["NG", "westeurope", 6],
  ["CA", "eastus2", 6],
  ["AU", "australiaeast", 5],
  ["NL", "westeurope", 5],
  ["BR", "eastus2", 4],
  ["PL", "westeurope", 4],
  ["SE", "westeurope", 3],
  ["ZA", "westeurope", 3],
  ["SG", "southeastasia", 2],
  ["AE", "uaenorth", 1],
];

const SCENARIOS: { name: string; hosts: number; tier: TierCode }[] = [
  { name: "Halcyon", hosts: 1, tier: "C1" },
  { name: "Kestrel", hosts: 1, tier: "C1" },
  { name: "Lattice", hosts: 1, tier: "C1" },
  { name: "Basalt", hosts: 1, tier: "C2" },
  { name: "Tamarack", hosts: 1, tier: "C2" },
  { name: "Juniper", hosts: 1, tier: "C2" },
  { name: "Meridian", hosts: 3, tier: "C2" },
  { name: "Ironwood", hosts: 3, tier: "C2" },
  { name: "Granite", hosts: 6, tier: "C2" },
  { name: "Harrow", hosts: 1, tier: "C3" },
  { name: "Vesper", hosts: 3, tier: "C3" },
  { name: "Cinder", hosts: 4, tier: "C3" },
  { name: "Obsidian", hosts: 6, tier: "C3" },
  { name: "Quarry", hosts: 5, tier: "C4" },
];

const TIER_RANK: Record<TierCode, number> = { C1: 1, C2: 2, C3: 3, C4: 4 };

const PERIOD_START = new Date(firstOfThisMonth()).getTime() - 9 * 3600000;

function inPeriod(iso: string): boolean {
  return new Date(iso).getTime() >= PERIOD_START;
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toLowerCase();
}

function genSessions(r: Rng, tier: TierCode, region: string, count: number, fromDay: number, toDay: number): PortalSession[] {
  const pool = SCENARIOS.filter((s) => TIER_RANK[s.tier] <= TIER_RANK[tier] + 1);
  const out: PortalSession[] = [];
  for (let i = 0; i < count; i++) {
    const sc = pick(r, pool);
    const day = toDay + Math.floor(r() * Math.max(1, fromDay - toDay));
    const outcome = weighted<SessionOutcome>(r, [
      ["completed", 30],
      ["partial", 32],
      ["abandoned", 14],
      ["expired", 18],
      ["failed-provision", 6],
    ]);
    const failed = outcome === "failed-provision";
    const durationMin = failed ? 0 : 35 + Math.floor(r() * 190);
    const owned =
      outcome === "completed" ? sc.hosts : outcome === "partial" ? Math.max(0, Math.min(sc.hosts - 1, 1 + Math.floor(r() * sc.hosts) - 1)) : outcome === "expired" ? Math.floor(r() * sc.hosts) : 0;
    out.push({
      id: `ses_${token(r, 6)}`,
      tenantId: `rp-t-${token(r, 6, B36)}`,
      scenario: sc.name,
      region,
      startedAt: daysAgo(day, 18 + Math.floor(r() * 5)),
      durationMin,
      hostsOwned: owned,
      hostsTotal: sc.hosts,
      outcome,
      chargedHours: failed ? 0 : round1(durationMin / 60),
    });
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function capPeriod(sessions: PortalSession[], cap = 60): PortalSession[] {
  let used = 0;
  return sessions
    .slice()
    .reverse()
    .filter((s) => {
      if (!inPeriod(s.startedAt)) return true;
      if (used + s.chargedHours > cap) return false;
      used += s.chargedHours;
      return true;
    })
    .reverse();
}

function periodHours(sessions: PortalSession[]): number {
  return round1(sessions.filter((s) => inPeriod(s.startedAt)).reduce((a, s) => a + s.chargedHours, 0));
}

function ltvFor(plan: PlanId, paidPeriods: number): number {
  return PLANS[plan].price * paidPeriods;
}

interface Seed {
  id: string;
  name: string;
  email: string;
  plan: PlanId;
  status: UserStatus;
  tier: TierCode;
  signupDays: number;
  lastActive: string;
  country: string;
  team?: string;
  sessions?: PortalSession[];
}

function build(seed: Seed): UserRecord {
  const r = mulberry32(hash(seed.id));
  const [, region] = COUNTRIES.find(([c]) => c === seed.country) ?? COUNTRIES[0];
  const billedDays = Math.max(0, seed.signupDays - 7);
  let paidPeriods = 0;
  if (seed.plan !== "free" && seed.status !== "trial") {
    paidPeriods = seed.plan === "practitioner-annual" ? Math.floor(billedDays / 365) + 1 : Math.floor(billedDays / 30) + 1;
    if (seed.status === "past-due") paidPeriods = Math.max(1, paidPeriods - 1);
    if (seed.status === "lapsed") paidPeriods = Math.max(1, Math.floor(paidPeriods * (0.35 + r() * 0.4)));
  }
  let sessions = seed.sessions;
  if (!sessions) {
    const lastActiveDays = Math.floor((Date.now() - new Date(seed.lastActive).getTime()) / 86400000);
    if (seed.plan === "free") sessions = [];
    else if (seed.status === "trial") sessions = genSessions(r, seed.tier, region, Math.floor(r() * 5), seed.signupDays, 0);
    else if (seed.status === "active") sessions = genSessions(r, seed.tier, region, 5 + Math.floor(r() * 20), 32, lastActiveDays);
    else if (seed.status === "past-due") sessions = genSessions(r, seed.tier, region, 2 + Math.floor(r() * 6), lastActiveDays + 30, lastActiveDays);
    else sessions = genSessions(r, seed.tier, region, 1 + Math.floor(r() * 5), lastActiveDays + 40, lastActiveDays).filter((s) => !inPeriod(s.startedAt));
    sessions = capPeriod(sessions);
  }
  const parts = seed.name.split(" ");
  return {
    id: seed.id,
    email: seed.email,
    name: seed.name,
    initials: parts.map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
    handle: `${slug(parts[0]).slice(0, 1)}${slug(parts[parts.length - 1])}`,
    plan: seed.plan,
    status: seed.status,
    tier: seed.tier,
    signupAt: daysAgo(seed.signupDays, 9 + Math.floor(r() * 12)),
    lastActiveAt: seed.lastActive,
    labHours: periodHours(sessions),
    ltv: ltvFor(seed.plan, paidPeriods),
    country: seed.country,
    region,
    twoFactor: r() < 0.58,
    stripeCustomer: `cus_${token(r, 14)}`,
    team: seed.team,
    trialEndsAt: seed.status === "trial" ? daysFromNow(7 - seed.signupDays) : undefined,
    paidPeriods,
    sessions,
  };
}

const DANA_SESSIONS: PortalSession[] = [
  { id: "ses_4QmX9a", tenantId: "rp-t-4qmx9a", scenario: "Meridian", region: "eastus2", startedAt: minutesAgo(102), durationMin: 102, hostsOwned: 1, hostsTotal: 3, outcome: "running", chargedHours: 1.7 },
  { id: "ses_3Lr8Kc", tenantId: "rp-t-3lr8kc", scenario: "Basalt", region: "eastus2", startedAt: daysAgo(1, 19), durationMin: 118, hostsOwned: 1, hostsTotal: 1, outcome: "completed", chargedHours: 2.0 },
  { id: "ses_3Kc1Zt", tenantId: "rp-t-3kc1zt", scenario: "Meridian", region: "eastus2", startedAt: daysAgo(3, 20), durationMin: 186, hostsOwned: 1, hostsTotal: 3, outcome: "expired", chargedHours: 3.1 },
  { id: "ses_3Jq7Wn", tenantId: "rp-t-3jq7wn", scenario: "Tamarack", region: "eastus2", startedAt: daysAgo(4, 21), durationMin: 95, hostsOwned: 0, hostsTotal: 1, outcome: "abandoned", chargedHours: 1.6 },
  { id: "ses_3Jp0Ad", tenantId: "rp-t-3jp0ad", scenario: "Tamarack", region: "eastus2", startedAt: daysAgo(4, 20), durationMin: 0, hostsOwned: 0, hostsTotal: 1, outcome: "failed-provision", chargedHours: 0 },
  { id: "ses_3Hb2Ry", tenantId: "rp-t-3hb2ry", scenario: "Meridian", region: "eastus2", startedAt: daysAgo(5, 20), durationMin: 228, hostsOwned: 1, hostsTotal: 3, outcome: "partial", chargedHours: 3.8 },
  { id: "ses_3Gw6Np", tenantId: "rp-t-3gw6np", scenario: "Juniper", region: "eastus2", startedAt: daysAgo(6, 19), durationMin: 204, hostsOwned: 1, hostsTotal: 1, outcome: "completed", chargedHours: 3.4 },
  { id: "ses_3Fq4Ls", tenantId: "rp-t-3fq4ls", scenario: "Ironwood", region: "eastus2", startedAt: daysAgo(7, 20), durationMin: 240, hostsOwned: 1, hostsTotal: 3, outcome: "expired", chargedHours: 4.0 },
  { id: "ses_3Ek9Td", tenantId: "rp-t-3ek9td", scenario: "Ironwood", region: "eastus2", startedAt: daysAgo(8, 19), durationMin: 222, hostsOwned: 2, hostsTotal: 3, outcome: "partial", chargedHours: 3.7 },
  { id: "ses_3Dm1Vc", tenantId: "rp-t-3dm1vc", scenario: "Granite", region: "eastus2", startedAt: daysAgo(9, 18), durationMin: 240, hostsOwned: 3, hostsTotal: 6, outcome: "expired", chargedHours: 4.0 },
  { id: "ses_3Cz8Qa", tenantId: "rp-t-3cz8qa", scenario: "Juniper", region: "eastus2", startedAt: daysAgo(10, 20), durationMin: 168, hostsOwned: 0, hostsTotal: 1, outcome: "partial", chargedHours: 2.8 },
  { id: "ses_3Bx5Hk", tenantId: "rp-t-3bx5hk", scenario: "Basalt", region: "eastus2", startedAt: daysAgo(11, 21), durationMin: 150, hostsOwned: 0, hostsTotal: 1, outcome: "abandoned", chargedHours: 2.5 },
  { id: "ses_3Aw2Gm", tenantId: "rp-t-3aw2gm", scenario: "Meridian", region: "eastus2", startedAt: daysAgo(12, 19), durationMin: 210, hostsOwned: 1, hostsTotal: 3, outcome: "partial", chargedHours: 3.5 },
  { id: "ses_2Zz7Fe", tenantId: "rp-t-2zz7fe", scenario: "Lattice", region: "eastus2", startedAt: daysAgo(13, 20), durationMin: 132, hostsOwned: 1, hostsTotal: 1, outcome: "completed", chargedHours: 2.2 },
  { id: "ses_2Zy3Pw", tenantId: "rp-t-2zy3pw", scenario: "Granite", region: "eastus2", startedAt: daysAgo(14, 18), durationMin: 192, hostsOwned: 2, hostsTotal: 6, outcome: "abandoned", chargedHours: 3.2 },
  { id: "ses_2Zx4Lm", tenantId: "rp-t-2zx4lm", scenario: "Kestrel", region: "eastus2", startedAt: daysAgo(38, 19), durationMin: 96, hostsOwned: 1, hostsTotal: 1, outcome: "completed", chargedHours: 1.6 },
  { id: "ses_2Yt9Hq", tenantId: "rp-t-2yt9hq", scenario: "Kestrel", region: "eastus2", startedAt: daysAgo(40, 21), durationMin: 140, hostsOwned: 0, hostsTotal: 1, outcome: "abandoned", chargedHours: 2.3 },
  { id: "ses_2Ra3Ce", tenantId: "rp-t-2ra3ce", scenario: "Halcyon", region: "eastus2", startedAt: daysAgo(46, 20), durationMin: 74, hostsOwned: 1, hostsTotal: 1, outcome: "completed", chargedHours: 1.2 },
  { id: "ses_2Mk5Vb", tenantId: "rp-t-2mk5vb", scenario: "Lattice", region: "eastus2", startedAt: daysAgo(60, 19), durationMin: 52, hostsOwned: 1, hostsTotal: 1, outcome: "completed", chargedHours: 0.9 },
];

const FIXED: Seed[] = [
  { id: "usr_7Hk2pQ", name: "Dana Reyes", email: "dana.reyes@example.com", plan: "practitioner", status: "active", tier: "C2", signupDays: 152, lastActive: minutesAgo(2), country: "US", sessions: DANA_SESSIONS },
  { id: "usr_2Lm8Zr", name: "Michael Okonkwo", email: "m.okonkwo@example.com", plan: "practitioner-annual", status: "active", tier: "C3", signupDays: 410, lastActive: hoursAgo(5), country: "GB" },
  { id: "usr_9Qw3Ty", name: "Sara Lindqvist", email: "s.lindqvist@example.com", plan: "practitioner", status: "trial", tier: "C1", signupDays: 3, lastActive: hoursAgo(20), country: "SE" },
  { id: "usr_4Fd6Gh", name: "Amir Haddad", email: "a.haddad@example.com", plan: "practitioner", status: "past-due", tier: "C2", signupDays: 220, lastActive: daysAgo(6), country: "AE" },
  { id: "usr_8Jk1Xc", name: "Thanh Nguyen", email: "t.nguyen@example.com", plan: "practitioner", status: "active", tier: "C3", signupDays: 298, lastActive: minutesAgo(48), country: "AU" },
];

// Matches the dunning count shown on Overview and in the Billing nav badge.
const PAST_DUE_TOTAL = 7;

function generate(): UserRecord[] {
  const r = mulberry32(20261015);
  const used = new Set(FIXED.map((f) => f.email));
  const seeds: Seed[] = [...FIXED];
  while (seeds.length < 142) {
    const first = pick(r, FIRST);
    const last = pick(r, LAST);
    const f = slug(first);
    const l = slug(last);
    let status = weighted<UserStatus>(r, [
      ["active", 66],
      ["trial", 10],
      ["past-due", 6],
      ["lapsed", 13],
    ]);
    if (status === "past-due" && seeds.filter((s) => s.status === "past-due").length >= PAST_DUE_TOTAL) status = "active";
    let plan: PlanId = "practitioner";
    if (status === "active" || status === "past-due") {
      plan = weighted<PlanId>(r, [
        ["practitioner", 56],
        ["practitioner-annual", status === "past-due" ? 0 : 22],
        ["team", 12],
        ["free", status === "active" ? 10 : 0],
      ]);
    }
    const team = plan === "team" ? pick(r, TEAMS) : undefined;
    const domain = team ?? weighted(r, DOMAINS);
    const local = weighted<string>(r, [
      [`${f}.${l}`, 5],
      [`${f[0]}.${l}`, 3],
      [`${f}${l}`, 1],
      [`${f}_${l[0]}`, 1],
    ]);
    const email = `${local}@${domain}`;
    if (used.has(email)) continue;
    used.add(email);
    const signupDays = status === "trial" ? Math.floor(r() * 7) : 9 + Math.floor(700 * Math.pow(r(), 1.5));
    let lastActive: string;
    if (status === "trial") lastActive = minutesAgo(5 + Math.floor(r() * Math.max(1, signupDays) * 1440 * 0.8));
    else if (status === "active") lastActive = minutesAgo(1 + Math.floor(Math.pow(r(), 2.2) * 14400));
    else if (status === "past-due") lastActive = daysAgo(2 + Math.floor(r() * 22), 19);
    else lastActive = daysAgo(Math.min(signupDays - 2, 34 + Math.floor(r() * 180)), 20);
    const country = weighted(
      r,
      COUNTRIES.map(([c, , w]) => [c, w] as [string, number]),
    );
    const tier = weighted<TierCode>(r, [
      ["C1", 30],
      ["C2", 40],
      ["C3", 22],
      ["C4", 8],
    ]);
    seeds.push({ id: `usr_${token(r, 6)}`, name: `${first} ${last}`, email, plan, status, tier, signupDays, lastActive, country, team });
  }
  return seeds.map(build);
}

export const users: UserRecord[] = generate();

export function userById(id: string | undefined): UserRecord | undefined {
  return users.find((u) => u.id === id);
}

export const userCounts = STATUS_ORDER.reduce(
  (acc, s) => ({ ...acc, [s]: users.filter((u) => u.status === s).length }),
  {} as Record<UserStatus, number>,
);

export interface OperatorRef {
  name: string;
  initials: string;
}

export const OPERATORS: Record<string, OperatorRef> = {
  priya: { name: "Priya Shah", initials: "PS" },
  marcus: { name: "Marcus Bell", initials: "MB" },
  lena: { name: "Lena Ortiz", initials: "LO" },
};

export interface Entitlement {
  id: string;
  label: string;
  detail: string;
  enabled: boolean;
  source: "plan" | "granted" | "revoked" | "none";
  grantedBy?: string;
  grantedAt?: string;
}

export interface FlaggedConversation {
  id: string;
  scenario: string;
  reason: string;
  status: "open" | "reviewed";
  at: string;
}

export interface OnyxUsage {
  tokens: number;
  cost: number;
  messages: number;
  sessionsWithOnyx: number;
  help: { level: HelpLevel; share: number }[];
  flagged: FlaggedConversation[];
}

export interface UserReport {
  id: string;
  title: string;
  scenario: string;
  status: ReportStatus;
  words: number;
  updatedAt: string;
}

export interface SupportNote {
  id: string;
  author: OperatorRef;
  text: string;
  at: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  detail?: string;
  ip?: string;
  at: string;
  tone?: Tone;
  kind: "note" | "entitlement" | "billing" | "security" | "impersonate" | "trial" | "account";
}

export interface UserDetail {
  user: UserRecord;
  paymentMethod: string | null;
  subscriptionId: string | null;
  renewsAt: string | null;
  invoices: Invoice[];
  entitlements: Entitlement[];
  onyx: OnyxUsage;
  reports: UserReport[];
  notes: SupportNote[];
  audit: AuditEntry[];
}

const OPERATOR_IP = "203.0.113.24";

function invoicesFor(u: UserRecord, r: Rng): Invoice[] {
  if (u.plan === "free" || u.paidPeriods === 0) return [];
  const p = PLANS[u.plan];
  const step = p.interval === "yr" ? 365 : 30;
  const signupDays = Math.round((Date.now() - new Date(u.signupAt).getTime()) / 86400000);
  const prefix = u.stripeCustomer.slice(4, 10).toUpperCase();
  const out: Invoice[] = [];
  const description = u.plan === "team" ? `Team seat, ${u.team}` : `${p.name}, ${p.interval === "yr" ? "annual" : "monthly"}`;
  for (let i = 0; i < u.paidPeriods; i++) {
    out.push({
      id: `in_${token(r, 14)}`,
      number: `RP-${prefix}-${String(i + 1).padStart(4, "0")}`,
      date: daysAgo(Math.max(0, signupDays - 7 - i * step), 9),
      amount: p.price,
      currency: "USD",
      status: "paid",
      description,
    });
  }
  if (u.status === "past-due") {
    const n = u.paidPeriods + 1;
    out.push({
      id: `in_${token(r, 14)}`,
      number: `RP-${prefix}-${String(n).padStart(4, "0")}`,
      date: daysAgo(Math.max(0, signupDays - 7 - u.paidPeriods * step), 9),
      amount: p.price,
      currency: "USD",
      status: "open",
      description,
    });
  }
  return out.reverse();
}

function entitlementsFor(u: UserRecord): Entitlement[] {
  const paid = u.plan !== "free" && u.status !== "lapsed";
  const base: Entitlement[] = [
    { id: "labs", label: "Lab launching", detail: "60 active lab hours a month, fair use", enabled: paid, source: paid ? "plan" : "none" },
    { id: "exam-sim", label: "Exam simulations", detail: "Granite and Obsidian, timed", enabled: paid && u.status !== "trial", source: paid && u.status !== "trial" ? "plan" : "none" },
    { id: "walkthrough", label: "Onyx walkthrough level", detail: "Concrete commands for the current step", enabled: paid, source: paid ? "plan" : "none" },
    { id: "exports", label: "Report exports", detail: "PDF and Markdown", enabled: paid, source: paid ? "plan" : "none" },
    { id: "early-access", label: "Early access scenarios", detail: "Scenarios in review before publication", enabled: false, source: "none" },
    { id: "extra-hours", label: "Extra 20 lab hours", detail: "This period only, resets on the 1st", enabled: false, source: "none" },
  ];
  if (u.id === "usr_7Hk2pQ") {
    const ea = base.find((e) => e.id === "early-access")!;
    ea.enabled = true;
    ea.source = "granted";
    ea.grantedBy = "Priya Shah";
    ea.grantedAt = daysAgo(21, 15);
  }
  return base;
}

const HELP_BY_TIER: Record<TierCode, number[]> = {
  C1: [2, 4, 14, 38, 26, 16],
  C2: [4, 6, 18, 52, 15, 5],
  C3: [12, 14, 30, 34, 8, 2],
  C4: [26, 22, 30, 18, 4, 0],
};

const HELP_LEVELS: HelpLevel[] = ["exam-sim", "shadow", "nudge", "coach", "teach", "walkthrough"];

function onyxFor(u: UserRecord, r: Rng): OnyxUsage {
  const hours = u.labHours;
  const tokens = Math.round(hours * (22000 + r() * 10000));
  const weights = HELP_BY_TIER[u.tier].map((w) => Math.max(0, w + (r() - 0.5) * 4));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const help = HELP_LEVELS.map((level, i) => ({ level, share: Math.round((weights[i] / total) * 1000) / 10 }));
  const flagged: FlaggedConversation[] =
    u.id === "usr_7Hk2pQ"
      ? [
          { id: "conv_8Rt2Lq", scenario: "Meridian", reason: "Asked for the proof value on MER-DC01. Onyx refused and redirected to enumeration.", status: "reviewed", at: daysAgo(3, 21) },
          { id: "conv_8Sx4Wd", scenario: "Ironwood", reason: "Walkthrough answer cited a host outside the scenario. Grounding gap.", status: "open", at: daysAgo(8, 20) },
        ]
      : hours > 20 && r() < 0.3
        ? [{ id: `conv_${token(r, 6)}`, scenario: u.sessions[0]?.scenario ?? "Basalt", reason: "Learner pasted credentials from another platform into the chat.", status: "open", at: daysAgo(2, 20) }]
        : [];
  return {
    tokens,
    cost: Math.round((tokens / 1e6) * 4.56 * 100) / 100,
    messages: Math.round(tokens / 1350),
    sessionsWithOnyx: u.sessions.filter((s) => inPeriod(s.startedAt) && s.chargedHours > 0).length,
    help,
    flagged,
  };
}

function reportsFor(u: UserRecord, r: Rng): UserReport[] {
  if (u.id === "usr_7Hk2pQ") {
    return [
      { id: "rep-basalt", title: "Basalt: service exploitation to SYSTEM", scenario: "Basalt", status: "complete", words: 2184, updatedAt: daysAgo(1, 22) },
      { id: "rep-meridian", title: "Meridian: initial access and Kerberoasting", scenario: "Meridian", status: "draft", words: 1312, updatedAt: hoursAgo(1) },
      { id: "rep-kestrel", title: "Kestrel: web to shell", scenario: "Kestrel", status: "exported", words: 1876, updatedAt: daysAgo(37, 21) },
      { id: "rep-halcyon", title: "Halcyon: local privilege escalation", scenario: "Halcyon", status: "exported", words: 1420, updatedAt: daysAgo(45, 22) },
    ];
  }
  const done = u.sessions.filter((s) => s.outcome === "completed");
  const seen = new Set<string>();
  return done
    .filter((s) => (seen.has(s.scenario) ? false : (seen.add(s.scenario), true)))
    .slice(0, 4)
    .map((s, i) => ({
      id: `rep-${slug(s.scenario)}-${token(r, 4, B36)}`,
      title: `${s.scenario} report`,
      scenario: s.scenario,
      status: i === 0 ? "draft" : r() < 0.5 ? "complete" : "exported",
      words: 900 + Math.floor(r() * 2400),
      updatedAt: s.startedAt,
    }));
}

function notesFor(u: UserRecord): SupportNote[] {
  if (u.id === "usr_7Hk2pQ") {
    return [
      { id: "note-2", author: OPERATORS.marcus, text: "Tamarack launch failed during INC-0139 in eastus2. Confirmed 0 lab hours were charged and relaunched successfully.", at: daysAgo(4, 21) },
      { id: "note-1", author: OPERATORS.priya, text: "Asked whether Granite counts toward the 60 hour allowance. Confirmed exam simulations draw from the same allowance.", at: daysAgo(9, 14) },
    ];
  }
  if (u.status === "past-due") {
    return [{ id: "note-1", author: OPERATORS.lena, text: "Card declined twice. Learner says the bank flagged the charge as foreign. Retry scheduled.", at: daysAgo(2, 11) }];
  }
  return [];
}

function auditFor(u: UserRecord, notes: SupportNote[], ents: Entitlement[]): AuditEntry[] {
  const out: AuditEntry[] = notes.map((n) => ({ id: `au-${n.id}`, actor: n.author.name, action: "Added a support note", ip: OPERATOR_IP, at: n.at, kind: "note" }));
  ents
    .filter((e) => e.source === "granted")
    .forEach((e) => out.push({ id: `au-${e.id}`, actor: e.grantedBy!, action: `Granted ${e.label.toLowerCase()}`, ip: OPERATOR_IP, at: e.grantedAt!, kind: "entitlement", tone: "primary" }));
  if (u.id === "usr_7Hk2pQ") {
    out.push({ id: "au-2fa", actor: "Marcus Bell", action: "Reset two-factor authentication", detail: "Identity verified on ticket SUP-1874", ip: "198.51.100.7", at: daysAgo(88, 13), kind: "security", tone: "med" });
  }
  if (u.status === "past-due") {
    out.push({ id: "au-dun", actor: "Stripe webhook", action: "Payment failed, retry 2 of 4", detail: "card_declined: do_not_honor", at: daysAgo(2, 9), kind: "billing", tone: "high" });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export function userDetail(id: string | undefined): UserDetail | undefined {
  const u = userById(id);
  if (!u) return undefined;
  const r = mulberry32(hash(`${u.id}:detail`));
  const notes = notesFor(u);
  const entitlements = entitlementsFor(u);
  const paying = u.plan !== "free" && u.status !== "lapsed";
  const last4 = String(1000 + Math.floor(r() * 9000));
  const brand = pick(r, ["Visa", "Mastercard", "Amex"] as const);
  const step = PLANS[u.plan].interval === "yr" ? 365 : 30;
  const signupDays = Math.round((Date.now() - new Date(u.signupAt).getTime()) / 86400000);
  const sinceBilling = Math.max(0, signupDays - 7);
  const renewsIn = u.status === "trial" ? 7 - signupDays : step - (sinceBilling % step);
  return {
    user: u,
    paymentMethod: u.plan === "free" ? null : `${brand} ending ${u.id === "usr_7Hk2pQ" ? "4242" : last4}`,
    subscriptionId: paying || u.status === "lapsed" ? `sub_${token(r, 14)}` : null,
    renewsAt: paying ? daysFromNow(renewsIn) : null,
    invoices: invoicesFor(u, r),
    entitlements,
    onyx: onyxFor(u, r),
    reports: reportsFor(u, r),
    notes,
    audit: auditFor(u, notes, entitlements),
  };
}

export function toCsv(rows: UserRecord[]): string {
  const head = ["id", "email", "name", "plan", "status", "tier", "signup_date", "last_active", "lab_hours_period", "ltv_usd", "country"];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((u) =>
    [u.id, u.email, u.name, PLANS[u.plan].label, STATUS_META[u.status].label, u.tier, u.signupAt.slice(0, 10), u.lastActiveAt, u.labHours.toFixed(1), u.ltv.toFixed(2), u.country].map(esc).join(","),
  );
  return [head.join(","), ...lines].join("\n");
}
