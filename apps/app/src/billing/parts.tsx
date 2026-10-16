import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode, Ref } from "react";
import { Link } from "react-router-dom";
import { Button, Callout, Checkbox, Combobox, Icon, Input, Lockup, Modal, RadioGroup, StripeMark, cx, formatMoney } from "@rootpanther/ui";
import type { IconName } from "@rootpanther/ui";
import { BILLING_EMAIL, CARD_BRAND_LABEL, COUNTRIES, CURRENCY, cardExpiry, cardLabel } from "../mock/billing";
import type { CardBrand, PaymentMethod } from "../mock/billing";

export function money(n: number, digits = 2): string {
  const s = formatMoney(Math.abs(n), CURRENCY, digits);
  return n < 0 ? `−${s}` : s;
}

export function Money({ value, digits = 2, className }: { value: number; digits?: number; className?: string }) {
  return <span className={cx("rp-mono rp-num", className)}>{money(value, digits)}</span>;
}

export function SkipLink() {
  return (
    <a className="rp-skip" href="#main">
      Skip to content
    </a>
  );
}

export function PublicTopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="bl-top">
      <div className="bl-top__inner">
        <Link to="/" className="bl-top__brand" aria-label="Rootpanther home">
          <Lockup size="md" />
        </Link>
        {children && <div className="bl-top__actions">{children}</div>}
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="bl-footer">
      <div className="bl-footer__inner">
        <span>&copy; {new Date().getFullYear()} Rootpanther</span>
        <nav aria-label="Legal" className="bl-footer__links">
          <a href="https://rootpanther.com/terms">Terms</a>
          <a href="https://rootpanther.com/privacy">Privacy</a>
          <a href={`mailto:${BILLING_EMAIL}`}>{BILLING_EMAIL}</a>
        </nav>
        <span className="bl-footer__stripe">
          Payments processed by <StripeMark height={14} />
        </span>
      </div>
    </footer>
  );
}

