import { Button, Drawer, EmptyState, Icon, LoadingRegion, Skeleton, SkeletonText, cx, formatTime } from "@rootpanther/ui";
import type { ReportSection } from "@rootpanther/ui";
import type { OnyxCritique } from "../../mock/reports";
import { sectionLabel } from "./model";
import type { ContentMap } from "./model";

export interface ReviewNote extends OnyxCritique {
  resolved: boolean;
}

function location(c: OnyxCritique, sections: ReportSection[], content: ContentMap): { label: string; missing: boolean } {
  const s = sections.find((x) => x.id === c.sectionId);
  if (!s) return { label: "Section removed", missing: true };
  if (!c.stepId) return { label: sectionLabel(s), missing: false };
  const i = (content[s.id]?.steps ?? []).findIndex((x) => x.id === c.stepId);
  if (i < 0) return { label: `${sectionLabel(s)}, step removed`, missing: true };
  return { label: `${sectionLabel(s)}, step ${i + 1}`, missing: false };
}

export interface OnyxReviewProps {
  open: boolean;
  onClose: () => void;
  reviewing: boolean;
  reviewedAt: string | null;
  notes: ReviewNote[];
  sections: ReportSection[];
  content: ContentMap;
  onGo: (c: OnyxCritique) => void;
  onRerun: () => void;
}

export function OnyxReview({ open, onClose, reviewing, reviewedAt, notes, sections, content, onGo, onRerun }: OnyxReviewProps) {
  const openCount = notes.filter((n) => !n.resolved).length;
  const order = (c: OnyxCritique) => {
    const si = sections.findIndex((s) => s.id === c.sectionId);
    const st = c.stepId ? (content[c.sectionId]?.steps ?? []).findIndex((x) => x.id === c.stepId) : -1;
    return si * 100 + st;
  };
  const sorted = [...notes].sort((a, b) => Number(a.resolved) - Number(b.resolved) || order(a) - order(b));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={460}
      title={
        <span className="rb-review__title">
          <span className="rb-review__dot" aria-hidden="true" />
          Onyx review
        </span>
      }
      meta={reviewing ? "Reading every section for reproducibility" : `${openCount} open ${openCount === 1 ? "note" : "notes"}, ${reviewedAt ? `reviewed at ${formatTime(reviewedAt)}` : "from the last review"}`}
      footer={
        <Button iconLeft="refresh" onClick={onRerun} disabled={reviewing}>
          Review again
        </Button>
      }
    >
      {reviewing ? (
        <LoadingRegion label="Onyx is reviewing the report">
          <ul className="rb-review" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="rp-omsg is-onyx rb-review__sk">
                <Skeleton width={150} height={10} />
                <SkeletonText lines={2} />
                <Skeleton width={72} height={10} />
              </li>
            ))}
          </ul>
        </LoadingRegion>
      ) : notes.length === 0 ? (
        sections.some((s) => (content[s.id]?.steps?.length ?? 0) > 0) ? (
          <EmptyState compact icon="check" title="No reproducibility issues found">
            Every step has a command, its evidence and a short explanation.
          </EmptyState>
        ) : (
          <EmptyState compact icon="terminal" title="Nothing to review yet">
            Onyx reviews findings steps for reproducibility. Add steps under each host first.
          </EmptyState>
        )
      ) : (
        <ol className="rb-review" aria-label="Review notes">
          {sorted.map((c) => {
            const loc = location(c, sections, content);
            return (
              <li key={c.id} className={cx("rp-omsg is-onyx rb-note", c.resolved && "is-resolved")}>
                <div className="rp-omsg__meta">
                  <span className="rp-omsg__role">ONYX</span>
                  <span className="rb-note__loc">{loc.label}</span>
                  {c.resolved && (
                    <span className="rb-note__resolved">
                      <Icon name="check" size={12} />
                      Resolved
                    </span>
                  )}
                </div>
                <div className="rp-omsg__body">
                  <p>{c.text}</p>
                </div>
                {!loc.missing && (
                  <button type="button" className="rp-link rb-note__go" onClick={() => onGo(c)}>
                    {c.stepId ? "Go to step" : "Go to section"}
                    <Icon name="arrow-right" size={13} />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Drawer>
  );
}
