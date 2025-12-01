/**
 * Audio Processor Worklet
 * Processes microphone audio for voice input
 * - Calculates volume (RMS)
 * - Converts Float32 to PCM16
 * - Applies Voice Activity Detection (VAD)
 */

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.vadThreshold = 0.15; // Default 15%

    // Listen for threshold updates from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'setVadThreshold') {
        this.vadThreshold = event.data.value;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    // No input channels, skip processing
    if (!input || !input[0]) {
      return true;
    }

    const inputData = input[0]; // Float32Array

    // Calculate RMS volume (0-1 normalized)
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += inputData[i] * inputData[i];
    }
    const rms = Math.sqrt(sum / inputData.length);

    // Send volume level to main thread (normalized 0-1)
    this.port.postMessage({
      type: 'volume',
      value: rms
    });

    // VAD: Only process audio if above threshold
    if (rms < this.vadThreshold) {
      return true; // Keep processor alive
    }

    // Convert Float32 to PCM16 (symmetric scaling like React implementation)
    const pcm16 = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      // Symmetric conversion: multiply by 32768 (matches React)
      pcm16[i] = inputData[i] * 32768;
    }

    // Send PCM16 data to main thread
    this.port.postMessage({
      type: 'audioData',
      data: pcm16
    });

    return true; // Keep processor alive
  }
}

registerProcessor('audio-processor', AudioProcessor);
