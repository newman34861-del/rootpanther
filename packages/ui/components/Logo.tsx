import { useId } from "react";
import type { ReactNode } from "react";
import { cx } from "../format";

export const CLAW_PATHS = [
  "M15.14 4.17Q16.04 14.84 6.69 20.06Q9.77 11.50 15.14 4.17Z",
  "M21.05 6.91Q21.12 19.12 10.95 25.89Q14.85 15.79 21.05 6.91Z",
  "M26.62 10.27Q27.52 20.94 18.17 26.16Q21.25 17.61 26.62 10.27Z",
];

export function ClawMark({ size = 28, tile = true, title, className }: { size?: number; tile?: boolean; title?: string; className?: string }) {
  const gid = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cx("rp-claw", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`claw-${gid}`} x1="26" y1="5" x2="6" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--logo-from)" }} />
          <stop offset="1" style={{ stopColor: "var(--logo-to)" }} />
        </linearGradient>
      </defs>
      {tile && <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" vectorEffect="non-scaling-stroke" style={{ fill: "var(--logo-tile)", stroke: "var(--logo-edge)" }} />}
      {CLAW_PATHS.map((d) => (
        <path key={d} d={d} fill={`url(#claw-${gid})`} />
      ))}
    </svg>
  );
}

export interface LockupProps {
  size?: "sm" | "md" | "lg";
  badge?: ReactNode;
  tagline?: string;
  className?: string;
  collapsed?: boolean;
  onChrome?: boolean;
}

export function Lockup({ size = "md", badge, tagline, className, collapsed, onChrome }: LockupProps) {
  const mark = size === "lg" ? 36 : size === "sm" ? 24 : 28;
  return (
    <span className={cx("rp-lockup", `rp-lockup--${size}`, onChrome && "is-chrome", className)}>
      <ClawMark size={mark} />
      {!collapsed && (
        <span className="rp-lockup__text">
          <span className="rp-lockup__row">
            <span className="rp-lockup__word">Rootpanther</span>
            {badge && <span className="rp-lockup__badge">{badge}</span>}
          </span>
          {tagline && <span className="rp-lockup__tag">{tagline}</span>}
        </span>
      )}
    </span>
  );
}

export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path style={{ fill: "var(--brand-google-red)" }} d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path style={{ fill: "var(--brand-google-blue)" }} d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path style={{ fill: "var(--brand-google-yellow)" }} d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path style={{ fill: "var(--brand-google-green)" }} d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function MicrosoftMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 23 23" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" style={{ fill: "var(--brand-ms-red)" }} />
      <rect x="12" y="1" width="10" height="10" style={{ fill: "var(--brand-ms-green)" }} />
      <rect x="1" y="12" width="10" height="10" style={{ fill: "var(--brand-ms-blue)" }} />
      <rect x="12" y="12" width="10" height="10" style={{ fill: "var(--brand-ms-yellow)" }} />
    </svg>
  );
}

export function GitHubMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        style={{ fill: "var(--brand-github)" }}
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

export function StripeMark({ height = 16 }: { height?: number }) {
  return (
    <span className="rp-stripemark" style={{ fontSize: height }} aria-label="Stripe">
      stripe
    </span>
  );
}

export type Provider = "google" | "microsoft" | "github";

export const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "microsoft", label: "Microsoft" },
  { id: "github", label: "GitHub" },
];

export function ProviderMark({ provider, size = 18 }: { provider: Provider; size?: number }) {
  if (provider === "google") return <GoogleMark size={size} />;
  if (provider === "microsoft") return <MicrosoftMark size={size} />;
  return <GitHubMark size={size} />;
}
