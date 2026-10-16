import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Button,
  ButtonLink,
  Card,
  Checkbox,
  ConfirmDialog,
  DataTable,
  Drawer,
  DropdownMenu,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  InvoiceStatusDot,
  KeyValue,
  KpiTile,
  LoadingRegion,
  Page,
  PageHeader,
  Section,
  Select,
  Skeleton,
  StatusDot,
  Tabs,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  useToast,
} from "@rootpanther/ui";
import type { Column, Tone } from "@rootpanther/ui";
import {
  STRIPE,
  SUB_STATUS_LABEL,
  caseQueue,
  couponStats,
  dunning,
  invoices,
  lastSyncAt,
  mrr,
  mrrTrend,
  priceById,
  prices,
  product,
  refunds,
  refunds30d,
  subscriptions,
  REFUND_REASON,
} from "../../mock/billing";
import type { BillingInvoice, DunningCase, InvoiceState, QueueCase, Refund, SubStatus, Subscription } from "../../mock/billing";
import { useDataState } from "../../review/review";
import { Denied, StripeLink, money, relSpan, useHashScroll, useRetry } from "./common";
import { DunningBoard } from "./DunningBoard";
import "./billing.css";

type TabId = "subscriptions" | "invoices" | "refunds" | "coupons" | "plans";

const SUB_TONE: Record<SubStatus, Tone> = { active: "primary", trialing: "info", past_due: "crit", paused: "med", canceled: "neutral" };

function SubStatusDot({ status }: { status: SubStatus }) {
  return <StatusDot tone={SUB_TONE[status]} hollow={status === "canceled"} size="sm" label={SUB_STATUS_LABEL[status]} />;
}

function Kpis({ loading, empty, failed }: { loading: boolean; empty: boolean; failed: DunningCase[] }) {
  const disputes = caseQueue.filter((c) => c.kind === "dispute" && c.stage !== "under_review");
  const disputesAll = caseQueue.filter((c) => c.kind === "dispute");
  const atStake = disputesAll.reduce((a, c) => a + c.amount, 0);
  const nextDue = disputes.map((d) => d.dueAt!).sort()[0];
  const atRisk = failed.reduce((a, c) => a + c.amount, 0);
  const prev = mrrTrend[mrrTrend.length - 2];
  return (
    <section className="bo-kpis" aria-label="Billing summary">
      <KpiTile
        loading={loading}
        href="?tab=subscriptions#records"
        label="MRR"
        value={empty ? "$0" : `$${formatNumber(mrr)}`}
        delta={empty ? undefined : { value: ((mrr - prev) / prev) * 100, good: "up", period: "vs 30d" }}
        spark={empty ? undefined : mrrTrend}
        secondary={empty ? "No paying subscriptions" : undefined}
      />
      <KpiTile
        loading={loading}
        href="#dunning"
        label="Failed payments"
        value={empty ? "0" : String(failed.length)}
        unit="invoices"
        secondary={
          empty ? (
            "None in dunning"
          ) : (
            <>
              <span className="rp-mono rp-num">{money(atRisk)}</span> at risk
            </>
          )
        }
      />
      <KpiTile
        loading={loading}
        href="#queue"
        label="Disputes open"
        value={empty ? "0" : String(disputesAll.length)}
        secondary={
          empty ? (
            "None open"
          ) : (
            <>
              <span className="rp-mono rp-num">{money(atStake)}</span> disputed
              {nextDue && (
                <>
                  , due <span className="rp-mono rp-num">{relSpan(nextDue)}</span>
                </>
              )}
            </>
          )
        }
      />
      <KpiTile
        loading={loading}
        href="?tab=refunds#records"
        label="Refunds, 30 days"
        value={empty ? "$0" : money(refunds30d.total)}
        delta={empty ? undefined : { value: ((refunds30d.total - refunds30d.prev) / refunds30d.prev) * 100, good: "down", period: "vs prior 30d" }}
        secondary={
          empty ? (
            "None issued"
          ) : (
            <>
              <span className="rp-mono rp-num">{refunds30d.count}</span> refunds
            </>
          )
        }
      />
    </section>
  );
}

const CASE_STAGE: Record<QueueCase["stage"], { label: string; tone: Tone }> = {
  needs_response: { label: "Needs response", tone: "crit" },
  under_review: { label: "Under review", tone: "info" },
  pending_approval: { label: "Pending approval", tone: "med" },
};

