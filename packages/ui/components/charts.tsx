import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { Icon } from "../icons";
import { cx, formatDelta, toneVar } from "../format";
import type { Tone } from "../types";
import { UiLink } from "./Link";
import { Skeleton } from "./display";

function useWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export type ChartTone = "chart-1" | "chart-2" | "chart-3" | Tone;

function chartColor(t?: ChartTone): string {
  if (!t) return "var(--chart-1)";
  if (t.startsWith("chart-")) return `var(--${t})`;
  return toneVar(t as Tone);
}

function showTick(i: number, n: number, step: number): boolean {
  if (i === n - 1) return true;
  if (i % step !== 0) return false;
  return n - 1 - i >= Math.max(1, step * 0.6);
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * exp;
}

export interface SparklineProps {
  values: number[];
  tone?: ChartTone;
  width?: number;
  height?: number;
  label?: string;
}

export function Sparkline({ values, tone = "chart-1", width = 96, height = 28, label }: SparklineProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (width - pad * 2), pad + (1 - (v - min) / span) * (height - pad * 2)] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="rp-spark" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={d} fill="none" stroke={chartColor(tone)} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2} fill={chartColor(tone)} />
    </svg>
  );
}

export interface KpiTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: { value: number; unit?: string; good: "up" | "down" | "neutral"; period?: string };
  spark?: number[];
  href?: string;
  secondary?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function KpiTile({ label, value, unit, delta, spark, href, secondary, loading, className }: KpiTileProps) {
  let deltaEl: ReactNode = null;
  if (delta) {
    const dir = delta.value > 0 ? "up" : delta.value < 0 ? "down" : "flat";
    const favourable = delta.good === "neutral" || dir === "flat" ? null : dir === delta.good;
    const tone = favourable === null ? "var(--text-main)" : favourable ? "var(--success)" : "var(--crit)";
    deltaEl = (
      <span className="rp-kpi__delta rp-mono rp-num" style={{ color: tone }}>
        {dir !== "flat" && <Icon name={dir === "up" ? "arrow-up" : "arrow-down"} size={11} strokeWidth={2.25} />}
        {formatDelta(delta.value, 1, delta.unit ?? "%")}
        <span className="rp-sr">{favourable === null ? "" : favourable ? ", favourable" : ", unfavourable"}</span>
        {delta.period && <span className="rp-kpi__period">{delta.period}</span>}
      </span>
    );
  }
  const inner = loading ? (
    <>
      <Skeleton width="45%" height={10} />
      <Skeleton width="60%" height={22} style={{ marginTop: 10 }} />
      <Skeleton width="35%" height={10} style={{ marginTop: 10 }} />
    </>
  ) : (
    <>
      <div className="rp-kpi__label">
        <span className="rp-truncate">{label}</span>
        {href && <Icon name="arrow-up-right" size={12} className="rp-kpi__go" />}
      </div>
      <div className="rp-kpi__row">
        <div className="rp-kpi__value rp-mono rp-num">
          {value}
          {unit && <span className="rp-kpi__unit">{unit}</span>}
        </div>
        {spark && <Sparkline values={spark} width={72} height={26} />}
      </div>
      <div className="rp-kpi__foot">
        {deltaEl}
        {secondary && <span className="rp-kpi__secondary rp-truncate">{secondary}</span>}
      </div>
    </>
  );
  if (href && !loading) {
    return (
      <UiLink to={href} className={cx("rp-kpi", "is-link", className)}>
        {inner}
      </UiLink>
    );
  }
  return <div className={cx("rp-kpi", className)}>{inner}</div>;
}

export interface LineSeries {
  id: string;
  label: string;
  values: number[];
  tone?: ChartTone;
  dashed?: boolean;
}

export interface LineChartProps {
  x: string[];
  series: LineSeries[];
  height?: number;
  yFormat?: (v: number) => string;
  label: string;
  yMax?: number;
  threshold?: { value: number; label: string };
  legend?: boolean;
}

