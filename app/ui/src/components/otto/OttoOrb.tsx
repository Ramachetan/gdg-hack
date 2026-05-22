import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { LevelRef } from "@/hooks/useAudio";

export type OttoState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "connecting";

type Props = {
  state: OttoState;
  inputLevel: LevelRef;
  outputLevel: LevelRef;
  size?: number;
  className?: string;
};

const STATE_HUE: Record<OttoState, { core: string; glow: string; ring: string }> = {
  idle:       { core: "oklch(0.78 0.10 38)",  glow: "oklch(0.55 0.10 28 / 0.35)", ring: "oklch(0.78 0.08 38 / 0.45)" },
  listening:  { core: "oklch(0.78 0.14 200)", glow: "oklch(0.58 0.16 200 / 0.55)", ring: "oklch(0.82 0.12 200 / 0.7)" },
  thinking:   { core: "oklch(0.78 0.20 60)",  glow: "oklch(0.65 0.22 50 / 0.6)",  ring: "oklch(0.78 0.18 60 / 0.7)"  },
  speaking:   { core: "oklch(0.82 0.20 38)",  glow: "oklch(0.70 0.24 28 / 0.75)", ring: "oklch(0.82 0.20 38 / 0.85)" },
  connecting: { core: "oklch(0.65 0.06 270)", glow: "oklch(0.45 0.06 270 / 0.4)", ring: "oklch(0.65 0.05 270 / 0.5)" },
};

export function OttoOrb({
  state,
  inputLevel,
  outputLevel,
  size = 220,
  className,
}: Props) {
  const ripple1Ref = useRef<SVGCircleElement>(null);
  const ripple2Ref = useRef<SVGCircleElement>(null);
  const innerRingRef = useRef<SVGCircleElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const out = outputLevel.current;
      const inp = inputLevel.current;

      // Outer ripples follow output (Otto's voice).
      if (ripple1Ref.current) {
        const r1 = 78 + out * 28;
        ripple1Ref.current.setAttribute("r", String(r1));
        ripple1Ref.current.style.opacity = String(0.18 + out * 0.55);
      }
      if (ripple2Ref.current) {
        const r2 = 92 + out * 24;
        ripple2Ref.current.setAttribute("r", String(r2));
        ripple2Ref.current.style.opacity = String(0.1 + out * 0.4);
      }

      // Inner listening ring follows input (user's voice).
      if (innerRingRef.current) {
        const sw = 1 + inp * 6;
        innerRingRef.current.setAttribute("stroke-width", String(sw));
        innerRingRef.current.style.opacity = String(
          state === "listening" ? 0.4 + inp * 0.6 : 0,
        );
      }

      // Subtle core pump on Otto's voice.
      if (coreRef.current) {
        const scale = 1 + out * 0.06;
        coreRef.current.style.transform = `scale(${scale})`;
        coreRef.current.style.transformOrigin = "center";
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, inputLevel, outputLevel]);

  const hue = STATE_HUE[state];

  return (
    <div
      className={cn(
        "relative grid place-items-center otto-no-select pointer-events-none",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className={cn(state === "idle" && "otto-orb-breathe")}
      >
        <defs>
          <radialGradient id="orb-core-grad" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor={hue.core} stopOpacity="1" />
            <stop offset="55%" stopColor={hue.core} stopOpacity="0.75" />
            <stop offset="100%" stopColor={hue.glow} stopOpacity="0.05" />
          </radialGradient>
          <radialGradient id="orb-halo-grad" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor={hue.glow} stopOpacity="0" />
            <stop offset="100%" stopColor={hue.glow} stopOpacity="0.6" />
          </radialGradient>
          <linearGradient id="orb-arc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={hue.ring} stopOpacity="0" />
            <stop offset="50%" stopColor={hue.ring} stopOpacity="0.95" />
            <stop offset="100%" stopColor={hue.ring} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer ripples (speaking) */}
        <circle
          ref={ripple1Ref}
          cx="100"
          cy="100"
          r="78"
          fill="none"
          stroke={hue.ring}
          strokeWidth="1.5"
          style={{ transition: "opacity 120ms linear" }}
        />
        <circle
          ref={ripple2Ref}
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke={hue.ring}
          strokeWidth="1"
          style={{ transition: "opacity 120ms linear" }}
        />

        {/* Soft halo */}
        <circle cx="100" cy="100" r="80" fill="url(#orb-halo-grad)" />

        {/* Inner listening ring (only visible in listening state) */}
        <circle
          ref={innerRingRef}
          cx="100"
          cy="100"
          r="62"
          fill="none"
          stroke={hue.ring}
          strokeWidth="1"
          style={{ opacity: 0, transition: "opacity 160ms linear" }}
        />

        {/* Thinking arc */}
        {state === "thinking" && (
          <g className="otto-orb-spin" style={{ transformBox: "view-box" }}>
            <circle
              cx="100"
              cy="100"
              r="70"
              fill="none"
              stroke="url(#orb-arc-grad)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="120 320"
            />
          </g>
        )}

        {/* Core */}
        <circle
          ref={coreRef}
          cx="100"
          cy="100"
          r="56"
          fill="url(#orb-core-grad)"
          style={{ transition: "transform 80ms ease-out" }}
        />
        {/* Highlight */}
        <ellipse
          cx="84"
          cy="78"
          rx="22"
          ry="14"
          fill="white"
          opacity="0.18"
        />
      </svg>
    </div>
  );
}
