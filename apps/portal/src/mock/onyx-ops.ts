import type { HelpLevel, OnyxMessageData } from "@rootpanther/ui";
import { daysAgo, firstOfThisMonth, hoursAgo, minutesAgo } from "./time";

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export const ONYX_INCIDENT_DAYS_AGO = 9;
export const LATENCY_SLO_P95 = 4;
export const COST_PER_HOUR_BUDGET = 0.45;
export const WALKTHROUGH_TARGET = 6;
export const GROUNDING_THRESHOLD = 2;

export interface OnyxDay {
  date: string;
  primary: number;
  fast: number;
  learnerHours: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  streams: number;
  streamFailures: number;
}

const rand = seeded(20261015);

export const onyxDays: OnyxDay[] = Array.from({ length: 30 }, (_, i) => {
  const ago = 30 - i;
  const date = daysAgo(ago, 12);
  const dow = new Date(date).getDay();
  const weekend = dow === 0 || dow === 6;
  const incident = ago === ONYX_INCIDENT_DAYS_AGO;
  const hours = Math.round((weekend ? 1080 : 870) * (1 + i * 0.005) * (0.95 + rand() * 0.1));
  const perHour = 0.4 - i * 0.0011 + (rand() - 0.5) * 0.018;
  const spend = hours * perHour;
  const fastShare = 0.16 + rand() * 0.03;
  const drift = Math.max(0, i - 22) * 0.045;
  const streams = Math.round(hours * (9.6 + rand() * 0.6));
  return {
    date,
    primary: round(spend * (1 - fastShare)),
    fast: round(spend * fastShare),
    learnerHours: hours,
    p50: round(incident ? 1.94 : 1.14 + rand() * 0.12, 2),
    p95: round(incident ? 5.18 : 3.02 + rand() * 0.22 + drift, 2),
    p99: round(incident ? 9.6 : 5.6 + rand() * 0.6 + drift * 1.4, 2),
    errorRate: round(incident ? 1.86 : 0.34 + rand() * 0.16, 2),
    streams,
    streamFailures: incident ? 71 : Math.round(streams * (0.0008 + rand() * 0.0006)),
  };
});

const monthStart = new Date(firstOfThisMonth()).setHours(0, 0, 0, 0);
const prevMonthSamePoint = onyxDays.filter((d) => new Date(d.date).getTime() < monthStart);
const thisMonthDays = onyxDays.filter((d) => new Date(d.date).getTime() >= monthStart);
const todaySoFar = 148.2;
const daySpend = (d: OnyxDay) => d.primary + d.fast;
const last = onyxDays[onyxDays.length - 1];
const prior7 = onyxDays.slice(-8, -1);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

const spendMtd = round(thisMonthDays.reduce((a, d) => a + daySpend(d), 0) + todaySoFar);
const elapsedDays = thisMonthDays.length + 0.5;
const daysInMonth = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0).getDate();
const comparable = prevMonthSamePoint.slice(-Math.max(1, thisMonthDays.length)).reduce((a, d) => a + daySpend(d), 0) + todaySoFar * 0.92;
const hours30 = onyxDays.reduce((a, d) => a + d.learnerHours, 0);
const spend30 = onyxDays.reduce((a, d) => a + daySpend(d), 0);
const recent = onyxDays.slice(-7);
const earlier = onyxDays.slice(-14, -7);
const cph = (ds: OnyxDay[]) => ds.reduce((a, d) => a + daySpend(d), 0) / ds.reduce((a, d) => a + d.learnerHours, 0);

export const onyxKpis = {
  spendMtd,
  spendMtdDelta: round(((spendMtd - comparable) / comparable) * 100, 1),
  projectedMonth: round((spendMtd / elapsedDays) * daysInMonth, 0),
  costPerHour: round(cph(recent), 2),
  costPerHourDelta: round(((cph(recent) - cph(earlier)) / cph(earlier)) * 100, 1),
  p50: last.p50,
  p50Delta: round(((last.p50 - avg(prior7.map((d) => d.p50))) / avg(prior7.map((d) => d.p50))) * 100, 1),
  p95: last.p95,
  p95Delta: round(((last.p95 - avg(prior7.map((d) => d.p95))) / avg(prior7.map((d) => d.p95))) * 100, 1),
  errorRate: last.errorRate,
  errorRateDelta: round(((last.errorRate - avg(prior7.map((d) => d.errorRate))) / avg(prior7.map((d) => d.errorRate))) * 100, 1),
  streams24h: last.streams,
  streamFailures24h: 17,
  streamFailuresPrior: 11,
  spend30,
  hours30,
};

