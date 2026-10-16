import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  ActivityFeed,
  BarChart,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  Heatmap,
  Icon,
  IconButton,
  KpiTile,
  LoadingRegion,
  Page,
  PageHeader,
  SegmentedControl,
  Skeleton,
  StatusDot,
  cx,
  formatMoney,
  formatNumber,
  formatRelative,
  useInterval,
} from "@rootpanther/ui";
import type { RefObject } from "react";
import type { ActivityItem, ChartTone } from "@rootpanther/ui";
import { MTD_COMPARE, RANGES, SEVERITY, alerts as buildAlerts, cohorts, feedGenerator, funnel, initialFeed, kpis, retentionAt, revenue } from "../../mock/overview";
import type { Kpis, RangeId, RevenueRange } from "../../mock/overview";
import { useDataState } from "../../review/review";
import "./overview.css";

const usd = (n: number) => formatMoney(Math.round(n), "USD", 0);
const int = (n: number) => formatNumber(Math.round(n));
const pct = (n: number) => `${n.toFixed(1)}%`;
const usdK = (v: number) => (v === 0 ? "$0" : `$${formatNumber(v / 1000)}k`);

interface SubRow {
  label: string;
  value: string;
  warn?: string;
}

interface TileDef {
  id: string;
  label: string;
  href: string;
  value: string;
  unit?: string;
  delta: { value: number; unit?: string; good: "up" | "down" | "neutral"; period: string };
  spark: number[];
  rows: [SubRow, SubRow];
}

function buildTiles(k: Kpis, rangeLong: string): TileDef[] {
  const d = k.deltas;
  const s = k.sparks;
  const vs = `vs previous ${rangeLong}`;
  const budget = 28000;
  return [
    {
      id: "mrr",
      label: "MRR",
      href: "/billing",
      value: usd(k.mrr),
      delta: { value: d.mrr, good: "up", period: vs },
      spark: s.mrr,
      rows: [
        { label: "ARR", value: usd(k.arr) },
        { label: "ARPU", value: formatMoney(k.mrr / k.subs, "USD", 2) },
      ],
    },
    {
      id: "subs",
      label: "Active subscriptions",
      href: "/billing",
      value: int(k.subs),
      delta: { value: d.subs, good: "up", period: vs },
      spark: s.subs,
      rows: [
        { label: "Trials active", value: int(k.trials) },
        { label: "Trial to paid", value: pct(k.conversion) },
      ],
    },
    {
      id: "nrr",
      label: "Net revenue retention",
      href: "/billing",
      value: pct(k.nrr),
      delta: { value: d.nrr, unit: "pp", good: "up", period: vs },
      spark: s.nrr,
      rows: [
        { label: "Logo churn", value: pct(k.logoChurn) },
        { label: "Revenue churn", value: pct(k.revenueChurn) },
      ],
    },
    {
      id: "signups",
      label: "New signups",
      href: "/users?status=trial",
      value: int(k.signups),
      delta: { value: d.signups, good: "up", period: vs },
      spark: s.signups,
      rows: [
        { label: "Today", value: int(k.signupsToday) },
        { label: "7d/30d", value: `${int(k.signups7d)}/${int(k.signups30d)}` },
      ],
    },
    {
      id: "dau",
      label: "Daily active users",
      href: "/users",
      value: int(k.dau),
      delta: { value: d.dau, good: "up", period: vs },
      spark: s.dau,
      rows: [
        { label: "WAU/MAU", value: `${int(k.wau)}/${int(k.mau)}` },
        { label: "Stickiness", value: pct(k.stickiness) },
      ],
    },
    {
      id: "labs",
      label: "Concurrent labs",
      href: "/fleet",
      value: int(k.concurrent),
      delta: { value: d.concurrent, good: "neutral", period: vs },
      spark: s.concurrent,
      rows: [
        { label: "Peak today", value: int(k.peakToday) },
        { label: "Provisioning", value: "11" },
      ],
    },
    {
      id: "hours",
      label: "Lab hours, MTD",
      href: "/fleet",
      value: int(k.labHoursMonth),
      unit: "h",
      delta: { value: d.labHours, good: "neutral", period: MTD_COMPARE },
      spark: s.labHours,
      rows: [
        { label: "Today", value: `${int(k.labHoursToday)} h` },
        { label: "Per MAU", value: `${(k.labHoursMonth / k.mau).toFixed(1)} h` },
      ],
    },
    {
      id: "azure",
      label: "Azure spend, MTD",
      href: "/finance",
      value: usd(k.azureMtd),
      delta: { value: d.azure, good: "down", period: MTD_COMPARE },
      spark: s.azure,
      rows: [
        { label: "Projected", value: usd(k.azureProjected), warn: k.azureProjected > budget ? "over budget" : undefined },
        { label: "Budget", value: usd(budget) },
      ],
    },
    {
      id: "margin",
      label: "Gross margin",
      href: "/finance",
      value: pct(k.grossMargin),
      delta: { value: d.margin, unit: "pp", good: "up", period: MTD_COMPARE },
      spark: s.margin,
      rows: [
        { label: "Cost per MAU", value: formatMoney(k.costPerUser, "USD", 2) },
        { label: "Revenue MTD", value: usd(k.revenueMtd) },
      ],
    },
    {
      id: "onyx",
      label: "Onyx spend, MTD",
      href: "/onyx",
      value: usd(k.onyxMtd),
      delta: { value: d.onyx, good: "neutral", period: MTD_COMPARE },
      spark: s.onyx,
      rows: [
        { label: "Tokens", value: `${(k.onyxTokensMtd / 1e6).toFixed(1)}M` },
        { label: "Per lab hour", value: formatMoney(k.onyxMtd / k.labHoursMonth, "USD", 3) },
      ],
    },
    {
      id: "failed",
      label: "Failed payments",
      href: "/billing#dunning",
      value: int(k.failed),
      delta: { value: d.failed, good: "down", period: vs },
      spark: s.failed,
      rows: [
        { label: "In dunning", value: int(k.dunning) },
        { label: "MRR at risk", value: usd(k.mrrAtRisk) },
      ],
    },
    {
      id: "tickets",
      label: "Support tickets open",
      href: "/users",
      value: int(k.ticketsOpen),
      delta: { value: d.tickets, good: "down", period: vs },
      spark: s.tickets,
      rows: [
        { label: "Older than 24h", value: int(k.ticketsStale) },
        { label: "First reply", value: "1h 52m" },
      ],
    },
  ];
}

