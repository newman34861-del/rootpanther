import { useCallback, useEffect, useRef } from "react";
import { TerminalPane } from "@rootpanther/ui/terminal";
import type { TerminalHandle, TerminalState } from "@rootpanther/ui/terminal";
import { connectBanner, runCommand } from "../../mock/lab";
import type { TerminalResult } from "../../mock/lab";

const PROMPT = "kali@rp-attack:~$ ";

export interface LabTerminalHandle {
  findNext: (term: string) => boolean;
  findPrevious: (term: string) => boolean;
  clearSearch: () => void;
  focus: () => void;
}

interface LabTerminalProps {
  state: TerminalState;
  fontSize: number;
  active: boolean;
  onReconnect?: () => void;
  reconnectAttempt?: number;
  onResult: (line: string, result: TerminalResult) => void;
  termRef: (h: LabTerminalHandle | null) => void;
}

export function LabTerminal({ state, fontSize, active, onReconnect, reconnectAttempt, onResult, termRef }: LabTerminalProps) {
  const handle = useRef<TerminalHandle | null>(null);
  const buffer = useRef("");
  const greeted = useRef(false);
  const resultCb = useRef(onResult);
  resultCb.current = onResult;

  const prompt = useCallback(() => handle.current?.write(`\r\n${PROMPT}`), []);

  const stateRef = useRef(state);
  stateRef.current = state;

  const greet = useCallback(() => {
    if (greeted.current || !handle.current || stateRef.current !== "connected") return;
    greeted.current = true;
    handle.current.write(connectBanner());
    handle.current.write(`\r\n${PROMPT}`);
  }, []);

  const onReady = useCallback(
    (h: TerminalHandle) => {
      handle.current = h;
      termRef({
        findNext: (t) => h.findNext(t),
        findPrevious: (t) => h.findPrevious(t),
        clearSearch: () => h.clearSearch(),
        focus: () => h.focus(),
      });
      window.requestAnimationFrame(greet);
    },
    [greet, termRef],
  );

  useEffect(() => {
    if (state === "connected") window.requestAnimationFrame(greet);
  }, [state, greet]);

  useEffect(() => {
    if (active && state === "connected") handle.current?.focus();
  }, [active, state]);

  const onData = useCallback(
    (data: string) => {
      const h = handle.current;
      if (!h || state !== "connected") return;
      for (const ch of data) {
        const code = ch.charCodeAt(0);
        if (ch === "\r") {
          const line = buffer.current;
          buffer.current = "";
          if (!line.trim()) {
            prompt();
            continue;
          }
          const result = runCommand(line);
          if (result.output === "\u0000clear") {
            h.clear();
            h.write(PROMPT);
            continue;
          }
          h.write("\r\n");
          if (result.output) h.write(result.output.replace(/\n/g, "\r\n"));
          resultCb.current(line, result);
          h.write(`\r\n${PROMPT}`);
        } else if (code === 127 || code === 8) {
          if (buffer.current.length > 0) {
            buffer.current = buffer.current.slice(0, -1);
            h.write("\b \b");
          }
        } else if (code === 3) {
          buffer.current = "";
          h.write("^C");
          h.write(`\r\n${PROMPT}`);
        } else if (code >= 32) {
          buffer.current += ch;
          h.write(ch);
        }
      }
    },
    [prompt, state],
  );

  return (
    <TerminalPane
      state={state}
      fontSize={fontSize}
      onData={onData}
      onReady={onReady}
      onReconnect={onReconnect}
      reconnectAttempt={reconnectAttempt}
      host="rp-attack (10.13.37.6)"
      label="Lab terminal, kali attack box"
    />
  );
}
