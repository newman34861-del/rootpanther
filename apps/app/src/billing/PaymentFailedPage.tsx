import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, ButtonLink, Callout, Card, EmptyState, ErrorState, Icon, KeyValue, LoadingRegion, Page, PageHeader, Skeleton, SkeletonText, Timeline, formatTime, useToast } from "@rootpanther/ui";
import type { TimelineItem } from "@rootpanther/ui";
import { currentUser } from "../mock/account";
import { BILLING_EMAIL, cardLabel, dayMonth, failedPayment, longDate, paymentMethods, pausedPayment, subscription } from "../mock/billing";
import type { PaymentMethod } from "../mock/billing";
import { useDataState } from "../review/review";
import { BrandTag, CardModal, FactList, KEPT_ITEMS, Money, STOP_ITEMS, money } from "./parts";
import "./billing.css";

type Outcome = "failing" | "retrying" | "declined" | "fixed";

function weekdayDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function Skeletons() {
  return (
    <LoadingRegion label="Loading payment status">
      <div className="bl-billing" aria-hidden="true">
        <div className="rp-card bl-skelcard">
          <Skeleton width={260} height={18} />
          <SkeletonText lines={2} />
          <div className="bl-skelrow" style={{ justifyContent: "flex-start" }}>
            <Skeleton width={170} height={36} radius="md" />
            <Skeleton width={110} height={36} radius="md" />
          </div>
        </div>
        <div className="bl-pf__split">
          <div className="rp-card bl-skelcard">
            <Skeleton width={120} height={14} />
            <Timeline items={[]} label="Retry schedule" loading />
          </div>
          <div className="rp-card bl-skelcard">
            <Skeleton width={120} height={14} />
            <SkeletonText lines={4} />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

export default function PaymentFailedPage() {
  const state = useDataState();
  const toast = useToast();
  const [outcome, setOutcome] = useState<Outcome>("failing");
  const [fixing, setFixing] = useState(false);
  const [card, setCard] = useState<PaymentMethod>(paymentMethods.find((m) => m.id === failedPayment.paymentMethodId)!);
  const failedCard = paymentMethods.find((m) => m.id === failedPayment.paymentMethodId)!;
  const otherSaved = paymentMethods.filter((m) => m.id !== failedCard.id);
  const paused = state === "denied";

  const header = (
    <PageHeader
      title={state === "empty" ? "Payments" : "Payment failed"}
      crumbs={[{ label: "Billing and plan", to: "/billing" }, { label: state === "empty" ? "Payments" : "Payment failed" }]}
      meta={
        state === "empty" ? undefined : (
          <span>
            <span className="rp-mono">{failedPayment.invoiceNumber}</span>, <Money value={failedPayment.amount} />
          </span>
        )
      }
    />
  );

  if (state === "loading") {
    return (
      <Page>
        {header}
        <Skeletons />
      </Page>
    );
  }

  if (state === "error") {
    return (
      <Page>
        {header}
        <Card>
          <ErrorState title="Payment status did not load" onRetry={() => window.location.reload()} reference="req_5e02ab">
            We could not reach the billing service. Your access has not changed while this page is unavailable.
          </ErrorState>
        </Card>
      </Page>
    );
  }

  if (state === "empty") {
    return (
      <Page>
        {header}
        <Card>
          <EmptyState icon="check-circle" title="No failed payments" action={<ButtonLink to="/billing" variant="secondary">Go to billing</ButtonLink>}>
            Your last payment of {money(subscription.amount)} on {longDate(subscription.currentPeriodStart)} succeeded.
          </EmptyState>
        </Card>
      </Page>
    );
  }

  if (outcome === "fixed") {
    return (
      <Page>
        <PageHeader title="Payment complete" crumbs={[{ label: "Billing and plan", to: "/billing" }, { label: "Payment" }]} />
        <Card padding="lg">
          <div className="bl-pf__fixed" role="status">
            <span className="bl-result__icon is-success" aria-hidden="true">
              <Icon name="check-circle" size={20} />
            </span>
            <h2 className="bl-pf__fixedtitle">
              {money(failedPayment.amount)} paid with {cardLabel(card)}
            </h2>
            <p className="bl-pf__lead">
              {failedPayment.invoiceNumber} is settled and the remaining retries are cancelled. {paused ? "Lab launching is back on." : "Nothing about your access changed."} Your subscription renews on{" "}
              {longDate(subscription.currentPeriodEnd)}.
            </p>
            <div className="bl-result__actions">
              <ButtonLink to="/billing" variant="secondary">
                Back to billing
              </ButtonLink>
              <ButtonLink to="/labs" variant="quiet">
                Go to Labs
              </ButtonLink>
            </div>
          </div>
        </Card>
      </Page>
    );
  }

  const schedule: TimelineItem[] = paused
    ? [
        { id: "f", title: "Payment declined", detail: `${cardLabel(failedCard)}. Declined by the bank.`, at: pausedPayment.failedAt, atLabel: weekdayDate(pausedPayment.failedAt), tone: "crit", icon: "x" },
        ...pausedPayment.retries.map((r) => ({ id: r.id, title: r.label, detail: "Declined by the bank.", at: r.at, atLabel: weekdayDate(r.at), tone: "crit" as const, icon: "x" as const })),
        { id: "p", title: "Lab launching paused", detail: "Everything else on your account is unchanged.", at: pausedPayment.pausedOn, atLabel: weekdayDate(pausedPayment.pausedOn), tone: "med", icon: "pause" },
      ]
    : [
        {
          id: "f",
          title: "Payment declined",
          detail: `${cardLabel(failedCard)}. Declined by the bank at ${formatTime(failedPayment.failedAt)}.`,
          at: failedPayment.failedAt,
          atLabel: weekdayDate(failedPayment.failedAt),
          tone: "crit",
          icon: "x",
        },
        ...(outcome === "declined"
          ? [{ id: "now", title: "Manual retry declined", detail: "No charge was made.", at: new Date().toISOString(), atLabel: "Just now", tone: "crit" as const, icon: "x" as const }]
          : []),
        { id: failedPayment.retries[0].id, title: "Retry 2", detail: "Automatic, same card. No action needed if you have fixed the card.", at: failedPayment.retries[0].at, atLabel: weekdayDate(failedPayment.retries[0].at), icon: "refresh" },
        { id: failedPayment.retries[1].id, title: "Final retry", detail: "Automatic, same card.", at: failedPayment.retries[1].at, atLabel: weekdayDate(failedPayment.retries[1].at), icon: "refresh" },
        { id: "pause", title: "Lab launching pauses", detail: "Only if every retry fails. Nothing is deleted.", at: failedPayment.accessPausesOn, atLabel: weekdayDate(failedPayment.accessPausesOn), tone: "med", icon: "pause" },
      ];

  function retry() {
    setOutcome("retrying");
    window.setTimeout(() => {
      setOutcome("declined");
      toast.push({ title: "Retry declined. No charge was made.", detail: `${cardLabel(failedCard)} was declined again. Use another card or call your bank.`, tone: "crit" });
    }, 1300);
  }

  return (
    <Page>
      {header}
      <Card padding="none" className="bl-pf">
        <div className="bl-pf__main">
          <div className="bl-pf__what">
            <span className="bl-pf__icon" aria-hidden="true">
              <Icon name="card" size={18} />
            </span>
            <div>
              <h2 className="bl-pf__title">
                {paused ? `Lab launching paused on ${longDate(pausedPayment.pausedOn)}` : `Your bank declined the card ending ${failedCard.last4}`}
              </h2>
              <p className="bl-pf__lead">
                {paused ? (
                  <>
                    Every retry of <Money value={failedPayment.amount} /> on {cardLabel(failedCard)} was declined. Your account, progress and reports are untouched. Pay now and labs open again
                    straight away.
                  </>
                ) : (
                  <>
                    The renewal of <Money value={failedPayment.amount} /> for Practitioner, monthly was declined on {longDate(failedPayment.failedAt)}. The bank did not give a reason, which usually means
                    an expired card, a limit, or a fraud check. <span className="rp-strong">Your access continues until {longDate(failedPayment.accessPausesOn)}</span> while we retry.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="bl-pf__actions">
            <Button variant="primary" size="lg" iconLeft="card" onClick={() => setFixing(true)}>
              Fix payment method
            </Button>
            <Button variant="secondary" size="lg" iconLeft="refresh" onClick={retry} loading={outcome === "retrying"}>
              {outcome === "retrying" ? "Retrying" : "Retry now"}
            </Button>
          </div>
          {outcome === "declined" && (
            <Callout tone="crit" role="alert" title="Retry declined. No charge was made.">
              The bank declined {cardLabel(failedCard)} again. Use another card, or call the number on the back of your card and ask them to allow a {money(failedPayment.amount)} payment to Rootpanther.
            </Callout>
          )}
        </div>
        <KeyValue
          className="bl-pf__kv"
          columns={4}
          items={[
            { label: "Amount due", value: <Money value={failedPayment.amount} /> },
            { label: "Invoice", value: <span className="rp-mono">{failedPayment.invoiceNumber}</span> },
            {
              label: "Card",
              value: (
                <span className="bl-pm-inline">
                  <BrandTag brand={failedCard.brand} />
                  ending {failedCard.last4}
                </span>
              ),
            },
            { label: paused ? "Labs paused since" : "Access until", value: longDate(paused ? pausedPayment.pausedOn : failedPayment.accessPausesOn) },
          ]}
        />
      </Card>
      <div className="bl-pf__split">
        <Card title="Retry schedule" meta={paused ? "Retries finished" : `${failedPayment.retries.length} retries left`}>
          <Timeline label="Retry schedule" items={schedule} />
          {!paused && <p className="bl-pf__note">Retries run at about 09:00 your time. Fixing the card now settles the invoice immediately and cancels the remaining retries.</p>}
        </Card>
        <Card title={paused ? "While labs are paused" : `If labs pause on ${dayMonth(failedPayment.accessPausesOn)}`}>
          <div className="bl-pf__keep">
            <div>
              <h3 className="bl-minihead">Kept, nothing is deleted</h3>
              <FactList items={[...KEPT_ITEMS, { icon: "user", text: "Your account and sign-in" }]} />
            </div>
            <div>
              <h3 className="bl-minihead">Stops until you pay</h3>
              <FactList tone="stop" items={STOP_ITEMS} />
            </div>
          </div>
          <p className="bl-pf__note">
            Reports, primers and drills stay open. Questions about a charge: <a href={`mailto:${BILLING_EMAIL}`}>{BILLING_EMAIL}</a>. Or see all <Link to="/billing">billing details</Link>.
          </p>
        </Card>
      </div>
      <CardModal
        open={fixing}
        onClose={() => setFixing(false)}
        title="Fix payment method"
        submitLabel={`Pay ${money(failedPayment.amount)}`}
        defaultName={currentUser.name}
        saved={otherSaved}
        onSaved={(c) => {
          const next: PaymentMethod = { id: `pm_${c.last4}`, brand: c.brand, last4: c.last4, expMonth: c.expMonth, expYear: c.expYear, name: c.name, isDefault: true };
          setCard(next);
          setFixing(false);
          setOutcome("fixed");
          toast.push({ title: `Payment of ${money(failedPayment.amount)} succeeded`, detail: `${cardLabel(next)} is now your default card.`, tone: "success" });
        }}
      >
        <p className="bl-modalnote">
          We charge <Money value={failedPayment.amount} className="rp-strong" /> for {failedPayment.invoiceNumber} now and make this the default card for renewals.
        </p>
      </CardModal>
    </Page>
  );
}
