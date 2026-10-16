import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Button,
  ButtonLink,
  Callout,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  HELP_LEVELS,
  Icon,
  KeyValue,
  KpiTile,
  LineChart,
  LoadingRegion,
  OnyxTranscript,
  Page,
  PageHeader,
  Section,
  SegmentedControl,
  Select,
  Skeleton,
  StatusDot,
  Textarea,
  Timeline,
  formatDate,
  formatDateTime,
  formatDelta,
  formatMoney,
  formatNumber,
  formatRelative,
  helpLabel,
  useToast,
} from "@rootpanther/ui";
import type { Column, Tone } from "@rootpanther/ui";
import {
  COST_PER_HOUR_BUDGET,
  GROUNDING_THRESHOLD,
  LATENCY_SLO_P95,
  ONYX_INCIDENT_DAYS_AGO,
  WALKTHROUGH_TARGET,
  dialDistribution,
  flaggedConversations,
  groundingHealth,
  groundingOverall,
  onyxDays,
  onyxKpis,
  scenarioSpend,
  streamFailureReasons,
  walkthroughByScenario,
  walkthroughRate,
  walkthroughWeekly,
} from "../../mock/onyx-ops";
import type { FlagAnnotation, FlagReason, FlagStatus, FlaggedConversation, GroundingRow } from "../../mock/onyx-ops";
import { operator } from "../../mock/operator";
import { minutesAgo } from "../../mock/time";
import { useDataState } from "../../review/review";
import "./onyx-ops.css";

type Range = "7" | "30";
type Mode = "default" | "loading" | "empty" | "error";

const REASON: Record<FlagReason, { label: string; tone: Tone }> = {
  safety: { label: "Safety", tone: "crit" },
  spoiler: { label: "Spoiler", tone: "med" },
  quality: { label: "Quality", tone: "info" },
};

const STATUS: Record<FlagStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "primary" },
  escalated: { label: "Escalated", tone: "high" },
  resolved: { label: "Resolved", tone: "success" },
  dismissed: { label: "Dismissed", tone: "neutral" },
};

const ACTION_STATUS: Record<FlagAnnotation["action"], FlagStatus> = {
  resolve: "resolved",
  escalate: "escalated",
  dismiss: "dismissed",
};

const dayLabel = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });
const usd = (n: number, d = 0) => formatMoney(n, "USD", d);
const pct = (n: number, d = 1) => `${n.toFixed(d)}%`;

function Share({ value, max = 100, tone, label }: { value: number; max?: number; tone?: string; label: string }) {
  return (
    <span className="oo-share">
      <span className="oo-share__track" aria-hidden="true">
        <span className="oo-share__fill" style={{ width: `${Math.max(0.8, (value / max) * 100)}%`, ...(tone ? { ["--fill" as string]: tone } : null) } as CSSProperties} />
      </span>
      <span className="oo-share__value rp-mono rp-num" aria-label={label}>
        {pct(value)}
      </span>
    </span>
  );
}

function ChartSkeleton({ height, bars }: { height: number; bars?: number }) {
  if (bars) {
    return (
      <div className="oo-chartsk" style={{ height }} aria-hidden="true">
        {Array.from({ length: bars }, (_, i) => (
          <Skeleton key={i} height={`${38 + ((i * 37) % 52)}%`} radius="sm" />
        ))}
      </div>
    );
  }
  return <Skeleton height={height} radius="md" />;
}

function UsageEmpty() {
  return (
    <Card>
      <EmptyState
        icon="chat"
        title="No Onyx usage in the last 30 days"
        action={
          <ButtonLink to="/system" size="sm" iconLeft="activity">
            Check Onyx gateway status
          </ButtonLink>
        }
      >
        Spend, latency and help-dial charts fill in once learners message Onyx. If learners are active, the gateway is not reporting usage.
      </EmptyState>
    </Card>
  );
}

