import { forwardRef, useId, useMemo, useRef, useState } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Icon } from "../icons";
import type { IconName } from "../icons";
import { cx } from "../format";
import { UiLink } from "./Link";
import { Spinner } from "./display";
import { Tooltip } from "./Tooltip";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "destructive" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
  block?: boolean;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonOwnProps {}

function buttonClass({ variant = "secondary", size = "md", block, loading }: ButtonOwnProps, extra?: string) {
  return cx("rp-btn", `rp-btn--${variant}`, `rp-btn--${size}`, block && "rp-btn--block", loading && "is-loading", extra);
}

function ButtonInner({ loading, iconLeft, iconRight, size, children }: ButtonOwnProps & { children?: ReactNode }) {
  const iconSize = size === "sm" ? 14 : 16;
  return (
    <>
      {loading ? <Spinner size={iconSize} /> : iconLeft ? <Icon name={iconLeft} size={iconSize} /> : null}
      {children !== undefined && <span className="rp-btn__label">{children}</span>}
      {iconRight && !loading ? <Icon name={iconRight} size={iconSize} /> : null}
    </>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, iconLeft, iconRight, block, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, block, loading }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <ButtonInner loading={loading} iconLeft={iconLeft} iconRight={iconRight} size={size}>
        {children}
      </ButtonInner>
    </button>
  );
});

export interface ButtonLinkProps extends ButtonOwnProps {
  to: string;
  children?: ReactNode;
  className?: string;
  external?: boolean;
  "aria-label"?: string;
  onClick?: () => void;
}

