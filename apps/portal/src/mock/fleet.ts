import { contentScenarios } from "./content";
import type { ContentScenario } from "./content";
import { hoursAgo, minutesAgo } from "./time";

export type TenantState = "provisioning" | "running" | "idle" | "tearing-down" | "failed";
export type Region = "uksouth" | "westeurope" | "eastus2" | "westus3";
export type OrphanReason = "past-max-life" | "no-activity" | "no-session";

export const REGIONS: Region[] = ["uksouth", "westeurope", "eastus2", "westus3"];

export const STATE_LABEL: Record<TenantState, string> = {
  provisioning: "Provisioning",
  running: "Running",
  idle: "Idle",
  "tearing-down": "Tearing down",
  failed: "Failed",
};

export const IDLE_LIMIT_MIN = 30;

const RATE = { windows: 0.212, linux: 0.084, heavy: 0.424, overhead: 0.031 };

export function hourlyCost(s: ContentScenario): number {
  const hosts = s.hosts.reduce((a, h) => a + (h.role.startsWith("Exchange") ? RATE.heavy : h.os === "windows" ? RATE.windows : RATE.linux), 0);
  return Math.round((hosts + RATE.overhead) * 1000) / 1000;
}

function maxLife(s: ContentScenario): number {
  if (s.type === "exam-sim") return 1440;
  if (s.id === "quarry") return 480;
  if (s.id === "cinder") return 360;
  return 240;
}

export interface Tenant {
  id: string;
  userId: string | null;
  userEmail: string | null;
  scenarioId: string;
  scenarioName: string;
  version: string;
  region: Region;
  startedAt: string;
  elapsedMin: number;
  idleMin: number;
  maxLifeMin: number;
  teardownInMin: number;
  teardownBy: "max-life" | "idle" | "none";
  hourly: number;
  costSoFar: number;
  state: TenantState;
  hostCount: number;
  orphan?: { reason: OrphanReason; sinceMin: number };
  failure?: string;
}

const UKS_DSV5_LIMIT = 36;

function quotaError(required: number): string {
  return `OperationNotAllowed: exceeds approved standardDSv5Family cores quota. Current limit ${UKS_DSV5_LIMIT}, usage ${UKS_DSV5_LIMIT}, additional required ${required}`;
}

interface Seed {
  id: string;
  user: [string, string] | null;
  scenario: string;
  region: Region;
  elapsed: number;
  idle?: number;
  state: TenantState;
  failure?: string;
}


