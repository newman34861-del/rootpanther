import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Icon } from "../icons";
import { cx, formatNumber } from "../format";
import { Checkbox, IconButton } from "./controls";
import { Skeleton } from "./display";
import { EmptyState, ErrorState } from "./layout";
import { Popover } from "./overlay";

export type SortDir = "asc" | "desc";
export interface SortState {
  id: string;
  dir: SortDir;
}

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  width?: number;
  minWidth?: number;
  align?: "left" | "right" | "center";
  mono?: boolean;
  truncate?: boolean;
  titleValue?: (row: T) => string;
  hideable?: boolean;
  defaultHidden?: boolean;
  headerLabel?: string;
}

export interface DataTableProps<T> {
  caption: string;
  showCaption?: boolean;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sort?: SortState | null;
  defaultSort?: SortState;
  onSortChange?: (s: SortState) => void;
  selectable?: boolean;
  selected?: string[];
  onSelectionChange?: (ids: string[]) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (n: number) => void;
  loading?: boolean;
  error?: { title: string; detail?: string; onRetry?: () => void } | null;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  toolbar?: ReactNode;
  bulkActions?: (ids: string[]) => ReactNode;
  density?: "comfortable" | "compact";
  maxHeight?: number | string;
  columnControls?: boolean;
  className?: string;
  footerNote?: ReactNode;
  highlightKey?: string | null;
}

