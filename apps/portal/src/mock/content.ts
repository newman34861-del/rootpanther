import type { Host, ScenarioType, TechniqueFamily, TierCode, TopologyLink } from "@rootpanther/ui";
import { daysAgo, hoursAgo, minutesAgo } from "./time";

export type ContentStatus = "draft" | "in-review" | "published" | "retired";
export type SolveResult = "pass" | "fail" | "not-run";
export type Phase = "recon" | "foothold" | "privesc" | "lateral" | "domain";

export const PHASES: { id: Phase; label: string; short: string }[] = [
  { id: "recon", label: "Recon", short: "Recon" },
  { id: "foothold", label: "Foothold", short: "Foothold" },
  { id: "privesc", label: "Privilege escalation", short: "Privesc" },
  { id: "lateral", label: "Lateral movement", short: "Lateral" },
  { id: "domain", label: "Domain", short: "Domain" },
];

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  draft: "Draft",
  "in-review": "In review",
  published: "Published",
  retired: "Retired",
};

export interface SolveRun {
  id: string;
  version: string;
  result: "pass" | "fail";
  at: string;
  durationSec: number;
}

export interface SolveTest {
  result: SolveResult;
  version: string;
  at?: string;
  durationSec?: number;
  solvable?: boolean;
  shortcutFree?: boolean;
  failure?: string;
  runs: SolveRun[];
}

export interface GroundingCell {
  applicable: boolean;
  opener: boolean;
  hints: number;
}

export interface ContentScenario {
  id: string;
  slug: string;
  name: string;
  prefix: string;
  type: ScenarioType;
  tier: TierCode;
  objective: string;
  domain: string;
  techniques: TechniqueFamily[];
  hosts: Host[];
  links: TopologyLink[];
  credential?: { username: string; password: string };
  serviceAccount?: string;
  version: string;
  liveVersion?: string;
  status: ContentStatus;
  updatedAt: string;
  learnersInProgress: number;
  solveTest: SolveTest;
  grounding: Record<Phase, GroundingCell>;
}

function standalone(prefix: string, octet: number, os: "windows" | "linux", role: string): Host[] {
  return [{ id: `${prefix.toLowerCase()}-01`, name: `${prefix}-01`, ip: `10.13.37.${octet}`, os, role, exposure: "learner-facing" }];
}

function adSet(prefix: string, octet: number): { hosts: Host[]; links: TopologyLink[] } {
  const p = prefix.toLowerCase();
  return {
    hosts: [
      { id: `${p}-web01`, name: `${prefix}-WEB01`, ip: `10.13.37.${octet}`, os: "windows", role: "Web server, domain member", exposure: "learner-facing" },
      { id: `${p}-app01`, name: `${prefix}-APP01`, ip: `172.16.${octet}.21`, os: "windows", role: "Application server, domain member", exposure: "internal" },
      { id: `${p}-dc01`, name: `${prefix}-DC01`, ip: `172.16.${octet}.5`, os: "windows", role: "Domain controller", exposure: "internal" },
    ],
    links: [
      { from: `${p}-web01`, to: `${p}-app01`, label: "pivot" },
      { from: `${p}-app01`, to: `${p}-dc01` },
    ],
  };
}

function examSet(prefix: string, base: number): { hosts: Host[]; links: TopologyLink[] } {
  const p = prefix.toLowerCase();
  return {
    hosts: [
      { id: `${p}-s1`, name: `${prefix}-S1`, ip: `10.13.37.${base}`, os: "linux", role: "Standalone target", exposure: "learner-facing" },
      { id: `${p}-s2`, name: `${prefix}-S2`, ip: `10.13.37.${base + 1}`, os: "windows", role: "Standalone target", exposure: "learner-facing" },
      { id: `${p}-s3`, name: `${prefix}-S3`, ip: `10.13.37.${base + 2}`, os: "linux", role: "Standalone target", exposure: "learner-facing" },
      { id: `${p}-ms01`, name: `${prefix}-MS01`, ip: `10.13.37.${base + 3}`, os: "windows", role: "AD set foothold", exposure: "learner-facing" },
      { id: `${p}-ms02`, name: `${prefix}-MS02`, ip: `172.16.${base}.12`, os: "windows", role: "AD set member", exposure: "internal" },
      { id: `${p}-dc01`, name: `${prefix}-DC01`, ip: `172.16.${base}.5`, os: "windows", role: "AD set domain controller", exposure: "internal" },
    ],
    links: [
      { from: `${p}-ms01`, to: `${p}-ms02`, label: "pivot" },
      { from: `${p}-ms02`, to: `${p}-dc01` },
    ],
  };
}

