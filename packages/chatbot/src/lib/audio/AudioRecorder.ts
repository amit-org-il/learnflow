/**
 * AudioRecorder
 * Captures microphone audio using Web Audio API (AudioWorklet)
 * Outputs Base64-encoded PCM16 chunks at 16kHz for Gemini Live
 */

export interface AudioRecorderOptions {
  /** Target sample rate (default: 16000 Hz for Gemini) */
  sampleRate?: number;

  /** Callback for audio chunks */
  onAudioChunk: (base64: string, sampleRate: number, isFinal: boolean) => void;

  /** Callback for volume level changes (0-1 normalized) */
  onVolumeChange?: (level: number) => void;

  /** Voice Activity Detection threshold (0-1, default: 0.15) */
  vadThreshold?: number;
}

export type AudioRecorderError =
  | { type: 'permission_denied'; message: string }
  | { type: 'not_supported'; message: string }
  | { type: 'worklet_load_failed'; message: string }
  | { type: 'unknown'; message: string };

// Cache for AudioContext instances by sample rate
const audioContextCache = new Map<number, AudioContext>();

export class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isRecording = false;
  private options: Required<Pick<AudioRecorderOptions, 'sampleRate' | 'vadThreshold'>> & AudioRecorderOptions;

  constructor(options: AudioRecorderOptions) {
    this.options = {
      sampleRate: 16000,
      vadThreshold: 0.15,
      ...options
    };
  }

  /**
   * Start recording from microphone
   * @throws {AudioRecorderError} If recording cannot start
   */
  async start(): Promise<void> {
    if (this.isRecording) {
      console.warn('[AudioRecorder] Already recording');
      return;
    }

    try {
      // Step 1: Check microphone permission status
      await this.checkMicrophonePermission();

      // Step 2: Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Step 3: Get or create AudioContext (cached by sample rate)
      this.audioContext = this.getOrCreateAudioContext(this.options.sampleRate);

      // Step 4: Verify actual sample rate
      if (this.audioContext.sampleRate !== this.options.sampleRate) {
        console.warn(
          `[AudioRecorder] Requested ${this.options.sampleRate}Hz but got ${this.audioContext.sampleRate}Hz. ` +
          'Audio may need resampling on backend.'
        );
      }

      // Step 5: Load AudioWorklet processor
      try {
        await this.audioContext.audioWorklet.addModule('/worklets/audio-processor.js');
      } catch (err) {
        throw this.createError(
          'worklet_load_failed',
          'Failed to load audio processor worklet. Check if /worklets/audio-processor.js exists.'
        );
      }

      // Step 6: Create AudioWorklet node
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');

      // Step 7: Set VAD threshold
      this.workletNode.port.postMessage({
        type: 'setVadThreshold',
        value: this.options.vadThreshold
      });

      // Step 8: Listen for messages from worklet
      this.workletNode.port.onmessage = (event) => {
        if (!this.isRecording) return;

        if (event.data.type === 'volume') {
          // Volume is already normalized 0-1 by worklet
          this.options.onVolumeChange?.(event.data.value);
        } else if (event.data.type === 'audioData') {
          // Convert PCM16 to Base64
          const pcm16: Int16Array = event.data.data;
          const base64 = this.pcm16ToBase64(pcm16);
          this.options.onAudioChunk(base64, this.audioContext!.sampleRate, false);
        }
      };

      // Step 9: Connect audio graph (NO connection to destination to avoid echo)
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.workletNode);
      // IMPORTANT: Do NOT connect to destination or audio will echo back!

      this.isRecording = true;
      console.log(`[AudioRecorder] Started recording at ${this.audioContext.sampleRate}Hz`);

    } catch (err) {
      // Clean up on error
      this.cleanup();
      throw this.handleError(err);
    }
  }

  /**
   * Stop recording and send final marker
   */
  stop(): void {
    if (!this.isRecording) {
      console.warn('[AudioRecorder] Not recording');
      return;
    }

    // Send final chunk indicator BEFORE cleanup
    if (this.audioContext) {
      this.options.onAudioChunk('', this.audioContext.sampleRate, true);
    }

    this.cleanup();
    this.isRecording = false;
    console.log('[AudioRecorder] Stopped recording');
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Update VAD threshold dynamically
   */
  setVadThreshold(threshold: number): void {
    this.options.vadThreshold = threshold;
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'setVadThreshold',
        value: threshold
      });
    }
  }

  // ========================================
  // PRIVATE HELPERS
  // ========================================

  /**
   * Check microphone permission status before requesting
   */
  private async checkMicrophonePermission(): Promise<void> {
    try {
      const permissionStatus = await navigator.permissions.query({
        name: 'microphone' as PermissionName
      });

      if (permissionStatus.state === 'denied') {
        throw this.createError(
          'permission_denied',
          'Microphone access denied. Please enable microphone in browser settings.'
        );
      }
    } catch (err) {
      // Check if it's already our error type
      if (err && typeof err === 'object' && 'type' in err) {
        throw err;
      }
      // Permissions API not supported, continue with getUserMedia
      console.warn('[AudioRecorder] Permissions API not supported, will try getUserMedia');
    }
  }

  /**
   * Get or create cached AudioContext for given sample rate
   * Prevents hitting browser's AudioContext limit (6-8 instances)
   */
  private getOrCreateAudioContext(sampleRate: number): AudioContext {
    let context = audioContextCache.get(sampleRate);

    if (!context || context.state === 'closed') {
      context = new AudioContext({ sampleRate });
      audioContextCache.set(sampleRate, context);
      console.log(`[AudioRecorder] Created new AudioContext at ${sampleRate}Hz`);
    }

    // Resume context if suspended (browser autoplay policy)
    if (context.state === 'suspended') {
      context.resume().catch(err => {
        console.warn('[AudioRecorder] Failed to resume AudioContext:', err);
      });
    }

    return context;
  }

  /**
   * Convert PCM16 Int16Array to Base64 string
   * Handles binary data > 127 correctly
   */
  private pcm16ToBase64(pcm16: Int16Array): string {
    const bytes = new Uint8Array(pcm16.buffer);

    // Build binary string byte by byte (handles values > 127)
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode.port.onmessage = null;
      this.workletNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Don't close AudioContext (it's cached for reuse)
    this.audioContext = null;
  }

  /**
   * Create typed error
   */
  private createError(type: AudioRecorderError['type'], message: string): AudioRecorderError {
    return { type, message };
  }

  /**
   * Handle and classify errors
   */
  private handleError(err: unknown): AudioRecorderError {
    if (err && typeof err === 'object' && 'type' in err) {
      return err as AudioRecorderError;
    }

    if (err instanceof Error) {
      const message = err.message.toLowerCase();

      // Permission denied
      if (message.includes('permission') || message.includes('denied') || message.includes('notallowed')) {
        return this.createError(
          'permission_denied',
          'Microphone access denied. Please allow microphone access and try again.'
        );
      }

      // Not supported
      if (message.includes('not supported') || message.includes('notfound')) {
        return this.createError(
          'not_supported',
          'Microphone not available. Please check your device.'
        );
      }

      // Unknown error
      return this.createError('unknown', err.message);
    }

    return this.createError('unknown', 'Failed to start audio recording');
  }
}
