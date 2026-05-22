import { useCallback, useRef, useState } from "react";

// Audio worklet processors live in app/static/js (served by FastAPI at /static/js)
const PLAYER_PROCESSOR_URL = "/static/js/pcm-player-processor.js";
const RECORDER_PROCESSOR_URL = "/static/js/pcm-recorder-processor.js";

function float32ToPCM16(input: Float32Array): ArrayBuffer {
  const pcm16 = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    pcm16[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff;
  }
  return pcm16.buffer;
}

export type AudioHandle = {
  audioOn: boolean;
  start: () => Promise<void>;
  stop: () => void;
  playPcm: (buf: ArrayBuffer) => void;
  endOfAudio: () => void;
};

export function useAudio(onPcm: (pcm: ArrayBuffer) => void): AudioHandle {
  const playerNodeRef = useRef<AudioWorkletNode | null>(null);
  const playerCtxRef = useRef<AudioContext | null>(null);
  const recorderNodeRef = useRef<AudioWorkletNode | null>(null);
  const recorderCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const [audioOn, setAudioOn] = useState(false);

  const start = useCallback(async () => {
    if (audioOn) return;

    // Player (24 kHz output from the model)
    const playerCtx = new AudioContext({ sampleRate: 24000 });
    await playerCtx.audioWorklet.addModule(PLAYER_PROCESSOR_URL);
    const playerNode = new AudioWorkletNode(playerCtx, "pcm-player-processor");
    playerNode.connect(playerCtx.destination);
    playerNodeRef.current = playerNode;
    playerCtxRef.current = playerCtx;

    // Recorder (16 kHz mic input)
    const recCtx = new AudioContext({ sampleRate: 16000 });
    await recCtx.audioWorklet.addModule(RECORDER_PROCESSOR_URL);
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1 },
    });
    const source = recCtx.createMediaStreamSource(micStream);
    const recNode = new AudioWorkletNode(recCtx, "pcm-recorder-processor");
    source.connect(recNode);
    recNode.port.onmessage = (event) => {
      const pcm = float32ToPCM16(event.data as Float32Array);
      onPcm(pcm);
    };
    recorderNodeRef.current = recNode;
    recorderCtxRef.current = recCtx;
    micStreamRef.current = micStream;
    setAudioOn(true);
  }, [audioOn, onPcm]);

  const stop = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    recorderNodeRef.current?.disconnect();
    playerNodeRef.current?.disconnect();
    recorderCtxRef.current?.close().catch(() => undefined);
    playerCtxRef.current?.close().catch(() => undefined);
    micStreamRef.current = null;
    recorderNodeRef.current = null;
    playerNodeRef.current = null;
    recorderCtxRef.current = null;
    playerCtxRef.current = null;
    setAudioOn(false);
  }, []);

  const playPcm = useCallback((buf: ArrayBuffer) => {
    playerNodeRef.current?.port.postMessage(buf);
  }, []);

  const endOfAudio = useCallback(() => {
    playerNodeRef.current?.port.postMessage({ command: "endOfAudio" });
  }, []);

  return { audioOn, start, stop, playPcm, endOfAudio };
}
