import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Callout,
  Card,
  DataTable,
  EmptyState,
  Icon,
  LineChart,
  LoadingRegion,
  Section,
  Skeleton,
  StatusDot,
  formatDateTime,
  formatRelative,
  formatTime,
  useToast,
} from "@rootpanther/ui";
import type { Column } from "@rootpanther/ui";
import { CHECKS, QUOTA_WARN, incident, provisionFailures, provisionStats, provisionTrend } from "../../mock/fleet";
import type { CheckId, IsolationRun, ProvisionFailure, Quota, QueueItem } from "../../mock/fleet";
import { secs } from "./util";

const HOUR = 3600000;

function Stat({ label, value, tone, note }: { label: string; value: string; tone?: "crit" | "med"; note?: string }) {
  return (
    <div className={`fl-stat${tone ? ` is-${tone}` : ""}`}>
      <dt>{label}</dt>
      <dd>
        <span className="fl-stat__v rp-mono rp-num">{value}</span>
        {note && <span className="fl-stat__note">{note}</span>}
      </dd>
    </div>
  );
}

function QueueList({ items }: { items: QueueItem[] }) {
  return (
    <ol className="fl-queue" aria-label="Provisioning queue">
      {items.map((q) => (
        <li key={q.id} className={`fl-qitem${q.blocked ? " is-blocked" : ""}`}>
          <div className="fl-qitem__top">
            <Link to={`/fleet?tenant=${q.id}`} className="fl-qitem__id rp-mono">
              {q.id}
            </Link>
            <span className="fl-qitem__scn">{q.scenarioName}</span>
            <span className="fl-qitem__region rp-mono">{q.region}</span>
            <span className="fl-qitem__wait rp-mono rp-num" title="Time in queue">
              {secs(q.waitingSec)}
            </span>
          </div>
          <div className="fl-qitem__steps" role="img" aria-label={`Step ${q.step} of ${q.steps}`}>
            {Array.from({ length: q.steps }, (_, i) => (
              <span key={i} className={`fl-qitem__seg${i < q.step ? " is-done" : ""}${i === q.step ? " is-now" : ""}`} />
            ))}
          </div>
          <div className="fl-qitem__label">
            {q.blocked ? <StatusDot tone="crit" size="sm" label={q.stepLabel} /> : <span>{q.stepLabel}</span>}
            {q.attempt > 1 && <span className="fl-qitem__attempt rp-mono rp-num">attempt {q.attempt}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Provisioning({ queue, loading, empty }: { queue: QueueItem[]; loading: boolean; empty: boolean }) {
  const recent = provisionFailures.filter((f) => Date.now() - new Date(f.at).getTime() < HOUR);
  const surge = recent.length >= 3;
  const lastP95 = provisionTrend.p95[provisionTrend.p95.length - 1];
  const failRate = (provisionStats.failed24h / provisionStats.launches24h) * 100;
  const failures = empty ? [] : provisionFailures;
  const columns: Column<ProvisionFailure>[] = [
    { id: "at", header: "Time", width: 84, mono: true, cell: (f) => <span title={formatDateTime(f.at)}>{formatTime(f.at)}</span>, sortValue: (f) => f.at },
    { id: "tenant", header: "Tenant", width: 132, mono: true, cell: (f) => f.tenantId },
    { id: "scn", header: "Scenario", width: 104, cell: (f) => f.scenarioName },
    { id: "region", header: "Region", width: 104, mono: true, cell: (f) => f.region },
    { id: "code", header: "Error", width: 176, mono: true, truncate: true, cell: (f) => <span className="fl-errcode">{f.code}</span> },
    { id: "msg", header: "Detail", minWidth: 260, truncate: true, cell: (f) => f.message },
  ];

  return (
    <Section title="Provisioning" id="provisioning" meta={!loading && !empty ? `${queue.length} in queue` : undefined}>
      {!loading && !empty && surge && (
        <Callout
          tone="crit"
          title={
            <>
              <span className="rp-mono rp-num">{recent.length}</span> launches failed in the last hour, all in <span className="rp-mono">uksouth</span>
            </>
          }
          action={
            <Link to="/system#incidents" className="fl-calloutlink">
              {incident.id}
            </Link>
          }
        >
          <span className="rp-mono">standardDSv5Family</span> quota is at its limit. New uksouth launches queue until capacity frees. Learners were not charged lab hours for failed
          launches.
        </Callout>
      )}
      <div className="fl-prov">
        <Card title="Queue" padding="none" meta={!loading && !empty ? <span className="rp-mono rp-num">{queue.length} waiting</span> : undefined}>
          {loading ? (
            <LoadingRegion label="Loading provisioning queue">
              <div className="fl-queue">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="fl-qitem">
                    <Skeleton width="70%" height={11} />
                    <Skeleton width="100%" height={4} style={{ marginTop: 10 }} />
                    <Skeleton width="45%" height={10} style={{ marginTop: 10 }} />
                  </div>
                ))}
              </div>
            </LoadingRegion>
          ) : queue.length === 0 ? (
            <EmptyState icon="check" title="Queue is empty" compact>
              Launches start provisioning as soon as they are requested.
            </EmptyState>
          ) : (
            <QueueList items={queue} />
          )}
        </Card>
        <Card title="Provision time" padding="none" meta="Launch to handover, last 24 hours">
          {loading ? (
            <LoadingRegion label="Loading provision time">
              <div className="fl-provchart">
                <Skeleton height={44} />
                <Skeleton height={180} style={{ marginTop: 16 }} />
              </div>
            </LoadingRegion>
          ) : (
            <div className="fl-provchart">
              <dl className="fl-stats">
                <Stat label="p50" value={empty ? "None" : secs(provisionStats.p50Sec)} />
                <Stat label="p95" value={empty ? "None" : secs(provisionStats.p95Sec)} note={empty ? undefined : `SLO ${secs(provisionStats.sloSec)}, dashed`} />
                <Stat label="p95, last hour" value={empty ? "None" : secs(lastP95 * 60)} tone={!empty && lastP95 * 60 > provisionStats.sloSec ? "crit" : undefined} />
                <Stat label="Launches" value={empty ? "0" : String(provisionStats.launches24h)} />
                <Stat
                  label="Failed"
                  value={empty ? "0" : String(provisionStats.failed24h)}
                  note={empty ? undefined : `${failRate.toFixed(1)}% of launches`}
                  tone={!empty && provisionStats.failed24h > 0 ? "crit" : undefined}
                />
              </dl>
              {empty ? (
                <EmptyState icon="activity" title="No launches in the last 24 hours" compact />
              ) : (
                <LineChart
                  label="Provision time p50 and p95 by hour, last 24 hours, in minutes"
                  x={provisionTrend.labels}
                  series={[
                    { id: "p50", label: "p50", values: provisionTrend.p50, tone: "chart-2" },
                    { id: "p95", label: "p95", values: provisionTrend.p95, tone: "chart-1" },
                  ]}
                  height={188}
                  yMax={16}
                  yFormat={(v) => `${Math.round(v)}m`}
                  threshold={{ value: provisionStats.sloSec / 60, label: "" }}
                />
              )}
            </div>
          )}
        </Card>
      </div>
      <Card
        title="Failed launches"
        padding="none"
        meta={
          !loading && failures.length ? (
            <span className="fl-failmeta">
              <span className="rp-mono rp-num">{failures.length}</span> in 24 hours, <span className="rp-mono rp-num">{recent.length}</span> in the last hour
            </span>
          ) : undefined
        }
      >
        <DataTable
          caption="Failed launches in the last 24 hours"
          className="fl-t fl-t--fail"
          columns={columns}
          rows={failures}
          rowKey={(f) => f.id}
          loading={loading}
          density="compact"
          pageSize={25}
          columnControls={false}
          rowClassName={(f) => (Date.now() - new Date(f.at).getTime() < HOUR ? "is-recent" : undefined)}
          empty={<EmptyState icon="check" title="No failed launches in the last 24 hours" compact />}
          footerNote={loading || !failures.length ? undefined : "Failed launches are voided. Learners are not charged lab hours and can relaunch."}
        />
      </Card>
    </Section>
  );
}

export function Capacity({ quotas, loading }: { quotas: Quota[]; loading: boolean }) {
  const toast = useToast();
  const [requested, setRequested] = useState<string[]>([]);
  const columns: Column<Quota>[] = [
    { id: "region", header: "Region", width: 116, mono: true, hideable: false, cell: (q) => q.region, sortValue: (q) => q.region },
    {
      id: "family",
      header: "VM family",
      width: 220,
      cell: (q) => (
        <span className="fl-family">
          <span className="rp-mono">{q.family}</span>
          <span className="fl-family__sku">{q.sku}</span>
        </span>
      ),
    },
    {
      id: "bar",
      header: "Usage",
      minWidth: 220,
      cell: (q) => {
        const pct = q.used / q.limit;
        return (
          <div
            className={`fl-qbar${pct >= 1 ? " is-crit" : pct >= QUOTA_WARN ? " is-warn" : ""}`}
            role="meter"
            aria-valuemin={0}
            aria-valuemax={q.limit}
            aria-valuenow={q.used}
            aria-label={`${q.region} ${q.family} vCPU`}
            aria-valuetext={`${q.used} of ${q.limit} vCPU, ${Math.round(pct * 100)}%`}
          >
            <span className="fl-qbar__fill" style={{ width: `${Math.min(100, pct * 100)}%` }} />
            <span className="fl-qbar__warm" style={{ left: `${((q.used - q.warm) / q.limit) * 100}%`, width: `${(q.warm / q.limit) * 100}%` }} />
            <span className="fl-qbar__mark" style={{ left: `${QUOTA_WARN * 100}%` }} />
            <span className="fl-qbar__pct rp-mono rp-num">{Math.round(pct * 100)}%</span>
          </div>
        );
      },
      sortValue: (q) => q.used / q.limit,
    },
    {
      id: "used",
      header: "vCPU used",
      width: 120,
      align: "right",
      mono: true,
      sortValue: (q) => q.used,
      cell: (q) => (
        <>
          <span className="rp-strong">{q.used}</span>
          <span className="fl-dim"> / {q.limit}</span>
        </>
      ),
    },
    { id: "warm", header: "Warm pool", width: 104, align: "right", mono: true, cell: (q) => q.warm, defaultHidden: true },
    {
      id: "headroom",
      header: "Headroom",
      width: 116,
      align: "right",
      mono: true,
      sortValue: (q) => q.limit - q.used,
      cell: (q) => <span className={q.limit - q.used <= 0 ? "fl-over" : undefined}>{q.limit - q.used}</span>,
    },
    {
      id: "status",
      header: "Status",
      width: 156,
      sortValue: (q) => q.used / q.limit,
      cell: (q) => {
        const pct = q.used / q.limit;
        if (pct >= 1) return <StatusDot tone="crit" size="sm" label="At limit" />;
        if (pct >= QUOTA_WARN) return <StatusDot tone="med" size="sm" label={`Above ${QUOTA_WARN * 100}%`} />;
        return <StatusDot tone="neutral" size="sm" label="Within quota" />;
      },
    },
    {
      id: "act",
      header: <span className="rp-sr">Actions</span>,
      headerLabel: "Actions",
      width: 168,
      align: "right",
      hideable: false,
      cell: (q) => {
        const key = `${q.region}:${q.family}`;
        if (q.used / q.limit < QUOTA_WARN) return null;
        if (requested.includes(key)) return <span className="fl-dim">Increase requested</span>;
        return (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setRequested((r) => [...r, key]);
              toast.push({
                title: `Quota increase requested, ${q.region}`,
                detail: `${q.family} from ${q.limit} to ${q.limit * 2} vCPU. Azure usually approves within 15 minutes.`,
                tone: "info",
              });
            }}
          >
            Request increase
          </Button>
        );
      },
    },
  ];
  return (
    <Section
      title="Capacity and quota"
      id="capacity"
      meta={
        <span className="fl-legend">
          <span className="fl-legend__mark" aria-hidden="true" />
          Warning at <span className="rp-mono rp-num">{QUOTA_WARN * 100}%</span> of the Azure vCPU quota
        </span>
      }
    >
      <DataTable
        caption="Azure vCPU quota by region and VM family"
        className="fl-t fl-t--quota"
        columns={columns}
        rows={quotas}
        rowKey={(q) => `${q.region}:${q.family}`}
        loading={loading}
        density="compact"
        defaultSort={{ id: "bar", dir: "desc" }}
        footerNote={loading ? undefined : "Usage includes the warm pool of pre-provisioned VMs kept for fast launches."}
      />
    </Section>
  );
}

function CheckCell({ run, id, running }: { run: IsolationRun; id: CheckId; running: boolean }) {
  if (running) return <StatusDot tone="info" size="sm" label="Probing" />;
  const r = run.results[id];
  if (!r.pass) return <StatusDot tone="crit" size="sm" label="Reachable" title={r.detail} />;
  return (
    <span className="fl-pass">
      <Icon name="check" size={13} strokeWidth={2.25} />
      Blocked
    </span>
  );
}

export function Isolation({ runs, loading, empty, onRun }: { runs: IsolationRun[]; loading: boolean; empty: boolean; onRun: (ids: string[]) => void }) {
  const [running, setRunning] = useState<string[]>([]);
  const failing = runs.filter((r) => CHECKS.some((c) => !r.results[c.id].pass));
  const passed = runs.length - failing.length;
  const start = (ids: string[]) => {
    setRunning((r) => [...r, ...ids]);
    window.setTimeout(() => {
      setRunning((r) => r.filter((x) => !ids.includes(x)));
      onRun(ids);
    }, 1600);
  };
  const columns: Column<IsolationRun>[] = [
    {
      id: "scn",
      header: "Scenario template",
      minWidth: 160,
      hideable: false,
      sortValue: (r) => r.scenarioName,
      cell: (r) => (
        <span className="fl-tpl">
          <span className="rp-strong">{r.scenarioName}</span>
          <span className="rp-mono fl-tpl__v">{r.version}</span>
        </span>
      ),
    },
    ...CHECKS.map<Column<IsolationRun>>((c) => ({
      id: c.id,
      header: c.short,
      width: c.id === "imds" ? 164 : 136,
      headerLabel: c.label,
      sortValue: (r) => (r.results[c.id].pass ? 1 : 0),
      cell: (r) => <CheckCell run={r} id={c.id} running={running.includes(r.scenarioId)} />,
    })),
    {
      id: "result",
      header: "Result",
      width: 188,
      sortValue: (r) => (CHECKS.some((c) => !r.results[c.id].pass) ? 0 : 1),
      cell: (r) =>
        running.includes(r.scenarioId) ? (
          <span className="fl-dim">Probing</span>
        ) : CHECKS.some((c) => !r.results[c.id].pass) ? (
          <StatusDot tone="crit" size="sm" label="Failed, launches paused" />
        ) : (
          <StatusDot tone="success" size="sm" label="Verified" />
        ),
    },
    {
      id: "at",
      header: "Last run",
      width: 140,
      sortValue: (r) => r.at,
      cell: (r) => (
        <span className="fl-when" title={`${formatDateTime(r.at)}, took ${secs(r.durationSec)}`}>
          <span className="rp-mono rp-num">{formatTime(r.at)}</span>
          <span className="fl-when__rel">{formatRelative(r.at)}</span>
        </span>
      ),
    },
    {
      id: "run",
      header: <span className="rp-sr">Run</span>,
      headerLabel: "Run now",
      width: 124,
      align: "right",
      hideable: false,
      cell: (r) => (
        <Button
          size="sm"
          variant="secondary"
          iconLeft="play"
          loading={running.includes(r.scenarioId)}
          onClick={() => start([r.scenarioId])}
          aria-label={`Run isolation checks for ${r.scenarioName}`}
        >
          Run now
        </Button>
      ),
    },
  ];
  return (
    <Section
      title="Isolation assurance"
      id="isolation"
      meta={
        !loading && !empty ? (
          <>
            <span className="rp-mono rp-num">{passed}</span> of <span className="rp-mono rp-num">{runs.length}</span> templates verified
          </>
        ) : undefined
      }
      actions={
        !loading && !empty ? (
          <Button size="sm" variant="secondary" iconLeft="refresh" disabled={running.length > 0} onClick={() => start(runs.map((r) => r.scenarioId))}>
            Run all
          </Button>
        ) : undefined
      }
    >
      {!loading &&
        !empty &&
        failing.map((r) => {
          const bad = CHECKS.filter((c) => !r.results[c.id].pass);
          return (
            <Callout
              key={r.scenarioId}
              tone="crit"
              title={
                <>
                  {r.scenarioName} <span className="rp-mono">{r.version}</span>: {bad.map((c) => c.label.replace(" blocked", "").toLowerCase()).join(", ")} not blocked. Launches
                  paused.
                </>
              }
            >
              {bad.map((c) => r.results[c.id].detail).join(" ")} Running {r.scenarioName} tenants were moved to the quarantine network.
            </Callout>
          );
        })}
      <DataTable
        caption="Isolation checks, last verification run per scenario template"
        className="fl-t fl-t--iso"
        columns={columns}
        rows={empty ? [] : runs}
        rowKey={(r) => r.scenarioId}
        loading={loading}
        density="compact"
        columnControls={false}
        defaultSort={{ id: "result", dir: "asc" }}
        rowClassName={(r) => (CHECKS.some((c) => !r.results[c.id].pass) ? "is-failing" : undefined)}
        empty={
          <EmptyState
            icon="shield"
            title="No verification runs recorded"
            compact
            action={
              <Button size="sm" iconLeft="play" onClick={() => onRun(runs.map((r) => r.scenarioId))}>
                Run all checks
              </Button>
            }
          >
            Every template is probed for egress, cross-tenant reach and instance metadata before it can launch.
          </EmptyState>
        }
        footerNote={
          loading || empty ? undefined : (
            <span className="fl-probes">
              {CHECKS.map((c) => (
                <span key={c.id}>
                  <span className="rp-strong">{c.label}:</span> {c.probe}
                </span>
              ))}
            </span>
          )
        }
      />
    </Section>
  );
}
