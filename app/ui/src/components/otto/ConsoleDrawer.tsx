import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ConsoleEntry } from "@/lib/types";
import { ChevronRight, Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entries: ConsoleEntry[];
  onClear: () => void;
};

function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ConsoleDrawer({ open, onOpenChange, entries, onClear }: Props) {
  const [showAudio, setShowAudio] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = entries.filter((e) => showAudio || !e.isAudio);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-zinc-950 text-zinc-50 border-zinc-800 max-h-[85vh]">
        <DrawerHeader className="px-4 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DrawerTitle className="text-zinc-50 text-base">Event console</DrawerTitle>
              <DrawerDescription className="text-zinc-400 text-xs">
                Live trace of WebSocket events.
              </DrawerDescription>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Switch
                  checked={showAudio}
                  onCheckedChange={setShowAudio}
                  className="h-4 w-7"
                />
                Audio
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-zinc-400 hover:text-zinc-50"
                onClick={onClear}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            </div>
          </div>
        </DrawerHeader>
        <ScrollArea className="h-[60vh] px-4 pb-4">
          <div className="flex flex-col gap-1.5 font-mono text-[11px]">
            {filtered.length === 0 && (
              <div className="text-zinc-500 italic py-4 text-center">No events yet.</div>
            )}
            {filtered.map((e) => {
              const isOpen = !!expanded[e.id];
              return (
                <div
                  key={e.id}
                  className={cn(
                    "rounded-md border px-2 py-1.5 cursor-pointer",
                    e.direction === "outgoing" && "border-blue-400/20 bg-blue-500/5",
                    e.direction === "incoming" && "border-emerald-400/20 bg-emerald-500/5",
                    e.direction === "error" && "border-rose-400/30 bg-rose-500/5",
                  )}
                  onClick={() => e.data && setExpanded((p) => ({ ...p, [e.id]: !p[e.id] }))}
                >
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    {e.data ? (
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 transition-transform shrink-0",
                          isOpen && "rotate-90",
                        )}
                      />
                    ) : (
                      <span className="w-3" />
                    )}
                    {e.emoji && <span>{e.emoji}</span>}
                    <span
                      className={cn(
                        "uppercase tracking-wide text-[9px] font-bold",
                        e.direction === "outgoing" && "text-blue-300",
                        e.direction === "incoming" && "text-emerald-300",
                        e.direction === "error" && "text-rose-300",
                      )}
                    >
                      {e.direction === "outgoing" ? "↑ out" : e.direction === "incoming" ? "↓ in" : "⚠ err"}
                    </span>
                    {e.author && (
                      <span className="rounded bg-white/5 px-1 py-px text-[9px] text-zinc-400">
                        {e.author}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-zinc-500">{fmtTime(e.ts)}</span>
                  </div>
                  <div className="mt-0.5 pl-4 break-words text-zinc-200">{e.summary}</div>
                  {isOpen && e.data != null && (
                    <pre className="mt-1 ml-4 max-h-64 overflow-auto rounded bg-black/40 p-2 text-[10px] text-zinc-300 ring-1 ring-white/5">
                      {JSON.stringify(e.data, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
