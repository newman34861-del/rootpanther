import { useSearchParams } from "react-router-dom";
import { Button, Card, EmptyState, StatusDot, useToast } from "@rootpanther/ui";
import type { Tone } from "@rootpanther/ui";
import { CONTENT_STATUS_LABEL } from "../../mock/content";
import type { ContentStatus, SolveResult } from "../../mock/content";

export function useRetry() {
  const [params, setParams] = useSearchParams();
  return () => {
    const p = new URLSearchParams(params);
    p.delete("state");
    setParams(p, { replace: true });
  };
}

export function secs(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

const STATUS_TONE: Record<ContentStatus, Tone> = { draft: "neutral", "in-review": "med", published: "primary", retired: "neutral" };

export function ContentStatusDot({ status }: { status: ContentStatus }) {
  return <StatusDot tone={STATUS_TONE[status]} hollow={status === "retired" || status === "draft"} size="sm" label={CONTENT_STATUS_LABEL[status]} />;
}

export function SolveDot({ result, label }: { result: SolveResult; label?: string }) {
  if (result === "pass") return <StatusDot tone="success" size="sm" label={label ?? "Passed"} />;
  if (result === "fail") return <StatusDot tone="crit" size="sm" label={label ?? "Failed"} />;
  return <StatusDot tone="neutral" hollow size="sm" label={label ?? "Not run"} />;
}

export function Denied() {
  const toast = useToast();
  return (
    <Card padding="lg">
      <EmptyState
        icon="lock"
        title={
          <>
            Content requires the <span className="rp-mono">content</span> role
          </>
        }
        action={
          <Button size="sm" iconLeft="key" onClick={() => toast.push({ title: "Access requested", detail: "Owners were asked to grant you the content role.", tone: "info" })}>
            Request access
          </Button>
        }
      >
        Your role is <span className="rp-mono rp-strong">support</span>. Scenario sources, solve-test results and randomisation seeds stay hidden until an owner grants access.
      </EmptyState>
    </Card>
  );
}