function Sub({ row }: { row: SubRow }) {
  return (
    <span className="ov-sub">
      <span className="ov-sub__label">{row.label}</span>
      <span className={cx("ov-sub__value rp-mono rp-num", row.warn && "is-warn")}>
        {row.warn && <Icon name="warning" size={11} />}
        {row.value}
        {row.warn && <span className="rp-sr">, {row.warn}</span>}
      </span>
    </span>
  );
}

function TileSkeleton() {
  return (
    <div className="rp-kpi ov-kpi is-skeleton" aria-hidden="true">
      <Skeleton width="58%" height={10} className="ov-sk-label" />
      <Skeleton width="64%" height={22} className="ov-sk-value" />
      <Skeleton width={52} height={10} className="ov-sk-delta" />
      <Skeleton width={72} height={22} className="ov-sk-spark" />
      <span className="ov-sk-rows">
        <Skeleton width="100%" height={9} />
        <Skeleton width="100%" height={9} />
      </span>
    </div>
  );
}

function KpiGrid({ k, rangeLong, loading }: { k: Kpis; rangeLong: string; loading: boolean }) {
  const tiles = useMemo(() => buildTiles(k, rangeLong), [k, rangeLong]);
  if (loading) {
    return (
      <LoadingRegion label="Loading metrics">
        <div className="ov-kpis">
          {tiles.map((t) => (
            <TileSkeleton key={t.id} />
          ))}
        </div>
      </LoadingRegion>
    );
  }
  return (
    <section className="ov-kpis" aria-label="Key metrics">
      {tiles.map((t) => (
        <KpiTile
          key={t.id}
          className="ov-kpi"
          label={t.label}
          href={t.href}
          value={t.value}
          unit={t.unit}
          delta={t.delta}
          spark={t.spark}
          secondary={
            <>
              <Sub row={t.rows[0]} />
              <Sub row={t.rows[1]} />
            </>
          }
        />
      ))}
    </section>
  );
}

