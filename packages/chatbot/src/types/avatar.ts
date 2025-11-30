import type { ViewType, EmotionType, GestureType } from './avatar-websocket';

/**
 * Avatar loading and playback state
 */
export interface AvatarState {
  isLoading: boolean;
  loadingProgress: number;    // 0-100
  isConnected: boolean;
  isPlaying: boolean;
  isSynthesizing: boolean;
  currentText: string;
  error: string | null;
}

/**
 * Voice configuration for TTS
 */
export interface VoiceConfig {
  /** Voice name (e.g., 'en-US-JennyNeural') */
  voice: string;
  /** Language locale (e.g., 'en-US') */
  locale: string;
  /** Voice gender */
  gender: 'male' | 'female';
  /** Speaking rate (0.5 = 50% speed, 1.0 = normal, 2.0 = 200% speed) */
  speakingRate?: number;
}

/**
 * Local avatar configuration (for component props)
 * Distinct from WebSocketAvatarConfig which is for session config
 */
export interface LocalAvatarConfig {
  /** GLB model URL */
  model: string;
  /** Avatar gender */
  gender: 'male' | 'female';
  /** Current expression/mood */
  expression: string;
  /** Current pose */
  pose: string;
}

/**
 * TTS message to send to Azure Speech SDK
 */
export interface TTSMessage {
  text: string;
  voice: VoiceConfig;
}

/**
 * Viseme data from Azure Speech SDK
 */
export interface VisemeData {
  /** Time offset in milliseconds */
  time: number;
  /** Viseme ID (0-21 for Azure) */
  viseme: string;
  /** Blend weight (0-1) */
  blend: number;
}

/**
 * Viseme event with additional tracking info
 */
export interface VisemeEvent extends VisemeData {
  id: string;
  processed: boolean;
}

/**
 * Audio chunk for streaming playback
 */
export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
  sequenceNumber: number;
}

/**
 * Connection state for WebSocket/Socket.IO
 */
export interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  error?: string;
  retryCount: number;
  lastConnected?: number;
}

/**
 * Service configuration
 */
export interface ServiceConfig {
  websocketUrl: string;
  healthCheckUrl: string;
  maxRetries: number;
  retryDelay: number;
  heartbeatInterval: number;
  timeout: number;
}

// Re-export types from avatar-websocket for convenience
export type { ViewType, EmotionType, GestureType };
