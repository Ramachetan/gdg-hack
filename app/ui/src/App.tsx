import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";

import { useOttoSocket } from "@/hooks/useOttoSocket";
import { useAudio } from "@/hooks/useAudio";
import { useCamera } from "@/hooks/useCamera";

import { TopBar } from "@/components/otto/TopBar";
import { CameraStage } from "@/components/otto/CameraStage";
import { ConsoleDrawer } from "@/components/otto/ConsoleDrawer";
import { Lobby } from "@/components/otto/Lobby";
import { OttoOrb, type OttoState } from "@/components/otto/OttoOrb";
import { StatusPill } from "@/components/otto/StatusPill";
import { CallControls } from "@/components/otto/CallControls";
import { TextInputBar } from "@/components/otto/TextInputBar";
import { TranscriptDrawerContent, TranscriptHandle } from "@/components/otto/TranscriptDrawer";
import { Drawer } from "@/components/ui/drawer";
import { useTheme } from "@/lib/theme";
import { Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImageMessage } from "@/lib/types";

const SPOTLIGHT_MS = 6000;

type Phase = "lobby" | "in-call";

export default function App() {
  const [proactivity, setProactivity] = useState(false);
  const [affectiveDialog, setAffectiveDialog] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [starting, setStarting] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [theme, setTheme] = useTheme();

  const audioRef = useRef<{ playPcm: (b: ArrayBuffer) => void; endOfAudio: () => void } | null>(null);

  const sock = useOttoSocket({
    proactivity,
    affectiveDialog,
    onAudioChunk: (pcm) => audioRef.current?.playPcm(pcm),
    onInterrupted: () => audioRef.current?.endOfAudio(),
  });

  const audio = useAudio((pcm) => sock.sendPcm(pcm));
  audioRef.current = { playPcm: audio.playPcm, endOfAudio: audio.endOfAudio };

  const camera = useCamera(sock.isReady, sock.sendImage);

  useEffect(() => {
    if (camera.error) toast.error(`Camera error: ${camera.error}`);
  }, [camera.error]);

  const startCall = useCallback(async () => {
    if (starting) return;
    setPermError(null);
    setStarting(true);
    try {
      await audio.start();
      setPhase("in-call");
      toast.success("Connected — start talking to Otto");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPermError(
        msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("permission")
          ? "Mic blocked — allow microphone access in your browser, then try again."
          : `Couldn't start mic: ${msg}`,
      );
      toast.error("Couldn't start the call");
    } finally {
      setStarting(false);
    }
  }, [audio, starting]);

  const endCall = useCallback(() => {
    audio.stop();
    camera.stop();
    setPhase("lobby");
    setTranscriptOpen(false);
    toast("Call ended");
  }, [audio, camera]);

  const stopOtto = useCallback(() => {
    audio.endOfAudio();
    toast("Stopped Otto");
  }, [audio]);

  const newChat = useCallback(() => {
    audio.endOfAudio();
    sock.resetSession();
    setTranscriptOpen(false);
    toast.success("Started a new chat");
  }, [audio, sock]);

  const toggleAudio = useCallback(async () => {
    if (audio.audioOn) {
      audio.stop();
      toast("Mic muted");
    } else {
      try {
        await audio.start();
        toast.success("Mic on");
      } catch (err) {
        toast.error(`Mic error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, [audio]);

  const toggleLook = useCallback(async () => {
    if (camera.looking) {
      camera.stop();
      toast("Camera off");
    } else {
      await camera.start();
      if (!camera.error) toast.success("Camera on — Otto can see");
    }
  }, [camera]);

  const ottoState = useDerivedOttoState({
    connection: sock.connection,
    audioOn: audio.audioOn,
    inputLevel: audio.inputLevel,
    outputLevel: audio.outputLevel,
    hasPendingAgent: useMemo(
      () =>
        sock.messages.some(
          (m) => m.role === "agent" && m.kind === "text" && m.partial === true,
        ),
      [sock.messages],
    ),
  });

  const partialAgentActive = useMemo(
    () => sock.messages.some((m) => m.role === "agent" && (m as { partial?: boolean }).partial === true),
    [sock.messages],
  );

  // Surface the most recent annotated frame (from point_at_parts or
  // annotate_frame) as a temporary overlay on top of the live camera — the
  // chat drawer is collapsed by default, so without this the user never sees
  // what Otto pointed at.
  const latestImageMsg = useMemo(() => {
    for (let i = sock.messages.length - 1; i >= 0; i--) {
      const m = sock.messages[i];
      if (m.kind === "image") return m as ImageMessage;
    }
    return undefined;
  }, [sock.messages]);

  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [spotlightVisible, setSpotlightVisible] = useState(false);

  useEffect(() => {
    if (!latestImageMsg || latestImageMsg.id === spotlightId) return;
    setSpotlightId(latestImageMsg.id);
    setSpotlightVisible(true);
    const t = window.setTimeout(() => setSpotlightVisible(false), SPOTLIGHT_MS);
    return () => window.clearTimeout(t);
  }, [latestImageMsg, spotlightId]);

  const dismissSpotlight = useCallback(() => setSpotlightVisible(false), []);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="relative h-[100dvh] w-full overflow-hidden text-foreground">
        {/* Camera lives behind everything; only "active" when looking. */}
        <CameraStage ref={camera.videoRef} looking={camera.looking && phase === "in-call"} error={camera.error} />

        {/* Lobby phase */}
        {phase === "lobby" && (
          <Lobby
            connection={sock.connection}
            onStartCall={startCall}
            starting={starting}
            permError={permError}
          />
        )}

        <TopBar
          connection={sock.connection}
          proactivity={proactivity}
          affectiveDialog={affectiveDialog}
          onProactivity={setProactivity}
          onAffectiveDialog={setAffectiveDialog}
          onOpenConsole={() => setConsoleOpen(true)}
          compact={phase === "lobby"}
          theme={theme}
          onTheme={setTheme}
          inCall={phase === "in-call"}
          onNewChat={newChat}
          canNewChat={sock.connection === "connected"}
        />

        {/* In-call phase — forced dark so the call surfaces read clearly over camera/backdrop. */}
        {phase === "in-call" && (
          <div className="dark contents">
            {/* Backdrop only when camera is off — sits above CameraStage but below all controls. */}
            {!camera.looking && (
              <div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(120% 70% at 50% 0%, oklch(0.24 0.06 28 / 0.35), transparent 60%), oklch(0.13 0.015 270)",
                }}
              />
            )}

            {/* Otto presence — big centered orb when no camera; compact badge when camera is on. */}
            {camera.looking ? (
              <OttoBadge
                state={ottoState}
                inputLevel={audio.inputLevel}
                outputLevel={audio.outputLevel}
              />
            ) : (
              <div
                className="absolute z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-[58%] flex flex-col items-center gap-3"
                aria-hidden="false"
              >
                <StatusPill state={ottoState} />
                <OttoOrb
                  state={ottoState}
                  inputLevel={audio.inputLevel}
                  outputLevel={audio.outputLevel}
                  size={224}
                />
              </div>
            )}

            {/* Spotlight: latest annotated frame from point_at_parts / annotate_frame.
                Sits above camera, below the bottom dock — tap to dismiss. */}
            {latestImageMsg && camera.looking && (
              <Spotlight
                msg={latestImageMsg}
                visible={spotlightVisible && spotlightId === latestImageMsg.id}
                onDismiss={dismissSpotlight}
              />
            )}

            {/* Floating "Tap to interrupt" pill — only while Otto is speaking/thinking. */}
            <InterruptPill
              visible={ottoState === "speaking" || ottoState === "thinking"}
              onStop={stopOtto}
            />

            {/* Bottom dock: transcript handle + text input + call controls */}
            <div
              className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-stretch gap-3 px-4 pt-3 pb-3 text-zinc-50"
              style={{
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.8rem)",
                background:
                  "linear-gradient(to top, oklch(0.13 0.015 270 / 0.92) 30%, oklch(0.13 0.015 270 / 0.55) 60%, transparent)",
              }}
            >
              <Drawer open={transcriptOpen} onOpenChange={setTranscriptOpen}>
                <div className="flex justify-center">
                  <TranscriptHandle
                    count={sock.messages.length}
                    partial={partialAgentActive}
                  />
                </div>
                <TranscriptDrawerContent messages={sock.messages} />
              </Drawer>

              <TextInputBar
                canSend={sock.connection === "connected"}
                onSendText={sock.sendText}
                className="mx-auto w-full max-w-md"
              />

              <CallControls
                audioOn={audio.audioOn}
                looking={camera.looking}
                onToggleAudio={toggleAudio}
                onToggleLook={toggleLook}
                onEndCall={endCall}
                className="pt-1"
              />
            </div>
          </div>
        )}

        <ConsoleDrawer
          open={consoleOpen}
          onOpenChange={setConsoleOpen}
          entries={sock.console}
          onClear={sock.clearConsole}
        />

        <Toaster
          position="top-center"
          theme="dark"
          toastOptions={{
            style: {
              background: "rgba(24, 24, 27, 0.92)",
              color: "rgb(244,244,245)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(8px)",
            },
          }}
        />
      </div>
    </TooltipProvider>
  );
}

const OTTO_LABEL: Record<OttoState, string> = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  connecting: "Connecting…",
};

const OTTO_DOT: Record<OttoState, string> = {
  idle: "bg-zinc-400",
  listening: "bg-cyan-400 otto-pulse",
  thinking: "bg-amber-300 otto-pulse",
  speaking: "bg-primary otto-pulse",
  connecting: "bg-zinc-400 otto-pulse",
};

function Spotlight({
  msg,
  visible,
  onDismiss,
}: {
  msg: ImageMessage;
  visible: boolean;
  onDismiss: () => void;
}) {
  const label = msg.caption || msg.focusPart;
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      aria-hidden={!visible}
    >
      <img
        src={msg.url}
        alt={msg.focusPart || "annotated frame"}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss annotation"
        className="absolute right-3 top-3 z-30 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/20 backdrop-blur hover:bg-black/75 active:scale-95 transition"
      >
        <X className="h-4 w-4" />
      </button>
      {label && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 14rem)" }}
        >
          <div className="max-w-md rounded-2xl bg-black/70 px-4 py-2 text-center text-sm font-medium text-white shadow-lg ring-1 ring-white/15 backdrop-blur">
            {label}
          </div>
        </div>
      )}
    </div>
  );
}

function InterruptPill({
  visible,
  onStop,
}: {
  visible: boolean;
  onStop: () => void;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4 transition-all duration-200",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
      )}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 13.5rem)" }}
      aria-hidden={!visible}
    >
      <button
        type="button"
        onClick={onStop}
        disabled={!visible}
        aria-label="Stop Otto"
        className={cn(
          "pointer-events-auto inline-flex items-center gap-2 rounded-full px-3.5 py-2",
          "bg-rose-500/90 text-rose-50 ring-1 ring-rose-300/40 backdrop-blur-md",
          "shadow-[0_10px_30px_-12px_oklch(0.55_0.22_25_/_0.7)]",
          "hover:bg-rose-500 active:scale-[0.97] transition-transform otto-no-select",
        )}
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-rose-50/15">
          <Square className="h-3 w-3 fill-current" />
        </span>
        <span className="text-[12px] font-medium tracking-wide">Tap to interrupt</span>
      </button>
    </div>
  );
}

function OttoBadge({
  state,
  inputLevel,
  outputLevel,
}: {
  state: OttoState;
  inputLevel: React.MutableRefObject<number>;
  outputLevel: React.MutableRefObject<number>;
}) {
  return (
    <div
      className="absolute z-10 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full pl-1 pr-3 py-1 glass otto-no-select shadow-[0_8px_30px_-8px_oklch(0_0_0_/_0.45)]"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 72px)" }}
    >
      <div className="grid h-9 w-9 place-items-center">
        <OttoOrb
          state={state}
          inputLevel={inputLevel}
          outputLevel={outputLevel}
          size={36}
        />
      </div>
      <span className={`h-1.5 w-1.5 rounded-full ${OTTO_DOT[state]}`} />
      <span className="text-[11px] font-medium tracking-wide text-zinc-100">
        {OTTO_LABEL[state]}
      </span>
    </div>
  );
}

// --- Derive Otto's current "presence" state for the orb + status pill.
function useDerivedOttoState({
  connection,
  audioOn,
  inputLevel,
  outputLevel,
  hasPendingAgent,
}: {
  connection: "connecting" | "connected" | "disconnected";
  audioOn: boolean;
  inputLevel: React.MutableRefObject<number>;
  outputLevel: React.MutableRefObject<number>;
  hasPendingAgent: boolean;
}): OttoState {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => (t + 1) & 0xff), 180);
    return () => window.clearInterval(id);
  }, []);

  // Use `tick` to re-read level refs every ~180ms.
  void tick;

  if (connection !== "connected") return "connecting";

  const out = outputLevel.current;
  const inp = inputLevel.current;

  if (out > 0.05) return "speaking";
  if (hasPendingAgent) return "thinking";
  if (audioOn && inp > 0.035) return "listening";
  return "idle";
}