function EvidenceDrawer({ item, onClose, onSubmitted }: { item: QueueCase | null; onClose: () => void; onSubmitted: (c: QueueCase) => void }) {
  const [sending, setSending] = useState(false);
  const docs = item
    ? [
        { id: "usage", label: "Lab usage log", detail: item.amount > 100 ? "41.2 lab hours across 19 sessions since renewal" : "18.0 lab hours across 6 sessions" },
        { id: "ip", label: "Sign-in and checkout IP match", detail: "Same /24 and card country on 14 of 14 sign-ins" },
        { id: "terms", label: "Terms acceptance", detail: "Accepted at signup, terms v3.2" },
        { id: "policy", label: "Cancellation and refund policy", detail: "Shown at checkout, cancel any time" },
        { id: "comms", label: "Support thread", detail: item.amount > 100 ? "2 messages, cancel request 4 days after renewal" : "No messages on record" },
      ]
    : [];
  const [on, setOn] = useState<Record<string, boolean>>({ usage: true, ip: true, terms: true, policy: true, comms: false });
  return (
    <Drawer
      open={!!item}
      onClose={onClose}
      title="Submit dispute evidence"
      meta={item ? <span className="rp-mono">{item.id}</span> : undefined}
      width={520}
      footer={
        item && (
          <>
            <Button variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={sending}
              disabled={!Object.values(on).some(Boolean)}
              onClick={() => {
                setSending(true);
                window.setTimeout(() => {
                  setSending(false);
                  onSubmitted(item);
                }, 700);
              }}
            >
              Submit to Stripe
            </Button>
          </>
        )
      }
    >
      {item && (
        <div className="bo-evidence">
          <KeyValue
            columns={2}
            items={[
              { label: "Customer", value: item.email, mono: true },
              { label: "Amount", value: money(item.amount), mono: true },
              { label: "Reason", value: item.reason },
              { label: "Evidence due", value: item.dueAt ? `${formatDateTime(item.dueAt)}, ${relSpan(item.dueAt)}` : "None" },
              { label: "Charge", value: item.charge, mono: true },
              { label: "Opened", value: formatDateTime(item.openedAt) },
            ]}
          />
          <fieldset className="bo-evidence__set">
            <legend className="rp-eyebrow">Evidence bundle</legend>
            {docs.map((d) => (
              <Checkbox key={d.id} checked={!!on[d.id]} onChange={() => setOn({ ...on, [d.id]: !on[d.id] })} label={d.label} description={d.detail} />
            ))}
          </fieldset>
          <p className="bo-evidence__note">Stripe accepts one submission per dispute. The bank decides within 60 to 75 days.</p>
        </div>
      )}
    </Drawer>
  );
}

