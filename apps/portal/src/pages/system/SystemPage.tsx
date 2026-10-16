import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Button,
  Callout,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Icon,
  KeyValue,
  LoadingRegion,
  Page,
  PageHeader,
  Section,
  Select,
  Skeleton,
  StatusDot,
  Timeline,
  formatDate,
  formatDateTime,
  formatDuration,
  formatRelative,
  useToast,
} from "@rootpanther/ui";
import type { Column } from "@rootpanther/ui";
import {
  AUDIT_ACTION_LABEL,
  INCIDENT_STATUS,
  SERVICE_STATUS,
  SEVERITY,
  auditLog,
  configEntries,
  environment,
  featureFlags,
  incidents,
  operators,
  services,
} from "../../mock/system";
import type { AuditAction, AuditEntry, DayState, FeatureFlag, Service } from "../../mock/system";
import { operator } from "../../mock/operator";
import { minutesAgo } from "../../mock/time";
import { useDataState, useReview } from "../../review/review";
import "./system.css";

type Mode = "default" | "loading" | "empty" | "error";

const DAY_LABEL: Record<DayState, string> = {
  ok: "No incidents",
  degraded: "Degraded",
  outage: "Outage",
  maintenance: "Planned maintenance",
  none: "No data",
};

function dayDate(i: number) {
  const d = new Date();
  d.setDate(d.getDate() - (89 - i));
  return formatDate(d.toISOString(), { day: "numeric", month: "short" });
}

function UptimeStrip({ service }: { service: Service }) {
  const counts = service.days.reduce<Record<string, number>>((a, d) => ({ ...a, [d]: (a[d] ?? 0) + 1 }), {});
  const summary = [counts.outage && `${counts.outage} outage`, counts.degraded && `${counts.degraded} degraded`, counts.maintenance && `${counts.maintenance} maintenance`]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="sy-strip" role="img" aria-label={`${service.name}, last 90 days: ${summary ? `${summary} days` : "no incidents"}.`}>
      {service.days.map((d, i) => (
        <span key={i} className={`sy-strip__day is-${d}`} title={`${dayDate(i)}: ${DAY_LABEL[d]}`} />
      ))}
    </div>
  );
}

function latency(s: Service) {
  return s.p95Unit === "s" ? `${s.p95.toFixed(s.p95 < 10 ? 2 : 0)} s` : `${s.p95} ms`;
}

