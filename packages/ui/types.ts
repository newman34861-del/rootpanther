export type Theme = "dark" | "light";
export type ThemePreference = Theme | "system";

export type Tone = "neutral" | "primary" | "success" | "info" | "med" | "high" | "crit" | "premium";

export type TierCode = "C1" | "C2" | "C3" | "C4";

export const TIER_NAMES: Record<TierCode, string> = {
  C1: "Apprentice",
  C2: "Practitioner",
  C3: "Adept",
  C4: "Master",
};

export const TIER_ORDER: TierCode[] = ["C1", "C2", "C3", "C4"];

export type ScenarioType = "ad-set" | "standalone" | "exam-sim";

export const SCENARIO_TYPE_LABEL: Record<ScenarioType, string> = {
  "ad-set": "AD SET",
  standalone: "STANDALONE",
  "exam-sim": "EXAM SIM",
};

export type TechniqueFamily =
  | "local-privesc"
  | "kerberoasting"
  | "acl-abuse"
  | "delegation"
  | "lateral-movement"
  | "domain-dominance"
  | "trust-abuse"
  | "web-to-shell"
  | "service-exploitation"
  | "linux-privesc"
  | "windows-privesc";

export const TECHNIQUE_LABEL: Record<TechniqueFamily, string> = {
  "local-privesc": "Local privesc",
  kerberoasting: "Kerberoasting",
  "acl-abuse": "ACL abuse",
  delegation: "Delegation",
  "lateral-movement": "Lateral movement",
  "domain-dominance": "Domain dominance",
  "trust-abuse": "Trust abuse",
  "web-to-shell": "Web to shell",
  "service-exploitation": "Service exploitation",
  "linux-privesc": "Linux privesc",
  "windows-privesc": "Windows privesc",
};

export type OsFamily = "windows" | "linux" | "mixed";
export type ProgressStatus = "not-started" | "in-progress" | "completed";

export const PROGRESS_LABEL: Record<ProgressStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  completed: "Completed",
};

export type HostExposure = "learner-facing" | "internal";
export type ProofKind = "local" | "proof" | "domain";

export interface Host {
  id: string;
  name: string;
  ip: string;
  os: "windows" | "linux";
  role: string;
  exposure: HostExposure;
  owned?: boolean;
  reachable?: boolean;
  ports?: number[];
  proofs?: ProofKind[];
}

export interface TopologyLink {
  from: string;
  to: string;
  label?: string;
}

export interface ScenarioHistory {
  attempts: number;
  bestMinutes?: number;
  proofsCaptured: number;
  proofsTotal: number;
  lastAttempt?: string;
  debriefId?: string;
}

export interface Prerequisite {
  label: string;
  kind: "scenario" | "primer";
  ref: string;
}

export interface Scenario {
  id: string;
  slug: string;
  name: string;
  type: ScenarioType;
  tier: TierCode;
  objective: string;
  domain: string;
  os: OsFamily;
  techniques: TechniqueFamily[];
  estMinutes: number;
  hostCount: number;
  status: ProgressStatus;
  difficulty: number;
  publishedAt: string;
  summary: string;
  teaches: string[];
  hosts: Host[];
  links: TopologyLink[];
  credential?: { username: string; password: string };
  proofRequirements: string[];
  prerequisites: Prerequisite[];
  history?: ScenarioHistory;
  recommended?: boolean;
}

export type HelpLevel = "exam-sim" | "shadow" | "nudge" | "coach" | "teach" | "walkthrough";

export const HELP_LEVELS: { id: HelpLevel; label: string; description: string }[] = [
  { id: "exam-sim", label: "Exam sim", description: "Onyx is silent. The run is logged as clean." },
  { id: "shadow", label: "Shadow", description: "Onyx observes and answers only direct questions about methodology." },
  { id: "nudge", label: "Nudge", description: "Short directional hints when asked. No commands." },
  { id: "coach", label: "Coach", description: "Hints escalate when you are stuck. Explains why, not what." },
  { id: "teach", label: "Teach", description: "Explains techniques in depth, with references to the current host." },
  { id: "walkthrough", label: "Walkthrough", description: "Concrete commands for the current step. Requires confirmation." },
];

