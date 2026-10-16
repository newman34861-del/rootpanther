import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, ButtonLink, Callout, Icon, Input, LoadingRegion, Skeleton, Spinner, StripeMark, Tag, formatMoney } from "@rootpanther/ui";
import { currentUser } from "../mock/account";
import {
  CARD_BRAND_LABEL,
  LAB_HOURS,
  TRIAL_DAYS,
  addDays,
  addMonths,
  billingAddress,
  countryByCode,
  findCoupon,
  longDate,
  now,
  periodPrice,
  planById,
  practitionerPlan,
  previewChange,
  round2,
  subscription,
  taxFor,
  teamPlan,
} from "../mock/billing";
import type { Coupon, Interval, PlanId } from "../mock/billing";
import { useDataState } from "../review/review";
import { CardFields, CountryField, EMPTY_CARD, PublicTopBar, SkipLink, SummaryLine, detectBrand, focusFirstError, last4, money, validateCard } from "./parts";
import type { CardErrors, CardValues } from "./parts";
import "./billing.css";

const DECLINED_CARD: CardValues = { number: "4000 0000 0000 0002", expiry: "09 / 28", cvc: "123", name: currentUser.name };

interface Order {
  planId: PlanId;
  planName: string;
  interval: Interval;
  seats: number;
  trial: boolean;
  upgrade: boolean;
}

function readOrder(params: URLSearchParams): Order {
  const plan = planById(params.get("plan")) ?? practitionerPlan;
  const planId = (plan.id === "free" ? "practitioner" : plan.id) as PlanId;
  const upgrade = params.get("upgrade") === "1";
  const asked: Interval = params.get("interval") === "year" ? "year" : "month";
  const interval: Interval = upgrade && planId === subscription.planId && asked === subscription.interval ? "year" : asked;
  const seats = planId === "team" ? Math.max(teamPlan.minSeats, Number(params.get("seats")) || teamPlan.minSeats) : 1;
  return {
    planId,
    planName: planById(planId)!.name,
    interval,
    seats,
    upgrade,
    trial: !upgrade && planId === "practitioner" && params.get("trial") === "1",
  };
}

interface Totals {
  lines: { label: string; detail?: string; amount: number; credit?: boolean }[];
  subtotal: number;
  discount: number;
  tax: number;
  taxLabel: string;
  taxDetail: string;
  dueToday: number;
  next: { amount: number; on: string };
}

function computeTotals(order: Order, country: string | null, coupon: Coupon | null): Totals {
  const today = now();
  const price = periodPrice(order.planId, order.interval, order.seats);
  const span = (from: string) => `${longDate(from)} to ${longDate(addMonths(from, order.interval === "year" ? 12 : 1))}`;
  const lines: Totals["lines"] = [];
  let subtotal = price;
  let nextOn = addMonths(today, order.interval === "year" ? 12 : 1);

  if (order.upgrade) {
    const p = previewChange({ planId: order.planId, interval: order.interval, seats: order.seats });
    lines.push({ label: `Unused time on ${planById(subscription.planId)!.name}, monthly`, detail: `${p.unusedDays} of ${p.periodDays} days remaining`, amount: -p.credit, credit: true });
    lines.push({ label: `${order.planName}, ${order.interval === "year" ? "annual" : "monthly"}`, detail: `${longDate(p.newPeriodStart)} to ${longDate(p.newPeriodEnd)}`, amount: p.newCharge });
    subtotal = round2(p.newCharge - p.credit);
    nextOn = p.nextCharge?.on ?? nextOn;
  } else if (order.trial) {
    lines.push({ label: `${TRIAL_DAYS}-day trial`, detail: `Ends ${longDate(addDays(today, TRIAL_DAYS))}`, amount: 0 });
    subtotal = 0;
    nextOn = addDays(today, TRIAL_DAYS);
  } else if (order.planId === "team") {
    const unit = order.interval === "year" ? teamPlan.priceAnnualTotal! : teamPlan.priceMonthly;
    lines.push({ label: `${order.seats} seats × ${formatMoney(unit, "USD", 2)}`, detail: span(today), amount: price });
  } else {
    lines.push({ label: `${order.planName}, ${order.interval === "year" ? "annual" : "monthly"}`, detail: span(today), amount: price });
  }

  const discount = coupon && subtotal > 0 ? round2((subtotal * coupon.percentOff) / 100) : 0;
  const t = taxFor(country);
  const tax = round2(((subtotal - discount) * t.rate) / 100);
  const nextTax = round2((price * t.rate) / 100);
  return {
    lines,
    subtotal,
    discount,
    tax,
    taxLabel: t.rate > 0 ? `${t.label} ${t.rate}%` : "Tax",
    taxDetail: country ? (t.rate > 0 ? countryByCode(country)!.name : `None charged in ${countryByCode(country)!.name}`) : "Select a country to calculate",
    dueToday: round2(subtotal - discount + tax),
    next: { amount: round2(price + nextTax), on: nextOn },
  };
}