function Kpis({ mode }: { mode: Mode }) {
  const loading = mode === "loading";
  const k = onyxKpis;
  const recent = onyxDays.slice(-14);
  const spark = {
    spend: recent.map((d) => d.primary + d.fast),
    cph: recent.map((d) => (d.primary + d.fast) / d.learnerHours),
    p50: recent.map((d) => d.p50),
    p95: recent.map((d) => d.p95),
    err: recent.map((d) => d.errorRate),
    fail: recent.map((d) => d.streamFailures),
  };
  if (mode === "empty") {
    return (
      <section aria-label="Onyx key metrics" className="oo-kpis">
        <KpiTile label="Token spend MTD" value="$0" secondary="No conversations" />
        <KpiTile label="Cost per learner hour" value="n/a" secondary="No learner hours" />
        <KpiTile label="Latency p50" value="n/a" secondary="No streams" />
        <KpiTile label="Latency p95" value="n/a" secondary={`SLO ${LATENCY_SLO_P95.toFixed(1)} s`} />
        <KpiTile label="Error rate 24h" value="n/a" secondary="No requests" />
        <KpiTile label="Stream failures 24h" value="0" secondary="No streams" />
      </section>
    );
  }
  return (
    <section aria-label="Onyx key metrics" className="oo-kpis">
      <KpiTile
        loading={loading}
        href="/finance"
        label="Token spend MTD"
        value={usd(k.spendMtd)}
        spark={spark.spend}
        delta={{ value: k.spendMtdDelta, good: "neutral", period: "vs last month" }}
      />
      <KpiTile
        loading={loading}
        label="Cost per learner hour"
        value={usd(k.costPerHour, 3)}
        spark={spark.cph}
        delta={{ value: k.costPerHourDelta, good: "down", period: "vs prior 7d" }}
      />
      <KpiTile loading={loading} label="Latency p50" value={k.p50.toFixed(2)} unit="s" spark={spark.p50} delta={{ value: k.p50Delta, good: "down", period: "vs 7d avg" }} />
      <KpiTile
        loading={loading}
        label={`Latency p95, SLO ${LATENCY_SLO_P95.toFixed(1)} s`}
        value={k.p95.toFixed(2)}
        unit="s"
        spark={spark.p95}
        delta={{ value: k.p95Delta, good: "down", period: "vs 7d avg" }}
      />
      <KpiTile
        loading={loading}
        label="Error rate 24h"
        value={k.errorRate.toFixed(2)}
        unit="%"
        spark={spark.err}
        delta={{ value: k.errorRateDelta, good: "down", period: "vs 7d avg" }}
      />
      <KpiTile
        loading={loading}
        label="Stream failures 24h"
        value={formatNumber(k.streamFailures24h)}
        unit={`/ ${formatNumber(k.streams24h)}`}
        spark={spark.fail}
        delta={{ value: ((k.streamFailures24h - k.streamFailuresPrior) / k.streamFailuresPrior) * 100, good: "down", period: "vs prior 24h" }}
      />
    </section>
  );
}

