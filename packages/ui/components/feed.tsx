import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../icons";
import type { IconName } from "../icons";
import { cx, formatRelative, toneInk, toneVar } from "../format";
import type { ActivityItem, ActivityKind, Tone } from "../types";
import { UiLink } from "./Link";
import { Skeleton } from "./display";

const KIND_ICON: Record<ActivityKind, IconName> = {
  "lab-started": "play",
  "lab-ended": "stop",
  proof: "flag",
  report: "document",
  tier: "route",
  debrief: "chat",
  signup: "user",
  upgrade: "arrow-up-right",
  cancel: "x-circle",
  "payment-failed": "card",
  "provision-failed": "server",
  launch: "flask",
  alert: "warning",
};

export interface TimelineItem {
  id: string;
  title: ReactNode;
  detail?: ReactNode;
  at: string;
  atLabel?: string;
  tone?: Tone;
  icon?: IconName;
  href?: string;
}

export interface TimelineProps {
  items: TimelineItem[];
  label: string;
  loading?: boolean;
  dense?: boolean;
  absoluteTime?: (iso: string) => string;
}

export function Timeline({ items, label, loading, dense, absoluteTime }: TimelineProps) {
  if (loading) {
    return (
      <ol className={cx("rp-timeline", dense && "is-dense")} aria-label={label} aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="rp-timeline__item">
            <span className="rp-timeline__node" />
            <div className="rp-timeline__body">
              <Skeleton width={`${50 + i * 9}%`} height={10} />
              <Skeleton width="30%" height={9} style={{ marginTop: 8 }} />
            </div>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ol className={cx("rp-timeline", dense && "is-dense")} aria-label={label}>
      {items.map((it) => {
        const style = { "--tone": toneVar(it.tone), "--tone-ink": toneInk(it.tone) } as CSSProperties;
        const title = it.href ? (
          <UiLink to={it.href} className="rp-timeline__title is-link">
            {it.title}
          </UiLink>
        ) : (
          <span className="rp-timeline__title">{it.title}</span>
        );
        return (
          <li key={it.id} className={cx("rp-timeline__item", it.tone && it.tone !== "neutral" && "is-toned")} style={style}>
            <span className="rp-timeline__node" aria-hidden="true">
              {it.icon && <Icon name={it.icon} size={12} />}
            </span>
            <div className="rp-timeline__body">
              <div className="rp-timeline__row">
                {title}
                <time dateTime={it.at} className="rp-timeline__time" title={absoluteTime?.(it.at)}>
                  {it.atLabel ?? formatRelative(it.at)}
                </time>
              </div>
              {it.detail && <div className="rp-timeline__detail">{it.detail}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export interface ActivityFeedProps {
  items: ActivityItem[];
  label: string;
  loading?: boolean;
  live?: boolean;
  empty?: ReactNode;
  maxHeight?: number;
}

export function ActivityFeed({ items, label, loading, live, empty, maxHeight }: ActivityFeedProps) {
  return (
    <div className="rp-feed" style={{ maxHeight }} tabIndex={maxHeight ? 0 : undefined} role={maxHeight ? "region" : undefined} aria-label={maxHeight ? label : undefined}>
      <ul aria-label={label} aria-live={live ? "polite" : undefined} aria-busy={loading || undefined}>
        {loading &&
          Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="rp-feed__item">
              <Skeleton width={24} height={24} radius="md" />
              <div className="rp-feed__body">
                <Skeleton width={`${40 + ((i * 17) % 40)}%`} height={10} />
                <Skeleton width="25%" height={9} style={{ marginTop: 7 }} />
              </div>
            </li>
          ))}
        {!loading && items.length === 0 && empty}
        {!loading &&
          items.map((it) => {
            const style = { "--tone": toneInk(it.tone) } as CSSProperties;
            const body = (
              <>
                <span className={cx("rp-feed__icon", it.tone && it.tone !== "neutral" && "is-toned")} style={style} aria-hidden="true">
                  <Icon name={KIND_ICON[it.kind]} size={13} />
                </span>
                <div className="rp-feed__body">
                  <div className="rp-feed__title">{it.title}</div>
                  {it.detail && <div className="rp-feed__detail rp-truncate">{it.detail}</div>}
                </div>
                <time dateTime={it.at} className="rp-feed__time rp-mono rp-num">
                  {formatRelative(it.at)}
                </time>
              </>
            );
            return (
              <li key={it.id} className="rp-feed__item">
                {it.href ? (
                  <UiLink to={it.href} className="rp-feed__link">
                    {body}
                  </UiLink>
                ) : (
                  body
                )}
              </li>
            );
          })}
      </ul>
    </div>
  );
}
