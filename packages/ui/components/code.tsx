import { useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "../icons";
import { cx } from "../format";
import { useCopy } from "../hooks";
import { Tooltip } from "./Tooltip";

export interface CodeBlockProps {
  code: string;
  label?: ReactNode;
  prompt?: string;
  copyable?: boolean;
  wrap?: boolean;
  maxHeight?: number;
  className?: string;
  tone?: "default" | "terminal";
}

export function CodeBlock({ code, label, prompt, copyable = true, wrap, maxHeight, className, tone = "default" }: CodeBlockProps) {
  const [copied, copy] = useCopy();
  const lines = code.split("\n");
  return (
    <div className={cx("rp-code", `rp-code--${tone}`, className)}>
      {(label || copyable) && (
        <div className="rp-code__head">
          <span className="rp-code__label">{label}</span>
          {copyable && (
            <button type="button" className="rp-code__copy" onClick={() => copy(code)} aria-label={copied ? "Copied" : "Copy to clipboard"}>
              <Icon name={copied ? "check" : "copy"} size={13} />
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          )}
        </div>
      )}
      <pre className={cx("rp-code__pre", wrap && "is-wrap")} style={{ maxHeight }} tabIndex={0}>
        <code>
          {lines.map((l, i) => (
            <span key={i} className="rp-code__line">
              {prompt && <span className="rp-code__prompt" aria-hidden="true">{prompt} </span>}
              {l}
              {i < lines.length - 1 ? "\n" : ""}
            </span>
          ))}
        </code>
      </pre>
      <span className="rp-sr" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, copy] = useCopy();
  return (
    <Tooltip content={copied ? "Copied" : label}>
      <button type="button" className="rp-copybtn" onClick={() => copy(value)} aria-label={copied ? "Copied" : label}>
        <Icon name={copied ? "check" : "copy"} size={13} />
      </button>
    </Tooltip>
  );
}

export function CopyField({ value, label, mono = true }: { value: string; label: string; mono?: boolean }) {
  return (
    <div className="rp-copyfield">
      <span className="rp-copyfield__label">{label}</span>
      <span className={cx("rp-copyfield__value", mono && "rp-mono")}>{value}</span>
      <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
    </div>
  );
}

export function SecretField({ label, value, revealLabel = "Reveal" }: { label: string; value: string; revealLabel?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="rp-copyfield">
      <span className="rp-copyfield__label">{label}</span>
      <span className="rp-copyfield__value rp-mono" aria-live="polite">
        {shown ? value : "•".repeat(Math.max(8, Math.min(value.length, 14)))}
        {!shown && <span className="rp-sr">hidden</span>}
      </span>
      <Tooltip content={shown ? "Hide" : revealLabel}>
        <button type="button" className="rp-copybtn" onClick={() => setShown(!shown)} aria-label={shown ? `Hide ${label.toLowerCase()}` : `${revealLabel} ${label.toLowerCase()}`} aria-pressed={shown}>
          <Icon name={shown ? "eye-off" : "eye"} size={13} />
        </button>
      </Tooltip>
      <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
    </div>
  );
}