function useHeight<T extends HTMLElement>(fallback: number): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [h, setH] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setH(Math.max(fallback, Math.floor(e[0].contentRect.height))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, h];
}

const PLAN_SERIES: { id: "monthly" | "annual" | "team"; label: string; tone: ChartTone }[] = [
  { id: "monthly", label: "Practitioner monthly", tone: "chart-1" },
  { id: "annual", label: "Practitioner annual", tone: "chart-2" },
  { id: "team", label: "Team", tone: "chart-3" },
];

function RevenueCard({ loading, empty }: { loading: boolean; empty: boolean }) {
  const [range, setRange] = useState<RevenueRange>("12m");
  const [plotRef, plotH] = useHeight<HTMLDivElement>(244);
  const data = useMemo(() => revenue(range), [range]);
  const last = data.x.length - 1;
  const total = data.monthly[last] + data.annual[last] + data.team[last];
  const first = data.monthly[0] + data.annual[0] + data.team[0];
  let body;
  if (loading) {
    body = (
      <LoadingRegion label="Loading revenue">
        <div className="ov-rev__legend">
          {PLAN_SERIES.map((p) => (
            <Skeleton key={p.id} width={150} height={10} />
          ))}
        </div>
        <div className="ov-barsk" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} height={`${38 + i * 4.6}%`} radius="sm" />
          ))}
        </div>
      </LoadingRegion>
    );
  } else if (empty) {
    body = (
      <EmptyState
        compact
        icon="money"
        title="No MRR recorded"
        action={
          <ButtonLink to="/billing" size="sm">
            Open billing
          </ButtonLink>
        }
      >
        Revenue appears after the first paid Stripe invoice.
      </EmptyState>
    );
  } else {
    body = (
      <>
        <ul className="ov-rev__legend" aria-label="MRR by plan, latest">
          {PLAN_SERIES.map((p) => {
            const v = data[p.id][last];
            return (
              <li key={p.id}>
                <span className="rp-legend__swatch" style={{ ["--c" as string]: `var(--${p.tone})` }} />
                <span>{p.label}</span>
                <span className="rp-mono rp-num ov-rev__v">{usd(v)}</span>
                <span className="rp-mono rp-num ov-rev__share">{Math.round((v / total) * 100)}%</span>
              </li>
            );
          })}
        </ul>
        <div ref={plotRef} className="ov-rev__plot">
          <div className="ov-rev__fill">
            <BarChart
              stacked
              legend={false}
              height={plotH}
              label={`MRR by plan, ${range === "90d" ? "weekly for 90 days" : `monthly for ${range === "12m" ? "12" : "24"} months`}`}
              x={data.x}
              yFormat={usdK}
              series={PLAN_SERIES.map((p) => ({ id: p.id, label: p.label, tone: p.tone, values: data[p.id] }))}
            />
          </div>
        </div>
      </>
    );
  }
  return (
    <Card
      className="ov-span-8 ov-rev"
      title="MRR by plan"
      meta={
        !loading && !empty ? (
          <span className="ov-meta-figs">
            <span className="rp-mono rp-num rp-strong">{usd(total)}</span>
            <span className="rp-mono rp-num">
              {total >= first ? "+" : "−"}
              {usd(Math.abs(total - first))} in {range}
            </span>
          </span>
        ) : undefined
      }
      actions={
        <SegmentedControl
          size="sm"
          label="Revenue range"
          value={range}
          onChange={setRange}
          options={[
            { value: "90d", label: "90d" },
            { value: "12m", label: "12m" },
            { value: "24m", label: "24m" },
          ]}
        />
      }
    >
      {body}
    </Card>
  );
}

