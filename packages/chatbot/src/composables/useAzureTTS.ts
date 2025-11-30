import { ref, onUnmounted, type Ref, type ComputedRef, computed } from 'vue';
import type { VoiceConfig } from '../types/index';

// Azure viseme map (21 visemes -> TalkingHead phonemes)
const VISEME_MAP = [
  /* 0  */ "sil", /* 1  */ "aa", /* 2  */ "aa", /* 3  */ "O",
  /* 4  */ "E",   /* 5  */ "RR", /* 6  */ "I",  /* 7  */ "U",
  /* 8  */ "O",   /* 9  */ "O",  /* 10 */ "O",  /* 11 */ "I",
  /* 12 */ "kk",  /* 13 */ "RR", /* 14 */ "nn", /* 15 */ "SS",
  /* 16 */ "CH",  /* 17 */ "TH", /* 18 */ "FF", /* 19 */ "DD",
  /* 20 */ "kk",  /* 21 */ "PP"
];

// Declare Azure Speech SDK global
declare global {
  interface Window {
    SpeechSDK: any;
  }
}

export interface UseAzureTTSOptions {
  /** Avatar instance for streaming */
  getAvatarInstance: () => any;
  /** Callback when synthesis starts */
  onStart?: () => void;
  /** Callback when synthesis ends */
  onEnd?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseAzureTTSReturn {
  isSynthesizing: ComputedRef<boolean>;
  speak: (text: string, voice: VoiceConfig) => Promise<void>;
  stop: () => void;
  cleanup: () => void;
}

export function useAzureTTS(options: UseAzureTTSOptions): UseAzureTTSReturn {
  const { getAvatarInstance, onStart, onEnd, onError } = options;

  const _isSynthesizing = ref(false);

  // Refs for SDK instances
  let synthesizer: any = null;

  // Viseme buffers (exact React pattern)
  const visemeBuffer = {
    visemes: [] as string[],
    vtimes: [] as number[],
    vdurations: [] as number[],
  };
  const wordBuffer = {
    words: [] as string[],
    wtimes: [] as number[],
    wdurations: [] as number[],
  };
  let prevViseme: { viseme: string; vtime: number } | null = null;

  function resetBuffers() {
    visemeBuffer.visemes = [];
    visemeBuffer.vtimes = [];
    visemeBuffer.vdurations = [];
    wordBuffer.words = [];
    wordBuffer.wtimes = [];
    wordBuffer.wdurations = [];
    prevViseme = null;
  }

  /**
   * Initialize Azure Speech SDK synthesizer
   */
  function initSynthesizer(): void {
    if (synthesizer || !window.SpeechSDK) {
      return;
    }

    console.log('[useAzureTTS] Initializing Azure Speech SDK...');

    // Dynamic proxy URL (supports dev, staging, production)
    const PROXY_HOST = window.location.hostname || 'localhost';
    const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || '8001';
    const PROXY_WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${PROXY_WS_PROTOCOL}://${PROXY_HOST}:${BACKEND_PORT}/ws/tts/cognitiveservices/websocket/v1`;

    console.log('[useAzureTTS] Endpoint:', wsUrl);

    const speechConfig = window.SpeechSDK.SpeechConfig.fromEndpoint(
      new URL(wsUrl),
      "dummy_key"  // Backend proxy handles real authentication
    );

    // CRITICAL: Output format must match TalkingHead's expected format
    speechConfig.speechSynthesisOutputFormat =
      window.SpeechSDK.SpeechSynthesisOutputFormat.Raw48Khz16BitMonoPcm;

    synthesizer = new window.SpeechSDK.SpeechSynthesizer(speechConfig, null);

    // Handle streaming audio chunks
    synthesizer.synthesizing = (_s: any, e: any) => {
      const avatar = getAvatarInstance();
      if (!avatar) return;

      // Stream audio with buffered visemes
      avatar.streamAudio?.({
        audio: e.result.audioData,
        visemes: visemeBuffer.visemes.splice(0),
        vtimes: visemeBuffer.vtimes.splice(0),
        vdurations: visemeBuffer.vdurations.splice(0),
      });
    };

    // Handle viseme events
    synthesizer.visemeReceived = (_s: any, e: any) => {
      const avatar = getAvatarInstance();
      if (!avatar?.isStreaming) return;

      const vtime = e.audioOffset / 10000; // Convert to ms
      const viseme = VISEME_MAP[e.visemeId];

      // Calculate duration from previous viseme
      if (prevViseme) {
        let vduration = vtime - prevViseme.vtime;
        if (vduration < 40) vduration = 40; // Minimum duration

        visemeBuffer.visemes.push(prevViseme.viseme);
        visemeBuffer.vtimes.push(prevViseme.vtime);
        visemeBuffer.vdurations.push(vduration);
      }
      prevViseme = { viseme, vtime };
    };

    // Handle word boundaries (for subtitles)
    synthesizer.wordBoundary = (_s: any, e: any) => {
      const word = e.text;
      const time = e.audioOffset / 10000;
      const duration = e.duration / 10000;

      if (e.boundaryType === "PunctuationBoundary" && wordBuffer.words.length) {
        // Merge punctuation with previous word
        wordBuffer.words[wordBuffer.words.length - 1] += word;
        wordBuffer.wdurations[wordBuffer.wdurations.length - 1] += duration;
      } else if (e.boundaryType === "WordBoundary" || e.boundaryType === "PunctuationBoundary") {
        wordBuffer.words.push(word);
        wordBuffer.wtimes.push(time);
        wordBuffer.wdurations.push(duration);
      }
    };

    console.log('[useAzureTTS] Initialized');
  }

  /**
   * Convert text to SSML with optional speaking rate
   */
  function textToSSML(text: string, voice: string, speakingRate?: number): string {
    const lang = voice.startsWith('he-') ? 'he-IL' : 'en-US';
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const needsProsody = speakingRate !== undefined && speakingRate !== 1.0;
    const ratePercent = speakingRate ? `${Math.round(speakingRate * 100)}%` : '100%';

    if (needsProsody) {
      return `<speak version="1.0" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${lang}">
        <voice name="${voice}">
          <mstts:viseme type="FacialExpression" />
          <prosody rate="${ratePercent}">${escapedText}</prosody>
        </voice>
      </speak>`;
    }

    return `<speak version="1.0" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${lang}">
      <voice name="${voice}">
        <mstts:viseme type="FacialExpression" />
        ${escapedText}
      </voice>
    </speak>`;
  }

  /**
   * Speak text with Azure TTS
   */
  async function speak(text: string, voice: VoiceConfig): Promise<void> {
    const avatar = getAvatarInstance();
    if (!avatar) {
      throw new Error('Avatar not initialized');
    }

    if (!window.SpeechSDK) {
      throw new Error('Azure Speech SDK not loaded');
    }

    // Initialize synthesizer if needed
    if (!synthesizer) {
      initSynthesizer();
    }

    console.log('[useAzureTTS] Speaking:', { text, voice: voice.voice, rate: voice.speakingRate });

    try {
      _isSynthesizing.value = true;
      resetBuffers();

      // Start streaming on TalkingHead
      avatar.streamStart?.(
        { sampleRate: 48000, mood: 'neutral', gain: 0.5, lipsyncType: 'visemes' },
        () => { onStart?.(); },
        () => { onEnd?.(); _isSynthesizing.value = false; }
      );

      // Create SSML
      const ssml = textToSSML(text, voice.voice, voice.speakingRate);

      // Synthesize
      await new Promise<void>((resolve, reject) => {
        synthesizer.speakSsmlAsync(
          ssml,
          (result: any) => {
            if (result.reason === window.SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              console.log('[useAzureTTS] Synthesis completed');

              // Handle final viseme
              if (prevViseme) {
                visemeBuffer.visemes.push(prevViseme.viseme);
                visemeBuffer.vtimes.push(prevViseme.vtime);
                visemeBuffer.vdurations.push(100); // Final duration
                prevViseme = null;
              }

              // Stream remaining data
              if (visemeBuffer.visemes.length || wordBuffer.words.length) {
                avatar.streamAudio?.({
                  audio: new ArrayBuffer(0),
                  visemes: visemeBuffer.visemes.splice(0),
                  vtimes: visemeBuffer.vtimes.splice(0),
                  vdurations: visemeBuffer.vdurations.splice(0),
                  words: wordBuffer.words.splice(0),
                  wtimes: wordBuffer.wtimes.splice(0),
                  wdurations: wordBuffer.wdurations.splice(0),
                });
              }

              avatar.streamNotifyEnd?.();
              resetBuffers();
              resolve();
            } else {
              reject(new Error(result.errorDetails || 'Synthesis failed'));
            }
          },
          (error: any) => {
            console.error('[useAzureTTS] Error:', error);
            resetBuffers();
            reject(error);
          }
        );
      });

    } catch (err) {
      console.error('[useAzureTTS] Failed:', err);
      _isSynthesizing.value = false;
      onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  function stop() {
    const avatar = getAvatarInstance();
    avatar?.stop?.();
    _isSynthesizing.value = false;
    resetBuffers();
  }

  function cleanup() {
    if (synthesizer) {
      synthesizer.close();
      synthesizer = null;
    }
    resetBuffers();
  }

  onUnmounted(() => {
    cleanup();
  });

  return {
    isSynthesizing: computed(() => _isSynthesizing.value),
    speak,
    stop,
    cleanup,
  };
}
