import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ClipboardEvent, ReactNode } from "react";
import { Icon } from "../icons";
import { cx, formatTime } from "../format";
import { HELP_LEVELS, ONYX_COMMANDS } from "../types";
import type { HelpLevel, OnyxCommand, OnyxMessageData } from "../types";
import { ConfirmDialog } from "../components/overlay";
import { Spinner } from "../components/display";
import { CodeBlock } from "../components/code";
import { Tooltip } from "../components/Tooltip";

const SHORT: Record<HelpLevel, string> = {
  "exam-sim": "Exam",
  shadow: "Shadow",
  nudge: "Nudge",
  coach: "Coach",
  teach: "Teach",
  walkthrough: "Walk",
};

export function helpLabel(level: HelpLevel): string {
  return HELP_LEVELS.find((l) => l.id === level)?.label ?? level;
}

export interface HelpDialProps {
  value: HelpLevel;
  onChange: (level: HelpLevel) => void;
  compact?: boolean;
  confirmWalkthrough?: boolean;
  showDescription?: boolean;
  label?: string;
  disabledLevels?: HelpLevel[];
}

export function HelpDial({ value, onChange, compact, confirmWalkthrough = true, showDescription = true, label = "Onyx help level", disabledLevels = [] }: HelpDialProps) {
  const [pending, setPending] = useState<HelpLevel | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const descId = useId();
  const idx = HELP_LEVELS.findIndex((l) => l.id === value);

  function request(level: HelpLevel) {
    if (level === value || disabledLevels.includes(level)) return;
    if (level === "walkthrough" && confirmWalkthrough) setPending(level);
    else onChange(level);
  }

  function move(dir: 1 | -1, from: number) {
    const next = Math.min(HELP_LEVELS.length - 1, Math.max(0, from + dir));
    refs.current[next]?.focus();
    request(HELP_LEVELS[next].id);
  }

  return (
    <div className={cx("rp-dial", compact && "is-compact")}>
      <div role="radiogroup" aria-label={label} aria-describedby={showDescription ? descId : undefined} className="rp-dial__track">
        {HELP_LEVELS.map((l, i) => {
          const on = l.id === value;
          const below = i < idx;
          return (
            <button
              key={l.id}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={compact ? l.label : undefined}
              tabIndex={on ? 0 : -1}
              disabled={disabledLevels.includes(l.id)}
              title={compact ? l.label : undefined}
              className={cx("rp-dial__step", on && "is-on", below && "is-below", l.id === "walkthrough" && "is-walk")}
              onClick={() => request(l.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  move(1, i);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  move(-1, i);
                }
              }}
            >
              <span className="rp-dial__bars" aria-hidden="true">
                {Array.from({ length: 6 }, (_, b) => (
                  <span key={b} className={cx("rp-dial__bar", b <= i && "is-lit")} />
                ))}
              </span>
              <span className="rp-dial__label">{compact ? SHORT[l.id] : l.label}</span>
              {l.id === "walkthrough" && !compact && <Icon name="lock" size={11} className="rp-dial__lock" />}
            </button>
          );
        })}
      </div>
      {showDescription && (
        <p id={descId} className="rp-dial__desc">
          <span className="rp-strong">{helpLabel(value)}.</span> {HELP_LEVELS[idx]?.description}
        </p>
      )}
      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) onChange(pending);
          setPending(null);
        }}
        title="Switch to Walkthrough"
        confirmLabel="Switch to Walkthrough"
      >
        <p>Onyx will give concrete commands for the current step. The change is recorded on this run and shown in your debrief.</p>
        <p style={{ marginTop: 10 }}>You can step back down at any time.</p>
      </ConfirmDialog>
    </div>
  );
}

export function HintLadder({ step, of }: { step: number; of: number }) {
  return (
    <span className="rp-ladder" aria-label={`Hint ${step} of ${of}`}>
      <span className="rp-ladder__segs" aria-hidden="true">
        {Array.from({ length: of }, (_, i) => (
          <span key={i} className={cx("rp-ladder__seg", i < step && "is-on")} />
        ))}
      </span>
      <span className="rp-mono rp-num" aria-hidden="true">
        Hint {step}/{of}
      </span>
    </span>
  );
}

