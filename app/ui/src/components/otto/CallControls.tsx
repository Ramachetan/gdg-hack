import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

type Props = {
  audioOn: boolean;
  looking: boolean;
  onToggleAudio: () => void;
  onToggleLook: () => void;
  onEndCall: () => void;
  className?: string;
};

export function CallControls({
  audioOn,
  looking,
  onToggleAudio,
  onToggleLook,
  onEndCall,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-5 otto-no-select",
        className,
      )}
    >
      <CallButton
        active={audioOn}
        label={audioOn ? "Mute" : "Unmute"}
        onClick={onToggleAudio}
        activeIcon={<Mic className="h-6 w-6" />}
        inactiveIcon={<MicOff className="h-6 w-6" />}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onEndCall}
            aria-label="End call"
            className={cn(
              "grid place-items-center h-[72px] w-[72px] rounded-full",
              "bg-destructive text-white shadow-[0_10px_30px_-8px_oklch(0.62_0.24_28_/_0.6)]",
              "ring-1 ring-white/15 active:scale-[0.96] transition-transform",
            )}
          >
            <PhoneOff className="h-7 w-7" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px]">End call</TooltipContent>
      </Tooltip>

      <CallButton
        active={looking}
        label={looking ? "Hide camera" : "Show camera"}
        onClick={onToggleLook}
        activeIcon={<Video className="h-6 w-6" />}
        inactiveIcon={<VideoOff className="h-6 w-6" />}
      />
    </div>
  );
}

function CallButton({
  active,
  label,
  onClick,
  activeIcon,
  inactiveIcon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          onClick={onClick}
          aria-pressed={active}
          aria-label={label}
          variant="ghost"
          size="icon"
          className={cn(
            "h-16 w-16 rounded-full backdrop-blur-md transition-all active:scale-[0.96]",
            "ring-1",
            active
              ? "bg-white/95 text-zinc-900 ring-white shadow-[0_8px_24px_-6px_oklch(0.98_0_0_/_0.35)] hover:bg-white"
              : "bg-white/10 text-zinc-100 ring-white/15 hover:bg-white/15",
          )}
        >
          {active ? activeIcon : inactiveIcon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[11px]">{label}</TooltipContent>
    </Tooltip>
  );
}