function SrTable({ label, x, series, yFormat }: { label: string; x: string[]; series: { label: string; values: number[] }[]; yFormat: (v: number) => string }) {
  return (
    <div className="rp-sr">
    <table>
      <caption>{label}</caption>
      <thead>
        <tr>
          <th scope="col">Period</th>
          {series.map((s) => (
            <th key={s.label} scope="col">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {x.map((xv, i) => (
          <tr key={xv}>
            <th scope="row">{xv}</th>
            {series.map((s) => (
              <td key={s.label}>{yFormat(s.values[i] ?? 0)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

function Legend({ items }: { items: { label: string; tone?: ChartTone; dashed?: boolean }[] }) {
  return (
    <div className="rp-legend" aria-hidden="true">
      {items.map((i) => (
        <span key={i.label} className="rp-legend__item">
          <span className={cx("rp-legend__swatch", i.dashed && "is-dashed")} style={{ ["--c" as string]: chartColor(i.tone) }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

const PAD = { top: 12, right: 12, bottom: 26, left: 52 };

export function LineChart({ x, series, height = 240, yFormat = (v) => String(v), label, yMax, threshold, legend = true }: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(yMax ?? Math.max(...series.flatMap((s) => s.values), threshold?.value ?? 0));
  const iw = Math.max(0, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const xAt = (i: number) => PAD.left + (x.length <= 1 ? 0 : (i / (x.length - 1)) * iw);
  const yAt = (v: number) => PAD.top + (1 - v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const step = Math.max(1, Math.ceil(x.length / Math.max(2, Math.floor(iw / 72))));

  return (
    <div className="rp-chart">
      {legend && series.length > 1 && <Legend items={series} />}
      <div ref={ref} className="rp-chart__area" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={label}
            onPointerMove={(e) => {
              const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const px = e.clientX - r.left - PAD.left;
              const i = Math.round((px / iw) * (x.length - 1));
              setHover(i >= 0 && i < x.length ? i : null);
            }}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="var(--chart-grid)" />
                <text x={PAD.left - 8} y={yAt(t)} dy="0.32em" textAnchor="end" className="rp-chart__tick">
                  {yFormat(t)}
                </text>
              </g>
            ))}
            {x.map((xv, i) =>
              showTick(i, x.length, step) ? (
                <text key={xv} x={xAt(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === x.length - 1 ? "end" : "middle"} className="rp-chart__tick">
                  {xv}
                </text>
              ) : null,
            )}
            {threshold && (
              <g>
                <line x1={PAD.left} x2={width - PAD.right} y1={yAt(threshold.value)} y2={yAt(threshold.value)} stroke="var(--crit)" strokeDasharray="4 4" />
                <text x={width - PAD.right} y={yAt(threshold.value) - 6} textAnchor="end" className="rp-chart__tick" style={{ fill: "var(--crit)" }}>
                  {threshold.label}
                </text>
              </g>
            )}
            {series.map((s) => (
              <path
                key={s.id}
                d={s.values.map((v, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join("")}
                fill="none"
                stroke={chartColor(s.tone)}
                strokeWidth={1.75}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                strokeLinejoin="round"
              />
            ))}
            {hover !== null && (
              <g>
                <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--border-hover)" />
                {series.map((s) => (
                  <circle key={s.id} cx={xAt(hover)} cy={yAt(s.values[hover] ?? 0)} r={3.5} fill="var(--bg-card)" stroke={chartColor(s.tone)} strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
        )}
        {hover !== null && width > 0 && (
          <div className="rp-chart__tip" style={{ left: Math.min(xAt(hover) + 12, width - 180), top: PAD.top }}>
            <div className="rp-chart__tiphead">{x[hover]}</div>
            {series.map((s) => (
              <div key={s.id} className="rp-chart__tiprow">
                <span className="rp-legend__swatch" style={{ ["--c" as string]: chartColor(s.tone) }} />
                <span>{s.label}</span>
                <span className="rp-mono rp-num">{yFormat(s.values[hover] ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <SrTable label={label} x={x} series={series} yFormat={yFormat} />
    </div>
  );
}

export interface BarSeries {
  id: string;
  label: string;
  values: number[];
  tone?: ChartTone;
}

export interface BarChartProps {
  x: string[];
  series: BarSeries[];
  stacked?: boolean;
  height?: number;
  yFormat?: (v: number) => string;
  label: string;
  legend?: boolean;
}

export function BarChart({ x, series, stacked, height = 240, yFormat = (v) => String(v), label, legend = true }: BarChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const totals = x.map((_, i) => (stacked ? series.reduce((a, s) => a + (s.values[i] ?? 0), 0) : Math.max(...series.map((s) => s.values[i] ?? 0))));
  const max = niceMax(Math.max(...totals));
  const iw = Math.max(0, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const band = x.length ? iw / x.length : 0;
  const barW = Math.max(4, Math.min(36, band * (stacked ? 0.62 : 0.72)));
  const yAt = (v: number) => PAD.top + (1 - v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const step = Math.max(1, Math.ceil(x.length / Math.max(2, Math.floor(iw / 56))));

  return (
    <div className="rp-chart">
      {legend && series.length > 1 && <Legend items={series} />}
      <div ref={ref} className="rp-chart__area" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={label} onPointerLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="var(--chart-grid)" />
                <text x={PAD.left - 8} y={yAt(t)} dy="0.32em" textAnchor="end" className="rp-chart__tick">
                  {yFormat(t)}
                </text>
              </g>
            ))}
            {x.map((xv, i) => {
              const cx0 = PAD.left + band * i + band / 2;
              let acc = 0;
              return (
                <g key={xv} onPointerEnter={() => setHover(i)}>
                  <rect x={PAD.left + band * i} y={PAD.top} width={band} height={ih} fill={hover === i ? "var(--hover-wash)" : "transparent"} />
                  {stacked
                    ? series.map((s) => {
                        const v = s.values[i] ?? 0;
                        const y0 = yAt(acc);
                        acc += v;
                        const y1 = yAt(acc);
                        return <rect key={s.id} x={cx0 - barW / 2} y={y1} width={barW} height={Math.max(0, y0 - y1)} fill={chartColor(s.tone)} stroke="var(--bg-card)" strokeWidth={v > 0 ? 1 : 0} />;
                      })
                    : series.map((s, si) => {
                        const v = s.values[i] ?? 0;
                        const w = barW / series.length;
                        return <rect key={s.id} x={cx0 - barW / 2 + si * w} y={yAt(v)} width={Math.max(1, w - 1)} height={Math.max(0, PAD.top + ih - yAt(v))} fill={chartColor(s.tone)} />;
                      })}
                  {showTick(i, x.length, step) && (
                    <text x={cx0} y={height - 6} textAnchor="middle" className="rp-chart__tick">
                      {xv}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {hover !== null && width > 0 && (
          <div className="rp-chart__tip" style={{ left: Math.min(PAD.left + band * hover + band / 2 + 12, width - 180), top: PAD.top }}>
            <div className="rp-chart__tiphead">{x[hover]}</div>
            {series.map((s) => (
              <div key={s.id} className="rp-chart__tiprow">
                <span className="rp-legend__swatch" style={{ ["--c" as string]: chartColor(s.tone) }} />
                <span>{s.label}</span>
                <span className="rp-mono rp-num">{yFormat(s.values[hover] ?? 0)}</span>
              </div>
            ))}
            {stacked && series.length > 1 && (
              <div className="rp-chart__tiprow is-total">
                <span />
                <span>Total</span>
                <span className="rp-mono rp-num">{yFormat(totals[hover])}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <SrTable label={label} x={x} series={series} yFormat={yFormat} />
    </div>
  );
}

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  tone?: ChartTone;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  size?: number;
  label: string;
  center?: ReactNode;
  format?: (v: number, pct: number) => string;
}

export function DonutChart({ slices, size = 160, label, center, format = (_v, p) => `${p.toFixed(1)}%` }: DonutChartProps) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="rp-donut">
      <div className="rp-donut__ring" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${slices.map((s) => `${s.label} ${format(s.value, (s.value / total) * 100)}`).join(", ")}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--divider)" strokeWidth={14} />
          {slices.map((s) => {
            const len = (s.value / total) * c;
            const gap = slices.length > 1 ? Math.min(2, len) : 0;
            const el = (
              <circle
                key={s.id}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={chartColor(s.tone)}
                strokeWidth={14}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        {center && <div className="rp-donut__center">{center}</div>}
      </div>
      <ul className="rp-donut__legend">
        {slices.map((s) => (
          <li key={s.id}>
            <span className="rp-legend__swatch" style={{ ["--c" as string]: chartColor(s.tone) }} />
            <span className="rp-truncate">{s.label}</span>
            <span className="rp-mono rp-num">{format(s.value, (s.value / total) * 100)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface HeatmapRow {
  label: string;
  meta?: string;
  values: (number | null)[];
}

export interface HeatmapProps {
  columns: string[];
  rows: HeatmapRow[];
  label: string;
  format?: (v: number) => string;
  max?: number;
  min?: number;
  rowHeader?: string;
}

export function Heatmap({ columns, rows, label, format = (v) => `${Math.round(v)}%`, max = 100, min = 0, rowHeader = "Cohort" }: HeatmapProps) {
  const id = useId();
  return (
    <div className="rp-heatmap" role="region" aria-labelledby={id} tabIndex={0}>
      <table>
        <caption id={id} className="rp-sr">
          {label}
        </caption>
        <thead>
          <tr>
            <th scope="col">{rowHeader}</th>
            {columns.map((c) => (
              <th key={c} scope="col" className="rp-mono">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">
                <span>{r.label}</span>
                {r.meta && <span className="rp-heatmap__meta rp-mono rp-num">{r.meta}</span>}
              </th>
              {r.values.map((v, i) => {
                if (v === null) return <td key={i} className="is-null" aria-label="No data" />;
                const t = Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
                const style: CSSProperties = {
                  background: `color-mix(in srgb, var(--info) ${Math.round(6 + t * 74)}%, var(--bg-card))`,
                  color: t > 0.55 ? "var(--on-primary)" : "var(--text-header)",
                };
                return (
                  <td key={i} style={style} className="rp-mono rp-num">
                    {format(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface FunnelStep {
  id: string;
  label: string;
  value: number;
}

export function FunnelChart({ steps, label, format = (v) => v.toLocaleString("en-US") }: { steps: FunnelStep[]; label: string; format?: (v: number) => string }) {
  const top = steps[0]?.value || 1;
  return (
    <ol className="rp-funnel" aria-label={label}>
      {steps.map((s, i) => {
        const pct = (s.value / top) * 100;
        const conv = i > 0 && steps[i - 1].value ? (s.value / steps[i - 1].value) * 100 : null;
        return (
          <li key={s.id} className="rp-funnel__step">
            <div className="rp-funnel__head">
              <span>{s.label}</span>
              <span className="rp-mono rp-num rp-strong">{format(s.value)}</span>
            </div>
            <div className="rp-funnel__track">
              <span className="rp-funnel__bar" style={{ width: `${Math.max(pct, 0.6)}%` }} />
            </div>
            <div className="rp-funnel__meta rp-mono rp-num">
              {conv === null ? "Starting volume" : `${conv.toFixed(1)}% of the previous step`}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
