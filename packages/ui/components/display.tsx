import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../icons";
import type { IconName } from "../icons";
import { cx, toneInk, toneVar } from "../format";
import type { Tone } from "../types";

export interface TagProps {
  children: ReactNode;
  mono?: boolean;
  icon?: IconName;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
  title?: string;
}

export function Tag({ children, mono, icon, onRemove, removeLabel, className, title }: TagProps) {
  return (
    <span className={cx("rp-tag", mono && "rp-mono", className)} title={title}>
      {icon && <Icon name={icon} size={12} />}
      <span className="rp-truncate">{children}</span>
      {onRemove && (
        <button type="button" className="rp-tag__remove" onClick={onRemove} aria-label={removeLabel ?? "Remove"}>
          <Icon name="x" size={11} />
        </button>
      )}
    </span>
  );
}

export interface StatusDotProps {
  tone?: Tone;
  label?: ReactNode;
  hollow?: boolean;
  size?: "sm" | "md";
  className?: string;
  mono?: boolean;
  title?: string;
}

export function StatusDot({ tone = "neutral", label, hollow, size = "md", className, mono, title }: StatusDotProps) {
  const style = { "--tone": toneVar(tone), "--tone-ink": toneInk(tone) } as CSSProperties;
  return (
    <span className={cx("rp-status", `rp-status--${size}`, tone === "neutral" && "is-neutral", mono && "rp-mono", className)} style={style} title={title}>
      <span className={cx("rp-status__dot", hollow && "is-hollow")} aria-hidden="true" />
      {label !== undefined && <span className="rp-status__label">{label}</span>}
    </span>
  );
}

export interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}

export function Badge({ children, tone = "neutral", className, title }: BadgeProps) {
  const style = tone === "neutral" ? undefined : ({ "--tone": toneInk(tone) } as CSSProperties);
  return (
    <span className={cx("rp-badge", tone !== "neutral" && "is-toned", className)} style={style} title={title}>
      {children}
    </span>
  );
}

export interface AvatarProps {
  initials: string;
  name?: string;
  size?: 24 | 28 | 32 | 40 | 56;
  src?: string;
  className?: string;
}

export function Avatar({ initials, name, size = 32, src, className }: AvatarProps) {
  return (
    <span
      className={cx("rp-avatar", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      role={name ? "img" : undefined}
      aria-label={name}
      aria-hidden={name ? undefined : true}
    >
      {src ? <img src={src} alt="" /> : initials.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function Spinner({ size = 16, label, className }: { size?: number; label?: string; className?: string }) {
  return (
    <span className={cx("rp-spinner", className)} role={label ? "status" : undefined} aria-label={label} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.5" />
        <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ width = "100%", height = 12, radius = "sm", className, style }: SkeletonProps) {
  return <span className={cx("rp-skeleton", `rp-skeleton--${radius}`, className)} style={{ width, height, ...style }} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, widths }: { lines?: number; widths?: (number | string)[] }) {
  return (
    <span className="rp-skeleton-text" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={widths?.[i] ?? (i === lines - 1 ? "62%" : "100%")} height={10} />
      ))}
    </span>
  );
}

export function LoadingRegion({ label = "Loading", children }: { label?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="rp-loading-region">
      <span className="rp-sr">{label}</span>
      {children}
    </div>
  );
}

export interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: Tone;
  label?: string;
  hideLabel?: boolean;
  showValue?: boolean;
  size?: "sm" | "md";
  className?: string;
  marker?: number;
}

export function ProgressBar({ value, max = 100, tone = "primary", label, hideLabel, showValue, size = "md", className, marker }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cx("rp-progress", `rp-progress--${size}`, className)}>
      {((label && !hideLabel) || showValue) && (
        <div className="rp-progress__head">
          {label && !hideLabel && <span>{label}</span>}
          {showValue && <span className="rp-mono rp-num">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        className="rp-progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
      >
        <span className="rp-progress__fill" style={{ width: `${pct}%`, background: toneVar(tone) }} />
        {marker !== undefined && <span className="rp-progress__marker" style={{ left: `${(marker / max) * 100}%` }} />}
      </div>
    </div>
  );
}

export interface MeterProps {
  value: number;
  segments?: number;
  verified?: boolean;
  label: string;
  className?: string;
}

export function Meter({ value, segments = 5, verified, label, className }: MeterProps) {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * segments);
  return (
    <div
      className={cx("rp-meter", verified && "is-verified", className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={segments}
      aria-valuenow={filled}
      aria-label={label}
      aria-valuetext={`${filled} of ${segments}${verified ? ", verified" : ""}`}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={cx("rp-meter__seg", i < filled && "is-on")} />
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}

export interface KeyValueProps {
  items: { label: ReactNode; value: ReactNode; mono?: boolean }[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function KeyValue({ items, columns = 2, className }: KeyValueProps) {
  return (
    <dl className={cx("rp-kv", className)} style={{ ["--cols" as string]: columns }}>
      {items.map((it, i) => (
        <div key={i} className="rp-kv__item">
          <dt>{it.label}</dt>
          <dd className={it.mono ? "rp-mono" : undefined}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface CalloutProps {
  tone?: Tone;
  icon?: IconName;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  role?: "status" | "alert";
}

export function Callout({ tone = "info", icon, title, children, action, className, role }: CalloutProps) {
  const ic: IconName = icon ?? (tone === "crit" ? "alert-circle" : tone === "med" || tone === "high" ? "warning" : tone === "success" ? "check-circle" : "info");
  return (
    <div className={cx("rp-callout", className)} style={{ "--tone": toneInk(tone), "--tone-rule": toneVar(tone) } as CSSProperties} role={role}>
      <Icon name={ic} size={16} className="rp-callout__icon" />
      <div className="rp-callout__body">
        {title && <div className="rp-callout__title">{title}</div>}
        {children && <div className="rp-callout__text">{children}</div>}
      </div>
      {action && <div className="rp-callout__action">{action}</div>}
    </div>
  );
}
