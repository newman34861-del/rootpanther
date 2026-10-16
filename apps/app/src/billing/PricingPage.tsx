import { useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ButtonLink, Disclosure, ErrorState, Icon, Page, PageHeader, PlanCard, SegmentedControl, Skeleton, LoadingRegion, cx } from "@rootpanther/ui";
import { IDLE_SHUTDOWN_MIN, LAB_HOURS, SESSION_MAX_HOURS, TRIAL_DAYS, annualSaving, plans, practitionerPlan, teamPlan } from "../mock/billing";
import type { Interval, PlanId } from "../mock/billing";
import { useDataState } from "../review/review";
import { Money, PublicFooter, PublicTopBar, SkipLink } from "./parts";
import "./billing.css";

type Cell = boolean | string;

interface CompareRow {
  label: string;
  values: [Cell, Cell, Cell];
}

const COLUMNS: { id: PlanId; name: string }[] = [
  { id: "free", name: "Free" },
  { id: "practitioner", name: "Practitioner" },
  { id: "team", name: "Team" },
];

const COMPARE: { title: string; rows: CompareRow[] }[] = [
  {
    title: "Labs",
    rows: [
      { label: "Active lab hours a month", values: [false, `${LAB_HOURS}, fair use`, `${LAB_HOURS} per seat, fair use`] },
      { label: "AD sets", values: [false, true, true] },
      { label: "Standalone machines", values: [false, true, true] },
      { label: "Timed exam simulations", values: [false, true, true] },
      { label: "In-browser Kali", values: [false, true, true] },
      { label: "Your own Kali over OpenVPN", values: [false, true, true] },
    ],
  },
  {
    title: "Onyx",
    rows: [
      { label: "Mentor mode outside labs", values: ["10 messages a day", "Not metered", "Not metered"] },
      { label: "In-lab trainer, all six help levels", values: [false, true, true] },
      { label: "Debrief after every lab", values: [false, true, true] },
    ],
  },
  {
    title: "Study and reporting",
    rows: [
      { label: "Concept primers", values: ["C1 only", "C1 to C4", "C1 to C4"] },
      { label: "Drills and methodology playbooks", values: [true, true, true] },
      { label: "Report builder, PDF and Markdown export", values: [false, true, true] },
    ],
  },
  {
    title: "Account",
    rows: [
      { label: "Free trial", values: [false, `${TRIAL_DAYS} days`, false] },
      { label: "Seat assignment and team progress", values: [false, false, true] },
      { label: "One invoice for all seats", values: [false, false, true] },
      { label: "Progress kept if you stop paying", values: [true, true, true] },
    ],
  },
];

function CompareValue({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <span className="bl-cmp__yes">
        <Icon name="check" size={15} />
        <span className="rp-sr">Included</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="bl-cmp__no">
        <Icon name="x" size={14} />
        <span className="rp-sr">Not included</span>
      </span>
    );
  }
  return <span className="bl-cmp__text">{value}</span>;
}

function headerPrice(id: PlanId, interval: Interval): ReactNode {
  const plan = plans.find((p) => p.id === id)!;
  if (plan.priceMonthly === 0) return <Money value={0} digits={0} />;
  const monthly = interval === "year" ? plan.priceAnnualMonthly ?? plan.priceMonthly : plan.priceMonthly;
  return (
    <>
      <Money value={monthly} digits={Number.isInteger(monthly) ? 0 : 2} />
      <span className="bl-cmp__per">{id === "team" ? " / seat / month" : " / month"}</span>
    </>
  );
}

