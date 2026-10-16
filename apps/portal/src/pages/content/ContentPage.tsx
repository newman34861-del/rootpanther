import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Card, ErrorState, KpiTile, Page, PageHeader, Section, StatusDot, formatRelative, useToast } from "@rootpanther/ui";
import { contentScenarios, groundingScore } from "../../mock/content";
import type { ContentScenario } from "../../mock/content";
import { useDataState } from "../../review/review";
import { Denied, useRetry } from "./common";
import { Grounding } from "./Grounding";
import { Inventory } from "./Inventory";
import { Randomisation } from "./Randomisation";
import { SolveBoard } from "./SolveBoard";
import "./content.css";

export default function ContentPage() {
  const state = useDataState();
  const retry = useRetry();
  const toast = useToast();
  const { hash } = useLocation();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<ContentScenario[]>(contentScenarios);
  const [running, setRunning] = useState<string[]>([]);
  const loading = state === "loading";
  const empty = state === "empty";
  const slug = params.get("scenario");
  const selected = rows.find((s) => s.slug === slug) ?? (slug ? undefined : rows.find((s) => s.status === "in-review"));

  useEffect(() => {
    if (state !== "default") return;
    const target = hash ? hash.slice(1) : slug ? "randomisation" : null;
    if (!target) return;
    const t = window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ block: "start" }), 120);
    return () => window.clearTimeout(t);
  }, [hash, slug, state]);

  const select = (s: string) => {
    const p = new URLSearchParams(params);
    p.set("scenario", s);
    setParams(p, { replace: true });
    window.setTimeout(() => document.getElementById("randomisation")?.scrollIntoView({ block: "start", behavior: "smooth" }), 40);
  };

  const update = (id: string, patch: Partial<ContentScenario>) => setRows((xs) => xs.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const runSolve = (targets: ContentScenario[]) => {
    const ids = targets.map((t) => t.id);
    setRunning((r) => [...r, ...ids]);
    toast.push({
      title: ids.length === 1 ? `Solve-test queued for ${targets[0].name}` : `Solve-test queued for ${ids.length} scenarios`,
      detail: "Each run deploys a throwaway tenant and takes 20 minutes to 3 hours.",
      tone: "info",
    });
    window.setTimeout(() => {
      setRunning((r) => r.filter((x) => !ids.includes(x)));
      const failed = targets.filter((t) => t.solveTest.result === "fail");
      if (ids.length === 1 && failed.length === 1) {
        toast.push({ title: `${targets[0].name} ${targets[0].version} failed again`, detail: "Publishing stays blocked. Full log attached to the CI run.", tone: "crit" });
      } else if (ids.length === 1) {
        toast.push({ title: `${targets[0].name} ${targets[0].version} passed`, detail: "Solvable, no shortcut found. Publishing unblocked.", tone: "success" });
      }
    }, 2400);
    setRows((xs) =>
      xs.map((s) =>
        ids.includes(s.id) && s.solveTest.result === "not-run"
          ? {
              ...s,
              solveTest: {
                ...s.solveTest,
                result: "pass",
                at: new Date().toISOString(),
                durationSec: s.solveTest.runs[0].durationSec,
                solvable: true,
                shortcutFree: true,
                runs: [
                  { id: "run_4831", version: s.version, result: "pass", at: new Date().toISOString(), durationSec: s.solveTest.runs[0].durationSec },
                  ...s.solveTest.runs.slice(0, 11),
                ],
              },
            }
          : s,
      ),
    );
  };

  const published = rows.filter((s) => s.status === "published");
  const failing = rows.filter((s) => s.solveTest.result === "fail");
  const review = rows.filter((s) => s.status === "in-review");
  const g = rows.reduce(
    (a, s) => {
      const x = groundingScore(s);
      return { done: a.done + x.done, total: a.total + x.total };
    },
    { done: 0, total: 0 },
  );
  const lastRun = rows
    .map((s) => s.solveTest.at)
    .filter(Boolean)
    .sort()
    .pop();

  const header = (
    <PageHeader
      title="Content"
      meta={
        state === "denied" ? undefined : state === "error" ? (
          <StatusDot tone="crit" size="sm" label="Content repository unreachable" />
        ) : (
          <>
            <StatusDot
              tone="neutral"
              size="sm"
              label={
                <>
                  Repository <span className="rp-mono">rootpanther/scenarios@main</span>
                </>
              }
            />
            {lastRun && !loading && !empty && (
              <span>
                Last CI run <span className="rp-mono rp-num">{formatRelative(lastRun)}</span>
              </span>
            )}
          </>
        )
      }
    />
  );

  if (state === "denied") {
    return (
      <Page width="full">
        {header}
        <Denied />
      </Page>
    );
  }

  if (state === "error") {
    return (
      <Page width="full">
        {header}
        <Card>
          <ErrorState title="Content data did not load" onRetry={retry} reference="req_51ad2c">
            The content service could not read the scenario repository. Published scenarios keep launching normally.
          </ErrorState>
        </Card>
      </Page>
    );
  }

  return (
    <Page width="full" className="cn-page">
      {header}
      <section className="cn-kpis" aria-label="Content summary">
        <KpiTile
          loading={loading}
          label="Published"
          value={empty ? "0" : String(published.length)}
          unit={empty ? undefined : `of ${rows.length}`}
          secondary={empty ? "No scenarios yet" : `${review.length} in review, ${rows.filter((s) => s.status === "draft").length} draft`}
        />
        <KpiTile
          loading={loading}
          href="#solve-tests"
          label="Solve-tests failing"
          value={empty ? "0" : String(failing.length)}
          secondary={empty ? "None" : failing.length ? failing.map((s) => s.name).join(", ") : "All passing"}
          className={!loading && !empty && failing.length ? "cn-kpi--crit" : undefined}
        />
        <KpiTile
          loading={loading}
          label="Learners in progress"
          value={empty ? "0" : rows.reduce((a, s) => a + s.learnersInProgress, 0).toLocaleString("en-US")}
          secondary={empty ? "None" : "Across all live versions"}
        />
        <KpiTile
          loading={loading}
          href="#grounding"
          label="Onyx grounding"
          value={empty ? "None" : `${Math.round((g.done / g.total) * 100)}%`}
          secondary={empty ? "No authoring metadata" : `${g.total - g.done} phase gaps`}
        />
      </section>
      <Section title="Scenario inventory" id="inventory">
        <Inventory rows={rows} loading={loading} empty={empty} selected={slug} onSelect={select} onChange={update} onRunSolve={(s) => runSolve([s])} />
      </Section>
      <Section
        title="Solve-test CI"
        id="solve-tests"
        meta={!loading && !empty ? `${rows.length - failing.length - rows.filter((s) => s.solveTest.result === "not-run").length} of ${rows.length} passing` : undefined}
      >
        <SolveBoard rows={rows} loading={loading} empty={empty} running={running} onRun={(s) => runSolve([s])} onRunAll={() => runSolve(rows)} />
      </Section>
      <div id="randomisation" className="cn-anchor">
        <Randomisation scenario={empty ? undefined : selected} options={empty ? [] : rows} loading={loading} onSelect={select} />
      </div>
      <Grounding rows={rows} loading={loading} empty={empty} />
    </Page>
  );
}