export function ButtonLink({ to, variant, size, block, iconLeft, iconRight, className, children, external, ...rest }: ButtonLinkProps) {
  return (
    <UiLink
      to={to}
      className={buttonClass({ variant, size, block }, className)}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      {...rest}
    >
      <ButtonInner iconLeft={iconLeft} iconRight={external ? "external" : iconRight} size={size}>
        {children}
      </ButtonInner>
    </UiLink>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  label: string;
  size?: ButtonSize;
  variant?: "quiet" | "secondary" | "chrome";
  tooltip?: boolean;
  badge?: number;
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = "md", variant = "quiet", tooltip = true, badge, active, className, type = "button", ...rest },
  ref,
) {
  const btn = (
    <button
      ref={ref}
      type={type}
      aria-label={badge ? `${label}, ${badge} unread` : label}
      className={cx("rp-iconbtn", `rp-iconbtn--${variant}`, `rp-iconbtn--${size}`, active && "is-active", className)}
      {...rest}
    >
      <Icon name={icon} size={size === "sm" ? 15 : 17} />
      {badge ? (
        <span className="rp-iconbtn__badge rp-num" aria-hidden="true">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
  return tooltip ? <Tooltip content={label}>{btn}</Tooltip> : btn;
});

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
  labelAside?: ReactNode;
}

export function Field({ label, hint, error, htmlFor, optional, children, className, labelAside }: FieldProps) {
  return (
    <div className={cx("rp-field", error ? "is-invalid" : undefined, className)}>
      {label && (
        <div className="rp-field__labelrow">
          <label className="rp-field__label" htmlFor={htmlFor}>
            {label}
            {optional && <span className="rp-field__optional">Optional</span>}
          </label>
          {labelAside}
        </div>
      )}
      {children}
      {error ? (
        <p className="rp-field__error" id={htmlFor ? `${htmlFor}-error` : undefined} role="alert">
          <Icon name="alert-circle" size={13} />
          {error}
        </p>
      ) : hint ? (
        <p className="rp-field__hint" id={htmlFor ? `${htmlFor}-hint` : undefined}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  icon?: IconName;
  suffix?: ReactNode;
  mono?: boolean;
  inputSize?: "sm" | "md" | "lg";
  optional?: boolean;
  labelAside?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, suffix, mono, inputSize = "md", optional, labelAside, id, className, wrapperClassName, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const own = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  const describedBy = [own, rest["aria-describedby"]].filter(Boolean).join(" ") || undefined;
  const control = (
    <div className={cx("rp-input", `rp-input--${inputSize}`, error && "is-invalid", rest.disabled && "is-disabled", wrapperClassName)}>
      {icon && <Icon name={icon} size={15} className="rp-input__icon" />}
      <input
        ref={ref}
        id={inputId}
        className={cx("rp-input__el", mono && "rp-mono", className)}
        aria-invalid={error ? true : undefined}
        {...rest}
        aria-describedby={describedBy}
      />
      {suffix && <div className="rp-input__suffix">{suffix}</div>}
    </div>
  );
  if (!label && !hint && !error) return control;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} optional={optional} labelAside={labelAside}>
      {control}
    </Field>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  mono?: boolean;
  optional?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, mono, optional, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const tid = id ?? auto;
  const el = (
    <textarea
      ref={ref}
      id={tid}
      className={cx("rp-textarea", mono && "rp-mono", error && "is-invalid", className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${tid}-error` : hint ? `${tid}-hint` : undefined}
      {...rest}
    />
  );
  if (!label && !hint && !error) return el;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={tid} optional={optional}>
      {el}
    </Field>
  );
});

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: SelectOption[];
  selectSize?: "sm" | "md";
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, selectSize = "md", placeholder, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const sid = id ?? auto;
  const el = (
    <div className={cx("rp-select", `rp-select--${selectSize}`, error && "is-invalid", className)}>
      <select ref={ref} id={sid} aria-invalid={error ? true : undefined} {...rest}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={14} className="rp-select__chevron" />
    </div>
  );
  if (!label && !hint && !error) return el;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={sid}>
      {el}
    </Field>
  );
});

export interface ComboboxProps {
  label?: ReactNode;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  hint?: ReactNode;
  emptyText?: string;
  id?: string;
  size?: "sm" | "md";
  name?: string;
  autoComplete?: string;
  error?: ReactNode;
}

export function Combobox({ label, options, value, onChange, placeholder = "Search", hint, emptyText = "No matches", id, size = "md", name, autoComplete = "off", error }: ComboboxProps) {
  const auto = useId();
  const cid = id ?? auto;
  const listId = `${cid}-list`;
  const selected = options.find((o) => o.value === value) ?? null;
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const text = query ?? selected?.label ?? "";
  const filtered = useMemo(() => {
    const q = (query ?? "").trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  function commit(o: SelectOption | undefined) {
    if (!o || o.disabled) return;
    onChange(o.value);
    setQuery(null);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      commit(filtered[active]);
    } else if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
        setQuery(null);
      }
    }
  }

  const control = (
    <div className="rp-combobox">
      <div className={cx("rp-input", `rp-input--${size}`, open && "is-open", error && "is-invalid")}>
        <Icon name="search" size={15} className="rp-input__icon" />
        <input
          ref={inputRef}
          id={cid}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
          name={name}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${cid}-error` : hint ? `${cid}-hint` : undefined}
          className="rp-input__el"
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        {selected && (
          <div className="rp-input__suffix">
            <button
              type="button"
              className="rp-input__clear"
              aria-label="Clear selection"
              onClick={() => {
                onChange(null);
                setQuery(null);
                inputRef.current?.focus();
              }}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        )}
      </div>
      {open && (
        <ul className="rp-listbox" id={listId} role="listbox">
          {filtered.length === 0 && <li className="rp-listbox__empty">{emptyText}</li>}
          {filtered.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              className={cx("rp-listbox__opt", i === active && "is-active")}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => commit(o)}
              onPointerEnter={() => setActive(i)}
            >
              <span className="rp-truncate">{o.label}</span>
              {o.value === value && <Icon name="check" size={14} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  if (!label && !hint && !error) return control;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={cid}>
      {control}
    </Field>
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, indeterminate, className, ...rest },
  ref,
) {
  return (
    <label className={cx("rp-check", rest.disabled && "is-disabled", className)}>
      <input
        ref={(el) => {
          if (el) el.indeterminate = !!indeterminate;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        type="checkbox"
        className="rp-check__input"
        {...rest}
      />
      <span className="rp-check__box" aria-hidden="true">
        <Icon name={indeterminate ? "minus" : "check"} size={12} strokeWidth={2.5} />
      </span>
      {(label || description) && (
        <span className="rp-check__text">
          {label && <span className="rp-check__label">{label}</span>}
          {description && <span className="rp-check__desc">{description}</span>}
        </span>
      )}
    </label>
  );
});

export interface RadioGroupProps<T extends string> {
  name: string;
  legend?: ReactNode;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; description?: ReactNode; disabled?: boolean }[];
  layout?: "stack" | "cards" | "inline";
  className?: string;
}

export function RadioGroup<T extends string>({ name, legend, value, onChange, options, layout = "stack", className }: RadioGroupProps<T>) {
  return (
    <fieldset className={cx("rp-radiogroup", `rp-radiogroup--${layout}`, className)}>
      {legend && <legend className="rp-field__label">{legend}</legend>}
      <div className="rp-radiogroup__items">
        {options.map((o) => (
          <Radio
            key={o.value}
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            label={o.label}
            description={o.description}
            disabled={o.disabled}
            card={layout === "cards"}
          />
        ))}
      </div>
    </fieldset>
  );
}

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  description?: ReactNode;
  card?: boolean;
}

export function Radio({ label, description, card, className, ...rest }: RadioProps) {
  return (
    <label className={cx("rp-radio", card && "rp-radio--card", rest.checked && "is-checked", rest.disabled && "is-disabled", className)}>
      <input type="radio" className="rp-radio__input" {...rest} />
      <span className="rp-radio__dot" aria-hidden="true" />
      {(label || description) && (
        <span className="rp-check__text">
          {label && <span className="rp-check__label">{label}</span>}
          {description && <span className="rp-check__desc">{description}</span>}
        </span>
      )}
    </label>
  );
}

export interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  size?: "sm" | "md";
}

export function Switch({ checked, onChange, label, description, disabled, id, size = "md" }: SwitchProps) {
  const auto = useId();
  const sid = id ?? auto;
  const btn = (
    <button
      id={sid}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? `${sid}-label` : undefined}
      aria-describedby={description ? `${sid}-desc` : undefined}
      disabled={disabled}
      className={cx("rp-switch", `rp-switch--${size}`, checked && "is-on")}
      onClick={() => onChange(!checked)}
    >
      <span className="rp-switch__thumb" aria-hidden="true" />
    </button>
  );
  if (!label) return btn;
  return (
    <div className={cx("rp-switchrow", disabled && "is-disabled")}>
      <div className="rp-check__text">
        <label id={`${sid}-label`} htmlFor={sid} className="rp-check__label">
          {label}
        </label>
        {description && (
          <span id={`${sid}-desc`} className="rp-check__desc">
            {description}
          </span>
        )}
      </div>
      {btn}
    </div>
  );
}

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  label?: ReactNode;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  min: number;
  max: number;
  step?: number;
}

export function Slider({ label, value, onChange, format, min, max, step = 1, id, ...rest }: SliderProps) {
  const auto = useId();
  const sid = id ?? auto;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="rp-slider">
      {label && (
        <div className="rp-field__labelrow">
          <label className="rp-field__label" htmlFor={sid}>
            {label}
          </label>
          <output htmlFor={sid} className="rp-slider__value rp-mono rp-num">
            {format ? format(value) : value}
          </output>
        </div>
      )}
      <input
        id={sid}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--pct" as string]: `${pct}%` }}
        aria-valuetext={format ? format(value) : undefined}
        {...rest}
      />
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  label: string;
  size?: "sm" | "md";
  block?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({ value, onChange, options, label, size = "md", block, className }: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function move(dir: 1 | -1, from: number) {
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) {
        onChange(options[i].value);
        refs.current[i]?.focus();
        return;
      }
    }
  }
  return (
    <div role="radiogroup" aria-label={label} className={cx("rp-seg", `rp-seg--${size}`, block && "rp-seg--block", className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            title={o.title}
            disabled={o.disabled}
            className={cx("rp-seg__item", on && "is-on")}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(1, i);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(-1, i);
              }
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