function OrderSummary({ order, totals, coupon }: { order: Order; totals: Totals; coupon: Coupon | null }) {
  const plan = planById(order.planId)!;
  return (
    <section className="bl-summary" aria-labelledby="bl-summary-title">
      <h2 id="bl-summary-title" className="bl-summary__title">
        Order summary
      </h2>
      <div className="bl-summary__plan">
        <div>
          <div className="bl-summary__name">{plan.name}</div>
          <div className="bl-summary__sub">
            {order.interval === "year" ? "Annual, billed yearly" : "Monthly"}
            {order.planId === "team" ? `, ${order.seats} seats` : ""}. {LAB_HOURS} active lab hours a month{order.planId === "team" ? " per seat" : ""}, fair use.
          </div>
        </div>
        <span className="bl-summary__price rp-mono rp-num">
          {money(periodPrice(order.planId, order.interval, order.seats))}
          <span>/{order.interval === "year" ? "yr" : "mo"}</span>
        </span>
      </div>
      <dl className="bl-summary__lines">
        {totals.lines.map((l) => (
          <SummaryLine key={l.label} label={l.label} detail={l.detail} value={money(l.amount)} className={l.credit ? "is-credit" : undefined} />
        ))}
        {totals.discount > 0 && coupon && <SummaryLine label={`Coupon ${coupon.code}`} detail={`${coupon.percentOff}% off this payment`} value={money(-totals.discount)} className="is-credit" />}
        <SummaryLine label={totals.taxLabel} detail={totals.taxDetail} value={money(totals.tax)} />
      </dl>
      <dl className="bl-summary__total">
        <SummaryLine label="Total due today" value={money(totals.dueToday)} strong />
      </dl>
      <p className="bl-summary__next">
        Next charge <span className="rp-mono rp-num rp-strong">{money(totals.next.amount)}</span> on <span className="rp-strong">{longDate(totals.next.on)}</span>
        {order.trial ? ", when the trial ends" : ""}, then every {order.interval === "year" ? "year" : "month"}.
      </p>
      <p className="bl-summary__cancel">
        <Icon name="shield-check" size={14} />
        <span>
          Cancel any time from Billing{order.trial ? `, before ${longDate(totals.next.on)} to pay nothing` : ""}. Your progress, notes, proofs and reports are kept.
        </span>
      </p>
    </section>
  );
}

