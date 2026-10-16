import { Fragment, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, ButtonLink, Callout, Card, CodeBlock, EmptyState, ErrorState, Icon, Skeleton, UiLink } from "@rootpanther/ui";
import { drills } from "../../mock/onyx";
import type { DrillSet } from "../../mock/onyx";
import type { DataState } from "../../review/review";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function withCode(text: string): ReactNode {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i} className="rp-mono">
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function DrillCard({ drill }: { drill: DrillSet }) {
  return (
    <UiLink to={`/onyx/drills?drill=${drill.id}`} className="ox-drill">
      <span className="ox-drill__topic">{drill.topic}</span>
      <span className="ox-drill__title">{drill.title}</span>
      <span className="ox-drill__foot rp-mono rp-num">
        <span>{drill.questions.length} questions</span>
        <span aria-hidden="true">·</span>
        <span>{drill.minutes} min</span>
        {drill.best !== undefined && (
          <span className="ox-drill__best">
            <Icon name="check" size={12} />
            Best {drill.best}/{drill.questions.length}
          </span>
        )}
      </span>
    </UiLink>
  );
}

function DrillRunner({ drill }: { drill: DrillSet }) {
  const [current, setCurrent] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const q = drill.questions[current];
  const answered = picked !== null;
  const finished = results.length === drill.questions.length;
  const score = results.filter(Boolean).length;
  const pass = score / drill.questions.length >= 0.7;

  function choose(i: number) {
    if (answered) return;
    setPicked(i);
    setResults((r) => [...r, i === q.answer]);
  }
  function next() {
    setPicked(null);
    setCurrent((c) => c + 1);
  }
  function retry() {
    setCurrent(0);
    setPicked(null);
    setResults([]);
  }

  if (finished) {
    return (
      <Card className="ox-runner" title={drill.title} actions={<ButtonLink to="/onyx/drills" variant="quiet" size="sm">All drills</ButtonLink>}>
        <div className="ox-score">
          <div className={pass ? "ox-score__num is-pass" : "ox-score__num"}>
            {score}/{drill.questions.length}
          </div>
          <p className="ox-score__line">
            {pass ? "A solid pass. Recognition like this saves time under the clock." : "Below the line. Read the primer, then run it again."}
          </p>
          <div className="ox-score__actions">
            <Button variant="primary" iconLeft="refresh" onClick={retry}>
              Retry
            </Button>
            {drill.primer && (
              <ButtonLink to={`/onyx/primers?primer=${drill.primer}`} variant="secondary">
                Open primer
              </ButtonLink>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="ox-runner" title={drill.title} actions={<ButtonLink to="/onyx/drills" variant="quiet" size="sm">Leave drill</ButtonLink>}>
      <div className="ox-run__head">
        <span className="ox-run__count rp-mono rp-num">
          Question {current + 1} of {drill.questions.length}
        </span>
        <span className="ox-run__count rp-mono rp-num">Score {score}</span>
      </div>
      <div className="ox-run__track" aria-hidden="true">
        {drill.questions.map((_, i) => {
          const cls = i < results.length ? (results[i] ? "is-ok" : "is-bad") : i === current ? "is-on" : "";
          return <span key={i} className={`ox-run__seg ${cls}`} />;
        })}
      </div>
      <p className="ox-run__q">{withCode(q.prompt)}</p>
      {q.code && <div className="ox-run__code"><CodeBlock code={q.code} tone="terminal" copyable={false} wrap /></div>}
      <div className="ox-run__opts" role="group" aria-label="Answer options">
        {q.options.map((opt, i) => {
          let cls = "ox-opt";
          if (q.monoOptions) cls += " is-mono";
          if (answered && i === q.answer) cls += " is-correct";
          else if (answered && i === picked) cls += " is-wrong";
          return (
            <button key={i} type="button" className={cls} onClick={() => choose(i)} disabled={answered} aria-pressed={picked === i}>
              <span className="ox-opt__mark">{answered && i === q.answer ? <Icon name="check" size={13} /> : answered && i === picked ? <Icon name="x" size={13} /> : LETTERS[i]}</span>
              <span className="ox-opt__text">{opt}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="ox-feedback">
          <div className={picked === q.answer ? "ox-feedback__verdict is-ok" : "ox-feedback__verdict is-bad"}>
            <Icon name={picked === q.answer ? "check-circle" : "x-circle"} size={16} />
            <span>{picked === q.answer ? "Correct. " : "Not this one. "}{withCode(q.explanation)}</span>
          </div>
          <div className="ox-feedback__actions">
            <Button variant="primary" iconRight="arrow-right" onClick={next}>
              {current === drill.questions.length - 1 ? "See score" : "Next question"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function OnyxDrills({ state }: { state: DataState }) {
  const [params] = useSearchParams();
  const openId = params.get("drill");
  const open = useMemo(() => drills.find((d) => d.id === openId), [openId]);

  if (openId && !open) {
    return (
      <Card>
        <EmptyState icon="checklist" title="Drill not found" action={<ButtonLink to="/onyx/drills" size="sm">Back to drills</ButtonLink>}>
          The drill <span className="rp-mono">{openId}</span> does not exist or has been renamed.
        </EmptyState>
      </Card>
    );
  }
  if (open) return <DrillRunner drill={open} />;

  if (state === "loading") {
    return (
      <div className="ox-cards">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="ox-drill" aria-hidden="true">
            <Skeleton width={80} height={11} />
            <Skeleton width="65%" height={16} style={{ marginTop: 4 }} />
            <Skeleton width={150} height={11} style={{ marginTop: 14 }} />
          </div>
        ))}
      </div>
    );
  }
  if (state === "error") {
    return (
      <Card>
        <ErrorState title="Drills did not load" onRetry={() => window.location.reload()} reference="req_dr4410">
          The drill service did not respond. You can still read primers and playbooks.
        </ErrorState>
      </Card>
    );
  }
  if (state === "empty") {
    return (
      <Card>
        <EmptyState icon="checklist" title="No drills yet">
          Drills are short scored sets that need no lab. New ones are added with each technique family.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="rp-stack" style={{ ["--gap" as string]: "16px" }}>
      <Callout icon="info">Drills run in your browser. They need no lab and use no lab hours.</Callout>
      <div className="ox-cards">
        {drills.map((d) => (
          <DrillCard key={d.id} drill={d} />
        ))}
      </div>
    </div>
  );
}
