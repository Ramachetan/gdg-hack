import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import type { ConnectionState } from "@/lib/types";

type Props = {
  connection: ConnectionState;
  onStartCall: () => void;
  starting: boolean;
  permError: string | null;
};

const STATE_LABEL: Record<ConnectionState, string> = {
  connecting: "Connecting…",
  connected: "Ready",
  disconnected: "Reconnecting…",
};

const STATE_DOT: Record<ConnectionState, string> = {
  connecting: "bg-amber-400",
  connected: "bg-emerald-400",
  disconnected: "bg-rose-400",
};

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function Lobby({ connection, onStartCall, starting, permError }: Props) {
  const canStart = connection === "connected" && !starting;

  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-[radial-gradient(120%_70%_at_50%_0%,oklch(0.94_0.05_38_/_0.7),transparent_60%),radial-gradient(80%_60%_at_50%_100%,oklch(0.92_0.03_280_/_0.6),transparent_70%),oklch(0.985_0.005_95)] dark:bg-[radial-gradient(120%_70%_at_50%_0%,oklch(0.24_0.06_28_/_0.55),transparent_60%),radial-gradient(80%_60%_at_50%_100%,oklch(0.18_0.04_270_/_0.6),transparent_70%),oklch(0.13_0.015_270)]">
      {/* Subtle grain */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-multiply dark:mix-blend-overlay [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:3px_3px] text-zinc-900 dark:text-white" />

      <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="otto-no-select">
          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            Otto
          </p>
          <h1 className="mt-4 text-4xl font-light tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            {greeting()}
          </h1>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300/85">
            How can I help you fix your stuff today?
          </p>
        </div>

        <div className="mt-12 flex flex-col items-center">
          <div className="relative">
            {/* Soft breathing ripples — only while "ready". Sit behind the pill. */}
            {canStart && (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full bg-zinc-900/12 dark:bg-zinc-50/12 otto-start-ripple-1"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full bg-zinc-900/12 dark:bg-zinc-50/12 otto-start-ripple-2"
                />
              </>
            )}

            <Button
              onClick={onStartCall}
              disabled={!canStart}
              className={cn(
                "group relative h-14 rounded-full pl-7 pr-2.5 text-[15px] font-medium tracking-wide",
                // Surface gradient — subtle top highlight for a premium feel
                "bg-gradient-to-b from-zinc-800 to-zinc-950 text-zinc-50",
                "dark:from-white dark:to-zinc-200 dark:text-zinc-900",
                // Inner ring (glass-like)
                "ring-1 ring-inset ring-white/10 dark:ring-zinc-900/5",
                // Outer shadow — grows on hover for a soft "lift"
                "shadow-[0_14px_36px_-14px_oklch(0_0_0_/_0.45)]",
                "hover:shadow-[0_22px_50px_-16px_oklch(0_0_0_/_0.55)]",
                "hover:-translate-y-[1px]",
                "active:translate-y-0 active:scale-[0.985]",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0",
              )}
              aria-label="Start session with Otto"
            >
              <span>{starting ? "Starting" : "Start"}</span>
              <span
                className={cn(
                  "ml-2 grid h-9 w-9 place-items-center rounded-full",
                  "bg-white/12 dark:bg-zinc-900/10",
                  "ring-1 ring-inset ring-white/15 dark:ring-zinc-900/10",
                  "transition-transform duration-200 group-hover:translate-x-0.5",
                )}
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 otto-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </span>
            </Button>
          </div>

          <div className="mt-6 inline-flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
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
    </div>
  );
}