const meridian = {
  hosts: [
    { id: "mer-web01", name: "MER-WEB01", ip: "10.13.37.10", os: "windows", role: "IIS web server, domain member", exposure: "learner-facing" },
    { id: "mer-sql01", name: "MER-SQL01", ip: "172.16.20.11", os: "windows", role: "SQL Server 2019, domain member", exposure: "internal" },
    { id: "mer-dc01", name: "MER-DC01", ip: "172.16.20.5", os: "windows", role: "Domain controller", exposure: "internal" },
  ] as Host[],
  links: [
    { from: "mer-web01", to: "mer-sql01", label: "pivot" },
    { from: "mer-sql01", to: "mer-dc01" },
  ],
};

const cinder = {
  hosts: [
    { id: "cin-web01", name: "CIN-WEB01", ip: "10.13.37.52", os: "linux", role: "Reverse proxy, Ubuntu 22.04", exposure: "learner-facing" },
    { id: "cin-ws01", name: "CIN-WS01", ip: "172.16.52.30", os: "windows", role: "Workstation, child domain", exposure: "internal" },
    { id: "cin-dc01", name: "CIN-DC01", ip: "172.16.52.5", os: "windows", role: "Child domain controller", exposure: "internal" },
    { id: "cin-dc00", name: "CIN-DC00", ip: "172.16.50.5", os: "windows", role: "Forest root domain controller", exposure: "internal" },
  ] as Host[],
  links: [
    { from: "cin-web01", to: "cin-ws01", label: "pivot" },
    { from: "cin-ws01", to: "cin-dc01" },
    { from: "cin-dc01", to: "cin-dc00", label: "trust" },
  ],
};

const quarry = {
  hosts: [
    { id: "qry-mail01", name: "QRY-MAIL01", ip: "10.13.37.70", os: "windows", role: "Exchange front end", exposure: "learner-facing" },
    { id: "qry-file01", name: "QRY-FILE01", ip: "172.16.70.14", os: "windows", role: "File server", exposure: "internal" },
    { id: "qry-ca01", name: "QRY-CA01", ip: "172.16.70.9", os: "windows", role: "Certificate authority", exposure: "internal" },
    { id: "qry-dc01", name: "QRY-DC01", ip: "172.16.70.5", os: "windows", role: "Domain controller", exposure: "internal" },
    { id: "qry-dc02", name: "QRY-DC02", ip: "172.16.71.5", os: "windows", role: "Partner forest DC", exposure: "internal" },
  ] as Host[],
  links: [
    { from: "qry-mail01", to: "qry-file01", label: "pivot" },
    { from: "qry-mail01", to: "qry-ca01" },
    { from: "qry-file01", to: "qry-dc01" },
    { from: "qry-dc01", to: "qry-dc02", label: "trust" },
  ],
};

const ironwood = adSet("IRW", 40);
const vesper = adSet("VSP", 61);
const granite = examSet("GRN", 90);
const obsidian = examSet("OBS", 80);

function g(recon: number, foothold: number, privesc: number, lateral: number | null, domain: number | null, missingOpeners: Phase[] = []): Record<Phase, GroundingCell> {
  const cell = (p: Phase, hints: number | null): GroundingCell => ({ applicable: hints !== null, opener: hints !== null && !missingOpeners.includes(p), hints: hints ?? 0 });
  return { recon: cell("recon", recon), foothold: cell("foothold", foothold), privesc: cell("privesc", privesc), lateral: cell("lateral", lateral), domain: cell("domain", domain) };
}

function history(seed: number, version: string, baseSec: number, fails: number[] = [], olderVersion?: { version: string; from: number }): SolveRun[] {
  return Array.from({ length: 12 }, (_, i) => {
    const jitter = ((seed * 31 + i * 17) % 23) - 11;
    return {
      id: `run_${String(4820 - i * 14 - seed).padStart(4, "0")}`,
      version: olderVersion && i >= olderVersion.from ? olderVersion.version : version,
      result: fails.includes(i) ? "fail" : "pass",
      at: daysAgo(i, 3),
      durationSec: Math.round(baseSec * (1 + jitter / 100)),
    };
  });
}

