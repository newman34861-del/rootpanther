import { useId } from "react";
import type { ReactNode } from "react";
import { Button, Card, LoadingRegion, Skeleton, StatusDot, cx } from "@rootpanther/ui";

export interface FormRowProps {
  label: ReactNode;
  htmlFor?: string;
  labelId?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "div" | "fieldset";
}

export function FormRow({ label, htmlFor, labelId, description, children, className, as = "div" }: FormRowProps) {
  const descId = useId();
  if (as === "fieldset") {
    return (
      <fieldset className={cx("ac-row", className)} aria-describedby={description ? descId : undefined}>
        <div className="ac-row__label">
          <legend className="ac-row__title" id={labelId}>
            {label}
          </legend>
          {description && (
            <p className="ac-row__desc" id={descId}>
              {description}
            </p>
          )}
        </div>
        <div className="ac-row__control">{children}</div>
      </fieldset>
    );
  }
  return (
    <div className={cx("ac-row", className)}>
      <div className="ac-row__label">
        {htmlFor ? (
          <label className="ac-row__title" htmlFor={htmlFor} id={labelId}>
            {label}
          </label>
        ) : (
          <span className="ac-row__title" id={labelId}>
            {label}
          </span>
        )}
        {description && <p className="ac-row__desc">{description}</p>}
      </div>
      <div className="ac-row__control">{children}</div>
    </div>
  );
}

export interface SaveBarProps {
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
  label?: string;
  idle?: ReactNode;
}

export function SaveBar({ dirty, saving, onDiscard, label = "Save changes", idle }: SaveBarProps) {
  return (
    <div className="ac-savebar">
      <span className="ac-savebar__status" aria-live="polite">
        {dirty ? <StatusDot tone="med" size="sm" label="Unsaved changes" /> : idle}
      </span>
      <div className="ac-savebar__actions">
        {dirty && (
          <Button variant="quiet" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
        )}
        <Button type="submit" variant={dirty ? "primary" : "secondary"} loading={saving} disabled={!dirty}>
          {saving ? "Saving" : label}
        </Button>
      </div>
    </div>
  );
}

export function RowsSkeleton({ rows = 3, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div className="rp-card ac-skeleton" aria-hidden="true">
      {title && (
        <div className="rp-card__head">
          <Skeleton width={140} height={12} />
        </div>
      )}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ac-row">
          <div className="ac-row__label">
            <Skeleton width={96 + ((i * 37) % 60)} height={11} />
            <Skeleton width="80%" height={9} style={{ marginTop: 8 }} />
          </div>
          <div className="ac-row__control">
            <Skeleton height={36} radius="md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ cards = [3, 2] }: { cards?: number[] }) {
  return (
    <LoadingRegion label="Loading settings">
      <div className="ac-stack">
        {cards.map((rows, i) => (
          <RowsSkeleton key={i} rows={rows} />
        ))}
      </div>
    </LoadingRegion>
  );
}

export function DangerCard({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <Card title={title} className="ac-danger" padding="none">
      {children}
    </Card>
  );
}
