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

function computeRms(analyser: AnalyserNode, buf: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / buf.length);
  // Light non-linear curve so quiet speech still drives visible motion.
  return Math.min(1, rms * 1.8);
}

export type LevelRef = React.MutableRefObject<number>;

export type AudioHandle = {
  audioOn: boolean;
  start: () => Promise<void>;
  stop: () => void;
  playPcm: (buf: ArrayBuffer) => void;
  endOfAudio: () => void;
  inputLevel: LevelRef;
  outputLevel: LevelRef;
};

export function useAudio(onPcm: (pcm: ArrayBuffer) => void): AudioHandle {
  const playerNodeRef = useRef<AudioWorkletNode | null>(null);
  const playerCtxRef = useRef<AudioContext | null>(null);
  const recorderNodeRef = useRef<AudioWorkletNode | null>(null);
  const recorderCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const playerAnalyserRef = useRef<AnalyserNode | null>(null);
  const recorderAnalyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const inputLevel = useRef(0);
  const outputLevel = useRef(0);

  const [audioOn, setAudioOn] = useState(false);

  const start = useCallback(async () => {
    if (audioOn) return;

    // Player (24 kHz output from the model)
    const playerCtx = new AudioContext({ sampleRate: 24000 });
    await playerCtx.audioWorklet.addModule(PLAYER_PROCESSOR_URL);
    const playerNode = new AudioWorkletNode(playerCtx, "pcm-player-processor");
    const playerAnalyser = playerCtx.createAnalyser();
    playerAnalyser.fftSize = 256;
    playerAnalyser.smoothingTimeConstant = 0.65;
    playerNode.connect(playerAnalyser);
    playerNode.connect(playerCtx.destination);
    playerNodeRef.current = playerNode;
    playerCtxRef.current = playerCtx;
    playerAnalyserRef.current = playerAnalyser;

    // Recorder (16 kHz mic input)
    const recCtx = new AudioContext({ sampleRate: 16000 });
    await recCtx.audioWorklet.addModule(RECORDER_PROCESSOR_URL);
    // Echo cancellation is critical: speakers play Otto's voice and the mic
    // is always-on, so without EC the model hears itself and interrupts.
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const source = recCtx.createMediaStreamSource(micStream);
    const recNode = new AudioWorkletNode(recCtx, "pcm-recorder-processor");
    const recAnalyser = recCtx.createAnalyser();
    recAnalyser.fftSize = 256;
    recAnalyser.smoothingTimeConstant = 0.5;
    source.connect(recNode);
    source.connect(recAnalyser);
    recNode.port.onmessage = (event) => {
      const pcm = float32ToPCM16(event.data as Float32Array);
      onPcm(pcm);
    };
    recorderNodeRef.current = recNode;
    recorderCtxRef.current = recCtx;
    recorderAnalyserRef.current = recAnalyser;
    micStreamRef.current = micStream;

    // RAF loop reading analysers into refs (avoids 60fps React re-renders).
    const playerBuf = new Uint8Array(new ArrayBuffer(playerAnalyser.fftSize));
    const recBuf = new Uint8Array(new ArrayBuffer(recAnalyser.fftSize));
    const tick = () => {
      const p = playerAnalyserRef.current;
      const r = recorderAnalyserRef.current;
      if (p) outputLevel.current = computeRms(p, playerBuf);
      if (r) inputLevel.current = computeRms(r, recBuf);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    setAudioOn(true);
  }, [audioOn, onPcm]);

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    recorderNodeRef.current?.disconnect();
    playerNodeRef.current?.disconnect();
    recorderAnalyserRef.current?.disconnect();
    playerAnalyserRef.current?.disconnect();
    recorderCtxRef.current?.close().catch(() => undefined);
    playerCtxRef.current?.close().catch(() => undefined);
    micStreamRef.current = null;
    recorderNodeRef.current = null;
    playerNodeRef.current = null;
    recorderCtxRef.current = null;
    playerCtxRef.current = null;
    recorderAnalyserRef.current = null;
    playerAnalyserRef.current = null;
    inputLevel.current = 0;
    outputLevel.current = 0;
    setAudioOn(false);
  }, []);

  const playPcm = useCallback((buf: ArrayBuffer) => {
    playerNodeRef.current?.port.postMessage(buf);
  }, []);

  const endOfAudio = useCallback(() => {
    playerNodeRef.current?.port.postMessage({ command: "endOfAudio" });
  }, []);

  return { audioOn, start, stop, playPcm, endOfAudio, inputLevel, outputLevel };
}