export const streamFailureReasons: { id: string; label: string; count: number }[] = [
  { id: "client", label: "Client disconnected mid-stream", count: 7 },
  { id: "timeout", label: "Gateway timeout at 30 s", count: 5 },
  { id: "overloaded", label: "Upstream overloaded, retries exhausted", count: 3 },
  { id: "upstream", label: "Upstream 5xx", count: 2 },
];

export interface ScenarioSpend {
  slug: string;
  name: string;
  kind: "AD set" | "Standalone" | "Exam sim" | "No lab";
  weight: number;
  costPerHour: number;
  note?: string;
}

export const scenarioSpend: ScenarioSpend[] = [
  { slug: "meridian", name: "Meridian", kind: "AD set", weight: 15.2, costPerHour: 0.44 },
  { slug: "ironwood", name: "Ironwood", kind: "AD set", weight: 12.8, costPerHour: 0.47 },
  { slug: "vesper", name: "Vesper", kind: "AD set", weight: 9.6, costPerHour: 0.49 },
  { slug: "cinder", name: "Cinder", kind: "AD set", weight: 8.1, costPerHour: 0.51 },
  { slug: "mentor", name: "Mentor, primers, drills", kind: "No lab", weight: 7.7, costPerHour: 0.52 },
  { slug: "basalt", name: "Basalt", kind: "Standalone", weight: 7.3, costPerHour: 0.34 },
  { slug: "quarry", name: "Quarry", kind: "AD set", weight: 6.4, costPerHour: 0.53 },
  { slug: "tamarack", name: "Tamarack", kind: "Standalone", weight: 6.0, costPerHour: 0.33 },
  { slug: "kestrel", name: "Kestrel", kind: "Standalone", weight: 5.9, costPerHour: 0.31 },
  { slug: "halcyon", name: "Halcyon", kind: "Standalone", weight: 5.6, costPerHour: 0.31 },
  { slug: "lattice", name: "Lattice", kind: "Standalone", weight: 4.8, costPerHour: 0.32 },
  { slug: "harrow", name: "Harrow", kind: "Standalone", weight: 3.9, costPerHour: 0.36 },
  { slug: "juniper", name: "Juniper", kind: "Standalone", weight: 3.4, costPerHour: 0.35 },
  { slug: "granite", name: "Granite", kind: "Exam sim", weight: 2.2, costPerHour: 0.06, note: "Debriefs only" },
  { slug: "obsidian", name: "Obsidian", kind: "Exam sim", weight: 1.1, costPerHour: 0.06, note: "Debriefs only" },
];

export interface DialShare {
  level: HelpLevel;
  share: number;
  prior: number;
  hours: number;
}

export const dialDistribution: DialShare[] = [
  { level: "exam-sim", share: 9.4, prior: 8.8, hours: 2741 },
  { level: "shadow", share: 12.1, prior: 13.0, hours: 3528 },
  { level: "nudge", share: 21.6, prior: 23.4, hours: 6299 },
  { level: "coach", share: 31.2, prior: 32.1, hours: 9098 },
  { level: "teach", share: 18.9, prior: 17.6, hours: 5511 },
  { level: "walkthrough", share: 6.8, prior: 5.1, hours: 1983 },
];

export const walkthroughWeekly: { week: string; rate: number }[] = [5.8, 6.1, 6.4, 6.2, 6.6, 6.9, 6.8, 7.4, 7.9, 8.3, 8.8, 9.1].map((rate, i) => ({
  week: daysAgo((11 - i) * 7 + 1, 12),
  rate,
}));

const wk = walkthroughWeekly.map((w) => w.rate);
export const walkthroughRate = {
  current: round(avg(wk.slice(-4)), 1),
  prior: round(avg(wk.slice(-8, -4)), 1),
  sessions30: 3108,
  escalated30: Math.round(3108 * (avg(wk.slice(-4)) / 100)),
};

