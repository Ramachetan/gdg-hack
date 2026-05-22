import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Keyboard } from "lucide-react";

type Props = {
  canSend: boolean;
  onSendText: (text: string) => void;
  className?: string;
};

export function TextInputBar({ canSend, onSendText, className }: Props) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !canSend) return;
    onSendText(t);
    setText("");
  };

  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex items-center gap-2 transition-opacity",
        focused || text ? "opacity-100" : "opacity-65 hover:opacity-90",
        className,
      )}
    >
      <div className="relative flex-1">
        <Keyboard className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400/80" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Or type to Otto…"
          className={cn(
            "h-9 rounded-full border-white/8 bg-zinc-900/45 pl-9 pr-3 text-[13px]",
            "text-zinc-100 placeholder:text-zinc-400/80",
            "focus-visible:ring-primary/40 focus-visible:bg-zinc-900/70 focus-visible:border-white/15",
          )}
          autoComplete="off"
        />
      </div>
      <Button
        type="submit"
        size="icon"
        variant="ghost"
        disabled={!canSend || !text.trim()}
        className={cn(
          "h-9 w-9 rounded-full text-zinc-200 hover:bg-white/10 hover:text-white",
          "disabled:opacity-40 disabled:hover:bg-transparent",
        )}
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
