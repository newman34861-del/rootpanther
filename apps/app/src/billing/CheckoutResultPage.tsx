import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button, ButtonLink, Icon, KeyValue, Lockup, StatusDot, cx } from "@rootpanther/ui";
import type { IconName } from "@rootpanther/ui";
import { currentUser } from "../mock/account";
import {
  BILLING_EMAIL,
  CARD_BRAND_LABEL,
  LAB_HOURS,
  NEXT_INVOICE_NUMBER,
  TRIAL_DAYS,
  addDays,
  addMonths,
  cardLabel,
  longDate,
  now,
  paymentMethods,
  pendingDebit,
  periodPrice,
  planById,
  practitionerPlan,
  teamPlan,
} from "../mock/billing";
import type { CardBrand, Interval } from "../mock/billing";
import { money } from "./parts";
import "./billing.css";

const CANCEL_REASONS = ["Price", "Need to check with my employer", "Comparing other labs", "Not ready to start yet", "Wanted to pay another way", "Something else"];

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="bl-result-page">
      <main id="main" className="bl-result-page__main">
        <Link to="/" className="bl-result-page__brand" aria-label="Rootpanther home">
          <Lockup size="md" />
        </Link>
        {children}
      </main>
    </div>
  );
}

function Head({ icon, tone, title, children }: { icon: IconName; tone: "success" | "info" | "neutral"; title: string; children?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="bl-result__head">
      <span className={cx("bl-result__icon", `is-${tone}`)} aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <h1 ref={ref} id="bl-res-title" tabIndex={-1} className="bl-result__title">
        {title}
      </h1>
      {children && <p className="bl-result__lead">{children}</p>}
    </div>
  );
}

function readOrder(params: URLSearchParams) {
  const plan = planById(params.get("plan")) ?? practitionerPlan;
  const interval: Interval = params.get("interval") === "year" ? "year" : "month";
  const seats = plan.id === "team" ? Math.max(teamPlan.minSeats, Number(params.get("seats")) || teamPlan.minSeats) : 1;
  const trial = params.get("trial") === "1";
  const nextParam = Number(params.get("next"));
  const price = nextParam > 0 ? nextParam : periodPrice(plan.id, interval, seats);
  const paidParam = params.get("paid");
  const paid = trial ? 0 : paidParam !== null && !Number.isNaN(Number(paidParam)) ? Number(paidParam) : price;
  const last4 = params.get("card");
  const brand = (Object.keys(CARD_BRAND_LABEL) as CardBrand[]).find((b) => b === params.get("brand")) ?? "unknown";
  const card = last4 && /^\d{4}$/.test(last4) ? { brand, last4 } : paymentMethods[0];
  const next = trial ? addDays(now(), TRIAL_DAYS) : addMonths(now(), interval === "year" ? 12 : 1);
  return { plan, interval, seats, trial, price, paid, card, next };
}

function Success() {
  const [params] = useSearchParams();
  const o = readOrder(params);
  const receipt = `/billing?receipt=${NEXT_INVOICE_NUMBER}`;
  const items = [
    { label: "Plan", value: `${o.plan.name}, ${o.interval === "year" ? "annual" : "monthly"}${o.plan.id === "team" ? `, ${o.seats} seats` : ""}` },
    { label: o.trial ? "Charged today" : "Paid today", value: <span className="rp-mono rp-num">{money(o.paid)}</span> },
    { label: o.trial ? "Trial ends" : "Next billing date", value: longDate(o.next) },
    { label: o.trial ? "First charge" : "Next charge", value: <span className="rp-mono rp-num">{money(o.price)}</span> },
    { label: "Card", value: cardLabel(o.card) },
    { label: "Lab hours", value: `${LAB_HOURS} active hours a month${o.plan.id === "team" ? " per seat" : ""}` },
  ];
  return (
    <section className="bl-result rp-card" aria-labelledby="bl-res-title">
      <div className="rp-sr" role="status">
        {o.trial ? "Trial started." : `Payment succeeded. ${money(o.paid)} charged.`}
      </div>
      <Head icon="check-circle" tone="success" title={o.trial ? `Your ${o.plan.name} trial has started` : `You are subscribed to ${o.plan.name}`}>
        {o.trial
          ? `Nothing is charged until ${longDate(o.next)}. Cancel from Billing before then and you pay nothing.`
          : `Every lab is open to you now. A receipt is on its way to ${currentUser.email}.`}
      </Head>
      <KeyValue className="bl-result__kv" items={items} />
      <div className="bl-result__actions">
        <ButtonLink to="/onboarding" variant="primary" size="lg" iconRight="arrow-right">
          Set up your first lab
        </ButtonLink>
        <ButtonLink to={o.trial ? "/billing" : receipt} variant="secondary" size="lg" iconLeft={o.trial ? "card" : "receipt"}>
          {o.trial ? "Billing" : "View receipt"}
        </ButtonLink>
      </div>
      <p className="bl-result__foot">
        {o.trial ? (
          <>Your card is saved with Stripe. It is not charged during the trial.</>
        ) : (
          <>
            Receipt <span className="rp-mono">{NEXT_INVOICE_NUMBER}</span>. Invoices and payment methods live in{" "}
            <Link to="/billing">Billing</Link>.
          </>
        )}
      </p>
    </section>
  );
}

