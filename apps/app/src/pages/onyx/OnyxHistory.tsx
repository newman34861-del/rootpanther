import { useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  OnyxTranscript,
  Skeleton,
  StatusDot,
  formatDate,
  helpLabel,
} from "@rootpanther/ui";
import { history } from "../../mock/onyx";
import type { HistoryEntry } from "../../mock/onyx";
import type { DataState } from "../../review/review";

function firstLine(entry: HistoryEntry): string {
  const m = entry.messages.find((x) => x.role === "you");
  return m?.text ?? entry.messages[0]?.text ?? "";
}

function HistoryRow({ entry, active, onSelect }: { entry: HistoryEntry; active: boolean; onSelect: () => void }) {
  const scenario = entry.context.kind === "scenario";
  return (
    <button type="button" className={active ? "ox-hist is-active" : "ox-hist"} onClick={onSelect} aria-pressed={active}>
      <span className="ox-hist__date rp-mono rp-num">{formatDate(entry.at, { day: "numeric", month: "short" })}</span>
      <span className="ox-hist__main">
        <span className="ox-hist__ctx">
          <StatusDot tone={scenario ? "primary" : "premium"} size="sm" hollow={!scenario} />
          <span className="ox-hist__label">{entry.context.label}</span>
        </span>
        <span className="ox-hist__first">{firstLine(entry)}</span>
      </span>
      <span className="ox-hist__count rp-mono rp-num">{entry.messages.filter((m) => m.role !== "system").length} msgs</span>
    </button>
  );
}

export function OnyxHistory({ state }: { state: DataState }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(history[0]?.id ?? null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter((e) => e.context.label.toLowerCase().includes(q) || e.messages.some((m) => m.text.toLowerCase().includes(q)));
  }, [query]);

  const current = history.find((e) => e.id === selected) ?? filtered[0];

  if (state === "loading") {
    return (
      <Card padding="none">
        <div style={{ padding: 16 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{ padding: "12px 0", borderBottom: "1px solid var(--divider)" }}>
              <Skeleton width="30%" height={11} />
              <Skeleton width="60%" height={13} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      </Card>
    );
  }
  if (state === "error") {
    return (
      <Card>
        <ErrorState title="History did not load" onRetry={() => window.location.reload()} reference="req_hs1192">
          Past conversations could not be reached. Your running labs are not affected.
        </ErrorState>
      </Card>
    );
  }
  if (state === "empty" || history.length === 0) {
    return (
      <Card>
        <EmptyState icon="history" title="No conversations yet">
          Conversations with Onyx in mentor mode and in labs are kept here so you can reread them.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="ox-histview">
      <div className="rp-stack" style={{ ["--gap" as string]: "12px" }}>
        <Input icon="search" placeholder="Search conversations" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search conversations" />
        {filtered.length === 0 ? (
          <Card>
            <EmptyState compact icon="search" title="No matches" action={<Button size="sm" variant="secondary" onClick={() => setQuery("")}>Clear search</Button>}>
              No conversation mentions <span className="rp-strong">{query}</span>.
            </EmptyState>
          </Card>
        ) : (
          <div className="ox-histview__list">
            <ul className="ox-history">
              {filtered.map((e) => (
                <li key={e.id}>
                  <HistoryRow entry={e} active={current?.id === e.id} onSelect={() => setSelected(e.id)} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {current && (
        <Card
          padding="none"
          title={current.context.label}
          meta={
            <span className="rp-mono rp-num">
              {formatDate(current.at, { day: "numeric", month: "short", year: "numeric" })} · {helpLabel(current.level)}
            </span>
          }
          actions={<span className="rp-small">Read only</span>}
        >
          <div className="ox-readonly">
            <OnyxTranscript messages={current.messages} label={`Conversation on ${current.context.label}`} />
          </div>
        </Card>
      )}
    </div>
  );
}