export function SummaryLine({ label, detail, value, strong, className }: { label: ReactNode; detail?: ReactNode; value: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cx("bl-line", strong && "is-strong", className)}>
      <dt>
        <span className="bl-line__label">{label}</span>
        {detail && <span className="bl-line__detail">{detail}</span>}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

export interface ListItem {
  icon: IconName;
  text: ReactNode;
}

export function FactList({ items, tone = "neutral", className }: { items: ListItem[]; tone?: "neutral" | "stop"; className?: string }) {
  return (
    <ul className={cx("bl-facts", tone === "stop" && "is-stop", className)}>
      {items.map((it, i) => (
        <li key={i}>
          <Icon name={it.icon} size={14} />
          <span>{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

export const KEPT_ITEMS: ListItem[] = [
  { icon: "route", text: "Path tier and completed scenarios" },
  { icon: "note", text: "Notes and captured proofs" },
  { icon: "document", text: "Reports and debriefs" },
  { icon: "chat", text: "Onyx history" },
];

export const STOP_ITEMS: ListItem[] = [
  { icon: "flask", text: "Launching new labs" },
  { icon: "chat", text: "Onyx inside labs" },
];

export function detectBrand(digits: string): CardBrand {
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^(6011|65)/.test(digits)) return "discover";
  return "unknown";
}

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (detectBrand(digits) === "amex") {
    const d = digits.slice(0, 15);
    return [d.slice(0, 4), d.slice(4, 10), d.slice(10)].filter(Boolean).join(" ");
  }
  return (digits.slice(0, 16).match(/.{1,4}/g) ?? []).join(" ");
}

export function formatExpiry(raw: string, previous: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (raw.length < previous.length && previous.endsWith(" / ") && digits.length <= 2) return digits.slice(0, 1);
  if (digits.length === 1 && Number(digits) > 1) return `0${digits} / `;
  if (digits.length >= 2) return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
  return digits;
}

export interface CardValues {
  number: string;
  expiry: string;
  cvc: string;
  name: string;
}

export type CardErrors = Partial<Record<keyof CardValues, string>>;

export const EMPTY_CARD: CardValues = { number: "", expiry: "", cvc: "", name: "" };

export function validateCard(v: CardValues, now = new Date()): CardErrors {
  const e: CardErrors = {};
  const digits = v.number.replace(/\D/g, "");
  const brand = detectBrand(digits);
  const want = brand === "amex" ? 15 : 16;
  if (!digits) e.number = "Enter your card number.";
  else if (digits.length < want || !luhn(digits)) e.number = "This card number is incomplete or not valid.";
  const [mm, yy] = v.expiry.split("/").map((s) => Number(s.trim()));
  if (!v.expiry.trim()) e.expiry = "Enter the expiry date.";
  else if (!mm || mm > 12 || !yy) e.expiry = "Use MM / YY.";
  else if (new Date(2000 + yy, mm, 1) <= now) e.expiry = "This card has expired.";
  const cvc = v.cvc.replace(/\D/g, "");
  if (!cvc) e.cvc = "Enter the security code.";
  else if (cvc.length < (brand === "amex" ? 4 : 3)) e.cvc = brand === "amex" ? "4 digits on the front of the card." : "3 digits on the back of the card.";
  if (!v.name.trim()) e.name = "Enter the name shown on the card.";
  return e;
}

export function last4(v: CardValues): string {
  return v.number.replace(/\D/g, "").slice(-4);
}

const BRAND_SHORT: Record<CardBrand, string> = { visa: "Visa", mastercard: "MC", amex: "Amex", discover: "Disc", unknown: "" };

export function BrandTag({ brand, dim }: { brand: CardBrand; dim?: boolean }) {
  if (brand === "unknown") return null;
  return <span className={cx("bl-brand", dim && "is-dim")}>{BRAND_SHORT[brand]}</span>;
}

function BrandHint({ brand }: { brand: CardBrand }) {
  return (
    <span className="bl-brandhint">
      <span aria-hidden="true" className="bl-brandhint__marks">
        {brand === "unknown" ? (
          <>
            <BrandTag brand="visa" dim />
            <BrandTag brand="mastercard" dim />
            <BrandTag brand="amex" dim />
          </>
        ) : (
          <BrandTag brand={brand} />
        )}
      </span>
      <span className="rp-sr" aria-live="polite">
        {brand === "unknown" ? "" : `${CARD_BRAND_LABEL[brand]} card`}
      </span>
    </span>
  );
}

export function CardFields({ values, onChange, errors = {}, numberRef }: { values: CardValues; onChange: (v: CardValues) => void; errors?: CardErrors; numberRef?: Ref<HTMLInputElement> }) {
  const id = useId().replace(/:/g, "");
  const brand = detectBrand(values.number.replace(/\D/g, ""));
  return (
    <div className="bl-cardfields">
      <Input
        id={`${id}-number`}
        label="Card number"
        name="cc-number"
        autoComplete="cc-number"
        inputMode="numeric"
        placeholder="1234 1234 1234 1234"
        mono
        icon="card"
        ref={numberRef}
        value={values.number}
        onChange={(e) => onChange({ ...values, number: formatCardNumber(e.target.value) })}
        suffix={<BrandHint brand={brand} />}
        error={errors.number}
      />
      <div className="bl-cardfields__row">
        <Input
          id={`${id}-exp`}
          label="Expiry"
          name="cc-exp"
          autoComplete="cc-exp"
          inputMode="numeric"
          placeholder="MM / YY"
          mono
          value={values.expiry}
          onChange={(e) => onChange({ ...values, expiry: formatExpiry(e.target.value, values.expiry) })}
          error={errors.expiry}
        />
        <Input
          id={`${id}-cvc`}
          label="CVC"
          name="cc-csc"
          autoComplete="cc-csc"
          inputMode="numeric"
          placeholder={brand === "amex" ? "4 digits" : "3 digits"}
          mono
          maxLength={4}
          value={values.cvc}
          onChange={(e) => onChange({ ...values, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          error={errors.cvc}
        />
      </div>
      <Input
        id={`${id}-name`}
        label="Name on card"
        name="cc-name"
        autoComplete="cc-name"
        value={values.name}
        onChange={(e) => onChange({ ...values, name: e.target.value })}
        error={errors.name}
      />
    </div>
  );
}

export function focusFirstError(root: HTMLElement | null) {
  root?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
}

export function CountryField({ value, onChange, label = "Country" }: { value: string | null; onChange: (code: string | null) => void; label?: string }) {
  const id = `${useId().replace(/:/g, "")}-country`;
  const options = useMemo(() => COUNTRIES.map((c) => ({ value: c.code, label: c.name })), []);
  const commit = useRef(onChange);
  commit.current = onChange;
  useEffect(() => {
    // Combobox takes no autoComplete prop, so the token is set here. Autofill writes a code or a name
    // straight into the text box, which the filter alone would not select.
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    el.setAttribute("autocomplete", "country");
    el.setAttribute("name", "country");
    function onInput(e: Event) {
      const typed = (e as InputEvent).inputType?.startsWith("insert") && (e as InputEvent).inputType !== "insertReplacementText" && (e as InputEvent).inputType !== "insertFromPaste";
      const v = el!.value.trim().toLowerCase();
      const hit = COUNTRIES.find((c) => c.name.toLowerCase() === v || (!typed && c.code.toLowerCase() === v));
      if (!hit) return;
      commit.current(hit.code);
      window.setTimeout(() => {
        if (el!.getAttribute("aria-expanded") === "true") el!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }, 0);
    }
    el.addEventListener("input", onInput);
    return () => el.removeEventListener("input", onInput);
  }, [id]);
  return <Combobox id={id} label={label} options={options} value={value} onChange={onChange} placeholder="Search countries" emptyText="No country matches" />;
}

export function CardModal({
  open,
  onClose,
  title,
  submitLabel,
  onSaved,
  defaultName,
  showMakeDefault,
  primary = true,
  saved = [],
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  submitLabel: string;
  onSaved: (card: { brand: CardBrand; last4: string; expMonth: number; expYear: number; name: string; makeDefault: boolean }) => void;
  defaultName: string;
  showMakeDefault?: boolean;
  primary?: boolean;
  saved?: PaymentMethod[];
  children?: ReactNode;
}) {
  const [source, setSource] = useState<string>("new");
  const [values, setValues] = useState<CardValues>({ ...EMPTY_CARD, name: defaultName });
  const [errors, setErrors] = useState<CardErrors>({});
  const [makeDefault, setMakeDefault] = useState(true);
  const [saving, setSaving] = useState(false);
  const [declined, setDeclined] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  useEffect(() => {
    if (!open) {
      setValues({ ...EMPTY_CARD, name: defaultName });
      setErrors({});
      setSaving(false);
      setDeclined(false);
      setSource("new");
    }
  }, [open, defaultName]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const pick = saved.find((m) => m.id === source);
    if (pick) {
      setSaving(true);
      window.setTimeout(() => {
        setSaving(false);
        onSaved({ brand: pick.brand, last4: pick.last4, expMonth: pick.expMonth, expYear: pick.expYear, name: pick.name, makeDefault: true });
      }, 1100);
      return;
    }
    const errs = validateCard(values);
    setErrors(errs);
    setDeclined(false);
    if (Object.keys(errs).length) {
      window.requestAnimationFrame(() => focusFirstError(formRef.current));
      return;
    }
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      if (last4(values) === "0002") {
        setDeclined(true);
        numberRef.current?.focus();
        return;
      }
      const [mm, yy] = values.expiry.split("/").map((x) => Number(x.trim()));
      onSaved({ brand: detectBrand(values.number.replace(/\D/g, "")), last4: last4(values), expMonth: mm, expYear: 2000 + yy, name: values.name.trim(), makeDefault: showMakeDefault ? makeDefault : true });
    }, 1100);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      initialFocus={saved.length ? undefined : numberRef}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant={primary ? "primary" : "secondary"} loading={saving}>
            {saving ? "Checking card" : submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} ref={formRef} className="bl-cardmodal" onSubmit={submit} noValidate>
        {children}
        {declined && (
          <Callout tone="crit" role="alert" title="Your card was declined. No charge was made.">
            Try another card, or ask your bank to allow payments to Rootpanther.
          </Callout>
        )}
        {saved.length > 0 && (
          <RadioGroup
            name={`${formId}-source`}
            legend="Pay with"
            value={source}
            onChange={setSource}
            options={[
              ...saved.map((m) => ({ value: m.id, label: cardLabel(m), description: `Saved card, expires ${cardExpiry(m)}` })),
              { value: "new", label: "A new card" },
            ]}
          />
        )}
        {source === "new" && <CardFields values={values} onChange={setValues} errors={errors} numberRef={numberRef} />}
        {showMakeDefault && source === "new" && <Checkbox label="Make this the default card" description="Renewals and retries use the default card." checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />}
        <p className="bl-cardmodal__note">
          <Icon name="lock" size={13} />
          <span>
            Rootpanther never sees the full number. Stored by <StripeMark height={12} />
          </span>
        </p>
      </form>
    </Modal>
  );
}
