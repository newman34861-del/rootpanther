import { useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Icon,
  KpiTile,
  LoadingRegion,
  Page,
  PageHeader,
  Section,
  Skeleton,
  SkeletonText,
  Slider,
  formatDate,
  formatDelta,
  formatMoney,
  formatNumber,
  useToast,
} from "@rootpanther/ui";
import type { Column } from "@rootpanther/ui";
import { CALC_DEFAULTS, CALC_LIMITS, COST_CATEGORY_LABEL, PAYMENT_FEE, actuals, cohortMargins, costLines, costMtd, feePerMonth, period, planMargins } from "../../mock/finance";
import type { CalcInputs, CostCategory, CostLine } from "../../mock/finance";
import { useDataState } from "../../review/review";
import { BreakEvenChart } from "./BreakEvenChart";
import "./finance.css";

type Mode = "default" | "loading" | "empty" | "error";

const MINUS = "\u2212";
const usd = (n: number, d = 0) => {
  const v = d === 0 ? Math.round(n) : n;
  return `${v < 0 ? MINUS : ""}${formatMoney(Math.abs(v), "USD", d)}`;
};
const pct = (n: number, d = 1) => `${n < 0 && Number(n.toFixed(d)) !== 0 ? MINUS : ""}${Math.abs(n).toFixed(d)}%`;
const signedUsd = (n: number) => `${Math.round(n) > 0 ? "+" : ""}${usd(n)}`;

function fee(price: number) {
  return price <= 0 ? 0 : (price * PAYMENT_FEE.percent) / 100 + PAYMENT_FEE.fixed;
}

function compute(i: CalcInputs) {
  const revenue = i.price * i.users;
  const perUserVariable = i.hours * (i.compute + i.onyx) + fee(i.price);
  const variable = perUserVariable * i.users;
  const fixed = i.fixed;
  const profit = revenue - variable - fixed;
  const margin = revenue > 0 ? (profit / revenue) * 100 : null;
  const contribution = i.price - perUserVariable;
  const breakEven = contribution > 0 ? Math.ceil(fixed / contribution) : null;
  return { revenue, variable, fixed, profit, margin, contribution, perUserVariable, breakEven, fees: fee(i.price) * i.users };
}

function marginFor(price: number, hours: number, base: CalcInputs) {
  return compute({ ...base, price, hours }).margin;
}

const FIELDS: { key: keyof CalcInputs; label: string; unit: string; digits: number; prefix?: string; hint?: string }[] = [
  { key: "price", label: "Price", unit: "per user per month", digits: 2, prefix: "$" },
  { key: "users", label: "Active paying users", unit: "users", digits: 0 },
  { key: "hours", label: "Lab-hours per user", unit: "h per month", digits: 1 },
  { key: "compute", label: "Compute cost", unit: "per lab-hour", digits: 2, prefix: "$" },
  { key: "onyx", label: "Onyx cost", unit: "per lab-hour", digits: 2, prefix: "$" },
  { key: "fixed", label: "Fixed monthly cost", unit: "per month", digits: 0, prefix: "$" },
];

function fmtField(key: keyof CalcInputs, v: number) {
  const f = FIELDS.find((x) => x.key === key)!;
  const num = formatNumber(v, f.digits);
  return `${f.prefix ?? ""}${num} ${f.unit}`;
}