function Cancelled() {
  const [params] = useSearchParams();
  const [reason, setReason] = useState<string | null>(null);
  const plan = planById(params.get("plan")) ?? practitionerPlan;
  const interval = params.get("interval") === "year" ? "year" : "month";
  return (
    <section className="bl-result rp-card" aria-labelledby="bl-res-title">
      <div className="rp-sr" role="status">
        Checkout cancelled. Nothing was charged.
      </div>
      <Head icon="card" tone="neutral" title="Checkout cancelled. Nothing was charged.">
        No card details were saved and your account is unchanged. You can pick a plan again whenever you are ready.
      </Head>
      <div className="bl-result__actions">
        <ButtonLink to={`/pricing${interval === "year" ? "?interval=year" : ""}`} variant="secondary" size="lg" iconLeft="arrow-left">
          Back to pricing
        </ButtonLink>
        <ButtonLink to={`/checkout?plan=${plan.id}&interval=${interval}&mode=hosted${plan.id === "practitioner" ? "&trial=1" : ""}`} variant="quiet" size="lg">
          Return to checkout
        </ButtonLink>
      </div>
      <div className="bl-reason">
        {reason ? (
          <p className="bl-reason__thanks" role="status">
            <Icon name="check" size={14} />
            <span>
              Thanks, recorded: <span className="rp-strong">{reason}</span>. The team that sets plans and prices reads every answer.
            </span>
          </p>
        ) : (
          <fieldset className="bl-reason__set">
            <legend className="bl-reason__legend">
              What stopped you? <span className="bl-reason__opt">Optional, one click</span>
            </legend>
            <div className="bl-reason__opts">
              {CANCEL_REASONS.map((r) => (
                <button key={r} type="button" className="bl-reason__btn" onClick={() => setReason(r)}>
                  {r}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </div>
    </section>
  );
}

function Processing() {
  const [params] = useSearchParams();
  const o = readOrder(params);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const steps: { tone: "primary" | "neutral"; done?: boolean; title: string; detail: string }[] = [
    { tone: "neutral", done: true, title: "Payment submitted", detail: `${pendingDebit.method}. ${money(o.price)} for ${o.plan.name}, ${o.interval === "year" ? "annual" : "monthly"}.` },
    { tone: "primary", title: "Bank confirms the debit", detail: `Usually 3 to 4 business days. Expected by ${longDate(pendingDebit.expectedBy)}.` },
    { tone: "neutral", title: "Labs open", detail: `We email ${currentUser.email} and every lab opens as soon as the bank confirms.` },
  ];
  function check() {
    setChecking(true);
    window.setTimeout(() => {
      setChecking(false);
      setCheckedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    }, 900);
  }
  return (
    <section className="bl-result rp-card" aria-labelledby="bl-res-title">
      <Head icon="clock" tone="info" title="Payment processing">
        Your bank is confirming the payment. Primers, drills and Onyx mentor mode are available now. Labs open when the payment clears.
      </Head>
      <ol className="bl-steps" aria-label="What happens next">
        {steps.map((s) => (
          <li key={s.title} className={cx("bl-steps__item", `is-${s.tone}`)}>
            <StatusDot tone={s.tone} hollow={s.tone === "neutral" && !s.done} size="sm" />
            <div>
              <div className="bl-steps__title">{s.title}</div>
              <div className="bl-steps__detail">{s.detail}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="bl-result__actions">
        <ButtonLink to="/onyx/primers" variant="secondary" size="lg" iconLeft="book">
          Read a primer while you wait
        </ButtonLink>
        <Button variant="quiet" size="lg" iconLeft="refresh" onClick={check} loading={checking}>
          Check status
        </Button>
      </div>
      <p className="bl-result__foot" role="status" aria-live="polite">
        {checkedAt ? `Checked at ${checkedAt}. Still waiting on the bank.` : `If the debit fails, nothing is charged and we email you. Questions: `}
        {!checkedAt && <a href={`mailto:${BILLING_EMAIL}`}>{BILLING_EMAIL}</a>}
      </p>
    </section>
  );
}

function Unknown() {
  return (
    <section className="bl-result rp-card" aria-labelledby="bl-res-title">
      <Head icon="crosshair" tone="neutral" title="No checkout result at this address">
        Your subscription status is always current in Billing.
      </Head>
      <div className="bl-result__actions">
        <ButtonLink to="/billing" variant="secondary" size="lg">
          Go to Billing
        </ButtonLink>
      </div>
    </section>
  );
}

export default function CheckoutResultPage() {
  const { result } = useParams();
  const body = result === "success" ? <Success /> : result === "cancelled" ? <Cancelled /> : result === "processing" ? <Processing /> : <Unknown />;
  return <Frame>{body}</Frame>;
}