const SEEDS: Seed[] = [
  { id: "rp-t-4qmx9a", user: ["usr_7Hk2pQ", "dana.reyes@example.com"], scenario: "meridian", region: "uksouth", elapsed: 102, idle: 4, state: "running" },
  { id: "rp-t-7vb2kd", user: ["usr_2Lm8Zr", "m.okonkwo@example.com"], scenario: "cinder", region: "westeurope", elapsed: 214, idle: 2, state: "running" },
  { id: "rp-t-1zz8op", user: ["usr_8Jk1Xc", "t.nguyen@example.com"], scenario: "granite", region: "eastus2", elapsed: 611, idle: 6, state: "running" },
  { id: "rp-t-5cn1jh", user: ["usr_5Tg3Ka", "k.adeyemi@example.com"], scenario: "granite", region: "uksouth", elapsed: 1820, idle: 412, state: "idle" },
  { id: "rp-t-0pd6wq", user: ["usr_1Vb7Mn", "j.mbeki@example.com"], scenario: "cinder", region: "westeurope", elapsed: 301, idle: 252, state: "idle" },
  { id: "rp-t-3xa9tf", user: null, scenario: "vesper", region: "uksouth", elapsed: 665, state: "running" },
  { id: "rp-t-8hn4cz", user: ["usr_6Rp2Wd", "r.patel@example.com"], scenario: "basalt", region: "uksouth", elapsed: 46, idle: 1, state: "running" },
  { id: "rp-t-2mq9ls", user: ["usr_3Af8Ye", "a.fischer@example.com"], scenario: "tamarack", region: "westeurope", elapsed: 133, idle: 14, state: "idle" },
  { id: "rp-t-6yv1qa", user: ["usr_9Ca4Lv", "c.alvarez@example.com"], scenario: "juniper", region: "eastus2", elapsed: 3, state: "provisioning" },
  { id: "rp-t-9wb3dr", user: ["usr_4Sk1Jm", "s.kim@example.com"], scenario: "ironwood", region: "eastus2", elapsed: 88, idle: 3, state: "running" },
  { id: "rp-t-4kt7pe", user: ["usr_2Bo5Xq", "b.osei@example.com"], scenario: "harrow", region: "westus3", elapsed: 151, idle: 9, state: "running" },
  { id: "rp-t-1rx5go", user: ["usr_7En6Pz", "e.novak@example.com"], scenario: "kestrel", region: "uksouth", elapsed: 6, state: "failed", failure: quotaError(2) },
  { id: "rp-t-7qf2un", user: ["usr_8Lb3Gr", "l.berg@example.com"], scenario: "kestrel", region: "westeurope", elapsed: 37, idle: 2, state: "running" },
  { id: "rp-t-3dj8yh", user: ["usr_5Ht9Nw", "h.tanaka@example.com"], scenario: "meridian", region: "westus3", elapsed: 236, idle: 1, state: "running" },
  { id: "rp-t-5lp0ik", user: ["usr_1Fr7Cb", "f.romano@example.com"], scenario: "quarry", region: "eastus2", elapsed: 302, idle: 5, state: "running" },
  { id: "rp-t-0gs6vw", user: ["usr_6Ni2Vt", "n.ivanova@example.com"], scenario: "basalt", region: "westeurope", elapsed: 240, idle: 3, state: "tearing-down" },
  { id: "rp-t-8ma2bx", user: ["usr_3Dw8Hk", "d.walsh@example.com"], scenario: "obsidian", region: "uksouth", elapsed: 1102, idle: 7, state: "running" },
  { id: "rp-t-2ze7rm", user: ["usr_9Pm4Ue", "p.mensah@example.com"], scenario: "vesper", region: "westeurope", elapsed: 4, state: "provisioning" },
  { id: "rp-t-6cu3jt", user: ["usr_4Gs6Lo", "g.silva@example.com"], scenario: "ironwood", region: "uksouth", elapsed: 2, state: "provisioning" },
  { id: "rp-t-9np5ko", user: ["usr_2Yc1Fa", "y.cohen@example.com"], scenario: "tamarack", region: "eastus2", elapsed: 71, idle: 22, state: "idle" },
  { id: "rp-t-4bh9wf", user: ["usr_7Od3Rs", "o.diaz@example.com"], scenario: "basalt", region: "westus3", elapsed: 12, idle: 0, state: "running" },
  { id: "rp-t-1ue4nm", user: ["usr_5Vp7Tq", "v.petrov@example.com"], scenario: "kestrel", region: "westeurope", elapsed: 93, idle: 1, state: "tearing-down" },
  { id: "rp-t-7xr6ds", user: ["usr_8Ia2Mh", "i.ahmed@example.com"], scenario: "meridian", region: "eastus2", elapsed: 167, idle: 11, state: "idle" },
  { id: "rp-t-3ok1vy", user: ["usr_1Wc5Bn", "w.chen@example.com"], scenario: "juniper", region: "uksouth", elapsed: 58, idle: 2, state: "running" },
  { id: "rp-t-5ta8hz", user: ["usr_6Mc9Dj", "m.costa@example.com"], scenario: "granite", region: "westeurope", elapsed: 274, idle: 4, state: "running" },
  { id: "rp-t-2fi0qc", user: ["usr_3Zh4Ep", "z.hassan@example.com"], scenario: "kestrel", region: "uksouth", elapsed: 4, state: "failed", failure: quotaError(2) },
  { id: "rp-t-8vd5el", user: ["usr_9Ul6Ai", "u.larsen@example.com"], scenario: "cinder", region: "eastus2", elapsed: 129, idle: 3, state: "running" },
];

