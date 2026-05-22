import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Settings2, Terminal } from "lucide-react";
import type { ConnectionState } from "@/lib/types";

type Props = {
  connection: ConnectionState;
  proactivity: boolean;
  affectiveDialog: boolean;
  onProactivity: (v: boolean) => void;
  onAffectiveDialog: (v: boolean) => void;
  onOpenConsole: () => void;
};

const STATE_LABEL: Record<ConnectionState, string> = {
  connecting: "Connecting…",
  connected: "Live",
  disconnected: "Disconnected",
};

export function TopBar({
  connection,
  proactivity,
  affectiveDialog,
  onProactivity,
  onAffectiveDialog,
  onOpenConsole,
}: Props) {
  return (
    <header
      className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-3 pb-2 backdrop-blur-md bg-gradient-to-b from-black/55 via-black/40 to-transparent text-zinc-50"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.6rem)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/20 ring-1 ring-primary/40">
          <Sparkles className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-none">Otto</div>
          <div className="text-[10px] text-zinc-400 mt-0.5">Roadside co-pilot</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1",
            connection === "connected"
              ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
              : connection === "connecting"
                ? "bg-amber-500/15 text-amber-300 ring-amber-400/30"
                : "bg-rose-500/15 text-rose-300 ring-rose-400/30",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connection === "connected" && "bg-emerald-400 otto-pulse",
              connection === "connecting" && "bg-amber-400 otto-pulse",
              connection === "disconnected" && "bg-rose-400",
            )}
          />
          {STATE_LABEL[connection]}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white"
          onClick={onOpenConsole}
          aria-label="Open event console"
        >
          <Terminal className="h-4 w-4" />
        </Button>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white"
              aria-label="Settings"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-zinc-950/95 text-zinc-50 border-zinc-800">
            <SheetHeader>
              <SheetTitle className="text-zinc-50">Otto settings</SheetTitle>
              <SheetDescription className="text-zinc-400">
                Live model controls — only apply to native-audio models.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 py-2 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Proactivity</div>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Let Otto speak up without being asked.
                  </p>
                </div>
                <Switch checked={proactivity} onCheckedChange={onProactivity} />
              </div>
              <Separator className="bg-zinc-800" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Affective dialog</div>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Adapt tone to how the user sounds.
                  </p>
                </div>
                <Switch checked={affectiveDialog} onCheckedChange={onAffectiveDialog} />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
