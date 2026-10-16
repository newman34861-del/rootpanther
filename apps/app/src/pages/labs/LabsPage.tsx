import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Button,
  ButtonLink,
  Card,
  Combobox,
  ConfirmDialog,
  ConnectionCard,
  DataTable,
  EmptyState,
  ErrorState,
  Icon,
  LoadingRegion,
  Modal,
  Page,
  PageHeader,
  PlanRequired,
  ProofBadge,
  RadioGroup,
  Select,
  SessionTimer,
  Skeleton,
  SkeletonText,
  Spinner,
  StatusDot,
  formatClock,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatTime,
  helpLabel,
  hostState,
  useInterval,
  useToast,
} from "@rootpanther/ui";
import type { Column, ConnectionMethod, ConnectionTest, Host, SessionRecord, Tone } from "@rootpanther/ui";
import { activeSession, currentUser, usage } from "../../mock/account";
import { allSessions, keptOnAccount, sessionLimits, suggestedResume, supportEmail, openvpn } from "../../mock/labs";
import { scenarioById } from "../../mock/scenarios";
import { useDataState, useReview } from "../../review/review";
import "./labs.css";

const MIN = 60000;

type PanelPhase = "running" | "ending" | "ended";

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), active ? 1000 : null);
  return now;
}

function downloadConfig() {
  try {
    const blob = new Blob([openvpn.config + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = openvpn.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    return;
  }
}

function hostsSentence(hosts: Host[]): string {
  const names = hosts.map((h) => h.name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function reachLabel(h: Host): { tone: Tone; label: string; hollow?: boolean } {
  const st = hostState(h);
  if (st === "owned") return { tone: "success", label: "Owned" };
  if (st === "reachable") return { tone: "primary", label: "Reachable" };
  return { tone: "neutral", label: "Not reached", hollow: true };
}

function HostRows({ hosts }: { hosts: Host[] }) {
  return (
    <div className="lb-hosts" role="table" aria-label="Hosts in this session">
      <div className="lb-hosts__row lb-hosts__head" role="row">
        <span role="columnheader">Host</span>
        <span role="columnheader">IP</span>
        <span role="columnheader">Role</span>
        <span role="columnheader">Reachability</span>
        <span role="columnheader">Proofs</span>
      </div>
      {hosts.map((h) => {
        const r = reachLabel(h);
        return (
          <div key={h.id} className="lb-hosts__row" role="row">
            <span role="cell" className="lb-hosts__name rp-mono">
              {h.name}
            </span>
            <span role="cell" className="lb-hosts__ip rp-mono rp-num">
              {h.ip}
            </span>
            <span role="cell" className="lb-hosts__role">
              {h.role}
            </span>
            <span role="cell" className="lb-hosts__reach">
              <StatusDot tone={r.tone} label={r.label} hollow={r.hollow} size="sm" />
            </span>
            <span role="cell" className="lb-hosts__proofs">
              {h.proofs?.length ? h.proofs.map((p) => <ProofBadge key={p} kind={p} captured />) : <span className="lb-dim">None yet</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface ActivePanelProps {
  endAt: number;
  now: number;
  onExtend: () => void;
  onEnd: () => void;
  onDownload: () => void;
}

function ActivePanel({ endAt, now, onExtend, onEnd, onDownload }: ActivePanelProps) {
  const started = new Date(activeSession.startedAt).getTime();
  const elapsedSec = Math.max(0, (now - started) / 1000);
  const remainingSec = Math.max(0, (endAt - now) / 1000);
  const idlePct = (activeSession.idleMin / activeSession.idleLimitMin) * 100;
  const owned = activeSession.hosts.filter((h) => h.owned).length;
  return (
    <Card padding="none" className="lb-active" titleId="lb-active-title">
      <div className="lb-active__head">
        <div className="lb-active__titles">
          <div className="lb-active__eyebrow">
            <span className="rp-eyebrow">Active session</span>
            <StatusDot tone="primary" label="Running" size="sm" />
            <span className="lb-active__id rp-mono">{activeSession.id}</span>
          </div>
          <h2 id="lb-active-title" className="lb-active__title">
            {activeSession.scenarioName}
          </h2>
          <div className="lb-active__meta">
            <span className="rp-mono">{activeSession.domain}</span>
            <span className="lb-iconmeta">
              <Icon name="target" size={14} />
              {activeSession.objective}
            </span>
            <span className="lb-iconmeta">
              <Icon name={activeSession.connection === "openvpn" ? "network" : "monitor"} size={14} />
              {activeSession.connection === "openvpn" ? "OpenVPN" : "In-browser terminal"}
            </span>
            <span className="lb-iconmeta">
              <Icon name="chat" size={14} />
              Onyx: {helpLabel(activeSession.helpLevel)}
            </span>
          </div>
        </div>
        <div className="lb-active__actions">
          <Button iconLeft="download" onClick={onDownload}>
            Download OpenVPN profile
          </Button>
          <Button iconLeft="clock" onClick={onExtend}>
            Extend session
          </Button>
          <ButtonLink to={`/lab/${activeSession.id}`} variant="primary" iconLeft="terminal">
            Open terminal
          </ButtonLink>
        </div>
      </div>

      <dl className="lb-stats">
        <div className="lb-stat">
          <dt>Elapsed</dt>
          <dd className="rp-mono rp-num">{formatClock(elapsedSec)}</dd>
        </div>
        <div className="lb-stat">
          <dt>Max session life</dt>
          <dd>
            <SessionTimer seconds={remainingSec} label="Ends in" icon={false} />
          </dd>
        </div>
        <div className="lb-stat">
          <dt>Idle shutdown</dt>
          <dd className="lb-idle">
            <span className="rp-mono rp-num">
              {activeSession.idleMin} <span className="lb-unit">of {activeSession.idleLimitMin} min idle</span>
            </span>
            <span className="lb-idle__track" aria-hidden="true">
              <span style={{ width: `${idlePct}%` }} />
              <span className="lb-idle__warn" style={{ left: `${(sessionLimits.idleWarnMin / activeSession.idleLimitMin) * 100}%` }} />
            </span>
          </dd>
        </div>
        <div className="lb-stat">
          <dt>Hosts owned</dt>
          <dd className="rp-mono rp-num">
            {owned} <span className="lb-unit">of {activeSession.hosts.length}</span>
          </dd>
        </div>
      </dl>

      <div className="lb-active__body">
        <HostRows hosts={activeSession.hosts} />
      </div>

      <div className="lb-active__foot">
        <Button variant="destructive" iconLeft="power" onClick={onEnd}>
          End session
        </Button>
      </div>
    </Card>
  );
}

function EndedPanel({ endedAt }: { endedAt: number }) {
  const durMin = Math.round((endedAt - new Date(activeSession.startedAt).getTime()) / MIN);
  const charged = Math.round((durMin / 60) * 10) / 10;
  return (
    <Card padding="none" className="lb-active is-ended" titleId="lb-ended-title">
      <div className="lb-active__head">
        <div className="lb-active__titles">
          <div className="lb-active__eyebrow">
            <span className="rp-eyebrow">Session ended</span>
            <StatusDot tone="neutral" label={`Ended ${formatTime(new Date(endedAt).toISOString())}`} size="sm" />
            <span className="lb-active__id rp-mono">{activeSession.id}</span>
          </div>
          <h2 id="lb-ended-title" className="lb-active__title">
            {activeSession.scenarioName}
          </h2>
          <p className="lb-ended__line">
            <span className="rp-mono">{hostsSentence(activeSession.hosts)}</span> were destroyed. Your proofs, notes and report draft are on your account.
          </p>
        </div>
      </div>
      <dl className="lb-stats">
        <div className="lb-stat">
          <dt>Duration</dt>
          <dd className="rp-mono rp-num">{formatDuration(durMin)}</dd>
        </div>
        <div className="lb-stat">
          <dt>Hosts owned</dt>
          <dd className="rp-mono rp-num">
            {activeSession.hosts.filter((h) => h.owned).length} <span className="lb-unit">of {activeSession.hosts.length}</span>
          </dd>
        </div>
        <div className="lb-stat">
          <dt>Proofs kept</dt>
          <dd className="rp-mono rp-num">{keptOnAccount.proofs}</dd>
        </div>
        <div className="lb-stat">
          <dt>Charged</dt>
          <dd className="rp-mono rp-num">
            {formatNumber(charged, 1)} <span className="lb-unit">h</span>
          </dd>
        </div>
      </dl>
      <div className="lb-debrief" role="status" aria-live="polite">
        <Spinner size={16} />
        <div className="lb-debrief__text">
          <span className="lb-debrief__title">Onyx is preparing your debrief</span>
          <span className="lb-debrief__detail">Usually ready in about 2 minutes. It appears in Reports and you get a notification.</span>
        </div>
      </div>
      <div className="lb-active__foot">
        <div className="lb-active__btns">
          <ButtonLink to={`/reports/${keptOnAccount.reportId}`} iconLeft="document">
            Continue the report
          </ButtonLink>
          <ButtonLink to="/reports" variant="quiet">
            All reports
          </ButtonLink>
        </div>
        <ButtonLink to="/catalogue/meridian" variant="quiet" iconLeft="play">
          Launch Meridian again
        </ButtonLink>
      </div>
    </Card>
  );
}

function NoSessionPanel({ fresh }: { fresh: boolean }) {
  const t = scenarioById(suggestedResume.scenarioId)!;
  return (
    <Card padding="none" className="lb-active is-empty" titleId="lb-none-title">
      <div className="lb-none">
        <div className="lb-none__main">
          <span className="lb-none__icon" aria-hidden="true">
            <Icon name="flask" size={18} />
          </span>
          <div>
            <h2 id="lb-none-title" className="lb-none__title">
              No lab running
            </h2>
            <p className="lb-none__text">Launch a scenario to get machines. Each session runs up to 4 hours and can be extended to 8.</p>
          </div>
        </div>
        {!fresh && (
          <div className="lb-resume">
            <div className="lb-resume__body">
              <span className="rp-eyebrow">Pick up where you left off</span>
              <span className="lb-resume__name">
                {t.name}
                <span className="lb-resume__proofs rp-mono rp-num">
                  {t.history?.proofsCaptured} of {t.history?.proofsTotal} proofs
                </span>
              </span>
              <span className="lb-resume__note">{suggestedResume.note}</span>
            </div>
            <ButtonLink to={`/catalogue/${t.slug}?launch=1`} variant="primary" iconLeft="play">
              Resume {t.name}
            </ButtonLink>
          </div>
        )}
        <div className="lb-none__actions">
          <ButtonLink to="/catalogue" variant={fresh ? "primary" : "secondary"} iconLeft="grid">
            Browse catalogue
          </ButtonLink>
        </div>
      </div>
    </Card>
  );
}

function PanelSkeleton() {
  return (
    <div className="rp-card lb-active lb-skel" aria-hidden="true">
      <div className="lb-active__head">
        <div className="lb-active__titles">
          <Skeleton width={160} height={10} />
          <Skeleton width={180} height={22} style={{ marginTop: 10 }} />
          <Skeleton width={320} height={11} style={{ marginTop: 10 }} />
        </div>
        <Skeleton width={140} height={36} radius="md" />
      </div>
      <div className="lb-stats">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="lb-stat">
            <Skeleton width={80} height={10} />
            <Skeleton width={100} height={18} style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
      <div className="lb-active__body">
        <SkeletonText lines={3} />
      </div>
    </div>
  );
}

interface ExtendModalProps {
  open: boolean;
  onClose: () => void;
  endAt: number;
  now: number;
  extendedMin: number;
  onConfirm: (min: number) => void;
}

function ExtendModal({ open, onClose, endAt, now, extendedMin, onConfirm }: ExtendModalProps) {
  const [choice, setChoice] = useState<string>("30");
  const totalMin = activeSession.maxLifeMin + extendedMin;
  const remainingAllowance = usage.allowanceHours - usage.usedHours;
  const remainingSessionH = Math.max(0, (endAt - now) / 3600000);
  const add = Number(choice);
  const newEnd = endAt + add * MIN;
  const afterH = remainingAllowance - remainingSessionH - add / 60;
  const options = sessionLimits.extendOptions.map((m) => {
    const blocked = totalMin + m > sessionLimits.maxTotalMin;
    return {
      value: String(m),
      label: `+${m} minutes`,
      description: blocked ? `Exceeds the ${sessionLimits.maxTotalMin / 60}h session limit` : `Ends at ${formatTime(new Date(endAt + m * MIN).toISOString())}`,
      disabled: blocked,
    };
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Extend session"
      size="md"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" iconLeft="clock" onClick={() => onConfirm(add)} disabled={options.find((o) => o.value === choice)?.disabled}>
            Extend by {add} minutes
          </Button>
        </>
      }
    >
      <div className="lb-extend">
        <RadioGroup name="lb-extend" legend="Add time" layout="cards" value={choice} onChange={setChoice} options={options} />
        <dl className="lb-extend__kv">
          <div>
            <dt>Current end</dt>
            <dd className="rp-mono rp-num">{formatTime(new Date(endAt).toISOString())}</dd>
          </div>
          <div>
            <dt>New end</dt>
            <dd className="rp-mono rp-num rp-strong">{formatTime(new Date(newEnd).toISOString())}</dd>
          </div>
          <div>
            <dt>Session length</dt>
            <dd className="rp-mono rp-num">
              {formatDuration(totalMin)} to {formatDuration(totalMin + add)}
              <span className="lb-unit"> of {sessionLimits.maxTotalMin / 60}h max</span>
            </dd>
          </div>
          <div>
            <dt>Lab hours left</dt>
            <dd className="rp-mono rp-num">
              {formatNumber(remainingAllowance, 1)} h <span className="lb-unit">now</span>
            </dd>
          </div>
          <div className="lb-extend__wide">
            <dt>If you use the full session</dt>
            <dd className="rp-mono rp-num">
              {formatNumber(Math.max(0, afterH), 1)} h <span className="lb-unit">left this period</span>
            </dd>
          </div>
        </dl>
        <p className="lb-extend__note">Lab hours are charged for time used, not for the extension. Ending early stops the charge.</p>
      </div>
    </Modal>
  );
}

const OUTCOME: Record<SessionRecord["outcome"], { tone: Tone; label: string; hollow?: boolean }> = {
  completed: { tone: "success", label: "Completed" },
  partial: { tone: "primary", label: "Partial" },
  abandoned: { tone: "neutral", label: "Abandoned" },
  expired: { tone: "med", label: "Expired" },
  "failed-provision": { tone: "crit", label: "Provisioning failed, not charged" },
};

type RangeId = "all" | "7" | "30" | "period";

const RANGES: { value: RangeId; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "period", label: "This billing period" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
];

function inRange(r: SessionRecord, range: RangeId): boolean {
  const t = new Date(r.startedAt).getTime();
  if (range === "all") return true;
  if (range === "period") return t >= new Date(usage.periodStart).getTime();
  return t >= Date.now() - Number(range) * 86400000;
}

function SessionHistory({ rows, loading, error, onRetry, runningId }: { rows: SessionRecord[]; loading: boolean; error: boolean; onRetry: () => void; runningId: string | null }) {
  const [range, setRange] = useState<RangeId>("all");
  const [scenario, setScenario] = useState<string | null>(null);
  const scenarioOptions = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((r) => seen.set(r.scenarioId, r.scenarioName));
    return Array.from(seen, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);
  const filtered = rows.filter((r) => inRange(r, range) && (!scenario || r.scenarioId === scenario));
  const filtering = range !== "all" || scenario !== null;

  const columns: Column<SessionRecord>[] = [
    {
      id: "scenario",
      header: "Scenario",
      cell: (r) => (
        <span className="lb-tscen">
          <Link to={`/catalogue/${r.scenarioId}`}>{r.scenarioName}</Link>
          <span className="lb-tscen__id rp-mono">{r.id}</span>
        </span>
      ),
      sortValue: (r) => r.scenarioName,
      width: 150,
    },
    { id: "started", header: "Started", cell: (r) => formatDateTime(r.startedAt), sortValue: (r) => r.startedAt, width: 130 },
    {
      id: "duration",
      header: "Duration",
      cell: (r) => (r.durationMin ? formatDuration(r.durationMin) : <span className="lb-dim">None</span>),
      sortValue: (r) => r.durationMin,
      mono: true,
      align: "right",
      width: 100,
    },
    { id: "hosts", header: "Hosts owned", cell: (r) => `${r.hostsOwned} of ${r.hostsTotal}`, sortValue: (r) => r.hostsOwned / r.hostsTotal, mono: true, align: "right", width: 128 },
    {
      id: "outcome",
      header: "Outcome",
      cell: (r) => {
        if (r.id === runningId) return <StatusDot tone="primary" label="Running" size="sm" />;
        const o = OUTCOME[r.outcome];
        return <StatusDot tone={o.tone} label={o.label} hollow={o.hollow} size="sm" />;
      },
      sortValue: (r) => r.outcome,
      width: 232,
    },
    {
      id: "charged",
      header: "Charged",
      cell: (r) => (r.outcome === "failed-provision" ? <span className="lb-dim">0.0 h</span> : `${formatNumber(r.chargedHours, 1)} h`),
      sortValue: (r) => r.chargedHours,
      mono: true,
      align: "right",
      width: 112,
    },
    {
      id: "debrief",
      header: "Debrief",
      cell: (r) =>
        r.debriefId ? (
          <Link to={`/reports/debriefs/${r.debriefId}`} className="lb-tlink">
            Debrief
          </Link>
        ) : (
          <span className="lb-dim">{r.id === runningId ? "After it ends" : "None"}</span>
        ),
      width: 104,
    },
    {
      id: "report",
      header: "Report",
      cell: (r) =>
        r.reportId ? (
          <Link to={`/reports/${r.reportId}`} className="lb-tlink">
            Report
          </Link>
        ) : (
          <span className="lb-dim">None</span>
        ),
      width: 88,
    },
  ];

  return (
    <section id="history" className="lb-history" aria-labelledby="lb-history-title">
      <div className="lb-sechead">
        <h2 id="lb-history-title">Session history</h2>
        {!loading && !error && rows.length > 0 && (
          <span className="lb-sechead__meta">
            <span className="rp-mono rp-num">{rows.length}</span> sessions
          </span>
        )}
      </div>
      <DataTable
        caption="Session history"
        className="lb-table"
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        defaultSort={{ id: "started", dir: "desc" }}
        pageSize={loading || filtered.length > 0 ? 6 : undefined}
        loading={loading}
        error={error ? { title: "Session history did not load", detail: "Running labs are not affected.", onRetry } : null}
        columnControls={false}
        toolbar={
          error || (!loading && rows.length === 0) ? undefined : (
            <div className="lb-filters">
              <Select aria-label="Date range" selectSize="sm" value={range} onChange={(e) => setRange(e.target.value as RangeId)} options={RANGES} disabled={loading || error || rows.length === 0} />
              <div className="lb-filters__combo">
                <label htmlFor="lb-scenario-filter" className="rp-sr">
                  Scenario
                </label>
                <Combobox id="lb-scenario-filter" options={scenarioOptions} value={scenario} onChange={setScenario} placeholder="All scenarios" emptyText="No scenario with sessions" />
              </div>
              {filtering && (
                <button
                  type="button"
                  className="rp-link rp-small"
                  onClick={() => {
                    setRange("all");
                    setScenario(null);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          )
        }
        empty={
          rows.length === 0 ? (
            <EmptyState
              compact
              icon="history"
              title="No sessions yet"
              action={
                <ButtonLink to="/catalogue" size="sm">
                  Browse catalogue
                </ButtonLink>
              }
            >
              Every lab you launch is listed here with its outcome and the hours it used.
            </EmptyState>
          ) : (
            <EmptyState
              compact
              icon="filter"
              title="No sessions match these filters"
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setRange("all");
                    setScenario(null);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )
        }
      />
    </section>
  );
}

function ConnectionsSkeleton() {
  return (
    <div className="lb-conns" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="rp-card lb-skelcard">
          <div className="lb-skelhead">
            <Skeleton width={34} height={34} radius="md" />
            <div style={{ flex: 1 }}>
              <Skeleton width={180} height={12} />
              <Skeleton width={220} height={10} style={{ marginTop: 8 }} />
            </div>
          </div>
          <div style={{ padding: 18 }}>
            <SkeletonText lines={3} />
            <Skeleton width={140} height={36} radius="md" style={{ marginTop: 18 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LabsPage() {
  const state = useDataState();
  const { flags } = useReview();
  const toast = useToast();
  const navigate = useNavigate();
  const { hash, pathname, search } = useLocation();
  const loading = state === "loading";
  const error = state === "error";
  const fresh = flags.user === "new" || state === "empty";
  const labActive = flags.lab === "active" && !fresh;

  const [phase, setPhase] = useState<PanelPhase>("running");
  const [endedAt, setEndedAt] = useState(0);
  const [extendedMin, setExtendedMin] = useState(0);
  const [extendOpen, setExtendOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [defaultMethod, setDefaultMethod] = useState<ConnectionMethod>(currentUser.connectionDefault);
  const [test, setTest] = useState<ConnectionTest>("untested");
  const [announce, setAnnounce] = useState("");
  const testTimer = useRef<number>();

  const sessionLive = labActive && phase !== "ended";
  const now = useNow(sessionLive);
  const endAt = new Date(activeSession.startedAt).getTime() + (activeSession.maxLifeMin + extendedMin) * MIN;

  useEffect(() => () => window.clearTimeout(testTimer.current), []);

  useEffect(() => {
    if (state !== "default") return;
    if (hash === "#extend" && sessionLive) setExtendOpen(true);
    if (hash === "#history") window.setTimeout(() => document.getElementById("history")?.scrollIntoView({ block: "start" }), 50);
  }, [hash, sessionLive, state]);

  function closeExtend() {
    setExtendOpen(false);
    if (hash === "#extend") navigate({ pathname, search }, { replace: true });
  }

  function onDownload() {
    downloadConfig();
    toast.push({ title: `${openvpn.fileName} downloaded`, detail: "Run sudo openvpn rootpanther-lab.ovpn", tone: "primary" });
  }

  function onTest() {
    setTest("testing");
    setAnnounce("Testing the OpenVPN connection");
    window.clearTimeout(testTimer.current);
    testTimer.current = window.setTimeout(() => {
      setTest("connected");
      setAnnounce("Connected. Your tunnel reaches the lab gateway.");
    }, 1800);
  }

  function confirmEnd() {
    setPhase("ending");
    window.setTimeout(() => {
      setEndOpen(false);
      setPhase("ended");
      setEndedAt(Date.now());
      setTest("untested");
      toast.push({ title: "Session ended", detail: "Machines destroyed. Proofs, notes and the report draft are on your account.", tone: "neutral" });
    }, 1200);
  }

  const runningId = sessionLive ? activeSession.id : null;
  const historyRows = fresh ? [] : allSessions;

  const header = (
    <PageHeader
      title="Labs"
      meta={
        loading || error || state === "denied" ? undefined : (
          <>
            {sessionLive ? <StatusDot tone="primary" label="1 session running" size="sm" /> : <StatusDot tone="neutral" hollow label="No session running" size="sm" />}
            <span>
              <span className="rp-mono rp-num rp-strong">{formatNumber(fresh ? 0 : usage.usedHours, 1)}</span> of {usage.allowanceHours} h used this period
            </span>
          </>
        )
      }
    />
  );

  if (state === "denied") {
    return (
      <Page>
        {header}
        <Card padding="lg">
          <PlanRequired
            title="Running labs needs an active plan. Your session history is kept."
            plan="Practitioner"
            includes={["60 lab hours a month, fair use", "Sessions up to 4 hours, extendable to 8", "In-browser Kali and your own Kali over OpenVPN", "Debriefs and report drafts for every session"]}
            action={
              <ButtonLink to="/billing" variant="primary" iconLeft="refresh">
                Reactivate for $49 / month
              </ButtonLink>
            }
          />
        </Card>
        <SessionHistory rows={allSessions} loading={false} error={false} onRetry={() => undefined} runningId={null} />
      </Page>
    );
  }

  let panel: ReactNode;
  if (loading) panel = <PanelSkeleton />;
  else if (error)
    panel = (
      <Card>
        <ErrorState
          title="Session status did not load"
          onRetry={() => navigate("/labs", { replace: true })}
          reference="req_77e1c0"
          secondary={
            labActive ? (
              <ButtonLink to={`/lab/${activeSession.id}`} size="sm" variant="quiet">
                Open lab view
              </ButtonLink>
            ) : undefined
          }
        >
          We could not reach the session service. A running lab keeps running and its timer is unaffected.
        </ErrorState>
      </Card>
    );
  else if (labActive && phase === "ended") panel = <EndedPanel endedAt={endedAt} />;
  else if (labActive) panel = <ActivePanel endAt={endAt} now={now} onExtend={() => setExtendOpen(true)} onEnd={() => setEndOpen(true)} onDownload={onDownload} />;
  else panel = <NoSessionPanel fresh={fresh} />;

  return (
    <Page>
      {header}
      {loading ? <LoadingRegion label="Loading session">{panel}</LoadingRegion> : panel}

      <section className="lb-section" aria-labelledby="lb-conn-title">
        <div className="lb-sechead">
          <h2 id="lb-conn-title">Connection methods</h2>
          <span className="lb-sechead__meta">Default: {defaultMethod === "openvpn" ? "OpenVPN" : "In-browser terminal"}</span>
        </div>
        {loading ? (
          <ConnectionsSkeleton />
        ) : error ? (
          <Card>
            <ErrorState compact title="Connection details did not load" onRetry={() => navigate("/labs", { replace: true })}>
              Your downloaded config still works. The endpoint is <span className="rp-mono lb-nowrap">{openvpn.endpoint}</span>.
            </ErrorState>
          </Card>
        ) : (
          <div className="lb-conns">
            <ConnectionCard
              method="browser"
              isDefault={defaultMethod === "browser"}
              onMakeDefault={() => {
                setDefaultMethod("browser");
                toast.push({ title: "Default connection: In-browser terminal", detail: "Used for labs you launch from now on.", tone: "primary" });
              }}
              onOpenTerminal={() => navigate(`/lab/${activeSession.id}`)}
              sessionActive={sessionLive}
            />
            <ConnectionCard
              method="openvpn"
              isDefault={defaultMethod === "openvpn"}
              onMakeDefault={() => {
                setDefaultMethod("openvpn");
                toast.push({ title: "Default connection: OpenVPN", detail: "Used for labs you launch from now on.", tone: "primary" });
              }}
              endpoint={openvpn.endpoint}
              tunnelAddress={openvpn.tunnelAddress}
              test={sessionLive ? test : "untested"}
              onTest={onTest}
              sessionActive={sessionLive}
              lastSeen="4 s ago"
              troubleshootHref={`mailto:${supportEmail}?subject=${encodeURIComponent("Connection help")}`}
            />
          </div>
        )}
        <p className="rp-sr" role="status" aria-live="polite">
          {announce}
        </p>
      </section>

      <SessionHistory rows={historyRows} loading={loading} error={error} onRetry={() => navigate("/labs", { replace: true })} runningId={runningId} />

      {labActive && (
        <>
          <ExtendModal
            open={extendOpen}
            onClose={closeExtend}
            endAt={endAt}
            now={now}
            extendedMin={extendedMin}
            onConfirm={(m) => {
              setExtendedMin((x) => x + m);
              closeExtend();
              toast.push({ title: `Session extended by ${m} minutes`, detail: `Machines now destroyed at ${formatTime(new Date(endAt + m * MIN).toISOString())}.`, tone: "primary" });
            }}
          />
          <ConfirmDialog
            open={endOpen}
            onClose={() => phase !== "ending" && setEndOpen(false)}
            onConfirm={confirmEnd}
            destructive
            loading={phase === "ending"}
            title={`End ${activeSession.scenarioName} now`}
            confirmLabel="End session and destroy machines"
            cancelLabel="Keep running"
            requireText={activeSession.scenarioName}
          >
            <p>
              <span className="rp-strong">This cannot be undone.</span> <span className="rp-mono">{hostsSentence(activeSession.hosts)}</span> are destroyed immediately, along with anything you left on
              them.
            </p>
            <div className="lb-endkept">
              <span className="lb-endkept__title">Kept on your account</span>
              <span>
                {keptOnAccount.proofs} proofs, {keptOnAccount.notes} notes, the report draft and the debrief.
              </span>
            </div>
            <p>
              You are charged for <span className="rp-mono rp-num">{formatNumber(Math.round(((now - new Date(activeSession.startedAt).getTime()) / 3600000) * 10) / 10, 1)} h</span> used. A new session
              starts on fresh machines.
            </p>
          </ConfirmDialog>
        </>
      )}

      <ConfirmDialog
        open={regenOpen}
        onClose={() => setRegenOpen(false)}
        onConfirm={() => {
          setRegenOpen(false);
          setTest("untested");
          toast.push({
            title: "New OpenVPN profile issued",
            detail: "The old key is revoked. Download the new file before reconnecting.",
            tone: "primary",
            action: { label: "Download", onClick: onDownload },
          });
        }}
        title="Regenerate OpenVPN profile"
        confirmLabel="Regenerate and revoke old key"
      >
        <p>
          Your current <span className="rp-mono">{openvpn.fileName}</span> stops working immediately{sessionLive ? ", including the tunnel to the running session" : ""}. Your tunnel address stays{" "}
          <span className="rp-mono">{openvpn.tunnelAddress}</span>.
        </p>
      </ConfirmDialog>
    </Page>
  );
}
