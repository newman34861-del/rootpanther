import type { Host, Scenario, TopologyLink } from "@rootpanther/ui";
import { daysAgo } from "./time";

function standaloneHost(prefix: string, ip: string, os: "windows" | "linux", role: string): Host {
  return { id: `${prefix}-01`, name: `${prefix}-01`, ip, os, role, exposure: "learner-facing", reachable: true, ports: os === "linux" ? [22, 80, 8080] : [80, 135, 445, 3389, 5985] };
}

const STANDALONE_PROOFS = [
  "local.txt read as a low-privileged user, with hostname and IP in the same screenshot",
  "proof.txt read as root or SYSTEM, with hostname and IP in the same screenshot",
];

const AD_PROOFS = [
  "local.txt on the foothold host",
  "proof.txt on each member server you compromise",
  "proof.txt on the domain controller, read as a Domain Admin",
];

const meridianHosts: Host[] = [
  { id: "mer-web01", name: "MER-WEB01", ip: "10.13.37.10", os: "windows", role: "IIS web server, domain member", exposure: "learner-facing", owned: true, reachable: true, ports: [80, 135, 445, 5985], proofs: ["local", "proof"] },
  { id: "mer-sql01", name: "MER-SQL01", ip: "172.16.20.11", os: "windows", role: "SQL Server 2019, domain member", exposure: "internal", reachable: true, ports: [135, 445, 1433, 5985] },
  { id: "mer-dc01", name: "MER-DC01", ip: "172.16.20.5", os: "windows", role: "Domain controller", exposure: "internal", ports: [53, 88, 135, 389, 445, 636] },
];
const meridianLinks: TopologyLink[] = [
  { from: "mer-web01", to: "mer-sql01", label: "pivot" },
  { from: "mer-sql01", to: "mer-dc01" },
];

const examHosts = (prefix: string, base: number) => ({
  hosts: [
    { id: `${prefix}-s1`, name: `${prefix}-S1`, ip: `10.13.37.${base}`, os: "linux", role: "Standalone target", exposure: "learner-facing", reachable: true },
    { id: `${prefix}-s2`, name: `${prefix}-S2`, ip: `10.13.37.${base + 1}`, os: "windows", role: "Standalone target", exposure: "learner-facing", reachable: true },
    { id: `${prefix}-s3`, name: `${prefix}-S3`, ip: `10.13.37.${base + 2}`, os: "linux", role: "Standalone target", exposure: "learner-facing", reachable: true },
    { id: `${prefix}-ms01`, name: `${prefix}-MS01`, ip: `10.13.37.${base + 3}`, os: "windows", role: "AD set foothold", exposure: "learner-facing", reachable: true },
    { id: `${prefix}-ms02`, name: `${prefix}-MS02`, ip: `172.16.${base}.12`, os: "windows", role: "AD set member", exposure: "internal" },
    { id: `${prefix}-dc01`, name: `${prefix}-DC01`, ip: `172.16.${base}.5`, os: "windows", role: "AD set domain controller", exposure: "internal" },
  ] as Host[],
  links: [
    { from: `${prefix}-ms01`, to: `${prefix}-ms02`, label: "pivot" },
    { from: `${prefix}-ms02`, to: `${prefix}-dc01` },
  ],
});
const obsidian = examHosts("OBS", 80);
const granite = examHosts("GRN", 90);