function Comparison({ interval }: { interval: Interval }) {
  const [focus, setFocus] = useState<PlanId>("practitioner");
  return (
    <section className="bl-cmp" aria-labelledby="bl-cmp-title" data-focus={focus}>
      <div className="bl-cmp__head">
        <h2 id="bl-cmp-title">Compare plans</h2>
        <SegmentedControl
          className="bl-cmp__pick"
          size="sm"
          label="Plan to compare"
          value={focus}
          onChange={setFocus}
          options={COLUMNS.map((c) => ({ value: c.id, label: c.name }))}
        />
      </div>
      <div className="bl-cmp__wrap">
        <table className="bl-cmp__table">
          <caption className="rp-sr">What each plan includes, billed {interval === "year" ? "annually" : "monthly"}</caption>
          <thead>
            <tr>
              <td className="bl-cmp__corner" />
              {COLUMNS.map((c) => (
                <th key={c.id} scope="col" data-col={c.id} className={cx(c.id === "practitioner" && "is-recommended")}>
                  <span className="bl-cmp__plan">{c.name}</span>
                  <span className="bl-cmp__price">{headerPrice(c.id, interval)}</span>
                </th>
              ))}
            </tr>
          </thead>
          {COMPARE.map((g) => (
            <tbody key={g.title}>
              <tr className="bl-cmp__group">
                <th scope="colgroup" colSpan={4}>
                  {g.title}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {r.values.map((v, i) => (
                    <td key={COLUMNS[i].id} data-col={COLUMNS[i].id}>
                      <CompareValue value={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="bl-faq" aria-labelledby="bl-faq-title">
      <h2 id="bl-faq-title">Questions</h2>
      <div className="bl-faq__list">
        <Disclosure title="What happens when a lab session ends?">
          <p>
            The session&apos;s machines are destroyed: every target and the hosted attack box, along with anything stored on them. Your notes, captured proofs, reports, debriefs and
            Onyx history are saved to your account and kept.
          </p>
          <p>
            A session ends when you end it, after {IDLE_SHUTDOWN_MIN} minutes without input, or when it reaches its maximum length of {SESSION_MAX_HOURS} hours. Copy anything you need
            off a target before then.
          </p>
        </Disclosure>
        <Disclosure title="Is my progress kept if my subscription lapses?">
          <p>
            Yes. Your Path tier, completed scenarios, notes, proofs, reports and debriefs stay on your account. Only launching labs stops. Reactivate and everything is where you left it.
          </p>
        </Disclosure>
        <Disclosure title={`What does ${LAB_HOURS} active lab hours a month mean?`}>
          <p>
            Hours count only while a lab session is running, from the moment its machines are ready until the session ends. Reading primers, running drills, writing reports and using
            Onyx outside a lab do not count.
          </p>
          <p>
            Sessions shut down after {IDLE_SHUTDOWN_MIN} minutes without input, so a lab left open does not drain the allowance. The allowance resets on your billing date and unused
            hours do not carry over.
          </p>
          <p>
            If you go past {LAB_HOURS} hours there is no extra charge and a running session is never stopped. New launches may wait for capacity at busy times until the allowance
            resets.
          </p>
        </Disclosure>
        <Disclosure title={`How does the ${TRIAL_DAYS}-day trial work?`}>
          <p>
            The trial includes everything in Practitioner. You add a card at checkout and nothing is charged until day {TRIAL_DAYS + 1}. Cancel before then and you pay nothing.
          </p>
        </Disclosure>
        <Disclosure title="Can I pause or cancel?">
          <p>
            Both, from Billing. A pause stops billing for 1 to 3 months. A cancellation takes effect at the end of the period you paid for. In both cases your progress and reports are
            kept.
          </p>
        </Disclosure>
        <Disclosure title="How do Team seats work?">
          <p>
            Team starts at {teamPlan.minSeats} seats. Each seat gets everything in Practitioner, including its own {LAB_HOURS} lab hours a month. An admin assigns seats by email and can
            reassign a seat when someone leaves. Their progress stays with them.
          </p>
        </Disclosure>
      </div>
    </section>
  );
}

function PlansSkeleton() {
  return (
    <LoadingRegion label="Loading plans">
      <div className="bl-plans" aria-hidden="true">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rp-plan bl-plan-skel">
            <Skeleton width={110} height={14} />
            <Skeleton width="80%" height={10} style={{ marginTop: 14 }} />
            <Skeleton width={120} height={32} style={{ marginTop: 22 }} />
            <Skeleton height={36} radius="md" style={{ marginTop: 22 }} />
            <Skeleton width="70%" height={10} style={{ marginTop: 26 }} />
            <Skeleton width="85%" height={10} style={{ marginTop: 14 }} />
            <Skeleton width="60%" height={10} style={{ marginTop: 14 }} />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export default function PricingPage() {
  const state = useDataState();
  const [params, setParams] = useSearchParams();
  const interval: Interval = params.get("interval") === "year" ? "year" : "month";
  const saving = annualSaving(practitionerPlan);

  function setInterval(next: Interval) {
    const p = new URLSearchParams(params);
    if (next === "month") p.delete("interval");
    else p.set("interval", next);
    setParams(p, { replace: true });
  }

  const actions: Record<string, ReactNode> = {
    free: (
      <ButtonLink to="/signup" variant="secondary">
        {plans[0].ctaLabel}
      </ButtonLink>
    ),
    practitioner: (
      <ButtonLink to={`/checkout?plan=practitioner&interval=${interval}&mode=hosted&trial=1`} variant="primary">
        {practitionerPlan.ctaLabel}
      </ButtonLink>
    ),
    team: (
      <ButtonLink to={`/checkout?plan=team&interval=${interval}&mode=hosted&seats=${teamPlan.minSeats}`} variant="secondary">
        {teamPlan.ctaLabel}
      </ButtonLink>
    ),
  };

  let body: ReactNode;
  if (state === "loading") {
    body = <PlansSkeleton />;
  } else if (state === "error") {
    body = (
      <div className="bl-panel">
        <ErrorState title="Prices did not load" onRetry={() => window.location.reload()} reference="req_3b91e0">
          We could not reach the billing service. Nothing on your account has changed.
        </ErrorState>
      </div>
    );
  } else {
    body = (
      <>
        <div className="bl-plans">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} interval={interval} action={actions[p.id]} perSeat={p.id === "team"} className={cx(`bl-plan--${p.id}`, interval === "year" && "is-annual")} />
          ))}
        </div>
        <p className="bl-fine">
          Prices in US dollars. Tax is added at checkout where it applies. Team needs at least {teamPlan.minSeats} seats.
        </p>
        <Comparison interval={interval} />
        <Faq />
      </>
    );
  }

  return (
    <div className="bl-public">
      <SkipLink />
      <PublicTopBar>
        <ButtonLink to="/signin" variant="quiet" size="sm">
          Sign in
        </ButtonLink>
        <ButtonLink to="/signup" variant="secondary" size="sm">
          Create account
        </ButtonLink>
      </PublicTopBar>
      <main id="main" tabIndex={-1} className="bl-main">
        <Page className="bl-pricing">
          <PageHeader
            title="Pricing"
            meta={
              <span>
                {TRIAL_DAYS}-day trial on Practitioner. {LAB_HOURS} active lab hours a month, fair use.
              </span>
            }
            actions={
              <div className="bl-interval">
                <span className="bl-interval__note">
                  Annual saves <Money value={saving} digits={0} /> a year, 2 months free
                </span>
                <SegmentedControl
                  label="Billing interval"
                  value={interval}
                  onChange={setInterval}
                  options={[
                    { value: "month", label: "Monthly" },
                    { value: "year", label: "Annual" },
                  ]}
                />
              </div>
            }
          />
          {body}
        </Page>
      </main>
      <PublicFooter />
    </div>
  );
}
