import { Link } from "react-router-dom";
import {
  Badge,
  ButtonLink,
  Card,
  ErrorState,
  EmptyState,
  Icon,
  KpiTile,
  LoadingRegion,
  Page,
  PageHeader,
  PlanRequired,
  SCENARIO_TYPE_LABEL,
  Section,
  SessionTimer,
  Skeleton,
  SkeletonText,
  TargetChip,
  TIER_NAMES,
  TierDot,
  Timeline,
  formatDate,
  formatDuration,
  formatNumber,
  useCountdown,
} from "@rootpanther/ui";
import type { Scenario } from "@rootpanther/ui";
import { activeSession, currentUser, onyxLatest, recentActivity, scenariosCompleted, streakDays, usage } from "../../mock/account";
import { scenarioById, scenarios } from "../../mock/scenarios";
import { useDataState, useReview } from "../../review/review";
import "./home.css";

const NEXT_UP: { id: string; reason: string }[] = [
  { id: "tamarack", reason: "Service exploitation on a Windows host" },
  { id: "granite", reason: "Your first timed exam simulation" },
  { id: "obsidian", reason: "A harder full exam simulation" },
];

function ContinueCard() {
  const remaining = useCountdown((activeSession.maxLifeMin - activeSession.elapsedMin) * 60 - 16);
  const owned = activeSession.hosts.filter((h) => h.owned).length;
  return (
    <Card padding="none" className="hm-hero" titleId="hm-continue">
      <div className="hm-hero__main">
        <div className="hm-hero__eyebrow">
          <span className="rp-eyebrow">Continue</span>
          <span className="hm-hero__live">
            <span className="hm-hero__livedot" aria-hidden="true" />
            Running
          </span>
        </div>
        <h2 id="hm-continue" className="hm-hero__title">
          {activeSession.scenarioName}
        </h2>
        <div className="hm-hero__meta">
          <span className="rp-mono">{activeSession.domain}</span>
          <span className="hm-hero__sep" aria-hidden="true" />
          <span className="hm-hero__objective">
            <Icon name="target" size={14} />
            {activeSession.objective}
          </span>
        </div>
        <div className="hm-hero__progress">
          <div className="hm-hero__plabel">
            <span>Hosts owned</span>
            <span className="rp-mono rp-num rp-strong">
              {owned} / {activeSession.hosts.length}
            </span>
          </div>
          <div className="hm-hero__hosts" role="list" aria-label="Hosts">
            {activeSession.hosts.map((h) => (
              <span role="listitem" key={h.id}>
                <TargetChip host={h} />
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="hm-hero__side">
        <SessionTimer seconds={remaining} size="lg" label="Session ends in" />
        <div className="hm-hero__actions">
          <ButtonLink to={`/lab/${activeSession.id}`} variant="primary" size="lg" iconLeft="play">
            Resume
          </ButtonLink>
          <ButtonLink to={`/catalogue/${activeSession.scenarioId}#brief`} variant="secondary" size="lg">
            View brief
          </ButtonLink>
        </div>
        <p className="hm-hero__fine">Idle shutdown after {activeSession.idleLimitMin} minutes without input.</p>
      </div>
    </Card>
  );
}

function StartNextCard({ scenario }: { scenario: Scenario }) {
  return (
    <Card padding="none" className="hm-hero" titleId="hm-start">
      <div className="hm-hero__main">
        <div className="hm-hero__eyebrow">
          <span className="rp-eyebrow">Start your next lab</span>
        </div>
        <h2 id="hm-start" className="hm-hero__title">
          {scenario.name}
        </h2>
        <div className="hm-hero__meta">
          <Badge>{SCENARIO_TYPE_LABEL[scenario.type]}</Badge>
          <TierDot tier={scenario.tier} size="sm" />
          <span className="hm-hero__sep" aria-hidden="true" />
          <span className="hm-hero__objective">
            <Icon name="target" size={14} />
            {scenario.objective}
          </span>
        </div>
        <p className="hm-hero__why">
          <Icon name="route" size={14} />
          Recommended for {currentUser.tier} {TIER_NAMES[currentUser.tier]}: the next step on your path.
        </p>
      </div>
      <div className="hm-hero__side">
        <div className="hm-hero__facts">
          <span>
            <span className="rp-mono rp-num rp-strong">{scenario.hostCount}</span> hosts
          </span>
          <span>
            <span className="rp-mono rp-num rp-strong">~{formatDuration(scenario.estMinutes)}</span>
          </span>
        </div>
        <div className="hm-hero__actions">
          <ButtonLink to={`/catalogue/${scenario.slug}`} variant="primary" size="lg" iconLeft="play">
            Launch {scenario.name}
          </ButtonLink>
          <ButtonLink to={`/catalogue/${scenario.slug}#brief`} variant="secondary" size="lg">
            View brief
          </ButtonLink>
        </div>
      </div>
    </Card>
  );
}

function OnboardingCard() {
  const steps = [
    { label: "Declare your Path", detail: "Pick a starting tier. You can change it later." },
    { label: "Choose how to connect", detail: "In-browser terminal or your own Kali over OpenVPN." },
    { label: "Pick your first lab", detail: "Two or three scenarios matched to your tier." },
  ];
  return (
    <Card padding="none" className="hm-hero hm-onboard" titleId="hm-onboard">
      <div className="hm-hero__main">
        <div className="hm-hero__eyebrow">
          <span className="rp-eyebrow">Set up</span>
          <span className="rp-small">3 steps, about 2 minutes</span>
        </div>
        <h2 id="hm-onboard" className="hm-hero__title">
          Set up your first lab
        </h2>
        <ol className="hm-onboard__steps">
          {steps.map((s, i) => (
            <li key={s.label}>
              <span className="hm-onboard__num rp-mono">{i + 1}</span>
              <span>
                <span className="rp-strong">{s.label}</span>
                <span className="hm-onboard__detail">{s.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="hm-hero__side">
        <div className="hm-hero__actions">
          <ButtonLink to="/onboarding" variant="primary" size="lg" iconRight="arrow-right">
            Start setup
          </ButtonLink>
          <ButtonLink to="/catalogue" variant="quiet" size="lg">
            Skip, browse the catalogue
          </ButtonLink>
        </div>
      </div>
    </Card>
  );
}

function HeroSkeleton() {
  return (
    <div className="hm-hero is-skeleton rp-card" aria-hidden="true">
      <div className="hm-hero__main">
        <Skeleton width={90} height={10} />
        <Skeleton width={200} height={24} style={{ marginTop: 14 }} />
        <Skeleton width={260} height={12} style={{ marginTop: 12 }} />
        <div className="hm-hero__hosts" style={{ marginTop: 22 }}>
          <Skeleton width={110} height={28} radius="md" />
          <Skeleton width={110} height={28} radius="md" />
          <Skeleton width={110} height={28} radius="md" />
        </div>
      </div>
      <div className="hm-hero__side">
        <Skeleton width={180} height={22} />
        <div className="hm-hero__actions">
          <Skeleton width={120} height={42} radius="md" />
          <Skeleton width={120} height={42} radius="md" />
        </div>
      </div>
    </div>
  );
}

function NextUp({ loading }: { loading: boolean }) {
  return (
    <Section title="Next up" actions={<Link to="/catalogue" className="hm-more">Browse catalogue<Icon name="arrow-right" size={13} /></Link>}>
      <div className="hm-next">
        {loading
          ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height={78} radius="lg" />)
          : NEXT_UP.map(({ id, reason }) => {
              const s = scenarioById(id)!;
              return (
                <Link key={id} to={`/catalogue/${s.slug}`} className="hm-chip">
                  <span className="hm-chip__top">
                    <span className="hm-chip__name">{s.name}</span>
                    <Badge>{SCENARIO_TYPE_LABEL[s.type]}</Badge>
                  </span>
                  <span className="hm-chip__meta">
                    <TierDot tier={s.tier} display="code" size="sm" />
                    <span className="hm-chip__reason">{reason}</span>
                  </span>
                  <Icon name="chevron-right" size={15} className="hm-chip__go" />
                </Link>
              );
            })}
      </div>
    </Section>
  );
}

function StatusRow({ loading, fresh }: { loading: boolean; fresh: boolean }) {
  return (
    <section aria-label="Status" className="hm-status">
      <KpiTile loading={loading} href="/path" label="Current tier" value={currentUser.tier} unit={TIER_NAMES[currentUser.tier]} secondary={fresh ? "Declared at signup" : `Since ${formatDate(currentUser.tierSince, { day: "numeric", month: "short" })}`} />
      <KpiTile loading={loading} href="/catalogue?status=completed" label="Scenarios completed" value={fresh ? "0" : String(scenariosCompleted)} unit={`of ${scenarios.length}`} secondary={fresh ? "None yet" : "1 this week"} />
      <KpiTile
        loading={loading}
        href="/labs"
        label="Lab hours this month"
        value={fresh ? "0.0" : formatNumber(usage.usedHours, 1)}
        unit={`/ ${usage.allowanceHours} h`}
        secondary={`Fair use. Resets ${formatDate(usage.resetsOn, { day: "numeric", month: "short" })}`}
      />
      <KpiTile loading={loading} href="/path" label="Current streak" value={fresh ? "0" : String(streakDays)} unit="days" secondary={fresh ? "Starts with your first lab" : "Best: 11 days"} />
    </section>
  );
}

function FromOnyx({ loading }: { loading: boolean }) {
  return (
    <Card
      className="hm-onyx"
      title={
        <span className="hm-onyx__title">
          <span className="hm-onyx__dot" aria-hidden="true" />
          From Onyx
        </span>
      }
    >
      {loading ? (
        <SkeletonText lines={3} />
      ) : (
        <div className="hm-onyx__body">
          <span className="rp-eyebrow">Latest debrief</span>
          <p className="hm-onyx__headline">{onyxLatest.headline}</p>
          <p className="hm-onyx__detail">{onyxLatest.detail}</p>
          <div className="hm-onyx__links">
            <Link to={onyxLatest.href} className="rp-link">
              Read debrief
            </Link>
            <Link to={onyxLatest.drillHref} className="rp-link">
              Start drill
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function HomePage() {
  const state = useDataState();
  const { flags } = useReview();
  const loading = state === "loading";
  const fresh = flags.user === "new";
  const recommended = scenarioById("tamarack")!;

  let hero = fresh ? <OnboardingCard /> : flags.lab === "active" ? <ContinueCard /> : <StartNextCard scenario={recommended} />;
  if (loading) hero = <HeroSkeleton />;
  if (state === "denied") {
    hero = (
      <Card padding="lg">
        <PlanRequired
          title="Your plan has lapsed. Progress, notes and reports are kept."
          plan="Practitioner"
          includes={["60 active lab hours a month, fair use", "Every AD set, standalone and exam simulation", "Onyx at every help level", "Report exports in PDF and Markdown"]}
          action={
            <ButtonLink to="/billing" variant="primary" iconLeft="refresh">
              Reactivate for $49 / month
            </ButtonLink>
          }
        />
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Page width="full">
        <PageHeader title="Home" />
        <Card>
          <ErrorState title="Your dashboard did not load" onRetry={() => window.location.reload()} reference="req_8f2c1a">
            We could not reach the progress service. Running labs are not affected.
          </ErrorState>
        </Card>
      </Page>
    );
  }

  const showEmptyActivity = fresh || state === "empty";

  return (
    <Page width="full">
      <PageHeader title="Home" />
      {hero}
      <NextUp loading={loading} />
      <StatusRow loading={loading} fresh={fresh} />
      <div className="hm-split">
        <Card title="Recent activity" actions={<Link to="/labs#history" className="hm-more">View all<Icon name="arrow-right" size={13} /></Link>}>
          {loading ? (
            <LoadingRegion label="Loading activity">
              <Timeline items={[]} label="Recent activity" loading />
            </LoadingRegion>
          ) : showEmptyActivity ? (
            <EmptyState compact icon="activity" title="No activity yet" action={<ButtonLink to="/catalogue" size="sm">Browse scenarios</ButtonLink>}>
              Labs you start, proofs you capture and reports you write appear here.
            </EmptyState>
          ) : (
            <Timeline
              label="Recent activity"
              items={recentActivity.slice(0, 5).map((a) => ({
                id: a.id,
                title: a.title,
                detail: a.detail,
                at: a.at,
                tone: a.tone,
                href: a.href,
                icon: a.kind === "proof" ? "flag" : a.kind === "lab-started" ? "play" : a.kind === "lab-ended" ? "stop" : a.kind === "report" ? "document" : a.kind === "debrief" ? "chat" : "route",
              }))}
            />
          )}
        </Card>
        <FromOnyx loading={loading} />
      </div>
    </Page>
  );
}
