import { useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  HelpDial,
  Icon,
  LoadingRegion,
  Meter,
  Page,
  PageHeader,
  PlanRequired,
  ProgressBar,
  Skeleton,
  SkeletonText,
  StatusDot,
  TECHNIQUE_LABEL,
  TIER_NAMES,
  TierDot,
  cx,
  formatDate,
  formatDuration,
  formatRelative,
  helpLabel,
  tierColor,
  useMediaQuery,
  useToast,
} from "@rootpanther/ui";
import type { Column, HelpLevel, Scenario } from "@rootpanther/ui";
import { currentUser } from "../../mock/account";
import { scenarios } from "../../mock/scenarios";
import { advancement, declaredTier, examReadiness, nextTier, skillGroups, tierLadder } from "../../mock/path";
import type { Criterion, TierStep } from "../../mock/path";
import { useDataState, useReview } from "../../review/review";
import "./path.css";

const DAY = 86400000;

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY));
}

function TierLadder({ steps }: { steps: TierStep[] }) {
  return (
    <ol className="pt-ladder" aria-label="Path tiers">
      {steps.map((st) => (
        <li key={st.tier} className={cx("pt-ladder__step", `is-${st.state}`)} style={{ "--tier": tierColor(st.tier) } as CSSProperties} aria-current={st.state === "current" ? "step" : undefined}>
          <span className="pt-ladder__mark" aria-hidden="true">
            {st.state === "verified" ? <Icon name="check" size={13} strokeWidth={2.5} /> : st.state === "locked" ? <Icon name="lock" size={12} /> : <span className="pt-ladder__dot" />}
          </span>
          <span className="pt-ladder__text">
            <span className="pt-ladder__name">
              <span className="rp-mono">{st.tier}</span> {TIER_NAMES[st.tier]}
            </span>
            <span className="pt-ladder__detail">
              {st.state === "verified" && st.at ? `Verified ${formatDate(st.at, { day: "numeric", month: "short" })}` : st.state === "current" ? "Current tier" : st.detail}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function TierHeader({ fresh }: { fresh: boolean }) {
  const days = daysSince(currentUser.tierSince);
  return (
    <Card padding="none" className="pt-tier" titleId="pt-tier-title">
      <div className="pt-tier__top">
        <div className="pt-tier__id">
          <span className="rp-eyebrow">Current tier</span>
          <h2 id="pt-tier-title" className="pt-tier__title" style={{ "--tier": tierColor(currentUser.tier) } as CSSProperties}>
            <span className="pt-tier__code rp-mono">{currentUser.tier}</span>
            {TIER_NAMES[currentUser.tier]}
          </h2>
          <p className="pt-tier__since">
            {fresh ? (
              "Declared at signup. Evidence starts with your first lab."
            ) : (
              <>
                <span className="rp-mono rp-num rp-strong">{days}</span> days at this tier, since {formatDate(currentUser.tierSince, { day: "numeric", month: "short", year: "numeric" })}
              </>
            )}
          </p>
        </div>
        <dl className="pt-tier__kv">
          <div>
            <dt>Declared</dt>
            <dd>
              <TierDot tier={declaredTier.tier} size="sm" />
            </dd>
            <dd className="pt-tier__sub">Set at signup, {formatDate(declaredTier.at, { day: "numeric", month: "short" })}</dd>
          </div>
          <div>
            <dt>Demonstrated</dt>
            <dd>{fresh ? <StatusDot tone="neutral" hollow label="No evidence yet" size="sm" /> : <TierDot tier={currentUser.tier} size="sm" />}</dd>
            <dd className="pt-tier__sub">{fresh ? "Recommendations use your declared tier" : "Matches declared. Recommendations use this tier."}</dd>
          </div>
        </dl>
      </div>
      <div className="pt-tier__ladder">
        <TierLadder
          steps={
            fresh
              ? tierLadder.map((s) =>
                  s.state === "verified" ? { ...s, state: "next" as const, detail: "Not verified" } : s.state === "next" ? { ...s, state: "locked" as const, detail: "After C2" } : s,
                )
              : tierLadder
          }
        />
      </div>
    </Card>
  );
}

function CriterionRow({ c }: { c: Criterion }) {
  return (
    <li className={cx("pt-crit", c.met && "is-met")}>
      <span className="pt-crit__mark" aria-hidden="true">
        {c.met ? <Icon name="check" size={13} strokeWidth={2.5} /> : null}
      </span>
      <div className="pt-crit__body">
        <span className="pt-crit__title">
          {c.title}
          <span className="rp-sr">{c.met ? ", met" : ", outstanding"}</span>
        </span>
        <span className="pt-crit__evidence">
          {c.progress && !c.met && (
            <span className="rp-mono rp-num pt-crit__count">
              {c.progress.done}/{c.progress.of}
            </span>
          )}
          {c.evidence}
          {c.met && c.metAt ? <span className="pt-crit__at">, met {formatDate(c.metAt, { day: "numeric", month: "short" })}</span> : null}
        </span>
      </div>
      <ul className="pt-crit__links" aria-label={`Ways to satisfy: ${c.title}`}>
        {c.links.map((l) => (
          <li key={l.href + l.label}>
            <Link to={l.href} className="pt-crit__link">
              <Icon name={l.kind === "drill" ? "target" : l.kind === "report" ? "document" : l.kind === "debrief" ? "chat" : "flask"} size={13} />
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

function Advancement({ criteria }: { criteria: Criterion[] }) {
  const met = criteria.filter((c) => c.met).length;
  const outstanding = criteria.filter((c) => !c.met);
  const done = criteria.filter((c) => c.met);
  return (
    <Card
      className="pt-adv"
      title={
        <span className="pt-adv__title">
          Advancement to <TierDot tier={nextTier} size="sm" />
        </span>
      }
      actions={
        <span className="pt-adv__count">
          <span className="rp-mono rp-num rp-strong">
            {met}/{criteria.length}
          </span>
          <span className="pt-adv__bar" aria-hidden="true">
            {criteria.map((c, i) => (
              <span key={c.id} className={cx(i < met && "is-on")} />
            ))}
          </span>
          <span className="rp-sr">criteria met</span>
        </span>
      }
      padding="none"
    >
      {outstanding.length > 0 && (
        <div className="pt-adv__group">
          <h3 className="pt-adv__label">
            Outstanding <span className="rp-mono rp-num">{outstanding.length}</span>
          </h3>
          <ul className="pt-crits">
            {outstanding.map((c) => (
              <CriterionRow key={c.id} c={c} />
            ))}
          </ul>
        </div>
      )}
      {done.length > 0 && (
        <div className="pt-adv__group">
          <h3 className="pt-adv__label">
            Met <span className="rp-mono rp-num">{done.length}</span>
          </h3>
          <ul className="pt-crits">
            {done.map((c) => (
              <CriterionRow key={c.id} c={c} />
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function ExamReadiness({ empty }: { empty: boolean }) {
  const r = examReadiness;
  return (
    <Card title="Exam readiness" className="pt-exam" meta="Granite, full simulation">
      {empty ? (
        <div className="pt-exam__body">
          <p className="pt-exam__none">Readiness is estimated once you have completed one scenario. Until then there is nothing to measure against.</p>
          <ButtonLink to="/catalogue/granite" variant="primary" iconLeft="timer" block>
            Start exam simulation
          </ButtonLink>
        </div>
      ) : (
        <div className="pt-exam__body">
          <div className="pt-exam__score">
            <span className="pt-exam__value rp-mono rp-num">
              {r.score}
              <span className="pt-exam__pct">%</span>
            </span>
            <span className="pt-exam__vs">
              Recommended <span className="rp-mono rp-num rp-strong">{r.threshold}%</span> before a real attempt
            </span>
          </div>
          <div className="pt-exam__bar">
            <ProgressBar value={r.score} marker={r.threshold} label={`Estimated readiness ${r.score} percent, recommended ${r.threshold} percent`} />
            <div className="pt-exam__scale" aria-hidden="true">
              <span>0</span>
              <span className="pt-exam__mark" style={{ left: `${r.threshold}%` }}>
                {r.threshold}
              </span>
              <span>100</span>
            </div>
          </div>
          <dl className="pt-exam__parts">
            {r.components.map((c) => (
              <div key={c.id}>
                <dt>{c.label}</dt>
                <dd className="rp-mono rp-num">{c.value}%</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="pt-exam__gapshead">
              Gaps <span className="rp-mono rp-num">{r.gaps.length}</span>
            </h3>
            <ol className="pt-gaps">
              {r.gaps.map((g) => (
                <li key={g.id}>
                  <span className="pt-gaps__title">{g.title}</span>
                  <span className="pt-gaps__detail">{g.detail}</span>
                  <Link to={g.href} className="pt-gaps__link">
                    {g.action}
                    <Icon name="arrow-right" size={12} />
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          <div className="pt-exam__cta">
            <ButtonLink to="/catalogue/granite" variant="primary" iconLeft="timer" block>
              Start exam simulation
            </ButtonLink>
            <p className="pt-exam__fine">23h 45m, 6 hosts. Onyx is locked to Exam sim for the run.</p>
          </div>
        </div>
      )}
    </Card>
  );
}

function SkillMap({ empty }: { empty: boolean }) {
  const verified = skillGroups.flatMap((g) => g.rows).filter((r) => r.verified).length;
  return (
    <Card
      title="Skill map"
      meta={
        empty ? undefined : (
          <span>
            <span className="rp-mono rp-num">{verified}</span> of 11 verified
          </span>
        )
      }
      actions={
        empty ? undefined : (
          <span className="pt-legend" aria-hidden="true">
            <span className="pt-legend__item">
              <span className="pt-legend__sw" />
              Demonstrated
            </span>
            <span className="pt-legend__item">
              <span className="pt-legend__sw is-verified" />
              Verified by solve-test
            </span>
          </span>
        )
      }
      padding="none"
    >
      {empty ? (
        <EmptyState
          compact
          icon="activity"
          title="No technique practice recorded"
          action={
            <ButtonLink to="/catalogue" size="sm">
              Browse the catalogue
            </ButtonLink>
          }
        >
          Strength builds from the proofs you capture and the solve-tests you pass.
        </EmptyState>
      ) : (
        <div className="pt-skills">
          <div className="pt-skills__head" aria-hidden="true">
            <span>Family</span>
            <span>Strength</span>
            <span className="is-num">Scenarios</span>
            <span>Last practised</span>
            <span />
          </div>
          {skillGroups.map((g) => (
            <div key={g.id} className="pt-skills__group">
              <h3 id={`pt-skills-${g.id}`} className="pt-skills__glabel rp-eyebrow">
                {g.label}
              </h3>
              <ul aria-labelledby={`pt-skills-${g.id}`} className="pt-skills__list">
                {g.rows.map((r) => {
                  const label = TECHNIQUE_LABEL[r.id];
                  const filled = Math.round(r.strength * 5);
                  return (
                    <li key={r.id}>
                      <Link
                        to={`/catalogue?technique=${r.id}`}
                        className={cx("pt-skill", r.scenarios === 0 && "is-unpractised")}
                        aria-label={`${label}: strength ${filled} of 5${r.verified ? ", verified by solve-test" : ""}, used in ${r.scenarios} ${r.scenarios === 1 ? "scenario" : "scenarios"}, ${r.lastPractised ? `last practised ${formatRelative(r.lastPractised)}` : "never practised"}. Show scenarios.`}
                      >
                        <span className="pt-skill__name">
                          {label}
                          {r.verified && (
                            <span className="pt-skill__verified">
                              <Icon name="check" size={12} strokeWidth={2.5} />
                              Verified
                            </span>
                          )}
                        </span>
                        <span className="pt-skill__meter">
                          <span aria-hidden="true">
                            <Meter value={r.strength} verified={r.verified} label={`${label} strength`} />
                          </span>
                        </span>
                        <span className="pt-skill__count">
                          <span className="rp-mono rp-num">{r.scenarios}</span>
                          <span className="pt-skill__unit"> {r.scenarios === 1 ? "scenario" : "scenarios"}</span>
                        </span>
                        <span className="pt-skill__last">{r.lastPractised ? formatRelative(r.lastPractised) : "Never"}</span>
                        <Icon name="chevron-right" size={14} className="pt-skill__go" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function completedRows(): Scenario[] {
  return scenarios.filter((s) => s.status === "completed").sort((a, b) => (b.history?.lastAttempt ?? "").localeCompare(a.history?.lastAttempt ?? ""));
}

const COLUMNS: Column<Scenario>[] = [
  {
    id: "name",
    header: "Scenario",
    cell: (s) => <Link to={`/catalogue/${s.slug}`}>{s.name}</Link>,
    sortValue: (s) => s.name,
    minWidth: 120,
  },
  { id: "tier", header: "Tier", cell: (s) => <TierDot tier={s.tier} display="code" size="sm" />, sortValue: (s) => s.tier, width: 80 },
  {
    id: "date",
    header: "Completed",
    cell: (s) => (s.history?.lastAttempt ? formatDate(s.history.lastAttempt, { day: "numeric", month: "short", year: "numeric" }) : "Unknown"),
    sortValue: (s) => s.history?.lastAttempt ?? "",
    width: 130,
  },
  {
    id: "time",
    header: "Time taken",
    cell: (s) => (s.history?.bestMinutes ? formatDuration(s.history.bestMinutes) : "Unknown"),
    sortValue: (s) => s.history?.bestMinutes ?? 0,
    mono: true,
    width: 120,
    align: "right",
  },
  {
    id: "proofs",
    header: "Proofs",
    cell: (s) => (s.history ? `${s.history.proofsCaptured} of ${s.history.proofsTotal}` : "Unknown"),
    mono: true,
    width: 100,
    align: "right",
  },
  {
    id: "debrief",
    header: "Debrief",
    cell: (s) =>
      s.history?.debriefId ? (
        <Link to={`/reports/debriefs/${s.history.debriefId}`} className="pt-tlink">
          Read debrief
        </Link>
      ) : (
        "None"
      ),
    width: 130,
  },
];

function Completed({ empty, loading }: { empty: boolean; loading: boolean }) {
  const rows = empty ? [] : completedRows();
  return (
    <section className="pt-completed" aria-labelledby="pt-completed-title">
      <div className="pt-sechead">
        <h2 id="pt-completed-title">Completed scenarios</h2>
        {!loading && !empty && (
          <span className="pt-sechead__meta">
            <span className="rp-mono rp-num">{rows.length}</span> of {scenarios.length}
          </span>
        )}
      </div>
      <DataTable
        caption="Completed scenarios"
        columns={COLUMNS}
        rows={rows}
        rowKey={(s) => s.id}
        defaultSort={{ id: "date", dir: "desc" }}
        loading={loading}
        columnControls={false}
        density="compact"
        empty={
          <EmptyState
            compact
            icon="flag"
            title="No completed scenarios yet"
            action={
              <ButtonLink to="/catalogue?tier=C2&status=not-started" size="sm">
                Browse C2 scenarios
              </ButtonLink>
            }
          >
            A scenario counts as complete when every required proof is captured.
          </EmptyState>
        }
      />
    </section>
  );
}

function GuidePreference() {
  const [level, setLevel] = useState<HelpLevel>(currentUser.helpDefault);
  const narrow = useMediaQuery("(max-width: 767px)");
  const toast = useToast();
  return (
    <Card title="Guide preference" meta="Default Onyx help level for new labs">
      <div className="pt-guide">
        <HelpDial
          value={level}
          onChange={(l) => {
            setLevel(l);
            toast.push({ title: `Default help level set to ${helpLabel(l)}`, detail: "Applies to labs you launch from now on.", tone: "primary" });
          }}
          label="Default Onyx help level"
          compact={narrow}
        />
        <ul className="pt-guide__notes">
          <li>
            <Icon name="sliders" size={14} />
            Override it for a single lab in the launch dialog.
          </li>
          <li>
            <Icon name="history" size={14} />
            Changes made during a lab are recorded and shown in its debrief.
          </li>
          <li>
            <Icon name="lock" size={14} />
            Exam simulations always run at Exam sim.
          </li>
        </ul>
      </div>
    </Card>
  );
}

function PathSkeleton() {
  return (
    <LoadingRegion label="Loading your Path">
      <div className="pt-stack pt-stack--loading">
        <div className="rp-card pt-skel">
          <Skeleton width={90} height={10} />
          <Skeleton width={220} height={26} style={{ marginTop: 12 }} />
          <Skeleton width={260} height={11} style={{ marginTop: 12 }} />
          <div className="pt-skel__ladder">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={40} radius="md" />
            ))}
          </div>
        </div>
        <div className="pt-row">
          <div className="rp-card pt-skel">
            <Skeleton width={160} height={12} />
            <div className="pt-skel__rows">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="pt-skel__row">
                  <Skeleton width={20} height={20} radius="md" />
                  <SkeletonText lines={2} widths={[`${50 + ((i * 11) % 30)}%`, "40%"]} />
                </div>
              ))}
            </div>
          </div>
          <div className="rp-card pt-skel">
            <Skeleton width={120} height={12} />
            <Skeleton width={90} height={32} style={{ marginTop: 20 }} />
            <Skeleton height={6} style={{ marginTop: 16 }} />
            <div style={{ marginTop: 20 }}>
              <SkeletonText lines={4} />
            </div>
            <Skeleton height={36} radius="md" style={{ marginTop: 20 }} />
          </div>
        </div>
        <div className="rp-card pt-skel">
          <Skeleton width={100} height={12} />
          <div className="pt-skel__rows">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="pt-skel__row">
                <Skeleton width={140} height={10} />
                <Skeleton width={180} height={8} />
                <Skeleton width={40} height={10} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

export default function PathPage() {
  const state = useDataState();
  const navigate = useNavigate();
  const { flags } = useReview();
  const fresh = flags.user === "new" || state === "empty";
  const criteria = fresh
    ? advancement.map((c) => ({
        ...c,
        met: false,
        metAt: undefined,
        evidence: c.progress ? "Not started" : "No evidence yet",
        progress: c.progress ? { ...c.progress, done: 0 } : undefined,
        links: c.startLinks,
      }))
    : advancement;
  const met = criteria.filter((c) => c.met).length;

  const header = (
    <PageHeader
      title="My Path"
      meta={
        state === "loading" || state === "error" || state === "denied" ? undefined : (
          <>
            <TierDot tier={currentUser.tier} size="sm" />
            <span>
              <span className="rp-mono rp-num rp-strong">
                {met}/{criteria.length}
              </span>{" "}
              to {nextTier} {TIER_NAMES[nextTier]}
            </span>
            {!fresh && (
              <span>
                <span className="rp-mono rp-num rp-strong">{completedRows().length}</span> scenarios completed
              </span>
            )}
          </>
        )
      }
    />
  );

  if (state === "error") {
    return (
      <Page>
        {header}
        <Card>
          <ErrorState title="Your Path did not load" onRetry={() => navigate("/path", { replace: true })} reference="req_93ad4e">
            We could not reach the progress service. Completed scenarios, proofs and reports are safe on your account.
          </ErrorState>
        </Card>
      </Page>
    );
  }

  if (state === "denied") {
    return (
      <Page>
        {header}
        <Card padding="lg">
          <PlanRequired
            title="My Path needs an active plan. Your history is kept."
            plan="Practitioner"
            includes={[
              "Tier advancement with criteria linked to scenarios",
              "Skill map across all 11 technique families",
              "Exam readiness estimate and timed exam simulations",
              "Debriefs for every completed session",
            ]}
            action={
              <ButtonLink to="/billing" variant="primary" iconLeft="refresh">
                Reactivate for $49 / month
              </ButtonLink>
            }
          />
        </Card>
      </Page>
    );
  }

  if (state === "loading") {
    return (
      <Page>
        {header}
        <PathSkeleton />
      </Page>
    );
  }

  return (
    <Page>
      {header}
      <TierHeader fresh={fresh} />
      <div className="pt-row">
        <Advancement criteria={criteria} />
        <ExamReadiness empty={fresh} />
      </div>
      <SkillMap empty={fresh} />
      <Completed empty={fresh} loading={false} />
      <GuidePreference />
    </Page>
  );
}
