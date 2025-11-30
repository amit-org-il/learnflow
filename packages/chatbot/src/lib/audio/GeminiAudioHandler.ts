/**
 * GeminiAudioHandler
 *
 * Handles Gemini Live audio streaming with lip-sync analysis.
 * Decodes base64 PCM audio, plays through Web Audio API, and
 * analyzes frequency bands for avatar mouth movements.
 */

import { audioContext, base64ToArrayBuffer, releaseAudioContext } from "./audio-utils";
import { createWorkletFromSrc } from "./audioworklet-registry";
import SmartMouthAnalyzer, { type MouthShape } from "./worklets/smart-mouth-analyzer";

/**
 * Events emitted by GeminiAudioHandler
 */
export interface GeminiAudioHandlerEvents {
  /** Mouth shape update from frequency analysis (40 times/sec) */
  mouthShape: (shape: MouthShape) => void;
  /** Audio started playing */
  start: () => void;
  /** Audio stopped playing */
  stop: () => void;
  /** All queued audio finished playing */
  queueEmpty: () => void;
  /** Error occurred */
  error: (error: Error) => void;
}

type EventCallback<K extends keyof GeminiAudioHandlerEvents> = GeminiAudioHandlerEvents[K];

/**
 * GeminiAudioHandler - Handles Gemini Live audio with lip-sync
 *
 * Features:
 * - Decodes base64 PCM16 to playable audio
 * - Real-time frequency analysis for lip-sync
 * - Queued playback to handle streaming chunks
 * - Smooth mouth shape transitions
 *
 * @example
 * ```typescript
 * const audioHandler = new GeminiAudioHandler(24000);
 *
 * audioHandler.on('mouthShape', (shape) => {
 *   avatar.setBlendshapes(shape);
 * });
 *
 * await audioHandler.initialize();
 *
 * // On each Gemini audio chunk:
 * audioHandler.playChunk(base64Audio);
 *
 * // When stream is complete:
 * audioHandler.complete();
 *
 * // On interruption:
 * audioHandler.stop();
 * ```
 */
export class GeminiAudioHandler {
  /** Audio context for playback */
  private audioCtx: AudioContext | null = null;

  /** SmartMouthAnalyzer worklet node (for analysis only) */
  private analyzerNode: AudioWorkletNode | null = null;

  /** Gain node for audio playback path */
  private gainNode: GainNode | null = null;

  /** Audio queue for scheduled playback */
  private audioQueue: AudioBuffer[] = [];

  /** Processing buffer to accumulate variable-size chunks into fixed-size buffers */
  private processingBuffer: Float32Array = new Float32Array(0);

  /** Fixed buffer size for consistent playback (~320ms at 24kHz) */
  private readonly bufferSize: number = 7680;

  /** Scheduled time for next buffer (look-ahead scheduling) */
  private scheduledTime: number = 0;

  /** How far ahead to schedule buffers (seconds) */
  private readonly SCHEDULE_AHEAD_TIME: number = 0.2; // 200ms

  /** Initial buffer time before playback starts (seconds) */
  private readonly INITIAL_BUFFER_TIME: number = 0.1; // 100ms

  /** Whether currently playing */
  private _isPlaying: boolean = false;

  /** Whether handler is initialized */
  private _isInitialized: boolean = false;

  /** Event listeners */
  private listeners: Map<string, Set<Function>> = new Map();

  /** Current mouth shape (smoothed) */
  private _currentMouthShape: MouthShape = {
    jawOpen: 0,
    mouthOpen: 0,
    mouthSmile: 0,
    mouthFunnel: 0,
    mouthPucker: 0,
  };

  /** Smoothing factor for mouth shape transitions (0-1, higher = less smoothing) */
  private smoothingFactor: number = 0.6;

  /** Timer for scheduling */
  private scheduleTimer: ReturnType<typeof setTimeout> | null = null;

