import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Eye, Send, Square, PhoneOff } from "lucide-react";

type Props = {
  audioOn: boolean;
  looking: boolean;
  canSend: boolean;
  onToggleAudio: () => void;
  onToggleLook: () => void;
  onSendText: (text: string) => void;
};

export function BottomBar({
  audioOn,
  looking,
  canSend,
  onToggleAudio,
  onToggleLook,
  onSendText,
}: Props) {
  const [text, setText] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !canSend) return;
    onSendText(t);
    setText("");
  };

  const stopAll = () => {
    if (audioOn) onToggleAudio();
    if (looking) onToggleLook();
  };

  const anyOn = audioOn || looking;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 px-3 pt-2 backdrop-blur-md bg-gradient-to-t from-black/70 via-black/45 to-transparent"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.6rem)" }}
    >
      <form onSubmit={submit} className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a question for Otto…"
          className="h-11 bg-zinc-900/70 border-white/10 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-primary/40 rounded-full px-4"
          autoComplete="off"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!canSend || !text.trim()}
          className="h-11 w-11 rounded-full shrink-0"
          aria-label="Send"
        >
          <Send className="h-4.5 w-4.5" />
        </Button>
      </form>

      <div className="flex items-center justify-center gap-2 pb-1">
        <ActionButton
          active={audioOn}
          onClick={onToggleAudio}
          activeLabel="Stop mic"
          inactiveLabel="Talk"
          activeIcon={<Square className="h-4 w-4 fill-current" />}
          inactiveIcon={<Mic className="h-5 w-5" />}
          activeClass="bg-rose-500 text-rose-50 ring-rose-300/60 shadow-rose-500/30"
        />
        <ActionButton
          active={looking}
          onClick={onToggleLook}
          activeLabel="Stop look"
          inactiveLabel="Look"
          activeIcon={<Square className="h-4 w-4 fill-current" />}
          inactiveIcon={<Eye className="h-5 w-5" />}
          activeClass="bg-rose-500 text-rose-50 ring-rose-300/60 shadow-rose-500/30"
        />
      </div>

      {anyOn && (
        <div className="flex justify-center pb-1">
          <button
            type="button"
            onClick={stopAll}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-600/15 px-3 py-1.5 text-[11px] font-medium text-rose-300 ring-1 ring-rose-400/30 hover:bg-rose-600/25 active:scale-[0.97] transition"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            End session
          </button>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  active,
  onClick,
  activeLabel,
  inactiveLabel,
  activeIcon,
  inactiveIcon,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  activeLabel: string;
  inactiveLabel: string;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ring-1 active:scale-[0.97]",
        active
          ? `${activeClass} shadow-lg ring-2`
          : "bg-white/8 text-zinc-200 hover:bg-white/12 ring-white/10",
      )}
      aria-pressed={active}
    >
      <span
        className={cn(
          "grid place-items-center h-7 w-7 rounded-full",
          active ? "bg-black/20" : "bg-white/5",
          active && "otto-pulse",
        )}
      >
        {active ? activeIcon : inactiveIcon}
      </span>
      <span>{active ? activeLabel : inactiveLabel}</span>
    </button>
  );
}
