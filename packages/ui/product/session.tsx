import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import QRCode from "qrcode";
import { Icon } from "../icons";
import { cx, formatClock, formatDate, formatNumber } from "../format";
import type { ConnectionMethod } from "../types";
import { Button } from "../components/controls";
import { Spinner, StatusDot } from "../components/display";
import { CodeBlock, CopyField } from "../components/code";

export function useCountdown(initialSeconds: number, running = true) {
  const [s, setS] = useState(initialSeconds);
  useEffect(() => setS(initialSeconds), [initialSeconds]);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setS((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return s;
}

export interface SessionTimerProps {
  seconds: number;
  label?: string;
  warnBelow?: number;
  critBelow?: number;
  size?: "sm" | "md" | "lg";
  icon?: boolean;
}

export function SessionTimer({ seconds, label = "Session ends in", warnBelow = 15 * 60, critBelow = 2 * 60, size = "md", icon = true }: SessionTimerProps) {
  const tone = seconds <= critBelow ? "crit" : seconds <= warnBelow ? "med" : "neutral";
  const minutes = Math.ceil(seconds / 60);
  return (
    <span className={cx("rp-timer", `rp-timer--${size}`, `is-${tone}`)}>
      {icon && <Icon name="timer" size={size === "lg" ? 16 : 14} />}
      <span className="rp-timer__label">{label}</span>
      <span className="rp-timer__value rp-mono rp-num" role="timer" aria-live="off" aria-label={`${label} ${minutes} minutes`}>
        {formatClock(seconds)}
      </span>
    </span>
  );
}

export interface UsageMeterProps {
  usedHours: number;
  allowanceHours: number;
  resetsOn: string;
  compact?: boolean;
  label?: string;
  footer?: ReactNode;
}

export function UsageMeter({ usedHours, allowanceHours, resetsOn, compact, label = "Lab hours this period", footer }: UsageMeterProps) {
  const pct = Math.min(100, (usedHours / allowanceHours) * 100);
  const over = usedHours > allowanceHours;
  const near = !over && pct >= 80;
  const tone = over ? "var(--crit)" : near ? "var(--med)" : "var(--primary)";
  const remaining = Math.max(0, allowanceHours - usedHours);
  return (
    <div className={cx("rp-usage", compact && "is-compact")} style={{ "--tone": tone } as CSSProperties}>
      <div className="rp-usage__head">
        <span className="rp-usage__label">{label}</span>
        <span className="rp-usage__figure rp-mono rp-num">
          <span className="rp-strong">{formatNumber(usedHours, 1)}</span> / {allowanceHours} h
        </span>
      </div>
      <div className="rp-usage__track" role="meter" aria-valuemin={0} aria-valuemax={allowanceHours} aria-valuenow={usedHours} aria-label={label} aria-valuetext={`${formatNumber(usedHours, 1)} of ${allowanceHours} hours used`}>
        <span className="rp-usage__fill" style={{ width: `${pct}%` }} />
        <span className="rp-usage__tick" style={{ left: "80%" }} aria-hidden="true" />
      </div>
      <div className="rp-usage__foot">
        <span>
          {over ? (
            <span style={{ color: "var(--crit)" }}>Over allowance by {formatNumber(usedHours - allowanceHours, 1)} h</span>
          ) : (
            <>
              <span className="rp-mono rp-num">{formatNumber(remaining, 1)} h</span> left
            </>
          )}
        </span>
        <span>Resets {formatDate(resetsOn, { day: "numeric", month: "short" })}</span>
      </div>
      {footer}
    </div>
  );
}

export function QrCode({ value, size = 132, label }: { value: string; size?: number; label: string }) {
  const { path, n } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const count = qr.modules.size;
    let d = "";
    for (let y = 0; y < count; y++) {
      for (let x = 0; x < count; x++) {
        if (qr.modules.get(x, y)) d += `M${x + 2},${y + 2}h1v1h-1z`;
      }
    }
    return { path: d, n: count + 4 };
  }, [value]);
  return (
    <svg className="rp-qr" width={size} height={size} viewBox={`0 0 ${n} ${n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={n} height={n} className="rp-qr__bg" />
      <path d={path} className="rp-qr__fg" />
    </svg>
  );
}

export type ConnectionTest = "untested" | "testing" | "connected" | "failed";

export interface ConnectionCardProps {
  method: ConnectionMethod;
  isDefault?: boolean;
  onMakeDefault?: () => void;
  test?: ConnectionTest;
  onTest?: () => void;
  endpoint?: string;
  tunnelAddress?: string;
  onDownload?: () => void;
  onOpenTerminal?: () => void;
  sessionActive?: boolean;
  lastSeen?: string;
  troubleshootHref?: string;
}

const TEST_LABEL: Record<ConnectionTest, string> = {
  untested: "Not tested",
  testing: "Testing",
  connected: "Connected",
  failed: "No response",
};

export function ConnectionCard({
  method,
  isDefault,
  onMakeDefault,
  test = "untested",
  onTest,
  endpoint,
  tunnelAddress,
  onDownload,
  onOpenTerminal,
  sessionActive,
  lastSeen,
  troubleshootHref,
}: ConnectionCardProps) {
  const browser = method === "browser";
  return (
    <section className={cx("rp-conn", isDefault && "is-default")} aria-labelledby={`conn-${method}`}>
      <header className="rp-conn__head">
        <span className="rp-conn__icon" aria-hidden="true">
          <Icon name={browser ? "monitor" : "network"} size={18} />
        </span>
        <div className="rp-conn__titles">
          <h3 id={`conn-${method}`}>{browser ? "In-browser terminal" : "Your own Kali over OpenVPN"}</h3>
          <span className="rp-conn__sub">{browser ? "Hosted Kali. No setup." : "Your tools, your machine, a tunnel into the lab."}</span>
        </div>
        {isDefault ? (
          <span className="rp-conn__default">
            <Icon name="check" size={13} />
            Default
          </span>
        ) : (
          onMakeDefault && (
            <button type="button" className="rp-link rp-small" onClick={onMakeDefault}>
              Make default
            </button>
          )
        )}
      </header>
      {browser ? (
        <div className="rp-conn__body">
          <ul className="rp-conn__facts">
            <li>
              <Icon name="check" size={13} />
              Kali rolling with tmux, a persistent home and multiple tabs
            </li>
          </ul>
          {onOpenTerminal && sessionActive && (
            <Button iconLeft="terminal" onClick={onOpenTerminal}>
              Open terminal
            </Button>
          )}
          {!sessionActive && onOpenTerminal && <p className="rp-conn__note">Available while a lab session is running.</p>}
        </div>
      ) : (
        <div className="rp-conn__body rp-conn__body--wg">
          <div className="rp-conn__wg">
            <div className="rp-conn__fields">
              {endpoint && <CopyField label="Endpoint" value={endpoint} />}
              {tunnelAddress && <CopyField label="Your tunnel address" value={tunnelAddress} />}
              <div className="rp-conn__test">
                <StatusDot
                  tone={test === "connected" ? "success" : test === "failed" ? "crit" : "neutral"}
                  hollow={test === "untested"}
                  label={
                    <span>
                      {TEST_LABEL[test]}
                      {test === "connected" && lastSeen ? <span className="rp-conn__hs"> · {lastSeen}</span> : null}
                    </span>
                  }
                />
                {test === "testing" ? (
                  <Spinner size={14} label="Testing connection" />
                ) : (
                  onTest && (
                    <button type="button" className="rp-link rp-small" onClick={onTest} disabled={!sessionActive}>
                      Test connection
                    </button>
                  )
                )}
                {troubleshootHref && (
                  <a className="rp-link rp-small" href={troubleshootHref}>
                    Troubleshooting
                  </a>
                )}
              </div>
            </div>
          </div>
          <CodeBlock label="How to connect" prompt="$" code={"sudo openvpn rootpanther-lab.ovpn\nping -c 2 10.13.37.1"} />
          {onDownload && (
            <div className="rp-conn__actions">
              <Button iconLeft="download" onClick={onDownload}>
                Download .ovpn
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
