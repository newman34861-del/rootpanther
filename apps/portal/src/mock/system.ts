import type { Tone } from "@rootpanther/ui";
import { daysAgo, hoursAgo, minutesAgo } from "./time";

export type ServiceStatus = "operational" | "degraded" | "outage" | "maintenance";

export const SERVICE_STATUS: Record<ServiceStatus, { label: string; tone: Tone }> = {
  operational: { label: "Operational", tone: "success" },
  degraded: { label: "Degraded", tone: "med" },
  outage: { label: "Outage", tone: "crit" },
  maintenance: { label: "Maintenance", tone: "info" },
};

export type DayState = "ok" | "degraded" | "outage" | "maintenance" | "none";

export interface Service {
  id: string;
  name: string;
  component: string;
  status: ServiceStatus;
  uptime30: number;
  p95: number;
  p95Unit: "ms" | "s";
  p95Slo: number;
  note?: string;
  days: DayState[];
}

function strip(events: Record<number, DayState>): DayState[] {
  return Array.from({ length: 90 }, (_, i) => events[89 - i] ?? "ok");
}

export const services: Service[] = [
  {
    id: "control-plane",
    name: "Control plane",
    component: "rp-control, AKS uksouth",
    status: "operational",
    uptime30: 99.98,
    p95: 182,
    p95Unit: "ms",
    p95Slo: 400,
    days: strip({ 12: "degraded", 41: "maintenance" }),
  },
  {
    id: "api",
    name: "API",
    component: "api.rootpanther.com",
    status: "operational",
    uptime30: 99.99,
    p95: 214,
    p95Unit: "ms",
    p95Slo: 500,
    days: strip({ 41: "degraded", 66: "degraded" }),
  },
  {
    id: "database",
    name: "Database",
    component: "PostgreSQL 16, zone redundant",
    status: "operational",
    uptime30: 100,
    p95: 9,
    p95Unit: "ms",
    p95Slo: 50,
    days: strip({ 41: "maintenance" }),
  },
  {
    id: "provisioning",
    name: "Provisioning worker",
    component: "rp-provisioner, 6 replicas",
    status: "degraded",
    uptime30: 99.71,
    p95: 214,
    p95Unit: "s",
    p95Slo: 180,
    note: "uksouth launches queueing, p95 over SLO",
    days: strip({ 0: "degraded", 12: "outage", 52: "degraded", 74: "outage" }),
  },
  {
    id: "onyx-gateway",
    name: "Onyx gateway",
    component: "onyx-gw v2.14.1",
    status: "operational",
    uptime30: 99.91,
    p95: 3.39,
    p95Unit: "s",
    p95Slo: 4,
    note: "p95 is time to first token",
    days: strip({ 9: "outage", 28: "degraded", 58: "degraded" }),
  },
];

export type AuditAction =
  | "user.impersonate"
  | "user.refund"
  | "user.delete"
  | "user.entitlement.grant"
  | "user.trial.extend"
  | "tenant.teardown"
  | "tenant.extend"
  | "scenario.publish"
  | "scenario.unpublish"
  | "flag.update"
  | "config.update"
  | "operator.invite"
  | "operator.role.update"
  | "operator.signin"
  | "operator.signin.failed"
  | "export.csv"
  | "onyx.flag.resolve";

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  "user.impersonate": "Impersonated user",
  "user.refund": "Issued refund",
  "user.delete": "Deleted user",
  "user.entitlement.grant": "Granted entitlement",
  "user.trial.extend": "Extended trial",
  "tenant.teardown": "Forced teardown",
  "tenant.extend": "Extended lab",
  "scenario.publish": "Published scenario",
  "scenario.unpublish": "Unpublished scenario",
  "flag.update": "Changed feature flag",
  "config.update": "Changed config",
  "operator.invite": "Invited operator",
  "operator.role.update": "Changed operator role",
  "operator.signin": "Signed in",
  "operator.signin.failed": "Failed sign-in",
  "export.csv": "Exported CSV",
  "onyx.flag.resolve": "Resolved Onyx flag",
};

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: AuditAction;
  target: string;
  targetHref?: string;
  detail?: string;
  ip: string;
  location: string;
}

export const operators = ["priya@rootpanther.com", "marcus@rootpanther.com", "lena@rootpanther.com", "tomas@rootpanther.com"];

