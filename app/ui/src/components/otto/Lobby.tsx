import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  HeartHandshake,
  Phone,
  Mic,
  Video,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import type { ConnectionState } from "@/lib/types";

type Props = {
  connection: ConnectionState;
  onStartCall: () => void;
  starting: boolean;
  permError: string | null;
};

const STATE_LABEL: Record<ConnectionState, string> = {
  connecting: "Connecting to Otto…",
  connected: "Otto is online",
  disconnected: "Reconnecting…",
};

const STATE_DOT: Record<ConnectionState, string> = {
  connecting: "bg-amber-400",
  connected: "hidden",
  disconnected: "bg-rose-400",
};

export function Lobby({ connection, onStartCall, starting, permError }: Props) {
  const canStart = connection === "connected" && !starting;

  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-[radial-gradient(120%_70%_at_50%_0%,oklch(0.94_0.05_38_/_0.7),transparent_60%),radial-gradient(80%_60%_at_50%_100%,oklch(0.92_0.03_280_/_0.6),transparent_70%),oklch(0.985_0.005_95)] dark:bg-[radial-gradient(120%_70%_at_50%_0%,oklch(0.24_0.06_28_/_0.55),transparent_60%),radial-gradient(80%_60%_at_50%_100%,oklch(0.18_0.04_270_/_0.6),transparent_70%),oklch(0.13_0.015_270)]">
      {/* Subtle grain */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-multiply dark:mix-blend-overlay [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:3px_3px] text-zinc-900 dark:text-white" />

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
        {/* Brand mark */}
        <div className="mb-6 flex flex-col items-center otto-no-select">
          <div className="relative">
            <div className="absolute inset-0 -m-2 rounded-full bg-primary/15 blur-2xl" />
            <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary/95 to-primary/70 shadow-[0_18px_50px_-12px_oklch(0.68_0.22_28_/_0.55)] ring-1 ring-white/15 dark:shadow-[0_18px_50px_-12px_oklch(0.68_0.22_28_/_0.7)]">
              <HeartHandshake className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Otto
          </h1>
          <p className="mt-1 text-[13px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Live repair co-pilot
          </p>
        </div>

        <p className="max-w-sm text-sm leading-relaxed text-zinc-700 dark:text-zinc-300/90">
          Start a voice call. Point your camera at what you're fixing — phones,
          laptops, appliances, bikes, cars, consoles — and Otto walks you through it live.
        </p>

        {/* Capability chips */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Chip icon={<Mic className="h-3 w-3" />} label="Voice" />
          <Chip icon={<Video className="h-3 w-3" />} label="Live video" />
          <Chip icon={<MessageSquare className="h-3 w-3" />} label="Repair guides" />
        </div>

        {/* Big call CTA */}
        <div className="mt-10 flex flex-col items-center">
          <div className="relative">
            <span
              className={cn(
                "absolute inset-0 rounded-full",
                canStart && "otto-call-breathe",
              )}
            />
            <Button
              onClick={onStartCall}
              disabled={!canStart}
              className={cn(
                "relative grid h-24 w-24 place-items-center rounded-full p-0",
                "bg-gradient-to-br from-primary to-[oklch(0.58_0.22_28)] text-primary-foreground",
                "shadow-[0_22px_60px_-15px_oklch(0.68_0.22_28_/_0.8)]",
                "ring-2 ring-primary/30 hover:from-primary hover:to-primary",
                "active:scale-[0.97] transition-transform",
                "disabled:opacity-60 disabled:cursor-not-allowed",
              )}
              aria-label="Start call with Otto"
            >
              <Phone className="h-9 w-9" />
            </Button>
          </div>
          <div className="mt-5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {starting ? "Starting Session…" : "Tap to start the session"}
          </div>
          <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className={cn("h-1.5 w-1.5 rounded-full", STATE_DOT[connection])} />
            {STATE_LABEL[connection]}
          </div>
        </div>

        {permError && (
          <div className="mt-6 max-w-xs rounded-xl bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-200 ring-1 ring-rose-400/40 dark:ring-rose-400/30">
            {permError}
          </div>
        )}
      </div>

      <div
        className="relative px-6 pb-4 text-center otto-no-select"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        <div className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-500">
          <ShieldCheck className="h-3 w-3" />
          Audio &amp; video stay on this session
        </div>
      </div>
    </div>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-700 ring-1 ring-zinc-900/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:ring-white/10">
      <span className="text-zinc-500 dark:text-zinc-400">{icon}</span>
      {label}
    </span>
  );
}
