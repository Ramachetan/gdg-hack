// Buffers mic input to ~20ms chunks (320 samples at 16 kHz) before posting
// to the main thread. With the default 128-sample render quantum that would
// otherwise produce ~125 WS frames/sec — too much framing overhead.
const CHUNK_SAMPLES = 320;

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunk = new Float32Array(CHUNK_SAMPLES);
    this.offset = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input || input.length === 0) return true;

    let read = 0;
    while (read < input.length) {
      const room = CHUNK_SAMPLES - this.offset;
      const take = Math.min(room, input.length - read);
      this.chunk.set(input.subarray(read, read + take), this.offset);
      this.offset += take;
      read += take;
      if (this.offset >= CHUNK_SAMPLES) {
        // Post a copy — the underlying buffer is reused on the next quantum.
        this.port.postMessage(this.chunk.slice());
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-recorder-processor", PCMProcessor);