export const auditLog: AuditEntry[] = [
  {
    id: "aud_9f3k21",
    at: minutesAgo(4),
    actor: "marcus@rootpanther.com",
    action: "tenant.teardown",
    target: "rp-t-1zz8op",
    targetHref: "/fleet?tenant=rp-t-1zz8op",
    detail: "Orphaned, no activity for 6h 12m",
    ip: "81.2.69.160",
    location: "London, GB",
  },
  {
    id: "aud_9f3k20",
    at: minutesAgo(19),
    actor: "priya@rootpanther.com",
    action: "flag.update",
    target: "provisioning.uksouth.enabled",
    detail: "true to false, INC-0142",
    ip: "86.12.204.33",
    location: "Manchester, GB",
  },
  {
    id: "aud_9f3k19",
    at: minutesAgo(27),
    actor: "priya@rootpanther.com",
    action: "operator.signin",
    target: "priya@rootpanther.com",
    detail: "Password and TOTP",
    ip: "86.12.204.33",
    location: "Manchester, GB",
  },
  {
    id: "aud_9f3k18",
    at: minutesAgo(52),
    actor: "lena@rootpanther.com",
    action: "user.impersonate",
    target: "usr_4Fd6Gh",
    targetHref: "/users/usr_4Fd6Gh",
    detail: "Support ticket SUP-2291, 14 min session",
    ip: "185.199.110.12",
    location: "Berlin, DE",
  },
  {
    id: "aud_9f3k17",
    at: hoursAgo(1.6),
    actor: "marcus@rootpanther.com",
    action: "onyx.flag.resolve",
    target: "flg_3Mx8",
    targetHref: "/onyx",
    ip: "81.2.69.160",
    location: "London, GB",
  },
  {
    id: "aud_9f3k16",
    at: hoursAgo(2.4),
    actor: "tomas@rootpanther.com",
    action: "operator.signin.failed",
    target: "tomas@rootpanther.com",
    detail: "Wrong TOTP code, attempt 1 of 5",
    ip: "203.0.113.48",
    location: "Lisbon, PT",
  },
  {
    id: "aud_9f3k15",
    at: hoursAgo(2.5),
    actor: "tomas@rootpanther.com",
    action: "operator.signin",
    target: "tomas@rootpanther.com",
    detail: "Password and TOTP",
    ip: "203.0.113.48",
    location: "Lisbon, PT",
  },
  {
    id: "aud_9f3k14",
    at: hoursAgo(3.1),
    actor: "lena@rootpanther.com",
    action: "user.refund",
    target: "usr_2Lm8Zr",
    targetHref: "/users/usr_2Lm8Zr",
    detail: "$39.00, INV-2026-1044, duplicate charge",
    ip: "185.199.110.12",
    location: "Berlin, DE",
  },
  {
    id: "aud_9f3k13",
    at: hoursAgo(4.8),
    actor: "priya@rootpanther.com",
    action: "scenario.publish",
    target: "juniper v1.3.0",
    targetHref: "/content?scenario=juniper",
    detail: "Solve-test passed, 0 learners affected",
    ip: "86.12.204.33",
    location: "Manchester, GB",
  },
  {
    id: "aud_9f3k12",
    at: hoursAgo(6),
    actor: "marcus@rootpanther.com",
    action: "tenant.extend",
    target: "rp-t-7vb2kd",
    targetHref: "/fleet?tenant=rp-t-7vb2kd",
    detail: "+60 min, learner request",
    ip: "81.2.69.160",
    location: "London, GB",
  },
  {
    id: "aud_9f3k11",
    at: hoursAgo(9),
    actor: "lena@rootpanther.com",
    action: "user.trial.extend",
    target: "usr_9Qw3Ty",
    targetHref: "/users/usr_9Qw3Ty",
    detail: "+7 days, provisioning failure during trial",
    ip: "185.199.110.12",
    location: "Berlin, DE",
  },
  {
    id: "aud_9f3k10",
    at: hoursAgo(20),
    actor: "priya@rootpanther.com",
    action: "export.csv",
    target: "Users, 1,448 rows",
    detail: "Filtered: plan is any",
    ip: "86.12.204.33",
    location: "Manchester, GB",
  },
  {
    id: "aud_9f3k09",
    at: daysAgo(1, 16),
    actor: "priya@rootpanther.com",
    action: "config.update",
    target: "LAB_MAX_LIFE_MIN",
    detail: "300 to 240",
    ip: "86.12.204.33",
    location: "Manchester, GB",
  },
  {
    id: "aud_9f3k08",
    at: daysAgo(1, 11),
    actor: "marcus@rootpanther.com",
    action: "scenario.unpublish",
    target: "harrow v0.9.2",
    targetHref: "/content?scenario=harrow",
    detail: "Unintended shortcut found, 37 learners affected",
    ip: "81.2.69.160",
    location: "London, GB",
  },
  {
    id: "aud_9f3k07",
    at: daysAgo(2, 15),
    actor: "lena@rootpanther.com",
    action: "user.entitlement.grant",
    target: "usr_8Jk1Xc",
    targetHref: "/users/usr_8Jk1Xc",
    detail: "Comped 1 month, Practitioner",
    ip: "185.199.110.12",
    location: "Berlin, DE",
  },
  {
    id: "aud_9f3k06",
    at: daysAgo(3, 10),
    actor: "priya@rootpanther.com",
    action: "operator.role.update",
    target: "tomas@rootpanther.com",
    detail: "Support to Onyx reviewer",
    ip: "86.12.204.33",
    location: "Manchester, GB",
  },
  {
    id: "aud_9f3k05",
    at: daysAgo(3, 9),
    actor: "priya@rootpanther.com",
    action: "operator.invite",
    target: "tomas@rootpanther.com",
    detail: "Role: Support, 2FA required",
    ip: "86.12.204.33",
    location: "Manchester, GB",
  },
  {
    id: "aud_9f3k04",
    at: daysAgo(5, 14),
    actor: "marcus@rootpanther.com",
    action: "flag.update",
    target: "onyx.walkthrough.confirm_twice",
    detail: "false to true",
    ip: "81.2.69.160",
    location: "London, GB",
  },
  {
    id: "aud_9f3k03",
    at: daysAgo(6, 18),
    actor: "lena@rootpanther.com",
    action: "user.delete",
    target: "usr_0Xa1Kd",
    detail: "GDPR erasure request, ticket SUP-2240",
    ip: "185.199.110.12",
    location: "Berlin, DE",
  },
  {
    id: "aud_9f3k02",
    at: daysAgo(8, 12),
    actor: "priya@rootpanther.com",
    action: "config.update",
    target: "ONYX_PRIMARY_MODEL_TIMEOUT_S",
    detail: "45 to 30",
    ip: "86.12.204.33",
    location: "Manchester, GB",
  },
  {
    id: "aud_9f3k01",
    at: daysAgo(12, 9),
    actor: "marcus@rootpanther.com",
    action: "tenant.teardown",
    target: "rp-t-0kq2vn",
    detail: "Failed provision, stuck at network setup",
    ip: "81.2.69.160",
    location: "London, GB",
  },
];

