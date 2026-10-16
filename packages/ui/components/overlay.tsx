import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../icons";
import type { IconName } from "../icons";
import { cx, toneInk } from "../format";
import type { Tone } from "../types";
import { useEscape, useFocusTrap, useOutsideClick } from "../hooks";
import { Button } from "./controls";
import { UiLink } from "./Link";

export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  initialFocus?: RefObject<HTMLElement>;
  dismissable?: boolean;
  icon?: IconName;
  tone?: Tone;
  className?: string;
  bodyClassName?: string;
}

export function Modal({ open, onClose, title, children, footer, size = "md", initialFocus, dismissable = true, icon, tone, className, bodyClassName }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open, initialFocus);
  useEscape(open && dismissable, onClose);
  useScrollLock(open);
  if (!open) return null;
  return (
    <Portal>
      <div className="rp-scrim" onPointerDown={(e) => dismissable && e.target === e.currentTarget && onClose()}>
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={cx("rp-modal", `rp-modal--${size}`, className)} tabIndex={-1}>
          <div className="rp-modal__head">
            {icon && (
              <span className="rp-modal__icon" style={{ color: toneInk(tone) }} aria-hidden="true">
                <Icon name={icon} size={18} />
              </span>
            )}
            <h2 id={titleId} className="rp-modal__title">
              {title}
            </h2>
            {dismissable && (
              <button type="button" className="rp-modal__close" aria-label="Close" onClick={onClose}>
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
          <div className={cx("rp-modal__body", bodyClassName)}>{children}</div>
          {footer && <div className="rp-modal__foot">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
  meta?: ReactNode;
}

export function Drawer({ open, onClose, title, children, footer, width = 480, meta }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open);
  useEscape(open, onClose);
  useScrollLock(open);
  if (!open) return null;
  return (
    <Portal>
      <div className="rp-scrim rp-scrim--drawer" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className="rp-drawer" style={{ width }} tabIndex={-1}>
          <div className="rp-modal__head">
            <div className="rp-drawer__titles">
              <h2 id={titleId} className="rp-modal__title">
                {title}
              </h2>
              {meta && <div className="rp-drawer__meta">{meta}</div>}
            </div>
            <button type="button" className="rp-modal__close" aria-label="Close" onClick={onClose}>
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="rp-drawer__body">{children}</div>
          {footer && <div className="rp-modal__foot">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

type Align = "start" | "end" | "center";

function useAnchoredPosition(open: boolean, anchor: RefObject<HTMLElement>, panel: RefObject<HTMLElement>, align: Align, side: "bottom" | "top" = "bottom") {
  const [style, setStyle] = useState<CSSProperties>({ top: -9999, left: -9999 });
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      if (!anchor.current || !panel.current) return;
      const a = anchor.current.getBoundingClientRect();
      const p = panel.current.getBoundingClientRect();
      const gap = 6;
      let top = side === "bottom" ? a.bottom + gap : a.top - gap - p.height;
      if (side === "bottom" && top + p.height > window.innerHeight - 8 && a.top - gap - p.height > 8) top = a.top - gap - p.height;
      let left = align === "start" ? a.left : align === "end" ? a.right - p.width : a.left + a.width / 2 - p.width / 2;
      left = Math.min(Math.max(8, left), window.innerWidth - p.width - 8);
      setStyle({ top, left, minWidth: align === "start" ? a.width : undefined });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, panel, align, side]);
  return style;
}

export interface TriggerProps {
  ref: RefObject<HTMLButtonElement>;
  onClick: () => void;
  "aria-expanded": boolean;
  "aria-haspopup": "menu" | "dialog";
  "aria-controls": string;
}

export interface PopoverProps {
  trigger: (props: TriggerProps) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: Align;
  width?: number;
  label?: string;
  className?: string;
}

export function Popover({ trigger, children, align = "start", width, label, className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [anchor, panel] as RefObject<HTMLElement>[], []);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(refs, open, close);
  useEscape(open, () => {
    close();
    anchor.current?.focus();
  });
  const style = useAnchoredPosition(open, anchor, panel, align);
  return (
    <>
      {trigger({ ref: anchor, onClick: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": "dialog", "aria-controls": id })}
      {open && (
        <Portal>
          <div ref={panel} id={id} role="dialog" aria-label={label} className={cx("rp-popover", className)} style={{ ...style, width }}>
            {typeof children === "function" ? children(close) : children}
          </div>
        </Portal>
      )}
    </>
  );
}

export interface MenuItem {
  id: string;
  label?: ReactNode;
  icon?: IconName;
  onSelect?: () => void;
  to?: string;
  external?: boolean;
  danger?: boolean;
  disabled?: boolean;
  kbd?: string;
  divider?: boolean;
  heading?: ReactNode;
  meta?: ReactNode;
}

export interface DropdownMenuProps {
  trigger: (props: TriggerProps) => ReactNode;
  items: MenuItem[];
  align?: Align;
  width?: number;
  label: string;
  header?: ReactNode;
}

export function DropdownMenu({ trigger, items, align = "end", width = 220, label, header }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [anchor, panel] as RefObject<HTMLElement>[], []);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(refs, open, close);
  useEscape(open, () => {
    close();
    anchor.current?.focus();
  });
  const style = useAnchoredPosition(open, anchor, panel, align);

  useEffect(() => {
    if (!open) return;
    const first = panel.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
    first?.focus();
  }, [open]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const list = Array.from(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === "Tab") {
      close();
    }
  }

  return (
    <>
      {trigger({ ref: anchor, onClick: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": "menu", "aria-controls": id })}
      {open && (
        <Portal>
          <div ref={panel} className="rp-popover rp-menu" style={{ ...style, width }} onKeyDown={onKeyDown}>
            {header}
            <div id={id} role="menu" aria-label={label}>
              {items.map((it) => {
                if (it.divider) return <div key={it.id} role="separator" className="rp-menu__sep" />;
                if (it.heading) return (
                  <div key={it.id} className="rp-menu__heading" role="presentation">
                    {it.heading}
                  </div>
                );
                const content = (
                  <>
                    {it.icon && <Icon name={it.icon} size={15} />}
                    <span className="rp-menu__label">{it.label}</span>
                    {it.meta && <span className="rp-menu__meta">{it.meta}</span>}
                    {it.kbd && <kbd>{it.kbd}</kbd>}
                    {it.external && <Icon name="external" size={13} className="rp-menu__ext" />}
                  </>
                );
                const cls = cx("rp-menu__item", it.danger && "is-danger");
                if (it.to) {
                  return (
                    <UiLink
                      key={it.id}
                      to={it.to}
                      role="menuitem"
                      tabIndex={-1}
                      className={cls}
                      target={it.external ? "_blank" : undefined}
                      rel={it.external ? "noopener noreferrer" : undefined}
                      aria-label={it.external && typeof it.label === "string" ? `${it.label} (opens in a new tab)` : undefined}
                      onClick={close}
                    >
                      {content}
                    </UiLink>
                  );
                }
                return (
                  <button
                    key={it.id}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    aria-disabled={it.disabled || undefined}
                    className={cls}
                    onClick={() => {
                      if (it.disabled) return;
                      close();
                      anchor.current?.focus();
                      it.onSelect?.();
                    }}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  requireText?: string;
  loading?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel, cancelLabel = "Cancel", destructive, requireText, loading }: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);
  const blocked = requireText ? typed.trim() !== requireText : false;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      icon={destructive ? "warning" : undefined}
      tone={destructive ? "crit" : undefined}
      initialFocus={requireText ? inputRef : cancelRef}
      footer={
        <>
          <Button ref={cancelRef} variant="quiet" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} disabled={blocked} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="rp-confirm">
        {children}
        {requireText && (
          <div className="rp-confirm__type">
            <label htmlFor={inputId} className="rp-field__label">
              Type <code className="rp-confirm__code">{requireText}</code> to confirm
            </label>
            <div className="rp-input rp-input--md">
              <input
                ref={inputRef}
                id={inputId}
                className="rp-input__el rp-mono"
                value={typed}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !blocked && !loading) onConfirm();
                }}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export interface ToastData {
  id: string;
  title: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastApi {
  push: (t: Omit<ToastData, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi>({ push: () => undefined, dismiss: () => undefined });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastData[]>([]);
  const dismiss = useCallback((id: string) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: Omit<ToastData, "id">) => {
      const id = Math.random().toString(36).slice(2);
      setItems((xs) => [...xs.slice(-3), { ...t, id }]);
      window.setTimeout(() => dismiss(id), t.duration ?? 5000);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ push, dismiss }), [push, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <Portal>
        <div className="rp-toasts" role="region" aria-label="Notifications" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className="rp-toast" style={{ "--tone": toneInk(t.tone ?? "neutral") } as CSSProperties} role="status">
              <span className="rp-toast__dot" aria-hidden="true" />
              <div className="rp-toast__body">
                <div className="rp-toast__title">{t.title}</div>
                {t.detail && <div className="rp-toast__detail">{t.detail}</div>}
              </div>
              {t.action && (
                <button
                  type="button"
                  className="rp-link rp-toast__action"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" className="rp-toast__close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      </Portal>
    </ToastContext.Provider>
  );
}
