import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Badge,
  ButtonLink,
  Card,
  CodeBlock,
  EmptyState,
  ErrorState,
  Icon,
  Skeleton,
  SkeletonText,
  TECHNIQUE_LABEL,
  TIER_NAMES,
  TIER_ORDER,
  UiLink,
} from "@rootpanther/ui";
import type { TierCode } from "@rootpanther/ui";
import { currentUser } from "../../mock/account";
import { primers } from "../../mock/onyx";
import type { Primer } from "../../mock/onyx";
import type { DataState } from "../../review/review";

function tierLocked(primerTier: TierCode): boolean {
  return TIER_ORDER.indexOf(primerTier) > TIER_ORDER.indexOf(currentUser.tier);
}

function PrimerCard({ primer }: { primer: Primer }) {
  const locked = tierLocked(primer.tier);
  const pct = Math.round(primer.progress * 100);
  const done = primer.progress >= 1;
  const inner = (
    <>
      <div className="ox-primer__top">
        <span className="ox-primer__fam">{TECHNIQUE_LABEL[primer.family]}</span>
        <Badge>{primer.tier}</Badge>
      </div>
      <div className="ox-primer__title">{primer.title}</div>
      <p className="ox-primer__summary">{primer.summary}</p>
      <div className="ox-primer__foot">
        {locked ? (
          <span className="ox-primer__lock">
            <Icon name="lock" size={13} />
            Available at {primer.tier} {TIER_NAMES[primer.tier]}
          </span>
        ) : (
          <>
            <span className="ox-primer__time rp-mono rp-num">{primer.minutes} min read</span>
            {primer.progress > 0 ? (
              <span className="ox-primer__pbar">
                <span className="ox-pmeter" aria-hidden="true">
                  <span className={done ? "ox-pmeter__fill is-done" : "ox-pmeter__fill"} style={{ width: `${pct}%` }} />
                </span>
                <span className="rp-mono rp-num">{done ? "Read" : `${pct}%`}</span>
              </span>
            ) : (
              <span className="rp-mono">Not started</span>
            )}
          </>
        )}
      </div>
    </>
  );
  if (locked) {
    return (
      <div className="ox-primer is-locked" aria-label={`${primer.title}, available at ${primer.tier} ${TIER_NAMES[primer.tier]}`}>
        {inner}
      </div>
    );
  }
  return (
    <UiLink to={`/onyx/primers?primer=${primer.id}`} className="ox-primer">
      {inner}
    </UiLink>
  );
}

