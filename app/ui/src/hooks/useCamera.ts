import { useCallback, useEffect, useRef, useState } from "react";
import { blobToBase64 } from "@/lib/base64";

const LOOK_FPS_MS = 1000;
// `ideal` is non-binding — phones often return 1080p+ even when we ask for
// 768. We downscale to this max dimension before JPEG-encoding so payloads
// stay small (5–25 KB instead of 100–200 KB) and uplink doesn't back up.
const MAX_FRAME_DIM = 768;

export type CameraHandle = {
  looking: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => Promise<void>;
  stop: () => void;
  error: string | null;
};

export function useCamera(
  isReadyToSend: () => boolean,
  sendImage: (base64: string) => void,
): CameraHandle {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const stoppedRef = useRef(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    if (!isReadyToSend()) return;

    const scale = Math.min(
      1,
      MAX_FRAME_DIM / Math.max(video.videoWidth, video.videoHeight),
    );
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);

    // Reuse a single canvas across captures to avoid GC pressure on phones.
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.7),
    );
    if (!blob) return;
    const base64 = await blobToBase64(blob);
    sendImage(base64);
  }, [isReadyToSend, sendImage]);

  // Self-rescheduling loop instead of setInterval: prevents overlapping
  // captures if JPEG encoding stalls on slow phones, and stops cleanly.
  const scheduleNext = useCallback(
    (delay: number) => {
      if (stoppedRef.current) return;
      timeoutRef.current = window.setTimeout(async () => {
        await captureFrame();
        scheduleNext(LOOK_FPS_MS);
      }, delay);
    },
    [captureFrame],
  );

  const start = useCallback(async () => {
    if (!stoppedRef.current) return;
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 768 },
          height: { ideal: 768 },
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 768 }, height: { ideal: 768 } },
          audio: false,
        });
      } catch (err2) {
        const msg = err2 instanceof Error ? err2.message : String(err2);
        setError(msg);
        return;
      }
    }
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      await new Promise<void>((resolve) => {
        if (video.videoWidth && video.videoHeight) return resolve();
        video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      });
    }
    setLooking(true);
    stoppedRef.current = false;
    void captureFrame();
    scheduleNext(LOOK_FPS_MS);
  }, [captureFrame, scheduleNext]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setLooking(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { looking, videoRef, start, stop, error };
}