  /** Active BufferSourceNodes (must be tracked for cleanup on stop) */
  private activeSources: Set<AudioBufferSourceNode> = new Set();

  /** Debug: Turn counter */
  private turnCount: number = 0;

  /** Debug: Chunk counter per turn */
  private chunkCount: number = 0;

  /** Sample rate of incoming audio (default: 24000 for Gemini Live) */
  public readonly sampleRate: number;

  /**
   * Create a GeminiAudioHandler
   * @param sampleRate - Sample rate of incoming audio (default: 24000 for Gemini Live)
   */
  constructor(sampleRate: number = 24000) {
    this.sampleRate = sampleRate;
  }

  /**
   * Whether currently playing audio
   */
  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * Whether handler is initialized
   */
  get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Current mouth shape (smoothed values)
   */
  get currentMouthShape(): MouthShape {
    return { ...this._currentMouthShape };
  }

  /**
   * Number of audio chunks in queue
   */
  get queueLength(): number {
    return this.audioQueue.length;
  }

  /**
   * Register an event listener
   */
  on<K extends keyof GeminiAudioHandlerEvents>(
    event: K,
    callback: EventCallback<K>,
  ): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return this;
  }

  /**
   * Remove an event listener
   */
  off<K extends keyof GeminiAudioHandlerEvents>(
    event: K,
    callback: EventCallback<K>,
  ): this {
    this.listeners.get(event)?.delete(callback);
    return this;
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): this {
    this.listeners.clear();
    return this;
  }

  /**
   * Emit an event to all registered listeners
   */
  private emit<K extends keyof GeminiAudioHandlerEvents>(
    event: K,
    ...args: Parameters<GeminiAudioHandlerEvents[K]>
  ): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        (callback as Function)(...args);
      } catch (e) {
        console.error(`[GeminiAudioHandler] Error in ${event} handler:`, e);
      }
    });
  }

  /**
   * Initialize the audio handler
   *
   * Sets up AudioContext, GainNode for playback, and SmartMouthAnalyzer for analysis.
   * Uses PARALLEL routing (matches working reference implementation):
   *   - source -> analyzerNode -> destination (analysis path, outputs silence)
   *   - source -> gainNode -> destination (audio playback)
   *
   * Call this before playing any audio.
   */
  async initialize(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    try {
      // Create AudioContext at Gemini's sample rate
      this.audioCtx = await audioContext({
        sampleRate: this.sampleRate,
        id: 'gemini-audio',
      });

      // CRITICAL: Resume AudioContext if suspended (required for autoplay)
      if (this.audioCtx.state === 'suspended') {
        console.log('[GeminiAudioHandler] AudioContext suspended, resuming...');
        await this.audioCtx.resume();
      }

      // Set up SmartMouthAnalyzer worklet FIRST (for lip-sync analysis)
      const workletName = "smart-mouth-analyzer";
      const workletSrc = createWorkletFromSrc(workletName, SmartMouthAnalyzer);

      await this.audioCtx.audioWorklet.addModule(workletSrc);

      // Create AudioWorkletNode with DEFAULT options (matches working reference)
      // The worklet receives audio, analyzes it, and posts mouthShape messages
      // It has 1 output (default) but outputs silence - this is how the reference works
      this.analyzerNode = new AudioWorkletNode(this.audioCtx, workletName);

      // Handle mouth shape updates from analyzer
      this.analyzerNode.port.onmessage = (ev: MessageEvent) => {
        const rawShape = ev.data as MouthShape;
        if (rawShape) {
          // Apply smoothing for more natural transitions
          this._currentMouthShape = this.smoothMouthShape(rawShape);
          this.emit('mouthShape', this._currentMouthShape);
        }
      };

      // Create GainNode for volume control
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 1.0;

      // PARALLEL ROUTING (matches reference implementation):
      // - source -> analyzerNode -> destination (analysis path, outputs silence)
      // - source -> gainNode -> destination (audio playback path)
      this.analyzerNode.connect(this.audioCtx.destination);
      this.gainNode.connect(this.audioCtx.destination);

      this._isInitialized = true;
      console.log('[GeminiAudioHandler] ✅ Initialized with PARALLEL routing (source -> analyzerNode & gainNode -> destination)');
      console.log('[GeminiAudioHandler] AudioContext state:', this.audioCtx.state);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[GeminiAudioHandler] Failed to initialize:', err);
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Apply smoothing to mouth shape transitions
   */
  private smoothMouthShape(newShape: MouthShape): MouthShape {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const t = this.smoothingFactor;

    return {
      jawOpen: lerp(this._currentMouthShape.jawOpen, newShape.jawOpen, t),
      mouthOpen: lerp(this._currentMouthShape.mouthOpen, newShape.mouthOpen, t),
      mouthSmile: lerp(this._currentMouthShape.mouthSmile, newShape.mouthSmile, t),
      mouthFunnel: lerp(this._currentMouthShape.mouthFunnel, newShape.mouthFunnel, t),
      mouthPucker: lerp(this._currentMouthShape.mouthPucker, newShape.mouthPucker, t),
    };
  }

  /**
   * Play a base64 audio chunk
   *
   * Decodes the audio, accumulates into fixed-size buffers,
   * and schedules for gapless playback with look-ahead.
   *
   * @param base64Audio - Base64-encoded PCM16 little-endian audio
   */
  async playChunk(base64Audio: string): Promise<void> {
    if (!base64Audio) {
      return;
    }

    // Auto-initialize if needed
    if (!this._isInitialized) {
      await this.initialize();
    }

    if (!this.audioCtx) {
      return;
    }

    // Debug: Track chunks per turn
    this.chunkCount++;

    // Log first chunk of each turn (when not playing = new turn starting)
    if (this.chunkCount === 1 || !this._isPlaying) {
      console.log(`[GeminiAudioHandler] 🎵 Turn ${this.turnCount + 1} starting - chunk #${this.chunkCount}, isPlaying=${this._isPlaying}, queueLen=${this.audioQueue.length}, bufferLen=${this.processingBuffer.length}, activeSources=${this.activeSources.size}`);
    }

    try {
      // Decode base64 to Float32
      const arrayBuffer = base64ToArrayBuffer(base64Audio);
      const int16Array = new Int16Array(arrayBuffer);
      const float32Array = new Float32Array(int16Array.length);

      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      // Debug: Log first chunk's audio data to verify conversion
      if (this.chunkCount === 1) {
        const maxVal = Math.max(...Array.from(float32Array).slice(0, 100).map(Math.abs));
        console.log(`[GeminiAudioHandler] First chunk converted: samples=${float32Array.length}, maxAbsValue=${maxVal.toFixed(4)}, first10=[${Array.from(float32Array.slice(0, 10)).map(v => v.toFixed(4)).join(', ')}]`);
      }

      // Accumulate into processing buffer
      const newBuffer = new Float32Array(
        this.processingBuffer.length + float32Array.length,
      );
      newBuffer.set(this.processingBuffer);
      newBuffer.set(float32Array, this.processingBuffer.length);
      this.processingBuffer = newBuffer;

      // Split into fixed-size audio buffers for consistent playback
      while (this.processingBuffer.length >= this.bufferSize) {
        const chunk = this.processingBuffer.slice(0, this.bufferSize);
        const audioBuffer = this.audioCtx.createBuffer(
          1,
          chunk.length,
          this.sampleRate,
        );
        audioBuffer.getChannelData(0).set(chunk);
        this.audioQueue.push(audioBuffer);

        this.processingBuffer = this.processingBuffer.slice(this.bufferSize);
      }

      // Start scheduled playback if not already playing
      if (!this._isPlaying && this.audioQueue.length > 0) {
        console.log(`[GeminiAudioHandler] Starting playback - queue: ${this.audioQueue.length}, AudioContext: ${this.audioCtx?.state}`);
        this.startScheduledPlayback();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[GeminiAudioHandler] Failed to play chunk:', err);
      this.emit('error', err);
    }
  }

  /**
   * Flush any remaining audio in the processing buffer
   * Call this when stream is complete (is_final=true)
   */
  complete(): void {
    this.turnCount++;
    console.log(`[GeminiAudioHandler] ✅ Turn ${this.turnCount} complete() - ${this.chunkCount} chunks received, processingBuffer: ${this.processingBuffer.length} samples, isPlaying: ${this._isPlaying}, queueLength: ${this.audioQueue.length}`);

    // Reset chunk counter for next turn
    this.chunkCount = 0;

    if (!this.audioCtx) {
      console.warn('[GeminiAudioHandler] complete() - no audioCtx, skipping');
      return;
    }

    if (this.processingBuffer.length === 0) {
      console.log('[GeminiAudioHandler] complete() - buffer already empty, nothing to flush');
      return;
    }

    // Create buffer from remaining samples
    const audioBuffer = this.audioCtx.createBuffer(
      1,
      this.processingBuffer.length,
      this.sampleRate,
    );
    audioBuffer.getChannelData(0).set(this.processingBuffer);
    this.audioQueue.push(audioBuffer);

    const flushedSamples = this.processingBuffer.length;
    this.processingBuffer = new Float32Array(0);

    console.log('[GeminiAudioHandler] Flushed', flushedSamples, 'samples to queue. New queueLength:', this.audioQueue.length);

    // Continue playback if playing
    if (this._isPlaying) {
      this.scheduleBuffers();
    } else if (this.audioQueue.length > 0) {
      console.log('[GeminiAudioHandler] Starting playback after flush');
      this.startScheduledPlayback();
    }
  }

  /**
   * Start scheduled playback with initial buffer delay
   */
  private startScheduledPlayback(): void {
    if (!this.audioCtx || !this.gainNode) {
      console.error('[GeminiAudioHandler] Missing audioCtx or gainNode!');
      return;
    }

    // CRITICAL: Ensure AudioContext is running
    if (this.audioCtx.state === 'suspended') {
      console.warn('[GeminiAudioHandler] AudioContext suspended, resuming...');
      this.audioCtx.resume().then(() => {
        this.startScheduledPlayback();
      }).catch((err) => {
        console.error('[GeminiAudioHandler] Failed to resume AudioContext:', err);
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      });
      return;
    }

    this._isPlaying = true;
    this.emit('start');

    // Initialize scheduled time with initial buffer delay
    this.scheduledTime = this.audioCtx.currentTime + this.INITIAL_BUFFER_TIME;

    console.log('[GeminiAudioHandler] Starting scheduled playback');
    console.log('[GeminiAudioHandler] Initial buffer:', this.INITIAL_BUFFER_TIME * 1000, 'ms');
    console.log('[GeminiAudioHandler] Look-ahead:', this.SCHEDULE_AHEAD_TIME * 1000, 'ms');

    // Schedule initial buffers
    this.scheduleBuffers();
  }

  /**
   * Schedule buffers for gapless playback using look-ahead
   */
  private scheduleBuffers(): void {
    if (!this.audioCtx || !this.gainNode || !this.analyzerNode) {
      return;
    }

    // Schedule buffers up to SCHEDULE_AHEAD_TIME in the future
    while (
      this.audioQueue.length > 0 &&
      this.scheduledTime < this.audioCtx.currentTime + this.SCHEDULE_AHEAD_TIME
    ) {
      const audioBuffer = this.audioQueue.shift()!;

      // Create source node
      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;

      // Track active source for cleanup on stop()
      this.activeSources.add(source);

      // PARALLEL ROUTING (matches reference): source connects to BOTH nodes
      source.connect(this.gainNode);       // Audio playback path

      // Connect to analyzer AND re-set onmessage (reference does this each time)
      source.connect(this.analyzerNode);
      this.analyzerNode.port.onmessage = (ev: MessageEvent) => {
        const rawShape = ev.data as MouthShape;
        if (rawShape) {
          this._currentMouthShape = this.smoothMouthShape(rawShape);
          this.emit('mouthShape', this._currentMouthShape);
        }
      };
      this.analyzerNode.connect(this.audioCtx.destination);

      // Schedule at precise time (not "now") for gapless playback
      const startTime = Math.max(this.scheduledTime, this.audioCtx.currentTime);
      source.start(startTime);

      // Update scheduled time for next buffer
      this.scheduledTime = startTime + audioBuffer.duration;

      // Clean up source when it ends naturally
      source.onended = () => {
        // Remove from active sources
        this.activeSources.delete(source);
        source.disconnect();

        // Check if more buffers were added while this one was playing
        if (this.audioQueue.length === 0 && this.processingBuffer.length === 0 && this.activeSources.size === 0) {
          this._isPlaying = false;
          this.emit('queueEmpty');
          this.emit('stop');
          console.log('[GeminiAudioHandler] Playback complete, queue empty');
        } else if (this.audioQueue.length > 0) {
          // More buffers were added, continue scheduling
          this.scheduleBuffers();
        }
      };
    }

    // Schedule next check if there are more buffers to schedule
    if (this.audioQueue.length > 0 && this._isPlaying) {
      // Clear existing timer
      if (this.scheduleTimer) {
        clearTimeout(this.scheduleTimer);
      }

      // Check again when we need to schedule more
      const nextCheckTime = (this.scheduledTime - this.audioCtx.currentTime - this.SCHEDULE_AHEAD_TIME / 2) * 1000;
      this.scheduleTimer = setTimeout(() => {
        this.scheduleBuffers();
      }, Math.max(0, nextCheckTime));
    }
  }

  /**
   * Stop all audio playback and clear queue
   *
   * Call this on user interruption to immediately stop audio.
   */
  stop(): void {
    console.log(`[GeminiAudioHandler] 🛑 stop() called - turn ${this.turnCount}, chunks: ${this.chunkCount}, isPlaying: ${this._isPlaying}, queueLen: ${this.audioQueue.length}, activeSources: ${this.activeSources.size}`);

    // Clear scheduling timer
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }

    // CRITICAL: Stop and disconnect all active BufferSourceNodes
    // Without this, old sources continue playing and cause issues on next turn
    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Source might have already ended naturally
      }
    });
    this.activeSources.clear();

    // Clear queues and buffers
    this.audioQueue = [];
    this.processingBuffer = new Float32Array(0);
    this._isPlaying = false;

    // Reset scheduled time
    this.scheduledTime = 0;

    // Reset mouth shape to closed
    this._currentMouthShape = {
      jawOpen: 0,
      mouthOpen: 0,
      mouthSmile: 0,
      mouthFunnel: 0,
      mouthPucker: 0,
    };
    this.emit('mouthShape', this._currentMouthShape);
    this.emit('stop');

    console.log('[GeminiAudioHandler] Stopped and cleared queue');
  }

  /**
   * Set smoothing factor for mouth shape transitions
   *
   * @param factor - Smoothing factor (0-1, higher = less smoothing)
   */
  setSmoothingFactor(factor: number): void {
    this.smoothingFactor = Math.max(0, Math.min(1, factor));
  }

  /**
   * Clean up resources
   *
   * Call this when done with the handler.
   * Releases the AudioContext from cache to free system resources.
   */
  dispose(): void {
    this.stop();

    if (this.analyzerNode) {
      this.analyzerNode.disconnect();
      this.analyzerNode = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    // Release AudioContext from cache and close it
    // This prevents memory leaks when handler is recreated multiple times
    releaseAudioContext('gemini-audio');
    this.audioCtx = null;
    this._isInitialized = false;
    this.listeners.clear();

    console.log('[GeminiAudioHandler] Disposed');
  }
}

export default GeminiAudioHandler;
