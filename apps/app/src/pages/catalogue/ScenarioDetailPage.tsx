import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  LoadingRegion,
  Page,
  PageHeader,
  PlanRequired,
  ProgressStatusDot,
  SCENARIO_TYPE_LABEL,
  SecretField,
  Skeleton,
  SkeletonText,
  StatusDot,
  TechniqueTag,
  TierDot,
  TopologyDiagram,
  formatDate,
  formatDuration,
  formatRelative,
} from "@rootpanther/ui";
import type { Scenario } from "@rootpanther/ui";
import { activeSession } from "../../mock/account";
import { scenarioById } from "../../mock/scenarios";
import { useDataState, useReview } from "../../review/review";
import { LaunchModal } from "./LaunchModal";
import "./scenario.css";

/* Mirrors the column layout in TopologyDiagram so the SVG can be capped at its
   natural width instead of scaling a one-host diagram up to fill the card. */
function topologyWidth(s: Scenario): number {
  const depth = new Map<string, number>();
  const queue = s.hosts.filter((h) => h.exposure === "learner-facing").map((h) => h.id);
  queue.forEach((id) => depth.set(id, 1));
  while (queue.length) {
    const id = queue.shift()!;
    for (const l of s.links) {
      const next = l.from === id ? l.to : l.to === id ? l.from : null;
      if (next && !depth.has(next)) {
        depth.set(next, depth.get(id)! + 1);
        queue.push(next);
      }
    }
  }
  const maxCol = Math.max(1, ...s.hosts.map((h) => depth.get(h.id) ?? 2));
  return 32 + (maxCol + 1) * 176 + maxCol * 64;
}

const OS_LABEL: Record<Scenario["os"], string> = { windows: "Windows", linux: "Linux", mixed: "Windows and Linux" };
const DIFFICULTY_LABEL = ["", "Introductory", "Moderate", "Demanding", "Hard", "Expert"];

