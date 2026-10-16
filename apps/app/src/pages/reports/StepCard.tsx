import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Button, CodeBlock, CopyButton, Icon, IconButton, Textarea, cx } from "@rootpanther/ui";
import type { ReportStep } from "../../mock/reports";
import { isRedacted, sentenceCount, stepIssues } from "./model";
import type { IssueField } from "./model";

export function useAutoGrow(ref: RefObject<HTMLTextAreaElement>, value: string, min = 0) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(min, el.scrollHeight + 2)}px`;
  }, [ref, value, min]);
}

function Warning({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className="rb-warn">
      <Icon name="warning" size={13} />
      <span>{text}</span>
    </p>
  );
}

function CommandField({ step, n, onChange, warnId }: { step: ReportStep; n: number; onChange: (v: string) => void; warnId?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, step.command);
  if (isRedacted(step.command)) {
    return (
      <div className="rb-cmd is-redacted" role="group" aria-label={`Command for step ${n}, redacted`}>
        <Icon name="lock" size={14} className="rb-cmd__lock" />
        <span className="rb-cmd__redacted">
          <span className="rb-cmd__rtitle">Redacted command</span>
          <span className="rb-cmd__rnote">Contains credentials. Exports can replace it with a redaction marker.</span>
        </span>
      </div>
    );
  }
  return (
    <div className={cx("rb-cmd", !step.command.trim() && "is-missing")}>
      <span className="rb-cmd__prompt rp-mono" aria-hidden="true">
        $
      </span>
      <textarea
        ref={ref}
        rows={1}
        className="rb-cmd__input rp-mono"
        value={step.command}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="The exact command you ran"
        aria-label={`Command for step ${n}`}
        aria-describedby={warnId}
        aria-invalid={warnId ? true : undefined}
        onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
      />
      {step.command.trim() && <CopyButton value={step.command} label={`Copy command for step ${n}`} />}
    </div>
  );
}

function EvidenceField({ step, n, onChange, warnId }: { step: ReportStep; n: number; onChange: (text: string) => void; warnId?: string }) {
  const [editing, setEditing] = useState(step.evidence.kind === "output" && !step.evidence.text.trim());
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, step.evidence.text, 72);

  if (step.evidence.kind === "screenshot") {
    return (
      <figure className={cx("rb-shot", !step.evidence.text.trim() && "is-missing")} aria-describedby={warnId}>
        <span className="rb-shot__frame" aria-hidden="true">
          <Icon name="camera" size={18} />
        </span>
        <figcaption className="rb-shot__caption">
          <span>{step.evidence.text || "No screenshot attached"}</span>
          <span className="rb-shot__file rp-mono">evidence/{step.id}.png</span>
        </figcaption>
      </figure>
    );
  }

  if (editing) {
    return (
      <div className="rb-out-edit">
        <textarea
          ref={ref}
          className={cx("rb-out-edit__input rp-mono", !step.evidence.text.trim() && "is-missing")}
          value={step.evidence.text}
          spellCheck={false}
          placeholder="Paste the output this command produced"
          aria-label={`Output for step ${n}`}
          aria-describedby={warnId}
          aria-invalid={warnId ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {step.evidence.text.trim() && (
          <Button size="sm" variant="quiet" className="rb-out-edit__done" onClick={() => setEditing(false)}>
            Done
          </Button>
        )}
      </div>
    );
  }

  return (
    <CodeBlock
      className="rb-out"
      code={step.evidence.text}
      tone="terminal"
      maxHeight={184}
      label={
        <button type="button" className="rb-out__edit" onClick={() => setEditing(true)} aria-label={`Edit output for step ${n}`}>
          <Icon name="pencil" size={12} />
          Edit
        </button>
      }
    />
  );
}

export interface StepCardProps {
  step: ReportStep;
  index: number;
  total: number;
  flash: boolean;
  hasCritique: boolean;
  onChange: (step: ReportStep) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onCritique: () => void;
}

export const StepCard = forwardRef<HTMLLIElement, StepCardProps>(function StepCard({ step, index, total, flash, hasCritique, onChange, onMove, onRemove, onCritique }, ref) {
  const n = index + 1;
  const uid = useId();
  const issues = stepIssues(step);
  const warn = (f: IssueField) => issues.find((i) => i.field === f);
  const sentences = sentenceCount(step.explanation);
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const titleId = `${uid}-title`;

  const moved = useRef<-1 | 1 | null>(null);

  // Moving a step to either end disables the button that was pressed, so focus moves to the one still usable.
  useEffect(() => {
    const dir = moved.current;
    if (dir === null) return;
    moved.current = null;
    const pressed = dir === -1 ? upRef.current : downRef.current;
    const other = dir === -1 ? downRef.current : upRef.current;
    (pressed && !pressed.disabled ? pressed : other)?.focus();
  }, [index]);

  function move(dir: -1 | 1) {
    moved.current = dir;
    onMove(dir);
  }

  return (
    <li ref={ref} className={cx("rb-step", issues.length > 0 && "has-issues", flash && "is-flash")} aria-labelledby={titleId} tabIndex={-1} data-step={step.id}>
      <div className="rb-step__head">
        <span className="rb-step__num rp-mono rp-num" aria-hidden="true">
          {String(n).padStart(2, "0")}
        </span>
        <h3 id={titleId} className="rb-step__title">
          Step {n}
        </h3>
        {issues.length > 0 ? (
          <span className="rb-step__state is-warn">
            <Icon name="warning" size={13} />
            {issues.length} {issues.length === 1 ? "issue" : "issues"}
          </span>
        ) : (
          <span className="rb-step__state">
            <Icon name="check" size={13} />
            Passes house style
          </span>
        )}
        <span className="rp-spacer" />
        {hasCritique && (
          <button type="button" className="rb-step__onyx" onClick={onCritique}>
            <span className="rb-step__onyxdot" aria-hidden="true" />
            Onyx note
          </button>
        )}
        <div className="rb-step__tools" role="group" aria-label={`Step ${n} actions`}>
          <IconButton ref={upRef} icon="arrow-up" label={`Move step ${n} up`} size="sm" disabled={index === 0} onClick={() => move(-1)} />
          <IconButton ref={downRef} icon="arrow-down" label={`Move step ${n} down`} size="sm" disabled={index === total - 1} onClick={() => move(1)} />
          <IconButton icon="trash" label={`Remove step ${n}`} size="sm" onClick={onRemove} />
        </div>
      </div>

      <div className="rb-step__body">
        <div className="rb-field">
          <span className="rb-field__label">Command</span>
          <CommandField step={step} n={n} warnId={warn("command") ? `${uid}-cmd` : undefined} onChange={(command) => onChange({ ...step, command })} />
          {warn("command") && <Warning id={`${uid}-cmd`} text={warn("command")!.text} />}
        </div>

        <div className="rb-field">
          <span className="rb-field__label">
            Evidence
            <span className="rb-field__kind">{step.evidence.kind === "screenshot" ? "Screenshot" : "Output"}</span>
          </span>
          <EvidenceField step={step} n={n} warnId={warn("evidence") ? `${uid}-evi` : undefined} onChange={(text) => onChange({ ...step, evidence: { ...step.evidence, text } })} />
          {warn("evidence") && <Warning id={`${uid}-evi`} text={warn("evidence")!.text} />}
        </div>

        <div className="rb-field">
          <div className="rb-field__row">
            <label className="rb-field__label" htmlFor={`${uid}-exp`}>
              Explanation
            </label>
            <span className={cx("rb-field__count rp-mono rp-num", sentences > 2 && "is-over")} aria-live="polite">
              {sentences} of 2 sentences
            </span>
          </div>
          <Textarea
            id={`${uid}-exp`}
            rows={2}
            className={cx("rb-exp", warn("explanation") && "is-warn")}
            value={step.explanation}
            placeholder="What the evidence shows and why it matters"
            aria-describedby={warn("explanation") ? `${uid}-exp-w` : undefined}
            onChange={(e) => onChange({ ...step, explanation: e.target.value })}
          />
          {warn("explanation") && <Warning id={`${uid}-exp-w`} text={warn("explanation")!.text} />}
        </div>
      </div>
    </li>
  );
});