function SpendSection({ mode, range }: { mode: Mode; range: Range }) {
  const days = onyxDays.slice(-Number(range));
  const x = days.map((d) => dayLabel(d.date));
  const total = days.reduce((a, d) => a + d.primary + d.fast, 0);
  const hours = days.reduce((a, d) => a + d.learnerHours, 0);
  const fastShare = (days.reduce((a, d) => a + d.fast, 0) / (total || 1)) * 100;

  const rows = useMemo(() => {
    const base = scenarioSpend.reduce((a, s) => a + s.weight * s.costPerHour, 0);
    const k = total / (hours * (base / 100));
    const avgCph = total / hours;
    return scenarioSpend.map((s) => {
      const h = hours * (s.weight / 100);
      const cph = s.costPerHour * k;
      const spend = h * cph;
      return { ...s, hours: h, spend, share: (spend / total) * 100, cph, vsAvg: ((cph - avgCph) / avgCph) * 100 };
    });
  }, [total, hours]);
  const maxShare = Math.max(...rows.map((r) => r.share));

  const columns: Column<(typeof rows)[number]>[] = [
    {
      id: "name",
      header: "Scenario",
      cell: (r) => (
        <span className="oo-namecell">
          {r.kind === "No lab" ? (
            <span className="oo-cellname">{r.name}</span>
          ) : (
            <Link to={`/content?scenario=${r.slug}`} className="oo-cellname">
              {r.name}
            </Link>
          )}
          {r.note && <span className="oo-namecell__note">{r.note}</span>}
        </span>
      ),
      sortValue: (r) => r.name,
      minWidth: 200,
      hideable: false,
    },
    { id: "kind", header: "Type", cell: (r) => <span className="oo-kind">{r.kind}</span>, sortValue: (r) => r.kind, width: 104 },
    { id: "hours", header: "Learner hours", cell: (r) => formatNumber(r.hours), sortValue: (r) => r.hours, align: "right", mono: true, width: 132 },
    { id: "spend", header: "Spend", cell: (r) => usd(r.spend, 2), sortValue: (r) => r.spend, align: "right", mono: true, width: 112 },
    {
      id: "share",
      header: "Share of spend",
      cell: (r) => <Share value={r.share} max={maxShare} label={`${pct(r.share)} of spend`} />,
      sortValue: (r) => r.share,
      width: 200,
    },
    {
      id: "cph",
      header: "Cost per hour",
      cell: (r) => <span className={r.cph > COST_PER_HOUR_BUDGET ? "oo-unfav" : undefined}>{usd(r.cph, 3)}</span>,
      titleValue: (r) => (r.cph > COST_PER_HOUR_BUDGET ? `Over the ${usd(COST_PER_HOUR_BUDGET, 2)} budget` : `Within the ${usd(COST_PER_HOUR_BUDGET, 2)} budget`),
      sortValue: (r) => r.cph,
      align: "right",
      mono: true,
      width: 136,
    },
    { id: "vs", header: "vs avg", cell: (r) => formatDelta(r.vsAvg, 0), sortValue: (r) => r.vsAvg, align: "right", mono: true, width: 96 },
  ];

  const loading = mode === "loading";

  return (
    <Section
      title="Spend"
      meta={
        loading ? undefined : (
          <span className="rp-mono rp-num">
            {usd(total)} over {range} days
          </span>
        )
      }
    >
      <div className="oo-grid oo-grid--wide">
        <Card title="Token spend by day" meta={!loading ? <span className="rp-mono rp-num">Fast model {pct(fastShare)} of spend</span> : undefined}>
          {loading ? (
            <LoadingRegion label="Loading token spend">
              <ChartSkeleton height={240} bars={Number(range) > 7 ? 30 : 7} />
            </LoadingRegion>
          ) : (
            <BarChart
              stacked
              label={`Onyx token spend by day and model, last ${range} days, USD`}
              x={x}
              height={240}
              yFormat={(v) => usd(v)}
              series={[
                { id: "primary", label: "Primary model", values: days.map((d) => d.primary), tone: "chart-1" },
                { id: "fast", label: "Fast model", values: days.map((d) => d.fast), tone: "chart-3" },
              ]}
            />
          )}
        </Card>
        <Card title="Cost per active learner hour" meta={!loading ? <span className="rp-mono rp-num">{usd(total / hours, 3)} avg</span> : undefined}>
          {loading ? (
            <LoadingRegion label="Loading cost per learner hour">
              <ChartSkeleton height={240} />
            </LoadingRegion>
          ) : (
            <LineChart
              label={`Onyx cost per active learner hour, last ${range} days, USD`}
              x={x}
              height={240}
              yFormat={(v) => usd(v, 3)}
              threshold={{ value: COST_PER_HOUR_BUDGET, label: `Budget ${usd(COST_PER_HOUR_BUDGET, 2)}` }}
              series={[{ id: "cph", label: "Cost per learner hour", values: days.map((d) => (d.primary + d.fast) / d.learnerHours) }]}
            />
          )}
        </Card>
      </div>
      <Card
        title="Spend by scenario"
        padding="none"
        meta={
          !loading ? (
            <span className="rp-mono rp-num">
              {rows.filter((r) => r.cph > COST_PER_HOUR_BUDGET).length} of {rows.length} over {usd(COST_PER_HOUR_BUDGET, 2)} per hour
            </span>
          ) : undefined
        }
      >
        <DataTable
          caption={`Onyx spend by scenario, last ${range} days`}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.slug}
          defaultSort={{ id: "spend", dir: "desc" }}
          loading={loading}
          density="compact"
          columnControls={false}
          empty={<EmptyState compact icon="layers" title="No scenario spend in this range" />}
        />
      </Card>
    </Section>
  );
}

