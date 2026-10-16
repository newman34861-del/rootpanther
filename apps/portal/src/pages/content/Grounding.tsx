import { Card, EmptyState, Icon, LoadingRegion, Skeleton } from "@rootpanther/ui";
import { PHASES, groundingScore } from "../../mock/content";
import type { ContentScenario, GroundingCell } from "../../mock/content";

function Cell({ c, phase, name }: { c: GroundingCell; phase: string; name: string }) {
  if (!c.applicable) {
    return (
      <td className="cn-gcell is-na">
        <span aria-hidden="true">n/a</span>
        <span className="rp-sr">
          {phase} does not apply to {name}
        </span>
      </td>
    );
  }
  const complete = c.opener && c.hints > 0;
  return (
    <td className={`cn-gcell${complete ? "" : " is-gap"}`}>
      <span className="cn-gcell__in">
        <span className={`cn-gmark${c.opener ? " is-ok" : " is-miss"}`}>
          <Icon name={c.opener ? "check" : "x"} size={12} strokeWidth={2.25} />
          <span>Opener</span>
          <span className="rp-sr">{c.opener ? " present" : " missing"}</span>
        </span>
        <span className={`cn-gmark${c.hints > 0 ? " is-ok" : " is-miss"}`}>
          <Icon name={c.hints > 0 ? "check" : "x"} size={12} strokeWidth={2.25} />
          <span>
            {c.hints > 0 ? (
              <>
                <span className="rp-mono rp-num">{c.hints}</span> hints
              </>
            ) : (
              "No ladder"
            )}
          </span>
        </span>
      </span>
    </td>
  );
}

export function Grounding({ rows, loading, empty }: { rows: ContentScenario[]; loading: boolean; empty: boolean }) {
  const totals = rows.reduce(
    (a, s) => {
      const g = groundingScore(s);
      return { done: a.done + g.done, total: a.total + g.total };
    },
    { done: 0, total: 0 },
  );
  const gaps = rows.filter((s) => {
    const g = groundingScore(s);
    return g.done < g.total;
  });

  return (
    <Card
      title="Onyx grounding"
      id="grounding"
      padding="none"
      meta={
        !loading && !empty ? (
          <span>
            <span className="rp-mono rp-num">{Math.round((totals.done / totals.total) * 100)}%</span> complete, <span className="rp-mono rp-num">{gaps.length}</span> scenarios with
            gaps
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <LoadingRegion label="Loading grounding coverage">
          <div className="cn-gskel">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} height={36} />
            ))}
          </div>
        </LoadingRegion>
      ) : empty ? (
        <EmptyState icon="chat" title="No authoring metadata found" compact>
          Openers and hint ladders are read from each scenario's <span className="rp-mono">onyx/</span> folder.
        </EmptyState>
      ) : (
        <div className="cn-gwrap" role="region" aria-label="Onyx grounding by scenario and phase" tabIndex={0}>
          <table className="cn-gtable">
            <caption className="rp-sr">Onyx grounding completeness by scenario and attack phase: opener present, and number of hints in the ladder</caption>
            <thead>
              <tr>
                <th scope="col">Scenario</th>
                {PHASES.map((p) => (
                  <th key={p.id} scope="col">
                    {p.label}
                  </th>
                ))}
                <th scope="col" className="is-right">
                  Complete
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const g = groundingScore(s);
                return (
                  <tr key={s.id}>
                    <th scope="row">
                      <span className="rp-strong">{s.name}</span>
                    </th>
                    {PHASES.map((p) => (
                      <Cell key={p.id} c={s.grounding[p.id]} phase={p.label} name={s.name} />
                    ))}
                    <td className={`cn-gscore rp-mono rp-num${g.done < g.total ? " is-gap" : ""}`}>
                      {g.done}/{g.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
