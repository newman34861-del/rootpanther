import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, EmptyState, formatDuration, formatMoney, useInterval, useToast } from "@rootpanther/ui";
import type { Tone } from "@rootpanther/ui";
import { STATE_LABEL } from "../../mock/fleet";
import type { Tenant, TenantState } from "../../mock/fleet";

const MOUNT = Date.now();

export function useNow(ms: number) {
  const [now, setNow] = useState(MOUNT);
  useInterval(() => setNow(Date.now()), ms);
  return now;
}

export function useRetry() {
  const [params, setParams] = useSearchParams();
  return () => {
    const p = new URLSearchParams(params);
    p.delete("state");
    setParams(p, { replace: true });
  };
}

export function usd(n: number) {
  return formatMoney(n, "USD", 2);
}

export function perHour(n: number) {
  return `${formatMoney(n, "USD", 2)}/h`;
}

export function dur(min: number) {
  return formatDuration(Math.max(0, min));
}

export function secs(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  if (!m) return `${r}s`;
  return r ? `${m}m ${String(r).padStart(2, "0")}s` : `${m}m`;
}

export const STATE_TONE: Record<TenantState, Tone> = {
  provisioning: "info",
  running: "primary",
  idle: "med",
  "tearing-down": "neutral",
  failed: "crit",
};

export function stateLabel(s: TenantState) {
  return STATE_LABEL[s];
}

export function live(t: Tenant, now: number): Tenant {
  const drift = (now - MOUNT) / 60000;
  if (t.state === "failed" || t.state === "tearing-down") return t;
  const elapsedMin = t.elapsedMin + drift;
  const idleMin = t.state === "idle" ? t.idleMin + drift : t.idleMin;
  return {
    ...t,
    elapsedMin,
    idleMin,
    teardownInMin: t.teardownBy === "none" ? t.teardownInMin : t.teardownInMin - drift,
    costSoFar: (t.hourly * elapsedMin) / 60,
    orphan: t.orphan ? { ...t.orphan, sinceMin: t.orphan.sinceMin + drift } : undefined,
  };
}

export function useScrollTo(selector: string | null, ready: boolean, block: ScrollLogicalPosition = "start") {
  useEffect(() => {
    if (!selector || !ready) return;
    const t = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) return;
      el.scrollIntoView({ block });
      if (el.hasAttribute("tabindex")) el.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(t);
  }, [selector, ready, block]);
}

export function Denied() {
  const toast = useToast();
  return (
    <Card padding="lg">
      <EmptyState
        icon="lock"
        title={
          <>
            Fleet requires the <span className="rp-mono">infra</span> role
          </>
        }
        action={
          <Button size="sm" iconLeft="key" onClick={() => toast.push({ title: "Access requested", detail: "Owners were asked to grant you the infra role.", tone: "info" })}>
            Request access
          </Button>
        }
      >
        Your role is <span className="rp-mono rp-strong">support</span>. Tenants, Azure capacity and isolation results stay hidden until an owner grants access.
      </EmptyState>
    </Card>
  );
}
