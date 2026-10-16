import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Button,
  ConfirmDialog,
  DataTable,
  Drawer,
  DropdownMenu,
  EmptyState,
  IconButton,
  KeyValue,
  Modal,
  RadioGroup,
  Select,
  StatusDot,
  Textarea,
  formatDateTime,
  formatNumber,
  formatTime,
  useToast,
} from "@rootpanther/ui";
import type { Column } from "@rootpanther/ui";
import { IDLE_LIMIT_MIN, REGIONS, STATE_LABEL, incident, logsFor } from "../../mock/fleet";
import type { Region, Tenant, TenantState } from "../../mock/fleet";
import { STATE_TONE, dur, perHour, usd } from "./util";

interface Props {
  rows: Tenant[];
  loading: boolean;
  empty: boolean;
  highlight: string | null;
  onUpdate: (id: string, patch: Partial<Tenant>) => void;
}

const STATES: TenantState[] = ["provisioning", "running", "idle", "tearing-down", "failed"];

function LogDrawer({ tenant, onClose }: { tenant: Tenant | null; onClose: () => void }) {
  const lines = tenant ? logsFor(tenant) : [];
  const multiDay = lines.length > 1 && lines[0].at.slice(0, 10) !== lines[lines.length - 1].at.slice(0, 10);
  return (
    <Drawer
      open={!!tenant}
      onClose={onClose}
      title="Tenant logs"
      width={640}
      meta={tenant ? <span className="rp-mono">{tenant.id}</span> : undefined}
      footer={
        tenant && (
          <>
            <span className="fl-logfoot rp-mono rp-num">{lines.length} lines, UTC</span>
            <Button
              variant="secondary"
              size="sm"
              iconLeft="external"
              onClick={() => window.open(`https://portal.azure.com/#resource/subscriptions/rp-labs/resourceGroups/${tenant.id}/logs`, "_blank", "noopener")}
            >
              Open in Log Analytics
            </Button>
          </>
        )
      }
    >
      {tenant && (
        <div className="fl-logs">
          <KeyValue
            columns={3}
            items={[
              { label: "Scenario", value: `${tenant.scenarioName} ${tenant.version}` },
              { label: "Region", value: tenant.region, mono: true },
              { label: "State", value: <StatusDot tone={STATE_TONE[tenant.state]} size="sm" label={STATE_LABEL[tenant.state]} /> },
            ]}
          />
          <ol className={`fl-log${multiDay ? " is-multiday" : ""}`} aria-label={`Log lines for ${tenant.id}`} tabIndex={0}>
            {lines.map((l, i) => (
              <li key={i} className={`fl-log__line is-${l.level.toLowerCase()}`}>
                <time className="fl-log__at" dateTime={l.at}>
                  {multiDay && <span className="fl-log__day">{l.at.slice(5, 10)} </span>}
                  {l.at.slice(11, 19)}
                </time>
                <span className="fl-log__lvl">{l.level}</span>
                <span className="fl-log__src">{l.source}</span>
                <span className="fl-log__msg">{l.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Drawer>
  );
}

function IncidentModal({ tenant, onClose, onDone }: { tenant: Tenant | null; onClose: () => void; onDone: (t: Tenant, sev: string, mode: string) => void }) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [sev, setSev] = useState("sev2");
  const [note, setNote] = useState("");
  return (
    <Modal
      open={!!tenant}
      onClose={onClose}
      title="Mark incident"
      size="md"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => tenant && onDone(tenant, sev, mode)}>
            {mode === "existing" ? `Attach to ${incident.id}` : "Open incident"}
          </Button>
        </>
      }
    >
      {tenant && (
        <div className="fl-incident">
          <p>
            Tags <span className="rp-mono rp-strong">{tenant.id}</span> and keeps its resource group from automatic teardown until the incident closes.
          </p>
          <RadioGroup
            name="fl-inc-mode"
            legend="Incident"
            value={mode}
            onChange={setMode}
            options={[
              { value: "existing", label: `${incident.id}, ${incident.title}`, description: "Open, 6 linked tenants" },
              { value: "new", label: "New incident" },
            ]}
          />
          {mode === "new" && (
            <Select
              label="Severity"
              value={sev}
              onChange={(e) => setSev(e.target.value)}
              options={[
                { value: "sev1", label: "SEV1, learners blocked" },
                { value: "sev2", label: "SEV2, degraded" },
                { value: "sev3", label: "SEV3, single tenant" },
              ]}
            />
          )}
          <Textarea label="Note" optional rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you saw on this tenant" />
        </div>
      )}
    </Modal>
  );
}

export function RunningLabs({ rows, loading, empty, highlight, onUpdate }: Props) {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const stateFilter = (params.get("lstate") ?? "") as "" | TenantState;
  const regionFilter = (params.get("region") ?? "") as "" | Region;
  const [logs, setLogs] = useState<Tenant | null>(null);
  const [teardown, setTeardown] = useState<Tenant | null>(null);
  const [extend, setExtend] = useState<Tenant | null>(null);
  const [incidentFor, setIncidentFor] = useState<Tenant | null>(null);

  const setFilter = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  const filtered = useMemo(() => rows.filter((t) => (!stateFilter || t.state === stateFilter) && (!regionFilter || t.region === regionFilter)), [rows, stateFilter, regionFilter]);
  const counts = useMemo(() => {
    const c = {} as Record<TenantState, number>;
    STATES.forEach((s) => (c[s] = rows.filter((t) => t.state === s && (!regionFilter || t.region === regionFilter)).length));
    return c;
  }, [rows, regionFilter]);
  const burn = filtered.filter((t) => t.state !== "failed").reduce((a, t) => a + t.hourly, 0);

  const columns: Column<Tenant>[] = [
    {
      id: "id",
      header: "Tenant",
      width: 120,
      mono: true,
      hideable: false,
      sortValue: (t) => t.id,
      cell: (t) => (
        <button type="button" className="fl-tid" onClick={() => setLogs(t)} aria-label={`View logs for ${t.id}`}>
          {t.id}
        </button>
      ),
    },
    {
      id: "user",
      header: "User",
      minWidth: 180,
      truncate: true,
      titleValue: (t) => t.userEmail ?? "No session",
      sortValue: (t) => t.userEmail ?? "~",
      cell: (t) =>
        t.userId ? (
          <Link to={`/users/${t.userId}`} className="fl-user rp-mono">
            {t.userEmail}
          </Link>
        ) : (
          <span className="fl-nouser">No session</span>
        ),
    },
    {
      id: "scenario",
      header: "Scenario",
      width: 116,
      sortValue: (t) => t.scenarioName,
      cell: (t) => (
        <Link to={`/content?scenario=${t.scenarioId}`} className="fl-scn">
          {t.scenarioName}
        </Link>
      ),
    },
    { id: "region", header: "Region", width: 100, mono: true, sortValue: (t) => t.region, cell: (t) => t.region },
    {
      id: "started",
      header: "Started",
      width: 96,
      mono: true,
      cell: (t) => {
        const days = Math.round((new Date(new Date().toDateString()).getTime() - new Date(new Date(t.startedAt).toDateString()).getTime()) / 86400000);
        return (
          <span title={formatDateTime(t.startedAt)}>
            {formatTime(t.startedAt)}
            {days > 0 && <span className="fl-daysago">−{days}d</span>}
          </span>
        );
      },
    },
    { id: "elapsed", header: "Elapsed", width: 104, align: "right", mono: true, sortValue: (t) => t.elapsedMin, cell: (t) => dur(t.elapsedMin) },
    {
      id: "teardown",
      header: "Auto-teardown",
      width: 148,
      align: "right",
      sortValue: (t) => (t.state === "failed" || t.state === "tearing-down" ? 1e6 : t.orphan ? -1e6 + t.teardownInMin : t.teardownInMin),
      cell: (t) => {
        if (t.state === "tearing-down") return <span className="fl-dim">In progress</span>;
        if (t.state === "failed") return <span className="fl-dim">Not started</span>;
        if (t.orphan?.reason === "no-session") return <span className="fl-over rp-mono">No timer</span>;
        if (t.teardownInMin < 0) return <span className="fl-over rp-mono rp-num">{dur(-t.teardownInMin)} overdue</span>;
        return (
          <span className={`fl-ttl rp-mono rp-num${t.teardownInMin < 15 ? " is-soon" : ""}`}>
            {dur(t.teardownInMin)}
            <span className="fl-ttl__by">{t.teardownBy === "idle" ? "idle" : "max life"}</span>
          </span>
        );
      },
    },
    {
      id: "cost",
      header: "Cost so far",
      width: 120,
      align: "right",
      mono: true,
      sortValue: (t) => t.costSoFar,
      cell: (t) => <span className={t.costSoFar >= 5 ? "rp-strong" : undefined}>{usd(t.costSoFar)}</span>,
    },
    { id: "rate", header: "Rate", width: 88, align: "right", mono: true, defaultHidden: true, sortValue: (t) => t.hourly, cell: (t) => perHour(t.hourly) },
    {
      id: "state",
      header: "State",
      width: 120,
      sortValue: (t) => STATES.indexOf(t.state),
      titleValue: (t) => t.failure ?? (t.state === "idle" ? `No input for ${dur(t.idleMin)}` : STATE_LABEL[t.state]),
      cell: (t) => (
        <span className="fl-state">
          <StatusDot tone={STATE_TONE[t.state]} hollow={t.state === "tearing-down"} size="sm" label={STATE_LABEL[t.state]} />
          {t.orphan && <span className="fl-state__orphan">Orphaned</span>}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="rp-sr">Actions</span>,
      headerLabel: "Actions",
      width: 48,
      align: "right",
      hideable: false,
      cell: (t) => (
        <div className="fl-rowactions">
          <DropdownMenu
            label={`Actions for ${t.id}`}
            width={220}
            items={[
              { id: "logs", label: "View logs", icon: "terminal", onSelect: () => setLogs(t) },
              { id: "extend", label: "Extend 60 minutes", icon: "clock", disabled: t.state !== "running" && t.state !== "idle", onSelect: () => setExtend(t) },
              { id: "incident", label: "Mark incident", icon: "flag", onSelect: () => setIncidentFor(t) },
              ...(t.userId ? [{ id: "user", label: "View user", icon: "user" as const, to: `/users/${t.userId}` }] : []),
              { id: "d", divider: true },
              { id: "teardown", label: "Force teardown", icon: "trash", danger: true, disabled: t.state === "tearing-down", onSelect: () => setTeardown(t) },
            ]}
            trigger={(p) => <IconButton {...p} icon="more" size="sm" label={`Actions for ${t.id}`} />}
          />
        </div>
      ),
    },
  ];

  const filtersOn = !!stateFilter || !!regionFilter;

  return (
    <>
      <DataTable
        caption="Running labs"
        className="fl-t fl-t--labs"
        columns={columns}
        rows={empty ? [] : filtered}
        rowKey={(t) => t.id}
        loading={loading}
        density="compact"
        pageSize={25}
        defaultSort={{ id: "teardown", dir: "asc" }}
        rowClassName={(t) => (t.id === highlight ? "is-highlight" : t.orphan ? "is-orphan" : undefined)}
        maxHeight={640}
        footerNote={
          loading || empty ? undefined : (
            <>
              <span className="rp-mono rp-num">{formatNumber(filtered.length)}</span> {filtersOn ? `of ${rows.length} tenants` : "tenants"}, burning{" "}
              <span className="rp-mono rp-num rp-strong">{perHour(burn)}</span>. Idle limit <span className="rp-mono rp-num">{IDLE_LIMIT_MIN}m</span>.
            </>
          )
        }
        toolbar={
          <div className="fl-filters" role="group" aria-label="Filter running labs">
            <div className="fl-statefilter" role="radiogroup" aria-label="State">
              {(["", ...STATES] as ("" | TenantState)[]).map((s) => (
                <button
                  key={s || "all"}
                  type="button"
                  role="radio"
                  aria-checked={stateFilter === s}
                  className={`fl-chip${stateFilter === s ? " is-on" : ""}`}
                  onClick={() => setFilter("lstate", s)}
                >
                  {s ? <StatusDot tone={STATE_TONE[s]} hollow={s === "tearing-down"} size="sm" label={STATE_LABEL[s]} /> : "All"}
                  {!loading && <span className="fl-chip__n rp-mono rp-num">{s ? counts[s] : Object.values(counts).reduce((a, b) => a + b, 0)}</span>}
                </button>
              ))}
            </div>
            <Select
              selectSize="sm"
              aria-label="Region"
              value={regionFilter}
              onChange={(e) => setFilter("region", e.target.value)}
              options={[{ value: "", label: "All regions" }, ...REGIONS.map((r) => ({ value: r, label: r }))]}
              className="fl-regionsel"
            />
          </div>
        }
        empty={
          empty ? (
            <EmptyState icon="server" title="No labs running" compact>
              Tenants appear here within seconds of a learner pressing Launch.
            </EmptyState>
          ) : (
            <EmptyState
              icon="filter"
              title="No tenants match these filters"
              compact
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const p = new URLSearchParams(params);
                    p.delete("lstate");
                    p.delete("region");
                    setParams(p, { replace: true });
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )
        }
      />
      <LogDrawer tenant={logs} onClose={() => setLogs(null)} />
      <ConfirmDialog
        open={!!teardown}
        onClose={() => setTeardown(null)}
        destructive
        title={`Force teardown ${teardown?.id ?? ""}`}
        confirmLabel="Force teardown"
        onConfirm={() => {
          const t = teardown!;
          setTeardown(null);
          onUpdate(t.id, { state: "tearing-down", teardownBy: "none" });
          toast.push({
            title: `Teardown started, ${t.id}`,
            detail: `${t.hostCount} ${t.hostCount === 1 ? "VM" : "VMs"} deleting. ${perHour(t.hourly)} stops within 4 minutes.`,
            tone: "neutral",
          });
        }}
      >
        {teardown && (
          <p>
            Deletes the resource group and <span className="rp-mono rp-strong">{teardown.hostCount}</span> {teardown.hostCount === 1 ? "VM" : "VMs"}, stopping{" "}
            <span className="rp-mono rp-strong">{perHour(teardown.hourly)}</span>.{" "}
            {teardown.userEmail ? (
              <>
                The session for <span className="rp-mono">{teardown.userEmail}</span> ends now. Notes, proofs and reports are kept, and the learner is charged only for time used.
              </>
            ) : (
              "No learner session is attached."
            )}
          </p>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={!!extend}
        onClose={() => setExtend(null)}
        title={`Extend ${extend?.id ?? ""} by 60 minutes`}
        confirmLabel="Extend 60 minutes"
        onConfirm={() => {
          const t = extend!;
          setExtend(null);
          onUpdate(t.id, { teardownInMin: t.teardownInMin + 60, maxLifeMin: t.maxLifeMin + 60, teardownBy: "max-life" });
          toast.push({ title: `Extended ${t.id} by 60 minutes`, detail: `Adds about ${usd(t.hourly)} of compute. Not counted against the learner's lab hours.`, tone: "info" });
        }}
      >
        {extend && (
          <p>
            Max life becomes <span className="rp-mono rp-strong">{dur(extend.maxLifeMin + 60)}</span>. The extra hour is not counted against{" "}
            {extend.userEmail ? <span className="rp-mono">{extend.userEmail}</span> : "the learner"}'s allowance and is written to the audit log.
          </p>
        )}
      </ConfirmDialog>
      <IncidentModal
        tenant={incidentFor}
        onClose={() => setIncidentFor(null)}
        onDone={(t, sev, mode) => {
          setIncidentFor(null);
          toast.push({
            title: mode === "existing" ? `${t.id} attached to ${incident.id}` : `INC-0143 opened, ${sev.toUpperCase()}`,
            detail: "Automatic teardown is held for this tenant until the incident closes.",
            tone: "high",
          });
        }}
      />
    </>
  );
}
