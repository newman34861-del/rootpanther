import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Icon } from "../icons";
import type { IconName } from "../icons";
import { cx } from "../format";
import { useEscape, useFocusTrap } from "../hooks";
import { Portal } from "./overlay";

export interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon?: IconName;
  hint?: string;
  keywords?: string[];
  kbd?: string;
  mono?: boolean;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  recentIds?: string[];
  onSelect: (item: CommandItem) => void;
  groupOrder?: string[];
  placeholder?: string;
}

interface Match {
  item: CommandItem;
  score: number;
  indices: number[];
}

export function fuzzyMatch(query: string, text: string): { score: number; indices: number[] } | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return { score: 0, indices: [] };
  const at = t.indexOf(q);
  if (at >= 0) {
    const wordStart = at === 0 || /[\s\-_./]/.test(t[at - 1]);
    return { score: 100 - at + (wordStart ? 40 : 0) + q.length * 2, indices: Array.from({ length: q.length }, (_, i) => at + i) };
  }
  const indices: number[] = [];
  let ti = 0;
  let score = 0;
  let prev = -2;
  for (const ch of q) {
    if (ch === " ") continue;
    const found = t.indexOf(ch, ti);
    if (found < 0) return null;
    score += found === prev + 1 ? 6 : 1;
    if (found === 0 || /[\s\-_./]/.test(t[found - 1])) score += 4;
    indices.push(found);
    prev = found;
    ti = found + 1;
  }
  return { score, indices };
}

function Highlight({ text, indices }: { text: string; indices: number[] }) {
  if (indices.length === 0) return <>{text}</>;
  const set = new Set(indices);
  const out: ReactNode[] = [];
  let buf = "";
  let on = false;
  for (let i = 0; i < text.length; i++) {
    const hit = set.has(i);
    if (hit !== on && buf) {
      out.push(on ? <mark key={i}>{buf}</mark> : <Fragment key={i}>{buf}</Fragment>);
      buf = "";
    }
    on = hit;
    buf += text[i];
  }
  if (buf) out.push(on ? <mark key="end">{buf}</mark> : <Fragment key="end">{buf}</Fragment>);
  return <>{out}</>;
}

export function CommandPalette({ open, onClose, items, recentIds = [], onSelect, groupOrder = [], placeholder = "Search scenarios, hosts, actions" }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  useFocusTrap(ref, open, inputRef);
  useEscape(open, onClose);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim();
    let matches: Match[];
    if (!q) {
      const recent = recentIds
        .map((id) => items.find((i) => i.id === id))
        .filter((i): i is CommandItem => !!i)
        .map((item) => ({ item: { ...item, group: "Recent" }, score: 0, indices: [] }));
      const rest = items.filter((i) => !recentIds.includes(i.id) && (i.group === "Actions" || i.group === "Navigation")).map((item) => ({ item, score: 0, indices: [] }));
      matches = [...recent, ...rest];
    } else {
      matches = items
        .map((item) => {
          const m = fuzzyMatch(q, item.label);
          const kw = item.keywords?.map((k) => fuzzyMatch(q, k)).filter(Boolean) as { score: number }[] | undefined;
          const kwScore = kw && kw.length ? Math.max(...kw.map((k) => k.score)) - 10 : -1;
          if (!m && kwScore < 0) return null;
          const recentBoost = recentIds.includes(item.id) ? 15 : 0;
          return { item, score: Math.max(m?.score ?? -1, kwScore) + recentBoost, indices: m?.indices ?? [] };
        })
        .filter((m): m is Match => !!m)
        .sort((a, b) => b.score - a.score)
        .slice(0, 40);
    }
    const order = ["Recent", ...groupOrder];
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const g = m.item.group;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(m);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (q && ia < 0 && ib < 0) return 0;
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    if (q) {
      keys.sort((a, b) => (map.get(b)![0].score ?? 0) - (map.get(a)![0].score ?? 0));
    }
    return keys.map((k) => ({ group: k, matches: map.get(k)! }));
  }, [query, items, recentIds, groupOrder]);

  const flat = useMemo(() => groups.flatMap((g) => g.matches), [groups]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function run(m: Match | undefined) {
    if (!m) return;
    onClose();
    onSelect(m.item);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (flat.length ? (a + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (flat.length ? (a - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(flat[active]);
    }
  }

  if (!open) return null;
  let idx = -1;
  return (
    <Portal>
      <div className="rp-scrim rp-scrim--palette" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
        <div ref={ref} className="rp-palette" role="dialog" aria-modal="true" aria-label="Command palette">
          <div className="rp-palette__search">
            <Icon name="search" size={17} />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
              aria-autocomplete="list"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              autoComplete="off"
            />
            <kbd>esc</kbd>
          </div>
          <div className="rp-palette__list" id={listId} role="listbox" aria-label="Results" ref={listRef}>
            {flat.length === 0 && (
              <div className="rp-palette__empty">
                No results for <span className="rp-mono">{query}</span>
              </div>
            )}
            {groups.map((g) => (
              <div key={g.group} role="group" aria-label={g.group} className="rp-palette__group">
                <div className="rp-palette__grouplabel" aria-hidden="true">
                  {g.group}
                </div>
                {g.matches.map((m) => {
                  idx += 1;
                  const i = idx;
                  return (
                    <div
                      key={`${g.group}-${m.item.id}`}
                      id={`${listId}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={i === active}
                      className={cx("rp-palette__opt", i === active && "is-active")}
                      onPointerMove={() => setActive(i)}
                      onClick={() => run(m)}
                    >
                      <Icon name={m.item.icon ?? "arrow-right"} size={15} />
                      <span className={cx("rp-palette__label", m.item.mono && "rp-mono")}>
                        <Highlight text={m.item.label} indices={m.indices} />
                      </span>
                      {m.item.hint && <span className="rp-palette__hint">{m.item.hint}</span>}
                      {m.item.kbd && <kbd>{m.item.kbd}</kbd>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="rp-palette__foot" aria-hidden="true">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> navigate
            </span>
            <span>
              <kbd>↵</kbd> open
            </span>
            <span>
              <kbd>esc</kbd> close
            </span>
          </div>
        </div>
      </div>
    </Portal>
  );
}
