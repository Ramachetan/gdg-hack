import { useCallback, useEffect, useRef, useState } from "react";
import { blobToBase64 } from "@/lib/base64";

const LOOK_FPS_MS = 1000;

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
  const intervalRef = useRef<number | null>(null);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    if (!isReadyToSend()) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.7),
    );
    if (!blob) return;
    const base64 = await blobToBase64(blob);
    sendImage(base64);
  }, [isReadyToSend, sendImage]);

  const start = useCallback(async () => {
    if (intervalRef.current) return;
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
    captureFrame();
    intervalRef.current = window.setInterval(captureFrame, LOOK_FPS_MS);
  }, [captureFrame]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
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