export function OnyxMessage({ message }: { message: OnyxMessageData }) {
  if (message.role === "system") {
    return (
      <li className="rp-omsg is-system">
        <span>{message.text}</span>
        <time dateTime={message.at} className="rp-mono">
          {formatTime(message.at)}
        </time>
      </li>
    );
  }
  const onyx = message.role === "onyx";
  return (
    <li className={cx("rp-omsg", onyx ? "is-onyx" : "is-you")}>
      <div className="rp-omsg__meta">
        <span className="rp-omsg__role">{onyx ? "ONYX" : "YOU"}</span>
        {message.command && <span className="rp-omsg__cmd rp-mono">{message.command}</span>}
        {message.hintStep && <HintLadder step={message.hintStep.step} of={message.hintStep.of} />}
        <time dateTime={message.at} className="rp-omsg__time rp-mono">
          {formatTime(message.at)}
        </time>
      </div>
      <div className="rp-omsg__body">
        {message.text.split("\n\n").map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {message.code && <CodeBlock code={message.code} tone="terminal" />}
        {message.streaming && (
          <span className="rp-omsg__streaming">
            <Spinner size={12} />
            <span>Streaming</span>
          </span>
        )}
      </div>
    </li>
  );
}

export interface OnyxTranscriptProps {
  messages: OnyxMessageData[];
  empty?: ReactNode;
  label?: string;
}

export function OnyxTranscript({ messages, empty, label = "Conversation with Onyx" }: OnyxTranscriptProps) {
  const ref = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, last?.text]);
  return (
    <div ref={ref} className="rp-transcript" tabIndex={0} role="region" aria-label={label}>
      {messages.length === 0 ? (
        empty
      ) : (
        <ol className="rp-transcript__list" aria-live="polite" aria-relevant="additions">
          {messages.map((m) => (
            <OnyxMessage key={m.id} message={m} />
          ))}
        </ol>
      )}
    </div>
  );
}

export interface CommandChipProps {
  command: OnyxCommand;
  onClick: (c: OnyxCommand) => void;
  disabled?: boolean;
  escalated?: boolean;
}

const CMD_HELP: Record<OnyxCommand, string> = {
  hint: "Next hint for the current blocker",
  why: "Why this step matters",
  check: "Check your current approach",
  stuck: "Describe where you are stuck",
  explain: "Explain the last output",
  methodology: "Where you are in the method",
  teach: "Teach the technique in depth",
  walkthrough: "Concrete commands. Requires confirmation",
  review: "Review your notes for reproducibility",
  note: "Save the last command and output to evidence",
};

export function CommandChip({ command, onClick, disabled, escalated }: CommandChipProps) {
  return (
    <Tooltip content={CMD_HELP[command]}>
      <button type="button" className={cx("rp-cmdchip", escalated && "is-escalated", command === "walkthrough" && "is-walk")} onClick={() => onClick(command)} disabled={disabled}>
        {command}
      </button>
    </Tooltip>
  );
}

export function CommandChips({ onCommand, disabled, exclude = [] }: { onCommand: (c: OnyxCommand) => void; disabled?: boolean; exclude?: OnyxCommand[] }) {
  return (
    <div className="rp-cmdchips" role="group" aria-label="Onyx commands">
      {ONYX_COMMANDS.filter((c) => !exclude.includes(c)).map((c) => (
        <CommandChip key={c} command={c} onClick={onCommand} disabled={disabled} />
      ))}
    </div>
  );
}

export interface OnyxComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
  disabledReason?: ReactNode;
  placeholder?: string;
  busy?: boolean;
}

