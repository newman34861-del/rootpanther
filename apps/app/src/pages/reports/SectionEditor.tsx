import { useEffect, useId, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Button, EmptyState, Icon, StatusDot, cx, formatNumber, useStoredState } from "@rootpanther/ui";
import type { ReportSection } from "@rootpanther/ui";
import { HOUSE_STYLE } from "../../mock/reports";
import type { ReportStep } from "../../mock/reports";
import type { ReviewNote } from "./OnyxReview";
import { StepCard, useAutoGrow } from "./StepCard";
import { appendixRows, isRedacted, sectionKind, stepsPassing, wordCount } from "./model";
import type { ContentMap } from "./model";

const STATE_DOT = {
  empty: { tone: "neutral", label: "Not started" },
  draft: { tone: "primary", label: "Draft" },
  done: { tone: "success", label: "Complete" },
} as const;

const PROSE_PLACEHOLDER: Record<string, string> = {
  exec: "Write this last. Three or four sentences a non-technical reader can follow.",
  scope: "Hosts, addresses, the starting access and the time window tested.",
  method: "How you approached the assessment, in the order you worked.",
  remediation: "One fix per finding, in the same order as the findings.",
  appendix: "One line on how the command list below is ordered.",
};

export interface FocusRequest {
  stepId?: string;
  nonce: number;
  edit?: boolean;
}