function PrimerReader({ primer }: { primer: Primer }) {
  const [active, setActive] = useState(primer.sections[0]?.id ?? "");
  const [read, setRead] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const idx = primers.findIndex((p) => p.id === primer.id);
  const prev = idx > 0 ? primers[idx - 1] : undefined;
  const next = idx < primers.length - 1 ? primers[idx + 1] : undefined;

  useEffect(() => {
    function onScroll() {
      const main = mainRef.current;
      if (!main) return;
      const rect = main.getBoundingClientRect();
      const viewport = window.innerHeight;
      const scrolled = viewport - rect.top;
      const range = Math.max(1, rect.height);
      const p = Math.min(1, Math.max(0, scrolled / range));
      setRead(Math.round(p * 100));
      const heads = main.querySelectorAll<HTMLElement>("[data-section]");
      let current = heads[0]?.dataset.section ?? active;
      heads.forEach((h) => {
        if (h.getBoundingClientRect().top <= 160) current = h.dataset.section ?? current;
      });
      setActive(current);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primer.id]);

  return (
    <div className="ox-reader">
      <div className="ox-reader__main" ref={mainRef}>
        <article className="ox-lesson">
          {primer.sections.map((s) => (
            <section key={s.id} id={`sec-${s.id}`} data-section={s.id} className="ox-lesson__section">
              <h2 className="ox-lesson__h">{s.title}</h2>
              {s.blocks.map((b, i) => {
                if (b.kind === "p") return <p key={i}>{b.text}</p>;
                if (b.kind === "note")
                  return (
                    <div key={i} className="ox-lesson__note">
                      <Icon name="info" size={15} />
                      <span>{b.text}</span>
                    </div>
                  );
                if (b.kind === "list")
                  return (
                    <ul key={i} className="ox-lesson__list">
                      {b.items.map((it, j) => (
                        <li key={j}>{it}</li>
                      ))}
                    </ul>
                  );
                return <CodeBlock key={i} code={b.code} label={b.label} prompt={b.prompt} tone={b.prompt ? "terminal" : "default"} />;
              })}
            </section>
          ))}
        </article>
        <nav className="ox-readernav" aria-label="Primer navigation">
          {prev ? (
            <UiLink to={`/onyx/primers?primer=${prev.id}`} className="ox-readernav__link">
              <span className="ox-readernav__dir">Previous</span>
              <span className="ox-readernav__name">{prev.title}</span>
            </UiLink>
          ) : (
            <span />
          )}
          {next && (
            <UiLink to={`/onyx/primers?primer=${next.id}`} className="ox-readernav__link is-next">
              <span className="ox-readernav__dir">Next</span>
              <span className="ox-readernav__name">{next.title}</span>
            </UiLink>
          )}
        </nav>
      </div>
      <aside className="ox-progsticky">
        <div>
          <div className="ox-progsticky__head">
            <span className="rp-eyebrow">Reading progress</span>
            <span className="ox-progsticky__pct rp-mono rp-num">{read}%</span>
          </div>
          <div className="rp-progress rp-progress--sm" style={{ marginTop: 8 }}>
            <div className="rp-progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={read} aria-label="Reading progress">
              <span className="rp-progress__fill" style={{ width: `${read}%`, background: "var(--primary)" }} />
            </div>
          </div>
        </div>
        <ul className="ox-toc">
          {primer.sections.map((s) => (
            <li key={s.id}>
              <a href={`#sec-${s.id}`} className={active === s.id ? "ox-toc__link is-on" : "ox-toc__link"}>
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

export function OnyxPrimers({ state }: { state: DataState }) {
  const [params] = useSearchParams();
  const openId = params.get("primer");
  const open = useMemo(() => primers.find((p) => p.id === openId), [openId]);

  if (openId && !open) {
    return (
      <Card>
        <EmptyState icon="book" title="Primer not found" action={<ButtonLink to="/onyx/primers" size="sm">Back to primers</ButtonLink>}>
          The primer <span className="rp-mono">{openId}</span> does not exist or has been renamed.
        </EmptyState>
      </Card>
    );
  }

  if (open) {
    if (open.sections.length === 0) {
      return (
        <Card>
          <EmptyState icon="book" title="This primer is being written" action={<ButtonLink to="/onyx/primers" size="sm">Back to primers</ButtonLink>}>
            {open.title} is scheduled for your tier. The outline is ready and the lesson will follow.
          </EmptyState>
        </Card>
      );
    }
    return <PrimerReader primer={open} />;
  }

  if (state === "loading") {
    return (
      <div className="ox-cards">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="ox-primer" aria-hidden="true">
            <Skeleton width={90} height={11} />
            <Skeleton width="70%" height={16} style={{ marginTop: 6 }} />
            <SkeletonText lines={2} />
            <Skeleton width={120} height={11} style={{ marginTop: 10 }} />
          </div>
        ))}
      </div>
    );
  }
  if (state === "error") {
    return (
      <Card>
        <ErrorState title="Primers did not load" onRetry={() => window.location.reload()} reference="req_pr8821">
          The lesson service did not respond. Drills and playbooks are not affected.
        </ErrorState>
      </Card>
    );
  }
  if (state === "empty") {
    return (
      <Card>
        <EmptyState icon="book" title="No primers for your tier yet">
          Primers are matched to your Path tier. New ones are added as you progress.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="ox-cards">
      {primers.map((p) => (
        <PrimerCard key={p.id} primer={p} />
      ))}
    </div>
  );
}
