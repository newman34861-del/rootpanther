import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, EmptyState, IconButton, Skeleton, StatusDot, formatDateTime, useToast } from "@rootpanther/ui";
import { DECLINE_LABEL, DUNNING_STAGES, STRIPE } from "../../mock/billing";
import type { DunningCase } from "../../mock/billing";
import { money, relSpan } from "./common";

interface Props {
  cases: DunningCase[];
  onChange: (next: DunningCase[]) => void;
  loading: boolean;
}

function BoardSkeleton() {
  return (
    <div className="bo-board" aria-hidden="true">
      {DUNNING_STAGES.map((s, i) => (
        <div key={s.id} className="bo-col">
          <div className="bo-col__head">
            <Skeleton width={96} height={12} />
            <Skeleton width={140} height={10} style={{ marginTop: 8 }} />
          </div>
          <div className="bo-col__list">
            {Array.from({ length: i === 0 ? 3 : i === 3 ? 1 : 2 }, (_, j) => (
              <div key={j} className="bo-dcard is-skeleton">
                <Skeleton width="70%" height={11} />
                <Skeleton width="45%" height={10} style={{ marginTop: 10 }} />
                <Skeleton width="55%" height={10} style={{ marginTop: 8 }} />
                <div className="bo-dcard__actions">
                  <Skeleton width={84} height={32} radius="md" />
                  <Skeleton width={60} height={32} radius="md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DunningBoard({ cases, onChange, loading }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return <BoardSkeleton />;
  if (cases.length === 0) {
    return (
      <div className="bo-panel">
        <EmptyState icon="check-circle" title="No failed payments" compact>
          Every invoice in the current cycle has been collected.
        </EmptyState>
      </div>
    );
  }

  function retry(c: DunningCase) {
    setBusy(c.id);
    window.setTimeout(() => {
      setBusy(null);
      if (c.retryWillSucceed) {
        onChange(cases.filter((x) => x.id !== c.id));
        toast.push({ title: `Payment collected, ${money(c.amount)}`, detail: `${c.invoice} paid by ${c.email}. Access unchanged.`, tone: "success" });
      } else {
        onChange(cases.map((x) => (x.id === c.id ? { ...x, failedAt: new Date().toISOString() } : x)));
        toast.push({
          title: `Retry declined: ${DECLINE_LABEL[c.decline]}`,
          detail: `${c.invoice} for ${c.email} is still open. The automatic schedule is unchanged.`,
          tone: "crit",
        });
      }
    }, 900);
  }

  function email(c: DunningCase) {
    onChange(cases.map((x) => (x.id === c.id ? { ...x, emailedAt: new Date().toISOString() } : x)));
    toast.push({ title: "Payment update email sent", detail: `${c.email} received a link to update ${c.card}.`, tone: "info" });
  }

  function resolve(c: DunningCase) {
    const before = cases;
    onChange(cases.filter((x) => x.id !== c.id));
    toast.push({
      title: `${c.invoice} marked resolved`,
      detail: `Removed from dunning. ${c.email} keeps access.`,
      tone: "neutral",
      action: { label: "Undo", onClick: () => onChange(before) },
    });
  }

  return (
    <div className="bo-board">
      {DUNNING_STAGES.map((stage) => {
        const items = cases.filter((c) => c.stage === stage.id);
        const total = items.reduce((a, c) => a + c.amount, 0);
        const headId = `bo-col-${stage.id}`;
        return (
          <section key={stage.id} className={`bo-col is-${stage.id}`} aria-labelledby={headId}>
            <div className="bo-col__head">
              <div className="bo-col__title">
                <h3 id={headId}>{stage.label}</h3>
                <span className="bo-col__count rp-mono rp-num">{items.length}</span>
                <span className="bo-col__sum rp-mono rp-num">{money(total)}</span>
              </div>
              <span className="bo-col__detail">{stage.detail}</span>
            </div>
            {items.length === 0 ? (
              <p className="bo-col__none">None at this stage</p>
            ) : (
              <ul className="bo-col__list">
                {items.map((c) => (
                  <li key={c.id} className="bo-dcard">
                    <div className="bo-dcard__top">
                      <Link to={`/users/${c.userId}`} className="bo-dcard__email rp-mono" title={c.email}>
                        {c.email}
                      </Link>
                      <span className="bo-dcard__amt rp-mono rp-num">{money(c.amount)}</span>
                    </div>
                    <div className="bo-dcard__decline">
                      <StatusDot tone={c.decline === "expired_card" || c.decline === "do_not_honor" ? "crit" : "high"} size="sm" label={DECLINE_LABEL[c.decline]} />
                    </div>
                    <div className="bo-dcard__ref rp-mono">
                      <span>{c.card}</span>
                      <span aria-hidden="true">·</span>
                      <a href={`${STRIPE}/invoices/${c.invoice}`} target="_blank" rel="noopener noreferrer" aria-label={`Invoice ${c.invoice} in Stripe (opens in a new tab)`}>
                        {c.invoice}
                      </a>
                    </div>
                    <dl className="bo-dcard__facts">
                      {c.accessPausedAt ? (
                        <div>
                          <dt>Paused</dt>
                          <dd className="rp-mono rp-num" title={formatDateTime(c.accessPausedAt)}>
                            {relSpan(c.accessPausedAt)}
                          </dd>
                        </div>
                      ) : (
                        <div>
                          <dt>Next retry</dt>
                          <dd className="rp-mono rp-num" title={c.nextRetryAt ? formatDateTime(c.nextRetryAt) : undefined}>
                            {c.nextRetryAt ? relSpan(c.nextRetryAt) : "None scheduled"}
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt>Last emailed</dt>
                        <dd className="rp-mono rp-num">{c.emailedAt ? relSpan(c.emailedAt) : "Never"}</dd>
                      </div>
                    </dl>
                    <div className="bo-dcard__actions">
                      <Button size="sm" variant="secondary" loading={busy === c.id} onClick={() => retry(c)} aria-label={`Retry now, ${c.invoice} for ${c.email}`}>
                        Retry now
                      </Button>
                      <Button size="sm" variant="quiet" onClick={() => email(c)} disabled={busy === c.id} aria-label={`Email customer ${c.email}`}>
                        Email
                      </Button>
                      <IconButton
                        icon="check-circle"
                        size="sm"
                        label={`Mark ${c.invoice} resolved`}
                        onClick={() => resolve(c)}
                        disabled={busy === c.id}
                        className="bo-dcard__resolve"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