function build(seed: Seed): Tenant {
  const s = contentScenarios.find((c) => c.id === seed.scenario)!;
  const hourly = hourlyCost(s);
  const life = maxLife(s);
  const idle = seed.idle ?? 0;
  const byLife = life - seed.elapsed;
  const byIdle = IDLE_LIMIT_MIN - idle;
  const idleGoverns = seed.state === "idle" && byIdle < byLife;
  let teardownInMin = idleGoverns ? byIdle : byLife;
  let teardownBy: Tenant["teardownBy"] = idleGoverns ? "idle" : "max-life";
  let orphan: Tenant["orphan"];
  if (!seed.user) {
    orphan = { reason: "no-session", sinceMin: seed.elapsed };
    teardownBy = "none";
    teardownInMin = 0;
  } else if (byLife < 0) {
    orphan = { reason: "past-max-life", sinceMin: -byLife };
  } else if (byIdle < 0) {
    orphan = { reason: "no-activity", sinceMin: -byIdle };
  }
  const billable = seed.state === "failed" ? Math.min(seed.elapsed, 3) : seed.elapsed;
  return {
    id: seed.id,
    userId: seed.user?.[0] ?? null,
    userEmail: seed.user?.[1] ?? null,
    scenarioId: s.id,
    scenarioName: s.name,
    version: s.liveVersion ?? s.version,
    region: seed.region,
    startedAt: minutesAgo(seed.elapsed),
    elapsedMin: seed.elapsed,
    idleMin: idle,
    maxLifeMin: life,
    teardownInMin,
    teardownBy: seed.state === "failed" || seed.state === "tearing-down" ? "none" : teardownBy,
    hourly,
    costSoFar: Math.round(((hourly * billable) / 60) * 100) / 100,
    state: seed.state,
    hostCount: s.hosts.length,
    orphan,
    failure: seed.failure,
  };
}

export const tenants: Tenant[] = SEEDS.map(build);

export function orphanCost(t: Tenant): number {
  return t.orphan ? Math.round(((t.hourly * t.orphan.sinceMin) / 60) * 100) / 100 : 0;
}

export const ORPHAN_REASON: Record<OrphanReason, string> = {
  "past-max-life": "Past max life",
  "no-activity": "No activity",
  "no-session": "No session record",
};

export function orphanDetail(t: Tenant): string {
  if (!t.orphan) return "";
  if (t.orphan.reason === "past-max-life") return "Teardown job failed: resource group lock held by a stale deployment";
  if (t.orphan.reason === "no-activity") return `Idle shutdown did not fire. Last input ${Math.round(t.idleMin / 60)}h ago`;
  return "Resource group exists in Azure with no matching session in the control plane";
}

export interface QueueItem {
  id: string;
  scenarioName: string;
  region: Region;
  step: number;
  steps: number;
  stepLabel: string;
  waitingSec: number;
  attempt: number;
  blocked?: boolean;
}

export const PROVISION_STEPS = 6;

export const queue: QueueItem[] = [
  { id: "rp-t-6cu3jt", scenarioName: "Ironwood", region: "uksouth", step: 2, steps: PROVISION_STEPS, stepLabel: "Allocating VMs, retry after quota error", waitingSec: 108, attempt: 2, blocked: true },
  { id: "rp-t-0aw2mf", scenarioName: "Kestrel", region: "uksouth", step: 0, steps: PROVISION_STEPS, stepLabel: "Queued, waiting for standardDSv5Family quota", waitingSec: 151, attempt: 1, blocked: true },
  { id: "rp-t-6yv1qa", scenarioName: "Juniper", region: "eastus2", step: 4, steps: PROVISION_STEPS, stepLabel: "Seeding randomised credentials and flags", waitingSec: 190, attempt: 1 },
  { id: "rp-t-2ze7rm", scenarioName: "Vesper", region: "westeurope", step: 3, steps: PROVISION_STEPS, stepLabel: "Deploying hosts, 2 of 3 ready", waitingSec: 242, attempt: 1 },
];

export const provisionStats = {
  launches24h: 214,
  failed24h: 9,
  failed1h: 6,
  p50Sec: 252,
  p95Sec: 588,
  sloSec: 600,
};

