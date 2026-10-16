import { forwardRef, useCallback, useEffect, useId, useRef, useState } from "react";
import type { ClipboardEvent, KeyboardEvent, ReactNode } from "react";
import { Icon, IconButton, Input, PROVIDERS, ProviderMark, Spinner, Tooltip, cx } from "@rootpanther/ui";
import type { InputProps, Provider } from "@rootpanther/ui";
import type { PasswordCheck } from "./password";
import "./parts.css";

export interface PasswordFieldProps extends Omit<InputProps, "type" | "suffix"> {
  autoComplete: "current-password" | "new-password";
  describedBy?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField({ id, describedBy, error, hint, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  const [shown, setShown] = useState(false);
  const own = error ? `${fid}-error` : hint ? `${fid}-hint` : undefined;
  return (
    <Input
      ref={ref}
      id={fid}
      type={shown ? "text" : "password"}
      spellCheck={false}
      autoCapitalize="none"
      autoCorrect="off"
      error={error}
      hint={hint}
      wrapperClassName="au-pw"
      aria-describedby={[own, describedBy].filter(Boolean).join(" ") || undefined}
      suffix={
        <IconButton
          icon={shown ? "eye-off" : "eye"}
          label={shown ? "Hide password" : "Show password"}
          size="sm"
          aria-pressed={shown}
          aria-controls={fid}
          className="au-pw__reveal"
          onClick={() => setShown((s) => !s)}
        />
      }
      {...rest}
    />
  );
});

const STRENGTH_TONE = ["none", "crit", "med", "primary", "primary"] as const;

export function StrengthMeter({ check, id, showErrors, empty }: { check: PasswordCheck; id: string; showErrors?: boolean; empty: boolean }) {
  const tone = STRENGTH_TONE[check.score];
  return (
    <div className="au-strength" id={id}>
      <div className="au-strength__head">
        <div className={cx("au-strength__bar", `is-${tone}`)} aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={cx(n <= check.score && "is-on")} />
          ))}
        </div>
        <span className="au-strength__label" aria-live="polite">
          {empty ? (
            <span className="au-strength__none">Strength</span>
          ) : (
            <>
              <span className="rp-sr">Password strength: </span>
              <span className={`au-strength__word is-${tone}`}>{check.label}</span>
            </>
          )}
        </span>
      </div>
      <ul className="au-rules" aria-label="Password requirements">
        {check.rules.map((r) => {
          const failed = showErrors && !r.met;
          return (
            <li key={r.id} className={cx(r.met && "is-met", failed && "is-failed")}>
              <Icon name={r.met ? "check" : failed ? "x" : "minus"} size={13} strokeWidth={2.25} />
              <span>{r.label}</span>
              <span className="rp-sr">{r.met ? ", met" : ", not met"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function OrDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="au-or" aria-hidden="true">
      <span>{label}</span>
    </div>
  );
}

export function ProviderButtons({ onSelect, pending, verb = "Continue" }: { onSelect: (p: Provider) => void; pending: Provider | null; verb?: string }) {
  return (
    <div className="au-providers" role="group" aria-label="Single sign-on">
      {PROVIDERS.map((p) => {
        const label = `${verb} with ${p.label}`;
        return (
          <Tooltip key={p.id} content={label}>
            <button type="button" className="au-provider" aria-label={label} aria-busy={pending === p.id || undefined} disabled={pending !== null} onClick={() => onSelect(p.id)}>
              {pending === p.id ? <Spinner size={18} /> : <ProviderMark provider={p.id} size={18} />}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function useCooldown(seconds: number, startRunning = false): [number, () => void] {
  const [left, setLeft] = useState(startRunning ? seconds : 0);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  const start = useCallback(() => setLeft(seconds), [seconds]);
  return [left, start];
}

export function formatCooldown(s: number): string {
  return `0:${String(s).padStart(2, "0")}`;
}

export interface OtpInputProps {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  labelledBy: string;
  describedBy?: string;
  autoFocus?: boolean;
  size?: "md" | "lg";
}

const OTP_LENGTH = 6;

export function OtpInput({ value, onChange, onComplete, invalid, disabled, labelledBy, describedBy, autoFocus, size = "lg" }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const latest = useRef(value);
  latest.current = value;
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (value === "" && invalid) refs.current[0]?.focus();
  }, [value, invalid]);

  function focusAt(i: number) {
    const el = refs.current[Math.max(0, Math.min(OTP_LENGTH - 1, i))];
    el?.focus();
    el?.select();
  }

  function commit(next: string, focusIndex: number) {
    const clean = next.replace(/\D/g, "").slice(0, OTP_LENGTH);
    latest.current = clean;
    onChange(clean);
    if (clean.length === OTP_LENGTH) {
      refs.current[OTP_LENGTH - 1]?.focus();
      onComplete?.(clean);
    } else focusAt(focusIndex);
  }

  function insertAt(index: number, typed: string) {
    const incoming = typed.replace(/\D/g, "");
    if (!incoming) return;
    const start = Math.min(index, value.length);
    const merged = value.slice(0, start) + incoming + value.slice(start + incoming.length);
    commit(merged, Math.min(start + incoming.length, OTP_LENGTH - 1));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) commit(value.slice(0, i) + value.slice(i + 1), i);
      else if (i > 0) commit(value.slice(0, i - 1) + value.slice(i), i - 1);
    } else if (e.key === "Delete") {
      e.preventDefault();
      commit(value.slice(0, i) + value.slice(i + 1), i);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(Math.min(i + 1, value.length));
    } else if (e.key === "Home") {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusAt(Math.min(value.length, OTP_LENGTH - 1));
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>, i: number) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    if (text.length >= OTP_LENGTH) commit(text.slice(0, OTP_LENGTH), OTP_LENGTH - 1);
    else insertAt(i, text);
  }

  const half = OTP_LENGTH / 2;
  return (
    <div className={cx("au-otp", `au-otp--${size}`, invalid && "is-invalid")} role="group" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {[0, 1].map((g) => (
        <div key={g} className="au-otp__group">
          {digits.slice(g * half, g * half + half).map((d, j) => {
            const i = g * half + j;
            return (
              <input
                key={i}
                ref={(el) => (refs.current[i] = el)}
                className="au-otp__cell rp-mono rp-num"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
                aria-invalid={invalid || undefined}
                value={d}
                disabled={disabled}
                onFocus={(e) => {
                  if (i > latest.current.length) focusAt(latest.current.length);
                  else e.currentTarget.select();
                }}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.length > 1) insertAt(i, d && v.startsWith(d) ? v.slice(1) : v);
                  else if (/\d/.test(v)) insertAt(i, v);
                }}
                onKeyDown={(e) => onKeyDown(e, i)}
                onPaste={(e) => onPaste(e, i)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export const RECOVERY_RE = /^[a-z0-9]{4}-[a-z0-9]{4}$/;

export function formatRecovery(raw: string): string {
  const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export interface ChoiceCardProps {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function ChoiceCard({ name, value, checked, onSelect, title, description, aside, children, className }: ChoiceCardProps) {
  const id = useId();
  return (
    <label className={cx("au-choice", checked && "is-checked", className)}>
      <span className="au-choice__head">
        <input type="radio" className="rp-radio__input" name={name} value={value} checked={checked} onChange={onSelect} aria-describedby={description ? `${id}-d` : undefined} />
        <span className="rp-radio__dot" aria-hidden="true" />
        <span className="au-choice__title">{title}</span>
        {aside && <span className="au-choice__aside">{aside}</span>}
      </span>
      {description && (
        <span id={`${id}-d`} className="au-choice__desc">
          {description}
        </span>
      )}
      {children}
    </label>
  );
}