function CouponField({ coupon, onApply, onRemove }: { coupon: Coupon | null; onApply: (c: Coupon) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (coupon) {
    return (
      <div className="bl-coupon is-applied" role="status">
        <Tag icon="check" mono>
          {coupon.code}
        </Tag>
        <span className="bl-coupon__desc">{coupon.description}</span>
        <button type="button" className="rp-link rp-small" onClick={onRemove}>
          Remove<span className="rp-sr"> coupon {coupon.code}</span>
        </button>
      </div>
    );
  }
  if (!open) {
    return (
      <button type="button" className="rp-link rp-small bl-coupon__toggle" onClick={() => setOpen(true)} aria-expanded={false}>
        Add a coupon code
      </button>
    );
  }
  function apply() {
    const c = findCoupon(code);
    if (!code.trim()) setError("Enter a code.");
    else if (!c) setError("This code is not valid or has expired.");
    else {
      setError(null);
      setCode("");
      setOpen(false);
      onApply(c);
    }
  }
  return (
    <div className="bl-coupon">
      <Input
        ref={inputRef}
        label="Coupon code"
        mono
        autoComplete="off"
        spellCheck={false}
        placeholder="RP-STUDY15"
        value={code}
        error={error ?? undefined}
        onChange={(e) => {
          setCode(e.target.value.toUpperCase());
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          }
        }}
        suffix={
          <button type="button" className="bl-coupon__apply" onClick={apply}>
            Apply
          </button>
        }
      />
    </div>
  );
}

function ElementsSkeleton() {
  return (
    <LoadingRegion label="Loading payment form">
      <div className="bl-checkout__grid" aria-hidden="true">
        <div className="bl-checkout__form rp-card bl-pad">
          <Skeleton width={140} height={14} />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bl-skelfield">
              <Skeleton width={90} height={10} />
              <Skeleton height={36} radius="md" />
            </div>
          ))}
          <Skeleton height={42} radius="md" style={{ marginTop: 8 }} />
        </div>
        <div className="bl-summary">
          <Skeleton width={120} height={14} />
          <Skeleton height={60} radius="md" style={{ marginTop: 16 }} />
          <Skeleton width="90%" height={10} style={{ marginTop: 20 }} />
          <Skeleton width="70%" height={10} style={{ marginTop: 12 }} />
          <Skeleton width="80%" height={10} style={{ marginTop: 12 }} />
        </div>
      </div>
    </LoadingRegion>
  );
}

