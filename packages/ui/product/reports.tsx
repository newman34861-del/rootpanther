import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { Icon } from "../icons";
import type { IconName } from "../icons";
import { cx, formatTime } from "../format";
import type { EvidenceItem, EvidenceKind, ReportSection } from "../types";
import { SegmentedControl } from "../components/controls";
import { EmptyState } from "../components/layout";
import { Skeleton } from "../components/display";

const STATE_LABEL: Record<ReportSection["state"], string> = { empty: "Empty", draft: "Draft", done: "Complete" };

export interface ReportOutlineProps {
  sections: ReportSection[];
  selectedId: string;
  onSelect: (id: string) => void;
  loading?: boolean;
}

export function ReportOutline({ sections, selectedId, onSelect, loading }: ReportOutlineProps) {
  if (loading) {
    return (
      <nav className="rp-outline" aria-busy="true" aria-label="Report outline, loading">
        <div className="rp-outline__head">
          <Skeleton width={64} height={10} />
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} width={`${i % 4 === 0 ? 70 : 52 + ((i * 11) % 30)}%`} height={10} style={{ margin: "11px 8px" }} />
        ))}
      </nav>
    );
  }
  const roots = sections.filter((s) => !s.parentId);
  const done = sections.filter((s) => s.state === "done").length;
  function item(s: ReportSection, nested: boolean) {
    const kids = sections.filter((c) => c.parentId === s.id);
    return (
      <li key={s.id}>
        <button
          type="button"
          className={cx("rp-outline__item", nested && "is-nested", s.id === selectedId && "is-on")}
          aria-current={s.id === selectedId ? "true" : undefined}
          onClick={() => onSelect(s.id)}
        >
          <span className={cx("rp-outline__state", `is-${s.state}`)} aria-hidden="true" />
          <span className={cx("rp-truncate", s.host && "rp-mono")}>{s.title}</span>
          <span className="rp-sr">, {STATE_LABEL[s.state]}</span>
        </button>
        {kids.length > 0 && <ul>{kids.map((k) => item(k, true))}</ul>}
      </li>
    );
  }
  return (
    <nav className="rp-outline" aria-label="Report outline">
      <div className="rp-outline__head">
        <span className="rp-eyebrow">Outline</span>
        <span className="rp-mono rp-num rp-small">
          {done}/{sections.length} complete
        </span>
      </div>
      <ul>{roots.map((r) => item(r, false))}</ul>
    </nav>
  );
}

const KIND_ICON: Record<EvidenceKind, IconName> = { command: "terminal", note: "note", screenshot: "camera", proof: "flag" };

export interface EvidenceTrayProps {
  items: EvidenceItem[];
  onInsert: (item: EvidenceItem) => void;
  hosts?: string[];
  loading?: boolean;
  showHeading?: boolean;
}

export function evidenceToMarkdown(e: EvidenceItem): string {
  if (e.kind === "command") return `\`\`\`\n${e.command}\n\`\`\`\n\n\`\`\`\n${e.output ?? ""}\n\`\`\``;
  if (e.kind === "screenshot") return `![${e.text ?? "Screenshot"}](evidence/${e.id}.png)`;
  if (e.kind === "proof") return `Proof on ${e.host}: \`${e.text}\``;
  return e.text ?? "";
}

export function EvidenceTray({ items, onInsert, hosts = [], loading, showHeading = true }: EvidenceTrayProps) {
  const [kind, setKind] = useState<"all" | EvidenceKind>("all");
  const [host, setHost] = useState<string>("all");
  const shown = useMemo(() => items.filter((i) => (kind === "all" || i.kind === kind) && (host === "all" || i.host === host)), [items, kind, host]);

  function onDragStart(e: DragEvent, item: EvidenceItem) {
    e.dataTransfer.setData("text/plain", evidenceToMarkdown(item));
    e.dataTransfer.setData("application/x-rp-evidence", item.id);
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <aside className="rp-tray" aria-label="Evidence tray">
      {showHeading && (
        <div className="rp-tray__head">
          <span className="rp-eyebrow">Evidence</span>
          <span className="rp-mono rp-num rp-small">{items.length}</span>
        </div>
      )}
      <div className="rp-tray__filters">
        <SegmentedControl
          size="sm"
          label="Evidence type"
          value={kind}
          onChange={setKind}
          block
          options={[
            { value: "all", label: "All" },
            { value: "command", label: "Cmd" },
            { value: "note", label: "Notes" },
            { value: "screenshot", label: "Shots" },
            { value: "proof", label: "Proofs" },
          ]}
        />
        {hosts.length > 0 && (
          <div className="rp-tray__hosts" role="group" aria-label="Filter by host">
            {["all", ...hosts].map((h) => (
              <button key={h} type="button" className={cx("rp-tray__host", host === h && "is-on", h !== "all" && "rp-mono")} aria-pressed={host === h} onClick={() => setHost(h)}>
                {h === "all" ? "All hosts" : h}
              </button>
            ))}
          </div>
        )}
      </div>
      {loading ? (
        <div className="rp-tray__list" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={92} radius="md" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState compact icon="note" title="No evidence here">
          Run <code>note</code> in the lab to capture the last command and its output.
        </EmptyState>
      ) : (
        <ul className="rp-tray__list">
          {shown.map((e) => (
            <li key={e.id} className={cx("rp-evi", e.used && "is-used")} draggable onDragStart={(ev) => onDragStart(ev, e)}>
              <div className="rp-evi__meta">
                <Icon name={KIND_ICON[e.kind]} size={13} />
                {e.host && <span className="rp-mono">{e.host}</span>}
                <time className="rp-mono rp-num">{formatTime(e.capturedAt)}</time>
                {e.used && <span className="rp-evi__used">In report</span>}
              </div>
              {e.kind === "command" ? (
                <>
                  <code className="rp-evi__cmd">{e.command}</code>
                  {e.output && <pre className="rp-evi__out">{e.output.split("\n").slice(0, 3).join("\n")}</pre>}
                </>
              ) : e.kind === "screenshot" ? (
                <div className="rp-evi__shot">
                  <Icon name="camera" size={14} />
                  <span>{e.text}</span>
                </div>
              ) : (
                <p className="rp-evi__text">{e.text}</p>
              )}
              <button type="button" className="rp-evi__insert" onClick={() => onInsert(e)} aria-label={`Insert ${e.kind}${e.command ? ` ${e.command}` : ""} into section`}>
                <Icon name="plus" size={13} />
                Insert
              </button>
              <Icon name="grip" size={14} className="rp-evi__grip" aria-hidden="true" />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