function CalcField({ field, value, onChange }: { field: (typeof FIELDS)[number]; value: number; onChange: (v: number) => void }) {
  const lim = CALC_LIMITS[field.key];
  const [draft, setDraft] = useState<string | null>(null);
  const inputId = useId();
  const sliderId = useId();
  const changed = value !== CALC_DEFAULTS[field.key];

  function commit(raw: string) {
    const n = Number(raw.replace(/[$,\s]/g, ""));
    if (raw.trim() !== "" && Number.isFinite(n)) onChange(Math.min(lim.max, Math.max(lim.min, n)));
    setDraft(null);
  }

  return (
    <div className={`fi-field${changed ? " is-changed" : ""}`}>
      <div className="fi-field__head">
        <label htmlFor={sliderId} className="fi-field__label">
          {field.label}
        </label>
        <div className="fi-field__num">
          {field.prefix && (
            <span className="fi-field__affix rp-mono" aria-hidden="true">
              {field.prefix}
            </span>
          )}
          <input
            id={inputId}
            className="fi-field__input rp-mono rp-num"
            inputMode="decimal"
            aria-label={`${field.label}, ${field.unit}`}
            value={draft ?? formatNumber(value, field.digits)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
              if (e.key === "Escape") setDraft(null);
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                const step = lim.step * (e.shiftKey ? 10 : 1);
                onChange(Math.min(lim.max, Math.max(lim.min, Math.round((value + (e.key === "ArrowUp" ? step : -step)) / lim.step) * lim.step)));
                setDraft(null);
              }
            }}
          />
        </div>
      </div>
      <Slider id={sliderId} min={lim.min} max={lim.max} step={lim.step} value={value} onChange={onChange} aria-valuetext={fmtField(field.key, value)} />
      <div className="fi-field__foot rp-mono rp-num">
        <span>{field.prefix ? `${field.prefix}${formatNumber(lim.min)}` : formatNumber(lim.min)}</span>
        <span className="fi-field__unit">
          {changed ? (
            <button
              type="button"
              className="fi-field__restore"
              onClick={() => onChange(CALC_DEFAULTS[field.key])}
              aria-label={`Restore ${field.label} to actual, ${fmtField(field.key, CALC_DEFAULTS[field.key])}`}
            >
              Actual {field.prefix}
              {formatNumber(CALC_DEFAULTS[field.key], field.digits)}
            </button>
          ) : (
            field.unit
          )}
        </span>
        <span>{field.prefix ? `${field.prefix}${formatNumber(lim.max)}` : formatNumber(lim.max)}</span>
      </div>
    </div>
  );
}

function Output({ label, value, tone, detail, big }: { label: string; value: string; tone?: "fav" | "unfav"; detail?: ReactNode; big?: boolean }) {
  return (
    <div className={`fi-out${big ? " is-big" : ""}`}>
      <dt>{label}</dt>
      <dd>
        <span className={`fi-out__value${value.length > 10 ? " is-text" : " rp-mono"}${tone ? ` fi-${tone}` : ""}`}>{value}</span>
        {detail && <span className="fi-out__detail">{detail}</span>}
      </dd>
    </div>
  );
}