function ElementsCheckout({ order, declinedOnLoad }: { order: Order; declinedOnLoad: boolean }) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [card, setCard] = useState<CardValues>(declinedOnLoad ? DECLINED_CARD : { ...EMPTY_CARD, name: currentUser.name });
  const [errors, setErrors] = useState<CardErrors>({});
  const [country, setCountry] = useState<string | null>(billingAddress.country);
  const [postal, setPostal] = useState(declinedOnLoad ? billingAddress.postalCode : "");
  const [postalError, setPostalError] = useState<string | null>(null);
  const [taxId, setTaxId] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [paying, setPaying] = useState(false);
  const [declined, setDeclined] = useState(declinedOnLoad);
  const [announce, setAnnounce] = useState("");
  const declineRef = useRef<HTMLDivElement>(null);
  const triedPay = useRef(false);

  const totals = computeTotals(order, country, coupon);
  const c = countryByCode(country);
  const needsPostal = !!c?.postal;
  const taxLabel = c?.tax ? `${c.tax.label} number` : "Tax ID";
  const payLabel = order.trial ? `Start ${TRIAL_DAYS}-day trial` : `Pay ${money(totals.dueToday)}`;

  useEffect(() => {
    if (declined && triedPay.current) declineRef.current?.focus();
  }, [declined]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validateCard(card);
    const pErr = needsPostal && !postal.trim() ? "Enter your postal code." : null;
    setErrors(errs);
    setPostalError(pErr);
    if (Object.keys(errs).length || pErr || !country) {
      const count = Object.keys(errs).length + (pErr ? 1 : 0) + (country ? 0 : 1);
      setAnnounce(`${count} field${count === 1 ? "" : "s"} need${count === 1 ? "s" : ""} attention.`);
      window.requestAnimationFrame(() => focusFirstError(formRef.current));
      return;
    }
    triedPay.current = true;
    setDeclined(false);
    setAnnounce(order.trial ? "Starting trial" : "Processing payment");
    setPaying(true);
    window.setTimeout(() => {
      setPaying(false);
      if (last4(card) === "0002") {
        setDeclined(true);
        setAnnounce("Your card was declined. No charge was made.");
        return;
      }
      const p = new URLSearchParams({ plan: order.planId, interval: order.interval, paid: String(totals.dueToday), card: last4(card), brand: detectBrand(card.number.replace(/\D/g, "")), next: String(totals.next.amount) });
      if (order.trial) p.set("trial", "1");
      if (order.planId === "team") p.set("seats", String(order.seats));
      navigate(`/checkout/success?${p.toString()}`);
    }, 1400);
  }

  return (
    <div className="bl-checkout__grid">
      <form ref={formRef} className="bl-checkout__form rp-card" onSubmit={submit} noValidate aria-labelledby="bl-pay-title">
        <div className="bl-pad">
          <div className="bl-form__head">
            <h2 id="bl-pay-title">Payment details</h2>
            <span className="bl-form__secure">
              <Icon name="lock" size={13} />
              Card details go to <StripeMark height={13} /> only
            </span>
          </div>
          {declined && (
            <div ref={declineRef} tabIndex={-1} className="bl-decline">
              <Callout tone="crit" title="Your card was declined. No charge was made." role="alert">
                The bank declined {CARD_BRAND_LABEL[detectBrand(card.number.replace(/\D/g, ""))]} ending {last4(card)} without giving a reason. Try another card, or ask your bank to allow the payment and try again.
              </Callout>
            </div>
          )}
          <fieldset className="bl-fieldset" disabled={paying}>
            <legend className="rp-sr">Card</legend>
            <CardFields
              values={card}
              onChange={(v) => {
                setCard(v);
                if (Object.keys(errors).length) setErrors({});
              }}
              errors={errors}
            />
          </fieldset>
          <fieldset className="bl-fieldset" disabled={paying}>
            <legend className="bl-legend">Billing details</legend>
            <div className="bl-form__row">
              <CountryField value={country} onChange={setCountry} />
              {needsPostal && (
                <Input
                  label={country === "US" ? "ZIP code" : "Postal code"}
                  name="postal-code"
                  autoComplete="postal-code"
                  value={postal}
                  onChange={(e) => {
                    setPostal(e.target.value);
                    setPostalError(null);
                  }}
                  error={postalError ?? undefined}
                />
              )}
            </div>
            {!country && <p className="bl-form__err" role="alert">Select your country to calculate tax.</p>}
            <Input label={taxLabel} optional mono autoComplete="off" spellCheck={false} placeholder={c?.code === "GB" ? "GB123456789" : ""} value={taxId} onChange={(e) => setTaxId(e.target.value)} hint="Shown on your invoices." />
          </fieldset>
          <div className="bl-form__coupon">
            <CouponField
              coupon={coupon}
              onApply={(cp) => {
                setCoupon(cp);
                setAnnounce(`Coupon ${cp.code} applied. Total due today is now ${money(computeTotals(order, country, cp).dueToday)}.`);
              }}
              onRemove={() => {
                setCoupon(null);
                setAnnounce("Coupon removed.");
              }}
            />
          </div>
        </div>
        <div className="bl-form__foot">
          <Button type="submit" variant="primary" size="lg" block loading={paying}>
            {paying ? (order.trial ? "Starting trial" : "Processing payment") : payLabel}
          </Button>
          <p className="bl-form__terms">
            {order.trial
              ? `Your card is charged ${money(totals.next.amount)} on ${longDate(totals.next.on)} unless you cancel before then.`
              : `You authorise Rootpanther to charge this card ${money(totals.next.amount)} every ${order.interval === "year" ? "year" : "month"} until you cancel.`}{" "}
            <a href="https://rootpanther.com/terms">Terms</a>
          </p>
        </div>
      </form>
      <aside className="bl-checkout__aside" aria-label="Order">
        <OrderSummary order={order} totals={totals} coupon={coupon} />
      </aside>
      <div className="rp-sr" role="status" aria-live="polite">
        {announce}
      </div>
    </div>
  );
}

