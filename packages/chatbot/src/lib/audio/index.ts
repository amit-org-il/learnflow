/**
 * Audio Library Exports
 */

// Audio utilities
export {
  audioContext,
  releaseAudioContext,
  releaseAllAudioContexts,
  base64ToArrayBuffer,
  arrayBufferToBase64,
  blobToJSON,
  type GetAudioContextOptions,
} from './audio-utils';

// Audio unlock
export {
  isAudioUnlocked,
  unlockAudio,
  cleanupAudio,
} from './audio-unlock';

// AudioWorklet utilities
export {
  createWorkletFromSrc,
  registeredWorklets,
  type WorkletGraph,
} from './audioworklet-registry';

// Gemini audio handler
export { GeminiAudioHandler, type GeminiAudioHandlerEvents } from './GeminiAudioHandler';

// Worklets
export { default as SmartMouthAnalyzer, type MouthShape } from './worklets/smart-mouth-analyzer';
