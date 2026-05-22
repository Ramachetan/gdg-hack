import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChatMessage,
  ConnectionState,
  ConsoleEntry,
} from "@/lib/types";
import { base64ToArrayBuffer } from "@/lib/base64";
import { shortId, userId, sessionId } from "@/lib/id";

type Options = {
  proactivity: boolean;
  affectiveDialog: boolean;
  onAudioChunk: (pcm: ArrayBuffer) => void;
  onInterrupted: () => void;
};

function cleanCJKSpaces(text: string): string {
  const cjk = /[　-〿぀-ゟ゠-ヿ一-龯＀-￯]/;
  return text.replace(/(\S)\s+(?=\S)/g, (match, c1) => {
    const next = text.match(new RegExp(c1 + "\\s+(.)", "g"));
    if (next && next.length > 0) {
      const c2 = next[0].slice(-1);
      if (cjk.test(c1) && cjk.test(c2)) return c1;
    }
    return match;
  });
}

function sanitizeForConsole(event: any): any {
  const out = JSON.parse(JSON.stringify(event));
  if (out?.content?.parts) {
    out.content.parts = out.content.parts.map((part: any) => {
      if (part.inlineData?.data) {
        const bytes = Math.floor(part.inlineData.data.length * 0.75);
        return {
          ...part,
          inlineData: { ...part.inlineData, data: `(${bytes.toLocaleString()} bytes)` },
        };
      }
      return part;
    });
  }
  return out;
}

export type OttoSocket = {
  connection: ConnectionState;
  messages: ChatMessage[];
  console: ConsoleEntry[];
  sendText: (text: string) => void;
  sendPcm: (pcm: ArrayBuffer) => void;
  sendImage: (base64: string) => void;
  clearConsole: () => void;
  isReady: () => boolean;
  resetSession: () => void;
};

