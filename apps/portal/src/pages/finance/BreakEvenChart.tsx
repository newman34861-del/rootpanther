import { useEffect, useRef, useState } from "react";
import { formatCompactMoney, formatMoney, formatNumber } from "@rootpanther/ui";

interface Props {
  price: number;
  users: number;
  fixed: number;
  variablePerUser: number;
  breakEven: number | null;
  height?: number;
}

const PAD = { top: 28, right: 16, bottom: 28, left: 60 };

function nice(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const usd = (n: number) => `${Math.round(n) < 0 ? "\u2212" : ""}${formatMoney(Math.abs(Math.round(n)), "USD", 0)}`;

export function BreakEvenChart({ price, users, fixed, variablePerUser, breakEven, height = 280 }: Props) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const xMax = nice(Math.max(users * 1.25, (breakEven ?? 0) * 1.6, 200));
  const rev = (u: number) => price * u;
  const cost = (u: number) => fixed + variablePerUser * u;
  const yMax = nice(Math.max(rev(xMax), cost(xMax), fixed * 1.2, 1));
  const iw = Math.max(0, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const x = (u: number) => PAD.left + (u / xMax) * iw;
  const y = (v: number) => PAD.top + (1 - v / yMax) * ih;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const xCount = Math.max(2, Math.min(5, Math.floor(iw / 90)));
  const xTicks = Array.from({ length: xCount + 1 }, (_, i) => (i / xCount) * xMax);

  const area = (from: number, to: number) => {
    if (to - from <= 0) return "";
    const pts = Array.from({ length: 33 }, (_, i) => from + ((to - from) * i) / 32);
    const top = pts.map((u) => `${x(u).toFixed(1)},${y(Math.max(rev(u), cost(u))).toFixed(1)}`);
    const bottom = pts.reverse().map((u) => `${x(u).toFixed(1)},${y(Math.min(rev(u), cost(u))).toFixed(1)}`);
    return `M${top.join("L")}L${bottom.join("L")}Z`;
  };
  const crossing = breakEven === null ? xMax : Math.min(breakEven, xMax);
  const lossPath = area(0, crossing);
  const profitPath = breakEven === null ? "" : area(crossing, xMax);

  const beX = breakEven !== null && breakEven <= xMax ? x(breakEven) : null;
  const hu = hover === null ? null : Math.round(hover);
  const tableRows = [0, Math.round(xMax * 0.25), Math.round(xMax * 0.5), users, Math.round(xMax * 0.75), Math.round(xMax)]
    .concat(breakEven !== null && breakEven <= xMax ? [breakEven] : [])
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b);

  const label = `Break-even chart. Monthly revenue and total cost against active users from 0 to ${formatNumber(xMax)}. ${
    breakEven === null ? "Break-even is not reachable at these inputs." : `Break-even at ${formatNumber(breakEven)} users.`
  } Current: ${formatNumber(users)} users.`;

  return (
    <div className="fi-be">
      <div className="fi-be__legend" aria-hidden="true">
        <span>
          <i className="fi-be__sw is-rev" />
          Revenue
        </span>
        <span>
          <i className="fi-be__sw is-cost" />
          Total cost
        </span>
        <span>
          <i className="fi-be__sw is-fixed" />
          Fixed cost
        </span>
        <span>
          <i className="fi-be__sw is-be" />
          Break-even users
        </span>
        <span>
          <i className="fi-be__sw is-profit" />
          Profit
        </span>
        <span>
          <i className="fi-be__sw is-loss" />
          Loss
        </span>
      </div>
      <div ref={ref} className="fi-be__area" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={label}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const u = ((e.clientX - r.left - PAD.left) / iw) * xMax;
              setHover(u >= 0 && u <= xMax ? u : null);
            }}
            onPointerLeave={() => setHover(null)}
          >
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="fi-be__grid" />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fi-be__tick">
                  {formatCompactMoney(t)}
                </text>
              </g>
            ))}
            {xTicks.map((t, i) =>
              beX !== null && Math.abs(x(t) - beX) < 64 ? null : (
                <text key={t} x={x(t)} y={height - 8} textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"} className="fi-be__tick">
                  {formatNumber(t)}
                </text>
              ),
            )}
            {lossPath && <path d={lossPath} className="fi-be__loss" />}
            {profitPath && <path d={profitPath} className="fi-be__profit" />}
            <line x1={x(0)} x2={x(xMax)} y1={y(fixed)} y2={y(fixed)} className="fi-be__fixed" />
            <line x1={x(0)} x2={x(xMax)} y1={y(rev(0))} y2={y(rev(xMax))} className="fi-be__rev" />
            <line x1={x(0)} x2={x(xMax)} y1={y(cost(0))} y2={y(cost(xMax))} className="fi-be__cost" />

            {users <= xMax && (
              <g className="fi-be__now">
                <line x1={x(users)} x2={x(users)} y1={PAD.top} y2={PAD.top + ih} />
                <text x={x(users)} y={PAD.top - 10} textAnchor={x(users) > width - 90 ? "end" : x(users) < PAD.left + 60 ? "start" : "middle"}>
                  Now {formatNumber(users)}
                </text>
              </g>
            )}
            {breakEven !== null && breakEven <= xMax && (
              <g className="fi-be__mark">
                <line x1={x(breakEven)} x2={x(breakEven)} y1={y(rev(breakEven))} y2={PAD.top + ih} />
                <circle cx={x(breakEven)} cy={y(rev(breakEven))} r={4.5} />
                <text x={x(breakEven)} y={height - 8} textAnchor={x(breakEven) - PAD.left < 40 ? "start" : "middle"}>
                  {formatNumber(breakEven)}
                </text>
              </g>
            )}

            {hu !== null && (
              <g className="fi-be__hover">
                <line x1={x(hu)} x2={x(hu)} y1={PAD.top} y2={PAD.top + ih} />
                <circle cx={x(hu)} cy={y(rev(hu))} r={3.5} className="is-rev" />
                <circle cx={x(hu)} cy={y(cost(hu))} r={3.5} className="is-cost" />
              </g>
            )}
          </svg>
        )}
        {hu !== null && width > 0 && (
          <div className="fi-be__tip" style={{ left: Math.min(x(hu) + 12, width - 196), top: PAD.top }}>
            <div className="fi-be__tiphead rp-mono rp-num">{formatNumber(hu)} users</div>
            <div className="fi-be__tiprow">
              <i className="fi-be__sw is-rev" />
              <span>Revenue</span>
              <span className="rp-mono rp-num">{usd(rev(hu))}</span>
            </div>
            <div className="fi-be__tiprow">
              <i className="fi-be__sw is-cost" />
              <span>Total cost</span>
              <span className="rp-mono rp-num">{usd(cost(hu))}</span>
            </div>
            <div className="fi-be__tiprow is-total">
              <i />
              <span>{rev(hu) - cost(hu) >= 0 ? "Profit" : "Loss"}</span>
              <span className={`rp-mono rp-num ${rev(hu) - cost(hu) >= 0 ? "fi-fav" : "fi-unfav"}`}>{usd(rev(hu) - cost(hu))}</span>
            </div>
          </div>
        )}
      </div>
      <table className="rp-sr">
        <caption>Revenue, total cost and profit by active users</caption>
        <thead>
          <tr>
            <th scope="col">Active users</th>
            <th scope="col">Revenue</th>
            <th scope="col">Total cost</th>
            <th scope="col">Profit</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((u) => (
            <tr key={u}>
              <th scope="row">
                {formatNumber(u)}
                {u === breakEven ? ", break-even" : u === users ? ", current" : ""}
              </th>
              <td>{usd(rev(u))}</td>
              <td>{usd(cost(u))}</td>
              <td>{usd(rev(u) - cost(u))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