export const walkthroughByScenario: { slug: string; name: string; rate: number; sessions: number }[] = [
  { slug: "ironwood", name: "Ironwood", rate: 15.8, sessions: 412 },
  { slug: "vesper", name: "Vesper", rate: 13.1, sessions: 298 },
  { slug: "cinder", name: "Cinder", rate: 11.4, sessions: 236 },
  { slug: "quarry", name: "Quarry", rate: 10.2, sessions: 167 },
];

export type FlagReason = "safety" | "quality" | "spoiler";
export type FlagStatus = "open" | "escalated" | "resolved" | "dismissed";

export interface FlagAnnotation {
  id: string;
  by: string;
  at: string;
  action: "resolve" | "escalate" | "dismiss";
  text: string;
}

export interface FlaggedConversation {
  id: string;
  reason: FlagReason;
  scenario: { slug: string; name: string };
  learner: string;
  learnerId: string;
  flaggedBy: "auto" | "learner";
  level: HelpLevel;
  at: string;
  status: FlagStatus;
  summary: string;
  sessionId: string;
  messages: OnyxMessageData[];
  annotations: FlagAnnotation[];
}

function msgs(baseMin: number, list: Omit<OnyxMessageData, "id" | "at">[]): OnyxMessageData[] {
  return list.map((m, i) => ({ ...m, id: `m${i}`, at: minutesAgo(baseMin - i * 2) }));
}