function Facts({ s }: { s: Scenario }) {
  const facing = s.hosts.filter((h) => h.exposure === "learner-facing").length;
  const rows: [string, ReactNode][] = [
    ["Type", <Badge key="t">{SCENARIO_TYPE_LABEL[s.type]}</Badge>],
    ["Path tier", <TierDot key="tier" tier={s.tier} size="sm" />],
    ["Objective", s.objective],
    ["Hosts", <span key="h"><span className="rp-mono rp-num">{s.hostCount}</span> total, <span className="rp-mono rp-num">{facing}</span> reachable</span>],
    ["Operating systems", OS_LABEL[s.os]],
    ["Estimated time", <span key="d" className="rp-mono rp-num">{formatDuration(s.estMinutes)}</span>],
    ["Difficulty", <span key="df"><span className="rp-mono rp-num">{s.difficulty}</span> of 5, {DIFFICULTY_LABEL[s.difficulty].toLowerCase()}</span>],
    ["Published", formatDate(s.publishedAt)],
  ];
  return (
    <Card title="Facts" padding="none">
      <dl className="sd-facts">
        {rows.map(([k, v]) => (
          <div key={k} className="sd-facts__row">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Prerequisites({ s }: { s: Scenario }) {
  return (
    <Card title="Prerequisites" meta={s.prerequisites.length ? `${s.prerequisites.length}` : undefined} padding="none">
      {s.prerequisites.length === 0 ? (
        <p className="sd-aside-empty">None. This scenario is a starting point.</p>
      ) : (
        <ul className="sd-prereq">
          {s.prerequisites.map((p) => {
            if (p.kind === "scenario") {
              const ps = scenarioById(p.ref);
              return (
                <li key={p.ref}>
                  <Link to={`/catalogue/${p.ref}`} className="sd-prereq__item">
                    <span className="sd-prereq__icon" aria-hidden="true">
                      <Icon name="flask" size={14} />
                    </span>
                    <span className="sd-prereq__body">
                      <span className="sd-prereq__name">{p.label}</span>
                      <span className="sd-prereq__kind">Scenario{ps ? `, ${ps.tier}` : ""}</span>
                    </span>
                    {ps && <ProgressStatusDot status={ps.status} size="sm" />}
                  </Link>
                </li>
              );
            }
            return (
              <li key={p.ref}>
                <Link to={`/onyx/primers?primer=${p.ref}`} className="sd-prereq__item">
                  <span className="sd-prereq__icon" aria-hidden="true">
                    <Icon name="book" size={14} />
                  </span>
                  <span className="sd-prereq__body">
                    <span className="sd-prereq__name">{p.label}</span>
                    <span className="sd-prereq__kind">Onyx primer</span>
                  </span>
                  <Icon name="chevron-right" size={14} className="sd-prereq__go" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function History({ s, labActive }: { s: Scenario; labActive: boolean }) {
  const h = s.history;
  if (!h || h.attempts === 0) {
    return (
      <Card title="Your history">
        <EmptyState compact icon="history" title="Not attempted yet">
          Attempts, best time and proofs captured appear here after your first session.
        </EmptyState>
      </Card>
    );
  }
  const running = labActive && s.id === activeSession.scenarioId;
  return (
    <Card
      title="Your history"
      padding="none"
      footer={
        h.debriefId ? (
          <Link to={`/reports/debriefs/${h.debriefId}`} className="sd-more">
            Read the latest debrief
            <Icon name="arrow-right" size={13} />
          </Link>
        ) : (
          <span className="sd-history__nodebrief">A debrief is written when a session ends.</span>
        )
      }
    >
      <dl className="sd-facts">
        <div className="sd-facts__row">
          <dt>Attempts</dt>
          <dd className="rp-mono rp-num">{h.attempts}</dd>
        </div>
        <div className="sd-facts__row">
          <dt>Best time</dt>
          <dd className={h.bestMinutes ? "rp-mono rp-num" : "sd-dim"}>{h.bestMinutes ? formatDuration(h.bestMinutes) : "Not finished"}</dd>
        </div>
        <div className="sd-facts__row">
          <dt>Proofs captured</dt>
          <dd>
            <span className="sd-proofs">
              <span className="rp-mono rp-num">
                {h.proofsCaptured} of {h.proofsTotal}
              </span>
              <span className="sd-proofs__bar" aria-hidden="true">
                {Array.from({ length: h.proofsTotal }, (_, i) => (
                  <span key={i} className={i < h.proofsCaptured ? (h.proofsCaptured === h.proofsTotal ? "is-done" : "is-on") : undefined} />
                ))}
              </span>
            </span>
          </dd>
        </div>
        <div className="sd-facts__row">
          <dt>Last attempt</dt>
          <dd>{running ? <StatusDot tone="primary" label="Running now" size="sm" /> : h.lastAttempt ? formatRelative(h.lastAttempt) : "Unknown"}</dd>
        </div>
      </dl>
    </Card>
  );
}

function Grounding({ s }: { s: Scenario }) {
  return (
    <Callout tone="info" icon="shield-check" title="Onyx is grounded to this scenario" className="sd-grounding">
      It knows the intended path and the hint ladder for each phase of {s.name}, and nothing outside it. It will not invent hosts, credentials or flags, and every hint it gives is logged in your debrief.
    </Callout>
  );
}

function AsideSkeleton() {
  return (
    <div className="sd-aside" aria-hidden="true">
      {[5, 3, 4].map((n, i) => (
        <div key={i} className="rp-card sd-skelcard">
          <Skeleton width={90} height={12} />
          <div className="sd-skelrows">
            {Array.from({ length: n }, (_, j) => (
              <div key={j} className="sd-skelrow">
                <Skeleton width={80} height={10} />
                <Skeleton width={`${30 + ((j * 13) % 30)}%`} height={10} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MainSkeleton() {
  return (
    <div className="sd-main" aria-hidden="true">
      <div className="rp-card sd-skelcard">
        <Skeleton width={110} height={12} />
        <div style={{ marginTop: 18 }}>
          <SkeletonText lines={4} widths={["88%", "72%", "80%", "56%"]} />
        </div>
      </div>
      <div className="rp-card sd-skelcard">
        <Skeleton width={90} height={12} />
        <Skeleton height={180} radius="md" style={{ marginTop: 18 }} />
      </div>
      <div className="rp-card sd-skelcard">
        <Skeleton width={70} height={12} />
        <div style={{ marginTop: 18 }}>
          <SkeletonText lines={3} />
        </div>
      </div>
    </div>
  );
}

export default function ScenarioDetailPage() {
  const { slug = "" } = useParams();
  const state = useDataState();
  const { flags } = useReview();
  const { hash } = useLocation();
  const [params, setParams] = useSearchParams();
  const s = scenarioById(slug);
  const labActive = flags.lab === "active";
  const launchParam = params.get("launch");
  const [launchOpen, setLaunchOpen] = useState(launchParam === "1" || launchParam === "fail");
  const startFailed = launchParam === "fail";

  useEffect(() => {
    if (launchParam === "1" || launchParam === "fail") setLaunchOpen(true);
  }, [launchParam]);

  useEffect(() => {
    if (state !== "default" || !hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) window.setTimeout(() => el.scrollIntoView({ block: "start" }), 50);
  }, [hash, state, slug]);

  function closeLaunch() {
    setLaunchOpen(false);
    if (launchParam) {
      const next = new URLSearchParams(params);
      next.delete("launch");
      setParams(next, { replace: true });
    }
  }

  if (!s) {
    return (
      <Page>
        <PageHeader title="Scenario not found" crumbs={[{ label: "Catalogue", to: "/catalogue" }, { label: "Not found" }]} />
        <Card>
          <EmptyState
            icon="crosshair"
            title={
              <>
                No scenario called <span className="rp-mono">{slug}</span>
              </>
            }
            action={
              <ButtonLink to="/catalogue" variant="secondary" iconLeft="grid">
                Browse the catalogue
              </ButtonLink>
            }
          >
            The link may be out of date, or the scenario was retired.
          </EmptyState>
        </Card>
      </Page>
    );
  }

  const running = labActive && s.id === activeSession.scenarioId && s.status === "in-progress";
  const crumbs = [{ label: "Catalogue", to: "/catalogue" }, { label: s.name }];

  let cta: ReactNode;
  if (running) {
    cta = (
      <ButtonLink to={`/lab/${activeSession.id}`} variant="primary" size="lg" iconLeft="play">
        Resume
      </ButtonLink>
    );
  } else if (s.status === "completed") {
    cta = (
      <>
        <Button variant="secondary" size="lg" iconLeft="refresh" onClick={() => setLaunchOpen(true)}>
          Launch again
        </Button>
        <ButtonLink to={s.history?.debriefId ? `/reports/debriefs/${s.history.debriefId}` : "/reports"} variant="primary" size="lg" iconLeft="document">
          Review
        </ButtonLink>
      </>
    );
  } else {
    cta = (
      <Button variant="primary" size="lg" iconLeft="play" onClick={() => setLaunchOpen(true)}>
        Launch
      </Button>
    );
  }

  const header = (
    <PageHeader
      crumbs={crumbs}
      title={s.name}
      actions={state === "default" ? cta : undefined}
      meta={
        state === "loading" ? (
          <Skeleton width={360} height={12} />
        ) : (
          <>
            <Badge>{SCENARIO_TYPE_LABEL[s.type]}</Badge>
            <TierDot tier={s.tier} size="sm" />
            <span className="sd-meta">
              <Icon name="clock" size={14} />
              <span className="rp-mono rp-num">~{formatDuration(s.estMinutes)}</span>
            </span>
            <span className="sd-meta">
              <Icon name="server" size={14} />
              <span className="rp-mono rp-num">{s.hostCount}</span> {s.hostCount === 1 ? "host" : "hosts"}
            </span>
            {running ? <StatusDot tone="primary" label="Session running" size="sm" /> : <ProgressStatusDot status={s.status} size="sm" />}
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
          <ErrorState title={`${s.name} did not load`} onRetry={() => setParams(new URLSearchParams(), { replace: true })} reference="req_5be7a0">
            We could not reach the scenario service. Running labs and saved progress are not affected.
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
            title={`${s.name} needs an active plan`}
            plan="Practitioner"
            includes={[`${s.name} and every other scenario in the catalogue`, "60 lab hours a month, fair use", "Onyx grounded to each scenario, at every help level", "Debriefs and report exports in PDF and Markdown"]}
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
        <LoadingRegion label={`Loading ${s.name}`}>
          <div className="sd-layout sd-layout--loading">
            <MainSkeleton />
            <AsideSkeleton />
          </div>
        </LoadingRegion>
      </Page>
    );
  }

  const showState = s.status === "in-progress" && s.id === activeSession.scenarioId && labActive;
  const facing = s.hosts.filter((h) => h.exposure === "learner-facing");
  const internal = s.hosts.filter((h) => h.exposure === "internal");
  const forceEmptyHistory = state === "empty";

  return (
    <Page>
      {header}
      {running && (
        <Callout
          className="sd-running"
          tone="primary"
          icon="timer"
          title={`Session ${activeSession.id} is running`}
          action={
            <ButtonLink to="/labs" variant="secondary" size="sm">
              Manage session
            </ButtonLink>
          }
        >
          {activeSession.hosts.filter((h) => h.owned).length} of {activeSession.hosts.length} hosts owned. Host state below is live.
        </Callout>
      )}
      <div className="sd-layout">
        <div className="sd-main">
          <Card title="Overview">
            <p className="sd-summary">{s.summary}</p>
            <h3 className="sd-subhead">What it teaches</h3>
            <ul className="sd-teach">
              {s.teaches.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <h3 className="sd-subhead">Technique families</h3>
            <ul className="sd-techs" aria-label="Technique families">
              {s.techniques.map((t) => (
                <li key={t}>
                  <TechniqueTag technique={t} to={`/catalogue?technique=${t}`} />
                </li>
              ))}
            </ul>
          </Card>

          <Card
            title="Topology"
            meta={
              <span>
                <span className="rp-mono rp-num">{facing.length}</span> reachable, <span className="rp-mono rp-num">{internal.length}</span> internal
              </span>
            }
          >
            <div className="sd-topo" tabIndex={0} role="region" aria-label={`${s.name} topology`} style={{ ["--topo-w" as string]: `${topologyWidth(s)}px` }}>
              <TopologyDiagram hosts={showState ? activeSession.hosts : s.hosts} links={s.links} label={`${s.name} network: ${s.hosts.length} hosts`} showState={showState} />
            </div>
            <ul className="sd-hosts" aria-label="Hosts">
              {s.hosts.map((h) => (
                <li key={h.id} className="sd-host">
                  <span className="sd-host__name rp-mono">{h.name}</span>
                  <span className="sd-host__ip rp-mono rp-num">{h.ip}</span>
                  <span className="sd-host__role">{h.role}</span>
                  <span className="sd-host__exp">{h.exposure === "learner-facing" ? "Reachable" : "Pivot required"}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Brief" id="brief" className="sd-brief">
            <dl className="sd-brief__kv">
              <div>
                <dt>Domain</dt>
                <dd className="rp-mono">{s.domain}</dd>
              </div>
              <div>
                <dt>Objective</dt>
                <dd>{s.objective}</dd>
              </div>
              <div>
                <dt>Entry point</dt>
                <dd className="rp-mono">{facing.map((h) => h.ip).join(", ")}</dd>
              </div>
            </dl>

            {s.credential ? (
              <div className="sd-cred">
                <h3 className="sd-subhead">Assumed-breach credential</h3>
                <div className="sd-cred__fields">
                  <SecretField label="Username" value={s.credential.username} revealLabel="Show" />
                  <SecretField label="Password" value={s.credential.password} revealLabel="Show" />
                </div>
                <p className="sd-cred__note">Valid in {s.domain} only. Rotated for every session, so the value shown applies to your next launch.</p>
              </div>
            ) : (
              <div className="sd-cred">
                <h3 className="sd-subhead">Starting access</h3>
                <p className="sd-cred__note sd-cred__note--flush">No credential. You start from the network with only the target address.</p>
              </div>
            )}

            <h3 className="sd-subhead">Proof requirements</h3>
            <ol className="sd-proofreq">
              {s.proofRequirements.map((p) => (
                <li key={p}>
                  <Icon name="flag" size={14} />
                  <span>{p}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside className="sd-aside" aria-label="Scenario details">
          <Facts s={s} />
          <Prerequisites s={s} />
          {forceEmptyHistory ? (
            <Card title="Your history">
              <EmptyState compact icon="history" title="Not attempted yet">
                Attempts, best time and proofs captured appear here after your first session.
              </EmptyState>
            </Card>
          ) : (
            <History s={s} labActive={labActive} />
          )}
          <Grounding s={s} />
        </aside>
      </div>

      <LaunchModal open={launchOpen} onClose={closeLaunch} scenario={s} labActive={labActive} startFailed={startFailed} />
    </Page>
  );
}

