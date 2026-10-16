import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  Callout,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Input,
  InvoiceTable,
  KeyValue,
  LoadingRegion,
  Modal,
  Page,
  PageHeader,
  PlanRequired,
  RadioGroup,
  SegmentedControl,
  Skeleton,
  SkeletonText,
  StatusDot,
  UsageMeter,
  cx,
  useToast,
} from "@rootpanther/ui";
import type { Invoice } from "@rootpanther/ui";
import { currentUser, usage } from "../mock/account";
import {
  IDLE_SHUTDOWN_MIN,
  LAB_HOURS,
  addMonths,
  billingAddress,
  cardExpiry,
  cardLabel,
  countryByCode,
  dayMonth,
  invoices,
  lapsed,
  longDate,
  paymentMethods as initialMethods,
  periodPrice,
  planById,
  practitionerPlan,
  previewChange,
  retained,
  retentionOffer,
  round2,
  subscription,
  teamPlan,
  usagePeriod,
} from "../mock/billing";
import type { BillingAddress, ChangeTarget, Interval, PaymentMethod, PlanId } from "../mock/billing";
import { useDataState } from "../review/review";
import { BrandTag, CardModal, CountryField, FactList, KEPT_ITEMS, Money, STOP_ITEMS, SummaryLine, money } from "./parts";
import "./billing.css";

type Status = { kind: "active" } | { kind: "paused"; resumesOn: string } | { kind: "cancelling"; endsOn: string };

function useLoadingDelay(active: boolean) {
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!active) return;
    setLoading(true);
    const t = window.setTimeout(() => setLoading(false), 900);
    return () => window.clearTimeout(t);
  }, [active]);
  return loading;
}

function ChangePlanModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (t: ChangeTarget) => void }) {
  const navigate = useNavigate();
  const [planId, setPlanId] = useState<PlanId>("practitioner");
  const [interval, setInterval] = useState<Interval>("year");
  const [seats, setSeats] = useState(teamPlan.minSeats);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPlanId("practitioner");
      setInterval("year");
      setSaving(false);
    }
  }, [open]);

  const target: ChangeTarget = { planId, interval: planId === "free" ? "month" : interval, seats: planId === "team" ? seats : 1 };
  const p = previewChange(target);
  const targetPlan = planById(planId)!;
  const options = [
    { value: "practitioner" as const, label: "Practitioner", description: "Every lab, Onyx at every help level, 60 lab hours a month." },
    { value: "team" as const, label: `Team, ${teamPlan.minSeats} seats or more`, description: "Practitioner for each seat, with seat management and one invoice." },
    { value: "free" as const, label: "Free", description: "Primers, drills and Onyx mentor mode. No labs." },
  ];

  function confirm() {
    if (p.kind === "upgrade" && planId === "practitioner") {
      onClose();
      navigate(`/checkout?plan=practitioner&interval=${interval}&mode=elements&upgrade=1`);
      return;
    }
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      onDone(target);
    }, 900);
  }

  const confirmLabel =
    p.kind === "same" ? "No change" : p.kind === "upgrade" ? (planId === "practitioner" ? "Continue to payment" : `Pay ${money(p.dueToday)} and switch`) : `Switch on ${dayMonth(p.effectiveOn)}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change plan"
      size="lg"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirm} disabled={p.kind === "same"} loading={saving}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="bl-change">
        <div className="bl-change__pick">
          <RadioGroup name="bl-plan" legend="Plan" value={planId} onChange={setPlanId} options={options} />
          {planId !== "free" && (
            <div className="bl-change__row">
              <span className="rp-field__label" id="bl-change-interval">
                Billing
              </span>
              <SegmentedControl
                size="sm"
                label="Billing interval"
                value={interval}
                onChange={setInterval}
                options={[
                  { value: "month", label: "Monthly" },
                  { value: "year", label: "Annual, 2 months free" },
                ]}
              />
            </div>
          )}
          {planId === "team" && (
            <div className="bl-change__row">
              <Input
                label="Seats"
                type="number"
                inputMode="numeric"
                min={teamPlan.minSeats}
                max={200}
                mono
                value={seats}
                onChange={(e) => setSeats(Math.max(teamPlan.minSeats, Math.min(200, Number(e.target.value) || teamPlan.minSeats)))}
                hint={`Minimum ${teamPlan.minSeats}. You keep your own seat.`}
              />
            </div>
          )}
        </div>
        <section className="bl-preview" aria-labelledby="bl-preview-title" aria-live="polite">
          <h3 id="bl-preview-title" className="bl-preview__title">
            {p.kind === "downgrade" ? "Scheduled change" : "Proration preview"}
          </h3>
          {p.kind === "same" ? (
            <p className="bl-preview__note">This is your current plan. Pick a different plan or interval to see the cost.</p>
          ) : p.kind === "upgrade" ? (
            <>
              <dl className="bl-preview__lines">
                <SummaryLine label="Credit for unused time" detail={`${p.unusedDays} of ${p.periodDays} days left on Practitioner, monthly`} value={money(-p.credit)} className="is-credit" />
                <SummaryLine
                  label={`${targetPlan.name}, ${target.interval === "year" ? "annual" : "monthly"}${planId === "team" ? `, ${seats} seats` : ""}`}
                  detail={`${dayMonth(p.newPeriodStart)} to ${longDate(p.newPeriodEnd)}${target.interval === subscription.interval ? ", prorated" : ""}`}
                  value={money(p.newCharge)}
                />
              </dl>
              <dl className="bl-preview__total">
                <SummaryLine label="Due today" detail="Before tax" value={money(p.dueToday)} strong />
              </dl>
              {p.nextCharge && (
                <p className="bl-preview__note">
                  Next renewal <span className="rp-mono rp-num rp-strong">{money(p.nextCharge.amount)}</span> on {longDate(p.nextCharge.on)}.
                </p>
              )}
            </>
          ) : (
            <>
              <dl className="bl-preview__lines">
                <SummaryLine label="Practitioner, monthly" detail={`Stays as it is until ${longDate(p.effectiveOn)}`} value="Paid" className="is-credit" />
                <SummaryLine label={`${targetPlan.name}${planId !== "free" ? `, ${target.interval === "year" ? "annual" : "monthly"}` : ""}`} detail={`Starts ${longDate(p.effectiveOn)}`} value={money(periodPrice(planId, target.interval, target.seats))} />
              </dl>
              <dl className="bl-preview__total">
                <SummaryLine label="Due today" value={money(0)} strong />
              </dl>
              <p className="bl-preview__note">
                {p.nextCharge ? (
                  <>
                    Next renewal <span className="rp-mono rp-num rp-strong">{money(p.nextCharge.amount)}</span> on {longDate(p.nextCharge.on)}.
                  </>
                ) : (
                  <>No further charges. Lab launching stops on {longDate(p.effectiveOn)}. Progress, notes, proofs and reports are kept.</>
                )}
              </p>
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}

function PauseModal({ open, onClose, onDone, renewsOn }: { open: boolean; onClose: () => void; onDone: (resumesOn: string, months: number) => void; renewsOn: string }) {
  const [months, setMonths] = useState<"1" | "2" | "3">("1");
  const [saving, setSaving] = useState(false);
  const resumesOn = addMonths(renewsOn, Number(months));
  useEffect(() => {
    if (open) setSaving(false);
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pause subscription"
      size="md"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Keep subscription active
          </Button>
          <Button
            variant="primary"
            loading={saving}
            onClick={() => {
              setSaving(true);
              window.setTimeout(() => onDone(resumesOn, Number(months)), 800);
            }}
          >
            Pause for {months} month{months === "1" ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="bl-modalstack">
        <RadioGroup
          name="bl-pause"
          legend="Pause for"
          layout="cards"
          value={months}
          onChange={setMonths}
          options={(["1", "2", "3"] as const).map((m) => ({
            value: m,
            label: `${m} month${m === "1" ? "" : "s"}`,
            description: `Resumes ${dayMonth(addMonths(renewsOn, Number(m)))}`,
          }))}
        />
        <KeyValue
          className="bl-panelkv"
          items={[
            { label: "Pause starts", value: longDate(renewsOn) },
            { label: "Billing resumes", value: <>{longDate(resumesOn)}, <span className="rp-mono rp-num">{money(subscription.amount)}</span></> },
          ]}
        />
        <div className="bl-twocol">
          <div>
            <h3 className="bl-minihead">Stops while paused</h3>
            <FactList tone="stop" items={[...STOP_ITEMS, { icon: "card", text: "Billing. Nothing is charged." }]} />
          </div>
          <div>
            <h3 className="bl-minihead">Kept</h3>
            <FactList items={KEPT_ITEMS} />
          </div>
        </div>
        <p className="bl-modalnote">
          Labs stay open until {longDate(renewsOn)}. You can resume early from this page, and billing restarts that day.
        </p>
      </div>
    </Modal>
  );
}

const CANCEL_REASONS = ["Passed the exam", "Taking a break from studying", "Too expensive", "Not enough labs at my tier", "Lab performance or connection problems", "Switching to another platform", "Other"];

type CancelStep = "reason" | "offer" | "confirm" | "done";

function CancelModal({
  open,
  onClose,
  endsOn,
  onPauseInstead,
  onAcceptOffer,
  onCancelled,
}: {
  open: boolean;
  onClose: () => void;
  endsOn: string;
  onPauseInstead: () => void;
  onAcceptOffer: () => void;
  onCancelled: () => void;
}) {
  const [step, setStep] = useState<CancelStep>("reason");
  const [reason, setReason] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const discounted = round2(subscription.amount * (1 - retentionOffer.percentOff / 100));
  const stepIndex = { reason: 1, offer: 2, confirm: 3, done: 3 }[step];

  useEffect(() => {
    if (open) {
      setStep("reason");
      setReason("");
      setDetail("");
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (open && step !== "reason") bodyRef.current?.querySelector<HTMLElement>("h3")?.focus();
  }, [step, open]);

  let body: ReactNode;
  let footer: ReactNode;
  if (step === "reason") {
    body = (
      <>
        <RadioGroup name="bl-cancel-reason" legend="Why are you cancelling? Optional" value={reason} onChange={setReason} options={CANCEL_REASONS.map((r) => ({ value: r, label: r }))} />
        {reason === "Other" && <Input label="Tell us more" optional value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={280} />}
      </>
    );
    footer = (
      <>
        <Button variant="quiet" onClick={onClose}>
          Keep subscription
        </Button>
        <Button variant="secondary" iconRight="arrow-right" onClick={() => setStep("offer")}>
          Continue
        </Button>
      </>
    );
  } else if (step === "offer") {
    body = (
      <>
        <h3 tabIndex={-1} className="bl-stephead">
          Before you go
        </h3>
        <div className="bl-offers">
          <div className="bl-offer">
            <div className="bl-offer__title">
              <Icon name="pause" size={15} />
              Pause instead
            </div>
            <p>Stop billing for 1 to 3 months. Labs stop while paused and everything is kept. Billing resumes on its own.</p>
            <Button variant="secondary" onClick={onPauseInstead}>
              Choose a pause length
            </Button>
          </div>
          <div className="bl-offer">
            <div className="bl-offer__title">
              <Icon name="money" size={15} />
              {retentionOffer.percentOff}% off for {retentionOffer.months} months
            </div>
            <p>
              <span className="rp-mono rp-num rp-strong">{money(discounted)}</span> a month instead of <span className="rp-mono rp-num">{money(subscription.amount)}</span> for your next {retentionOffer.months} renewals,
              then <span className="rp-mono rp-num">{money(subscription.amount)}</span> again.
            </p>
            <Button variant="secondary" onClick={onAcceptOffer}>
              Apply discount and stay
            </Button>
          </div>
        </div>
      </>
    );
    footer = (
      <>
        <Button variant="quiet" iconLeft="arrow-left" onClick={() => setStep("reason")}>
          Back
        </Button>
        <Button variant="destructive" onClick={() => setStep("confirm")}>
          No thanks, continue to cancel
        </Button>
      </>
    );
  } else if (step === "confirm") {
    body = (
      <>
        <h3 tabIndex={-1} className="bl-stephead">
          Lab launching stops on {longDate(endsOn)}
        </h3>
        <p className="bl-modalnote">
          You keep full access until then. After that your account stays open on the Free plan and nothing more is charged.
        </p>
        <div className="bl-twocol">
          <div>
            <h4 className="bl-minihead">Kept on your account</h4>
            <FactList items={[...KEPT_ITEMS, { icon: "user", text: "Your account and sign-in" }]} />
          </div>
          <div>
            <h4 className="bl-minihead">Stops on {dayMonth(endsOn)}</h4>
            <FactList tone="stop" items={[...STOP_ITEMS, { icon: "card", text: "Renewal charges" }]} />
          </div>
        </div>
        <p className="bl-modalnote">You can reactivate at any time and pick up where you left off.</p>
      </>
    );
    footer = (
      <>
        <Button variant="quiet" onClick={onClose}>
          Keep subscription
        </Button>
        <Button
          variant="danger"
          loading={saving}
          onClick={() => {
            setSaving(true);
            window.setTimeout(() => {
              setSaving(false);
              setStep("done");
              onCancelled();
            }, 900);
          }}
        >
          Cancel subscription
        </Button>
      </>
    );
  } else {
    body = (
      <>
        <h3 tabIndex={-1} className="bl-stephead">
          Your subscription ends on {longDate(endsOn)}
        </h3>
        <p className="bl-modalnote">
          Nothing more will be charged. Labs stay open until then. Your progress, notes, proofs and reports stay on your account. A confirmation is on its way to {currentUser.email}.
        </p>
      </>
    );
    footer = (
      <Button variant="secondary" onClick={onClose}>
        Done
      </Button>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Cancel subscription" size="md" footer={footer}>
      <div ref={bodyRef} className="bl-modalstack">
        {step !== "done" && (
          <ol className="bl-stepper" aria-label={`Step ${stepIndex} of 3`}>
            {["Reason", "Options", "Confirm"].map((l, i) => (
              <li key={l} className={cx(i + 1 === stepIndex && "is-on", i + 1 < stepIndex && "is-past")} aria-current={i + 1 === stepIndex ? "step" : undefined}>
                <span className="rp-mono">{i + 1}</span>
                {l}
              </li>
            ))}
          </ol>
        )}
        {body}
      </div>
    </Modal>
  );
}

function CurrentPlan({ status, onChange, onPause, onCancel, onResume }: { status: Status; onChange: () => void; onPause: () => void; onCancel: () => void; onResume: () => void }) {
  const plan = planById(subscription.planId)!;
  const pm = initialMethods.find((m) => m.id === subscription.paymentMethodId)!;
  const statusDot =
    status.kind === "active" ? (
      <StatusDot tone="primary" label="Active" size="sm" />
    ) : status.kind === "paused" ? (
      <StatusDot tone="med" label={`Paused from ${dayMonth(subscription.currentPeriodEnd)}`} size="sm" />
    ) : (
      <StatusDot tone="med" label={`Ends ${dayMonth(status.endsOn)}`} size="sm" />
    );

  const actions =
    status.kind === "active" ? (
      <>
        <Button variant="quiet" size="sm" onClick={onCancel}>
          Cancel subscription
        </Button>
        <Button variant="quiet" size="sm" onClick={onPause}>
          Pause
        </Button>
        <Button variant="secondary" size="sm" onClick={onChange}>
          Change plan
        </Button>
      </>
    ) : (
      <Button variant="secondary" size="sm" iconLeft="refresh" onClick={onResume}>
        {status.kind === "paused" ? "Cancel pause" : "Keep subscription"}
      </Button>
    );

  return (
    <Card title="Current plan" actions={actions} padding="none" className="bl-curplan">
      <div className="bl-plan">
        <div className="bl-plan__main">
          <div className="bl-plan__name">
            <h3>{plan.name}</h3>
            <span className="bl-plan__interval">Monthly</span>
            {statusDot}
          </div>
          <div className="bl-plan__price">
            <Money value={subscription.amount} className="bl-plan__amount" />
            <span className="bl-plan__per">/ month</span>
          </div>
        </div>
        <KeyValue
          className="bl-plan__kv"
          columns={3}
          items={[
            {
              label: status.kind === "cancelling" ? "Access ends" : status.kind === "paused" ? "Resumes" : "Renews",
              value: status.kind === "cancelling" ? longDate(status.endsOn) : status.kind === "paused" ? longDate(status.resumesOn) : longDate(subscription.currentPeriodEnd),
            },
            {
              label: "Payment method",
              value: (
                <span className="bl-pm-inline">
                  <BrandTag brand={pm.brand} />
                  {cardLabel(pm)}
                </span>
              ),
            },
            { label: "Billing email", value: <span className="rp-truncate">{subscription.email}</span> },
          ]}
        />
        {status.kind !== "active" && (
          <div className="bl-plan__notice">
            <Callout tone="med" title={status.kind === "paused" ? `Pause starts ${longDate(subscription.currentPeriodEnd)}` : `Cancellation scheduled for ${longDate(status.endsOn)}`}>
              {status.kind === "paused"
                ? `Labs stay open until then. Billing resumes ${longDate(status.resumesOn)} at ${money(subscription.amount)}. Progress and reports are kept throughout.`
                : "Labs stay open until then and nothing more is charged. Progress, notes, proofs and reports are kept."}
            </Callout>
          </div>
        )}
      </div>
    </Card>
  );
}

function UsageCard() {
  const over = usage.usedHours > usage.allowanceHours;
  const days = Math.max(1, (Date.now() - new Date(usage.periodStart).getTime()) / 86400000);
  const perDay = usage.usedHours / days;
  const left = usage.allowanceHours - usage.usedHours;
  const runOut = perDay > 0 ? new Date(Date.now() + (left / perDay) * 86400000) : null;
  const beforeReset = runOut && runOut.getTime() < new Date(usage.resetsOn).getTime();
  return (
    <Card
      title="Usage this period"
      meta={`${dayMonth(usage.periodStart)} to ${dayMonth(subscription.currentPeriodEnd)}`}
      actions={
        <Link to="/labs" className="bl-more">
          Sessions
          <Icon name="arrow-right" size={13} />
        </Link>
      }
    >
      <div className="bl-usage">
        <UsageMeter usedHours={usage.usedHours} allowanceHours={usage.allowanceHours} resetsOn={usage.resetsOn} label="Active lab hours" />
        <div className="bl-usage__row">
          <div className="bl-usage__label">
            <span className="rp-strong">Daily average</span>
          </div>
          <span className="bl-usage__fig">
            <span className="rp-mono rp-num rp-strong">{perDay.toFixed(1)}</span> h
          </span>
        </div>
        <div className="bl-usage__row">
          <div className="bl-usage__label">
            <span className="rp-strong">At this rate</span>
          </div>
          <span className="bl-usage__fig">
            {!runOut ? "No usage yet" : beforeReset ? `Runs out around ${dayMonth(runOut.toISOString())}` : "Lasts to the reset"}
          </span>
        </div>
        <div className="bl-usage__row">
          <div className="bl-usage__label">
            <span className="rp-strong">Onyx</span>
            <span>Included, not metered</span>
          </div>
          <span className="bl-usage__fig">
            <span className="rp-mono rp-num rp-strong">{usagePeriod.onyxMessages}</span> messages
          </span>
        </div>
        <div className="bl-usage__policy">
          <Icon name="info" size={14} />
          <p>
            Hours count only while a session is running. Sessions shut down after {IDLE_SHUTDOWN_MIN} minutes without input. {over ? `You are past ${LAB_HOURS} hours: ` : `Going past ${LAB_HOURS} hours `}
            costs nothing extra and never stops a running session. New launches may wait for capacity at busy times until the allowance resets on {dayMonth(usage.resetsOn)}.
          </p>
        </div>
      </div>
    </Card>
  );
}

function PaymentMethods() {
  const toast = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>(initialMethods);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<PaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);

  function makeDefault(m: PaymentMethod) {
    setMethods((ms) => ms.map((x) => ({ ...x, isDefault: x.id === m.id })));
    toast.push({ title: `${cardLabel(m)} is now the default`, detail: "Renewals and retries use this card.", tone: "primary" });
  }

  return (
    <Card
      className="bl-pmcard"
      title="Payment methods"
      actions={
        <Button size="sm" iconLeft="plus" onClick={() => setAdding(true)}>
          Add card
        </Button>
      }
      padding="none"
    >
      <ul className="bl-pms" aria-label="Saved cards">
        {methods.map((m) => (
          <li key={m.id} className="bl-pm">
            <span className="bl-pm__brand" aria-hidden="true">
              <BrandTag brand={m.brand} />
            </span>
            <div className="bl-pm__main">
              <span className="bl-pm__name">
                {cardLabel(m)}
                {m.isDefault && <Badge>Default</Badge>}
              </span>
              <span className="bl-pm__meta">
                Expires <span className="rp-mono rp-num">{cardExpiry(m)}</span>
              </span>
            </div>
            <div className="bl-pm__actions">
              {!m.isDefault && (
                <button type="button" className="rp-link rp-small" onClick={() => makeDefault(m)}>
                  Make default<span className="rp-sr">: {cardLabel(m)}</span>
                </button>
              )}
              <IconButton
                icon="trash"
                size="sm"
                label={m.isDefault && methods.length > 1 ? `Make another card default before removing ${cardLabel(m)}` : `Remove ${cardLabel(m)}`}
                disabled={m.isDefault}
                onClick={() => setRemoving(m)}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="bl-pms__foot">The default card pays renewals. Cards are stored by Stripe.</p>
      <CardModal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add card"
        submitLabel="Save card"
        primary={false}
        defaultName={currentUser.name}
        showMakeDefault
        onSaved={(c) => {
          const pm: PaymentMethod = { id: `pm_${c.last4}${methods.length}`, brand: c.brand, last4: c.last4, expMonth: c.expMonth, expYear: c.expYear, name: c.name, isDefault: c.makeDefault };
          setMethods((ms) => [...ms.map((x) => (c.makeDefault ? { ...x, isDefault: false } : x)), pm]);
          setAdding(false);
          toast.push({ title: `${cardLabel(pm)} added`, detail: c.makeDefault ? "It is now your default card." : undefined, tone: "primary" });
        }}
      />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        destructive
        loading={busy}
        title={`Remove ${removing ? cardLabel(removing) : "card"}?`}
        confirmLabel="Remove card"
        onConfirm={() => {
          const m = removing;
          if (!m) return;
          setBusy(true);
          window.setTimeout(() => {
            setBusy(false);
            setMethods((ms) => ms.filter((x) => x.id !== m.id));
            setRemoving(null);
            toast.push({ title: `${cardLabel(m)} removed` });
          }, 600);
        }}
      >
        <p>It will no longer be used for renewals or retries. Past invoices paid with it are not affected.</p>
      </ConfirmDialog>
    </Card>
  );
}

function AddressForm() {
  const toast = useToast();
  const [saved, setSaved] = useState<BillingAddress>(billingAddress);
  const [form, setForm] = useState<BillingAddress>(billingAddress);
  const [errors, setErrors] = useState<Partial<Record<keyof BillingAddress, string>>>({});
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  const country = countryByCode(form.country);
  const taxLabel = country?.tax ? `${country.tax.label} number` : "Tax ID";
  const set = (k: keyof BillingAddress) => (e: { target: { value: string } }) => {
    setForm({ ...form, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = "Enter a name or company.";
    if (!form.line1.trim()) errs.line1 = "Enter a street address.";
    if (!form.city.trim()) errs.city = "Enter a city.";
    if (country?.postal && !form.postalCode.trim()) errs.postalCode = "Enter a postal code.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setSaved(form);
      toast.push({ title: "Billing details saved", detail: "Shown on your next invoice.", tone: "primary" });
    }, 700);
  }

  return (
    <Card title="Billing address and tax ID" padding="none">
      <form className="bl-address" onSubmit={submit} noValidate>
        <div className="bl-address__grid">
          <Input label="Name or company" name="billing-name" autoComplete="billing name" value={form.name} onChange={set("name")} error={errors.name} />
          <CountryField value={form.country} onChange={(c) => setForm({ ...form, country: c ?? "" })} />
          <Input label="Address" name="billing-address-line1" autoComplete="billing address-line1" value={form.line1} onChange={set("line1")} error={errors.line1} />
          <Input label="Apartment, suite, unit" optional name="billing-address-line2" autoComplete="billing address-line2" value={form.line2} onChange={set("line2")} />
          <Input label="City" name="billing-city" autoComplete="billing address-level2" value={form.city} onChange={set("city")} error={errors.city} />
          <div className="bl-address__pair">
            <Input label={form.country === "US" ? "State" : "Region"} name="billing-region" autoComplete="billing address-level1" value={form.region} onChange={set("region")} />
            <Input label={form.country === "US" ? "ZIP code" : "Postal code"} name="billing-postal-code" autoComplete="billing postal-code" value={form.postalCode} onChange={set("postalCode")} error={errors.postalCode} />
          </div>
          <Input label={taxLabel} optional mono name="tax-id" autoComplete="off" spellCheck={false} value={form.taxId} onChange={set("taxId")} hint="Added to every invoice from the next one." />
        </div>
        <div className="bl-address__foot">
          <span className="bl-address__state" aria-live="polite">
            {dirty ? "Unsaved changes" : ""}
          </span>
          {dirty && (
            <Button
              variant="quiet"
              onClick={() => {
                setForm(saved);
                setErrors({});
              }}
            >
              Discard
            </Button>
          )}
          <Button type="submit" variant="secondary" loading={saving} disabled={!dirty}>
            Save billing details
          </Button>
        </div>
      </form>
    </Card>
  );
}

function InvoicesCard({ autoFocusReceipt, empty }: { autoFocusReceipt: string | null; empty?: boolean }) {
  const toast = useToast();
  if (empty) {
    return (
      <Card title="Invoices" id="invoices">
        <EmptyState compact icon="receipt" title="No invoices yet">
          Your first invoice is issued on {longDate(subscription.currentPeriodEnd)}, when the first payment is taken.
        </EmptyState>
      </Card>
    );
  }
  function download(i: Invoice) {
    toast.push({ title: `Downloading ${i.number}.pdf`, detail: `${money(i.amount)}, ${longDate(i.date)}`, tone: "primary" });
  }
  return (
    <Card title="Invoices" meta={`${invoices.length} invoices`} padding="none" id="invoices" className="bl-clip bl-invoices">
      {autoFocusReceipt && (
        <div className="bl-receipt">
          <Callout
            tone="info"
            icon="receipt"
            title={`Receipt ${autoFocusReceipt}`}
            action={
              <Button size="sm" iconLeft="download" onClick={() => toast.push({ title: `Downloading ${autoFocusReceipt}.pdf`, tone: "primary" })}>
                Download
              </Button>
            }
          >
            Your latest payment. It appears in the table below once the period closes.
          </Callout>
        </div>
      )}
      <InvoiceTable invoices={invoices} onDownload={download} caption="Invoices, most recent first" />
    </Card>
  );
}

function BillingSkeleton() {
  return (
    <LoadingRegion label="Loading billing">
      <div className="bl-billing" aria-hidden="true">
        <div className="rp-card bl-skelcard">
          <Skeleton width={120} height={14} />
          <div className="bl-skelrow">
            <Skeleton width={180} height={22} />
            <Skeleton width={110} height={28} />
          </div>
          <div className="bl-skelrow">
            <Skeleton width="28%" height={30} />
            <Skeleton width="28%" height={30} />
            <Skeleton width="28%" height={30} />
          </div>
        </div>
        <div className="bl-billing__split">
          <div className="rp-card bl-skelcard">
            <Skeleton width={140} height={14} />
            <Skeleton height={8} style={{ marginTop: 8 }} />
            <SkeletonText lines={3} />
          </div>
          <div className="rp-card bl-skelcard">
            <Skeleton width={140} height={14} />
            <Skeleton height={44} radius="md" />
            <Skeleton height={44} radius="md" />
          </div>
        </div>
        <div className="rp-card bl-skelcard">
          <Skeleton width={90} height={14} />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} height={12} width={`${92 - i * 4}%`} />
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

function Lapsed() {
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const pm = initialMethods.find((m) => m.isDefault)!;
  return (
    <>
      <Card padding="lg" className="bl-lapsed">
        <PlanRequired
          title={`Your Practitioner subscription ended on ${longDate(lapsed.endedOn)}. Everything is where you left it.`}
          plan="Practitioner"
          includes={[`${LAB_HOURS} active lab hours a month, fair use`, "Every AD set, standalone and exam simulation", "Onyx at every help level", "Report exports in PDF and Markdown"]}
          action={
            <div className="bl-lapsed__act">
              <Button
                variant="primary"
                size="lg"
                iconLeft="refresh"
                loading={busy}
                onClick={() => {
                  setBusy(true);
                  window.setTimeout(() => {
                    toast.push({ title: "Practitioner reactivated", detail: `${money(practitionerPlan.priceMonthly)} charged to ${cardLabel(pm)}. Labs are open.`, tone: "success" });
                    navigate("/billing", { replace: true });
                  }, 1000);
                }}
              >
                Reactivate for {money(practitionerPlan.priceMonthly, 0)} / month
              </Button>
              <span className="bl-lapsed__card">
                Charged to {cardLabel(pm)} today. <Link to="/pricing">Other plans</Link>
              </span>
            </div>
          }
        />
      </Card>
      <Card title="Still on your account">
        <dl className="bl-retained">
          <div>
            <dt>Path tier</dt>
            <dd className="rp-mono">{retained.tier}</dd>
          </div>
          <div>
            <dt>Scenarios completed</dt>
            <dd className="rp-mono rp-num">{retained.scenariosCompleted}</dd>
          </div>
          <div>
            <dt>Reports</dt>
            <dd className="rp-mono rp-num">{retained.reports}</dd>
          </div>
          <div>
            <dt>Debriefs</dt>
            <dd className="rp-mono rp-num">{retained.debriefs}</dd>
          </div>
        </dl>
        <p className="bl-retained__note">Notes, proofs and Onyx history are kept too. Reports, primers and drills stay open while the subscription is off.</p>
      </Card>
      <InvoicesCard autoFocusReceipt={null} />
    </>
  );
}

export default function BillingPage() {
  const state = useDataState();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<Status>({ kind: "active" });
  const [modal, setModal] = useState<"change" | "pause" | "cancel" | null>(null);
  const [retry, setRetry] = useState(0);
  const retrying = useLoadingDelay(retry > 0);
  const receipt = params.get("receipt");

  useEffect(() => {
    if (receipt) document.getElementById("invoices")?.scrollIntoView({ block: "start" });
  }, [receipt]);

  const header = <PageHeader title="Billing and plan" meta={state === "default" ? <span>Customer since {longDate(subscription.customerSince)}</span> : undefined} />;

  if (state === "loading" || retrying) {
    return (
      <Page>
        {header}
        <BillingSkeleton />
      </Page>
    );
  }

  if (state === "error") {
    return (
      <Page>
        {header}
        <Card>
          <ErrorState
            title="Billing details did not load"
            reference="req_c71d09"
            onRetry={() => {
              setRetry((n) => n + 1);
              const p = new URLSearchParams(params);
              window.setTimeout(() => {
                p.delete("state");
                setParams(p, { replace: true });
              }, 900);
            }}
          >
            We could not reach the billing service. Your subscription and labs are not affected.
          </ErrorState>
        </Card>
      </Page>
    );
  }

  if (state === "denied") {
    return (
      <Page>
        {header}
        <Lapsed />
      </Page>
    );
  }

  return (
    <Page>
      {header}
      <CurrentPlan
        status={status}
        onChange={() => setModal("change")}
        onPause={() => setModal("pause")}
        onCancel={() => setModal("cancel")}
        onResume={() => {
          setStatus({ kind: "active" });
          toast.push({ title: "Subscription active", detail: `Renews ${longDate(subscription.currentPeriodEnd)} at ${money(subscription.amount)}.`, tone: "primary" });
        }}
      />
      <div className="bl-billing__split">
        <UsageCard />
        <PaymentMethods />
      </div>
      <InvoicesCard autoFocusReceipt={receipt} empty={state === "empty"} />
      <AddressForm />
      <ChangePlanModal
        open={modal === "change"}
        onClose={() => setModal(null)}
        onDone={(t) => {
          setModal(null);
          const p = previewChange(t);
          const name = planById(t.planId)!.name;
          toast.push(
            p.kind === "downgrade"
              ? { title: `Switch to ${name} scheduled`, detail: `Takes effect ${longDate(p.effectiveOn)}. Nothing changes before then.`, tone: "primary" }
              : { title: `Switched to ${name}`, detail: `${money(p.dueToday)} charged to ${cardLabel(initialMethods[0])}.`, tone: "success" },
          );
        }}
      />
      <PauseModal
        open={modal === "pause"}
        renewsOn={subscription.currentPeriodEnd}
        onClose={() => setModal(null)}
        onDone={(resumesOn, months) => {
          setModal(null);
          setStatus({ kind: "paused", resumesOn });
          toast.push({ title: `Pause scheduled for ${months} month${months === 1 ? "" : "s"}`, detail: `From ${longDate(subscription.currentPeriodEnd)}. Billing resumes ${longDate(resumesOn)}.`, tone: "primary" });
        }}
      />
      <CancelModal
        open={modal === "cancel"}
        endsOn={subscription.currentPeriodEnd}
        onClose={() => setModal(null)}
        onPauseInstead={() => setModal("pause")}
        onAcceptOffer={() => {
          setModal(null);
          toast.push({
            title: `${retentionOffer.percentOff}% off applied`,
            detail: `Your next ${retentionOffer.months} renewals are ${money(round2(subscription.amount * (1 - retentionOffer.percentOff / 100)))}.`,
            tone: "primary",
          });
        }}
        onCancelled={() => setStatus({ kind: "cancelling", endsOn: subscription.currentPeriodEnd })}
      />
    </Page>
  );
}
