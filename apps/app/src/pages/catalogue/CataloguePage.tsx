import { useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Drawer,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  LoadingRegion,
  Page,
  PageHeader,
  PlanRequired,
  ScenarioRow,
  ScenarioRowSkeleton,
  Select,
  Skeleton,
  Tag,
  TierDot,
  cx,
  useMediaQuery,
} from "@rootpanther/ui";
import type { Scenario } from "@rootpanther/ui";
import { activeSession, currentUser } from "../../mock/account";
import { scenarios } from "../../mock/scenarios";
import { useDataState, useReview } from "../../review/review";
import { GROUPS, SORTS, matches, readSelection, readSort, sortScenarios } from "./filters";
import type { FilterGroup, GroupId, Selection, SortId } from "./filters";
import "./catalogue.css";

function cardAction(s: Scenario, labActive: boolean): string {
  if (s.status === "in-progress" && labActive && s.id === activeSession.scenarioId) return `/lab/${activeSession.id}`;
  if (s.status === "completed" && s.history?.debriefId) return `/reports/debriefs/${s.history.debriefId}`;
  if (s.status === "completed") return `/catalogue/${s.slug}`;
  return `/catalogue/${s.slug}?launch=1`;
}

function FilterGroupList({ group, selection, counts, onToggle, onClear }: { group: FilterGroup; selection: string[]; counts: Record<string, number>; onToggle: (v: string) => void; onClear: () => void }) {
  const legendId = useId();
  return (
    <fieldset className="ct-group" aria-labelledby={legendId}>
      <div className="ct-group__head">
        <legend id={legendId} className="ct-group__legend">
          {group.label}
        </legend>
        {selection.length > 0 && (
          <button type="button" className="rp-link ct-group__clear" onClick={onClear} aria-label={`Clear ${group.label} filter`}>
            Clear
          </button>
        )}
      </div>
      <div className="ct-group__opts">
        {group.options.map((o) => {
          const on = selection.includes(o.value);
          const n = counts[o.value] ?? 0;
          return (
            <div key={o.value} className={cx("ct-opt", on && "is-on")}>
              <Checkbox
                checked={on}
                disabled={!on && n === 0}
                onChange={() => onToggle(o.value)}
                label={o.tier ? <TierDot tier={o.tier} size="sm" /> : o.text}
                aria-describedby={`${legendId}-${o.value}`}
              />
              <span id={`${legendId}-${o.value}`} className="ct-opt__count rp-mono rp-num">
                <span className="rp-sr">, </span>
                {n}
                <span className="rp-sr"> scenarios</span>
              </span>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

function FilterPanel({ selection, counts, onToggle, onClearGroup }: { selection: Selection; counts: Record<GroupId, Record<string, number>>; onToggle: (g: GroupId, v: string) => void; onClearGroup: (g: GroupId) => void }) {
  return (
    <div className="ct-groups">
      {GROUPS.map((g) => (
        <FilterGroupList key={g.id} group={g} selection={selection[g.id]} counts={counts[g.id]} onToggle={(v) => onToggle(g.id, v)} onClear={() => onClearGroup(g.id)} />
      ))}
    </div>
  );
}

function FilterPanelSkeleton() {
  return (
    <div className="ct-groups" aria-hidden="true">
      {[3, 4, 6, 3].map((n, i) => (
        <div key={i} className="ct-group">
          <Skeleton width={84} height={10} />
          <div className="ct-group__opts" style={{ marginTop: 12 }}>
            {Array.from({ length: n }, (_, j) => (
              <div key={j} className="ct-opt">
                <Skeleton width={16} height={16} />
                <Skeleton width={`${48 + ((i * 3 + j * 7) % 5) * 8}%`} height={10} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CataloguePage() {
  const state = useDataState();
  const { flags } = useReview();
  const [params, setParams] = useSearchParams();
  const narrow = useMediaQuery("(max-width: 1023px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const labActive = flags.lab === "active";

  const selection = useMemo(() => readSelection(params), [params]);
  const sort = readSort(params);
  const qParam = params.get("q") ?? "";
  const [q, setQ] = useState(qParam);
  useEffect(() => setQ(qParam), [qParam]);

  useEffect(() => {
    if (!narrow) setDrawerOpen(false);
  }, [narrow]);

  const source = scenarios;
  const loading = state === "loading";
  const forceEmpty = state === "empty";

  const results = useMemo(
    () => (forceEmpty ? [] : sortScenarios(source.filter((s) => matches(s, selection, qParam)), sort, currentUser.tier)),
    [source, selection, qParam, sort, forceEmpty],
  );

  const counts = useMemo(() => {
    const out = {} as Record<GroupId, Record<string, number>>;
    for (const g of GROUPS) {
      const base = source.filter((s) => matches(s, selection, qParam, g.id));
      out[g.id] = Object.fromEntries(g.options.map((o) => [o.value, base.filter(o.match).length]));
    }
    return out;
  }, [source, selection, qParam]);

  function update(mut: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(params);
    mut(next);
    setParams(next, { replace: true });
  }

  function setGroup(g: GroupId, values: string[]) {
    update((p) => {
      const ordered = GROUPS.find((x) => x.id === g)!.options.map((o) => o.value).filter((v) => values.includes(v));
      if (ordered.length) p.set(g, ordered.join(","));
      else p.delete(g);
    });
  }

  function toggle(g: GroupId, v: string) {
    const cur = selection[g];
    setGroup(g, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  }

  function setQuery(v: string) {
    setQ(v);
    update((p) => {
      if (v.trim()) p.set("q", v);
      else p.delete("q");
    });
  }

  function setSort(v: SortId) {
    update((p) => {
      if (v === "recommended") p.delete("sort");
      else p.set("sort", v);
    });
  }

  function reset() {
    setQ("");
    update((p) => {
      GROUPS.forEach((g) => p.delete(g.id));
      p.delete("q");
    });
  }

  function retry() {
    update((p) => p.delete("state"));
  }

  const activeTags: { key: string; label: string; remove: () => void }[] = [];
  if (qParam.trim()) activeTags.push({ key: "q", label: `Search: ${qParam.trim()}`, remove: () => setQuery("") });
  for (const g of GROUPS) {
    for (const v of selection[g.id]) {
      const o = g.options.find((x) => x.value === v)!;
      activeTags.push({ key: `${g.id}:${v}`, label: `${g.tagLabel}: ${o.text}`, remove: () => toggle(g.id, v) });
    }
  }
  const filterCount = activeTags.filter((t) => t.key !== "q").length;

  const completed = scenarios.filter((s) => s.status === "completed").length;
  const inProgress = scenarios.filter((s) => s.status === "in-progress").length;
  const header = (
    <PageHeader
      title="Catalogue"
      meta={
        state === "loading" || state === "error" || state === "denied" ? undefined : (
          <>
            <span>
              <span className="rp-mono rp-num rp-strong">{scenarios.length}</span> scenarios
            </span>
            <span>
              <span className="rp-mono rp-num rp-strong">{completed}</span> completed
            </span>
            <span>
              <span className="rp-mono rp-num rp-strong">{inProgress}</span> in progress
            </span>
          </>
        )
      }
    />
  );

  if (state === "error") {
    return (
      <Page width="full" className="ct-page">
        {header}
        <Card>
          <ErrorState title="The catalogue did not load" onRetry={retry} reference="req_c41d07">
            We could not reach the scenario service. Running labs and saved progress are not affected.
          </ErrorState>
        </Card>
      </Page>
    );
  }

  if (state === "denied") {
    return (
      <Page width="full" className="ct-page">
        {header}
        <Card padding="lg">
          <PlanRequired
            title="Browsing and launching scenarios needs an active plan"
            plan="Practitioner"
            includes={[
              "All 14 scenarios: AD sets, standalone hosts and exam simulations",
              "60 lab hours a month, fair use",
              "Onyx at every help level, grounded to each scenario",
              "Progress, proofs and reports kept on your account",
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

  const panel = loading ? (
    <FilterPanelSkeleton />
  ) : (
    <FilterPanel selection={selection} counts={counts} onToggle={toggle} onClearGroup={(g) => setGroup(g, [])} />
  );

  let body: ReactNode;
  if (loading) {
    body = (
      <LoadingRegion label="Loading scenarios">
        <div className="ct-list">
          {Array.from({ length: 8 }, (_, i) => (
            <ScenarioRowSkeleton key={i} />
          ))}
        </div>
      </LoadingRegion>
    );
  } else if (results.length === 0) {
    body = (
      <Card>
        <EmptyState
          icon="filter"
          title="No scenarios match these filters"
          action={
            <Button size="sm" iconLeft="refresh" onClick={reset}>
              Reset filters
            </Button>
          }
        >
          Remove a filter or clear the search to see more.
        </EmptyState>
      </Card>
    );
  } else {
    const heroes = results.filter((s) => s.type === "exam-sim");
    const rest = results.filter((s) => s.type !== "exam-sim");
    body = (
      <>
        {heroes.length > 0 && (
          <div className="ct-featured">
            <ul className="ct-list ct-list--hero" aria-label="Exam simulations">
              {heroes.map((s) => (
                <li key={s.id}>
                  <ScenarioRow scenario={s} href={`/catalogue/${s.slug}`} actionHref={cardAction(s, labActive)} className="rp-srow--hero" maxTags={4} />
                </li>
              ))}
            </ul>
            {rest.length > 0 && <div className="ct-mist" aria-hidden="true" />}
          </div>
        )}
        {rest.length > 0 && (
          <ul className="ct-list" aria-label="Scenarios">
            {rest.map((s) => (
              <li key={s.id}>
                <ScenarioRow scenario={s} href={`/catalogue/${s.slug}`} actionHref={cardAction(s, labActive)} />
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <Page width="full" className="ct-page">
      {header}
      <div className="ct-layout">
        {!narrow && (
          <aside className="ct-aside" aria-label="Filters">
            <div className="ct-aside__head">
              <h2 className="ct-aside__title">Filters</h2>
              {filterCount > 0 && (
                <button type="button" className="rp-link rp-small" onClick={reset}>
                  Reset
                </button>
              )}
            </div>
            <div className="ct-aside__scroll">{panel}</div>
          </aside>
        )}
        <div className="ct-main">
          <div className="ct-toolbar" role="search">
            <Input
              type="search"
              icon="search"
              value={q}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, domain or technique"
              aria-label="Search scenarios"
              wrapperClassName="ct-search"
              disabled={loading}
              suffix={
                q ? (
                  <button type="button" className="rp-input__clear" aria-label="Clear search" onClick={() => setQuery("")}>
                    <Icon name="x" size={13} />
                  </button>
                ) : undefined
              }
            />
            <div className="ct-sort">
              <label htmlFor="ct-sort" className="ct-sort__label">
                Sort
              </label>
              <Select id="ct-sort" value={sort} onChange={(e) => setSort(e.target.value as SortId)} options={SORTS} disabled={loading} />
            </div>
            {narrow && (
              <Button iconLeft="filter" onClick={() => setDrawerOpen(true)} aria-haspopup="dialog" disabled={loading} className="ct-filterbtn">
                Filters
                {filterCount > 0 && <span className="ct-filterbtn__count rp-mono rp-num">{filterCount}</span>}
              </Button>
            )}
          </div>

          <div className="ct-summary">
            <p className="ct-count" aria-live="polite">
              {loading ? (
                <Skeleton width={120} height={10} />
              ) : (
                <>
                  <span className="rp-mono rp-num rp-strong">{results.length}</span> of <span className="rp-mono rp-num">{source.length}</span> scenarios
                  {sort === "recommended" ? null : <span className="ct-count__sort">, sorted by {SORTS.find((x) => x.value === sort)!.label.toLowerCase()}</span>}
                </>
              )}
            </p>
            {activeTags.length > 0 && !loading && (
              <ul className="ct-tags" aria-label="Active filters">
                {activeTags.map((t) => (
                  <li key={t.key}>
                    <Tag onRemove={t.remove} removeLabel={`Remove ${t.label}`}>
                      {t.label}
                    </Tag>
                  </li>
                ))}
                <li>
                  <button type="button" className="rp-link ct-reset" onClick={reset}>
                    Reset
                  </button>
                </li>
              </ul>
            )}
          </div>

          {body}
        </div>
      </div>

      {narrow && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Filters"
          width={360}
          meta={
            <span>
              <span className="rp-mono rp-num">{results.length}</span> of <span className="rp-mono rp-num">{source.length}</span> scenarios
            </span>
          }
          footer={
            <>
              <Button variant="quiet" onClick={reset} disabled={activeTags.length === 0}>
                Reset
              </Button>
              <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
                Show {results.length} {results.length === 1 ? "scenario" : "scenarios"}
              </Button>
            </>
          }
        >
          <div className="ct-drawer">{panel}</div>
        </Drawer>
      )}
    </Page>
  );
}
