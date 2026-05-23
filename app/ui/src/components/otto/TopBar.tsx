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
import { Settings2, Terminal, Moon, Sun, RotateCcw } from "lucide-react";
import type { ConnectionState } from "@/lib/types";
import type { Theme } from "@/lib/theme";

type Props = {
  connection: ConnectionState;
  proactivity: boolean;
  affectiveDialog: boolean;
  onProactivity: (v: boolean) => void;
  onAffectiveDialog: (v: boolean) => void;
  onOpenConsole: () => void;
  compact?: boolean;
  theme: Theme;
  onTheme: (t: Theme) => void;
  inCall?: boolean;
  onNewChat?: () => void;
  canNewChat?: boolean;
};

const DOT_CLASS: Record<ConnectionState, string> = {
  connected: "bg-emerald-400",
  connecting: "bg-amber-400",
  disconnected: "bg-rose-400",
};

export function TopBar({
  connection,
  proactivity,
  affectiveDialog,
  onProactivity,
  onAffectiveDialog,
  onOpenConsole,
  compact,
  theme,
  onTheme,
  inCall,
  onNewChat,
  canNewChat,
}: Props) {
  const iconBtnClass = cn(
    "h-9 w-9 rounded-full ring-1",
    inCall
      ? "bg-white/[0.04] text-zinc-200 hover:bg-white/10 hover:text-white ring-white/10"
      : "bg-zinc-900/[0.04] text-zinc-700 hover:bg-zinc-900/10 ring-zinc-900/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white dark:ring-white/10",
  );
  return (
    <header
      className={cn(
        "absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-4 pb-3",
        "text-zinc-900 dark:text-zinc-50",
        // In-call: darker gradient so controls read against camera/backdrop
        inCall && "bg-gradient-to-b from-black/40 via-black/15 to-transparent backdrop-blur-[6px] text-zinc-50",
        // Default (not lobby, not in-call): light gradient
        !compact && !inCall && "bg-gradient-to-b from-zinc-50/40 to-transparent dark:from-black/40 dark:via-black/15 backdrop-blur-[6px]",
        // Lobby (compact): no backdrop — Lobby provides its own
      )}
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {!compact && (
          <>
            <span
              className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASS[connection])}
              aria-label={`Status: ${connection}`}
            />
            <div className="text-[13px] font-medium tracking-tight otto-no-select">
              Otto
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {inCall && onNewChat && (
          <Button
            variant="ghost"
            size="icon"
            className={iconBtnClass}
            onClick={onNewChat}
            disabled={!canNewChat}
            aria-label="Start a new chat"
            title="New chat"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}

        {!compact && (
          <Button
            variant="ghost"
            size="icon"
            className={iconBtnClass}
            onClick={onOpenConsole}
            aria-label="Open event console"
          >
            <Terminal className="h-4 w-4" />
          </Button>
        )}

        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={iconBtnClass}
              aria-label="Settings"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="bg-background text-foreground border-border"
          >
            <SheetHeader>
              <SheetTitle>Otto settings</SheetTitle>
              <SheetDescription>
                Tune the experience and Otto's behavior.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 py-2 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    {theme === "dark" ? (
                      <Moon className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Sun className="h-3.5 w-3.5 text-primary" />
                    )}
                    Dark mode
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Switch between light and dark surfaces.
                  </p>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(v) => onTheme(v ? "dark" : "light")}
                />
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Proactivity</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Let Otto speak up without being asked.
                  </p>
                </div>
                <Switch checked={proactivity} onCheckedChange={onProactivity} />
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Affective dialog</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
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