function HouseStyle() {
  const [open, setOpen] = useStoredState("rb-house-style-open", true);
  const id = useId();
  return (
    <div className={cx("rb-style", open && "is-open")}>
      <button type="button" className="rb-style__btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <Icon name="checklist" size={14} />
        <span className="rb-style__title">House style</span>
        <span className="rb-style__meta">{HOUSE_STYLE.length} rules</span>
        <Icon name="chevron-down" size={14} className="rb-style__chev" />
      </button>
      <ol id={id} className="rb-style__list" hidden={!open}>
        {HOUSE_STYLE.map((rule, i) => (
          <li key={rule}>
            <span className="rb-style__n rp-mono rp-num" aria-hidden="true">
              {i + 1}
            </span>
            {rule}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ProseEditor({ section, value, onChange, flash, inputRef }: { section: ReportSection; value: string; onChange: (v: string) => void; flash: boolean; inputRef: React.RefObject<HTMLTextAreaElement> }) {
  const uid = useId();
  useAutoGrow(inputRef, value, 144);
  const words = wordCount(value);
  return (
    <div className={cx("rb-prose", flash && "is-flash")}>
      <label htmlFor={uid} className="rp-sr">
        {section.title}
      </label>
      <textarea
        ref={inputRef}
        id={uid}
        className="rb-prose__input"
        value={value}
        placeholder={PROSE_PLACEHOLDER[section.id] ?? "Write this section."}
        aria-describedby={`${uid}-count`}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="rb-prose__foot">
        <span id={`${uid}-count`} className="rp-mono rp-num">
          {formatNumber(words)} {words === 1 ? "word" : "words"}
        </span>
      </div>
    </div>
  );
}

function Appendix({ sections, content, onSelect }: { sections: ReportSection[]; content: ContentMap; onSelect: (id: string) => void }) {
  const rows = appendixRows(sections, content);
  return (
    <div className="rb-appx">
      <div className="rb-appx__head">
        <span className="rp-eyebrow">Commands from your steps</span>
        <span className="rp-mono rp-num rp-small">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="rb-appx__empty">Commands appear here as you add steps to the findings sections.</p>
      ) : (
        <ol className="rb-appx__list">
          {rows.map((r, i) => {
            const target = sections.find((s) => s.host === r.host && s.title === r.section && s.parentId);
            return (
              <li key={i}>
                <span className="rb-appx__n rp-mono rp-num">{i + 1}</span>
                <button type="button" className="rb-appx__where" onClick={() => target && onSelect(target.id)}>
                  <span className="rp-mono">{r.host}</span>, {r.section}
                </button>
                {isRedacted(r.command) ? (
                  <span className="rb-appx__cmd is-redacted">
                    <Icon name="lock" size={12} />
                    Redacted command
                  </span>
                ) : (
                  <code className="rb-appx__cmd rp-mono">{r.command}</code>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function HostOverview({ host, sections, content, onSelect }: { host: ReportSection; sections: ReportSection[]; content: ContentMap; onSelect: (id: string) => void }) {
  const kids = sections.filter((s) => s.parentId === host.id);
  return (
    <ul className="rb-hostlist">
      {kids.map((k) => {
        const steps = content[k.id]?.steps ?? [];
        const pass = stepsPassing(steps);
        const dot = STATE_DOT[k.state];
        return (
          <li key={k.id}>
            <button type="button" className="rb-hostlist__row" onClick={() => onSelect(k.id)}>
              <span className="rb-hostlist__title">{k.title}</span>
              <StatusDot tone={dot.tone} hollow={k.state === "empty"} label={dot.label} size="sm" />
              <span className="rb-hostlist__count">
                {steps.length === 0 ? (
                  "No steps"
                ) : (
                  <>
                    <span className="rp-num">
                      {pass} of {steps.length}
                    </span>{" "}
                    {steps.length === 1 ? "step passes" : "steps pass"}
                  </>
                )}
              </span>
              <Icon name="chevron-right" size={15} className="rb-hostlist__go" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export interface SectionEditorProps {
  section: ReportSection;
  sections: ReportSection[];
  content: ContentMap;
  notes: ReviewNote[];
  dragging: boolean;
  focus: FocusRequest | null;
  trayInline: boolean;
  evidenceCount: number;
  onOpenTray: () => void;
  onSelect: (id: string) => void;
  onProse: (v: string) => void;
  onSteps: (steps: ReportStep[], announce?: string) => void;
  onAddStep: () => void;
  onRequestRemove: (step: ReportStep, index: number) => void;
  onDropEvidence: (id: string) => void;
  onToggleDone: () => void;
  onCritique: () => void;
}

export function SectionEditor({
  section,
  sections,
  content,
  notes,
  dragging,
  focus,
  trayInline,
  evidenceCount,
  onOpenTray,
  onSelect,
  onProse,
  onSteps,
  onAddStep,
  onRequestRemove,
  onDropEvidence,
  onToggleDone,
  onCritique,
}: SectionEditorProps) {
  const kind = sectionKind(section);
  const steps = content[section.id]?.steps ?? [];
  const prose = content[section.id]?.prose ?? "";
  const pass = stepsPassing(steps);
  const dot = STATE_DOT[section.state];
  const headId = useId();
  const [over, setOver] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const stepRefs = useRef(new Map<string, HTMLLIElement>());
  const proseRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const acceptsDrop = kind !== "host";

  useEffect(() => {
    const el = rootRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  }, []);

  useEffect(() => {
    if (!focus) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
    const step = focus.stepId ? stepRefs.current.get(focus.stepId) : null;
    if (focus.stepId && !step) return;
    if (step) {
      step.scrollIntoView({ block: "center", behavior });
      const fields = Array.from(step.querySelectorAll<HTMLTextAreaElement>("textarea:not([disabled])"));
      const input = focus.edit ? fields.find((f) => !f.value.trim()) ?? fields[0] : null;
      (input ?? step).focus({ preventScroll: true });
    } else {
      rootRef.current?.scrollIntoView({ block: "start", behavior });
      (kind === "prose" ? proseRef.current : rootRef.current)?.focus({ preventScroll: true });
    }
    const key = focus.stepId ?? "__section";
    setFlash(key);
    const t = window.setTimeout(() => setFlash((f) => (f === key ? null : f)), 1800);
    return () => window.clearTimeout(t);
  }, [focus, kind]);

  useEffect(() => {
    if (!dragging) setOver(false);
  }, [dragging]);

  function move(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= steps.length) return;
    const next = [...steps];
    const [s] = next.splice(index, 1);
    next.splice(to, 0, s);
    onSteps(next, `Step ${index + 1} moved to position ${to + 1}`);
  }

  function isEvidenceDrag(e: DragEvent) {
    return Array.from(e.dataTransfer.types).includes("application/x-rp-evidence");
  }

  const dropProps = acceptsDrop
    ? {
        onDragOver: (e: DragEvent<HTMLElement>) => {
          if (!isEvidenceDrag(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (!over) setOver(true);
        },
        onDragLeave: (e: DragEvent<HTMLElement>) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
        },
        onDrop: (e: DragEvent<HTMLElement>) => {
          const id = e.dataTransfer.getData("application/x-rp-evidence");
          setOver(false);
          if (!id) return;
          e.preventDefault();
          onDropEvidence(id);
        },
      }
    : {};

  const openNotes = notes.filter((c) => c.sectionId === section.id && !c.resolved);
  const canComplete = kind === "steps" ? steps.length > 0 && pass === steps.length : kind === "prose" ? prose.trim().length > 0 : false;

  return (
    <section
      ref={rootRef}
      className={cx("rb-editor rp-card", dragging && acceptsDrop && "is-dragging", over && "is-over", flash === "__section" && kind !== "prose" && "is-flash")}
      aria-labelledby={headId}
      tabIndex={-1}
      {...dropProps}
    >
      <header className="rb-editor__head">
        <div className="rb-editor__titles">
          <div className="rb-editor__titlerow">
            <h2 id={headId} className="rb-editor__title">
              {kind === "host" ? `Findings: ${section.host}` : section.title}
            </h2>
            {section.host && kind === "steps" && (
              <span className="rb-editor__host rp-mono">
                <Icon name="server" size={13} />
                {section.host}
              </span>
            )}
          </div>
          <div className="rb-editor__meta">
            <StatusDot tone={dot.tone} hollow={section.state === "empty"} label={dot.label} size="sm" />
            {kind === "steps" && steps.length > 0 && (
              <span className={cx("rb-editor__pass", pass < steps.length && "is-warn")} aria-live="polite">
                <Icon name={pass === steps.length ? "check" : "warning"} size={13} />
                <span className="rp-num">
                  {pass} of {steps.length} {steps.length === 1 ? "step passes" : "steps pass"}
                </span>
              </span>
            )}
            {openNotes.some((c) => !c.stepId) && (
              <button type="button" className="rb-step__onyx" onClick={onCritique}>
                <span className="rb-step__onyxdot" aria-hidden="true" />
                Onyx note
              </button>
            )}
          </div>
        </div>
        <div className="rb-editor__actions">
          {!trayInline && kind !== "host" && (
            <Button size="sm" iconLeft="note" onClick={onOpenTray}>
              Evidence
              <span className="rb-count rp-mono rp-num">{evidenceCount}</span>
            </Button>
          )}
          {kind !== "host" &&
            (section.state === "done" ? (
              <Button size="sm" variant="quiet" iconLeft="refresh" onClick={onToggleDone}>
                Reopen
              </Button>
            ) : (
              <Button size="sm" iconLeft="check" onClick={onToggleDone} disabled={!canComplete} title={canComplete ? undefined : kind === "steps" ? "Every step must pass house style" : "Write this section first"}>
                Mark complete
              </Button>
            ))}
        </div>
      </header>

      <div className="rb-editor__body">
        {kind === "host" && <HostOverview host={section} sections={sections} content={content} onSelect={onSelect} />}

        {kind === "prose" && (
          <>
            <ProseEditor section={section} value={prose} onChange={onProse} flash={flash === "__section"} inputRef={proseRef} />
            {section.id === "appendix" && <Appendix sections={sections} content={content} onSelect={onSelect} />}
          </>
        )}

        {kind === "steps" && (
          <>
            <HouseStyle />
            {steps.length === 0 ? (
              !dragging && (
                <EmptyState
                  compact
                  icon="terminal"
                  title="No steps yet"
                  action={
                    <Button size="sm" iconLeft="plus" onClick={onAddStep}>
                      Add step
                    </Button>
                  }
                >
                  {trayInline ? "Insert a capture from the evidence tray, or add a step and write it." : "Open the evidence tray to insert a capture, or add a step and write it."}
                </EmptyState>
              )
            ) : (
              <ol className="rb-steps" aria-label={`Steps in ${section.title}`}>
                {steps.map((s, i) => (
                  <StepCard
                    key={s.id}
                    ref={(el) => {
                      if (el) stepRefs.current.set(s.id, el);
                      else stepRefs.current.delete(s.id);
                    }}
                    step={s}
                    index={i}
                    total={steps.length}
                    flash={flash === s.id}
                    hasCritique={openNotes.some((c) => c.stepId === s.id)}
                    onCritique={onCritique}
                    onChange={(next) => onSteps(steps.map((x) => (x.id === s.id ? next : x)))}
                    onMove={(dir) => move(i, dir)}
                    onRemove={() => onRequestRemove(s, i)}
                  />
                ))}
              </ol>
            )}
            {steps.length > 0 && !dragging && (
              <div className="rb-add">
                <Button size="sm" iconLeft="plus" onClick={onAddStep}>
                  Add step
                </Button>
                <span className="rb-add__hint">{trayInline ? "or drag a capture here from the evidence tray" : "or insert a capture from the evidence tray"}</span>
              </div>
            )}
          </>
        )}

        {dragging && acceptsDrop && (
          <div className={cx("rb-drop", over && "is-over")} aria-hidden="true">
            <Icon name="download" size={16} />
            {kind === "steps" ? `Drop to add as step ${steps.length + 1}` : `Drop to append to ${section.title}`}
          </div>
        )}
      </div>
    </section>
  );
}
