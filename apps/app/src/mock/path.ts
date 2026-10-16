import type { TechniqueFamily, TierCode } from "@rootpanther/ui";
import { currentUser } from "./account";
import { daysAgo } from "./time";

export interface TierStep {
  tier: TierCode;
  state: "verified" | "current" | "next" | "locked";
  detail: string;
  at?: string;
}

export const declaredTier: { tier: TierCode; at: string } = { tier: "C2", at: daysAgo(105) };

export const tierLadder: TierStep[] = [
  { tier: "C1", state: "verified", detail: "Verified", at: daysAgo(43) },
  { tier: "C2", state: "current", detail: "Current", at: currentUser.tierSince },
  { tier: "C3", state: "next", detail: "3 of 5 criteria" },
  { tier: "C4", state: "locked", detail: "After C3" },
];

export interface CriterionLink {
  label: string;
  href: string;
  kind: "scenario" | "drill" | "report" | "debrief";
}

export interface Criterion {
  id: string;
  title: string;
  met: boolean;
  progress?: { done: number; of: number };
  evidence: string;
  metAt?: string;
  links: CriterionLink[];
  startLinks: CriterionLink[];
}

export const nextTier: TierCode = "C3";

export const advancement: Criterion[] = [
  {
    id: "standalone",
    title: "Complete 3 standalone scenarios",
    met: true,
    progress: { done: 4, of: 3 },
    evidence: "Halcyon, Lattice, Kestrel and Basalt, all proofs captured",
    metAt: daysAgo(38),
    links: [{ label: "Kestrel", href: "/catalogue/kestrel", kind: "scenario" }],
    startLinks: [
      { label: "Halcyon", href: "/catalogue/halcyon", kind: "scenario" },
      { label: "Standalone scenarios", href: "/catalogue?type=standalone", kind: "scenario" },
    ],
  },
  {
    id: "kerberoasting",
    title: "Demonstrate Kerberoasting",
    met: true,
    evidence: "Solve-test passed: cracked svc_sql's TGS in Meridian",
    metAt: daysAgo(0, 9),
    links: [{ label: "Meridian debrief", href: "/reports/debriefs/deb-meridian-1", kind: "debrief" }],
    startLinks: [
      { label: "Meridian", href: "/catalogue/meridian", kind: "scenario" },
      { label: "Kerberoasting primer", href: "/onyx/primers?primer=kerberoasting", kind: "drill" },
    ],
  },
  {
    id: "report",
    title: "Submit a report with every required section",
    met: true,
    evidence: "Kestrel report, 9 of 9 sections, exported to PDF",
    metAt: daysAgo(37),
    links: [{ label: "Kestrel report", href: "/reports/rep-kestrel", kind: "report" }],
    startLinks: [{ label: "Reports", href: "/reports", kind: "report" }],
  },
  {
    id: "ad-sets",
    title: "Complete 2 AD sets at C2",
    met: false,
    progress: { done: 0, of: 2 },
    evidence: "Meridian in progress, 2 of 4 proofs",
    links: [
      { label: "Resume Meridian", href: "/catalogue/meridian", kind: "scenario" },
      { label: "Ironwood", href: "/catalogue/ironwood", kind: "scenario" },
    ],
    startLinks: [
      { label: "Meridian", href: "/catalogue/meridian", kind: "scenario" },
      { label: "Ironwood", href: "/catalogue/ironwood", kind: "scenario" },
    ],
  },
  {
    id: "delegation",
    title: "Demonstrate delegation abuse",
    met: false,
    evidence: "Not practised yet",
    links: [
      { label: "Ironwood", href: "/catalogue/ironwood", kind: "scenario" },
      { label: "S4U drill, 15 min", href: "/onyx/drills", kind: "drill" },
    ],
    startLinks: [
      { label: "Ironwood", href: "/catalogue/ironwood", kind: "scenario" },
      { label: "Delegation primer", href: "/onyx/primers?primer=delegation", kind: "drill" },
    ],
  },
];

export interface SkillRow {
  id: TechniqueFamily;
  strength: number;
  verified: boolean;
  scenarios: number;
  lastPractised?: string;
}

export interface SkillGroup {
  id: string;
  label: string;
  rows: SkillRow[];
}

export const skillGroups: SkillGroup[] = [
  {
    id: "foothold",
    label: "Initial access",
    rows: [
      { id: "web-to-shell", strength: 0.8, verified: true, scenarios: 3, lastPractised: daysAgo(1, 21) },
      { id: "service-exploitation", strength: 0.6, verified: false, scenarios: 2, lastPractised: daysAgo(4, 21) },
    ],
  },
  {
    id: "privesc",
    label: "Privilege escalation",
    rows: [
      { id: "linux-privesc", strength: 0.8, verified: true, scenarios: 3, lastPractised: daysAgo(1, 21) },
      { id: "windows-privesc", strength: 0.6, verified: false, scenarios: 2, lastPractised: daysAgo(4, 21) },
      { id: "local-privesc", strength: 0.4, verified: false, scenarios: 1, lastPractised: daysAgo(1, 21) },
    ],
  },
  {
    id: "ad",
    label: "Active Directory",
    rows: [
      { id: "kerberoasting", strength: 0.6, verified: true, scenarios: 1, lastPractised: daysAgo(0, 9) },
      { id: "acl-abuse", strength: 0.2, verified: false, scenarios: 1, lastPractised: daysAgo(3, 21) },
      { id: "lateral-movement", strength: 0.2, verified: false, scenarios: 1, lastPractised: daysAgo(3, 21) },
      { id: "delegation", strength: 0, verified: false, scenarios: 0 },
      { id: "domain-dominance", strength: 0, verified: false, scenarios: 0 },
      { id: "trust-abuse", strength: 0, verified: false, scenarios: 0 },
    ],
  },
];

export interface ReadinessGap {
  id: string;
  title: string;
  detail: string;
  href: string;
  action: string;
}

export const examReadiness = {
  score: 64,
  threshold: 75,
  scenarioId: "granite",
  components: [
    { id: "standalone", label: "Standalone hosts", value: 82 },
    { id: "ad", label: "AD set", value: 38 },
    { id: "docs", label: "Documentation", value: 71 },
    { id: "time", label: "Time management", value: 55 },
  ],
  gaps: [
    { id: "ad", title: "No AD set completed end to end", detail: "The exam AD set is worth 40 of 100 points.", href: "/catalogue/meridian", action: "Resume Meridian" },
    { id: "delegation", title: "Delegation never practised", detail: "Appears in 2 of the 3 C2 AD sets.", href: "/catalogue?technique=delegation", action: "Delegation scenarios" },
    { id: "stamina", title: "Longest session is 3h 06m", detail: "A simulation runs 23h 45m. Plan breaks and note-taking.", href: "/onyx/playbooks", action: "Exam day playbook" },
  ] as ReadinessGap[],
};
