import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import type { ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import { Icon } from "../icons";
import { Button } from "../components/controls";
import { Spinner } from "../components/display";
import { cx } from "../format";

export type TerminalState = "connecting" | "connected" | "reconnecting" | "disconnected" | "ended";

export interface TerminalHandle {
  write: (data: string) => void;
  writeln: (line: string) => void;
  clear: () => void;
  focus: () => void;
  findNext: (term: string) => boolean;
  findPrevious: (term: string) => boolean;
  clearSearch: () => void;
  getSelection: () => string;
}

export interface TerminalPaneProps {
  state: TerminalState;
  fontSize?: number;
  onData?: (data: string) => void;
  onReady?: (handle: TerminalHandle) => void;
  reconnectAttempt?: number;
  maxAttempts?: number;
  onReconnect?: () => void;
  host?: string;
  className?: string;
  label?: string;
}

function readTheme(el: HTMLElement): ITheme {
  const cs = getComputedStyle(el);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    background: v("--term-bg"),
    foreground: v("--term-fg"),
    cursor: v("--term-cursor"),
    cursorAccent: v("--term-bg"),
    selectionBackground: v("--term-selection"),
    black: v("--bg-void"),
    brightBlack: v("--text-muted"),
    red: v("--crit"),
    brightRed: v("--crit"),
    green: v("--success"),
    brightGreen: v("--success"),
    yellow: v("--med"),
    brightYellow: v("--med"),
    blue: v("--info"),
    brightBlue: v("--primary"),
    magenta: v("--high"),
    brightMagenta: v("--high"),
    cyan: v("--primary"),
    brightCyan: v("--primary-hover"),
    white: v("--term-fg"),
    brightWhite: v("--on-solid"),
  };
}

export const TerminalPane = forwardRef<TerminalHandle, TerminalPaneProps>(function TerminalPane(
  { state, fontSize = 13, onData, onReady, reconnectAttempt = 1, maxAttempts = 5, onReconnect, host, className, label = "Terminal" },
  ref,
) {
  const host_ = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const fit = useRef<FitAddon | null>(null);
  const search = useRef<SearchAddon | null>(null);
  const dataCb = useRef(onData);
  dataCb.current = onData;

  const handle: TerminalHandle = {
    write: (d) => term.current?.write(d),
    writeln: (l) => term.current?.writeln(l),
    clear: () => term.current?.clear(),
    focus: () => term.current?.focus(),
    findNext: (t) => search.current?.findNext(t) ?? false,
    findPrevious: (t) => search.current?.findPrevious(t) ?? false,
    clearSearch: () => search.current?.clearDecorations(),
    getSelection: () => term.current?.getSelection() ?? "",
  };
  useImperativeHandle(ref, () => handle);

  useEffect(() => {
    if (!host_.current || !wrap.current) return;
    let disposed = false;
    let cleanup = () => undefined as void;
    const frame = window.requestAnimationFrame(() => {
      if (disposed || !host_.current || !wrap.current) return;
      const t = new Terminal({
        fontFamily: '"Geist Mono", ui-monospace, monospace',
        fontSize,
        lineHeight: 1.3,
        cursorBlink: false,
        cursorStyle: "block",
        allowProposedApi: true,
        scrollback: 5000,
        theme: readTheme(wrap.current),
        screenReaderMode: false,
      });
      const f = new FitAddon();
      const s = new SearchAddon();
      t.loadAddon(f);
      t.loadAddon(s);
      t.open(host_.current);
      term.current = t;
      fit.current = f;
      search.current = s;
      const safeFit = () => {
        if (disposed || !host_.current || host_.current.clientWidth === 0) return;
        try {
          f.fit();
        } catch {
          return;
        }
      };
      const sub = t.onData((d) => dataCb.current?.(d));
      const ro = new ResizeObserver(() => window.requestAnimationFrame(safeFit));
      ro.observe(host_.current);
      const mo = new MutationObserver(() => {
        if (wrap.current) t.options.theme = readTheme(wrap.current);
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      document.fonts?.ready.then(() => window.requestAnimationFrame(safeFit));
      onReady?.(handle);
      cleanup = () => {
        sub.dispose();
        ro.disconnect();
        mo.disconnect();
        t.dispose();
        term.current = null;
      };
    });
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!term.current) return;
    term.current.options.fontSize = fontSize;
    try {
      fit.current?.fit();
    } catch {
      return;
    }
  }, [fontSize]);

  const blocked = state !== "connected";

  return (
    <div ref={wrap} className={cx("rp-term", `is-${state}`, className)} aria-label={label} role="region">
      <div ref={host_} className="rp-term__host" aria-hidden={blocked || undefined} />
      {blocked && (
        <div className="rp-term__overlay" role="status" aria-live="polite">
          {state === "connecting" && (
            <>
              <Spinner size={18} />
              <div className="rp-term__otitle">Connecting to {host ?? "the attack box"}</div>
              <div className="rp-term__otext">Opening a shell over the lab tunnel.</div>
            </>
          )}
          {state === "reconnecting" && (
            <>
              <Spinner size={18} />
              <div className="rp-term__otitle">Connection dropped. Reconnecting</div>
              <div className="rp-term__otext rp-mono rp-num">
                Attempt {reconnectAttempt} of {maxAttempts}. Your lab machines are still running.
              </div>
              {onReconnect && (
                <Button size="sm" onClick={onReconnect} iconLeft="refresh">
                  Reconnect now
                </Button>
              )}
            </>
          )}
          {state === "disconnected" && (
            <>
              <Icon name="wifi-off" size={20} />
              <div className="rp-term__otitle">Terminal disconnected</div>
              <div className="rp-term__otext">Automatic reconnect stopped after {maxAttempts} attempts. The lab is still running.</div>
              {onReconnect && (
                <Button size="sm" onClick={onReconnect} iconLeft="refresh">
                  Reconnect
                </Button>
              )}
            </>
          )}
          {state === "ended" && (
            <>
              <Icon name="power" size={20} />
              <div className="rp-term__otitle">Session ended</div>
              <div className="rp-term__otext">The lab machines have been destroyed.</div>
            </>
          )}
        </div>
      )}
    </div>
  );
});