function looksLikeTerminal(text: string) {
  return /\n/.test(text) && /(^|\n)\s*(\$|#|PS [A-Z]:\\|[a-z0-9_-]+@[a-z0-9_.-]+[:$#]|\*Evil-WinRM\*|SMB|LDAP|\[\*\]|\[\+\])/.test(text);
}

export function OnyxComposer({ value, onChange, onSend, disabled, disabledReason, placeholder = "Ask Onyx, or type a command", busy }: OnyxComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mono, setMono] = useState(false);
  const hintId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  useEffect(() => {
    if (!value) setMono(false);
  }, [value]);

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    if (looksLikeTerminal(e.clipboardData.getData("text"))) setMono(true);
  }

  function send() {
    const t = value.trim();
    if (!t || disabled || busy) return;
    onSend(t);
  }

  if (disabled && disabledReason) {
    return (
      <div className="rp-composer is-disabled">
        <Icon name="lock" size={14} />
        <span>{disabledReason}</span>
      </div>
    );
  }

  return (
    <div className={cx("rp-composer", mono && "is-mono")}>
      <label className="rp-sr" htmlFor={`${hintId}-input`}>
        Message Onyx
      </label>
      <textarea
        ref={ref}
        id={`${hintId}-input`}
        rows={1}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onPaste={onPaste}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hintId}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        spellCheck={!mono}
      />
      <div className="rp-composer__bar">
        <span id={hintId} className="rp-composer__hint">
          <kbd>↵</kbd> send <kbd>⇧↵</kbd> newline{mono ? " · terminal paste" : ""}
        </span>
        <button type="button" className="rp-composer__send" onClick={send} disabled={!value.trim() || disabled || busy} aria-label="Send">
          {busy ? <Spinner size={14} /> : <Icon name="send" size={14} />}
        </button>
      </div>
    </div>
  );
}

export type OnyxConnection = "ready" | "streaming" | "reconnecting" | "offline";

export interface OnyxPanelProps {
  level: HelpLevel;
  onLevelChange: (l: HelpLevel) => void;
  messages: OnyxMessageData[];
  onSend: (text: string) => void;
  onCommand: (c: OnyxCommand) => void;
  connection?: OnyxConnection;
  reconnectAttempt?: number;
  onReconnect?: () => void;
  groundedTo?: string;
  headerActions?: ReactNode;
  compact?: boolean;
  empty?: ReactNode;
  className?: string;
  showDial?: boolean;
}

export function OnyxPanel({
  level,
  onLevelChange,
  messages,
  onSend,
  onCommand,
  connection = "ready",
  reconnectAttempt,
  onReconnect,
  groundedTo,
  headerActions,
  compact,
  empty,
  className,
  showDial = true,
}: OnyxPanelProps) {
  const [draft, setDraft] = useState("");
  const silent = level === "exam-sim";
  const offline = connection === "offline" || connection === "reconnecting";

  function handleCommand(c: OnyxCommand) {
    if (c === "walkthrough" && level !== "walkthrough") {
      onLevelChange("walkthrough");
      return;
    }
    onCommand(c);
  }

  return (
    <section className={cx("rp-onyx", compact && "is-compact", className)} aria-label="Onyx trainer">
      <header className="rp-onyx__head">
        <span className="rp-onyx__dot" aria-hidden="true" />
        <h2 className="rp-onyx__name">Onyx</h2>
        <span className="rp-onyx__level rp-mono">{helpLabel(level)}</span>
        <span className="rp-spacer" />
        {headerActions}
      </header>
      {groundedTo && (
        <div className="rp-onyx__grounding">
          <Icon name="shield-check" size={13} />
          <span>
            Grounded to <span className="rp-strong">{groundedTo}</span>
          </span>
        </div>
      )}
      {showDial && (
        <div className="rp-onyx__dial">
          <HelpDial value={level} onChange={onLevelChange} compact={compact} showDescription={!compact} />
        </div>
      )}
      {offline && (
        <div className="rp-onyx__conn" role="status">
          {connection === "reconnecting" ? <Spinner size={13} /> : <Icon name="wifi-off" size={14} />}
          <span>
            {connection === "reconnecting" ? `Reconnecting to Onyx, attempt ${reconnectAttempt ?? 1} of 5` : "Onyx is unreachable. Your lab is unaffected."}
          </span>
          {onReconnect && (
            <button type="button" className="rp-link" onClick={onReconnect}>
              Retry now
            </button>
          )}
        </div>
      )}
      <OnyxTranscript
        messages={messages}
        empty={
          empty ?? (
            <div className="rp-onyx__empty">
              {silent ? "Exam sim is on. Onyx stays silent and this run is logged as clean." : "Ask a question or pick a command below."}
            </div>
          )
        }
      />
      <div className="rp-onyx__foot">
        {!silent && <CommandChips onCommand={handleCommand} disabled={offline} />}
        <OnyxComposer
          value={draft}
          onChange={setDraft}
          onSend={(t) => {
            onSend(t);
            setDraft("");
          }}
          busy={connection === "streaming"}
          disabled={silent || offline}
          disabledReason={silent ? "Exam sim: Onyx is silent. Raise the help level to ask a question." : undefined}
        />
      </div>
    </section>
  );
}