function ReliabilitySection({ mode, range }: { mode: Mode; range: Range }) {
  const days = onyxDays.slice(-Number(range));
  const x = days.map((d) => dayLabel(d.date));
  const loading = mode === "loading";
  const breaches = days.filter((d) => d.p95 > LATENCY_SLO_P95).length;
  const totalFailures = streamFailureReasons.reduce((a, r) => a + r.count, 0);
  const incidentInRange = Number(range) >= ONYX_INCIDENT_DAYS_AGO;
  const incidentDay = onyxDays[onyxDays.length - ONYX_INCIDENT_DAYS_AGO];

  return (
    <Section title="Reliability">
      <div className="oo-grid oo-grid--wide">
        <Card
          title="Latency percentiles"
          meta={
            !loading ? (
              <span className="rp-mono rp-num">
                {breaches} {breaches === 1 ? "day" : "days"} over p95 SLO
              </span>
            ) : undefined
          }
          footer={
            !loading && incidentInRange ? (
              <span className="oo-note">
                <Icon name="warning" size={13} />
                <span>
                  {dayLabel(incidentDay.date)}:{" "}
                  <Link to="/system#incidents" className="rp-mono">
                    INC-0139
                  </Link>
                  , upstream capacity on the primary model, 41 min.
                </span>
              </span>
            ) : undefined
          }
        >
          {loading ? (
            <LoadingRegion label="Loading latency">
              <ChartSkeleton height={260} />
            </LoadingRegion>
          ) : (
            <div className="oo-latency">
              <LineChart
                label={`Onyx time to first token percentiles, last ${range} days, seconds`}
                x={x}
                height={260}
                yFormat={(v) => `${v.toFixed(1)} s`}
                threshold={{ value: LATENCY_SLO_P95, label: `p95 SLO ${LATENCY_SLO_P95.toFixed(1)} s` }}
                series={[
                  { id: "p50", label: "p50", values: days.map((d) => d.p50), tone: "chart-3" },
                  { id: "p95", label: "p95", values: days.map((d) => d.p95), tone: "chart-1" },
                  { id: "p99", label: "p99", values: days.map((d) => d.p99), tone: "chart-2", dashed: true },
                ]}
              />
            </div>
          )}
        </Card>
        <Card title="Errors and stream failures">
          {loading ? (
            <LoadingRegion label="Loading errors">
              <ChartSkeleton height={120} />
              <div className="oo-reasons" style={{ marginTop: 20 }}>
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} height={12} width={`${88 - i * 10}%`} />
                ))}
              </div>
            </LoadingRegion>
          ) : (
            <div className="oo-errors">
              <LineChart
                label={`Onyx request error rate, last ${range} days, percent`}
                x={x}
                height={128}
                yMax={2}
                yFormat={(v) => `${v.toFixed(1)}%`}
                threshold={{ value: 1, label: "Alert 1.0%" }}
                series={[{ id: "err", label: "Error rate", values: days.map((d) => d.errorRate), tone: "chart-1" }]}
              />
              <div className="oo-reasons">
                <div className="oo-reasons__head">
                  <span className="rp-eyebrow">Stream failures, 24h</span>
                  <span className="rp-mono rp-num rp-strong">{totalFailures}</span>
                </div>
                <ul aria-label="Stream failures in the last 24 hours by cause">
                  {streamFailureReasons.map((r) => (
                    <li key={r.id}>
                      <span className="oo-reasons__label">{r.label}</span>
                      <span className="oo-reasons__bar" aria-hidden="true">
                        <span style={{ width: `${(r.count / totalFailures) * 100}%` }} />
                      </span>
                      <span className="rp-mono rp-num">{r.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Section>
  );
}

function HelpDialSection({ mode }: { mode: Mode }) {
  const loading = mode === "loading";
  const maxShare = Math.max(...dialDistribution.map((d) => d.share));
  const wr = walkthroughRate;
  const over = wr.current > WALKTHROUGH_TARGET;
  const totalHours = dialDistribution.reduce((a, d) => a + d.hours, 0);

  return (
    <Section title="Help dial" meta="Share of learner hours at each level, last 30 days">
      <Card padding="none" className="oo-dial">
        {loading ? (
          <LoadingRegion label="Loading help dial distribution">
            <div className="oo-dial__body">
              <div className="oo-dist">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} height={14} width={`${92 - i * 6}%`} />
                ))}
              </div>
              <div className="oo-walk">
                <Skeleton width={140} height={10} />
                <Skeleton width={110} height={28} />
                <Skeleton height={120} radius="md" />
              </div>
            </div>
          </LoadingRegion>
        ) : (
          <div className="oo-dial__body">
            <div className="oo-dist">
              <table className="oo-dist__table">
                <caption className="rp-sr">Help dial distribution by learner hours, last 30 days, with change against the previous 30 days</caption>
                <thead>
                  <tr>
                    <th scope="col">Level</th>
                    <th scope="col">
                      <span className="rp-sr">Distribution</span>
                    </th>
                    <th scope="col" className="is-right">
                      Share
                    </th>
                    <th scope="col" className="is-right">
                      vs prior
                    </th>
                    <th scope="col" className="is-right">
                      Hours
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {HELP_LEVELS.map((l, i) => {
                    const d = dialDistribution.find((x) => x.level === l.id)!;
                    const delta = d.share - d.prior;
                    const walk = l.id === "walkthrough";
                    return (
                      <tr key={l.id} className={walk ? "is-walk" : undefined}>
                        <th scope="row">
                          <span className="oo-dist__level">
                            <span className="oo-dist__bars" aria-hidden="true">
                              {Array.from({ length: 6 }, (_, b) => (
                                <span key={b} className={b <= i ? "is-lit" : undefined} />
                              ))}
                            </span>
                            {l.label}
                            {walk && <Icon name="lock" size={11} className="oo-dist__lock" />}
                          </span>
                        </th>
                        <td className="oo-dist__barcell">
                          <span className="oo-dist__track" aria-hidden="true">
                            <span className="oo-dist__fill" style={{ width: `${(d.share / maxShare) * 100}%` }} />
                          </span>
                        </td>
                        <td className="is-right rp-mono rp-num rp-strong">{pct(d.share)}</td>
                        <td className={`is-right rp-mono rp-num${walk && delta > 0 ? " oo-unfav" : ""}`}>{formatDelta(delta, 1, " pp")}</td>
                        <td className="is-right rp-mono rp-num">{formatNumber(d.hours)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td />
                    <td className="is-right rp-mono rp-num">100.0%</td>
                    <td />
                    <td className="is-right rp-mono rp-num">{formatNumber(totalHours)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="oo-walk">
              <div className="oo-walk__head">
                <span className="rp-eyebrow">Walkthrough escalation rate</span>
                <span className="oo-walk__target rp-mono rp-num">Target {pct(WALKTHROUGH_TARGET)}</span>
              </div>
              <div className="oo-walk__figure">
                <span className="oo-walk__value rp-mono">{pct(wr.current)}</span>
                <span className={`oo-walk__delta rp-mono rp-num${over ? " oo-unfav" : ""}`}>
                  <Icon name="arrow-up" size={11} strokeWidth={2.25} />
                  {formatDelta(wr.current - wr.prior, 1, " pp")}
                  <span className="oo-walk__period">vs prior 4 weeks</span>
                </span>
              </div>
              <p className="oo-walk__def">
                Sessions that escalated to Walkthrough at least once, 4-week average. <span className="rp-mono rp-num">{formatNumber(wr.escalated30)}</span> of{" "}
                <span className="rp-mono rp-num">{formatNumber(wr.sessions30)}</span> sessions.
              </p>
              <LineChart
                label="Weekly Walkthrough escalation rate, last 12 weeks, percent of sessions"
                x={walkthroughWeekly.map((w) => dayLabel(w.week))}
                height={132}
                yMax={10}
                yFormat={(v) => `${v.toFixed(1)}%`}
                threshold={{ value: WALKTHROUGH_TARGET, label: `Target ${pct(WALKTHROUGH_TARGET)}` }}
                series={[{ id: "walk", label: "Escalation rate", values: walkthroughWeekly.map((w) => w.rate), tone: "chart-1" }]}
              />
              <div className="oo-walk__drivers">
                <span className="rp-eyebrow">Highest escalation</span>
                <ul>
                  {walkthroughByScenario.map((s) => (
                    <li key={s.slug}>
                      <Link to={`/content?scenario=${s.slug}`}>{s.name}</Link>
                      <span className="rp-mono rp-num oo-walk__rate">{pct(s.rate)}</span>
                      <span className="rp-mono rp-num">{formatNumber(s.sessions)} sessions</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </Card>
    </Section>
  );
}

interface Flag extends FlaggedConversation {}

function FlagDrawer({ flag, onClose, onAct }: { flag: Flag | null; onClose: () => void; onAct: (f: Flag, action: FlagAnnotation["action"], text: string) => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function act(action: FlagAnnotation["action"]) {
    if (!flag) return;
    if (!note.trim()) {
      setError(`Add a note before you ${action}. It is kept with the flag and written to the audit log.`);
      return;
    }
    onAct(flag, action, note.trim());
    setNote("");
    setError(null);
  }

  function close() {
    setNote("");
    setError(null);
    onClose();
  }

  if (!flag) return null;
  const reason = REASON[flag.reason];
  const status = STATUS[flag.status];
  const closed = flag.status === "resolved" || flag.status === "dismissed";

  return (
    <Drawer
      open
      onClose={close}
      width={640}
      title={`${reason.label} flag, ${flag.scenario.name}`}
      meta={
        <span className="oo-drawer__meta">
          <span className="rp-mono">{flag.id}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={flag.at}>{formatDateTime(flag.at)}</time>
        </span>
      }
      footer={
        <div className="oo-drawer__foot">
          <Button variant="quiet" onClick={() => act("dismiss")}>
            Dismiss
          </Button>
          <Button variant="secondary" iconLeft="arrow-up-right" onClick={() => act("escalate")}>
            Escalate
          </Button>
          <Button variant="primary" iconLeft="check" onClick={() => act("resolve")}>
            {closed ? "Resolve again" : "Resolve"}
          </Button>
        </div>
      }
    >
      <div className="oo-drawer">
        <KeyValue
          columns={3}
          items={[
            { label: "Status", value: <StatusDot tone={status.tone} label={status.label} size="sm" /> },
            { label: "Reason", value: <StatusDot tone={reason.tone} label={reason.label} size="sm" /> },
            { label: "Flagged by", value: flag.flaggedBy === "auto" ? "Auto detector" : "Learner" },
            {
              label: "Learner",
              value: (
                <Link to={`/users/${flag.learnerId}`} className="rp-mono">
                  {flag.learner}
                </Link>
              ),
            },
            { label: "Session", value: flag.sessionId, mono: true },
            { label: "Help level", value: helpLabel(flag.level) },
          ]}
        />
        <Callout tone={reason.tone} icon="flag">
          {flag.summary}
        </Callout>
        <section className="oo-drawer__section" aria-labelledby="oo-transcript-h">
          <div className="oo-drawer__sechead">
            <h3 id="oo-transcript-h">Transcript</h3>
            <span className="rp-mono rp-num">{flag.messages.filter((m) => m.role !== "system").length} messages</span>
          </div>
          <div className="oo-transcript">
            <OnyxTranscript messages={flag.messages} label={`Transcript for ${flag.id}`} />
          </div>
        </section>
        {flag.annotations.length > 0 && (
          <section className="oo-drawer__section" aria-labelledby="oo-history-h">
            <div className="oo-drawer__sechead">
              <h3 id="oo-history-h">Review history</h3>
            </div>
            <Timeline
              dense
              label="Review history"
              absoluteTime={formatDateTime}
              items={flag.annotations.map((a) => ({
                id: a.id,
                at: a.at,
                tone: STATUS[ACTION_STATUS[a.action]].tone,
                icon: a.action === "resolve" ? "check" : a.action === "escalate" ? "arrow-up-right" : "x",
                title: (
                  <>
                    {STATUS[ACTION_STATUS[a.action]].label} by <span className="rp-mono">{a.by}</span>
                  </>
                ),
                detail: a.text,
              }))}
            />
          </section>
        )}
        <Textarea
          label="Annotation"
          hint="Kept with this flag and written to the audit log."
          placeholder="What you found and what should change"
          value={note}
          error={error ?? undefined}
          rows={3}
          onChange={(e) => {
            setNote(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>
    </Drawer>
  );
}

function FlaggedSection({ mode }: { mode: Mode | "flag-error" }) {
  const toast = useToast();
  const [flags, setFlags] = useState<Flag[]>(flaggedConversations);
  const [status, setStatus] = useState<"open" | "escalated" | "closed" | "all">("open");
  const [reason, setReason] = useState<"" | FlagReason>("");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = {
    open: flags.filter((f) => f.status === "open").length,
    escalated: flags.filter((f) => f.status === "escalated").length,
    closed: flags.filter((f) => f.status === "resolved" || f.status === "dismissed").length,
  };

  const shown = flags.filter((f) => {
    if (reason && f.reason !== reason) return false;
    if (status === "all") return true;
    if (status === "closed") return f.status === "resolved" || f.status === "dismissed";
    return f.status === status;
  });

  function onAct(f: Flag, action: FlagAnnotation["action"], text: string) {
    const next = ACTION_STATUS[action];
    setFlags((xs) =>
      xs.map((x) =>
        x.id === f.id ? { ...x, status: next, annotations: [...x.annotations, { id: `a${x.annotations.length + 1}`, by: operator.email, at: minutesAgo(0), action, text }] } : x,
      ),
    );
    setOpenId(null);
    toast.push({
      title: `${f.id} ${STATUS[next].label.toLowerCase()}`,
      detail: action === "escalate" ? "Sent to the content queue with your note." : "Your note was saved to the audit log.",
      tone: next === "resolved" ? "success" : "neutral",
    });
  }

  const columns: Column<Flag>[] = [
    {
      id: "id",
      header: "Conversation",
      cell: (f) => (
        <button type="button" className="oo-flagbtn" onClick={() => setOpenId(f.id)}>
          <span className="rp-mono">{f.id}</span>
          <span className="oo-flagbtn__summary">{f.summary}</span>
        </button>
      ),
      titleValue: (f) => f.summary,
      minWidth: 240,
      hideable: false,
    },
    {
      id: "reason",
      header: "Reason",
      cell: (f) => (
        <span className="oo-stack">
          <StatusDot tone={REASON[f.reason].tone} label={REASON[f.reason].label} size="sm" />
          <span className="oo-stack__sub">{f.flaggedBy === "auto" ? "Auto flag" : "Learner report"}</span>
        </span>
      ),
      sortValue: (f) => f.reason,
      width: 120,
    },
    {
      id: "scenario",
      header: "Scenario",
      cell: (f) => (
        <span className="oo-stack">
          <Link to={`/content?scenario=${f.scenario.slug}`}>{f.scenario.name}</Link>
          <span className="oo-stack__sub">at {helpLabel(f.level)}</span>
        </span>
      ),
      sortValue: (f) => f.scenario.name,
      width: 112,
    },
    {
      id: "learner",
      header: "Learner",
      cell: (f) => (
        <Link to={`/users/${f.learnerId}`} className="rp-mono oo-email">
          {f.learner}
        </Link>
      ),
      titleValue: (f) => f.learner,
      truncate: true,
      sortValue: (f) => f.learner,
      width: 208,
    },
    {
      id: "at",
      header: "Age",
      cell: (f) => (
        <time dateTime={f.at} title={formatDateTime(f.at)}>
          {formatRelative(f.at)}
        </time>
      ),
      sortValue: (f) => new Date(f.at).getTime(),
      mono: true,
      align: "right",
      width: 88,
    },
    { id: "status", header: "Status", cell: (f) => <StatusDot tone={STATUS[f.status].tone} label={STATUS[f.status].label} size="sm" />, sortValue: (f) => f.status, width: 112 },
  ];

  const loading = mode === "loading";
  const failed = mode === "error";
  const empty = mode === "empty";
  const live = !loading && !failed && !empty;
  const filtered = !!reason || status !== "all";

  return (
    <Section
      title="Flagged conversations"
      meta={
        !loading && !failed && !empty ? (
          <span className="rp-mono rp-num">
            {counts.open} open, {counts.escalated} escalated
          </span>
        ) : undefined
      }
    >
      <DataTable
        caption="Flagged Onyx conversations"
        columns={columns}
        rows={empty || loading ? [] : shown}
        rowKey={(f) => f.id}
        defaultSort={{ id: "at", dir: "desc" }}
        onRowClick={(f) => setOpenId(f.id)}
        loading={loading}
        density="compact"
        columnControls={false}
        pageSize={8}
        error={
          failed
            ? {
                title: "Flagged conversations did not load",
                detail: "The review queue service returned 503. New flags are still being recorded.",
                onRetry: () => window.location.reload(),
              }
            : null
        }
        toolbar={
          <>
            <SegmentedControl
              size="sm"
              label="Flag status"
              value={status}
              onChange={setStatus}
              options={[
                {
                  value: "open",
                  label: <>Open {live && <span className="oo-segcount rp-mono rp-num">{counts.open}</span>}</>,
                },
                {
                  value: "escalated",
                  label: <>Escalated {live && <span className="oo-segcount rp-mono rp-num">{counts.escalated}</span>}</>,
                },
                {
                  value: "closed",
                  label: <>Closed {live && <span className="oo-segcount rp-mono rp-num">{counts.closed}</span>}</>,
                },
                { value: "all", label: "All" },
              ]}
            />
            <Select
              selectSize="sm"
              aria-label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as "" | FlagReason)}
              options={[
                { value: "", label: "All reasons" },
                { value: "safety", label: "Safety" },
                { value: "quality", label: "Quality" },
                { value: "spoiler", label: "Spoiler" },
              ]}
            />
          </>
        }
        empty={
          empty ? (
            <EmptyState compact icon="flag" title="No flagged conversations in the last 30 days">
              Auto flags and learner reports appear here for review.
            </EmptyState>
          ) : (
            <EmptyState
              compact
              icon="check-circle"
              title={status === "open" && !reason ? "No open flags" : "No flags match these filters"}
              action={
                filtered ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setStatus("all");
                      setReason("");
                    }}
                  >
                    Show all flags
                  </Button>
                ) : undefined
              }
            />
          )
        }
      />
      <FlagDrawer flag={flags.find((f) => f.id === openId) ?? null} onClose={() => setOpenId(null)} onAct={onAct} />
    </Section>
  );
}

function GroundingSection({ mode }: { mode: Mode }) {
  const rows = groundingHealth.map((r) => ({ ...r, rate: (r.ungrounded / r.answers) * 100 }));
  const maxRate = Math.max(...rows.map((r) => r.rate));
  const loading = mode === "loading";
  const failed = mode === "error";
  const empty = mode === "empty";

  const rateTone = (rate: number) => (rate >= GROUNDING_THRESHOLD * 2 ? "var(--crit)" : rate >= GROUNDING_THRESHOLD ? "var(--med)" : "var(--chart-2)");

  const columns: Column<GroundingRow & { rate: number }>[] = [
    {
      id: "name",
      header: "Scenario",
      cell: (r) => (
        <Link to={`/content?scenario=${r.slug}`} className="oo-cellname">
          {r.name}
        </Link>
      ),
      sortValue: (r) => r.name,
      width: 120,
      hideable: false,
    },
    { id: "phase", header: "Last ungrounded phase", cell: (r) => r.phase, truncate: true, sortValue: (r) => r.phase, minWidth: 200 },
    { id: "ungrounded", header: "Ungrounded", cell: (r) => formatNumber(r.ungrounded), sortValue: (r) => r.ungrounded, align: "right", mono: true, width: 128 },
    { id: "answers", header: "Answers", cell: (r) => formatNumber(r.answers), sortValue: (r) => r.answers, align: "right", mono: true, width: 108 },
    {
      id: "rate",
      header: "Rate",
      cell: (r) => <Share value={r.rate} max={maxRate} tone={rateTone(r.rate)} label={`${pct(r.rate, 2)} ungrounded`} />,
      sortValue: (r) => r.rate,
      width: 164,
    },
    {
      id: "last",
      header: "Last seen",
      cell: (r) => (
        <time dateTime={r.lastAt} title={formatDateTime(r.lastAt)}>
          {formatRelative(r.lastAt)}
        </time>
      ),
      sortValue: (r) => new Date(r.lastAt).getTime(),
      mono: true,
      align: "right",
      width: 112,
    },
    {
      id: "go",
      header: <span className="rp-sr">Open in Content</span>,
      headerLabel: "Open in Content",
      cell: (r) => (
        <Link to={`/content?scenario=${r.slug}`} className="oo-go" aria-label={`Open ${r.name} grounding in Content`}>
          Content
          <Icon name="arrow-right" size={13} />
        </Link>
      ),
      align: "right",
      width: 96,
    },
  ];

  return (
    <Section
      title="Grounding health"
      meta={
        !loading && !failed && !empty ? (
          <span className="rp-mono rp-num">
            {formatNumber(groundingOverall.ungrounded)} of {formatNumber(groundingOverall.answers)} answers ungrounded, {pct(groundingOverall.rate, 2)}
          </span>
        ) : undefined
      }
    >
      <Card padding="none">
        <DataTable
          caption="Scenarios where Onyx answered without grounding, last 30 days"
          columns={columns}
          rows={empty ? [] : rows}
          rowKey={(r) => r.slug}
          defaultSort={{ id: "rate", dir: "desc" }}
          loading={loading}
          density="compact"
          columnControls={false}
          rowClassName={(r) => (r.rate >= GROUNDING_THRESHOLD ? "oo-row-flag" : undefined)}
          error={
            failed
              ? {
                  title: "Grounding report did not load",
                  detail: "The nightly grounding job has not finished. Last complete run: 03:10 UTC yesterday.",
                  onRetry: () => window.location.reload(),
                }
              : null
          }
          footerNote={
            !failed && !loading && !empty ? (
              <span>
                Rows at or above <span className="rp-mono rp-num">{pct(GROUNDING_THRESHOLD)}</span> need hint ladders or phase notes added in Content.
              </span>
            ) : undefined
          }
          empty={
            <EmptyState compact icon="shield-check" title="No ungrounded answers in the last 30 days">
              Scenarios appear here when Onyx answers without scenario notes or a hint ladder.
            </EmptyState>
          }
        />
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
        title="Onyx Ops requires the Onyx reviewer or Owner role"
        action={
          <Button size="sm" iconLeft="mail" onClick={() => toast.push({ title: "Access request sent", detail: "priya@rootpanther.com will be asked to grant Onyx reviewer." })}>
            Request access
          </Button>
        }
      >
        This page shows learner conversations and model spend. Your role does not include it. Access requests go to the workspace owner and are written to the audit log.
      </EmptyState>
    </Card>
  );
}

function MetricsError() {
  return (
    <Card>
      <ErrorState title="Onyx metrics did not load" onRetry={() => window.location.reload()} reference="req_4c71e0">
        The metrics warehouse timed out after 30 s. Onyx is still serving learners; only this report is affected.
      </ErrorState>
    </Card>
  );
}

export default function OnyxOpsPage() {
  const state = useDataState();
  const [range, setRange] = useState<Range>("30");

  const header = (
    <PageHeader
      title="Onyx Ops"
      meta={
        state === "denied" ? undefined : (
          <>
            <span>
              Gateway <span className="rp-mono">v2.14.1</span>
            </span>
            <span>
              Updated <span className="rp-mono rp-num">{state === "loading" ? "now" : "2m ago"}</span>
            </span>
          </>
        )
      }
      actions={
        state === "denied" || state === "error" ? undefined : (
          <SegmentedControl
            size="sm"
            label="Chart range"
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: "7d" },
              { value: "30", label: "30d" },
            ]}
          />
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
  let top: ReactNode = (
    <>
      <Kpis mode={mode} />
      <SpendSection mode={mode} range={range} />
      <ReliabilitySection mode={mode} range={range} />
      <HelpDialSection mode={mode} />
    </>
  );
  if (state === "error") top = <MetricsError />;
  if (state === "empty")
    top = (
      <>
        <Kpis mode={mode} />
        <UsageEmpty />
      </>
    );

  return (
    <Page width="full" className="oo-page">
      {header}
      {top}
      <FlaggedSection mode={mode} />
      <GroundingSection mode={mode} />
    </Page>
  );
}