export type OnyxCommand =
  | "hint"
  | "why"
  | "check"
  | "stuck"
  | "explain"
  | "methodology"
  | "teach"
  | "walkthrough"
  | "review"
  | "note";

export const ONYX_COMMANDS: OnyxCommand[] = [
  "hint",
  "why",
  "check",
  "stuck",
  "explain",
  "methodology",
  "teach",
  "walkthrough",
  "review",
  "note",
];

export interface OnyxMessageData {
  id: string;
  role: "onyx" | "you" | "system";
  text: string;
  at: string;
  command?: OnyxCommand;
  hintStep?: { step: number; of: number };
  code?: string;
  streaming?: boolean;
}

export type ActivityKind =
  | "lab-started"
  | "lab-ended"
  | "proof"
  | "report"
  | "tier"
  | "debrief"
  | "signup"
  | "upgrade"
  | "cancel"
  | "payment-failed"
  | "provision-failed"
  | "launch"
  | "alert";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  at: string;
  tone?: Tone;
  href?: string;
}

export type SessionState =
  | "provisioning"
  | "connecting"
  | "running"
  | "idle-warning"
  | "expiring"
  | "reconnecting"
  | "ended"
  | "failed";

export type ConnectionMethod = "browser" | "openvpn";

export interface LabSession {
  id: string;
  scenarioId: string;
  scenarioName: string;
  domain: string;
  objective: string;
  startedAt: string;
  elapsedMin: number;
  maxLifeMin: number;
  idleMin: number;
  idleLimitMin: number;
  hosts: Host[];
  connection: ConnectionMethod;
  state: SessionState;
  helpLevel: HelpLevel;
}

export interface SessionRecord {
  id: string;
  scenarioId: string;
  scenarioName: string;
  startedAt: string;
  durationMin: number;
  hostsOwned: number;
  hostsTotal: number;
  outcome: "completed" | "partial" | "abandoned" | "failed-provision" | "expired";
  chargedHours: number;
  debriefId?: string;
  reportId?: string;
}

export interface UsageSummary {
  usedHours: number;
  allowanceHours: number;
  resetsOn: string;
  periodStart: string;
}

export type ReportStatus = "draft" | "complete" | "exported";

export interface ReportSummary {
  id: string;
  title: string;
  scenarios: string[];
  status: ReportStatus;
  updatedAt: string;
  wordCount: number;
}

export interface ReportSection {
  id: string;
  title: string;
  parentId?: string;
  state: "empty" | "draft" | "done";
  host?: string;
}

export type EvidenceKind = "command" | "note" | "screenshot" | "proof";

export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  host?: string;
  command?: string;
  output?: string;
  text?: string;
  capturedAt: string;
  used?: boolean;
}

export interface Debrief {
  id: string;
  sessionId: string;
  scenarioName: string;
  scenarioId: string;
  date: string;
  headline: string;
  intendedPath: string[];
  didWell: string[];
  missed: string[];
  drillNext: { label: string; href: string }[];
  helpLevel: HelpLevel;
  durationMin: number;
}

export interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnualMonthly?: number;
  priceAnnualTotal?: number;
  currency: string;
  summary: string;
  features: string[];
  labHours: number | null;
  recommended?: boolean;
  ctaLabel: string;
}

export type InvoiceStatus = "paid" | "open" | "void" | "uncollectible" | "refunded";

export interface Invoice {
  id: string;
  number: string;
  date: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  description: string;
}

export interface Notification {
  id: string;
  title: string;
  detail?: string;
  at: string;
  read: boolean;
  tone?: Tone;
  href?: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  handle?: string;
  initials: string;
  tier: TierCode;
  tierSince: string;
  roles: ("learner" | "operator")[];
  plan: string;
  helpDefault: HelpLevel;
  connectionDefault: ConnectionMethod;
}

export interface SeriesPoint {
  x: string;
  y: number;
}

export interface Series {
  id: string;
  label: string;
  points: SeriesPoint[];
  tone?: "chart-1" | "chart-2" | "chart-3" | Tone;
}