export interface ProvisionFailure {
  id: string;
  tenantId: string;
  scenarioName: string;
  region: Region;
  at: string;
  code: string;
  message: string;
}

export const provisionFailures: ProvisionFailure[] = [
  { id: "pf-1", tenantId: "rp-t-2fi0qc", scenarioName: "Kestrel", region: "uksouth", at: minutesAgo(4), code: "OperationNotAllowed", message: "standardDSv5Family quota: limit 36, usage 36, required 2" },
  { id: "pf-2", tenantId: "rp-t-1rx5go", scenarioName: "Kestrel", region: "uksouth", at: minutesAgo(6), code: "OperationNotAllowed", message: "standardDSv5Family quota: limit 36, usage 36, required 2" },
  { id: "pf-3", tenantId: "rp-t-7jw0ab", scenarioName: "Meridian", region: "uksouth", at: minutesAgo(8), code: "OperationNotAllowed", message: "standardDSv5Family quota: limit 36, usage 36, required 6" },
  { id: "pf-4", tenantId: "rp-t-4mm5ce", scenarioName: "Vesper", region: "uksouth", at: minutesAgo(11), code: "OperationNotAllowed", message: "standardDSv5Family quota: limit 36, usage 36, required 6" },
  { id: "pf-5", tenantId: "rp-t-9re2tg", scenarioName: "Granite", region: "uksouth", at: minutesAgo(13), code: "OperationNotAllowed", message: "standardDSv5Family quota: limit 36, usage 34, required 8" },
  { id: "pf-6", tenantId: "rp-t-0kc8hu", scenarioName: "Ironwood", region: "uksouth", at: minutesAgo(14), code: "OperationNotAllowed", message: "standardDSv5Family quota: limit 36, usage 32, required 6" },
  { id: "pf-7", tenantId: "rp-t-6qa1vl", scenarioName: "Cinder", region: "westeurope", at: hoursAgo(5.2), code: "DeploymentTimeout", message: "CIN-DC00 did not report ready within 15 minutes" },
  { id: "pf-8", tenantId: "rp-t-2bd7sx", scenarioName: "Basalt", region: "eastus2", at: hoursAgo(9.6), code: "IsolationProbeTimeout", message: "Pre-handover isolation probe timed out, tenant discarded" },
  { id: "pf-9", tenantId: "rp-t-8ty3kn", scenarioName: "Quarry", region: "eastus2", at: hoursAgo(16.1), code: "SkuNotAvailable", message: "Standard_D4s_v5 unavailable in zone 2, retried in zone 1" },
];

export const provisionTrend = (() => {
  const p50 = [3.9, 4.0, 3.8, 3.7, 3.9, 4.1, 4.0, 3.8, 3.9, 4.2, 4.4, 4.1, 4.0, 3.9, 4.1, 4.3, 4.0, 4.1, 4.2, 4.0, 4.1, 4.3, 5.6, 6.8];
  const p95 = [8.1, 8.4, 7.9, 7.6, 8.2, 8.8, 8.5, 8.0, 8.3, 9.1, 9.4, 8.7, 8.4, 8.2, 8.6, 9.0, 8.5, 8.7, 8.9, 8.6, 8.8, 9.2, 12.9, 15.4];
  const labels = p50.map((_, i) => {
    const d = new Date(hoursAgo(p50.length - 1 - i));
    return `${String(d.getHours()).padStart(2, "0")}:00`;
  });
  return { labels, p50, p95 };
})();

export interface Quota {
  region: Region;
  family: string;
  sku: string;
  used: number;
  warm: number;
  limit: number;
}

export const QUOTA_WARN = 0.8;

const WARM_POOL: Record<Region, { dsv5: number; bsv2: number }> = {
  uksouth: { dsv5: 8, bsv2: 4 },
  westeurope: { dsv5: 4, bsv2: 2 },
  eastus2: { dsv5: 2, bsv2: 2 },
  westus3: { dsv5: 0, bsv2: 0 },
};

