import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Theme, ThemePreference } from "../types";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("inert") && el.getClientRects().length > 0,
  );
}

export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean, initialFocus?: RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const target = initialFocus?.current ?? getFocusable(root)[0] ?? root;
    target.focus({ preventScroll: true });

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = getFocusable(root);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [active, ref, initialFocus]);
}

export function useEscape(active: boolean, onEscape: () => void) {
  const cb = useRef(onEscape);
  cb.current = onEscape;
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        cb.current();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);
}

export function useOutsideClick(refs: RefObject<HTMLElement>[], active: boolean, onOutside: () => void) {
  const cb = useRef(onOutside);
  cb.current = onOutside;
  useEffect(() => {
    if (!active) return;
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (refs.some((r) => r.current?.contains(t))) return;
      cb.current();
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active, refs]);
}

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

export function useStoredState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => readStorage(key, initial));
  const set = useCallback(
    (v: T) => {
      setValue(v);
      writeStorage(key, v);
    },
    [key],
  );
  return [value, set];
}

function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme: Theme) {
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
}

export function useTheme(storageKey = "rp-theme") {
  const [preference, setPreference] = useStoredState<ThemePreference>(storageKey, "dark");
  const [system, setSystem] = useState<Theme>(() => systemTheme());
  const resolved: Theme = preference === "system" ? system : preference;

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!mq) return;
    const onChange = () => setSystem(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useLayoutEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const toggle = useCallback(() => setPreference(resolved === "dark" ? "light" : "dark"), [resolved, setPreference]);
  return { preference, resolved, setPreference, toggle };
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = () => setMatch(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return match;
}

export function useInterval(cb: () => void, ms: number | null) {
  const saved = useRef(cb);
  saved.current = cb;
  useEffect(() => {
    if (ms === null) return;
    const id = window.setInterval(() => saved.current(), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

export function useCopy(timeout = 1600): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(
    (text: string) => {
      const done = () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), timeout);
      };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, done);
      else done();
    },
    [timeout],
  );
  return [copied, copy];
}

export function useHotkey(combo: { key: string; meta?: boolean; shift?: boolean }, handler: (e: KeyboardEvent) => void, enabled = true) {
  const cb = useRef(handler);
  cb.current = handler;
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      const metaOk = combo.meta ? e.metaKey || e.ctrlKey : !(e.metaKey || e.ctrlKey);
      const shiftOk = combo.shift ? e.shiftKey : true;
      if (e.key.toLowerCase() === combo.key.toLowerCase() && metaOk && shiftOk) cb.current(e);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [combo.key, combo.meta, combo.shift, enabled]);
}

export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || !!el.closest(".xterm");
}
