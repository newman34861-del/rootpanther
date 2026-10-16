import { useId, useRef, useState } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";
import { Icon } from "../icons";
import type { IconName } from "../icons";
import { cx } from "../format";
import { UiLink } from "./Link";
import { Button } from "./controls";

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="rp-crumbs">
      <ol>
        {items.map((c, i) => (
          <li key={i}>
            {c.to && i < items.length - 1 ? <UiLink to={c.to}>{c.label}</UiLink> : <span aria-current={i === items.length - 1 ? "page" : undefined}>{c.label}</span>}
            {i < items.length - 1 && <Icon name="chevron-right" size={12} />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export interface PageHeaderProps {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  crumbs?: Crumb[];
  eyebrow?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, meta, actions, crumbs, eyebrow, children, className }: PageHeaderProps) {
  return (
    <header className={cx("rp-pagehead", className)}>
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="rp-pagehead__row">
        <div className="rp-pagehead__titles">
          {eyebrow && <div className="rp-pagehead__eyebrow">{eyebrow}</div>}
          <h1>{title}</h1>
          {meta && <div className="rp-pagehead__meta">{meta}</div>}
        </div>
        {actions && <div className="rp-pagehead__actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export interface CardProps {
  title?: ReactNode;
  titleId?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  as?: ElementType;
  headingLevel?: 2 | 3;
  meta?: ReactNode;
  style?: CSSProperties;
  tone?: "default" | "raised" | "inset";
  id?: string;
}

export function Card({
  title,
  titleId,
  actions,
  footer,
  children,
  padding = "md",
  className,
  as: As = "section",
  headingLevel = 2,
  meta,
  style,
  tone = "default",
  id,
}: CardProps) {
  const auto = useId();
  const hid = titleId ?? auto;
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <As className={cx("rp-card", `rp-card--${tone}`, className)} aria-labelledby={title ? hid : undefined} style={style} id={id}>
      {(title || actions) && (
        <div className="rp-card__head">
          <div className="rp-card__titles">
            {title && (
              <H id={hid} className="rp-card__title">
                {title}
              </H>
            )}
            {meta && <div className="rp-card__meta">{meta}</div>}
          </div>
          {actions && <div className="rp-card__actions">{actions}</div>}
        </div>
      )}
      <div className={cx("rp-card__body", `rp-pad--${padding}`)}>{children}</div>
      {footer && <div className="rp-card__foot">{footer}</div>}
    </As>
  );
}

export function Panel({ children, className, padding = "md", as: As = "div", style }: { children: ReactNode; className?: string; padding?: "none" | "sm" | "md" | "lg"; as?: ElementType; style?: CSSProperties }) {
  return (
    <As className={cx("rp-panel", `rp-pad--${padding}`, className)} style={style}>
      {children}
    </As>
  );
}

export interface SectionProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  meta?: ReactNode;
}

export function Section({ title, actions, children, className, id, meta }: SectionProps) {
  const auto = useId();
  return (
    <section className={cx("rp-section", className)} aria-labelledby={title ? auto : undefined} id={id}>
      {(title || actions) && (
        <div className="rp-section__head">
          <div className="rp-row" style={{ ["--gap" as string]: "10px" }}>
            {title && <h2 id={auto}>{title}</h2>}
            {meta && <span className="rp-section__meta">{meta}</span>}
          </div>
          {actions && <div className="rp-section__actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export interface SplitProps {
  aside: ReactNode;
  children: ReactNode;
  asideWidth?: number;
  side?: "left" | "right";
  gap?: number;
  stackBelow?: number;
  className?: string;
  sticky?: boolean;
}

export function Split({ aside, children, asideWidth = 280, side = "left", gap = 24, className, sticky }: SplitProps) {
  return (
    <div
      className={cx("rp-split", `rp-split--${side}`, sticky && "rp-split--sticky", className)}
      style={{ ["--aside" as string]: `${asideWidth}px`, ["--gap" as string]: `${gap}px` }}
    >
      <div className="rp-split__aside">{aside}</div>
      <div className="rp-split__main">{children}</div>
    </div>
  );
}

export function Toolbar({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className={cx("rp-toolbar", className)} role={label ? "toolbar" : undefined} aria-label={label}>
      {children}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon = "box", title, children, action, compact, className }: EmptyStateProps) {
  return (
    <div className={cx("rp-empty", compact && "rp-empty--compact", className)}>
      <span className="rp-empty__icon" aria-hidden="true">
        <Icon name={icon} size={compact ? 16 : 20} />
      </span>
      <div className="rp-empty__title">{title}</div>
      {children && <div className="rp-empty__text">{children}</div>}
      {action && <div className="rp-empty__action">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  title: ReactNode;
  children?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  reference?: string;
  compact?: boolean;
  secondary?: ReactNode;
  className?: string;
}

export function ErrorState({ title, children, onRetry, retryLabel = "Retry", reference, compact, secondary, className }: ErrorStateProps) {
  return (
    <div className={cx("rp-empty", "rp-error", compact && "rp-empty--compact", className)} role="alert">
      <span className="rp-empty__icon" aria-hidden="true">
        <Icon name="alert-circle" size={compact ? 16 : 20} />
      </span>
      <div className="rp-empty__title">{title}</div>
      {children && <div className="rp-empty__text">{children}</div>}
      {(onRetry || secondary) && (
        <div className="rp-empty__action">
          {onRetry && (
            <Button size="sm" iconLeft="refresh" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {secondary}
        </div>
      )}
      {reference && <div className="rp-error__ref rp-mono">Ref {reference}</div>}
    </div>
  );
}

export interface PlanRequiredProps {
  title: ReactNode;
  plan: string;
  includes: string[];
  action: ReactNode;
  className?: string;
}

export function PlanRequired({ title, plan, includes, action, className }: PlanRequiredProps) {
  return (
    <div className={cx("rp-empty", "rp-planreq", className)}>
      <span className="rp-empty__icon" aria-hidden="true">
        <Icon name="lock" size={20} />
      </span>
      <div className="rp-empty__title">{title}</div>
      <div className="rp-planreq__list">
        <div className="rp-eyebrow">{plan} includes</div>
        <ul>
          {includes.map((i) => (
            <li key={i}>
              <Icon name="check" size={14} />
              {i}
            </li>
          ))}
        </ul>
      </div>
      <div className="rp-empty__action">{action}</div>
    </div>
  );
}

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  count?: number;
  to?: string;
  disabled?: boolean;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange?: (id: T) => void;
  label: string;
  className?: string;
  idPrefix?: string;
}

export function Tabs<T extends string>({ items, value, onChange, label, className, idPrefix = "tab" }: TabsProps<T>) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const asLinks = items.some((i) => i.to);

  if (asLinks) {
    return (
      <nav aria-label={label} className={cx("rp-tabs", className)}>
        {items.map((t) => (
          <UiLink key={t.id} to={t.to ?? "#"} className={cx("rp-tabs__item", t.id === value && "is-on")} aria-current={t.id === value ? "page" : undefined}>
            {t.label}
            {t.count !== undefined && <span className="rp-tabs__count rp-mono rp-num">{t.count}</span>}
          </UiLink>
        ))}
      </nav>
    );
  }

  function focusAt(i: number) {
    const n = items.length;
    const idx = (i + n) % n;
    refs.current[idx]?.focus();
    onChange?.(items[idx].id);
  }

  return (
    <div role="tablist" aria-label={label} className={cx("rp-tabs", className)}>
      {items.map((t, i) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => (refs.current[i] = el)}
            role="tab"
            type="button"
            id={`${idPrefix}-${t.id}`}
            aria-selected={on}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={on ? 0 : -1}
            disabled={t.disabled}
            className={cx("rp-tabs__item", on && "is-on")}
            onClick={() => onChange?.(t.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                focusAt(i + 1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                focusAt(i - 1);
              } else if (e.key === "Home") {
                e.preventDefault();
                focusAt(0);
              } else if (e.key === "End") {
                e.preventDefault();
                focusAt(items.length - 1);
              }
            }}
          >
            {t.label}
            {t.count !== undefined && <span className="rp-tabs__count rp-mono rp-num">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, idPrefix = "tab", children, className }: { id: string; idPrefix?: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-${id}`} className={cx("rp-view", className)} tabIndex={0}>
      {children}
    </div>
  );
}

export interface DisclosureProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  meta?: ReactNode;
}

export function Disclosure({ title, children, defaultOpen, className, meta }: DisclosureProps) {
  const [open, setOpen] = useState(!!defaultOpen);
  const id = useId();
  return (
    <div className={cx("rp-disclosure", open && "is-open", className)}>
      <button type="button" className="rp-disclosure__btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <Icon name="chevron-right" size={14} className="rp-disclosure__chev" />
        <span className="rp-disclosure__title">{title}</span>
        {meta && <span className="rp-disclosure__meta">{meta}</span>}
      </button>
      <div id={id} className="rp-disclosure__body" hidden={!open}>
        {children}
      </div>
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx("rp-divider", className)} />;
}

export function Page({ children, width = "reading", className }: { children: ReactNode; width?: "reading" | "full" | "narrow"; className?: string }) {
  return <div className={cx("rp-page", `rp-page--${width}`, "rp-view", className)}>{children}</div>;
}