function AlertsCard({ k, loading, empty }: { k: Kpis; loading: boolean; empty: boolean }) {
  const list = useMemo(() => buildAlerts(k), [k]);
  let body;
  if (loading) {
    body = (
      <LoadingRegion label="Loading alerts">
        <ul className="ov-alerts">
          {list.map((a) => (
            <li key={a.id} className="ov-alert" aria-hidden="true">
              <Skeleton width={7} height={7} className="ov-alert__skdot" />
              <div className="ov-alert__body">
                <Skeleton width="70%" height={11} />
                <Skeleton width="92%" height={9} style={{ marginTop: 9 }} />
                <Skeleton width="40%" height={9} style={{ marginTop: 9 }} />
              </div>
            </li>
          ))}
        </ul>
      </LoadingRegion>
    );
  } else if (empty) {
    body = (
      <EmptyState
        compact
        icon="check-circle"
        title="No open alerts"
        action={
          <ButtonLink to="/system#alerts" size="sm">
            Alert rules
          </ButtonLink>
        }
      >
        Provisioning, cost, solve-test and payment thresholds are all within limits.
      </EmptyState>
    );
  } else {
    body = (
      <ul className="ov-alerts">
        {list.map((a) => {
          const sev = SEVERITY[a.severity];
          return (
            <li key={a.id} className="ov-alert">
              <StatusDot tone={sev.tone} size="sm" className="ov-alert__dot" />
              <div className="ov-alert__body">
                <div className="ov-alert__head">
                  <span className="ov-alert__title">{a.title}</span>
                  <time dateTime={a.at} className="rp-mono rp-num ov-alert__time">
                    {formatRelative(a.at)}
                  </time>
                </div>
                <p className="ov-alert__detail">{a.detail}</p>
                <div className="ov-alert__foot">
                  <span className="ov-alert__sev" style={{ color: `var(--${sev.tone})` }}>
                    {sev.label}
                  </span>
                  <Link to={a.action.to} className="ov-alert__act">
                    {a.action.label}
                    <Icon name="arrow-right" size={13} />
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <Card
      id="alerts"
      className="ov-span-4 ov-alerts-card"
      title="Alerts"
      meta={!loading && !empty ? <span className="rp-mono rp-num">{list.length} open</span> : undefined}
      actions={
        <Link to="/system#alerts" className="ov-more">
          All alerts
          <Icon name="arrow-right" size={13} />
        </Link>
      }
      padding="none"
    >
      {body}
    </Card>
  );
}

// Retention rarely falls below 50%, so shade on a 50 to 100 domain to keep the ramp readable.
const FLOOR = 50;
const shade = (v: number | null) => (v === null ? null : Math.max(0, ((v - FLOOR) / (100 - FLOOR)) * 100));
const unshade = (t: number) => `${Math.round(FLOOR + (t / 100) * (100 - FLOOR))}%`;

function CohortCard({ loading, empty }: { loading: boolean; empty: boolean }) {
  const rows = useMemo(() => cohorts(), []);
  const months = Array.from({ length: 12 }, (_, i) => `M${i}`);
  const total = rows.reduce((a, c) => a + c.size, 0);
  let body;
  if (loading) {
    body = (
      <LoadingRegion label="Loading cohorts">
        <div className="ov-cohortsk" aria-hidden="true">
          {Array.from({ length: 13 }, (_, r) => (
            <div key={r} className="ov-cohortsk__row">
              <Skeleton width={80} height={10} />
              {Array.from({ length: 12 }, (_, c) => (c <= 12 - r ? <Skeleton key={c} height={26} radius="sm" /> : <span key={c} />))}
            </div>
          ))}
        </div>
      </LoadingRegion>
    );
  } else if (empty) {
    body = (
      <EmptyState
        compact
        icon="grid"
        title="No paid cohorts yet"
        action={
          <ButtonLink to="/billing" size="sm">
            Open billing
          </ButtonLink>
        }
      >
        A cohort forms when the first subscriber converts in a calendar month.
      </EmptyState>
    );
  } else {
    body = (
      <Heatmap
        label="Monthly cohort retention: share of paid subscribers still subscribed, by months since conversion"
        columns={months}
        format={unshade}
        rowHeader="Cohort, size"
        rows={[
          { label: "All cohorts", meta: int(total), values: months.map((_, m) => shade(retentionAt(rows, m))) },
          ...rows.map((c) => ({ label: c.label, meta: int(c.size), values: c.values.map(shade) })),
        ]}
      />
    );
  }
  return (
    <Card
      className="ov-span-12 ov-cohort"
      title="Cohort retention"
      meta={!loading && !empty ? "Share of paid subscribers still subscribed, by month of conversion" : undefined}
      actions={
        !loading && !empty ? (
          <span className="ov-scale" aria-hidden="true">
            <span className="rp-mono rp-num">{FLOOR}%</span>
            <span className="ov-scale__bar" />
            <span className="rp-mono rp-num">100%</span>
          </span>
        ) : undefined
      }
    >
      {body}
    </Card>
  );
}

function FunnelCard({ range, rangeLong, loading, empty }: { range: RangeId; rangeLong: string; loading: boolean; empty: boolean }) {
  const f = useMemo(() => funnel(range), [range]);
  let body;
  if (loading) {
    body = (
      <LoadingRegion label="Loading funnel">
        <div className="ov-funnelsk" aria-hidden="true">
          {[100, 62, 40, 24, 18].map((w, i) => (
            <div key={i}>
              <Skeleton width="45%" height={10} />
              <Skeleton width={`${w}%`} height={10} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      </LoadingRegion>
    );
  } else if (empty) {
    body = (
      <EmptyState
        compact
        icon="filter"
        title="No visitors recorded"
        action={
          <ButtonLink to="/system#config" size="sm">
            Analytics config
          </ButtonLink>
        }
      >
        The funnel starts from site analytics on rootpanther.com.
      </EmptyState>
    );
  } else {
    const steps = [
      { id: "visitors", label: "Visitors", value: f.visitors, of: "" },
      { id: "signups", label: "Signups", value: f.signups, of: "of visitors" },
      { id: "trials", label: "Trials started", value: f.trials, of: "of signups" },
      { id: "paid", label: "Paid", value: f.paid, of: "of trials" },
      { id: "active", label: "Active, launched a lab", value: f.active, of: "of paid" },
    ];
    body = (
      <ol className="ov-fun" aria-label={`Conversion funnel, last ${rangeLong}`}>
        {steps.map((st, i) => {
          const conv = i === 0 ? 100 : (st.value / steps[i - 1].value) * 100;
          const overall = (st.value / steps[0].value) * 100;
          return (
            <li key={st.id} className="ov-fun__step">
              <div className="ov-fun__head">
                <span className="ov-fun__label">{st.label}</span>
                <span className="rp-mono rp-num ov-fun__value">{int(st.value)}</span>
              </div>
              <div className="ov-fun__track" aria-hidden="true">
                <span className="ov-fun__bar" style={{ width: `${Math.max(conv, 0.8)}%` }} />
              </div>
              <div className="ov-fun__meta rp-mono rp-num">
                {i === 0 ? (
                  <span>Top of funnel</span>
                ) : (
                  <span>
                    {conv.toFixed(1)}% {st.of}
                  </span>
                )}
                {i > 1 && <span>{overall < 1 ? overall.toFixed(2) : overall.toFixed(1)}% of visitors</span>}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }
  return (
    <Card className="ov-span-4 ov-funnel" title="Funnel" meta={`Last ${rangeLong}`}>
      {body}
    </Card>
  );
}

function LiveFeedCard({ loading, empty }: { loading: boolean; empty: boolean }) {
  const [items, setItems] = useState<ActivityItem[]>(() => (empty ? [] : initialFeed()));
  const [paused, setPaused] = useState(false);
  const gen = useRef(feedGenerator(11));
  const running = !paused && !loading && !empty;
  useInterval(() => setItems((xs) => [gen.current(new Date().toISOString()), ...xs].slice(0, 40)), running ? 4000 : null);
  return (
    <Card
      className="ov-span-8 ov-feedcard"
      title="Live activity"
      meta={loading || empty ? undefined : paused ? <StatusDot tone="neutral" hollow size="sm" label="Paused" /> : <StatusDot tone="primary" size="sm" label="Live" />}
      actions={
        <IconButton
          icon={paused ? "play" : "pause"}
          label={paused ? "Resume live activity" : "Pause live activity"}
          variant="secondary"
          size="sm"
          aria-pressed={paused}
          disabled={loading || empty}
          onClick={() => setPaused(!paused)}
        />
      }
      padding="none"
    >
      <ActivityFeed
        label="Live activity"
        items={empty ? [] : items}
        loading={loading}
        maxHeight={352}
        empty={
          <li>
            <EmptyState
              compact
              icon="activity"
              title="No events yet"
              action={
                <ButtonLink to="/fleet" size="sm">
                  Open fleet
                </ButtonLink>
              }
            >
              Signups, upgrades, cancellations, lab launches and failures stream here.
            </EmptyState>
          </li>
        }
      />
    </Card>
  );
}

function Freshness() {
  const [age, setAge] = useState(12);
  const [refreshing, setRefreshing] = useState(false);
  const [announce, setAnnounce] = useState("");
  useInterval(() => setAge((a) => a + 1), refreshing ? null : 1000);
  function refresh() {
    setRefreshing(true);
    setAnnounce("");
    window.setTimeout(() => {
      setRefreshing(false);
      setAge(0);
      setAnnounce("Metrics refreshed");
    }, 700);
  }
  const label = age < 60 ? `${age}s` : `${Math.floor(age / 60)}m`;
  return (
    <div className="ov-fresh">
      <span className="ov-fresh__text">
        {refreshing ? (
          "Refreshing"
        ) : (
          <>
            Updated <span className="rp-mono rp-num">{label}</span> ago
          </>
        )}
      </span>
      <IconButton icon="refresh" label="Refresh metrics" variant="secondary" size="sm" onClick={refresh} disabled={refreshing} className={cx(refreshing && "ov-spin")} />
      <span className="rp-sr" role="status">
        {announce}
      </span>
    </div>
  );
}

export default function OverviewPage() {
  const state = useDataState();
  const [params, setParams] = useSearchParams();
  const range = (RANGES.find((r) => r.id === params.get("range"))?.id ?? "30d") as RangeId;
  const rangeLong = RANGES.find((r) => r.id === range)!.long;
  const k = useMemo(() => kpis(range), [range]);
  const loading = state === "loading";
  const empty = state === "empty";
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    el.scrollIntoView({ block: "start" });
  }, [hash, state]);

  function setRange(r: RangeId) {
    const p = new URLSearchParams(params);
    if (r === "30d") p.delete("range");
    else p.set("range", r);
    setParams(p, { replace: true });
  }

  if (state === "denied") {
    return (
      <Page width="full">
        <PageHeader title="Overview" />
        <Card>
          <EmptyState
            icon="lock"
            title="Overview needs the owner or finance role"
            action={
              <ButtonLink to="/users" size="sm">
                Open Users
              </ButtonLink>
            }
          >
            Revenue, margin and cost figures are limited to owner and finance operators. Your role is support. An owner can change roles in System.
          </EmptyState>
        </Card>
      </Page>
    );
  }

  if (state === "error") {
    return (
      <Page width="full">
        <PageHeader title="Overview" />
        <Card>
          <ErrorState title="Metrics did not load" onRetry={() => window.location.reload()} reference="req_3b91e7">
            The metrics warehouse did not respond within 10 seconds. Billing, fleet and running labs are not affected.
          </ErrorState>
        </Card>
      </Page>
    );
  }

  return (
    <Page width="full" className="ov-page">
      <PageHeader
        title="Overview"
        meta={
          <>
            <span>Change vs previous {rangeLong}</span>
            <span>MTD {MTD_COMPARE}</span>
          </>
        }
        actions={
          <>
            <Freshness />
            <SegmentedControl label="Metrics range" value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.id, label: r.id, title: `Last ${r.long}` }))} />
          </>
        }
      />
      <div className="ov-dash">
        {empty ? (
          <Card>
            <EmptyState
              icon="gauge"
              title="No metrics for this range"
              action={
                <ButtonLink to="/system#config" size="sm">
                  Data sources
                </ButtonLink>
              }
            >
              No signups, subscriptions or lab usage recorded. Tiles fill in from the first Stripe event and Azure cost export.
            </EmptyState>
          </Card>
        ) : (
          <KpiGrid k={k} rangeLong={rangeLong} loading={loading} />
        )}
        <div className="ov-grid">
          <RevenueCard loading={loading} empty={empty} />
          <AlertsCard k={k} loading={loading} empty={empty} />
          <CohortCard loading={loading} empty={empty} />
          <FunnelCard range={range} rangeLong={rangeLong} loading={loading} empty={empty} />
          <LiveFeedCard key={state} loading={loading} empty={empty} />
        </div>
      </div>
    </Page>
  );
}