function passing(seed: number, version: string, baseSec: number, olderVersion?: { version: string; from: number }): SolveTest {
  const runs = history(seed, version, baseSec, [], olderVersion);
  return { result: "pass", version, at: runs[0].at, durationSec: runs[0].durationSec, solvable: true, shortcutFree: true, runs };
}

export const contentScenarios: ContentScenario[] = [
  {
    id: "meridian",
    slug: "meridian",
    name: "Meridian",
    prefix: "MER",
    type: "ad-set",
    tier: "C2",
    objective: "Domain Admin",
    domain: "meridian.local",
    techniques: ["kerberoasting", "acl-abuse", "lateral-movement", "domain-dominance"],
    ...meridian,
    credential: { username: "MERIDIAN\\j.harlow", password: "Autumn#2026" },
    serviceAccount: "svc_sql",
    version: "1.4.2",
    status: "published",
    updatedAt: daysAgo(18),
    learnersInProgress: 186,
    solveTest: passing(1, "1.4.2", 46 * 60 + 12),
    grounding: g(4, 5, 4, 4, 3),
  },
  {
    id: "ironwood",
    slug: "ironwood",
    name: "Ironwood",
    prefix: "IRW",
    type: "ad-set",
    tier: "C2",
    objective: "Domain Admin",
    domain: "ironwood.local",
    techniques: ["delegation", "kerberoasting", "lateral-movement"],
    ...ironwood,
    credential: { username: "IRONWOOD\\svc_print", password: "Printer2026" },
    serviceAccount: "svc_app",
    version: "1.1.0",
    status: "published",
    updatedAt: daysAgo(12),
    learnersInProgress: 64,
    solveTest: passing(2, "1.1.0", 41 * 60 + 40),
    grounding: g(4, 4, 4, 3, 4),
  },
  {
    id: "halcyon",
    slug: "halcyon",
    name: "Halcyon",
    prefix: "HAL",
    type: "standalone",
    tier: "C1",
    objective: "Root",
    domain: "halcyon.lab",
    techniques: ["web-to-shell", "linux-privesc"],
    hosts: standalone("HAL", 21, "linux", "Ubuntu 20.04, Apache"),
    links: [],
    serviceAccount: "www-data",
    version: "2.0.3",
    status: "published",
    updatedAt: daysAgo(64),
    learnersInProgress: 38,
    solveTest: passing(3, "2.0.3", 19 * 60 + 8),
    grounding: g(3, 4, 4, null, null),
  },
  {
    id: "kestrel",
    slug: "kestrel",
    name: "Kestrel",
    prefix: "KES",
    type: "standalone",
    tier: "C1",
    objective: "SYSTEM",
    domain: "kestrel.lab",
    techniques: ["service-exploitation", "windows-privesc"],
    hosts: standalone("KES", 24, "windows", "Windows Server 2019"),
    links: [],
    serviceAccount: "ftpsvc",
    version: "1.3.1",
    status: "published",
    updatedAt: daysAgo(51),
    learnersInProgress: 29,
    solveTest: passing(4, "1.3.1", 22 * 60 + 31),
    grounding: g(3, 4, 3, null, null),
  },
  {
    id: "basalt",
    slug: "basalt",
    name: "Basalt",
    prefix: "BSL",
    type: "standalone",
    tier: "C2",
    objective: "Root",
    domain: "basalt.lab",
    techniques: ["web-to-shell", "linux-privesc", "local-privesc"],
    hosts: standalone("BSL", 33, "linux", "Debian 12, Flask behind nginx"),
    links: [],
    serviceAccount: "dashboard",
    version: "1.2.0",
    status: "published",
    updatedAt: daysAgo(44),
    learnersInProgress: 57,
    solveTest: passing(5, "1.2.0", 24 * 60 + 5),
    grounding: g(3, 5, 4, null, null),
  },
  {
    id: "tamarack",
    slug: "tamarack",
    name: "Tamarack",
    prefix: "TMK",
    type: "standalone",
    tier: "C2",
    objective: "SYSTEM",
    domain: "tamarack.lab",
    techniques: ["service-exploitation", "windows-privesc"],
    hosts: standalone("TMK", 36, "windows", "Windows Server 2022"),
    links: [],
    serviceAccount: "monagent",
    version: "1.0.6",
    status: "published",
    updatedAt: daysAgo(9),
    learnersInProgress: 44,
    solveTest: passing(6, "1.0.6", 27 * 60 + 44),
    grounding: g(3, 4, 4, null, null),
  },
  {
    id: "lattice",
    slug: "lattice",
    name: "Lattice",
    prefix: "LTC",
    type: "standalone",
    tier: "C1",
    objective: "Root",
    domain: "lattice.lab",
    techniques: ["web-to-shell", "linux-privesc"],
    hosts: standalone("LTC", 27, "linux", "Ubuntu 22.04, PHP"),
    links: [],
    serviceAccount: "pingsvc",
    version: "1.4.0",
    status: "retired",
    updatedAt: daysAgo(9),
    learnersInProgress: 0,
    solveTest: { ...passing(7, "1.4.0", 17 * 60 + 52), at: daysAgo(9, 3) },
    grounding: g(3, 3, 3, null, null),
  },
  {
    id: "juniper",
    slug: "juniper",
    name: "Juniper",
    prefix: "JNP",
    type: "standalone",
    tier: "C2",
    objective: "Root",
    domain: "juniper.lab",
    techniques: ["service-exploitation", "linux-privesc"],
    hosts: standalone("JNP", 38, "linux", "Rocky Linux 9"),
    links: [],
    serviceAccount: "redis",
    version: "1.0.1",
    status: "published",
    updatedAt: daysAgo(3),
    learnersInProgress: 71,
    solveTest: passing(8, "1.0.1", 26 * 60 + 17, { version: "1.0.0", from: 3 }),
    grounding: g(3, 4, 0, null, null),
  },
  {
    id: "harrow",
    slug: "harrow",
    name: "Harrow",
    prefix: "HRW",
    type: "standalone",
    tier: "C3",
    objective: "SYSTEM",
    domain: "harrow.lab",
    techniques: ["service-exploitation", "windows-privesc", "local-privesc"],
    hosts: standalone("HRW", 44, "windows", "Windows Server 2022"),
    links: [],
    serviceAccount: "svc_ledger",
    version: "1.2.0",
    status: "published",
    updatedAt: daysAgo(20),
    learnersInProgress: 23,
    solveTest: (() => {
      const runs = history(9, "1.2.0", 31 * 60 + 20, [0]);
      return {
        result: "fail" as const,
        version: "1.2.0",
        at: runs[0].at,
        durationSec: runs[0].durationSec,
        solvable: false,
        shortcutFree: true,
        failure: "Not solvable: the deserialization payload is rejected after the .NET 8.0.11 base image update on HRW-01.",
        runs,
      };
    })(),
    grounding: g(4, 4, 5, null, null),
  },
  {
    id: "vesper",
    slug: "vesper",
    name: "Vesper",
    prefix: "VSP",
    type: "ad-set",
    tier: "C3",
    objective: "Domain Admin",
    domain: "vesper.local",
    techniques: ["acl-abuse", "lateral-movement", "delegation"],
    ...vesper,
    credential: { username: "VESPER\\m.ortiz", password: "Lantern!77" },
    serviceAccount: "svc_backup",
    version: "1.0.3",
    status: "published",
    updatedAt: daysAgo(15),
    learnersInProgress: 52,
    solveTest: passing(10, "1.0.3", 58 * 60 + 3),
    grounding: g(4, 4, 4, 5, 4),
  },
  {
    id: "cinder",
    slug: "cinder",
    name: "Cinder",
    prefix: "CIN",
    type: "ad-set",
    tier: "C3",
    objective: "Enterprise Admin",
    domain: "child.cinder.local",
    techniques: ["trust-abuse", "delegation", "domain-dominance", "web-to-shell"],
    ...cinder,
    credential: { username: "CHILD\\backup_ro", password: "Ember-0491" },
    serviceAccount: "svc_proxy",
    version: "1.3.0",
    liveVersion: "1.2.2",
    status: "in-review",
    updatedAt: hoursAgo(20),
    learnersInProgress: 33,
    solveTest: passing(11, "1.3.0", 72 * 60 + 18, { version: "1.2.2", from: 2 }),
    grounding: g(4, 4, 4, 4, 3, ["domain"]),
  },
  {
    id: "quarry",
    slug: "quarry",
    name: "Quarry",
    prefix: "QRY",
    type: "ad-set",
    tier: "C4",
    objective: "Partner forest",
    domain: "quarry.local",
    techniques: ["trust-abuse", "domain-dominance", "delegation", "acl-abuse"],
    ...quarry,
    credential: { username: "QUARRY\\intern04", password: "Gravel_2026" },
    serviceAccount: "svc_enroll",
    version: "1.1.0",
    liveVersion: "1.0.4",
    status: "in-review",
    updatedAt: daysAgo(3),
    learnersInProgress: 19,
    solveTest: (() => {
      const runs = history(12, "1.1.0", 94 * 60 + 40, [0, 1, 2], { version: "1.0.4", from: 3 });
      return {
        result: "fail" as const,
        version: "1.1.0",
        at: runs[0].at,
        durationSec: runs[0].durationSec,
        solvable: true,
        shortcutFree: false,
        failure: "Unintended shortcut: ESC8 relay to web enrollment on QRY-CA01 reaches Domain Admin without crossing the forest trust.",
        runs,
      };
    })(),
    grounding: g(4, 5, 4, 0, 4, ["domain"]),
  },
  {
    id: "granite",
    slug: "granite",
    name: "Granite",
    prefix: "GRN",
    type: "exam-sim",
    tier: "C2",
    objective: "70 points in 23h 45m",
    domain: "granite.exam",
    techniques: ["web-to-shell", "service-exploitation", "linux-privesc", "windows-privesc", "kerberoasting", "lateral-movement"],
    ...granite,
    serviceAccount: "svc_report",
    version: "2.1.0",
    status: "published",
    updatedAt: daysAgo(33),
    learnersInProgress: 96,
    solveTest: passing(13, "2.1.0", 161 * 60 + 26),
    grounding: g(5, 5, 5, 4, 4),
  },
  {
    id: "obsidian",
    slug: "obsidian",
    name: "Obsidian",
    prefix: "OBS",
    type: "exam-sim",
    tier: "C3",
    objective: "70 points in 23h 45m",
    domain: "obsidian.exam",
    techniques: ["web-to-shell", "service-exploitation", "windows-privesc", "linux-privesc", "acl-abuse", "delegation", "lateral-movement"],
    ...obsidian,
    serviceAccount: "svc_sched",
    version: "2.0.0",
    liveVersion: "1.6.1",
    status: "draft",
    updatedAt: hoursAgo(6),
    learnersInProgress: 41,
    solveTest: { result: "not-run", version: "2.0.0", runs: history(14, "1.6.1", 174 * 60 + 9).map((r) => ({ ...r, version: "1.6.1" })) },
    grounding: g(5, 4, 0, 0, 3, ["lateral", "domain"]),
  },
];