export function DataTable<T>({
  caption,
  showCaption,
  columns,
  rows,
  rowKey,
  sort: sortProp,
  defaultSort,
  onSortChange,
  selectable,
  selected = [],
  onSelectionChange,
  page: pageProp,
  pageSize,
  total,
  onPageChange,
  loading,
  error,
  empty,
  onRowClick,
  rowClassName,
  toolbar,
  bulkActions,
  density = "comfortable",
  maxHeight,
  columnControls = true,
  className,
  footerNote,
  highlightKey,
}: DataTableProps<T>) {
  const [innerSort, setInnerSort] = useState<SortState | null>(defaultSort ?? null);
  const sort = sortProp !== undefined ? sortProp : innerSort;
  const [innerPage, setInnerPage] = useState(1);
  const page = pageProp ?? innerPage;
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id)));
  const [widths, setWidths] = useState<Record<string, number>>({});
  const tableRef = useRef<HTMLTableElement>(null);

  const visible = columns.filter((c) => !hidden.has(c.id));
  const minTableWidth = visible.reduce((a, c) => a + (widths[c.id] ?? c.width ?? c.minWidth ?? 120), selectable ? 44 : 0);

  useEffect(() => {
    if (!highlightKey || !tableRef.current) return;
    const row = tableRef.current.querySelector<HTMLElement>(`tr[data-key="${CSS.escape(highlightKey)}"]`);
    row?.scrollIntoView({ block: "center" });
  }, [highlightKey]);
  const serverSide = !!onPageChange && total !== undefined;

  const sorted = useMemo(() => {
    if (!sort || onSortChange) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const r = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? r : -r;
    });
  }, [rows, sort, columns, onSortChange]);

  const count = serverSide ? total! : sorted.length;
  const pages = pageSize ? Math.max(1, Math.ceil(count / pageSize)) : 1;
  const shown = pageSize && !serverSide ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;

  useEffect(() => {
    if (!serverSide && page > pages) setInnerPage(1);
  }, [pages, page, serverSide]);

  function setPage(p: number) {
    if (onPageChange) onPageChange(p);
    else setInnerPage(p);
  }

  function toggleSort(c: Column<T>) {
    if (!c.sortValue && !onSortChange) return;
    const next: SortState = sort?.id === c.id ? { id: c.id, dir: sort.dir === "asc" ? "desc" : "asc" } : { id: c.id, dir: "desc" };
    if (onSortChange) onSortChange(next);
    else setInnerSort(next);
  }

  const shownIds = shown.map(rowKey);
  const allOn = shownIds.length > 0 && shownIds.every((id) => selected.includes(id));
  const someOn = shownIds.some((id) => selected.includes(id));

  function toggleAll() {
    if (!onSelectionChange) return;
    if (allOn) onSelectionChange(selected.filter((id) => !shownIds.includes(id)));
    else onSelectionChange(Array.from(new Set([...selected, ...shownIds])));
  }

  function toggleRow(id: string) {
    if (!onSelectionChange) return;
    onSelectionChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  function startResize(e: ReactPointerEvent, c: Column<T>) {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    const startX = e.clientX;
    const startW = th.getBoundingClientRect().width;
    const min = c.minWidth ?? 64;
    function move(ev: PointerEvent) {
      setWidths((w) => ({ ...w, [c.id]: Math.max(min, Math.round(startW + ev.clientX - startX)) }));
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("rp-resizing");
    }
    document.body.classList.add("rp-resizing");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function keyResize(e: ReactKeyboardEvent, c: Column<T>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const th = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    const cur = widths[c.id] ?? th.getBoundingClientRect().width;
    setWidths((w) => ({ ...w, [c.id]: Math.max(c.minWidth ?? 64, Math.round(cur + (e.key === "ArrowRight" ? 16 : -16))) }));
  }

  const hideable = columns.filter((c) => c.hideable !== false);
  const showToolbar = toolbar || (columnControls && hideable.length > 2) || (bulkActions && selected.length > 0);
  const colSpan = visible.length + (selectable ? 1 : 0);

  let body: ReactNode;
  if (error) {
    body = (
      <tr>
        <td colSpan={colSpan} className="rp-table__state">
          <ErrorState title={error.title} onRetry={error.onRetry} compact>
            {error.detail}
          </ErrorState>
        </td>
      </tr>
    );
  } else if (loading) {
    body = Array.from({ length: Math.min(pageSize ?? 6, 8) }, (_, i) => (
      <tr key={`sk-${i}`} aria-hidden="true">
        {selectable && (
          <td className="rp-table__check">
            <Skeleton width={14} height={14} />
          </td>
        )}
        {visible.map((c, j) => (
          <td key={c.id} style={{ textAlign: c.align }}>
            <Skeleton width={j === 0 ? "72%" : `${40 + ((i * 7 + j * 13) % 40)}%`} height={10} />
          </td>
        ))}
      </tr>
    ));
  } else if (shown.length === 0) {
    body = (
      <tr>
        <td colSpan={colSpan} className="rp-table__state">
          {empty ?? <EmptyState title="Nothing to show" compact />}
        </td>
      </tr>
    );
  } else {
    body = shown.map((row) => {
      const id = rowKey(row);
      const isSel = selected.includes(id);
      return (
        <tr
          key={id}
          data-key={id}
          className={cx(onRowClick && "is-clickable", isSel && "is-selected", highlightKey === id && "is-highlight", rowClassName?.(row))}
          onClick={
            onRowClick
              ? (e) => {
                  const t = e.target as HTMLElement;
                  if (t.closest("a,button,input,label")) return;
                  onRowClick(row);
                }
              : undefined
          }
          aria-selected={selectable ? isSel : undefined}
        >
          {selectable && (
            <td className="rp-table__check">
              <Checkbox checked={isSel} onChange={() => toggleRow(id)} aria-label="Select row" />
            </td>
          )}
          {visible.map((c) => {
            const content = c.cell(row);
            const title = c.titleValue ? c.titleValue(row) : c.truncate && typeof content === "string" ? content : undefined;
            return (
              <td key={c.id} className={cx(c.mono && "rp-mono rp-num", c.align && `is-${c.align}`)} title={title}>
                {c.truncate ? <div className="rp-truncate">{content}</div> : content}
              </td>
            );
          })}
        </tr>
      );
    });
  }

  const from = count === 0 ? 0 : (page - 1) * (pageSize ?? count) + 1;
  const to = pageSize ? Math.min(page * pageSize, count) : count;

  return (
    <div className={cx("rp-table-wrap", `rp-table--${density}`, className)}>
      {showToolbar && (
        <div className="rp-table__toolbar">
          {bulkActions && selected.length > 0 ? (
            <div className="rp-table__bulk" role="status">
              <span className="rp-mono rp-num">{selected.length} selected</span>
              {bulkActions(selected)}
              <button type="button" className="rp-link" onClick={() => onSelectionChange?.([])}>
                Clear
              </button>
            </div>
          ) : (
            <div className="rp-table__toolbar-main">{toolbar}</div>
          )}
          {columnControls && hideable.length > 2 && (
            <Popover
              align="end"
              width={220}
              label="Columns"
              trigger={(p) => <IconButton {...p} icon="columns" label="Columns" variant="secondary" size="sm" />}
            >
              <div className="rp-colvis">
                <div className="rp-eyebrow">Columns</div>
                {hideable.map((c) => (
                  <Checkbox
                    key={c.id}
                    label={c.headerLabel ?? (typeof c.header === "string" ? c.header : c.id)}
                    checked={!hidden.has(c.id)}
                    disabled={!hidden.has(c.id) && visible.length <= 1}
                    onChange={() =>
                      setHidden((h) => {
                        const n = new Set(h);
                        if (n.has(c.id)) n.delete(c.id);
                        else n.add(c.id);
                        return n;
                      })
                    }
                  />
                ))}
              </div>
            </Popover>
          )}
        </div>
      )}
      <div className="rp-table__scroll" style={{ maxHeight }} tabIndex={maxHeight ? 0 : undefined} role={maxHeight ? "region" : undefined} aria-label={maxHeight ? caption : undefined}>
        <table ref={tableRef} className="rp-table" aria-busy={loading || undefined} style={{ minWidth: minTableWidth }}>
          <caption className={showCaption ? "rp-table__caption" : "rp-sr"}>{caption}</caption>
          <colgroup>
            {selectable && <col style={{ width: 44 }} />}
            {visible.map((c) => (
              <col key={c.id} style={{ width: widths[c.id] ?? c.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className="rp-table__check">
                  <Checkbox checked={allOn} indeterminate={!allOn && someOn} onChange={toggleAll} aria-label="Select all rows on this page" />
                </th>
              )}
              {visible.map((c) => {
                const sortable = !!c.sortValue || !!onSortChange;
                const isSorted = sort?.id === c.id;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={isSorted ? (sort!.dir === "asc" ? "ascending" : "descending") : sortable ? "none" : undefined}
                    className={cx(c.align && `is-${c.align}`)}
                    style={{ minWidth: c.minWidth } as CSSProperties}
                  >
                    {sortable ? (
                      <button type="button" className={cx("rp-table__sort", isSorted && "is-sorted")} onClick={() => toggleSort(c)}>
                        <span>{c.header}</span>
                        <Icon name={isSorted ? (sort!.dir === "asc" ? "arrow-up" : "arrow-down") : "sort"} size={12} />
                      </button>
                    ) : (
                      <span className="rp-table__th">{c.header}</span>
                    )}
                    <span
                      className="rp-table__resize"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${c.headerLabel ?? (typeof c.header === "string" ? c.header : c.id)} column`}
                      tabIndex={0}
                      onPointerDown={(e) => startResize(e, c)}
                      onKeyDown={(e) => keyResize(e, c)}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>
      {(footerNote || (pageSize && count > 0)) && !error && (
        <div className="rp-table__foot">
          <span className="rp-num">{footerNote ?? (loading ? "Loading" : `${formatNumber(from)} to ${formatNumber(to)} of ${formatNumber(count)}`)}</span>
          {pageSize && pages > 1 && (
            <div className="rp-table__pager">
              <IconButton icon="chevron-left" label="Previous page" size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} />
              <span className="rp-mono rp-num" aria-live="polite">
                {page} / {pages}
              </span>
              <IconButton icon="chevron-right" label="Next page" size="sm" variant="secondary" disabled={page >= pages || loading} onClick={() => setPage(page + 1)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
