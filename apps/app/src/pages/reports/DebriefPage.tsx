import { Link, useParams } from "react-router-dom";
import {
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  LoadingRegion,
  Page,
  PageHeader,
  PlanRequired,
  Skeleton,
  SkeletonText,
  formatDate,
  formatDuration,
  helpLabel,
} from "@rootpanther/ui";
import { debriefById } from "../../mock/reports";
import type { DebriefDetail } from "../../mock/reports";
import { useDataState } from "../../review/review";
import "./debrief.css";

function drillKind(label: string, href: string): { kind: string; rest: string } {
  const i = label.indexOf(": ");
  if (i < 0) return { kind: href.startsWith("/catalogue") ? "Scenario" : href.startsWith("/reports") ? "Report" : "Next", rest: label };
  const rest = label.slice(i + 2);
  return { kind: label.slice(0, i), rest: rest.charAt(0).toUpperCase() + rest.slice(1) };
}

function Headline({ d }: { d: DebriefDetail }) {
  return (
    <div className="db-headline">
      <div className="db-headline__meta">
        <span className="db-headline__role">ONYX</span>
        <span>Written when the session ended</span>
      </div>
      <p className="db-headline__text">{d.headline}</p>
    </div>
  );
}

function IntendedPath({ steps }: { steps: string[] }) {
  return (
    <Card title="Intended path" meta={`${steps.length} steps`}>
      <ol className="db-path">
        {steps.map((s, i) => (
          <li key={i}>
            <span className="db-path__n rp-mono rp-num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="db-path__text">{s}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function DidWell({ items }: { items: string[] }) {
  return (
    <Card title="What you did well">
      <ul className="db-list">
        {items.map((t) => (
          <li key={t} className="db-list__item">
            <Icon name="check" size={14} className="db-list__icon is-well" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Missed({ items }: { items: DebriefDetail["missedDetail"] }) {
  return (
    <Card title="What you missed" meta={`${items.length} ${items.length === 1 ? "gap" : "gaps"}`}>
      <ul className="db-list db-list--missed">
        {items.map((m) => (
          <li key={m.text} className="db-list__item">
            <Icon name="crosshair" size={14} className="db-list__icon is-miss" />
            <div className="db-miss">
              <p className="db-miss__text">{m.text}</p>
              <p className="db-miss__why">
                <span className="db-miss__label">Why it matters</span>
                {m.why}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DrillNext({ items }: { items: DebriefDetail["drillNext"] }) {
  return (
    <Card title="Drill next" padding="none">
      <ul className="db-drills">
        {items.map((d) => {
          const { kind, rest } = drillKind(d.label, d.href);
          return (
            <li key={d.href + d.label}>
              <Link to={d.href} className="db-drill">
                <span className="db-drill__kind">{kind}</span>
                <span className="db-drill__label">{rest}</span>
                <Icon name="arrow-right" size={14} className="db-drill__go" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function DebriefSkeleton() {
  return (
    <LoadingRegion label="Loading debrief">
      <div className="db-body" aria-hidden="true">
        <div className="db-headline">
          <Skeleton width={180} height={10} />
          <Skeleton width="92%" height={18} style={{ marginTop: 8 }} />
          <Skeleton width="60%" height={18} />
        </div>
        {[5, 3, 2].map((n, i) => (
          <div key={i} className="rp-card db-skcard">
            <div className="rp-card__head">
              <Skeleton width={140} height={12} />
            </div>
            <div className="db-skcard__body">
              <SkeletonText lines={n} />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export default function DebriefPage() {
  const { id = "" } = useParams();
  const state = useDataState();
  const d = debriefById(id);

  if (!d) {
    return (
      <Page width="narrow">
        <EmptyState
          icon="chat"
          title="No debrief with this ID"
          action={
            <ButtonLink to="/reports?tab=debriefs" variant="secondary" iconLeft="arrow-left">
              All debriefs
            </ButtonLink>
          }
        >
          <span className="rp-mono">{id}</span> was removed or never existed.
        </EmptyState>
      </Page>
    );
  }

  const crumbs = [
    { label: "Reports", to: "/reports" },
    { label: "Debriefs", to: "/reports?tab=debriefs" },
    { label: d.scenarioName },
  ];

  const loading = state === "loading";

  const meta = (
    <>
      <span>
        <time dateTime={d.date}>{formatDate(d.date, { day: "numeric", month: "short", year: "numeric" })}</time>
      </span>
      <span>
        <span className="rp-mono rp-num">{formatDuration(d.durationMin)}</span> session
      </span>
      <span className="db-help">
        Help: <span className="rp-strong">{d.helpChange ?? helpLabel(d.helpLevel)}</span>
      </span>
    </>
  );

  const actions = (
    <>
      <ButtonLink to="/onyx" variant={d.reportId ? "secondary" : "primary"} iconLeft="chat">
        Ask Onyx about this run
      </ButtonLink>
      {d.reportId && (
        <ButtonLink to={`/reports/${d.reportId}`} variant="primary" iconLeft="document">
          Open report
        </ButtonLink>
      )}
    </>
  );

  let body;
  if (state === "denied") {
    body = (
      <Card padding="lg">
        <PlanRequired
          title="Debriefs need an active plan. This run and its notes are kept."
          plan="Practitioner"
          includes={["A debrief after every lab", "Onyx at every help level", "Drills and playbooks matched to your gaps", "Report exports in PDF and Markdown"]}
          action={
            <ButtonLink to="/billing" variant="primary" iconLeft="refresh">
              Reactivate for $49 / month
            </ButtonLink>
          }
        />
      </Card>
    );
  } else if (state === "error") {
    body = (
      <Card>
        <ErrorState title="This debrief did not load" onRetry={() => window.location.reload()} reference="req_3d71be">
          The coaching service did not respond. The debrief is stored and will be here when it does.
        </ErrorState>
      </Card>
    );
  } else if (loading) {
    body = <DebriefSkeleton />;
  } else if (state === "empty") {
    body = (
      <Card>
        <EmptyState
          icon="clock"
          title="This debrief is still being written"
          action={
            <ButtonLink to="/labs" size="sm">
              View session
            </ButtonLink>
          }
        >
          Onyx writes the debrief from your session log. It is usually ready within two minutes of the lab ending.
        </EmptyState>
      </Card>
    );
  } else {
    body = (
      <div className="db-body">
        <Headline d={d} />
        <IntendedPath steps={d.intendedPath} />
        <div className="db-split">
          <DidWell items={d.didWell} />
          <Missed items={d.missedDetail} />
        </div>
        <DrillNext items={d.drillNext} />
      </div>
    );
  }

  return (
    <Page width="reading" className="db-page">
      <PageHeader crumbs={crumbs} title={`${d.scenarioName} debrief`} meta={meta} actions={state === "denied" ? undefined : actions} />
      {body}
    </Page>
  );
}