function HostedCheckout({ order }: { order: Order }) {
  const navigate = useNavigate();
  const [going, setGoing] = useState(false);
  const [status, setStatus] = useState("");
  const totals = computeTotals(order, null, null);
  const plan = planById(order.planId)!;

  useEffect(() => {
    const t = window.setTimeout(() => setStatus("Redirecting to Stripe Checkout"), 300);
    return () => window.clearTimeout(t);
  }, []);

  function go() {
    setGoing(true);
    const p = new URLSearchParams({ plan: order.planId, interval: order.interval, paid: String(totals.subtotal) });
    if (order.trial) p.set("trial", "1");
    if (order.planId === "team") p.set("seats", String(order.seats));
    window.setTimeout(() => navigate(`/checkout/success?${p.toString()}`), 700);
  }

  return (
    <div className="bl-handoff rp-card">
      <div className="bl-handoff__status">
        <Spinner size={18} />
        <div>
          <h1 className="bl-handoff__title">Redirecting to Stripe Checkout</h1>
          <p className="bl-handoff__text">You enter your card on checkout.stripe.com and come back here when it is done.</p>
        </div>
      </div>
      <dl className="bl-handoff__lines">
        <SummaryLine label={plan.name} detail={`${order.interval === "year" ? "Annual" : "Monthly"}${order.planId === "team" ? `, ${order.seats} seats` : ""}. ${LAB_HOURS} active lab hours a month, fair use.`} value={`${money(periodPrice(order.planId, order.interval, order.seats))}/${order.interval === "year" ? "yr" : "mo"}`} />
        {(order.trial || order.upgrade) &&
          totals.lines.map((l) => <SummaryLine key={l.label} label={l.label} detail={l.detail} value={money(l.amount)} className={l.credit ? "is-credit" : undefined} />)}
        <SummaryLine label="Due today" detail="Before tax, which Stripe adds for your country" value={money(totals.subtotal)} strong />
      </dl>
      <p className="bl-handoff__next">
        Then <span className="rp-mono rp-num rp-strong">{money(periodPrice(order.planId, order.interval, order.seats))}</span> on {longDate(totals.next.on)} and every{" "}
        {order.interval === "year" ? "year" : "month"} after. Cancel any time. Your progress and reports are kept.
      </p>
      <div className="bl-handoff__actions">
        <Button variant="primary" size="lg" iconRight="arrow-right" onClick={go} loading={going}>
          Continue to Stripe
        </Button>
        <ButtonLink to={order.upgrade ? "/billing" : `/pricing${order.interval === "year" ? "?interval=year" : ""}`} variant="quiet" size="lg">
          {order.upgrade ? "Back to billing" : "Back to pricing"}
        </ButtonLink>
      </div>
      <p className="bl-handoff__fallback">If the page does not change in a few seconds, use Continue to Stripe.</p>
      <div className="bl-handoff__foot">
        <span>Payments processed by</span>
        <StripeMark height={15} />
      </div>
      <div className="rp-sr" role="status" aria-live="polite">
        {status}
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const [params] = useSearchParams();
  const state = useDataState();
  const order = readOrder(params);
  const mode = params.get("mode") === "elements" ? "elements" : "hosted";
  const title = order.upgrade ? `Upgrade to ${order.planName}, ${order.interval === "year" ? "annual" : "monthly"}` : order.trial ? `Start your ${order.planName} trial` : `Subscribe to ${order.planName}`;

  return (
    <div className="bl-public">
      <SkipLink />
      <PublicTopBar>
        <span className="bl-top__secure">
          <Icon name="user" size={14} />
          <span className="rp-truncate">{currentUser.email}</span>
        </span>
      </PublicTopBar>
      <main id="main" tabIndex={-1} className="bl-main">
        {mode === "hosted" ? (
          <div className="bl-center">
            <HostedCheckout order={order} />
          </div>
        ) : (
          <div className="bl-checkout">
            <Link to={order.upgrade ? "/billing" : "/pricing"} className="bl-back">
              <Icon name="arrow-left" size={14} />
              {order.upgrade ? "Billing" : "Pricing"}
            </Link>
            <h1 className="bl-checkout__title">{title}</h1>
            {state === "loading" ? <ElementsSkeleton /> : <ElementsCheckout order={order} declinedOnLoad={state === "error"} />}
          </div>
        )}
      </main>
    </div>
  );
}