export function contentScenario(slug: string | null): ContentScenario | undefined {
  return contentScenarios.find((s) => s.slug === slug);
}

export function liveVersionOf(s: ContentScenario): string | null {
  if (s.status === "retired") return null;
  if (s.status === "published") return s.version;
  return s.liveVersion ?? null;
}

export function groundingScore(s: ContentScenario): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const p of PHASES) {
    const c = s.grounding[p.id];
    if (!c.applicable) continue;
    total += 2;
    if (c.opener) done += 1;
    if (c.hints > 0) done += 1;
  }
  return { done, total };
}

export const ciSchedule = { nextRunAt: (() => {
  const t = new Date(minutesAgo(0));
  t.setDate(t.getDate() + 1);
  t.setHours(3, 0, 0, 0);
  return t.toISOString();
})() };

export type RandKind = "credential" | "flag" | "hostname" | "network";

export interface RandField {
  id: string;
  kind: RandKind;
  label: string;
  target: string;
  generator: string;
  constraint: string;
}

export function randomisationFor(s: ContentScenario): RandField[] {
  const fields: RandField[] = [];
  if (s.credential) {
    fields.push({ id: "cred-initial-user", kind: "credential", label: "Starting username", target: s.credential.username.split("\\")[0], generator: "names:initial.last", constraint: "Listed in the brief" });
    fields.push({ id: "cred-initial-pass", kind: "credential", label: "Starting password", target: s.credential.username.split("\\")[0], generator: "pattern:{Season}#{Year}", constraint: "Listed in the brief" });
  }
  if (s.serviceAccount) {
    fields.push({
      id: "cred-service",
      kind: "credential",
      label: `${s.serviceAccount} password`,
      target: s.hosts[s.type === "standalone" ? 0 : 1]?.name ?? s.hosts[0].name,
      generator: "wordlist:rockyou-top5k",
      constraint: "rockyou.txt, under 2 min",
    });
  }
  if (s.type !== "standalone") {
    fields.push({ id: "cred-da", kind: "credential", label: "Domain Admin password", target: s.domain, generator: "random:24 charset=full", constraint: "Not crackable" });
  }
  s.hosts.forEach((h, i) => {
    if (s.type === "standalone" || h.exposure === "learner-facing" || i === 0) {
      fields.push({ id: `flag-local-${h.id}`, kind: "flag", label: "local.txt", target: h.name, generator: "hex:32", constraint: "Unique per deploy" });
    }
    fields.push({ id: `flag-proof-${h.id}`, kind: "flag", label: "proof.txt", target: h.name, generator: "hex:32", constraint: "Unique per deploy" });
  });
  fields.push({ id: "hostnames", kind: "hostname", label: "Hostnames", target: s.hosts.length === 1 ? "1 host" : `${s.hosts.length} hosts`, generator: `pattern:${s.prefix}-{ROLE}{nn}`, constraint: "01 to 09, no repeats" });
  if (s.hosts.some((h) => h.exposure === "internal")) {
    fields.push({ id: "subnet", kind: "network", label: "Internal subnet", target: "Pivot network", generator: "cidr:172.16.0.0/12 size=/24", constraint: "Outside 10.13.37.0/24" });
  }
  fields.push({ id: "ip", kind: "network", label: "Learner-facing addresses", target: "Tunnel network", generator: "pool:10.13.37.10-250", constraint: "Unique within the tenant" });
  return fields;
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

const SEASONS = ["Spring", "Summer", "Autumn", "Winter", "Harvest", "Solstice"];
const WORDS = ["sunshine7", "princess12", "liverpool9", "dragon2020", "monkey88", "football4", "charlie01", "summer19", "qwerty123", "shadow77", "michelle1", "jordan23"];
const FIRST = ["r", "a", "t", "k", "m", "e", "s", "j", "l", "n"];
const LAST = ["calder", "voss", "pereira", "lindholm", "okoro", "brandt", "keane", "marsh", "tal", "ferris"];
const FULL = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%^&*";

export interface GeneratedValue {
  id: string;
  label: string;
  kind: RandKind;
  target: string;
  value: string;
}

export interface GeneratedInstance {
  seed: string;
  values: GeneratedValue[];
  hosts: Host[];
  links: TopologyLink[];
}

export function generateInstance(s: ContentScenario, seed: number): GeneratedInstance {
  const r = prng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const hex = (n: number) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("");
  const subnet = 16 + Math.floor(r() * 230);
  const usedNums = new Set<number>();
  const nameMap = new Map<string, string>();
  const ipMap = new Map<string, string>();
  s.hosts.forEach((h) => {
    const role = h.name.slice(s.prefix.length + 1).replace(/\d+$/, "") || "SRV";
    let n = 1 + Math.floor(r() * 9);
    while (usedNums.has(n)) n = 1 + Math.floor(r() * 9);
    usedNums.add(n);
    nameMap.set(h.id, `${s.prefix}-${role}${String(n).padStart(2, "0")}`);
    const last = h.ip.split(".")[3];
    ipMap.set(h.id, h.exposure === "learner-facing" ? `10.13.37.${10 + Math.floor(r() * 240)}` : `172.16.${subnet}.${last}`);
  });
  const hosts: Host[] = s.hosts.map((h) => ({ ...h, name: nameMap.get(h.id)!, ip: ipMap.get(h.id)! }));
  const domainShort = s.credential?.username.split("\\")[0];
  const values: GeneratedValue[] = randomisationFor(s).map((f) => {
    let value = "";
    if (f.id === "cred-initial-user") value = `${domainShort}\\${pick(FIRST)}.${pick(LAST)}`;
    else if (f.id === "cred-initial-pass") value = `${pick(SEASONS)}#${2024 + Math.floor(r() * 3)}`;
    else if (f.id === "cred-service") value = pick(WORDS);
    else if (f.id === "cred-da") value = Array.from({ length: 24 }, () => FULL[Math.floor(r() * FULL.length)]).join("");
    else if (f.kind === "flag") value = hex(32);
    else if (f.id === "hostnames") value = hosts.map((h) => h.name).join(", ");
    else if (f.id === "subnet") value = `172.16.${subnet}.0/24`;
    else if (f.id === "ip") value = hosts.filter((h) => h.exposure === "learner-facing").map((h) => h.ip).join(", ");
    const hostTarget = s.hosts.find((h) => h.name === f.target);
    return { id: f.id, label: f.label, kind: f.kind, target: hostTarget ? nameMap.get(hostTarget.id)! : f.target, value };
  });
  return { seed: `0x${(seed >>> 0).toString(16).padStart(8, "0")}`, values, hosts, links: s.links };
}