function Calculator({ inputs, setInputs }: { inputs: CalcInputs; setInputs: (f: (i: CalcInputs) => CalcInputs) => void }) {
  const toast = useToast();
  const r = compute(inputs);
  const base = compute(CALC_DEFAULTS);
  const dirty = (Object.keys(CALC_DEFAULTS) as (keyof CalcInputs)[]).some((k) => inputs[k] !== CALC_DEFAULTS[k]);
  const sign = (n: number): "fav" | "unfav" => (n >= 0 ? "fav" : "unfav");
  const vsBase = (now: number, then: number) => (dirty ? <span className="rp-mono rp-num">{signedUsd(now - then)} vs actuals</span> : undefined);

  const summary = `Profit ${usd(r.profit)}, margin ${r.margin === null ? "not defined" : pct(r.margin)}, break-even ${r.breakEven === null ? "not reachable" : `${formatNumber(r.breakEven)} users`}.`;

  return (
    <Card
      title="Unit economics calculator"
      meta={<span className="rp-mono rp-num">Monthly, defaults are {formatDate(period.monthStart, { month: "long" })} actuals</span>}
      actions={
        <Button
          size="sm"
          variant="secondary"
          iconLeft="refresh"
          disabled={!dirty}
          onClick={() => {
            setInputs(() => CALC_DEFAULTS);
            toast.push({ title: "Calculator reset", detail: "Inputs restored to this month's actuals." });
          }}
        >
          Reset to actuals
        </Button>
      }
      padding="none"
    >
      <div className="fi-calc">
        <form className="fi-calc__inputs" aria-label="Calculator inputs" onSubmit={(e) => e.preventDefault()}>
          {FIELDS.map((f) => (
            <CalcField key={f.key} field={f} value={inputs[f.key]} onChange={(v) => setInputs((i) => ({ ...i, [f.key]: v }))} />
          ))}
          <p className="fi-calc__assume">
            <Icon name="info" size={13} />
            <span>
              Payment fee assumed at{" "}
              <span className="rp-mono rp-num">
                {PAYMENT_FEE.percent}% + ${PAYMENT_FEE.fixed.toFixed(2)}
              </span>{" "}
              per monthly charge, Stripe standard card rate. Excludes Stripe Billing, tax, refunds, and lab-hours used by trials and comped accounts.
            </span>
          </p>
        </form>
        <div className="fi-calc__outputs">
          <dl className="fi-outs" aria-label="Calculator results">
            <Output big label="Profit" value={usd(r.profit)} tone={sign(r.profit)} detail={vsBase(r.profit, base.profit)} />
            <Output
              big
              label="Margin"
              value={r.margin === null ? "n/a" : pct(r.margin)}
              tone={r.margin === null ? undefined : sign(r.margin)}
              detail={
                dirty && r.margin !== null && base.margin !== null ? <span className="rp-mono rp-num">{formatDelta(r.margin - base.margin, 1, " pp")} vs actuals</span> : undefined
              }
            />
            <Output
              big
              label="Break-even users"
              value={r.breakEven === null ? "Not reachable" : formatNumber(r.breakEven)}
              tone={r.breakEven === null ? "unfav" : r.breakEven <= inputs.users ? "fav" : "unfav"}
              detail={
                r.breakEven === null ? (
                  "Each user costs more than they pay"
                ) : (
                  <span className="rp-mono rp-num">
                    {r.breakEven <= inputs.users ? `${formatNumber(inputs.users - r.breakEven)} users of headroom` : `${formatNumber(r.breakEven - inputs.users)} users short`}
                  </span>
                )
              }
            />
            <Output label="Revenue" value={usd(r.revenue)} detail={vsBase(r.revenue, base.revenue)} />
            <Output label="Variable cost" value={usd(r.variable)} detail={<span className="rp-mono rp-num">incl. {usd(r.fees)} fees</span>} />
            <Output label="Fixed cost" value={usd(r.fixed)} />
            <Output
              label="Contribution per user"
              value={usd(r.contribution, 2)}
              tone={sign(r.contribution)}
              detail={<span className="rp-mono rp-num">{usd(r.perUserVariable, 2)} variable</span>}
            />
          </dl>
          <p className="rp-sr" role="status" aria-live="polite">
            {summary}
          </p>
          <BreakEvenChart price={inputs.price} users={inputs.users} fixed={inputs.fixed} variablePerUser={r.perUserVariable} breakEven={r.breakEven} />
        </div>
      </div>
    </Card>
  );
}

const SENS_PRICES = [29, 35, 39, 45.5, 49, 59, 69];
const SENS_HOURS = [10, 15, 20, 23, 30, 40, 50];

function nearest(list: number[], v: number) {
  return list.reduce((best, x) => (Math.abs(x - v) < Math.abs(best - v) ? x : best), list[0]);
}

