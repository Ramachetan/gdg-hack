import { cn } from "@/lib/utils";
import type { OttoState } from "./OttoOrb";

const LABEL: Record<OttoState, string> = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  connecting: "Connecting…",
};

const DOT_CLASS: Record<OttoState, string> = {
  idle: "bg-zinc-400",
  listening: "bg-cyan-400 otto-pulse",
  thinking: "bg-amber-300 otto-pulse",
  speaking: "bg-primary otto-pulse",
  connecting: "bg-zinc-400 otto-pulse",
};

export function StatusPill({
  state,
  className,
}: {
  state: OttoState;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium text-zinc-100 glass otto-no-select",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASS[state])} />
      <span className="tracking-wide">{LABEL[state]}</span>
    </div>
  );
}
