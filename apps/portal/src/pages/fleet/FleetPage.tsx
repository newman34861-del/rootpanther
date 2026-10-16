import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, ErrorState, KpiTile, Page, PageHeader, Section, StatusDot, formatRelative, useToast } from "@rootpanther/ui";
import { computeToday, isolation as isolationSeed, lastScanAt, provisionFailures, queue as queueSeed, quotas, tenants as tenantSeed } from "../../mock/fleet";
import type { IsolationRun, Tenant } from "../../mock/fleet";
import { useDataState } from "../../review/review";
import { Capacity, Isolation, Provisioning } from "./Infra";
import { OrphanBlock } from "./OrphanBlock";
import { RunningLabs } from "./RunningLabs";
import { Denied, live, perHour, useNow, useRetry, useScrollTo, usd } from "./util";
import "./fleet.css";

export default function FleetPage() {
  const state = useDataState();
  const retry = useRetry();
  const toast = useToast();
  const [params] = useSearchParams();
  const now = useNow(30000);
  const [rows, setRows] = useState<Tenant[]>(tenantSeed);
  const [iso, setIso] = useState<IsolationRun[]>(isolationSeed);
  const loading = state === "loading";
  const empty = state === "empty";
  const highlight = params.get("tenant");
  const filter = params.get("filter");

  const liveRows = useMemo(() => rows.map((t) => live(t, now)), [rows, now]);
  const orphans = liveRows.filter((t) => t.orphan && t.state !== "tearing-down");
  const active = liveRows.filter((t) => t.state !== "failed");
  const burn = active.reduce((a, t) => a + t.hourly, 0);
  const today = active.reduce((a, t) => a + t.costSoFar, 0);
  const failed1h = provisionFailures.filter((f) => now - new Date(f.at).getTime() < 3600000).length;

  useScrollTo(filter === "orphaned" ? "#orphaned" : highlight ? ".fl-t--labs tr.is-highlight" : null, state === "default", filter === "orphaned" ? "start" : "center");

  const update = (id: string, patch: Partial<Tenant>) => setRows((xs) => xs.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const header = (
    <PageHeader
      title="Fleet"
      meta={
        state === "denied" ? undefined : state === "error" ? (
          <StatusDot tone="crit" size="sm" label="Control plane unreachable" />
        ) : (
          <>
            <StatusDot
              tone="neutral"
              size="sm"
              label={
                <>
                  Azure subscription <span className="rp-mono">rp-labs-prod</span>
                </>
              }
            />
            <span>
              Orphan scan <span className="rp-mono rp-num">{formatRelative(lastScanAt)}</span>
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

  if (state === "error") {
    return (
      <Page width="full">
        {header}
        <Card>
          <ErrorState title="Fleet data did not load" onRetry={retry} reference="req_9c04fa">
            The control plane API timed out after 10 seconds. Running labs are not affected and automatic teardown continues on its own schedule.
          </ErrorState>
        </Card>
      </Page>
    );
  }

  const hl = highlight && liveRows.some((t) => t.id === highlight) ? highlight : null;

  return (
    <Page width="full" className="fl-page">
      {header}
      <OrphanBlock
        orphans={empty ? [] : orphans}
        loading={loading}
        onCleanup={(ids) => {
          const stopped = rows.filter((t) => ids.includes(t.id)).reduce((a, t) => a + t.hourly, 0);
          setRows((xs) => xs.map((t) => (ids.includes(t.id) ? { ...t, state: "tearing-down", teardownBy: "none", orphan: undefined } : t)));
          toast.push({
            title: `Teardown started for ${ids.length} tenants`,
            detail: `${perHour(stopped)} stops within 4 minutes. Locks released, written to the audit log.`,
            tone: "neutral",
          });
        }}
      />
      <section className="fl-kpis" aria-label="Fleet summary">
        <KpiTile
          loading={loading}
          label="Tenants running"
          value={empty ? "0" : String(active.length)}
          secondary={
            empty ? (
              "None"
            ) : (
              <>
                {liveRows.filter((t) => t.state === "provisioning").length} provisioning, {liveRows.filter((t) => t.state === "idle").length} idle
              </>
            )
          }
        />
        <KpiTile
          loading={loading}
          label="Burn rate"
          value={empty ? "$0.00" : perHour(burn)}
          secondary={
            empty ? (
              "No compute running"
            ) : (
              <>
                About <span className="rp-mono rp-num">{usd(burn * 24)}</span> a day at this level
              </>
            )
          }
        />
        <KpiTile
          loading={loading}
          label="Compute today"
          value={empty ? "$0.00" : usd(today + computeToday.endedSessions)}
          delta={empty ? undefined : { value: ((today + computeToday.endedSessions) / computeToday.yesterdaySameTime - 1) * 100, good: "down", period: "vs yesterday" }}
        />
        <KpiTile
          loading={loading}
          href="#provisioning"
          label="Failed launches, 1h"
          value={empty ? "0" : String(failed1h)}
          secondary={
            empty ? (
              "None"
            ) : failed1h ? (
              <>
                <span className="rp-mono">uksouth</span> quota at limit
              </>
            ) : (
              "Last 24 hours: 3"
            )
          }
          className={!loading && !empty && failed1h ? "fl-kpi--crit" : undefined}
        />
      </section>
      <Section title="Running labs" id="labs">
        <RunningLabs rows={empty ? [] : liveRows} loading={loading} empty={empty} highlight={hl} onUpdate={update} />
      </Section>
      <Provisioning queue={empty ? [] : queueSeed} loading={loading} empty={empty} />
      <Capacity quotas={empty ? quotas.map((q) => ({ ...q, used: q.warm })) : quotas} loading={loading} />
      <Isolation
        runs={iso}
        loading={loading}
        empty={empty}
        onRun={(ids) => {
          const at = new Date().toISOString();
          setIso((xs) => xs.map((r) => (ids.includes(r.scenarioId) ? { ...r, at } : r)));
          const failing = iso.filter((r) => ids.includes(r.scenarioId) && Object.values(r.results).some((x) => !x.pass));
          toast.push(
            failing.length
              ? {
                  title: `${ids.length} ${ids.length === 1 ? "template" : "templates"} checked, ${failing.length} failing`,
                  detail: `${failing.map((f) => f.scenarioName).join(", ")}: instance metadata still reachable. Launches stay paused.`,
                  tone: "crit",
                }
              : {
                  title: `${ids.length} ${ids.length === 1 ? "template" : "templates"} verified`,
                  detail: "Egress, cross-tenant and instance metadata all blocked.",
                  tone: "success",
                },
          );
        }}
      />
    </Page>
  );
}
