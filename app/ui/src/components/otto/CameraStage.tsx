import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Eye, CameraOff } from "lucide-react";

type Props = {
  looking: boolean;
  error: string | null;
};

export const CameraStage = forwardRef<HTMLVideoElement, Props>(
  function CameraStage({ looking, error }, ref) {
    return (
      <div className="absolute inset-0 -z-10 overflow-hidden bg-zinc-950">
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500",
            looking ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        />
        {!looking && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center px-6">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/5 ring-1 ring-white/10 mb-4">
                <CameraOff className="h-9 w-9 text-zinc-500" />
              </div>
              <div className="text-zinc-300 text-lg font-medium">
                Tap <Eye className="inline h-5 w-5 align-text-bottom" /> Look to start
              </div>
              <div className="text-zinc-500 text-sm mt-1.5 max-w-xs mx-auto">
                Point your phone at the engine, dash, or part. Otto sees what you see.
              </div>
            </div>
          </div>
        )}
        {looking && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-black/0 to-black/55" />
            <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-rose-500/85 px-2.5 py-1 text-[10px] font-semibold text-rose-50 shadow ring-1 ring-rose-300/50">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-50 otto-pulse" />
              LIVE
            </div>
          </>
        )}
        {error && (
          <div className="absolute inset-x-3 bottom-32 z-10 rounded-xl bg-rose-500/15 ring-1 ring-rose-400/30 p-3 text-xs text-rose-200 backdrop-blur">
            Camera error: {error}
          </div>
        )}
      </div>
    );
  },
);