export const scenarios: Scenario[] = [
  {
    id: "meridian",
    slug: "meridian",
    name: "Meridian",
    type: "ad-set",
    tier: "C2",
    objective: "Domain Admin",
    domain: "meridian.local",
    os: "windows",
    techniques: ["kerberoasting", "acl-abuse", "lateral-movement", "domain-dominance"],
    estMinutes: 240,
    hostCount: 3,
    status: "in-progress",
    difficulty: 3,
    publishedAt: daysAgo(40),
    summary: "A three-host domain behind an IIS foothold. Service accounts with weak passwords and a misdelegated ACL lead to the domain controller.",
    teaches: [
      "Enumerate a domain from a low-privileged foothold with BloodHound and LDAP queries",
      "Request and crack service tickets for accounts with SPNs",
      "Abuse GenericWrite on a user object to take over an account",
      "Pivot through a member server to reach the internal subnet",
      "Extract domain credentials once you hold replication rights",
    ],
    hosts: meridianHosts,
    links: meridianLinks,
    credential: { username: "MERIDIAN\\j.harlow", password: "Autumn#2026" },
    proofRequirements: AD_PROOFS,
    prerequisites: [
      { label: "Kerberoasting primer", kind: "primer", ref: "kerberoasting" },
      { label: "Reading BloodHound paths", kind: "primer", ref: "bloodhound" },
    ],
    history: { attempts: 2, proofsCaptured: 2, proofsTotal: 4, lastAttempt: daysAgo(0, 19), debriefId: "deb-meridian-1" },
  },
  {
    id: "tamarack",
    slug: "tamarack",
    name: "Tamarack",
    type: "standalone",
    tier: "C2",
    objective: "SYSTEM",
    domain: "tamarack.lab",
    os: "windows",
    techniques: ["service-exploitation", "windows-privesc"],
    estMinutes: 150,
    hostCount: 1,
    status: "in-progress",
    difficulty: 2,
    publishedAt: daysAgo(30),
    summary: "A monitoring agent with an authenticated RCE, then SeImpersonatePrivilege.",
    teaches: ["Recover credentials from a configuration backup", "Exploit an authenticated RCE", "Abuse SeImpersonatePrivilege"],
    hosts: [standaloneHost("TMK", "10.13.37.36", "windows", "Windows Server 2022")],
    links: [],
    proofRequirements: STANDALONE_PROOFS,
    prerequisites: [],
    history: { attempts: 1, proofsCaptured: 1, proofsTotal: 2, lastAttempt: daysAgo(4) },
  },
  {
    id: "granite",
    slug: "granite",
    name: "Granite",
    type: "exam-sim",
    tier: "C2",
    objective: "70 points in 23h 45m",
    domain: "granite.exam",
    os: "mixed",
    techniques: ["web-to-shell", "service-exploitation", "linux-privesc", "windows-privesc", "kerberoasting", "lateral-movement"],
    estMinutes: 1425,
    hostCount: 6,
    status: "not-started",
    difficulty: 3,
    publishedAt: daysAgo(70),
    summary: "Three standalone hosts and a three-host AD set, scored like the exam. Onyx is locked to Exam sim for the full run.",
    teaches: ["Plan time across six hosts", "Document as you go under a deadline", "Recover from a dead end without losing an hour"],
    hosts: granite.hosts,
    links: granite.links,
    proofRequirements: ["Proofs scored per host: 10 points per standalone flag pair, 40 points for the AD set", "A report submitted within 24 hours of the run ending"],
    prerequisites: [
      { label: "Meridian", kind: "scenario", ref: "meridian" },
      { label: "Tamarack", kind: "scenario", ref: "tamarack" },
    ],
  },
  {
    id: "obsidian",
    slug: "obsidian",
    name: "Obsidian",
    type: "exam-sim",
    tier: "C3",
    objective: "70 points in 23h 45m",
    domain: "obsidian.exam",
    os: "mixed",
    techniques: ["web-to-shell", "service-exploitation", "windows-privesc", "linux-privesc", "acl-abuse", "delegation", "lateral-movement"],
    estMinutes: 1425,
    hostCount: 6,
    status: "not-started",
    difficulty: 4,
    publishedAt: daysAgo(25),
    summary: "A harder full simulation. The AD set needs an ACL chain and delegation abuse to finish.",
    teaches: ["Sustain methodology across a long run", "Prioritise hosts by expected points", "Write a report that would pass review"],
    hosts: obsidian.hosts,
    links: obsidian.links,
    proofRequirements: ["Proofs scored per host: 10 points per standalone flag pair, 40 points for the AD set", "A report submitted within 24 hours of the run ending"],
    prerequisites: [{ label: "Granite", kind: "scenario", ref: "granite" }],
  },
];

export function scenarioById(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id || s.slug === id);
}
