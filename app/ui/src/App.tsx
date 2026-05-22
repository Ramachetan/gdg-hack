import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

import { useOttoSocket } from "@/hooks/useOttoSocket";
import { useAudio } from "@/hooks/useAudio";
import { useCamera } from "@/hooks/useCamera";

import { TopBar } from "@/components/otto/TopBar";
import { BottomBar } from "@/components/otto/BottomBar";
import { ChatStream } from "@/components/otto/ChatStream";
import { CameraStage } from "@/components/otto/CameraStage";
import { ConsoleDrawer } from "@/components/otto/ConsoleDrawer";

export default function App() {
  const [proactivity, setProactivity] = useState(false);
  const [affectiveDialog, setAffectiveDialog] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);

  const audioRef = useRef<{ playPcm: (b: ArrayBuffer) => void; endOfAudio: () => void } | null>(null);

  const sock = useOttoSocket({
    proactivity,
    affectiveDialog,
    onAudioChunk: (pcm) => audioRef.current?.playPcm(pcm),
    onInterrupted: () => audioRef.current?.endOfAudio(),
  });

  const audio = useAudio((pcm) => sock.sendPcm(pcm));
  audioRef.current = { playPcm: audio.playPcm, endOfAudio: audio.endOfAudio };

  const camera = useCamera(sock.isReady, sock.sendImage);

  useEffect(() => {
    if (camera.error) toast.error(`Camera error: ${camera.error}`);
  }, [camera.error]);

  const toggleAudio = useCallback(async () => {
    if (audio.audioOn) {
      audio.stop();
      toast("Mic off");
    } else {
      try {
        await audio.start();
        toast.success("Mic on — talk to Otto");
      } catch (err) {
        toast.error(`Mic error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, [audio]);

  const toggleLook = useCallback(async () => {
    if (camera.looking) {
      camera.stop();
      toast("Camera off");
    } else {
      await camera.start();
      if (!camera.error) toast.success("Camera on — Otto can see");
    }
  }, [camera]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden text-zinc-50">
      <CameraStage ref={camera.videoRef} looking={camera.looking} error={camera.error} />

      <TopBar
        connection={sock.connection}
        proactivity={proactivity}
        affectiveDialog={affectiveDialog}
        onProactivity={setProactivity}
        onAffectiveDialog={setAffectiveDialog}
        onOpenConsole={() => setConsoleOpen(true)}
      />

      <ChatStream messages={sock.messages} />

      <BottomBar
        audioOn={audio.audioOn}
        looking={camera.looking}
        canSend={sock.connection === "connected"}
        onToggleAudio={toggleAudio}
        onToggleLook={toggleLook}
        onSendText={sock.sendText}
      />

      <ConsoleDrawer
        open={consoleOpen}
        onOpenChange={setConsoleOpen}
        entries={sock.console}
        onClear={sock.clearConsole}
      />

      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{
          style: {
            background: "rgba(24, 24, 27, 0.92)",
            color: "rgb(244,244,245)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(8px)",
          },
        }}
      />
    </div>
  );
}
