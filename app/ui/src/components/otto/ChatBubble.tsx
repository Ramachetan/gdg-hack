import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Sparkles,
  User,
  BookOpen,
  ExternalLink,
  Clock,
  Gauge,
} from "lucide-react";

function TypingDots() {
  return (
    <span className="inline-flex items-center align-middle ml-1">
      <span className="otto-typing-dot" />
      <span className="otto-typing-dot" />
      <span className="otto-typing-dot" />
    </span>
  );
}

function Avatar({ role }: { role: "user" | "agent" }) {
  return (
    <div
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ring-1 ring-white/10",
        role === "user"
          ? "bg-primary/90 text-primary-foreground"
          : "bg-white/90 text-zinc-900",
      )}
    >
      {role === "user" ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
    </div>
  );
}

function Bubble({
  role,
  children,
  className,
  interrupted,
}: {
  role: "user" | "agent";
  children: React.ReactNode;
  className?: string;
  interrupted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-2",
        role === "user" ? "flex-row-reverse" : "flex-row",
      )}
    >
      <Avatar role={role} />
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug shadow-md backdrop-blur",
          role === "user"
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-zinc-900/80 text-zinc-50 ring-1 ring-white/10",
          interrupted && "opacity-60 italic",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ChatBubble({ msg }: { msg: ChatMessage }) {
  if (msg.kind === "system") {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-zinc-400 ring-1 ring-white/10">
          {msg.text}
        </span>
      </div>
    );
  }

  if (msg.kind === "text") {
    const role = msg.role === "system" ? "agent" : msg.role;
    return (
      <Bubble role={role} interrupted={msg.interrupted}>
        <span className="whitespace-pre-wrap break-words">{msg.text}</span>
        {msg.partial && <TypingDots />}
      </Bubble>
    );
  }

  if (msg.kind === "image") {
    return (
      <Bubble role="agent" className="max-w-[92%] p-1.5">
        <img
          src={msg.url}
          alt={msg.focusPart || "annotated frame"}
          className="rounded-xl w-full"
        />
        {msg.caption && (
          <div className="px-1.5 pt-1.5 text-xs text-zinc-300">
            {msg.caption}
          </div>
        )}
      </Bubble>
    );
  }

  if (msg.kind === "guide") {
    return (
      <Bubble role="agent" className="max-w-[94%] p-0 bg-transparent ring-0 shadow-none">
        <Card className="border-blue-400/30 bg-zinc-950/85 backdrop-blur p-4 gap-3">
          <div className="flex items-start gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-500/20 text-blue-300">
              <BookOpen className="h-4.5 w-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-zinc-50 leading-tight">{msg.title}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {msg.difficulty && (
                  <Badge variant="outline" className="border-blue-400/40 text-blue-200 gap-1">
                    <Gauge className="h-3 w-3" />
                    {msg.difficulty}
                  </Badge>
                )}
                {msg.timeRequired && (
                  <Badge variant="outline" className="border-blue-400/40 text-blue-200 gap-1">
                    <Clock className="h-3 w-3" />
                    {msg.timeRequired}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {msg.summary && (
            <div className="text-xs text-zinc-400 leading-relaxed">{msg.summary}</div>
          )}
          {msg.stepsText && msg.stepsText.length > 0 && (
            <ol className="space-y-1.5 text-xs text-zinc-300">
              {msg.stepsText.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-500/25 text-[10px] font-bold text-blue-200">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          )}
          {msg.url && (
            <a
              href={msg.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-blue-300 hover:text-blue-200"
            >
              Full guide on iFixit <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </Card>
      </Bubble>
    );
  }

  return null;
}
