import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Button, Card, EmptyState, Icon, useToast } from "@rootpanther/ui";

export function useRetry() {
  const [params, setParams] = useSearchParams();
  return () => {
    const p = new URLSearchParams(params);
    p.delete("state");
    setParams(p, { replace: true });
  };
}

export function useHashScroll(ready = true) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return;
    const t = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" }), 80);
    return () => window.clearTimeout(t);
  }, [hash, ready]);
}

export function relSpan(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const span = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${Math.max(1, m)}m`;
  return diff >= 0 ? `in ${span}` : `${span} ago`;
}

export function money(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function StripeLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="bo-ext" aria-label={`Open ${label} in Stripe (opens in a new tab)`} title="Open in Stripe">
      <Icon name="external" size={13} />
    </a>
  );
}

export function Denied() {
  const toast = useToast();
  return (
    <Card padding="lg">
      <EmptyState
        icon="lock"
        title={
          <>
            Billing requires the <span className="rp-mono">billing</span> role
          </>
        }
        action={
          <Button size="sm" iconLeft="key" onClick={() => toast.push({ title: "Access requested", detail: "Owners were asked to grant you the billing role.", tone: "info" })}>
            Request access
          </Button>
        }
      >
        Your role is <span className="rp-mono rp-strong">support</span>. Subscriptions, invoices, refunds and payment details stay hidden until an owner grants access.
      </EmptyState>
    </Card>
  );
}
