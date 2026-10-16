import type { ReactNode } from "react";
import { Icon } from "../icons";
import { cx, formatDate, formatMoney } from "../format";
import type { Invoice, InvoiceStatus, Plan, Tone } from "../types";
import { Badge, Skeleton, StatusDot } from "../components/display";
import { EmptyState } from "../components/layout";
import { IconButton } from "../components/controls";

export interface PlanCardProps {
  plan: Plan;
  interval: "month" | "year";
  action: ReactNode;
  current?: boolean;
  className?: string;
  perSeat?: boolean;
  billingNote?: ReactNode;
}

export function PlanCard({ plan, interval, action, current, className, perSeat, billingNote }: PlanCardProps) {
  const annual = interval === "year" && plan.priceAnnualMonthly !== undefined;
  const price = annual ? plan.priceAnnualMonthly! : plan.priceMonthly;
  const seat = perSeat ? " per seat" : "";
  return (
    <article className={cx("rp-plan", plan.recommended && "is-recommended", current && "is-current", className)} aria-labelledby={`plan-${plan.id}`}>
      <div className="rp-plan__head">
        <h3 id={`plan-${plan.id}`}>{plan.name}</h3>
        {plan.recommended && <Badge tone="premium">Recommended</Badge>}
        {current && <Badge>Current plan</Badge>}
      </div>
      <p className="rp-plan__summary">{plan.summary}</p>
      <div className="rp-plan__price">
        <span className="rp-plan__amount rp-num">{price === 0 ? "$0" : formatMoney(price, plan.currency)}</span>
        <span className="rp-plan__per">{price === 0 ? "forever" : perSeat ? "/ seat / month" : "/ month"}</span>
      </div>
      <div className="rp-plan__billing">
        {billingNote ?? (price === 0 ? "No card required" : annual ? `${formatMoney(plan.priceAnnualTotal ?? 0, plan.currency)}${seat} billed yearly` : "Billed monthly, cancel any time")}
      </div>
      <div className="rp-plan__action">{action}</div>
      <div className="rp-plan__hours">
        <Icon name="clock" size={14} />
        <span>
          {plan.labHours === null ? (
            "No lab access"
          ) : (
            <>
              <span className="rp-mono rp-num rp-strong">{plan.labHours}</span> active lab hours / month, fair use
            </>
          )}
        </span>
      </div>
      <ul className="rp-plan__features">
        {plan.features.map((f) => (
          <li key={f}>
            <Icon name="check" size={14} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

const INVOICE_TONE: Record<InvoiceStatus, Tone> = { paid: "success", open: "med", void: "neutral", uncollectible: "crit", refunded: "info" };
const INVOICE_LABEL: Record<InvoiceStatus, string> = { paid: "Paid", open: "Open", void: "Void", uncollectible: "Uncollectible", refunded: "Refunded" };

export function InvoiceStatusDot({ status }: { status: InvoiceStatus }) {
  return <StatusDot tone={INVOICE_TONE[status]} label={INVOICE_LABEL[status]} size="sm" hollow={status === "void"} />;
}

export function InvoiceRow({ invoice, onDownload }: { invoice: Invoice; onDownload?: (i: Invoice) => void }) {
  return (
    <tr className="rp-invoice">
      <td className="rp-mono rp-num">{formatDate(invoice.date)}</td>
      <td className="rp-mono">{invoice.number}</td>
      <td className="rp-truncate">{invoice.description}</td>
      <td className="rp-mono rp-num is-right">{formatMoney(invoice.amount, invoice.currency, 2)}</td>
      <td>
        <InvoiceStatusDot status={invoice.status} />
      </td>
      <td className="is-right">
        {onDownload && <IconButton icon="download" label={`Download invoice ${invoice.number}`} size="sm" onClick={() => onDownload(invoice)} />}
      </td>
    </tr>
  );
}

export interface InvoiceTableProps {
  invoices: Invoice[];
  onDownload?: (i: Invoice) => void;
  caption?: string;
  loading?: boolean;
  empty?: ReactNode;
}

export function InvoiceTable({ invoices, onDownload, caption = "Invoices", loading, empty }: InvoiceTableProps) {
  return (
    <div className="rp-table-wrap rp-table--compact">
      <div className="rp-table__scroll">
        <table className="rp-table rp-invoices">
          <caption className="rp-sr">{caption}</caption>
          <colgroup>
            <col style={{ width: 120 }} />
            <col style={{ width: 130 }} />
            <col />
            <col style={{ width: 110 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 52 }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">
                <span className="rp-table__th">Date</span>
              </th>
              <th scope="col">
                <span className="rp-table__th">Number</span>
              </th>
              <th scope="col">
                <span className="rp-table__th">Description</span>
              </th>
              <th scope="col" className="is-right">
                <span className="rp-table__th">Amount</span>
              </th>
              <th scope="col">
                <span className="rp-table__th">Status</span>
              </th>
              <th scope="col">
                <span className="rp-sr">Download</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 3 }, (_, r) => (
                  <tr key={r} aria-hidden="true">
                    {[70, 80, 160, 60, 60, 20].map((w, c) => (
                      <td key={c}>
                        <Skeleton width={w} height={10} />
                      </td>
                    ))}
                  </tr>
                ))
              : invoices.length === 0
                ? (
                    <tr>
                      <td colSpan={6} className="rp-table__state">
                        {empty ?? <EmptyState compact icon="receipt" title="No invoices yet" />}
                      </td>
                    </tr>
                  )
                : invoices.map((i) => <InvoiceRow key={i.id} invoice={i} onDownload={onDownload} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