export const flaggedConversations: FlaggedConversation[] = [
  {
    id: "flg_8Kq2",
    reason: "spoiler",
    scenario: { slug: "ironwood", name: "Ironwood" },
    learner: "dana.reyes@example.com",
    learnerId: "usr_7Hk2pQ",
    flaggedBy: "auto",
    level: "coach",
    at: minutesAgo(38),
    status: "open",
    summary: "Hint 2 of 4 named the misconfiguration type before the learner had enumerated it. Coach allows direction, not findings.",
    sessionId: "ses_9Fh2Lw",
    messages: msgs(52, [
      { role: "system", text: "Help level set to Coach" },
      { role: "you", text: "I have a shell on the print server as a low-privileged user. Not sure where to look next." },
      {
        role: "onyx",
        text: "Start with what the account you hold can already reach. Which groups is it in, and what do those groups have rights over?",
        command: "hint",
        hintStep: { step: 1, of: 4 },
      },
      { role: "you", text: "hint" },
      {
        role: "onyx",
        text: "Look at how the computer objects you found are configured for delegation. One of them is set up to act on behalf of other users, and that is your path to the domain controller.",
        command: "hint",
        hintStep: { step: 2, of: 4 },
      },
    ]),
    annotations: [],
  },
  {
    id: "flg_7Hn4",
    reason: "safety",
    scenario: { slug: "meridian", name: "Meridian" },
    learner: "m.okonkwo@example.com",
    learnerId: "usr_2Lm8Zr",
    flaggedBy: "auto",
    level: "teach",
    at: hoursAgo(2.2),
    status: "open",
    summary: "Learner asked about a target outside the lab range. Onyx declined and redirected. Review that the refusal was correct.",
    sessionId: "ses_3Kp7Vd",
    messages: msgs(140, [
      { role: "you", text: "Can I point the same scan at 203.0.113.0/24? It's a range at my office and I want to see what turns up." },
      {
        role: "onyx",
        text: "I can only help inside your lab. That range is outside the lab network, and testing it needs written authorisation from whoever owns it.\n\nBack on Meridian: you hold MER-WEB01. The next step is to map the internal subnet it can reach.",
      },
      { role: "you", text: "Fair. What should I look for on the internal subnet?" },
      {
        role: "onyx",
        text: "Which services answer from 172.16.20.0/24, and which of them accept the credentials you already have? Write down what you find before you try anything.",
      },
    ]),
    annotations: [],
  },
  {
    id: "flg_6Rt1",
    reason: "quality",
    scenario: { slug: "vesper", name: "Vesper" },
    learner: "s.lindqvist@example.com",
    learnerId: "usr_9Qw3Ty",
    flaggedBy: "learner",
    level: "coach",
    at: hoursAgo(5.4),
    status: "open",
    summary: "Learner reported the hint referred to an admin panel that does not exist on VES-WEB01. Likely grounding miss.",
    sessionId: "ses_6Tn1Qa",
    messages: msgs(330, [
      { role: "you", text: "Stuck on the first host. I've mapped the web app and found nothing obvious." },
      { role: "onyx", text: "Revisit the admin panel on VES-WEB01. Panels like that often keep default settings after deployment.", command: "hint", hintStep: { step: 1, of: 4 } },
      { role: "you", text: "There is no admin panel on that host. I've checked every path I found." },
      {
        role: "onyx",
        text: "You're right. I cannot confirm an admin panel from this scenario's notes. Go back to what your enumeration shows: which inputs does the app accept, and how does it respond to unexpected ones?",
      },
      { role: "system", text: "Learner flagged this conversation: hint did not match the host" },
    ]),
    annotations: [],
  },
  {
    id: "flg_5Zp9",
    reason: "spoiler",
    scenario: { slug: "tamarack", name: "Tamarack" },
    learner: "t.nguyen@example.com",
    learnerId: "usr_8Jk1Xc",
    flaggedBy: "auto",
    level: "nudge",
    at: hoursAgo(9),
    status: "escalated",
    summary: "Nudge response gave the location of the credential file. Hint ladder for phase 2 is too specific.",
    sessionId: "ses_2Wm5Hs",
    messages: msgs(560, [
      { role: "you", text: "Any direction on privilege escalation here?" },
      {
        role: "onyx",
        text: "Check the backup scripts in the service account's home directory. One of them stores a password in plain text.",
        command: "hint",
        hintStep: { step: 1, of: 3 },
      },
    ]),
    annotations: [
      {
        id: "a1",
        by: "priya@rootpanther.com",
        at: hoursAgo(7.5),
        action: "escalate",
        text: "Sent to content. Tamarack phase 2 hint 1 names the file. Should point at scheduled jobs in general.",
      },
    ],
  },
  {
    id: "flg_4Wd3",
    reason: "quality",
    scenario: { slug: "cinder", name: "Cinder" },
    learner: "a.haddad@example.com",
    learnerId: "usr_4Fd6Gh",
    flaggedBy: "learner",
    level: "teach",
    at: hoursAgo(26),
    status: "open",
    summary: "Learner said the explanation of the forest trust was hard to follow. Answer ran to 640 words.",
    sessionId: "ses_8Ly4Pc",
    messages: msgs(1580, [
      { role: "you", text: "explain how the child and parent domains trust each other here" },
      {
        role: "onyx",
        text: "A parent and child domain in the same forest trust each other in both directions by default, and that trust is transitive. Accounts in one can be granted access in the other.\n\nWhat matters for Cinder is which identities the child domain is allowed to present to the parent, and what the parent does with them. Map the trust first, then ask what a privileged identity in the child could claim in the parent.",
        command: "explain",
      },
      { role: "system", text: "Learner flagged this conversation: too long, unclear" },
    ]),
    annotations: [],
  },
  {
    id: "flg_3Mx8",
    reason: "safety",
    scenario: { slug: "basalt", name: "Basalt" },
    learner: "j.whitfield@example.com",
    learnerId: "usr_5Gc9Rm",
    flaggedBy: "auto",
    level: "coach",
    at: hoursAgo(31),
    status: "resolved",
    summary: "Learner pasted what looked like a real API token into the chat. Onyx told them to rotate it. Message redacted.",
    sessionId: "ses_1Pd8Xe",
    messages: msgs(1880, [
      { role: "you", text: "[redacted by safety filter]" },
      {
        role: "onyx",
        text: "That looks like a live credential from outside the lab. I have not stored it. Rotate it with whoever issued it, and keep real secrets out of lab notes.",
      },
    ]),
    annotations: [{ id: "a1", by: "marcus@rootpanther.com", at: hoursAgo(29), action: "resolve", text: "Redaction worked. Onyx response correct. No further action." }],
  },
  {
    id: "flg_2Bv5",
    reason: "quality",
    scenario: { slug: "kestrel", name: "Kestrel" },
    learner: "r.osei@example.com",
    learnerId: "usr_3Vb7Nk",
    flaggedBy: "learner",
    level: "nudge",
    at: hoursAgo(50),
    status: "dismissed",
    summary: "Learner wanted the answer at Nudge. Onyx held the level as designed.",
    sessionId: "ses_7Cx2Jm",
    messages: msgs(3010, [
      { role: "you", text: "just tell me what to run" },
      {
        role: "onyx",
        text: "At Nudge I give direction, not commands. You have found two open services. Which of them shows a version you could look up?",
        command: "hint",
        hintStep: { step: 1, of: 4 },
      },
    ]),
    annotations: [{ id: "a1", by: "priya@rootpanther.com", at: hoursAgo(47), action: "dismiss", text: "Working as intended. Learner can raise the help level." }],
  },
  {
    id: "flg_1Qa7",
    reason: "spoiler",
    scenario: { slug: "quarry", name: "Quarry" },
    learner: "e.marsh@example.com",
    learnerId: "usr_6Hs2Wq",
    flaggedBy: "auto",
    level: "walkthrough",
    at: hoursAgo(74),
    status: "dismissed",
    summary: "Spoiler detector fired at Walkthrough, where concrete steps are expected after confirmation.",
    sessionId: "ses_4Rv9Bt",
    messages: msgs(4440, [
      { role: "system", text: "Help level raised to Walkthrough, confirmed by learner" },
      { role: "you", text: "walkthrough" },
      {
        role: "onyx",
        text: "You are at the certificate authority phase. Step one: list the certificate templates and note which ones low-privileged users can enrol in. Tell me what you find and we will take the next step together.",
        command: "walkthrough",
      },
    ]),
    annotations: [{ id: "a1", by: "marcus@rootpanther.com", at: hoursAgo(70), action: "dismiss", text: "False positive. Detector should skip Walkthrough after confirmation." }],
  },
  {
    id: "flg_0Lc2",
    reason: "quality",
    scenario: { slug: "halcyon", name: "Halcyon" },
    learner: "k.brandt@example.com",
    learnerId: "usr_1Ze4Ly",
    flaggedBy: "learner",
    level: "coach",
    at: hoursAgo(98),
    status: "resolved",
    summary: "Onyx repeated the same hint three times instead of escalating the ladder.",
    sessionId: "ses_5Mk3Gf",
    messages: msgs(5880, [
      { role: "you", text: "hint" },
      { role: "onyx", text: "Look at what runs as a privileged account on this host.", command: "hint", hintStep: { step: 1, of: 4 } },
      { role: "you", text: "hint" },
      { role: "onyx", text: "Look at what runs as a privileged account on this host.", command: "hint", hintStep: { step: 1, of: 4 } },
    ]),
    annotations: [{ id: "a1", by: "priya@rootpanther.com", at: hoursAgo(90), action: "resolve", text: "Ladder state was lost on reconnect. Fixed in gateway 2.14.1." }],
  },
];

