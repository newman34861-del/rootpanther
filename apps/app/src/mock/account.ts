import type { ActivityItem, CurrentUser, LabSession, Notification, SessionRecord, UsageSummary } from "@rootpanther/ui";
import { scenarioById } from "./scenarios";
import { daysAgo, firstOfNextMonth, firstOfThisMonth, hoursAgo, minutesAgo } from "./time";

export const currentUser: CurrentUser = {
  id: "usr_7Hk2pQ",
  name: "Dana Reyes",
  email: "dana.reyes@example.com",
  handle: "dreyes",
  initials: "DR",
  tier: "C2",
  tierSince: daysAgo(43),
  roles: ["learner", "operator"],
  plan: "Practitioner",
  helpDefault: "coach",
  connectionDefault: "openvpn",
};

export const usage: UsageSummary = {
  usedHours: 41.5,
  allowanceHours: 60,
  resetsOn: firstOfNextMonth(),
  periodStart: firstOfThisMonth(),
};

const meridian = scenarioById("meridian")!;

export const activeSession: LabSession = {
  id: "ses_4QmX9a",
  scenarioId: meridian.id,
  scenarioName: meridian.name,
  domain: meridian.domain,
  objective: meridian.objective,
  startedAt: minutesAgo(102),
  elapsedMin: 102,
  maxLifeMin: 240,
  idleMin: 4,
  idleLimitMin: 30,
  hosts: meridian.hosts,
  connection: "openvpn",
  state: "running",
  helpLevel: "coach",
};

export const streakDays = 6;
export const scenariosCompleted = 4;

export const sessionHistory: SessionRecord[] = [
  { id: "ses_4QmX9a", scenarioId: "meridian", scenarioName: "Meridian", startedAt: minutesAgo(102), durationMin: 102, hostsOwned: 1, hostsTotal: 3, outcome: "partial", chargedHours: 1.7 },
  { id: "ses_3Lr8Kc", scenarioId: "basalt", scenarioName: "Basalt", startedAt: daysAgo(1, 19), durationMin: 118, hostsOwned: 1, hostsTotal: 1, outcome: "completed", chargedHours: 2.0, debriefId: "deb-basalt", reportId: "rep-basalt" },
  { id: "ses_3Kc1Zt", scenarioId: "meridian", scenarioName: "Meridian", startedAt: daysAgo(3, 20), durationMin: 186, hostsOwned: 1, hostsTotal: 3, outcome: "expired", chargedHours: 3.1, debriefId: "deb-meridian-1" },
  { id: "ses_3Jq7Wn", scenarioId: "tamarack", scenarioName: "Tamarack", startedAt: daysAgo(4, 21), durationMin: 95, hostsOwned: 0, hostsTotal: 1, outcome: "abandoned", chargedHours: 1.6 },
  { id: "ses_3Jp0Ad", scenarioId: "tamarack", scenarioName: "Tamarack", startedAt: daysAgo(4, 20), durationMin: 0, hostsOwned: 0, hostsTotal: 1, outcome: "failed-provision", chargedHours: 0 },
  { id: "ses_2Zx4Lm", scenarioId: "kestrel", scenarioName: "Kestrel", startedAt: daysAgo(38, 19), durationMin: 96, hostsOwned: 1, hostsTotal: 1, outcome: "completed", chargedHours: 1.6, debriefId: "deb-kestrel", reportId: "rep-kestrel" },
  { id: "ses_2Yt9Hq", scenarioId: "kestrel", scenarioName: "Kestrel", startedAt: daysAgo(40, 21), durationMin: 140, hostsOwned: 0, hostsTotal: 1, outcome: "abandoned", chargedHours: 2.3 },
  { id: "ses_2Ra3Ce", scenarioId: "halcyon", scenarioName: "Halcyon", startedAt: daysAgo(46, 20), durationMin: 74, hostsOwned: 1, hostsTotal: 1, outcome: "completed", chargedHours: 1.2, debriefId: "deb-halcyon", reportId: "rep-halcyon" },
  { id: "ses_2Mk5Vb", scenarioId: "lattice", scenarioName: "Lattice", startedAt: daysAgo(60, 19), durationMin: 52, hostsOwned: 1, hostsTotal: 1, outcome: "completed", chargedHours: 0.9, debriefId: "deb-lattice" },
];

export const recentActivity: ActivityItem[] = [
  { id: "a1", kind: "proof", title: "Proof captured: proof.txt on MER-WEB01", detail: "Meridian", at: minutesAgo(31), tone: "success", href: "/labs" },
  { id: "a2", kind: "lab-started", title: "Lab started: Meridian", detail: "OpenVPN, Coach", at: minutesAgo(102), href: "/labs" },
  { id: "a3", kind: "debrief", title: "Debrief ready: Basalt", detail: "2 gaps to drill", at: hoursAgo(22), href: "/reports/debriefs/deb-basalt" },
  { id: "a4", kind: "report", title: "Report drafted: Basalt", detail: "6 of 9 sections", at: hoursAgo(23), href: "/reports/rep-basalt" },
  { id: "a5", kind: "lab-ended", title: "Lab ended: Basalt, completed", detail: "1 h 58 m", at: hoursAgo(24), href: "/labs" },
];

export const notifications: Notification[] = [
  { id: "n1", title: "Session ends in 2 h 18 m", detail: "Meridian. Extend from the Labs page.", at: minutesAgo(2), read: false, tone: "med", href: "/labs" },
  { id: "n2", title: "Debrief ready for Basalt", detail: "Onyx found 2 gaps worth drilling.", at: hoursAgo(22), read: false, tone: "primary", href: "/reports/debriefs/deb-basalt" },
  { id: "n3", title: "Invoice paid", detail: "INV-2026-0918, $49.00", at: daysAgo(14), read: true, tone: "success", href: "/billing" },
  { id: "n4", title: "New scenario: Tamarack", detail: "Standalone, C2 Practitioner", at: daysAgo(3), read: true, href: "/catalogue/tamarack" },
];

export const onyxLatest = {
  kind: "debrief" as const,
  headline: "Basalt: privilege escalation found, but your notes skip how you confirmed SSTI.",
  detail: "Drill: template injection detection, 12 minutes, no lab needed.",
  href: "/reports/debriefs/deb-basalt",
  drillHref: "/onyx/drills",
};
