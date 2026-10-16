import { useState } from "react";
import { Card, Checkbox, CopyButton, EmptyState, ErrorState, Icon, Skeleton, SkeletonText } from "@rootpanther/ui";
import { playbooks } from "../../mock/onyx";
import type { Playbook } from "../../mock/onyx";
import type { DataState } from "../../review/review";

function PlaybookCard({ playbook }: { playbook: Playbook }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const total = playbook.groups.reduce((n, g) => n + g.items.length, 0);
  const done = checked.size;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card
      title={playbook.title}
      meta={
        <span className="ox-pbsummary rp-mono rp-num">
          {done} / {total} done
        </span>
      }
    >
      <p className="ox-pb__when">
        <Icon name="info" size={14} />
        {playbook.when}
      </p>
      {playbook.groups.map((g) => (
        <div key={g.title} className="ox-pb__group">
          <span className="ox-pb__gtitle">{g.title}</span>
          <ul className="ox-pb__list">
            {g.items.map((it) => {
              const on = checked.has(it.id);
              return (
                <li key={it.id} className={on ? "ox-pb__item is-checked" : "ox-pb__item"}>
                  <Checkbox className="ox-pb__check" checked={on} onChange={() => toggle(it.id)} label={it.text} />
                  {it.command && (
                    <div className="ox-pb__cmd">
                      <div className="rp-copyfield">
                        <span className="rp-copyfield__value rp-mono">{it.command}</span>
                        <CopyButton value={it.command} label="Copy command" />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </Card>
  );
}

export function OnyxPlaybooks({ state }: { state: DataState }) {
  if (state === "loading") {
    return (
      <div className="ox-playbooks">
        {Array.from({ length: 2 }, (_, i) => (
          <Card key={i} title={<Skeleton width={200} height={16} />}>
            <SkeletonText lines={4} />
          </Card>
        ))}
      </div>
    );
  }
  if (state === "error") {
    return (
      <Card>
        <ErrorState title="Playbooks did not load" onRetry={() => window.location.reload()} reference="req_pb3307">
          The reference service did not respond. Try again shortly.
        </ErrorState>
      </Card>
    );
  }
  if (state === "empty") {
    return (
      <Card>
        <EmptyState icon="checklist" title="No playbooks yet">
          Playbooks are methodology checklists you can work through during a lab.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="ox-playbooks">
      {playbooks.map((p) => (
        <PlaybookCard key={p.id} playbook={p} />
      ))}
    </div>
  );
}