const LIMITS: Record<Region, { dsv5: number; bsv2: number }> = {
  uksouth: { dsv5: UKS_DSV5_LIMIT, bsv2: 40 },
  westeurope: { dsv5: 64, bsv2: 40 },
  eastus2: { dsv5: 48, bsv2: 40 },
  westus3: { dsv5: 32, bsv2: 20 },
};

export function tenantVcpu(t: Tenant): { dsv5: number; bsv2: number } {
  const s = contentScenarios.find((c) => c.id === t.scenarioId)!;
  if (t.state === "failed" || (t.state === "provisioning" && queue.some((q) => q.id === t.id && q.blocked))) return { dsv5: 0, bsv2: 0 };
  return s.hosts.reduce(
    (a, h) => (h.role.startsWith("Exchange") ? { ...a, dsv5: a.dsv5 + 4 } : h.os === "windows" ? { ...a, dsv5: a.dsv5 + 2 } : { ...a, bsv2: a.bsv2 + 2 }),
    { dsv5: 0, bsv2: 0 },
  );
}

export const quotas: Quota[] = REGIONS.flatMap((region) => {
  const sum = tenants.filter((t) => t.region === region).reduce((a, t) => {
    const v = tenantVcpu(t);
    return { dsv5: a.dsv5 + v.dsv5, bsv2: a.bsv2 + v.bsv2 };
  }, { dsv5: 0, bsv2: 0 });
  return [
    { region, family: "standardDSv5Family", sku: "D2s_v5, D4s_v5", used: sum.dsv5 + WARM_POOL[region].dsv5, warm: WARM_POOL[region].dsv5, limit: LIMITS[region].dsv5 },
    { region, family: "standardBSv2Family", sku: "B2s_v2", used: sum.bsv2 + WARM_POOL[region].bsv2, warm: WARM_POOL[region].bsv2, limit: LIMITS[region].bsv2 },
  ];
});

export type CheckId = "egress" | "crossTenant" | "imds";

export const CHECKS: { id: CheckId; label: string; short: string; probe: string }[] = [
  { id: "egress", label: "Egress blocked", short: "Egress", probe: "TCP 80, 443, 53 to 3 external sinks" },
  { id: "crossTenant", label: "Cross-tenant blocked", short: "Cross-tenant", probe: "ICMP and SMB to a canary tenant" },
  { id: "imds", label: "Instance metadata blocked", short: "Instance metadata", probe: "HTTP to 169.254.169.254" },
];

export interface IsolationRun {
  scenarioId: string;
  scenarioName: string;
  version: string;
  at: string;
  durationSec: number;
  results: Record<CheckId, { pass: boolean; detail?: string }>;
  launchesPaused?: boolean;
}

export const isolation: IsolationRun[] = contentScenarios
  .filter((s) => s.status !== "retired")
  .map((s, i) => {
    const failing = s.id === "halcyon";
    return {
      scenarioId: s.id,
      scenarioName: s.name,
      version: s.liveVersion ?? s.version,
      at: minutesAgo(Math.round(11 * 60 + 2 - i * 1.5)),
      durationSec: 38 + s.hosts.length * 11 + ((i * 7) % 9),
      results: {
        egress: { pass: true },
        crossTenant: { pass: true },
        imds: failing ? { pass: false, detail: "169.254.169.254 answered HTTP 200 from HAL-01. NSG deny rule 4090 missing from base image 2026.10.14." } : { pass: true },
      },
      launchesPaused: failing,
    };
  });

export const lastScanAt = minutesAgo(2);

export interface LogLine {
  at: string;
  level: "INFO" | "WARN" | "ERROR";
  source: string;
  text: string;
}