export interface GroundingRow {
  slug: string;
  name: string;
  answers: number;
  ungrounded: number;
  lastAt: string;
  phase: string;
}

export const groundingHealth: GroundingRow[] = [
  { slug: "juniper", name: "Juniper", answers: 1412, ungrounded: 91, lastAt: minutesAgo(47), phase: "Phase 3, privilege escalation" },
  { slug: "obsidian", name: "Obsidian", answers: 384, ungrounded: 12, lastAt: hoursAgo(19), phase: "Debrief" },
  { slug: "vesper", name: "Vesper", answers: 4106, ungrounded: 94, lastAt: hoursAgo(5.4), phase: "Phase 1, initial access" },
  { slug: "cinder", name: "Cinder", answers: 3388, ungrounded: 47, lastAt: hoursAgo(14), phase: "Phase 4, trust abuse" },
  { slug: "ironwood", name: "Ironwood", answers: 5520, ungrounded: 50, lastAt: hoursAgo(3), phase: "Phase 2, delegation" },
  { slug: "quarry", name: "Quarry", answers: 2214, ungrounded: 15, lastAt: daysAgo(2, 21), phase: "Phase 3, certificate services" },
  { slug: "meridian", name: "Meridian", answers: 6870, ungrounded: 27, lastAt: daysAgo(3, 22), phase: "Phase 2, lateral movement" },
  { slug: "basalt", name: "Basalt", answers: 2950, ungrounded: 9, lastAt: daysAgo(6, 19), phase: "Phase 1, initial access" },
];

export const groundingOverall = (() => {
  const answers = 48210;
  const ungrounded = groundingHealth.reduce((a, r) => a + r.ungrounded, 0) + 18;
  return { answers, ungrounded, rate: round((ungrounded / answers) * 100, 2) };
})();
