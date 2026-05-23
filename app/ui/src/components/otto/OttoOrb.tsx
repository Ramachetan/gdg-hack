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

// Core stays a constant warm pearl — state is expressed through the
// surrounding glow + ring tints, so the orb reads like the same object
// under different lighting rather than a color-coded indicator.
const CORE = {
  top:    "oklch(0.96 0.02 70)",  // bright highlight near the top
  mid:    "oklch(0.86 0.05 50)",  // body
  bottom: "oklch(0.68 0.08 38)",  // shadow toward the bottom rim
};

const STATE_HUE: Record<OttoState, { glow: string; ring: string }> = {
  idle:       { glow: "oklch(0.65 0.05 40 / 0.28)",  ring: "oklch(0.78 0.05 40 / 0.35)" },
  listening:  { glow: "oklch(0.65 0.08 210 / 0.45)", ring: "oklch(0.80 0.08 210 / 0.6)"  },
  thinking:   { glow: "oklch(0.72 0.10 70 / 0.50)",  ring: "oklch(0.82 0.10 70 / 0.65)"  },
  speaking:   { glow: "oklch(0.68 0.16 28 / 0.60)",  ring: "oklch(0.82 0.14 28 / 0.75)"  },
  connecting: { glow: "oklch(0.55 0.04 270 / 0.32)", ring: "oklch(0.70 0.04 270 / 0.4)"  },
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
  const coreRef = useRef<SVGGElement>(null);

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
          {/* Sphere lighting: bright top → warm body → soft shadow at the bottom rim */}
          <radialGradient id="orb-core-grad" cx="50%" cy="38%" r="62%">
            <stop offset="0%"   stopColor={CORE.top}    stopOpacity="1" />
            <stop offset="45%"  stopColor={CORE.mid}    stopOpacity="1" />
            <stop offset="100%" stopColor={CORE.bottom} stopOpacity="1" />
          </radialGradient>
          {/* Inner shadow rim — gives the bead depth */}
          <radialGradient id="orb-rim-grad" cx="50%" cy="50%" r="50%">
            <stop offset="78%"  stopColor="oklch(0 0 0)" stopOpacity="0" />
            <stop offset="100%" stopColor="oklch(0 0 0)" stopOpacity="0.18" />
          </radialGradient>
          {/* Halo: tinted by state, very soft */}
          <radialGradient id="orb-halo-grad" cx="50%" cy="50%" r="50%">
            <stop offset="55%"  stopColor={hue.glow} stopOpacity="0" />
            <stop offset="100%" stopColor={hue.glow} stopOpacity="1" />
          </radialGradient>
          {/* Specular highlight near the top of the bead */}
          <radialGradient id="orb-spec-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="white" stopOpacity="0.85" />
            <stop offset="60%"  stopColor="white" stopOpacity="0.15" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="orb-arc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={hue.ring} stopOpacity="0" />
            <stop offset="50%"  stopColor={hue.ring} stopOpacity="0.95" />
            <stop offset="100%" stopColor={hue.ring} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer ripples — driven by Otto's voice */}
        <circle
          ref={ripple1Ref}
          cx="100"
          cy="100"
          r="78"
          fill="none"
          stroke={hue.ring}
          strokeWidth="1.25"
          style={{ transition: "opacity 120ms linear" }}
        />
        <circle
          ref={ripple2Ref}
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke={hue.ring}
          strokeWidth="0.75"
          style={{ transition: "opacity 120ms linear" }}
        />

        {/* Soft state-tinted halo */}
        <circle cx="100" cy="100" r="82" fill="url(#orb-halo-grad)" />

        {/* Inner listening ring (user voice) */}
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
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="120 320"
            />
          </g>
        )}

        {/* Core (sphere) */}
        <g
          ref={coreRef}
          style={{ transition: "transform 80ms ease-out", transformOrigin: "100px 100px" }}
        >
          <circle cx="100" cy="100" r="56" fill="url(#orb-core-grad)" />
          {/* Inner rim shadow — gives the bead a 3D presence */}
          <circle cx="100" cy="100" r="56" fill="url(#orb-rim-grad)" />
          {/* Specular highlight (top-left of bead) */}
          <ellipse cx="82" cy="76" rx="20" ry="12" fill="url(#orb-spec-grad)" />
          {/* Tiny crisp catchlight */}
          <ellipse cx="80" cy="74" rx="6" ry="3.5" fill="white" opacity="0.7" />
        </g>
      </svg>
    </div>
  );
}
