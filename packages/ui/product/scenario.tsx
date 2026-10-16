import { useId, useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../icons";
import { cx, formatDuration } from "../format";
import { PROGRESS_LABEL, SCENARIO_TYPE_LABEL, TECHNIQUE_LABEL, TIER_NAMES } from "../types";
import type { Host, ProgressStatus, ProofKind, Scenario, TechniqueFamily, TierCode, TopologyLink } from "../types";
import { UiLink } from "../components/Link";
import { Badge, Skeleton, StatusDot } from "../components/display";
import { ButtonLink } from "../components/controls";
import { Tooltip } from "../components/Tooltip";

const TIER_VAR: Record<TierCode, string> = { C1: "var(--tier-1)", C2: "var(--tier-2)", C3: "var(--tier-3)", C4: "var(--tier-4)" };

export function tierColor(t: TierCode) {
  return TIER_VAR[t];
}

export interface TierDotProps {
  tier: TierCode;
  display?: "full" | "code" | "name";
  className?: string;
  size?: "sm" | "md";
}

export function TierDot({ tier, display = "full", className, size = "md" }: TierDotProps) {
  const label = display === "code" ? tier : display === "name" ? TIER_NAMES[tier] : `${tier} ${TIER_NAMES[tier]}`;
  return (
    <span className={cx("rp-status", `rp-status--${size}`, "rp-tier", className)} style={{ "--tone": TIER_VAR[tier], "--tone-ink": TIER_VAR[tier] } as CSSProperties}>
      <span className="rp-status__dot" aria-hidden="true" />
      <span className="rp-status__label">
        <span className="rp-tier__code rp-mono">{tier}</span>
        {display === "full" && <span className="rp-tier__name"> {TIER_NAMES[tier]}</span>}
        {display === "name" && label}
      </span>
    </span>
  );
}

export function TechniqueTag({ technique, to }: { technique: TechniqueFamily; to?: string }) {
  const label = TECHNIQUE_LABEL[technique];
  if (to) {
    return (
      <UiLink to={to} className="rp-tag rp-tag--link">
        {label}
      </UiLink>
    );
  }
  return <span className="rp-tag">{label}</span>;
}

const STATUS_TONE: Record<ProgressStatus, "neutral" | "primary" | "success"> = {
  "not-started": "neutral",
  "in-progress": "primary",
  completed: "success",
};

export function ProgressStatusDot({ status, size = "md" }: { status: ProgressStatus; size?: "sm" | "md" }) {
  return <StatusDot tone={STATUS_TONE[status]} hollow={status === "not-started"} label={PROGRESS_LABEL[status]} size={size} />;
}

export interface ScenarioCardProps {
  scenario: Pick<Scenario, "id" | "slug" | "name" | "type" | "tier" | "objective" | "techniques" | "status" | "estMinutes" | "hostCount" | "os">;
  href: string;
  actionHref?: string;
  onAction?: () => void;
  maxTags?: number;
  reason?: ReactNode;
  className?: string;
}

export function scenarioAction(status: ProgressStatus): string {
  return status === "in-progress" ? "Resume" : status === "completed" ? "Review" : "Launch";
}

export function ScenarioCard({ scenario: s, href, actionHref, maxTags = 3, reason, className }: ScenarioCardProps) {
  const titleId = useId();
  const tags = s.techniques.slice(0, maxTags);
  const extra = s.techniques.length - tags.length;
  return (
    <article className={cx("rp-scard", className)} aria-labelledby={titleId}>
      <div className="rp-scard__top">
        <Badge>{SCENARIO_TYPE_LABEL[s.type]}</Badge>
        <TierDot tier={s.tier} size="sm" />
      </div>
      <h3 id={titleId} className="rp-scard__title">
        <UiLink to={href} className="rp-scard__link">
          {s.name}
        </UiLink>
      </h3>
      <div className="rp-scard__objective">
        <Icon name="target" size={13} />
        <span>{s.objective}</span>
      </div>
      <div className="rp-scard__facts rp-mono rp-num">
        {s.hostCount} {s.hostCount === 1 ? "host" : "hosts"}
        <span aria-hidden="true"> · </span>~{formatDuration(s.estMinutes)}
      </div>
      {reason && <div className="rp-scard__reason">{reason}</div>}
      <div className="rp-scard__tags">
        {tags.map((t) => (
          <TechniqueTag key={t} technique={t} />
        ))}
        {extra > 0 && (
          <Tooltip content={s.techniques.slice(maxTags).map((t) => TECHNIQUE_LABEL[t]).join(", ")}>
            <span className="rp-tag rp-tag--more" tabIndex={0}>
              +{extra}
            </span>
          </Tooltip>
        )}
      </div>
      <div className="rp-scard__foot">
        <ProgressStatusDot status={s.status} size="sm" />
        <ButtonLink to={actionHref ?? href} size="sm" variant="secondary" className="rp-scard__action" aria-label={`${scenarioAction(s.status)} ${s.name}`}>
          {scenarioAction(s.status)}
        </ButtonLink>
      </div>
    </article>
  );
}

export function ScenarioRow({ scenario: s, href, actionHref, maxTags = 3, className }: ScenarioCardProps) {
  const titleId = useId();
  const tags = s.techniques.slice(0, maxTags);
  const extra = s.techniques.length - tags.length;
  return (
    <article className={cx("rp-srow", `is-${s.status}`, className)} aria-labelledby={titleId}>
      <ProgressStatusDot status={s.status} size="sm" />
      <Badge className="rp-srow__badge">{SCENARIO_TYPE_LABEL[s.type]}</Badge>
      <div className="rp-srow__main">
        <h3 id={titleId} className="rp-srow__title">
          <UiLink to={href} className="rp-srow__link">
            {s.name}
          </UiLink>
        </h3>
        <span className="rp-srow__objective">
          <Icon name="target" size={12} />
          {s.objective}
        </span>
      </div>
      <span className="rp-srow__facts rp-mono rp-num">
        {s.hostCount} {s.hostCount === 1 ? "host" : "hosts"}
        <span aria-hidden="true"> · </span>~{formatDuration(s.estMinutes)}
      </span>
      <div className="rp-srow__tags">
        {tags.map((t) => (
          <TechniqueTag key={t} technique={t} />
        ))}
        {extra > 0 && (
          <Tooltip content={s.techniques.slice(maxTags).map((t) => TECHNIQUE_LABEL[t]).join(", ")}>
            <span className="rp-tag rp-tag--more" tabIndex={0}>
              +{extra}
            </span>
          </Tooltip>
        )}
      </div>
      <TierDot tier={s.tier} size="sm" className="rp-srow__tier" />
      <ButtonLink to={actionHref ?? href} size="sm" variant="secondary" className="rp-srow__action" aria-label={`${scenarioAction(s.status)} ${s.name}`}>
        {scenarioAction(s.status)}
      </ButtonLink>
    </article>
  );
}

export function ScenarioRowSkeleton() {
  return (
    <div className="rp-srow is-skeleton" aria-hidden="true">
      <Skeleton width={12} height={12} radius="lg" />
      <Skeleton width={64} height={18} />
      <Skeleton width="42%" height={14} />
      <Skeleton width={96} height={11} />
      <Skeleton width={120} height={22} />
      <Skeleton width={96} height={12} />
      <Skeleton width={72} height={30} radius="md" />
    </div>
  );
}

export function ScenarioCardSkeleton() {
  return (
    <div className="rp-scard is-skeleton" aria-hidden="true">
      <div className="rp-scard__top">
        <Skeleton width={64} height={18} />
        <Skeleton width={96} height={12} />
      </div>
      <Skeleton width="55%" height={16} style={{ marginTop: 14 }} />
      <Skeleton width="38%" height={11} style={{ marginTop: 10 }} />
      <div className="rp-scard__tags" style={{ marginTop: 16 }}>
        <Skeleton width={84} height={22} />
        <Skeleton width={70} height={22} />
      </div>
      <div className="rp-scard__foot">
        <Skeleton width={80} height={11} />
        <Skeleton width={72} height={32} radius="md" />
      </div>
    </div>
  );
}

export function ProofBadge({ kind, captured, at }: { kind: ProofKind; captured: boolean; at?: string }) {
  const file = kind === "local" ? "local.txt" : kind === "proof" ? "proof.txt" : "DA proof";
  return (
    <span className={cx("rp-proof", captured && "is-captured")} title={captured && at ? `Captured ${at}` : captured ? "Captured" : "Not captured"}>
      <Icon name={captured ? "check" : "flag"} size={12} strokeWidth={captured ? 2.25 : 1.75} />
      <span className="rp-mono">{file}</span>
      <span className="rp-sr">{captured ? "captured" : "not captured"}</span>
    </span>
  );
}

export type TargetState = "owned" | "reachable" | "internal";

export function hostState(h: Host): TargetState {
  if (h.owned) return "owned";
  if (h.reachable) return "reachable";
  return "internal";
}

export function TargetChip({ host, onClick, active }: { host: Host; onClick?: () => void; active?: boolean }) {
  const st = hostState(host);
  const label = st === "owned" ? "owned" : st === "reachable" ? "reachable" : "internal, not reached";
  const body = (
    <>
      <StatusDot tone={st === "owned" ? "success" : st === "reachable" ? "primary" : "neutral"} hollow={st === "internal"} size="sm" />
      <span className="rp-mono">{host.name}</span>
      <span className="rp-sr">, {label}</span>
    </>
  );
  return onClick ? (
    <Tooltip content={`${host.ip} · ${label}`}>
      <button type="button" className={cx("rp-target", `is-${st}`, active && "is-active")} onClick={onClick} aria-pressed={active}>
        {body}
      </button>
    </Tooltip>
  ) : (
    <span className={cx("rp-target", `is-${st}`)}>{body}</span>
  );
}

export interface TopologyDiagramProps {
  hosts: Host[];
  links: TopologyLink[];
  label: string;
  compact?: boolean;
  showState?: boolean;
  attackerLabel?: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

interface Placed {
  host: Host | null;
  id: string;
  col: number;
  row: number;
}

export function TopologyDiagram({ hosts, links, label, compact, showState = true, attackerLabel = "Your Kali", selectedId, onSelect }: TopologyDiagramProps) {
  const layout = useMemo(() => {
    const depth = new Map<string, number>();
    const facing = hosts.filter((h) => h.exposure === "learner-facing");
    facing.forEach((h) => depth.set(h.id, 1));
    const queue = [...facing.map((h) => h.id)];
    while (queue.length) {
      const id = queue.shift()!;
      const d = depth.get(id)!;
      for (const l of links) {
        const next = l.from === id ? l.to : l.to === id ? l.from : null;
        if (next && next !== "attacker" && !depth.has(next)) {
          depth.set(next, d + 1);
          queue.push(next);
        }
      }
    }
    hosts.forEach((h) => !depth.has(h.id) && depth.set(h.id, 2));
    const cols = new Map<number, Host[]>();
    hosts.forEach((h) => {
      const c = depth.get(h.id)!;
      if (!cols.has(c)) cols.set(c, []);
      cols.get(c)!.push(h);
    });
    const placed: Placed[] = [{ host: null, id: "attacker", col: 0, row: 0 }];
    const maxRows = Math.max(1, ...Array.from(cols.values()).map((v) => v.length));
    Array.from(cols.keys())
      .sort((a, b) => a - b)
      .forEach((c) => {
        const list = cols.get(c)!;
        list.forEach((h, i) => placed.push({ host: h, id: h.id, col: c, row: i + (maxRows - list.length) / 2 }));
      });
    placed[0].row = (maxRows - 1) / 2;
    return { placed, maxCol: Math.max(...placed.map((p) => p.col)), maxRows };
  }, [hosts, links]);

  const W = compact ? 112 : 176;
  const H = compact ? 34 : 64;
  const GX = compact ? 28 : 64;
  const GY = compact ? 14 : 22;
  const PADX = compact ? 8 : 16;
  const PADY = compact ? 10 : 40;
  const width = PADX * 2 + (layout.maxCol + 1) * W + layout.maxCol * GX;
  const height = PADY + 16 + layout.maxRows * H + (layout.maxRows - 1) * GY;
  const pos = (p: Placed) => ({ x: PADX + p.col * (W + GX), y: PADY + p.row * (H + GY) });
  const byId = new Map(layout.placed.map((p) => [p.id, p]));
  const boundaryX = PADX + 2 * (W + GX) - GX / 2;
  const hasInternal = layout.maxCol >= 2;

  const allLinks: TopologyLink[] = [
    ...hosts.filter((h) => h.exposure === "learner-facing").map((h) => ({ from: "attacker", to: h.id, label: compact ? undefined : "tun0" })),
    ...links,
  ];

  return (
    <figure className={cx("rp-topo", compact && "is-compact")}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={label} style={{ maxWidth: width }}>
        {!compact && (
          <g className="rp-topo__zones">
            <text x={PADX} y={18} className="rp-topo__zonelabel">
              REACHABLE FROM YOUR TUNNEL
            </text>
            {hasInternal && (
              <>
                <line x1={boundaryX} x2={boundaryX} y1={8} y2={height - 4} className="rp-topo__boundary" />
                <text x={boundaryX + 12} y={18} className="rp-topo__zonelabel">
                  INTERNAL, PIVOT REQUIRED
                </text>
              </>
            )}
          </g>
        )}
        {allLinks.map((l, i) => {
          const a = byId.get(l.from);
          const b = byId.get(l.to);
          if (!a || !b) return null;
          const pa = pos(a);
          const pb = pos(b);
          const left = pa.x < pb.x ? pa : pb;
          const right = pa.x < pb.x ? pb : pa;
          const x1 = left.x + W;
          const y1 = left.y + H / 2;
          const x2 = right.x;
          const y2 = right.y + H / 2;
          const mx = (x1 + x2) / 2;
          const d = pa.x === pb.x ? `M${pa.x + W / 2},${pa.y + H} L${pb.x + W / 2},${pb.y}` : `M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`;
          const owned = showState && a.host?.owned && b.host?.owned;
          return (
            <g key={i}>
              <path d={d} className={cx("rp-topo__link", owned && "is-owned", l.from === "attacker" && "is-tunnel")} />
              {l.label && !compact && (
                <text x={mx} y={Math.min(y1, y2) - 6} textAnchor="middle" className="rp-topo__linklabel">
                  {l.label}
                </text>
              )}
            </g>
          );
        })}
        {layout.placed.map((p) => {
          const { x, y } = pos(p);
          if (!p.host) {
            return (
              <g key="attacker" transform={`translate(${x},${y})`}>
                <rect width={W} height={H} rx={compact ? 4 : 8} className="rp-topo__node is-attacker" />
                <text x={compact ? 8 : 14} y={compact ? H / 2 : 26} dy={compact ? "0.32em" : undefined} className="rp-topo__name">
                  {compact ? "kali" : attackerLabel}
                </text>
                {!compact && (
                  <text x={14} y={46} className="rp-topo__meta">
                    attack box
                  </text>
                )}
              </g>
            );
          }
          const h = p.host;
          const st = hostState(h);
          const sel = selectedId === h.id;
          return (
            <g
              key={h.id}
              transform={`translate(${x},${y})`}
              className={cx("rp-topo__g", onSelect && "is-interactive")}
              onClick={onSelect ? () => onSelect(h.id) : undefined}
            >
              <rect width={W} height={H} rx={compact ? 4 : 8} className={cx("rp-topo__node", showState && `is-${st}`, sel && "is-selected", h.exposure === "internal" && "is-internal")} />
              {showState && <circle cx={W - (compact ? 9 : 14)} cy={compact ? H / 2 : 16} r={compact ? 3 : 3.5} className={cx("rp-topo__dot", `is-${st}`)} />}
              <text x={compact ? 8 : 14} y={compact ? H / 2 : 26} dy={compact ? "0.32em" : undefined} className="rp-topo__name">
                {h.name}
              </text>
              {!compact && (
                <text x={14} y={46} className="rp-topo__meta">
                  {h.ip} · {h.os === "windows" ? "Windows" : "Linux"}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {!compact && (
        <figcaption className="rp-topo__legend">
          {showState && (
            <>
              <StatusDot tone="success" label="Owned" size="sm" />
              <StatusDot tone="primary" label="Reachable" size="sm" />
              <StatusDot tone="neutral" hollow label="Not reached" size="sm" />
            </>
          )}
          <span className="rp-topo__legendline">
            <span className="rp-topo__swatch is-tunnel" aria-hidden="true" />
            OpenVPN tunnel
          </span>
        </figcaption>
      )}
      <ul className="rp-sr">
        {hosts.map((h) => (
          <li key={h.id}>
            {h.name}, {h.ip}, {h.role}, {h.exposure === "learner-facing" ? "reachable from your tunnel" : "internal, pivot required"}
            {showState ? `, ${hostState(h)}` : ""}
          </li>
        ))}
      </ul>
    </figure>
  );
}