function Sensitivity({ inputs, mode }: { inputs: CalcInputs; mode: Mode }) {
  const prices = useMemo(() => Array.from(new Set([...SENS_PRICES.filter((p) => p !== 45.5), inputs.price])).sort((a, b) => a - b), [inputs.price]);
  const hours = useMemo(() => Array.from(new Set([...SENS_HOURS.filter((h) => h !== 23), inputs.hours])).sort((a, b) => a - b), [inputs.hours]);
  const grid = hours.map((h) => prices.map((p) => marginFor(p, h, inputs)));
  const values = grid.flat().filter((v): v is number => v !== null);
  const lo = Math.min(...values, 0);
  const hi = Math.max(...values, 1);
  const curP = nearest(prices, inputs.price);
  const curH = nearest(hours, inputs.hours);

  return (
    <Card
      title="Sensitivity: margin by price and lab-hours"
      meta={mode === "loading" ? undefined : <span className="rp-mono rp-num">At {formatNumber(inputs.users)} users, current inputs outlined</span>}
      padding="none"
    >
      {mode === "loading" ? (
        <LoadingRegion label="Loading sensitivity table">
          <div className="fi-sens__sk">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} height={28} />
            ))}
          </div>
        </LoadingRegion>
      ) : (
        <div className="fi-sens" role="region" aria-labelledby="fi-sens-cap" tabIndex={0}>
          <table>
            <caption id="fi-sens-cap" className="rp-sr">
              Profit margin by price per month (columns) and average lab-hours per user (rows), at {formatNumber(inputs.users)} users. Current inputs are marked.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="fi-sens__corner">
                  <span>Hours</span>
                  <span>Price</span>
                </th>
                {prices.map((p) => (
                  <th key={p} scope="col" className={p === curP ? "is-cur" : undefined}>
                    {usd(p, Number.isInteger(p) ? 0 : 2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((h, ri) => (
                <tr key={h}>
                  <th scope="row" className={h === curH ? "is-cur" : undefined}>
                    {formatNumber(h, Number.isInteger(h) ? 0 : 1)} h
                  </th>
                  {prices.map((p, ci) => {
                    const m = grid[ri][ci];
                    const t = m === null ? 0 : Math.max(0, Math.min(1, (m - lo) / (hi - lo || 1)));
                    const here = p === curP && h === curH;
                    return (
                      <td
                        key={p}
                        className={`${here ? "is-here" : ""}${m !== null && m < 0 ? " is-neg" : ""}`}
                        style={{ ["--t" as string]: `${Math.round(4 + t * 52)}%` }}
                        aria-current={here ? "true" : undefined}
                      >
                        {m === null ? "n/a" : pct(m, 0)}
                        {here && <span className="rp-sr">, current inputs</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="fi-sens__key" aria-hidden="true">
            <span className="rp-mono rp-num">{pct(lo, 0)}</span>
            <span className="fi-sens__ramp" />
            <span className="rp-mono rp-num">{pct(hi, 0)}</span>
            <span className="fi-sens__keynote">Negative margins in red</span>
          </div>
        </div>
      )}
    </Card>
  );
}

function Share({ value, max }: { value: number; max: number }) {
  return (
    <span className="fi-share">
      <span className="fi-share__track" aria-hidden="true">
        <span className="fi-share__fill" style={{ width: `${Math.max(0.8, (value / max) * 100)}%` }} />
      </span>
      <span className="fi-share__value rp-mono rp-num">{pct(value)}</span>
    </span>
  );
}

type CostRow =
  { kind: "cat"; id: CostCategory; label: string; month: number; mtd: number; last: number; share: number } | ({ kind: "line"; share: number; mtd: number } & CostLine);

function CostBreakdown({ mode }: { mode: Mode }) {
  const [open, setOpen] = useState<Set<CostCategory>>(new Set());
  const total = costLines.reduce((a, c) => a + c.monthRate, 0);
  const cats = (Object.keys(COST_CATEGORY_LABEL) as CostCategory[]).map((id) => {
    const lines = costLines.filter((c) => c.category === id);
    const month = lines.reduce((a, c) => a + c.monthRate, 0);
    return {
      id,
      label: COST_CATEGORY_LABEL[id],
      month,
      mtd: lines.reduce((a, c) => a + costMtd(c), 0),
      last: lines.reduce((a, c) => a + c.lastMonth, 0),
      share: (month / total) * 100,
      lines,
    };
  });
  const maxShare = Math.max(...cats.map((c) => c.share));

  const rows: CostRow[] = cats.flatMap((c) => [
    { kind: "cat" as const, id: c.id, label: c.label, month: c.month, mtd: c.mtd, last: c.last, share: c.share },
    ...(open.has(c.id) ? c.lines.map((l) => ({ ...l, kind: "line" as const, share: (l.monthRate / total) * 100, mtd: costMtd(l) })) : []),
  ]);

  const toggle = (id: CostCategory) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const columns: Column<CostRow>[] = [
    {
      id: "name",
      header: "Cost",
      cell: (r) =>
        r.kind === "cat" ? (
          <button type="button" className="fi-catbtn" aria-expanded={open.has(r.id)} onClick={() => toggle(r.id)}>
            <Icon name="chevron-right" size={14} className="fi-catbtn__chev" />
            {r.label}
            <span className="fi-catbtn__count rp-mono rp-num">{costLines.filter((c) => c.category === r.id).length}</span>
          </button>
        ) : (
          <span className="fi-line">
            {r.href ? <Link to={r.href}>{r.label}</Link> : <span className="fi-line__name">{r.label}</span>}
            <span className="fi-line__detail">{r.detail}</span>
          </span>
        ),
      width: 340,
      hideable: false,
    },
    { id: "mtd", header: "MTD", cell: (r) => usd(r.mtd), align: "right", mono: true, width: 104 },
    { id: "month", header: "Month run rate", cell: (r) => usd(r.kind === "cat" ? r.month : r.monthRate), align: "right", mono: true, width: 140 },
    {
      id: "share",
      header: "Share of cost",
      cell: (r) => (r.kind === "cat" ? <Share value={r.share} max={maxShare} /> : <span className="fi-sub rp-mono rp-num">{pct(r.share)}</span>),
      width: 240,
    },
    {
      id: "last",
      header: "vs last month",
      cell: (r) => {
        const now = r.kind === "cat" ? r.month : r.monthRate;
        const last = r.kind === "cat" ? r.last : r.lastMonth;
        const d = ((now - last) / last) * 100;
        return <span className={d > 5 ? "fi-unfav" : undefined}>{formatDelta(d, 1)}</span>;
      },
      align: "right",
      mono: true,
      width: 128,
    },
  ];

  const loading = mode === "loading";

  return (
    <Card
      title="Cost breakdown"
      padding="none"
      meta={
        !loading ? (
          <span className="rp-mono rp-num">
            {usd(total)} month run rate, {usd(costLines.reduce((a, c) => a + costMtd(c), 0))} MTD
          </span>
        ) : undefined
      }
      actions={
        !loading ? (
          <Button size="sm" variant="quiet" onClick={() => setOpen(open.size === cats.length ? new Set() : new Set(cats.map((c) => c.id)))}>
            {open.size === cats.length ? "Collapse all" : "Expand all"}
          </Button>
        ) : undefined
      }
    >
      <DataTable
        caption="Monthly cost breakdown by category"
        columns={columns}
        rows={rows}
        rowKey={(r) => (r.kind === "cat" ? `cat-${r.id}` : r.id)}
        rowClassName={(r) => (r.kind === "cat" ? "fi-row-cat" : "fi-row-line")}
        loading={loading}
        density="compact"
        columnControls={false}
        footerNote={
          loading ? undefined : (
            <span>
              Run rate projects MTD over <span className="rp-mono rp-num">{period.daysInMonth}</span> days. AI tokens match Onyx Ops. Azure from Cost Management, refreshed 06:00
              UTC.
            </span>
          )
        }
      />
    </Card>
  );
}

const ACTUAL_VPH = CALC_DEFAULTS.compute + CALC_DEFAULTS.onyx;

function PlanMarginTable({ mode }: { mode: Mode }) {
  const vph = ACTUAL_VPH;
  const rows = planMargins.map((p) => {
    const revenue = p.users * p.pricePerMonth;
    const variable = p.users * (p.hours * vph + feePerMonth(p.charge, p.chargesPerYear));
    const contribution = revenue - variable;
    return { ...p, revenue, variable, contribution, margin: revenue > 0 ? (contribution / revenue) * 100 : null };
  });
  const tot = rows.reduce((a, r) => ({ users: a.users + r.users, revenue: a.revenue + r.revenue, variable: a.variable + r.variable }), { users: 0, revenue: 0, variable: 0 });

  const columns: Column<(typeof rows)[number]>[] = [
    {
      id: "plan",
      header: "Plan",
      cell: (r) => (
        <span className="fi-line">
          <span className="fi-line__name">{r.plan}</span>
          <span className="fi-line__detail">{r.billing}</span>
        </span>
      ),
      width: 180,
      hideable: false,
    },
    { id: "users", header: "Users", cell: (r) => formatNumber(r.users), sortValue: (r) => r.users, align: "right", mono: true, width: 96 },
    { id: "hours", header: "Hours / user", cell: (r) => formatNumber(r.hours, 1), sortValue: (r) => r.hours, align: "right", mono: true, width: 112 },
    { id: "rev", header: "Revenue", cell: (r) => usd(r.revenue), sortValue: (r) => r.revenue, align: "right", mono: true, width: 104 },
    { id: "var", header: "Variable", cell: (r) => usd(r.variable), sortValue: (r) => r.variable, align: "right", mono: true, width: 104 },
    {
      id: "contrib",
      header: "Contribution",
      cell: (r) => <span className={r.contribution >= 0 ? "fi-fav" : "fi-unfav"}>{usd(r.contribution)}</span>,
      sortValue: (r) => r.contribution,
      align: "right",
      mono: true,
      width: 120,
    },
    {
      id: "margin",
      header: "Margin",
      cell: (r) => (r.margin === null ? <span className="fi-sub">Acquisition cost</span> : <span className={r.margin >= 0 ? "fi-fav" : "fi-unfav"}>{pct(r.margin)}</span>),
      sortValue: (r) => r.margin ?? -999,
      align: "right",
      mono: true,
      width: 128,
    },
  ];

  return (
    <Card title="Margin by plan" padding="none" meta={mode === "loading" ? undefined : <span className="rp-mono rp-num">Contribution before fixed cost</span>}>
      <DataTable
        caption="Contribution margin by plan, this month"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={mode === "loading"}
        density="compact"
        columnControls={false}
        footerNote={
          mode === "loading" ? undefined : (
            <span className="fi-tfoot">
              <span>Total</span>
              <span className="rp-mono rp-num">{formatNumber(tot.users)} users</span>
              <span className="rp-mono rp-num">{usd(tot.revenue)} revenue</span>
              <span className="rp-mono rp-num">{pct(((tot.revenue - tot.variable) / tot.revenue) * 100)} margin</span>
            </span>
          )
        }
      />
    </Card>
  );
}

function CohortMarginTable({ mode }: { mode: Mode }) {
  const vph = ACTUAL_VPH;
  const arpu = actuals.revenue / actuals.paidUsers;
  const rows = cohortMargins.map((c) => {
    const revenue = c.paying * arpu;
    const variable = c.paying * (c.hours * vph + fee(arpu));
    const margin = revenue > 0 ? ((revenue - variable) / revenue) * 100 : null;
    return { ...c, conversion: (c.paying / c.signups) * 100, revenue, margin };
  });

  const columns: Column<(typeof rows)[number]>[] = [
    {
      id: "month",
      header: "Signup cohort",
      cell: (r) => (
        <span className="fi-line">
          <span className="fi-line__name">{formatDate(r.month, { month: "short", year: "numeric" })}</span>
          {r.partial && <span className="fi-line__detail">Month to date</span>}
        </span>
      ),
      width: 150,
      hideable: false,
    },
    { id: "paying", header: "Paying", cell: (r) => formatNumber(r.paying), align: "right", mono: true, width: 84 },
    { id: "conv", header: "of signups", cell: (r) => pct(r.conversion), align: "right", mono: true, width: 104 },
    { id: "hours", header: "Hours / user", cell: (r) => formatNumber(r.hours, 1), align: "right", mono: true, width: 112 },
    { id: "rev", header: "Revenue", cell: (r) => usd(r.revenue), align: "right", mono: true, width: 104 },
    {
      id: "margin",
      header: "Margin",
      cell: (r) => (r.margin === null ? "n/a" : <span className={r.margin >= 0 ? "fi-fav" : "fi-unfav"}>{pct(r.margin)}</span>),
      align: "right",
      mono: true,
      width: 96,
    },
  ];

  return (
    <Card
      title="Margin by signup cohort"
      padding="none"
      meta={mode === "loading" ? undefined : <span className="rp-mono rp-num">This month, at {usd(arpu, 2)} blended price</span>}
    >
      <DataTable
        caption="Contribution margin this month by signup cohort"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.month}
        loading={mode === "loading"}
        density="compact"
        columnControls={false}
        footerNote={mode === "loading" ? undefined : <span>Newer cohorts use more lab-hours per user, so margin falls as they grow.</span>}
      />
    </Card>
  );
}

function Kpis({ mode }: { mode: Mode }) {
  const loading = mode === "loading";
  const total = costLines.reduce((a, c) => a + c.monthRate, 0);
  const gm = ((actuals.revenue - total) / actuals.revenue) * 100;
  const last = costLines.reduce((a, c) => a + c.lastMonth, 0);
  const lastGm = ((actuals.lastMonthRevenue - last) / actuals.lastMonthRevenue) * 100;
  return (
    <section aria-label="Finance key metrics" className="fi-kpis">
      <KpiTile
        loading={loading}
        href="/billing"
        label="Revenue, month run rate"
        value={usd(actuals.revenue)}
        delta={{ value: ((actuals.revenue - actuals.lastMonthRevenue) / actuals.lastMonthRevenue) * 100, good: "up", period: "vs last month" }}
      />
      <KpiTile loading={loading} label="Total cost, month run rate" value={usd(total)} delta={{ value: ((total - last) / last) * 100, good: "down", period: "vs last month" }} />
      <KpiTile loading={loading} label="Operating margin" value={pct(gm)} delta={{ value: gm - lastGm, unit: " pp", good: "up", period: "vs last month" }} />
      <KpiTile
        loading={loading}
        label="Cost per active user"
        value={usd(total / actuals.activeUsers, 2)}
        secondary={<span className="rp-mono rp-num">{formatNumber(actuals.activeUsers)} incl. trials</span>}
      />
    </section>
  );
}

function Denied() {
  const toast = useToast();
  return (
    <Card padding="lg">
      <EmptyState
        icon="lock"
        title="Finance requires the Finance or Owner role"
        action={
          <Button size="sm" iconLeft="mail" onClick={() => toast.push({ title: "Access request sent", detail: "priya@rootpanther.com will be asked to grant Finance." })}>
            Request access
          </Button>
        }
      >
        This page shows revenue, costs and margin. Your role does not include it. Access requests go to the workspace owner and are written to the audit log.
      </EmptyState>
    </Card>
  );
}

function CalcSkeleton() {
  return (
    <div className="rp-card fi-calc is-skeleton" aria-hidden="true">
      <div className="fi-calc__inputs">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="fi-field">
            <Skeleton width="60%" height={12} />
            <Skeleton height={4} style={{ marginTop: 12 }} />
          </div>
        ))}
      </div>
      <div className="fi-calc__outputs">
        <SkeletonText lines={3} />
        <Skeleton height={260} radius="md" style={{ marginTop: 16 }} />
      </div>
    </div>
  );
}

export default function FinancePage() {
  const state = useDataState();
  const [inputs, setInputs] = useState<CalcInputs>(CALC_DEFAULTS);

  useEffect(() => {
    if (state !== "default") setInputs(CALC_DEFAULTS);
  }, [state]);

  const header = (
    <PageHeader
      title="Finance"
      meta={
        state === "denied" ? undefined : (
          <>
            <span className="rp-mono rp-num">
              {formatDate(period.monthStart, { month: "long", year: "numeric" })}, day {Math.floor(period.elapsedDays)} of {period.daysInMonth}
            </span>
            <span>USD</span>
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
          <ErrorState title="Finance data did not load" onRetry={() => window.location.reload()} reference="req_b81d22">
            The cost export from Azure Cost Management failed at 06:00 UTC. Billing and revenue figures are unaffected; open Billing for them.
          </ErrorState>
        </Card>
      </Page>
    );
  }

  if (state === "empty") {
    return (
      <Page width="full">
        {header}
        <Card>
          <EmptyState
            icon="money"
            title="No revenue or cost data yet"
            action={
              <Button size="sm" iconLeft="refresh" onClick={() => window.location.reload()}>
                Check again
              </Button>
            }
          >
            Finance fills in after the first Stripe and Azure Cost Management exports, which run daily at 06:00 UTC. The calculator needs one day of actuals to set its defaults.
          </EmptyState>
        </Card>
      </Page>
    );
  }

  const mode: Mode = state;

  return (
    <Page width="full" className="fi-page">
      {header}
      <Kpis mode={mode} />
      {mode === "loading" ? (
        <LoadingRegion label="Loading calculator">
          <CalcSkeleton />
        </LoadingRegion>
      ) : (
        <Calculator inputs={inputs} setInputs={setInputs} />
      )}
      <Sensitivity inputs={inputs} mode={mode} />
      <Section title="Costs">
        <CostBreakdown mode={mode} />
      </Section>
      <Section title="Margin">
        <div className="fi-margins">
          <PlanMarginTable mode={mode} />
          <CohortMarginTable mode={mode} />
        </div>
      </Section>
    </Page>
  );
}
