import { useCallback, useEffect, useRef, useState } from "react";
import type { HelpLevel, OnyxCommand, OnyxMessageData } from "@rootpanther/ui";
import { helpLabel } from "@rootpanther/ui";
import type { ChatContext, ChatReply, ChatRequest } from "../../mock/onyx";
import { COMMAND_PROMPT } from "../../mock/onyx";

let seq = 0;
function uid(p: string): string {
  seq += 1;
  return `${p}-${Date.now().toString(36)}-${seq}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export interface UseOnyxChatOptions {
  initialMessages: OnyxMessageData[];
  initialLevel: HelpLevel;
  initialCtx: ChatContext;
  respond: (req: ChatRequest) => ChatReply;
  onNote?: () => void;
}

export interface OnyxChat {
  messages: OnyxMessageData[];
  level: HelpLevel;
  busy: boolean;
  setLevel: (l: HelpLevel) => void;
  send: (text: string) => void;
  runCommand: (c: OnyxCommand) => void;
}

const CHUNK = 3;
const TICK = 42;
const LEAD = 220;

export function useOnyxChat({ initialMessages, initialLevel, initialCtx, respond, onNote }: UseOnyxChatOptions): OnyxChat {
  const [messages, setMessages] = useState<OnyxMessageData[]>(initialMessages);
  const [level, setLevelState] = useState<HelpLevel>(initialLevel);
  const [busy, setBusy] = useState(false);

  const levelRef = useRef(initialLevel);
  const ctxRef = useRef<ChatContext>(initialCtx);
  const busyRef = useRef(false);
  const interval = useRef<number>();
  const lead = useRef<number>();

  const setBusyBoth = useCallback((v: boolean) => {
    busyRef.current = v;
    setBusy(v);
  }, []);

  useEffect(
    () => () => {
      window.clearInterval(interval.current);
      window.clearTimeout(lead.current);
    },
    [],
  );

  const stream = useCallback(
    (reply: ChatReply) => {
      const id = uid("onyx");
      const words = reply.text.split(" ");
      let i = 0;
      setMessages((m) => [...m, { id, role: "onyx", text: "", at: nowIso(), streaming: true, hintStep: reply.hintStep }]);
      window.clearInterval(interval.current);
      interval.current = window.setInterval(() => {
        i += CHUNK;
        const done = i >= words.length;
        const partial = done ? reply.text : words.slice(0, i).join(" ");
        setMessages((m) => m.map((x) => (x.id === id ? { ...x, text: partial, streaming: !done, code: done ? reply.code : undefined } : x)));
        if (done) {
          window.clearInterval(interval.current);
          if (reply.ctx) ctxRef.current = { ...ctxRef.current, ...reply.ctx };
          setBusyBoth(false);
        }
      }, TICK);
    },
    [setBusyBoth],
  );

  const dispatch = useCallback(
    (reply: ChatReply) => {
      setBusyBoth(true);
      window.clearTimeout(lead.current);
      lead.current = window.setTimeout(() => stream(reply), LEAD);
    },
    [setBusyBoth, stream],
  );

  const send = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t || busyRef.current || levelRef.current === "exam-sim") return;
      setMessages((m) => [...m, { id: uid("you"), role: "you", text: t, at: nowIso() }]);
      dispatch(respond({ text: t, level: levelRef.current, ctx: ctxRef.current }));
    },
    [dispatch, respond],
  );

  const runCommand = useCallback(
    (c: OnyxCommand) => {
      if (busyRef.current || levelRef.current === "exam-sim") return;
      if (c === "note" && onNote) {
        onNote();
        return;
      }
      setMessages((m) => [...m, { id: uid("you"), role: "you", text: COMMAND_PROMPT[c], command: c, at: nowIso() }]);
      dispatch(respond({ text: COMMAND_PROMPT[c], command: c, level: levelRef.current, ctx: ctxRef.current }));
    },
    [dispatch, onNote, respond],
  );

  const setLevel = useCallback((l: HelpLevel) => {
    if (l === levelRef.current) return;
    levelRef.current = l;
    setLevelState(l);
    setMessages((m) => [...m, { id: uid("sys"), role: "system", text: `Help level changed to ${helpLabel(l)}`, at: nowIso() }]);
  }, []);

  return { messages, level, busy, setLevel, send, runCommand };
}