function Queue({ loading, empty }: { loading: boolean; empty: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<QueueCase[]>(caseQueue);
  const [evidence, setEvidence] = useState<QueueCase | null>(null);
  const [accepting, setAccepting] = useState<QueueCase | null>(null);
  const [approving, setApproving] = useState<QueueCase | null>(null);

  const columns: Column<QueueCase>[] = [
    {
      id: "case",
      header: "Case",
      minWidth: 200,
      hideable: false,
      sortValue: (r) => r.email,
      titleValue: (r) => `${r.email}, ${r.id}`,
      cell: (r) => (
        <span className="bo-case">
          <span className="bo-case__email rp-mono">{r.email}</span>
          <span className="bo-case__id">
            {r.kind === "dispute" ? "Dispute" : "Refund request"} <span className="rp-mono">{r.id}</span>
          </span>
        </span>
      ),
    },
    { id: "amount", header: "Amount", width: 104, align: "right", mono: true, cell: (r) => <span className="rp-strong">{money(r.amount)}</span>, sortValue: (r) => r.amount },
    {
      id: "reason",
      header: "Reason",
      minWidth: 240,
      cell: (r) => (
        <span className="bo-reason">
          <span className="bo-reason__main">{r.reason}</span>
          <span className="bo-reason__note" title={r.note}>
            {r.note}
          </span>
        </span>
      ),
    },
    {
      id: "due",
      header: "Evidence due",
      width: 132,
      sortValue: (r) => r.dueAt ?? "9",
      cell: (r) =>
        r.dueAt ? (
          <span className={`bo-due rp-mono rp-num${new Date(r.dueAt).getTime() - Date.now() < 4 * 86400000 ? " is-soon" : ""}`} title={formatDateTime(r.dueAt)}>
            {formatDate(r.dueAt, { day: "numeric", month: "short" })}
            <span className="bo-due__rel">{relSpan(r.dueAt)}</span>
          </span>
        ) : (
          <span className="bo-dim">None</span>
        ),
    },
    { id: "stage", header: "Stage", width: 152, cell: (r) => <StatusDot tone={CASE_STAGE[r.stage].tone} size="sm" label={CASE_STAGE[r.stage].label} /> },
    {
      id: "actions",
      header: <span className="rp-sr">Actions</span>,
      headerLabel: "Actions",
      width: 200,
      align: "right",
      hideable: false,
      cell: (r) => (
        <div className="bo-rowactions">
          {r.kind === "dispute" && r.stage === "needs_response" && (
            <Button size="sm" variant="secondary" onClick={() => setEvidence(r)}>
              Submit evidence
            </Button>
          )}
          {r.kind === "refund-request" && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setApproving(r)}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="quiet"
                onClick={() => {
                  setRows((xs) => xs.filter((x) => x.id !== r.id));
                  toast.push({ title: "Refund request declined", detail: `${r.email} was emailed the decision.`, tone: "neutral" });
                }}
              >
                Decline
              </Button>
            </>
          )}
          {r.kind === "dispute" && (
            <DropdownMenu
              label={`More actions for ${r.id}`}
              width={232}
              items={[
                { id: "stripe", label: "Open in Stripe", icon: "external", to: `${STRIPE}/disputes/${r.id}`, external: true },
                { id: "user", label: "View customer", icon: "user", to: `/users?q=${encodeURIComponent(r.email)}` },
                ...(r.stage === "needs_response"
                  ? [
                      { id: "d", divider: true },
                      { id: "accept", label: "Accept dispute", icon: "x-circle" as const, danger: true, onSelect: () => setAccepting(r) },
                    ]
                  : []),
              ]}
              trigger={(p) => <IconButton {...p} icon="more" label={`More actions for ${r.id}`} size="sm" />}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <Section title="Refunds and disputes" id="queue" meta={!loading && !empty && rows.length ? `${rows.length} open` : undefined}>
      <DataTable
        caption="Open disputes and refund requests"
        className="bo-t bo-t--queue"
        columns={columns}
        rows={empty ? [] : rows}
        rowKey={(r) => r.id}
        loading={loading}
        columnControls={false}
        defaultSort={{ id: "due", dir: "asc" }}
        empty={
          <EmptyState icon="check-circle" title="No open disputes or refund requests" compact>
            New disputes arrive from Stripe webhooks within a minute.
          </EmptyState>
        }
      />
      <EvidenceDrawer
        item={evidence}
        onClose={() => setEvidence(null)}
        onSubmitted={(c) => {
          setEvidence(null);
          setRows((xs) => xs.map((x) => (x.id === c.id ? { ...x, stage: "under_review", dueAt: undefined, note: "Evidence submitted just now" } : x)));
          toast.push({ title: "Evidence submitted", detail: `${c.id} is now under review by the card issuer.`, tone: "info" });
        }}
      />
      <ConfirmDialog
        open={!!accepting}
        onClose={() => setAccepting(null)}
        destructive
        title="Accept this dispute"
        confirmLabel={accepting ? `Accept and lose ${money(accepting.amount)}` : "Accept"}
        onConfirm={() => {
          const c = accepting!;
          setAccepting(null);
          setRows((xs) => xs.filter((x) => x.id !== c.id));
          toast.push({ title: "Dispute accepted", detail: `${money(c.amount)} plus the $15.00 fee is final. ${c.email} keeps account history.`, tone: "neutral" });
        }}
      >
        {accepting && (
          <p>
            <span className="rp-mono rp-strong">{money(accepting.amount)}</span> and the <span className="rp-mono">$15.00</span> dispute fee are not recoverable once accepted. The
            subscription for <span className="rp-mono">{accepting.email}</span> is canceled.
          </p>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={!!approving}
        onClose={() => setApproving(null)}
        title={approving ? `Refund ${money(approving.amount)}` : "Refund"}
        confirmLabel="Issue refund"
        onConfirm={() => {
          const c = approving!;
          setApproving(null);
          setRows((xs) => xs.filter((x) => x.id !== c.id));
          toast.push({ title: `Refund issued, ${money(c.amount)}`, detail: `Returns to the card for ${c.email} in 5 to 10 business days.`, tone: "success" });
        }}
      >
        {approving && (
          <p>
            The full charge <span className="rp-mono">{approving.charge}</span> goes back to <span className="rp-mono">{approving.email}</span>. The subscription stays active until
            the period ends. Written to the audit log under your name.
          </p>
        )}
      </ConfirmDialog>
    </Section>
  );
}

function renewal(s: Subscription) {
  const date = formatDate(s.periodEnd);
  const note =
    s.status === "trialing"
      ? "trial ends"
      : s.status === "canceled"
        ? "ended"
        : s.status === "paused"
          ? "resumes"
          : s.cancelAtPeriodEnd
            ? "cancels"
            : s.status === "past_due"
              ? "if collected"
              : null;
  return (
    <span className="bo-when">
      <span className="rp-mono rp-num">{date}</span>
      {note && <span className={`bo-when__note${s.cancelAtPeriodEnd ? " is-cancel" : ""}`}>{note}</span>}
    </span>
  );
}

function SubscriptionsTable({ loading, empty }: { loading: boolean; empty: boolean }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | SubStatus>("");
  const [plan, setPlan] = useState("");
  const rows = useMemo(
    () => (empty ? [] : subscriptions.filter((s) => (!q || s.email.includes(q.trim().toLowerCase())) && (!status || s.status === status) && (!plan || s.priceId === plan))),
    [q, status, plan, empty],
  );
  const filtered = q || status || plan;
  const shownMrr = rows.reduce((a, s) => a + s.mrr, 0);
  const columns: Column<Subscription>[] = [
    {
      id: "email",
      header: "Customer",
      minWidth: 220,
      truncate: true,
      titleValue: (s) => s.email,
      sortValue: (s) => s.email,
      hideable: false,
      cell: (s) => (
        <Link to={`/users/${s.userId}`} className="rp-mono bo-email">
          {s.email}
        </Link>
      ),
    },
    { id: "plan", header: "Plan", width: 200, truncate: true, cell: (s) => priceById(s.priceId).nickname, sortValue: (s) => priceById(s.priceId).nickname },
    { id: "status", header: "Stripe status", width: 132, cell: (s) => <SubStatusDot status={s.status} />, sortValue: (s) => s.status },
    {
      id: "mrr",
      header: "MRR",
      width: 104,
      align: "right",
      mono: true,
      sortValue: (s) => s.mrr,
      cell: (s) => <span className={s.mrr > 0 ? "rp-strong" : undefined}>{money(s.mrr)}</span>,
    },
    { id: "coupon", header: "Coupon", width: 112, mono: true, cell: (s) => s.coupon ?? <span className="bo-dim">None</span>, sortValue: (s) => s.coupon ?? "" },
    { id: "renews", header: "Renewal", width: 172, cell: renewal, sortValue: (s) => new Date(s.periodEnd).getTime() + (s.status === "canceled" ? 1e13 : 0) },
    { id: "created", header: "Customer since", width: 132, mono: true, defaultHidden: true, cell: (s) => formatDate(s.createdAt), sortValue: (s) => s.createdAt },
    { id: "id", header: "Subscription", width: 176, mono: true, defaultHidden: true, truncate: true, cell: (s) => s.id },
    {
      id: "stripe",
      header: <span className="rp-sr">Stripe</span>,
      headerLabel: "Stripe link",
      width: 52,
      align: "right",
      hideable: false,
      cell: (s) => <StripeLink href={`${STRIPE}/subscriptions/${s.id}`} label={`subscription for ${s.email}`} />,
    },
  ];
  return (
    <DataTable
      caption="Subscriptions"
      className="bo-t bo-t--subs"
      columns={columns}
      rows={rows}
      rowKey={(s) => s.id}
      loading={loading}
      density="compact"
      pageSize={15}
      defaultSort={{ id: "renews", dir: "asc" }}
      footerNote={
        loading ? undefined : rows.length ? (
          <>
            <span className="rp-mono rp-num">{formatNumber(rows.length)}</span> subscriptions{filtered ? " match" : ""},{" "}
            <span className="rp-mono rp-num rp-strong">{money(shownMrr)}</span> MRR
          </>
        ) : undefined
      }
      toolbar={
        <>
          <Input
            icon="search"
            inputSize="sm"
            placeholder="Filter by email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Filter subscriptions by email"
            wrapperClassName="bo-search"
          />
          <Select
            selectSize="sm"
            aria-label="Stripe status"
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | SubStatus)}
            options={[{ value: "", label: "All statuses" }, ...(Object.keys(SUB_STATUS_LABEL) as SubStatus[]).map((k) => ({ value: k, label: SUB_STATUS_LABEL[k] }))]}
          />
          <Select
            selectSize="sm"
            aria-label="Plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            options={[{ value: "", label: "All plans" }, ...prices.map((p) => ({ value: p.id, label: p.nickname }))]}
          />
          {filtered && (
            <Button
              size="sm"
              variant="quiet"
              onClick={() => {
                setQ("");
                setStatus("");
                setPlan("");
              }}
            >
              Clear
            </Button>
          )}
        </>
      }
      empty={
        empty ? (
          <EmptyState
            icon="card"
            title="No subscriptions in live mode"
            compact
            action={
              <ButtonLink to="/system#config" size="sm" variant="secondary">
                Check Stripe webhook
              </ButtonLink>
            }
          >
            Subscriptions appear here when the first checkout completes.
          </EmptyState>
        ) : (
          <EmptyState icon="search" title="No subscriptions match these filters" compact />
        )
      }
    />
  );
}

const INVOICE_FILTERS: { value: "" | InvoiceState; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "open", label: "Open" },
  { value: "uncollectible", label: "Uncollectible" },
  { value: "refunded", label: "Refunded" },
  { value: "void", label: "Void" },
];

function InvoicesTable({ loading, empty }: { loading: boolean; empty: boolean }) {
  const [status, setStatus] = useState<"" | InvoiceState>("");
  const rows = empty ? [] : invoices.filter((i) => !status || i.status === status);
  const columns: Column<BillingInvoice>[] = [
    { id: "number", header: "Number", width: 112, mono: true, cell: (i) => i.number, sortValue: (i) => i.number, hideable: false },
    { id: "email", header: "Customer", minWidth: 220, mono: true, truncate: true, cell: (i) => i.email, sortValue: (i) => i.email },
    { id: "desc", header: "Description", minWidth: 200, truncate: true, cell: (i) => i.description },
    { id: "amount", header: "Amount", width: 104, align: "right", mono: true, cell: (i) => <span className="rp-strong">{money(i.amount)}</span>, sortValue: (i) => i.amount },
    { id: "status", header: "Status", width: 140, cell: (i) => <InvoiceStatusDot status={i.status} />, sortValue: (i) => i.status },
    { id: "attempts", header: "Attempts", width: 96, align: "right", mono: true, cell: (i) => i.attempts, sortValue: (i) => i.attempts },
    { id: "created", header: "Created", width: 140, mono: true, cell: (i) => formatDateTime(i.createdAt), sortValue: (i) => i.createdAt },
    {
      id: "stripe",
      header: <span className="rp-sr">Stripe</span>,
      headerLabel: "Stripe link",
      width: 52,
      align: "right",
      hideable: false,
      cell: (i) => <StripeLink href={`${STRIPE}/invoices/${i.id}`} label={`invoice ${i.number}`} />,
    },
  ];
  return (
    <DataTable
      caption="Invoices"
      className="bo-t bo-t--inv"
      columns={columns}
      rows={rows}
      rowKey={(i) => i.id}
      loading={loading}
      density="compact"
      pageSize={15}
      defaultSort={{ id: "created", dir: "desc" }}
      toolbar={<Select selectSize="sm" aria-label="Invoice status" value={status} onChange={(e) => setStatus(e.target.value as "" | InvoiceState)} options={INVOICE_FILTERS} />}
      empty={<EmptyState icon="receipt" title={empty ? "No invoices yet" : "No invoices with this status"} compact />}
    />
  );
}

function RefundsTable({ loading, empty }: { loading: boolean; empty: boolean }) {
  const columns: Column<Refund>[] = [
    { id: "id", header: "Refund", width: 132, mono: true, cell: (r) => r.id, hideable: false },
    { id: "email", header: "Customer", minWidth: 220, mono: true, truncate: true, cell: (r) => r.email, sortValue: (r) => r.email },
    { id: "amount", header: "Amount", width: 104, align: "right", mono: true, cell: (r) => <span className="rp-strong">{money(r.amount)}</span>, sortValue: (r) => r.amount },
    { id: "reason", header: "Reason", width: 192, cell: (r) => REFUND_REASON[r.reason], sortValue: (r) => r.reason },
    { id: "by", header: "Issued by", minWidth: 180, truncate: true, mono: true, cell: (r) => r.by },
    { id: "at", header: "Issued", width: 140, mono: true, cell: (r) => formatDateTime(r.at), sortValue: (r) => r.at },
    {
      id: "status",
      header: "Status",
      width: 120,
      cell: (r) => <StatusDot tone={r.status === "succeeded" ? "success" : "med"} size="sm" label={r.status === "succeeded" ? "Succeeded" : "Pending"} />,
    },
    {
      id: "stripe",
      header: <span className="rp-sr">Stripe</span>,
      headerLabel: "Stripe link",
      width: 52,
      align: "right",
      hideable: false,
      cell: (r) => <StripeLink href={`${STRIPE}/refunds/${r.id}`} label={`refund ${r.id}`} />,
    },
  ];
  return (
    <DataTable
      caption="Refunds issued in the last 30 days"
      className="bo-t bo-t--refunds"
      columns={columns}
      rows={empty ? [] : refunds}
      rowKey={(r) => r.id}
      loading={loading}
      defaultSort={{ id: "at", dir: "desc" }}
      footerNote={
        loading || empty ? undefined : (
          <>
            <span className="rp-mono rp-num">{refunds30d.count}</span> refunds, <span className="rp-mono rp-num rp-strong">{money(refunds30d.total)}</span> returned
          </>
        )
      }
      empty={<EmptyState icon="receipt" title="No refunds in the last 30 days" compact />}
    />
  );
}

type CouponRow = (typeof couponStats)[number];

function discountLabel(c: CouponRow) {
  const d = c.duration === "forever" ? "forever" : c.duration === "once" ? "once" : `${c.months} ${c.months === 1 ? "month" : "months"}`;
  return (
    <span>
      <span className="rp-mono rp-num rp-strong">{c.percentOff}%</span> off, {d}
    </span>
  );
}

function CouponsTable({ loading, empty }: { loading: boolean; empty: boolean }) {
  const columns: Column<CouponRow>[] = [
    { id: "code", header: "Code", width: 128, mono: true, hideable: false, cell: (c) => <span className="rp-strong">{c.code}</span>, sortValue: (c) => c.code },
    { id: "discount", header: "Discount", width: 170, cell: discountLabel, sortValue: (c) => c.percentOff },
    {
      id: "redemptions",
      header: "Redemptions",
      width: 128,
      align: "right",
      mono: true,
      sortValue: (c) => c.redemptions,
      cell: (c) => (
        <>
          {formatNumber(c.redemptions)}
          {c.maxRedemptions && <span className="bo-dim"> / {formatNumber(c.maxRedemptions)}</span>}
        </>
      ),
    },
    { id: "active", header: "Active subs", width: 116, align: "right", mono: true, cell: (c) => formatNumber(c.activeOn), sortValue: (c) => c.activeOn },
    {
      id: "cost",
      header: "MRR discount",
      width: 136,
      align: "right",
      mono: true,
      sortValue: (c) => c.discountPerMonth,
      cell: (c) => (c.discountPerMonth > 0 ? <span className="bo-neg">−{money(c.discountPerMonth)}</span> : <span className="bo-dim">{money(0)}</span>),
    },
    {
      id: "impact",
      header: "Attributed MRR",
      width: 148,
      align: "right",
      mono: true,
      sortValue: (c) => c.attributedMrr,
      cell: (c) => <span className="rp-strong">{money(c.attributedMrr)}</span>,
    },
    {
      id: "status",
      header: "Status",
      width: 112,
      sortValue: (c) => c.status,
      cell: (c) => (
        <StatusDot
          tone={c.status === "active" ? "primary" : "neutral"}
          hollow={c.status !== "active"}
          size="sm"
          label={c.status === "active" ? "Active" : c.status === "expired" ? "Expired" : "Archived"}
        />
      ),
    },
    {
      id: "expires",
      header: "Expires",
      width: 196,
      sortValue: (c) => c.expiresAt ?? "9",
      cell: (c) =>
        c.expiresAt ? (
          <span className="bo-when">
            <span className="rp-mono rp-num">{formatDate(c.expiresAt)}</span>
            {c.status === "active" && <span className="bo-when__note">{relSpan(c.expiresAt)}</span>}
          </span>
        ) : (
          <span className="bo-dim">No expiry</span>
        ),
    },
    {
      id: "stripe",
      header: <span className="rp-sr">Stripe</span>,
      headerLabel: "Stripe link",
      width: 52,
      align: "right",
      hideable: false,
      cell: (c) => <StripeLink href={`${STRIPE}/coupons/${c.id}`} label={`coupon ${c.code}`} />,
    },
  ];
  return (
    <DataTable
      caption="Coupons and promotion codes"
      className="bo-t bo-t--coupons"
      columns={columns}
      rows={empty ? [] : couponStats}
      rowKey={(c) => c.id}
      loading={loading}
      columnControls={false}
      footerNote={loading || empty ? undefined : <>Attributed MRR includes subscriptions still paying after their discount ended. MRR discount is revenue given up this month.</>}
      empty={
        <EmptyState
          icon="hash"
          title="No coupons"
          compact
          action={
            <ButtonLink to={`${STRIPE}/coupons/create`} external size="sm" variant="secondary">
              Create in Stripe
            </ButtonLink>
          }
        >
          Coupons are created in Stripe and mirrored here.
        </EmptyState>
      }
    />
  );
}

function PlansMirror({ loading, empty }: { loading: boolean; empty: boolean }) {
  const counts = (id: string) => subscriptions.filter((s) => s.priceId === id && (s.status === "active" || s.status === "past_due" || s.status === "trialing")).length;
  const mrrFor = (id: string) => subscriptions.filter((s) => s.priceId === id).reduce((a, s) => a + s.mrr, 0);
  const columns: Column<(typeof prices)[number]>[] = [
    { id: "id", header: "Price ID", width: 180, mono: true, hideable: false, cell: (p) => p.id },
    { id: "nick", header: "Nickname", minWidth: 200, truncate: true, cell: (p) => <span className="rp-strong">{p.nickname}</span> },
    {
      id: "amount",
      header: "Amount",
      width: 132,
      align: "right",
      mono: true,
      cell: (p) => (
        <>
          {money(p.amount)}
          <span className="bo-dim"> / {p.interval === "month" ? "mo" : "yr"}</span>
        </>
      ),
    },
    { id: "trial", header: "Trial", width: 88, align: "right", mono: true, cell: (p) => (p.trialDays ? `${p.trialDays}d` : <span className="bo-dim">None</span>) },
    { id: "subs", header: "Subscriptions", width: 128, align: "right", mono: true, cell: (p) => formatNumber(counts(p.id)) },
    { id: "mrr", header: "MRR", width: 120, align: "right", mono: true, cell: (p) => <span className="rp-strong">{money(mrrFor(p.id))}</span> },
    {
      id: "state",
      header: "Status",
      width: 180,
      cell: (p) => <StatusDot tone={p.active ? "primary" : "neutral"} hollow={!p.active} size="sm" label={p.active ? "Active" : "Archived, grandfathered"} />,
    },
  ];
  return (
    <div className="bo-plans">
      <Card
        title="Product"
        meta={<span className="rp-mono">{product.id}</span>}
        actions={
          <ButtonLink to={`${STRIPE}/products/${product.id}`} external size="sm" variant="secondary">
            Edit in Stripe
          </ButtonLink>
        }
      >
        {loading ? (
          <LoadingRegion label="Loading product">
            <div className="bo-plans__skel">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i}>
                  <Skeleton width={72} height={10} />
                  <Skeleton width="70%" height={12} style={{ marginTop: 8 }} />
                </div>
              ))}
            </div>
          </LoadingRegion>
        ) : empty ? (
          <EmptyState
            icon="layers"
            title="No products in Stripe live mode"
            compact
            action={
              <ButtonLink to={`${STRIPE}/products/create`} external size="sm" variant="secondary">
                Create in Stripe
              </ButtonLink>
            }
          />
        ) : (
          <div className="bo-plans__body">
            <KeyValue
              columns={4}
              items={[
                { label: "Name", value: product.name },
                { label: "Description", value: product.description },
                { label: "Tax code", value: product.taxCode, mono: true },
                { label: "Updated in Stripe", value: formatDateTime(product.updatedAt) },
              ]}
            />
            <div className="bo-meta">
              <span className="rp-eyebrow">Metadata</span>
              <dl className="bo-meta__list">
                {product.metadata.map((m) => (
                  <div key={m.key} className="bo-meta__item">
                    <dt className="rp-mono">{m.key}</dt>
                    <dd className="rp-mono">{m.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </Card>
      <DataTable
        caption="Prices"
        className="bo-t bo-t--prices"
        showCaption
        columns={columns}
        rows={empty ? [] : prices}
        rowKey={(p) => p.id}
        loading={loading}
        columnControls={false}
        empty={<EmptyState icon="money" title="No prices" compact />}
        footerNote={loading || empty ? undefined : "Read-only. Prices are immutable in Stripe: create a new price and archive the old one."}
      />
    </div>
  );
}

export default function BillingOpsPage() {
  const state = useDataState();
  const retry = useRetry();
  const [params] = useSearchParams();
  const [cases, setCases] = useState<DunningCase[]>(dunning);
  const loading = state === "loading";
  const empty = state === "empty";
  useHashScroll(state === "default");

  const raw = params.get("tab");
  const tab: TabId = raw === "invoices" || raw === "refunds" || raw === "coupons" || raw === "plans" ? raw : "subscriptions";
  const tabHref = (id: TabId) => {
    const p = new URLSearchParams(params);
    if (id === "subscriptions") p.delete("tab");
    else p.set("tab", id);
    const s = p.toString();
    return `${s ? `?${s}` : "?"}`;
  };

  const header = (
    <PageHeader
      title="Billing"
      meta={
        state === "denied" ? undefined : state === "error" ? (
          <StatusDot tone="crit" size="sm" label="Stripe sync failed" />
        ) : (
          <>
            <StatusDot
              tone="neutral"
              size="sm"
              label={
                <>
                  Stripe live mode, synced <span className="rp-mono rp-num">{formatRelative(lastSyncAt)}</span>
                </>
              }
            />
            {!loading && !empty && (
              <span>
                <span className="rp-mono rp-num rp-strong">{formatNumber(subscriptions.filter((s) => s.status === "active" || s.status === "past_due").length)}</span> paying,{" "}
                <span className="rp-mono rp-num rp-strong">{subscriptions.filter((s) => s.status === "trialing").length}</span> trialing
              </span>
            )}
          </>
        )
      }
      actions={
        state === "denied" ? undefined : (
          <ButtonLink to={STRIPE} external variant="secondary" size="sm">
            Stripe dashboard
          </ButtonLink>
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
          <ErrorState title="Billing data did not load" onRetry={retry} reference="req_3b91e0">
            The Stripe sync service returned 503. Stripe keeps collecting payments and running retries on schedule.
          </ErrorState>
        </Card>
      </Page>
    );
  }

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "subscriptions", label: "Subscriptions" },
    { id: "invoices", label: "Invoices" },
    { id: "refunds", label: "Refunds" },
    { id: "coupons", label: "Coupons" },
    { id: "plans", label: "Plans and prices" },
  ];

  return (
    <Page width="full" className="bo-page">
      {header}
      <Kpis loading={loading} empty={empty} failed={cases} />
      <Section
        title="Dunning"
        id="dunning"
        meta={
          !loading && !empty && cases.length ? (
            <>
              <span className="rp-mono rp-num">{cases.length}</span> failed payments, <span className="rp-mono rp-num">{money(cases.reduce((a, c) => a + c.amount, 0))}</span>
            </>
          ) : undefined
        }
        actions={
          <a
            href={`${STRIPE}/settings/billing/automatic`}
            target="_blank"
            rel="noopener noreferrer"
            className="bo-sectionlink"
            aria-label="Retry schedule settings in Stripe (opens in a new tab)"
          >
            Retry schedule
          </a>
        }
      >
        <DunningBoard cases={empty ? [] : cases} onChange={setCases} loading={loading} />
      </Section>
      <Queue loading={loading} empty={empty} />
      <section className="bo-records" id="records" aria-label="Billing records">
        <Tabs label="Billing records" value={tab} items={tabs.map((t) => ({ ...t, to: tabHref(t.id) }))} />
        <div className="bo-records__panel">
          {tab === "subscriptions" && <SubscriptionsTable loading={loading} empty={empty} />}
          {tab === "invoices" && <InvoicesTable loading={loading} empty={empty} />}
          {tab === "refunds" && <RefundsTable loading={loading} empty={empty} />}
          {tab === "coupons" && <CouponsTable loading={loading} empty={empty} />}
          {tab === "plans" && <PlansMirror loading={loading} empty={empty} />}
        </div>
      </section>
    </Page>
  );
}
