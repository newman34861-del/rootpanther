import { cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  side?: "top" | "bottom" | "right";
  delay?: number;
  disabled?: boolean;
}

export function Tooltip({ content, children, side = "bottom", delay = 350, disabled }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; side: string } | null>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();

  const show = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), delay);
  }, [delay]);
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, hide]);

  useLayoutEffect(() => {
    if (!open || !anchor.current || !tip.current) return;
    const a = anchor.current.getBoundingClientRect();
    const t = tip.current.getBoundingClientRect();
    const gap = 8;
    let s = side;
    if (s === "bottom" && a.bottom + gap + t.height > window.innerHeight) s = "top";
    if (s === "top" && a.top - gap - t.height < 0) s = "bottom";
    if (s === "right") {
      setPos({ top: a.top + a.height / 2 - t.height / 2, left: a.right + gap, side: s });
      return;
    }
    const left = Math.min(Math.max(8, a.left + a.width / 2 - t.width / 2), window.innerWidth - t.width - 8);
    const top = s === "top" ? a.top - gap - t.height : a.bottom + gap;
    setPos({ top, left, side: s });
  }, [open, side, content]);

  if (!isValidElement(children) || disabled || !content) return children;

  const child = children as ReactElement<Record<string, unknown>>;
  const props = child.props as Record<string, (...a: unknown[]) => void>;
  const trigger = cloneElement(child, {
    ref: (el: HTMLElement | null) => {
      anchor.current = el;
      const r = (child as unknown as { ref?: unknown }).ref;
      if (typeof r === "function") r(el);
      else if (r && typeof r === "object") (r as { current: unknown }).current = el;
    },
    "aria-describedby": open ? id : undefined,
    onPointerEnter: (e: unknown) => {
      props.onPointerEnter?.(e);
      show();
    },
    onPointerLeave: (e: unknown) => {
      props.onPointerLeave?.(e);
      hide();
    },
    onFocus: (e: unknown) => {
      props.onFocus?.(e);
      show();
    },
    onBlur: (e: unknown) => {
      props.onBlur?.(e);
      hide();
    },
    onPointerDown: (e: unknown) => {
      props.onPointerDown?.(e);
      hide();
    },
  });

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            ref={tip}
            id={id}
            role="tooltip"
            className="rp-tooltip"
            data-side={pos?.side}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
