import { StatusDot } from "@rootpanther/ui";
import { PLANS, STATUS_META, toCsv } from "../../mock/users";
import type { PlanId, UserRecord, UserStatus } from "../../mock/users";

export function UserStatusDot({ status, size = "sm" }: { status: UserStatus; size?: "sm" | "md" }) {
  const m = STATUS_META[status];
  return <StatusDot tone={m.tone} hollow={m.hollow} size={size} label={m.label} />;
}

export function PlanLabel({ plan }: { plan: PlanId }) {
  const p = PLANS[plan];
  return (
    <span className="us-plan">
      <span>{p.name}</span>
      {p.interval && <span className="us-plan__int rp-mono">{p.interval}</span>}
    </span>
  );
}

export function downloadCsv(rows: UserRecord[], name: string) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isoDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoDateTime(iso: string): string {
  const d = new Date(iso);
  return `${isoDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
