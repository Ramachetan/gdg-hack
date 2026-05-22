import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";
import { ChatBubble } from "./ChatBubble";

type Props = { messages: ChatMessage[] };

export function ChatStream({ messages }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="absolute inset-x-0 bottom-32 top-16 z-10 flex flex-col overflow-hidden pointer-events-none">
      <div className="flex-1 overflow-y-auto pointer-events-auto px-3 pb-3 pt-2 [mask-image:linear-gradient(to_bottom,transparent_0,black_28px,black_calc(100%-12px),transparent_100%)]">
        <div className="flex flex-col gap-2.5">
          {messages.length === 0 && (
            <div className="mt-3 mx-auto max-w-sm rounded-2xl bg-zinc-900/70 backdrop-blur px-4 py-3 text-center text-xs text-zinc-300 ring-1 ring-white/10">
              <div className="font-medium text-zinc-100 mb-1">Hey, I'm Otto.</div>
              Tap <span className="text-emerald-300 font-medium">Talk</span> to enable your mic, then <span className="text-primary font-medium">Look</span> to show me your car. I'll walk you through the fix.
            </div>
          )}
          {messages.map((m) => (
            <ChatBubble key={m.id} msg={m} />
          ))}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}