function ServiceStatusSection({ mode }: { mode: Mode }) {
  const degraded = services.filter((s) => s.status !== "operational");
  const loading = mode === "loading";
  return (
    <Section
      title="Service status"
      meta={
        loading || mode === "error" ? undefined : degraded.length ? (
          <StatusDot tone="med" size="sm" label={`${degraded.length} of ${services.length} degraded`} />
        ) : (
          <StatusDot tone="success" size="sm" label="All services operational" />
        )
      }
    >
      <Card padding="none">
        {mode === "error" ? (
          <ErrorState title="Service health did not load" onRetry={() => window.location.reload()} reference="req_e44a90">
            The uptime checker did not respond. Services may be running normally; check the status page from outside the portal.
          </ErrorState>
        ) : (
          <div className="sy-services" role="table" aria-label="Service status">
            <div className="sy-services__head" role="row">
              <span role="columnheader">Service</span>
              <span role="columnheader">Status</span>
              <span role="columnheader" className="is-right">
                Uptime 30d
              </span>
              <span role="columnheader" className="is-right">
                p95
              </span>
              <span role="columnheader" className="sy-services__stripcol">
                <span>90 days ago</span>
                <span>Today</span>
              </span>
            </div>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="sy-services__row" role="row" aria-hidden="true">
                    <Skeleton width="70%" height={12} />
                    <Skeleton width="60%" height={12} />
                    <Skeleton width="50%" height={12} />
                    <Skeleton width="50%" height={12} />
                    <Skeleton height={20} />
                  </div>
                ))
              : services.map((s) => {
                  const st = SERVICE_STATUS[s.status];
                  const overSlo = s.p95 > s.p95Slo;
                  return (
                    <div key={s.id} className="sy-services__row" role="row">
                      <span role="cell" className="sy-svc">
                        <span className="sy-svc__name">{s.name}</span>
                        <span className="sy-svc__comp rp-mono">{s.component}</span>
                      </span>
                      <span role="cell" className="sy-svc__status">
                        <StatusDot tone={st.tone} size="sm" label={st.label} />
                        {s.note && <span className="sy-svc__note">{s.note}</span>}
                      </span>
                      <span role="cell" className={`is-right rp-mono rp-num sy-svc__fig sy-svc__up${s.uptime30 < 99.9 ? " sy-unfav" : ""}`}>
                        {s.uptime30.toFixed(2)}%
                      </span>
                      <span role="cell" className="is-right sy-svc__lat">
                        <span className={`rp-mono rp-num sy-svc__fig${overSlo ? " sy-unfav" : ""}`}>{latency(s)}</span>
                        <span className="sy-svc__slo rp-mono rp-num">SLO {s.p95Unit === "s" ? `${s.p95Slo} s` : `${s.p95Slo} ms`}</span>
                      </span>
                      <span role="cell" className="sy-services__stripcell">
                        <UptimeStrip service={s} />
                      </span>
                    </div>
                  );
                })}
            <div className="sy-legend" aria-hidden="true">
              {(["ok", "degraded", "outage", "maintenance"] as DayState[]).map((d) => (
                <span key={d}>
                  <i className={`sy-strip__day is-${d}`} />
                  {DAY_LABEL[d]}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>
    </Section>
  );
}

function toCsv(rows: AuditEntry[]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const head = ["id", "time_utc", "actor", "action", "target", "detail", "ip", "location"];
  return [head.join(","), ...rows.map((r) => [r.id, r.at, r.actor, r.action, r.target, r.detail ?? "", r.ip, r.location].map(esc).join(","))].join("\n");
}

type Range = "24h" | "7d" | "30d" | "all";
const RANGE_MS: Record<Range, number> = { "24h": 86400000, "7d": 7 * 86400000, "30d": 30 * 86400000, all: Infinity };

function AuditLog({ mode }: { mode: Mode }) {
  const toast = useToast();
  const [actor, setActor] = useState("");
  const [action, setAction] = useState<"" | AuditAction>("");
  const [range, setRange] = useState<Range>("7d");
  const [exporting, setExporting] = useState(false);

  const rows = useMemo(() => {
    const now = Date.now();
    return auditLog.filter((e) => (!actor || e.actor === actor) && (!action || e.action === action) && now - new Date(e.at).getTime() <= RANGE_MS[range]);
  }, [actor, action, range]);

  const filtered = !!actor || !!action || range !== "all";

  function exportCsv() {
    setExporting(true);
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rootpanther-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    window.setTimeout(() => {
      setExporting(false);
      toast.push({ title: `Exported ${rows.length} audit entries`, detail: "The export itself is recorded in the audit log.", tone: "success" });
    }, 300);
  }

  const columns: Column<AuditEntry>[] = [
    {
      id: "at",
      header: "Time",
      cell: (e) => (
        <time dateTime={e.at} className="sy-time" title={new Date(e.at).toISOString()}>
          <span className="rp-mono rp-num">{formatDateTime(e.at)}</span>
          <span className="sy-time__rel">{formatRelative(e.at)}</span>
        </time>
      ),
      sortValue: (e) => new Date(e.at).getTime(),
      width: 128,
      hideable: false,
    },
    {
      id: "actor",
      header: "Actor",
      cell: (e) => <span className="rp-mono sy-mono">{e.actor}</span>,
      titleValue: (e) => e.actor,
      truncate: true,
      sortValue: (e) => e.actor,
      width: 196,
    },
    {
      id: "action",
      header: "Action",
      cell: (e) => (
        <span className="sy-action">
          <span
            className={
              e.action === "operator.signin.failed" || e.action === "user.delete" || e.action === "user.impersonate" ? "sy-action__label is-sensitive" : "sy-action__label"
            }
          >
            {AUDIT_ACTION_LABEL[e.action]}
          </span>
          <span className="sy-action__key rp-mono">{e.action}</span>
        </span>
      ),
      sortValue: (e) => e.action,
      width: 180,
    },
    {
      id: "target",
      header: "Target",
      cell: (e) => (
        <span className="sy-target">
          {e.targetHref ? (
            <Link to={e.targetHref} className="rp-mono sy-mono">
              {e.target}
            </Link>
          ) : (
            <span className="rp-mono sy-mono sy-target__plain">{e.target}</span>
          )}
          {e.detail && <span className="sy-target__detail">{e.detail}</span>}
        </span>
      ),
      titleValue: (e) => (e.detail ? `${e.target}: ${e.detail}` : e.target),
      minWidth: 200,
    },
    { id: "ip", header: "IP", cell: (e) => <span className="rp-mono sy-mono">{e.ip}</span>, sortValue: (e) => e.ip, width: 120 },
    { id: "loc", header: "Location", cell: (e) => e.location, sortValue: (e) => e.location, width: 124 },
  ];

  const loading = mode === "loading";
  const failed = mode === "error";
  const empty = mode === "empty";

  return (
    <Section
      id="audit"
      title="Audit log"
      meta={
        loading || failed || empty ? undefined : (
          <span className="rp-mono rp-num">
            {rows.length} of {auditLog.length} entries
          </span>
        )
      }
      actions={
        <Button size="sm" variant="secondary" iconLeft="download" onClick={exportCsv} loading={exporting} disabled={loading || failed || rows.length === 0 || empty}>
          Export CSV
        </Button>
      }
    >
      <div className="sy-appendonly" role="note">
        <Icon name="lock" size={13} />
        <span>Append-only. Entries are written by the platform when a privileged action completes and cannot be edited or removed from the portal. Times are UTC in exports.</span>
      </div>
      <DataTable
        caption="Audit log of privileged operator actions"
        columns={columns}
        rows={empty || loading ? [] : rows}
        rowKey={(e) => e.id}
        defaultSort={{ id: "at", dir: "desc" }}
        loading={loading}
        columnControls={false}
        pageSize={10}
        error={
          failed
            ? {
                title: "Audit log did not load",
                detail: "The audit store did not respond. Entries are still being written; nothing has been lost.",
                onRetry: () => window.location.reload(),
              }
            : null
        }
        toolbar={
          <div className="sy-filters" role="group" aria-label="Audit log filters">
            <Select
              selectSize="sm"
              aria-label="Actor"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              options={[{ value: "", label: "All actors" }, ...operators.map((o) => ({ value: o, label: o }))]}
            />
            <Select
              selectSize="sm"
              aria-label="Action"
              value={action}
              onChange={(e) => setAction(e.target.value as "" | AuditAction)}
              options={[{ value: "", label: "All actions" }, ...(Object.keys(AUDIT_ACTION_LABEL) as AuditAction[]).map((a) => ({ value: a, label: AUDIT_ACTION_LABEL[a] }))]}
            />
            <Select
              selectSize="sm"
              aria-label="Date range"
              value={range}
              onChange={(e) => setRange(e.target.value as Range)}
              options={[
                { value: "24h", label: "Last 24 hours" },
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
                { value: "all", label: "All time" },
              ]}
            />
            {(actor || action || range !== "7d") && (
              <Button
                size="sm"
                variant="quiet"
                onClick={() => {
                  setActor("");
                  setAction("");
                  setRange("7d");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        }
        empty={
          empty ? (
            <EmptyState compact icon="checklist" title="No privileged actions recorded yet">
              Sign-ins, refunds, impersonation, teardowns and config changes appear here as they happen.
            </EmptyState>
          ) : (
            <EmptyState
              compact
              icon="filter"
              title="No entries match these filters"
              action={
                filtered ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setActor("");
                      setAction("");
                      setRange("all");
                    }}
                  >
                    Show all entries
                  </Button>
                ) : undefined
              }
            />
          )
        }
      />
    </Section>
  );
}

function FlagsAndConfig({ mode }: { mode: Mode }) {
  const toast = useToast();
  const [flags, setFlags] = useState<FeatureFlag[]>(featureFlags);
  const [pending, setPending] = useState<FeatureFlag | null>(null);
  const [saving, setSaving] = useState(false);
  const loading = mode === "loading";
  const failed = mode === "error";

  function confirm() {
    if (!pending) return;
    setSaving(true);
    window.setTimeout(() => {
      setFlags((fs) => fs.map((f) => (f.key === pending.key ? { ...f, enabled: !f.enabled, updatedAt: minutesAgo(0), updatedBy: operator.email } : f)));
      toast.push({ title: `${pending.key} ${pending.enabled ? "turned off" : "turned on"}`, detail: "Applied to production and written to the audit log." });
      setSaving(false);
      setPending(null);
    }, 400);
  }

  const flagColumns: Column<FeatureFlag>[] = [
    {
      id: "key",
      header: "Flag",
      cell: (f) => (
        <span className="sy-flag">
          <span className="rp-mono sy-flag__key">{f.key}</span>
          <span className="sy-flag__desc">{f.description}</span>
        </span>
      ),
      titleValue: (f) => f.description,
      minWidth: 260,
      hideable: false,
    },
    {
      id: "state",
      header: "State",
      cell: (f) => (
        <span className="sy-flag__state">
          <StatusDot tone={f.enabled ? "primary" : "neutral"} hollow={!f.enabled} size="sm" label={f.enabled ? "On" : "Off"} />
          {f.rollout && <span className="sy-flag__rollout rp-mono rp-num">{f.rollout}</span>}
        </span>
      ),
      width: 128,
    },
    {
      id: "updated",
      header: "Last change",
      cell: (f) => (
        <span className="sy-flag__upd">
          <time dateTime={f.updatedAt} className="rp-mono rp-num" title={formatDateTime(f.updatedAt)}>
            {formatRelative(f.updatedAt)}
          </time>
          <span className="rp-mono sy-mono">{f.updatedBy}</span>
        </span>
      ),
      width: 208,
    },
    {
      id: "edit",
      header: <span className="rp-sr">Edit</span>,
      headerLabel: "Edit",
      cell: (f) => (
        <Button size="sm" variant="quiet" iconLeft="pencil" onClick={() => setPending(f)} aria-label={`Edit ${f.key}`}>
          Edit
        </Button>
      ),
      align: "right",
      width: 88,
    },
  ];

  const configColumns: Column<(typeof configEntries)[number]>[] = [
    {
      id: "key",
      header: "Key",
      cell: (c) => <span className="rp-mono sy-mono sy-config__key">{c.key}</span>,
      titleValue: (c) => c.key,
      truncate: true,
      width: 260,
      hideable: false,
    },
    {
      id: "value",
      header: "Value",
      cell: (c) =>
        c.secret ? (
          <span className="sy-secret">
            <span className="rp-mono sy-mono sy-secret__val" aria-hidden="true">
              ••••••••••••
            </span>
            <span className="rp-sr">Secret value, masked</span>
          </span>
        ) : (
          <span className="rp-mono sy-mono">{c.value}</span>
        ),
      titleValue: (c) => (c.secret ? "Masked. Read the value in Key Vault." : c.value),
      minWidth: 200,
    },
    {
      id: "source",
      header: "Source",
      cell: (c) => (
        <span className="sy-source">
          {c.secret && <Icon name="key" size={12} />}
          {c.source}
        </span>
      ),
      width: 116,
    },
    {
      id: "updated",
      header: "Updated",
      cell: (c) => (
        <time dateTime={c.updatedAt} className="rp-mono rp-num" title={formatDateTime(c.updatedAt)}>
          {formatRelative(c.updatedAt)}
        </time>
      ),
      align: "right",
      width: 104,
    },
  ];

  if (failed) {
    return (
      <Section title="Feature flags and config">
        <Card>
          <ErrorState title="Flags and config did not load" onRetry={() => window.location.reload()} reference="req_77c1f3">
            The config service returned 503. Production keeps its current flags and config until the service responds.
          </ErrorState>
        </Card>
      </Section>
    );
  }

  return (
    <Section title="Feature flags and config">
      <div className="sy-cfg">
        <Card
          title="Feature flags"
          padding="none"
          meta={
            loading || mode === "empty" ? undefined : (
              <span className="rp-mono rp-num">
                {flags.filter((f) => f.enabled).length} of {flags.length} on
              </span>
            )
          }
        >
          <DataTable
            caption="Feature flags in production"
            columns={flagColumns}
            rows={mode === "empty" ? [] : flags}
            rowKey={(f) => f.key}
            loading={loading}
            columnControls={false}
            empty={
              <EmptyState compact icon="sliders" title="No feature flags defined">
                Flags are created in code and appear here after the next deploy.
              </EmptyState>
            }
          />
        </Card>
        <Card
          title="Environment"
          padding="none"
          meta={
            loading ? undefined : (
              <span className="rp-mono">
                {environment.name}, {environment.release}
              </span>
            )
          }
        >
          {loading ? (
            <LoadingRegion label="Loading environment">
              <div className="sy-env">
                <Skeleton height={48} />
              </div>
            </LoadingRegion>
          ) : (
            <div className="sy-env">
              <KeyValue
                columns={4}
                items={[
                  { label: "Regions", value: environment.region, mono: true },
                  { label: "Commit", value: environment.commit, mono: true },
                  {
                    label: "Deployed",
                    value: (
                      <span className="rp-mono rp-num" title={formatDateTime(environment.deployedAt)}>
                        {formatRelative(environment.deployedAt)}
                      </span>
                    ),
                  },
                  { label: "Deployed by", value: environment.deployedBy, mono: true },
                ]}
              />
            </div>
          )}
          <DataTable
            caption="Environment configuration, read-only"
            columns={configColumns}
            rows={mode === "empty" ? [] : configEntries}
            rowKey={(c) => c.key}
            loading={loading}
            density="compact"
            columnControls={false}
            footerNote={
              loading ? undefined : (
                <span className="sy-readonly">
                  <Icon name="lock" size={12} />
                  Read-only. Config changes ship through a deploy. Secrets live in Key Vault and are never shown in the portal.
                </span>
              )
            }
            empty={<EmptyState compact icon="key" title="No config keys reported by this environment" />}
          />
        </Card>
      </div>
      <ConfirmDialog
        open={pending !== null}
        onClose={() => !saving && setPending(null)}
        onConfirm={confirm}
        loading={saving}
        destructive={pending?.risk === "high"}
        requireText={pending?.risk === "high" ? pending.key : undefined}
        title={pending ? `Turn ${pending.enabled ? "off" : "on"} feature flag` : ""}
        confirmLabel={pending ? `Turn ${pending.enabled ? "off" : "on"}` : "Confirm"}
      >
        {pending && (
          <div className="sy-confirm">
            <p>{pending.description}</p>
            <KeyValue
              columns={2}
              items={[
                { label: "Flag", value: pending.key, mono: true },
                { label: "Change", value: pending.enabled ? "On to Off" : "Off to On" },
              ]}
            />
            <p className="sy-confirm__note">Applies to production within 30 seconds. The change is written to the audit log under your account.</p>
          </div>
        )}
      </ConfirmDialog>
    </Section>
  );
}

function Incidents({ mode }: { mode: Mode }) {
  const loading = mode === "loading";
  const failed = mode === "error";
  const empty = mode === "empty";
  const open = incidents.filter((i) => i.status !== "resolved");

  return (
    <Section
      id="incidents"
      title="Incidents"
      meta={loading || failed || empty ? undefined : open.length ? <StatusDot tone="high" size="sm" label={`${open.length} open`} /> : <span>None open</span>}
    >
      <Card padding="none">
        {failed ? (
          <ErrorState title="Incident history did not load" onRetry={() => window.location.reload()} reference="req_1d02bb">
            The incident store did not respond. Open incidents are still paged to on-call.
          </ErrorState>
        ) : loading ? (
          <div className="sy-incidents">
            <LoadingRegion label="Loading incidents">
              <Timeline items={[]} label="Incidents" loading />
            </LoadingRegion>
          </div>
        ) : empty ? (
          <EmptyState icon="shield-check" title="No incidents in the last 90 days">
            Incidents declared from the alerts panel or by on-call appear here with their timeline.
          </EmptyState>
        ) : (
          <div className="sy-incidents">
            <Timeline
              label="Incidents, most recent first"
              absoluteTime={formatDateTime}
              items={incidents.map((i) => {
                const sev = SEVERITY[i.severity];
                const st = INCIDENT_STATUS[i.status];
                return {
                  id: i.id,
                  at: i.startedAt,
                  atLabel: formatDateTime(i.startedAt),
                  tone: i.status === "resolved" ? "neutral" : sev.tone,
                  icon: i.status === "resolved" ? "check" : "warning",
                  title: (
                    <span className="sy-inc__title">
                      <span className="rp-mono sy-inc__id">{i.id}</span>
                      {i.title}
                    </span>
                  ),
                  detail: (
                    <div className="sy-inc">
                      <div className="sy-inc__meta">
                        <StatusDot tone={sev.tone} size="sm" label={sev.label} mono />
                        <StatusDot tone={st.tone} size="sm" label={st.label} />
                        <span className="rp-mono rp-num">{i.ongoing ? `${formatDuration(i.durationMin)} so far` : formatDuration(i.durationMin)}</span>
                        <span>{i.services.join(", ")}</span>
                        <span className="rp-mono rp-num">{i.learnersAffected} learners affected</span>
                      </div>
                      <p className="sy-inc__summary">{i.summary}</p>
                      <span className="sy-inc__cmd">
                        Commander <span className="rp-mono">{i.commander}</span>
                      </span>
                    </div>
                  ),
                };
              })}
            />
          </div>
        )}
      </Card>
    </Section>
  );
}

function Denied() {
  const toast = useToast();
  return (
    <Card padding="lg">
      <EmptyState
        icon="lock"
        title="System requires the Owner or Admin role"
        action={
          <Button size="sm" iconLeft="mail" onClick={() => toast.push({ title: "Access request sent", detail: "priya@rootpanther.com will be asked to grant Admin." })}>
            Request access
          </Button>
        }
      >
        This page shows the audit log, feature flags and production config. Your role does not include it. Access requests go to the workspace owner and are written to the audit
        log.
      </EmptyState>
    </Card>
  );
}

export default function SystemPage() {
  const state = useDataState();
  const { flags } = useReview();
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) window.setTimeout(() => el.scrollIntoView({ block: "start" }), 50);
  }, [hash]);

  const header = (
    <PageHeader
      title="System"
      meta={
        state === "denied" ? undefined : (
          <>
            <span className="rp-mono">{environment.name}</span>
            <span>
              Release <span className="rp-mono">{environment.release}</span>
            </span>
            <span>
              Checked <span className="rp-mono rp-num">{state === "loading" ? "now" : "30s ago"}</span>
            </span>
          </>
        )
      }
    />
  );

  if (state === "denied") {
    return (
      <Page width="full">
        {header}
        <Denied />
      </Page>
    );
  }

  const mode: Mode = state;

  return (
    <Page width="full" className="sy-page">
      {header}
      {flags.incident === "active" && mode === "default" && (
        <Callout
          tone="high"
          title="INC-0142 is open: provisioning degraded in uksouth"
          action={
            <a href="#incidents" className="rp-link">
              View timeline
            </a>
          }
        >
          uksouth launches are routed to westeurope while quota is raised. Learners were not charged for failed launches.
        </Callout>
      )}
      <ServiceStatusSection mode={mode} />
      <Incidents mode={mode} />
      <AuditLog mode={mode} />
      <FlagsAndConfig mode={mode} />
    </Page>
  );
}