export function logsFor(t: Tenant): LogLine[] {
  const start = new Date(t.startedAt).getTime();
  const at = (min: number) => new Date(start + min * 60000).toISOString();
  const s = contentScenarios.find((c) => c.id === t.scenarioId)!;
  const lines: LogLine[] = [
    { at: at(0), level: "INFO", source: "control", text: `launch accepted user=${t.userId ?? "none"} scenario=${s.slug}@${t.version} region=${t.region}` },
    { at: at(0.1), level: "INFO", source: "provision", text: `resource group ${t.id} created, tags owner=rootpanther ttl=${t.maxLifeMin}m` },
    { at: at(0.4), level: "INFO", source: "network", text: "vnet 10.13.37.0/24 + pivot /24 created, NSG baseline rp-zero-egress v7 applied" },
  ];
  if (t.state === "failed") {
    lines.push(
      { at: at(1.2), level: "WARN", source: "provision", text: `VM allocation for ${s.hosts[0].name} rejected, retrying in 30s` },
      { at: at(1.8), level: "ERROR", source: "provision", text: t.failure ?? "allocation failed" },
      { at: at(2.1), level: "INFO", source: "billing", text: "session voided, 0.00 lab hours charged" },
      { at: at(2.6), level: "INFO", source: "teardown", text: `resource group ${t.id} delete requested` },
    );
    return lines;
  }
  s.hosts.forEach((h, i) => lines.push({ at: at(1 + i * 0.4), level: "INFO", source: "provision", text: `${h.name} ${h.os === "windows" ? "Standard_D2s_v5" : "Standard_B2s_v2"} running` }));
  if (t.state === "provisioning") {
    lines.push({ at: at(Math.max(1, t.elapsedMin - 0.5)), level: "INFO", source: "seed", text: "writing randomised credentials, flags and hostnames" });
    return lines;
  }
  lines.push(
    { at: at(2.6), level: "INFO", source: "seed", text: `randomised ${s.hosts.length * 2 + 3} values, seed 0x${t.id.slice(5)}c1` },
    { at: at(3.1), level: "INFO", source: "isolation", text: "probe egress=blocked cross_tenant=blocked imds=blocked" },
    { at: at(3.4), level: "INFO", source: "control", text: `handover complete, provision time ${3 + (t.hostCount % 3)}m ${10 + t.hostCount * 7}s` },
  );
  if (t.userId) lines.push({ at: at(4.2), level: "INFO", source: "openvpn", text: `client ${t.userId} connected` });
  if (t.orphan?.reason === "past-max-life") {
    lines.push(
      { at: at(t.maxLifeMin), level: "INFO", source: "teardown", text: "max life reached, delete requested" },
      { at: at(t.maxLifeMin + 2), level: "ERROR", source: "teardown", text: "ScopeLocked: resource group is locked by deployment rp-seed-0419" },
      { at: at(t.maxLifeMin + 32), level: "ERROR", source: "teardown", text: "retry 3 of 3 failed, giving up" },
    );
  } else if (t.orphan?.reason === "no-activity") {
    lines.push(
      { at: at(t.elapsedMin - t.idleMin), level: "INFO", source: "activity", text: "last terminal input" },
      { at: at(t.elapsedMin - t.idleMin + IDLE_LIMIT_MIN), level: "WARN", source: "idle", text: "idle limit reached, shutdown event not acknowledged by worker" },
    );
  } else if (t.orphan?.reason === "no-session") {
    lines.push({ at: at(12), level: "ERROR", source: "control", text: "session record write failed: database connection reset, tenant left unowned" });
  } else if (t.state === "idle") {
    lines.push({ at: at(t.elapsedMin - t.idleMin), level: "INFO", source: "activity", text: "last terminal input" });
    lines.push({ at: at(t.elapsedMin - t.idleMin + 10), level: "WARN", source: "idle", text: `no input for 10m, shutdown in ${IDLE_LIMIT_MIN - 10}m` });
  } else if (t.state === "tearing-down") {
    lines.push({ at: at(t.elapsedMin - 1), level: "INFO", source: "teardown", text: "session ended by learner, delete requested" });
  } else {
    lines.push({ at: at(Math.max(5, t.elapsedMin - t.idleMin)), level: "INFO", source: "activity", text: "terminal input" });
  }
  return lines.sort((a, b) => a.at.localeCompare(b.at));
}

export const computeToday = { endedSessions: 214.6, yesterdaySameTime: 318.2 };

export const incident = { id: "INC-0142", title: "Provisioning degraded in uksouth" };