export function useOttoSocket(opts: Options): OttoSocket {
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>(sessionId);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [consoleLog, setConsoleLog] = useState<ConsoleEntry[]>([]);

  // Turn-state — refs so the onmessage handler reads current values
  const currentMsgId = useRef<string | null>(null);
  const currentOutputId = useRef<string | null>(null);
  const currentInputId = useRef<string | null>(null);
  const inputFinished = useRef(false);
  const hasOutputTranscriptionInTurn = useRef(false);

  // Keep latest props in refs to avoid reconnect on every render
  const propsRef = useRef(opts);
  propsRef.current = opts;

  const pushConsole = useCallback((entry: Omit<ConsoleEntry, "id" | "ts">) => {
    setConsoleLog((prev) => [
      ...prev.slice(-499),
      { ...entry, id: shortId(), ts: Date.now() },
    ]);
  }, []);

  const pushMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateMessage = useCallback(
    (id: string, updater: (m: ChatMessage) => ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
    },
    [],
  );

  const appendOrCreateText = useCallback(
    (role: "user" | "agent", id: string | null, text: string, partial: boolean) => {
      if (id == null) {
        const newId = shortId();
        pushMessage({
          id: newId,
          role,
          kind: "text",
          text,
          partial,
          ts: Date.now(),
        });
        return newId;
      }
      updateMessage(id, (m) => {
        if (m.kind !== "text") return m;
        return { ...m, text: (m.text || "") + text, partial };
      });
      return id;
    },
    [pushMessage, updateMessage],
  );

  const replaceText = useCallback(
    (id: string, text: string, partial: boolean) => {
      updateMessage(id, (m) => {
        if (m.kind !== "text") return m;
        return { ...m, text, partial };
      });
    },
    [updateMessage],
  );

  const markPartialDone = useCallback(
    (id: string, interrupted = false) => {
      updateMessage(id, (m) => ({ ...m, partial: false, interrupted }));
    },
    [updateMessage],
  );

  const sendText = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    pushMessage({
      id: shortId(),
      role: "user",
      kind: "text",
      text,
      ts: Date.now(),
    });
    ws.send(JSON.stringify({ type: "text", text }));
    pushConsole({
      direction: "outgoing",
      emoji: "💬",
      author: "user",
      summary: `User Message: ${text}`,
    });
  }, [pushMessage, pushConsole]);

  const sendPcm = useCallback((pcm: ArrayBuffer) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(pcm);
  }, []);

  // Drop frames if the WS uplink is congested. At 1 fps, missing one frame
  // is invisible — letting them queue would add seconds of stale video.
  const IMAGE_BACKPRESSURE_BYTES = 256 * 1024;
  const sendImage = useCallback((base64: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > IMAGE_BACKPRESSURE_BYTES) return;
    ws.send(JSON.stringify({ type: "image", data: base64, mimeType: "image/jpeg" }));
  }, []);

  const isReady = useCallback(() => {
    return wsRef.current?.readyState === WebSocket.OPEN;
  }, []);

  const clearConsole = useCallback(() => setConsoleLog([]), []);

  const resetSession = useCallback(() => {
    sessionIdRef.current = shortId("demo-session");
    // Reset turn-state refs so we don't leak partial-bubble state across sessions.
    currentMsgId.current = null;
    currentOutputId.current = null;
    currentInputId.current = null;
    inputFinished.current = false;
    hasOutputTranscriptionInTurn.current = false;
    setMessages([]);
    pushConsole({
      direction: "outgoing",
      emoji: "🔄",
      author: "system",
      summary: "New session started",
      data: { sessionId: sessionIdRef.current },
    });
    // Closing the socket triggers ws.onclose → auto-reconnect with the new sessionId.
    wsRef.current?.close();
  }, [pushConsole]);

  // --- WebSocket connection ---
  useEffect(() => {
    let closedByEffect = false;
    let retryTimer: number | null = null;
    let retryAttempt = 0;

    function nextRetryDelayMs(): number {
      // Exponential backoff with jitter, capped at 30s. Prevents hammering
      // the server during an outage.
      const base = Math.min(30000, 1000 * Math.pow(2, retryAttempt));
      const jitter = Math.random() * 0.3 * base;
      retryAttempt += 1;
      return base + jitter;
    }

    function connect() {
      const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const base = `${wsProto}//${window.location.host}/ws/${userId}/${sessionIdRef.current}`;
      const params = new URLSearchParams();
      if (propsRef.current.proactivity) params.append("proactivity", "true");
      if (propsRef.current.affectiveDialog) params.append("affective_dialog", "true");
      const url = params.toString() ? `${base}?${params}` : base;

      const ws = new WebSocket(url);
      wsRef.current = ws;
      setConnection("connecting");

      ws.onopen = () => {
        setConnection("connected");
        retryAttempt = 0;
        pushConsole({
          direction: "incoming",
          emoji: "🔌",
          author: "system",
          summary: "WebSocket Connected",
          data: { userId, sessionId: sessionIdRef.current, url },
        });
      };

      ws.onmessage = (event) => {
        let evt: any;
        try { evt = JSON.parse(event.data); } catch { return; }

        let summary = "Event";
        let emoji = "📨";
        const author = evt.author || "system";

        // ---- Top-level event types
        if (evt.turnComplete) {
          summary = "Turn Complete"; emoji = "✅";
          if (currentMsgId.current) markPartialDone(currentMsgId.current);
          if (currentOutputId.current) markPartialDone(currentOutputId.current);
          currentMsgId.current = null;
          currentOutputId.current = null;
          inputFinished.current = false;
          hasOutputTranscriptionInTurn.current = false;
          pushConsole({ direction: "incoming", emoji, author, summary, data: sanitizeForConsole(evt) });
          return;
        }

        if (evt.interrupted) {
          summary = "Interrupted"; emoji = "⏸️";
          propsRef.current.onInterrupted();
          if (currentMsgId.current) markPartialDone(currentMsgId.current, true);
          if (currentOutputId.current) markPartialDone(currentOutputId.current, true);
          currentMsgId.current = null;
          currentOutputId.current = null;
          inputFinished.current = false;
          hasOutputTranscriptionInTurn.current = false;
          pushConsole({ direction: "incoming", emoji, author, summary, data: sanitizeForConsole(evt) });
          return;
        }

        if (evt.inputTranscription?.text) {
          const text = evt.inputTranscription.text as string;
          const finished = !!evt.inputTranscription.finished;
          if (!inputFinished.current && text) {
            if (currentInputId.current == null) {
              currentInputId.current = shortId();
              pushMessage({
                id: currentInputId.current,
                role: "user",
                kind: "text",
                text: cleanCJKSpaces(text),
                partial: !finished,
                ts: Date.now(),
              });
            } else if (currentOutputId.current == null && currentMsgId.current == null) {
              const id = currentInputId.current;
              if (finished) replaceText(id, cleanCJKSpaces(text), false);
              else {
                // append to existing
                setMessages((prev) => prev.map((m) => {
                  if (m.id !== id || m.kind !== "text") return m;
                  return { ...m, text: cleanCJKSpaces((m.text || "") + text), partial: true };
                }));
              }
            }
            if (finished) {
              currentInputId.current = null;
              inputFinished.current = true;
            }
          }
          summary = `Input: "${text.slice(0, 60)}${text.length > 60 ? "..." : ""}"`;
          emoji = "📝";
          pushConsole({ direction: "incoming", emoji, author, summary, data: sanitizeForConsole(evt) });
          return;
        }

        if (evt.outputTranscription?.text) {
          const text = evt.outputTranscription.text as string;
          const finished = !!evt.outputTranscription.finished;
          hasOutputTranscriptionInTurn.current = true;

          // Finalize input transcription
          if (currentInputId.current != null && currentOutputId.current == null) {
            const id = currentInputId.current;
            setMessages((prev) => prev.map((m) => m.id === id ? { ...m, partial: false } : m));
            currentInputId.current = null;
            inputFinished.current = true;
          }

          if (currentOutputId.current == null) {
            currentOutputId.current = shortId();
            pushMessage({
              id: currentOutputId.current,
              role: "agent",
              kind: "text",
              text,
              partial: !finished,
              ts: Date.now(),
            });
          } else {
            const id = currentOutputId.current;
            if (finished) replaceText(id, text, false);
            else {
              setMessages((prev) => prev.map((m) => {
                if (m.id !== id || m.kind !== "text") return m;
                return { ...m, text: (m.text || "") + text, partial: true };
              }));
            }
          }
          if (finished) currentOutputId.current = null;

          summary = `Output: "${text.slice(0, 60)}${text.length > 60 ? "..." : ""}"`;
          emoji = "📝";
          pushConsole({ direction: "incoming", emoji, author, summary, data: sanitizeForConsole(evt) });
          return;
        }

        if (evt.usageMetadata) {
          const u = evt.usageMetadata;
          summary = `Tokens: ${(u.totalTokenCount || 0).toLocaleString()}`;
          emoji = "📊";
          pushConsole({ direction: "incoming", emoji, author, summary, data: evt });
          return;
        }

        // Content events
        if (evt.content?.parts) {
          // Finalize input transcription if we're starting to get content
          if (
            currentInputId.current != null &&
            currentMsgId.current == null &&
            currentOutputId.current == null
          ) {
            const id = currentInputId.current;
            setMessages((prev) => prev.map((m) => m.id === id ? { ...m, partial: false } : m));
            currentInputId.current = null;
            inputFinished.current = true;
          }

          for (const part of evt.content.parts as any[]) {
            if (part.functionResponse) {
              const fname = part.functionResponse.name as string;
              const resp = part.functionResponse.response || {};
              pushConsole({
                direction: "incoming",
                emoji: "🛠️",
                author: "tool",
                summary: `Tool: ${fname}`,
                data: resp,
              });
              handleToolResponse(fname, resp);
              continue;
            }
            if (part.inlineData) {
              const mt = part.inlineData.mimeType as string | undefined;
              const data = part.inlineData.data as string | undefined;
              if (mt && mt.startsWith("audio/pcm") && data) {
                propsRef.current.onAudioChunk(base64ToArrayBuffer(data));
                const bytes = Math.floor(data.length * 0.75);
                pushConsole({
                  direction: "incoming",
                  emoji: "🔊",
                  author,
                  summary: `Audio: ${mt} (${bytes.toLocaleString()} bytes)`,
                  data: sanitizeForConsole(evt),
                  isAudio: true,
                });
              }
            }
            if (part.text) {
              if (part.thought) continue;
              if (!evt.partial && hasOutputTranscriptionInTurn.current) continue;
              currentMsgId.current = appendOrCreateText(
                "agent",
                currentMsgId.current,
                part.text,
                true,
              );
              summary = `Text: "${(part.text as string).slice(0, 60)}..."`;
              emoji = "💭";
            }
          }
          // Log non-audio event once at the bottom
          const isAudioOnly =
            (evt.content.parts as any[]).some((p) => p.inlineData) &&
            !(evt.content.parts as any[]).some((p) => p.text);
          if (!isAudioOnly) {
            pushConsole({
              direction: "incoming",
              emoji,
              author,
              summary,
              data: sanitizeForConsole(evt),
            });
          }
        }
      };

      ws.onclose = () => {
        setConnection("disconnected");
        if (!closedByEffect) {
          const delay = nextRetryDelayMs();
          pushConsole({
            direction: "error",
            emoji: "🔌",
            author: "system",
            summary: "WebSocket Disconnected",
            data: { status: "closed", reconnectInMs: Math.round(delay), attempt: retryAttempt },
          });
          retryTimer = window.setTimeout(connect, delay);
        } else {
          pushConsole({
            direction: "error",
            emoji: "🔌",
            author: "system",
            summary: "WebSocket Disconnected",
            data: { status: "closed" },
          });
        }
      };

      ws.onerror = () => {
        pushConsole({
          direction: "error",
          emoji: "⚠️",
          author: "system",
          summary: "WebSocket Error",
        });
      };
    }

    function handleToolResponse(fname: string, resp: any) {
      if (
        (fname === "annotate_frame" || fname === "point_at_parts") &&
        resp.status === "ok" &&
        resp.annotated_image_url
      ) {
        pushMessage({
          id: shortId(),
          role: "agent",
          kind: "image",
          url: resp.annotated_image_url,
          caption: resp.instruction || undefined,
          focusPart: resp.focus_part || undefined,
          ts: Date.now(),
        });
      } else if (fname === "find_repair_guide" && resp.status === "ok") {
        pushMessage({
          id: shortId(),
          role: "agent",
          kind: "guide",
          title: resp.title,
          url: resp.url,
          difficulty: resp.difficulty,
          timeRequired: resp.time_required,
          summary: resp.summary,
          stepsText: resp.steps_text,
          html: resp.html,
          ts: Date.now(),
        });
      }
    }

    connect();
    return () => {
      closedByEffect = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When proactivity / affective dialog changes, reconnect
  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      pushConsole({
        direction: "outgoing",
        emoji: "🔄",
        author: "system",
        summary: "Reconnecting due to settings change",
        data: {
          proactivity: opts.proactivity,
          affective_dialog: opts.affectiveDialog,
        },
      });
      ws.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.proactivity, opts.affectiveDialog]);

  return {
    connection,
    messages,
    console: consoleLog,
    sendText,
    sendPcm,
    sendImage,
    clearConsole,
    isReady,
    resetSession,
  };
}