export interface FeatureFlag {
  key: string;
  description: string;
  enabled: boolean;
  rollout?: string;
  updatedAt: string;
  updatedBy: string;
  risk?: "high";
}

export const featureFlags: FeatureFlag[] = [
  {
    key: "provisioning.uksouth.enabled",
    description: "Route new lab launches to uksouth. Off sends all launches to westeurope.",
    enabled: false,
    updatedAt: minutesAgo(19),
    updatedBy: "priya@rootpanther.com",
    risk: "high",
  },
  {
    key: "onyx.walkthrough.confirm_twice",
    description: "Require a second confirmation before Onyx switches to Walkthrough.",
    enabled: true,
    updatedAt: daysAgo(5, 14),
    updatedBy: "marcus@rootpanther.com",
  },
  {
    key: "onyx.spoiler_check.fast_model",
    description: "Run the spoiler detector on the fast model before each Coach and Nudge reply.",
    enabled: true,
    updatedAt: daysAgo(14, 11),
    updatedBy: "marcus@rootpanther.com",
  },
  {
    key: "labs.openvpn.v2_config",
    description: "Issue OpenVPN profiles with the new keepalive and MTU defaults.",
    enabled: true,
    rollout: "25% of users",
    updatedAt: daysAgo(4, 10),
    updatedBy: "priya@rootpanther.com",
  },
  {
    key: "catalogue.exam_sim.obsidian",
    description: "Show the Obsidian exam simulation in the catalogue.",
    enabled: true,
    updatedAt: daysAgo(25, 9),
    updatedBy: "priya@rootpanther.com",
  },
  {
    key: "billing.annual_discount_banner",
    description: "Show the annual plan saving on the learner billing page.",
    enabled: false,
    updatedAt: daysAgo(31, 15),
    updatedBy: "lena@rootpanther.com",
  },
  {
    key: "portal.impersonation.enabled",
    description: "Allow Support and Owner roles to impersonate learners. Every session is banner-marked and audited.",
    enabled: true,
    updatedAt: daysAgo(60, 12),
    updatedBy: "priya@rootpanther.com",
    risk: "high",
  },
];

export interface ConfigEntry {
  key: string;
  value: string;
  secret?: boolean;
  source: string;
  updatedAt: string;
}

export const environment = {
  name: "production",
  region: "uksouth, westeurope",
  release: "2026.10.14-3",
  commit: "8c1f2e9",
  deployedAt: hoursAgo(19),
  deployedBy: "marcus@rootpanther.com",
};

export const configEntries: ConfigEntry[] = [
  { key: "LAB_MAX_LIFE_MIN", value: "240", source: "App config", updatedAt: daysAgo(1, 16) },
  { key: "LAB_IDLE_SHUTDOWN_MIN", value: "30", source: "App config", updatedAt: daysAgo(40, 10) },
  { key: "LAB_REGIONS", value: "uksouth,westeurope", source: "App config", updatedAt: daysAgo(90, 10) },
  { key: "FAIR_USE_HOURS_PER_MONTH", value: "60", source: "App config", updatedAt: daysAgo(90, 10) },
  { key: "ONYX_PRIMARY_MODEL_TIMEOUT_S", value: "30", source: "App config", updatedAt: daysAgo(8, 12) },
  { key: "ONYX_STREAM_RETRY_MAX", value: "2", source: "App config", updatedAt: daysAgo(30, 10) },
  { key: "PORTAL_IDLE_LOCK_MIN", value: "15", source: "App config", updatedAt: daysAgo(90, 10) },
  { key: "DATABASE_URL", value: "", secret: true, source: "Key Vault", updatedAt: daysAgo(44, 10) },
  { key: "STRIPE_SECRET_KEY", value: "", secret: true, source: "Key Vault", updatedAt: daysAgo(71, 10) },
  { key: "STRIPE_WEBHOOK_SECRET", value: "", secret: true, source: "Key Vault", updatedAt: daysAgo(71, 10) },
  { key: "ONYX_API_KEY", value: "", secret: true, source: "Key Vault", updatedAt: daysAgo(18, 10) },
  { key: "AZURE_CLIENT_SECRET", value: "", secret: true, source: "Key Vault", updatedAt: daysAgo(33, 10) },
];

export type Severity = "sev1" | "sev2" | "sev3";
export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";

export const SEVERITY: Record<Severity, { label: string; tone: Tone }> = {
  sev1: { label: "SEV1", tone: "crit" },
  sev2: { label: "SEV2", tone: "high" },
  sev3: { label: "SEV3", tone: "med" },
};

export const INCIDENT_STATUS: Record<IncidentStatus, { label: string; tone: Tone }> = {
  investigating: { label: "Investigating", tone: "crit" },
  identified: { label: "Identified", tone: "high" },
  monitoring: { label: "Monitoring", tone: "primary" },
  resolved: { label: "Resolved", tone: "success" },
};

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  startedAt: string;
  durationMin: number;
  ongoing?: boolean;
  services: string[];
  summary: string;
  learnersAffected: number;
  commander: string;
}

export const incidents: Incident[] = [
  {
    id: "INC-0142",
    title: "Provisioning degraded in uksouth",
    severity: "sev2",
    status: "identified",
    startedAt: minutesAgo(26),
    durationMin: 26,
    ongoing: true,
    services: ["Provisioning worker"],
    summary: "Azure vCPU quota exhausted for Dsv5 in uksouth. 6 launches failed in 15 minutes; learners were not charged lab hours. New launches routed to westeurope.",
    learnersAffected: 6,
    commander: "priya@rootpanther.com",
  },
  {
    id: "INC-0139",
    title: "Onyx replies failing on the primary model",
    severity: "sev2",
    status: "resolved",
    startedAt: daysAgo(9, 19),
    durationMin: 41,
    services: ["Onyx gateway"],
    summary: "Upstream capacity errors on the primary model. 71 streams failed; the gateway fell back to the fast model for Nudge after 12 minutes. Retry limit lowered to 2.",
    learnersAffected: 58,
    commander: "marcus@rootpanther.com",
  },
  {
    id: "INC-0136",
    title: "Lab launches stuck at network setup",
    severity: "sev1",
    status: "resolved",
    startedAt: daysAgo(12, 9),
    durationMin: 94,
    services: ["Provisioning worker", "Control plane"],
    summary: "A NAT gateway change blocked tenant network creation. 23 launches failed and were not charged. Rolled back and added a pre-deploy egress check.",
    learnersAffected: 23,
    commander: "priya@rootpanther.com",
  },
  {
    id: "INC-0131",
    title: "Slow API responses during database maintenance",
    severity: "sev3",
    status: "resolved",
    startedAt: daysAgo(41, 3),
    durationMin: 18,
    services: ["API", "Database", "Control plane"],
    summary: "Planned PostgreSQL minor upgrade ran 8 minutes over its window. API p95 reached 1.9 s. No errors returned to learners.",
    learnersAffected: 0,
    commander: "marcus@rootpanther.com",
  },
  {
    id: "INC-0127",
    title: "Provisioning worker crash loop",
    severity: "sev2",
    status: "resolved",
    startedAt: daysAgo(74, 21),
    durationMin: 52,
    services: ["Provisioning worker"],
    summary:
      "A malformed scenario manifest for Quarry crashed the worker on load. Launches queued and then failed; learners were not charged. Manifest validation added to publish.",
    learnersAffected: 31,
    commander: "marcus@rootpanther.com",
  },
];
