# Phase 2: TypeScript Types

**Estimated Time:** 1.5 hours
**Prerequisites:** Phase 1 complete

---

## Tasks

- [ ] **2.1** Create `avatar-websocket.ts` (Socket.IO message types)
- [ ] **2.2** Create `avatar.ts` (state types)
- [ ] **2.3** Create `talking-head.d.ts` (TalkingHead type definitions)
- [ ] **2.4** Create `index.ts` (barrel export)
- [ ] **2.5** Verify types compile

---

## Task 2.1: Create WebSocket Message Types

**File:** `src/types/avatar-websocket.ts`

> **CRITICAL:** These types MUST match the backend Pydantic models exactly. See `backend/models.py` for reference.

```typescript
/**
 * WebSocket Protocol Message Types
 *
 * TypeScript definitions matching backend Pydantic models exactly.
 * These types define the complete protocol for backend-frontend WebSocket communication.
 *
 * @see backend/models.py for Python Pydantic model definitions
 */

// ========================================
// ENUMS - Avatar Control Types
// ========================================

/**
 * Available emotion types for the avatar
 * Matches Python: EmotionType(str, Enum)
 */
export const EmotionType = {
  HAPPY: "happy",
  SAD: "sad",
  ANGRY: "angry",
  EXCITED: "excited",
  LOVE: "love",
  SURPRISED: "surprised",
  NEUTRAL: "neutral",
} as const;

export type EmotionType = (typeof EmotionType)[keyof typeof EmotionType];

/**
 * Available gesture types for the avatar (matches TalkingHead.js)
 * Matches Python: GestureType(str, Enum)
 */
export const GestureType = {
  HANDUP: "handup",       // Raise hand (stop)
  INDEX: "index",         // Point with index finger
  OK: "ok",               // OK sign
  THUMBUP: "thumbup",     // Thumbs up
  THUMBDOWN: "thumbdown", // Thumbs down
  SIDE: "side",           // Hand to side
  SHRUG: "shrug",         // Shrug
  NAMASTE: "namaste",     // Prayer hands
} as const;

export type GestureType = (typeof GestureType)[keyof typeof GestureType];

/**
 * Available camera view types for the avatar
 * Matches Python: ViewType(str, Enum)
 *
 * NOTE: Only 'head', 'body', 'full' - NO 'upper' (does not exist in backend)
 */
export const ViewType = {
  HEAD: "head",
  BODY: "body",
  FULL: "full",
} as const;

export type ViewType = (typeof ViewType)[keyof typeof ViewType];

/**
 * Available lighting presets for the avatar
 * Matches Python: LightingPreset(str, Enum)
 */
export const LightingPreset = {
  DEFAULT: "default",
  STUDIO: "studio",
  OUTDOOR: "outdoor",
  DRAMATIC: "dramatic",
  SOFT: "soft",
  NIGHT: "night",
} as const;

export type LightingPresetType = (typeof LightingPreset)[keyof typeof LightingPreset];

/**
 * Lighting configuration options for TalkingHead.setLighting()
 * Matches Python: LightingOptions(BaseModel)
 */
export interface LightingOptions {
  /** Ambient light color (hex: 0x000000 - 0xFFFFFF) */
  lightAmbientColor?: number;
  /** Ambient brightness (0-10, default: 2) */
  lightAmbientIntensity?: number;
  /** Directional light color (hex) */
  lightDirectColor?: number;
  /** Directional brightness (0-100, default: 30) */
  lightDirectIntensity?: number;
  /** Directional angle vertical (radians 0-6.28) */
  lightDirectPhi?: number;
  /** Directional angle horizontal (radians 0-6.28) */
  lightDirectTheta?: number;
  /** Spotlight color (hex) */
  lightSpotColor?: number;
  /** Spotlight brightness (0-100, default: 0 = off) */
  lightSpotIntensity?: number;
  /** Spotlight angle vertical (radians) */
  lightSpotPhi?: number;
  /** Spotlight angle horizontal (radians) */
  lightSpotTheta?: number;
  /** Spotlight spread (radians 0-3.14) */
  lightSpotDispersion?: number;
}

// ========================================
// SESSION CONFIGURATION MODELS
// ========================================

/**
 * TTS provider configuration
 * Matches Python: TTSConfig(BaseModel)
 */
export interface TTSConfig {
  /** TTS provider type */
  provider: "azure" | "gemini-live";
  /** Voice identifier (e.g., 'he-IL-AvriNeural') */
  voice_id: string;
  /** Language locale (e.g., 'he-IL', 'en-US') */
  locale: string;
  /** Voice gender for avatar selection */
  gender: "male" | "female";
  /** Speaking rate (0.5 = 50% speed, 1.0 = normal, 2.0 = 200% speed) */
  speaking_rate?: number;
}

/**
 * Avatar model configuration (for WebSocket SessionConfig)
 * Matches Python: AvatarConfig(BaseModel)
 */
export interface WebSocketAvatarConfig {
  /** Avatar .glb model URL */
  url: string;
  /** Avatar gender */
  gender: "male" | "female";
  /** Initial avatar mood */
  initial_mood: EmotionType;
  /** Initial camera view */
  initial_view: ViewType;
}

/**
 * Complete session configuration for WebSocket connection
 * Matches Python: SessionConfig(BaseModel)
 */
export interface SessionConfig {
  /** TTS configuration */
  tts: TTSConfig;
  /** Avatar configuration */
  avatar: WebSocketAvatarConfig;
  /** Avatar background - URL (image) or CSS value (color/gradient) */
  background?: string;
}

// ========================================
// BACKEND → FRONTEND MESSAGE TYPES
// ========================================

/**
 * Initial message sent when WebSocket connection is established
 * Matches Python: SessionStartMessage(BaseModel)
 */
export interface SessionStartMessage {
  type: "session_start";
  /** Unique session identifier */
  session_id: string;
  /** Session configuration (TTS + avatar) */
  config: SessionConfig;
  /** TRUE if reconnecting to existing session */
  is_resumed?: boolean;
}

/**
 * Speak message for Azure TTS mode - frontend synthesizes audio
 * Matches Python: AzureSpeakMessage(BaseModel)
 */
export interface AzureSpeakMessage {
  type: "speak";
  /** Discriminator field */
  provider: "azure";
  /** Voice ID for Azure TTS (e.g., "en-US-GuyNeural") */
  voice_id?: string;
  /** Text to speak */
  text: string;
  /** Unique message ID for tracking completion */
  message_id: string;
  /** Optional metadata */
  metadata?: MessageMetadata;
}

/**
 * Speak message for Gemini Live mode - backend streams audio chunks
 * Matches Python: GeminiSpeakMessage(BaseModel)
 */
export interface GeminiSpeakMessage {
  type: "speak";
  /** Discriminator field */
  provider: "gemini-live";
  /** Base64-encoded 24kHz PCM16 mono little-endian audio */
  audio_chunk: string;
  /** Text chunk for display/subtitles */
  text_chunk: string;
  /** Audio sample rate */
  sample_rate: number;
  /** Whether this is the final chunk */
  is_final: boolean;
  /** Unique message ID for tracking completion */
  message_id: string;
  /** Optional metadata */
  metadata?: MessageMetadata;
}

/**
 * Discriminated union for speak messages
 */
export type SpeakMessage = AzureSpeakMessage | GeminiSpeakMessage;

/**
 * Control avatar gestures, moods, camera views, or emoji reactions
 * Matches Python: AvatarControlMessage(BaseModel)
 */
export interface AvatarControlMessage {
  type: "avatar_control";
  /** Avatar control command type */
  command: "gesture" | "mood" | "view" | "stop_gesture" | "emoji" | "lighting";
  /** Command parameters */
  params: AvatarControlParams;
}

/**
 * Avatar control parameters (typed instead of Record<string, any>)
 */
export interface AvatarControlParams {
  gesture?: GestureType;
  mood?: EmotionType;
  view?: ViewType;
  emoji?: string;
  duration?: number;
  level?: number;
  preset?: LightingPresetType;
  options?: LightingOptions;
}

/**
 * Update session configuration (voice/avatar switch)
 * Matches Python: ConfigUpdateMessage(BaseModel)
 */
export interface ConfigUpdateMessage {
  type: "config_update";
  /** Updated session configuration */
  config: SessionConfig;
}

/**
 * Server error message
 * Matches Python: ServerErrorMessage(BaseModel)
 */
export interface ServerErrorMessage {
  type: "server_error";
  /** Error message */
  error: string;
  /** Error code */
  code?: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Union type for all backend → frontend messages
 */
export type BackendMessage =
  | SessionStartMessage
  | AzureSpeakMessage
  | GeminiSpeakMessage
  | AvatarControlMessage
  | ConfigUpdateMessage
  | ServerErrorMessage;

// ========================================
// FRONTEND → BACKEND MESSAGE TYPES
// ========================================

/**
 * Frontend signals it's ready to receive commands
 * Matches Python: ReadyMessage(BaseModel)
 */
export interface ReadyMessage {
  type: "ready";
  /** Avatar model loaded successfully */
  avatar_loaded: boolean;
  /** TTS system initialized successfully */
  tts_initialized: boolean;
}

/**
 * Frontend signals speech synthesis completed
 * Matches Python: SpeechCompleteMessage(BaseModel)
 */
export interface SpeechCompleteMessage {
  type: "speech_complete";
  /** ID of the speak message that completed */
  message_id: string;
}

/**
 * Frontend reports an error to backend
 * Matches Python: ErrorMessage(BaseModel)
 */
export interface ClientErrorMessage {
  type: "error";
  /** Error message */
  error: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * User interrupts avatar (wants to speak)
 * Matches Python: UserInterruptMessage(BaseModel)
 */
export interface UserInterruptMessage {
  type: "user_interrupt";
  /** Timestamp when user triggered interrupt */
  timestamp: number;
}

/**
 * User text input for AI chatbot integration
 * Matches Python: UserMessage(BaseModel)
 */
export interface UserTextMessage {
  type: "user_message";
  /** User's text input */
  text: string;
  /** Language code (e.g., 'en', 'he') */
  language?: string;
  /** Message timestamp */
  timestamp: number;
}

/**
 * User voice input for real-time voice streaming to Gemini Live
 * Matches Python: UserVoiceMessage(BaseModel)
 */
export interface UserVoiceMessage {
  type: "user_voice";
  /** Base64-encoded 16kHz PCM16 mono little-endian audio */
  audio_chunk: string;
  /** Audio sample rate (16kHz) */
  sample_rate: number;
  /** Whether this is the final audio chunk */
  is_final: boolean;
}

/**
 * Ping message for connection keep-alive
 */
export interface PingMessage {
  type: "ping";
  timestamp: number;
}

/**
 * Pong response to ping
 */
export interface PongMessage {
  type: "pong";
  timestamp: number;
}

/**
 * Union type for all frontend → backend messages
 */
export type FrontendMessage =
  | ReadyMessage
  | SpeechCompleteMessage
  | ClientErrorMessage
  | UserInterruptMessage
  | UserTextMessage
  | UserVoiceMessage
  | PingMessage;

// ========================================
// METADATA TYPES
// ========================================

/**
 * Message metadata (typed instead of Record<string, any>)
 */
export interface MessageMetadata {
  /** Source of the message (e.g., 'llm', 'user', 'system') */
  source?: string;
  /** Conversation turn number */
  turn?: number;
  /** Language code */
  language?: string;
  /** Custom fields */
  [key: string]: unknown;
}

// ========================================
// EXTENSIBLE MESSAGE PATTERN
// ========================================

/**
 * Base type for custom message types using 'custom:*' namespace
 */
export interface CustomMessage {
  /** Message type (must start with 'custom:') */
  type: `custom:${string}`;
  /** Custom parameters for the message */
  params: Record<string, unknown>;
}

// ========================================
// COMPLETE MESSAGE UNION
// ========================================

/**
 * Union type for all WebSocket messages (both directions + custom)
 */
export type Message = BackendMessage | FrontendMessage | CustomMessage | PongMessage;

// ========================================
// TYPE GUARDS
// ========================================

/**
 * Type guard to check if a message is a SessionStartMessage
 */
export function isSessionStartMessage(msg: unknown): msg is SessionStartMessage {
  return isObject(msg) && msg.type === "session_start";
}

/**
 * Type guard to check if a message is an AzureSpeakMessage
 */
export function isAzureSpeakMessage(msg: unknown): msg is AzureSpeakMessage {
  return isObject(msg) && msg.type === "speak" && msg.provider === "azure";
}

/**
 * Type guard to check if a message is a GeminiSpeakMessage
 */
export function isGeminiSpeakMessage(msg: unknown): msg is GeminiSpeakMessage {
  return isObject(msg) && msg.type === "speak" && msg.provider === "gemini-live";
}

/**
 * Type guard to check if a message is any SpeakMessage (Azure or Gemini)
 */
export function isSpeakMessage(msg: unknown): msg is SpeakMessage {
  return isObject(msg) && msg.type === "speak";
}

/**
 * Type guard to check if a message is an AvatarControlMessage
 */
export function isAvatarControlMessage(msg: unknown): msg is AvatarControlMessage {
  return isObject(msg) && msg.type === "avatar_control";
}

/**
 * Type guard to check if a message is a ConfigUpdateMessage
 */
export function isConfigUpdateMessage(msg: unknown): msg is ConfigUpdateMessage {
  return isObject(msg) && msg.type === "config_update";
}

/**
 * Type guard to check if a message is a ServerErrorMessage
 */
export function isServerErrorMessage(msg: unknown): msg is ServerErrorMessage {
  return isObject(msg) && msg.type === "server_error";
}

/**
 * Type guard to check if a message is a ReadyMessage
 */
export function isReadyMessage(msg: unknown): msg is ReadyMessage {
  return isObject(msg) && msg.type === "ready";
}

/**
 * Type guard to check if a message is a SpeechCompleteMessage
 */
export function isSpeechCompleteMessage(msg: unknown): msg is SpeechCompleteMessage {
  return isObject(msg) && msg.type === "speech_complete";
}

/**
 * Type guard to check if a message is a ClientErrorMessage
 */
export function isClientErrorMessage(msg: unknown): msg is ClientErrorMessage {
  return isObject(msg) && msg.type === "error";
}

/**
 * Type guard to check if a message is a UserInterruptMessage
 */
export function isUserInterruptMessage(msg: unknown): msg is UserInterruptMessage {
  return isObject(msg) && msg.type === "user_interrupt";
}

/**
 * Type guard to check if a message is a UserTextMessage
 */
export function isUserTextMessage(msg: unknown): msg is UserTextMessage {
  return isObject(msg) && msg.type === "user_message";
}

/**
 * Type guard to check if a message is a UserVoiceMessage
 */
export function isUserVoiceMessage(msg: unknown): msg is UserVoiceMessage {
  return isObject(msg) && msg.type === "user_voice";
}

/**
 * Type guard to check if a message is a PingMessage
 */
export function isPingMessage(msg: unknown): msg is PingMessage {
  return isObject(msg) && msg.type === "ping";
}

/**
 * Type guard to check if a message is a PongMessage
 */
export function isPongMessage(msg: unknown): msg is PongMessage {
  return isObject(msg) && msg.type === "pong";
}

/**
 * Type guard to check if a message is a CustomMessage
 */
export function isCustomMessage(msg: unknown): msg is CustomMessage {
  return isObject(msg) && typeof msg.type === "string" && msg.type.startsWith("custom:");
}

/**
 * Type guard to check if a message is from backend (backend → frontend)
 */
export function isBackendMessage(msg: unknown): msg is BackendMessage {
  return (
    isSessionStartMessage(msg) ||
    isSpeakMessage(msg) ||
    isAvatarControlMessage(msg) ||
    isConfigUpdateMessage(msg) ||
    isServerErrorMessage(msg)
  );
}

/**
 * Type guard to check if a message is from frontend (frontend → backend)
 */
export function isFrontendMessage(msg: unknown): msg is FrontendMessage {
  return (
    isReadyMessage(msg) ||
    isSpeechCompleteMessage(msg) ||
    isClientErrorMessage(msg) ||
    isUserInterruptMessage(msg) ||
    isUserTextMessage(msg) ||
    isUserVoiceMessage(msg) ||
    isPingMessage(msg)
  );
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Helper to check if value is an object with type field
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && "type" in value;
}

/**
 * Parse a JSON string into a Message object
 * @throws Error if JSON is invalid or message type is unknown
 */
export function parseMessage(jsonStr: string): Message {
  let data: unknown;

  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!isObject(data)) {
    throw new Error("Message must be an object with 'type' field");
  }

  // Custom messages (extensible pattern)
  if (typeof data.type === "string" && data.type.startsWith("custom:")) {
    return data as CustomMessage;
  }

  // Validate known message types
  const validTypes = [
    "session_start",
    "speak",
    "avatar_control",
    "config_update",
    "server_error",
    "ready",
    "speech_complete",
    "error",
    "user_interrupt",
    "user_message",
    "user_voice",
    "ping",
    "pong",
  ];

  if (!validTypes.includes(data.type as string)) {
    throw new Error(`Unknown message type: ${data.type}`);
  }

  // Special validation for 'speak' message - must have provider
  if (data.type === "speak") {
    if (!data.provider || !["azure", "gemini-live"].includes(data.provider as string)) {
      throw new Error(
        `Speak message must have valid 'provider' field (azure or gemini-live), got: ${data.provider}`
      );
    }
  }

  return data as Message;
}

/**
 * Serialize a message object to JSON string
 */
export function serializeMessage(msg: Message): string {
  return JSON.stringify(msg);
}

/**
 * Validate that a custom message type follows the 'custom:' prefix pattern
 * @throws Error if type doesn't start with 'custom:'
 */
export function validateCustomMessageType(type: string): void {
  if (!type.startsWith("custom:")) {
    throw new Error(
      `Custom message type must start with 'custom:' prefix, got: ${type}`
    );
  }
}
```

---

## Task 2.2: Create Avatar State Types

**File:** `src/types/avatar.ts`

> **NOTE:** `AvatarConfig` here is renamed to `LocalAvatarConfig` to avoid collision with `WebSocketAvatarConfig` in avatar-websocket.ts.

```typescript
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
```

---

## Task 2.3: Create TalkingHead Type Definitions

**File:** `src/types/talking-head.d.ts`

> **NOTE:** This file provides TypeScript type definitions for the TalkingHead.js library loaded from `public/lib/talkinghead/`.

```typescript
/**
 * TalkingHead Type Definitions
 *
 * Type definitions for the TalkingHead.js library.
 * Based on: https://github.com/met4citizen/TalkingHead
 *
 * These types provide IntelliSense support and compile-time type checking
 * for TalkingHead interactions.
 */

// Module declaration for dynamic import from public folder
declare module '/lib/talkinghead/talkinghead.mjs' {
  export class TalkingHead {
    constructor(container: HTMLElement, options?: TalkingHeadOptions);

    /**
     * Load and display an avatar
     * @param options Avatar loading options
     * @param onProgress Progress callback (0-100)
     */
    showAvatar(
      options: ShowAvatarOptions,
      onProgress?: (progress: number) => void
    ): Promise<void>;

    /**
     * Remove the current avatar from the scene
     */
    deleteAvatar(): void;

    /**
     * Set avatar mood/emotion
     * @param mood Emotion name (happy, sad, angry, etc.)
     * @param level Intensity 0-1 (default: 1)
     */
    setMood(mood: string, level?: number): void;

    /**
     * Set camera view
     * @param view View type (head, body, full)
     */
    setView(view: 'head' | 'body' | 'full'): void;

    /**
     * Alias for setView (for backwards compatibility)
     */
    setCameraView(view: 'head' | 'body' | 'full'): void;

    /**
     * Play a gesture animation
     * @param gesture Gesture name
     * @param duration Duration in ms (0 = until stopped)
     */
    playGesture(gesture: string, duration?: number): void;

    /**
     * Stop the current gesture
     */
    stopGesture(): void;

    /**
     * Speak an emoji (triggers animation)
     * @param emoji Emoji character
     */
    speakEmoji(emoji: string): void;

    /**
     * Speak text with pre-computed visemes and audio
     * Used for Azure TTS with server-side synthesis
     * @param text Text being spoken (for subtitles)
     * @param visemes Array of viseme timing data
     * @param audio AudioBuffer to play
     */
    speakWithVisemes(
      text: string,
      visemes: VisemeTimingData[],
      audio: AudioBuffer
    ): Promise<void>;

    /**
     * Directly set mouth shape (for real-time lip-sync)
     * @param shape Mouth shape values object
     */
    setMouthShape(shape: MouthShapeValues): void;

    /**
     * Stop current speech and animation
     */
    stop(): void;

    /**
     * Check if avatar is currently speaking
     */
    isSpeaking(): boolean;

    /**
     * Set lighting configuration
     * @param options Lighting options
     */
    setLighting(options: LightingOptionsInternal): void;

    /**
     * Start streaming audio (for Azure TTS streaming)
     * @param options Stream configuration
     * @param onStart Callback when streaming starts
     * @param onEnd Callback when streaming ends
     */
    streamStart?(
      options: StreamStartOptions,
      onStart?: () => void,
      onEnd?: () => void
    ): void;

    /**
     * Stream audio chunk with visemes
     * @param data Audio data with optional viseme timing
     */
    streamAudio?(data: AudioStreamData): void;

    /**
     * Notify end of streaming
     */
    streamNotifyEnd?(): void;

    /**
     * Whether currently streaming
     */
    isStreaming?: boolean;

    /**
     * Current avatar mood
     */
    avatarMood: string;

    /**
     * Morph target values (for direct manipulation)
     */
    morphs?: Record<string, number>;
  }

  export interface TalkingHeadOptions {
    /** Azure TTS endpoint URL */
    ttsEndpoint?: string;
    /** Azure TTS API key (not recommended for frontend) */
    ttsApikey?: string;
    /** Initial camera view */
    cameraView?: 'head' | 'body' | 'full';
    /** Initial avatar mood */
    avatarMood?: string;
    /** Lip-sync language (e.g., 'en' for English rules) */
    lipsyncLang?: string;
    /** Enable/disable shadows */
    shadows?: boolean;
    /** Background color or image URL */
    background?: string;
  }

  export interface ShowAvatarOptions {
    /** URL to .glb avatar model */
    url: string;
    /** Avatar body type: 'M' = male, 'F' = female */
    body?: 'M' | 'F';
    /** Initial mood */
    avatarMood?: string;
    /** Lip-sync language */
    lipsyncLang?: string;
  }

  export interface VisemeTimingData {
    /** Time offset in seconds */
    time: number;
    /** Viseme ID (0-21 for Azure) */
    viseme: number;
    /** Blend weight (0-1) */
    blend?: number;
  }

  export interface MouthShapeValues {
    jawOpen: number;
    mouthOpen: number;
    mouthSmile?: number;
    mouthFunnel?: number;
    mouthPucker?: number;
  }

  export interface LightingOptionsInternal {
    lightAmbientColor?: number;
    lightAmbientIntensity?: number;
    lightDirectColor?: number;
    lightDirectIntensity?: number;
    lightDirectPhi?: number;
    lightDirectTheta?: number;
    lightSpotColor?: number;
    lightSpotIntensity?: number;
    lightSpotPhi?: number;
    lightSpotTheta?: number;
    lightSpotDispersion?: number;
  }

  /**
   * Audio streaming data structure (for Gemini Live streaming)
   */
  export interface AudioStreamData {
    audio: ArrayBuffer;
    visemes?: string[];
    vtimes?: number[];
    vdurations?: number[];
    words?: string[];
    wtimes?: number[];
    wdurations?: number[];
  }

  /**
   * Stream start options (for Azure TTS streaming)
   */
  export interface StreamStartOptions {
    sampleRate: number;
    mood?: string;
    gain?: number;
    lipsyncType?: 'visemes' | 'frequency';
  }
}

/**
 * Global TalkingHead interface for component props
 */
export interface TalkingHead {
  morphs?: Record<string, number>;
  isPlaying?: () => boolean;
  isSpeaking?: () => boolean;
  speakText?: (text: string, options?: { voice?: string; rate?: number; pitch?: number }) => Promise<void>;
  stopSpeaking?: () => void;
  stop?: () => void;
  setMood?: (mood: string, level?: number) => void;
  playGesture?: (gesture: string, duration?: number) => void;
  stopGesture?: () => void;
  setView?: (view: string) => void;
  setCameraView?: (view: string) => void;
  loadAvatar?: (url: string) => Promise<void>;
  showAvatar?: (options: { url: string; body?: string; avatarMood?: string }) => Promise<void>;
  deleteAvatar?: () => void;
  update?: (deltaTime: number) => void;
  setMouthShape?: (shape: MouthShapeValues) => void;
  speakWithVisemes?: (text: string, visemes: unknown[], audio: AudioBuffer) => Promise<void>;
  speakEmoji?: (emoji: string) => void;
  setLighting?: (options: Record<string, number>) => void;
  avatarMood?: string;
}

/**
 * Mouth shape values for lip-sync
 */
export interface MouthShapeValues {
  jawOpen: number;
  mouthOpen: number;
  mouthSmile?: number;
  mouthFunnel?: number;
  mouthPucker?: number;
}

/**
 * Props for components that receive TalkingHead instance
 */
export interface TalkingHeadProps {
  talkingHead?: TalkingHead | null;
}

/**
 * Morph target values for facial expressions
 */
export interface TalkingHeadMorphs {
  [morphName: string]: number;
}

/**
 * Declare global TalkingHead class if needed
 */
declare global {
  interface Window {
    TalkingHead?: new (element: HTMLElement, options?: object) => TalkingHead;
  }
}
```

---

## Task 2.4: Create Barrel Export

**File:** `src/types/index.ts`

```typescript
/**
 * Types Barrel Export
 *
 * Re-exports all types from a single entry point for clean imports:
 * import { AvatarState, SpeakMessage, TalkingHead } from '@/types';
 */

// WebSocket message types
export * from './avatar-websocket';

// Avatar state types
export * from './avatar';

// TalkingHead types
export type {
  TalkingHead,
  TalkingHeadProps,
  TalkingHeadMorphs,
  MouthShapeValues,
} from './talking-head';
```

---

## Task 2.5: Verify Types

### 2.5.1 TypeScript Compilation Test

```bash
cd learnflow/packages/chatbot

# Check for type errors
npx vue-tsc --noEmit

# Or if using plain TypeScript
npx tsc --noEmit
```

**Expected:** No type errors.

### 2.5.2 Import Test

Create a temporary test file `src/test-types.ts`:

```typescript
// Temporary file - delete after verification
import {
  // WebSocket types
  SessionStartMessage,
  AzureSpeakMessage,
  GeminiSpeakMessage,
  AvatarControlMessage,
  ReadyMessage,
  SpeechCompleteMessage,
  UserVoiceMessage,
  UserTextMessage,
  // Enums
  EmotionType,
  GestureType,
  ViewType,
  LightingPreset,
  // Type guards
  isAzureSpeakMessage,
  isGeminiSpeakMessage,
  isSessionStartMessage,
  isAvatarControlMessage,
  parseMessage,
  serializeMessage,
} from '@/types';

import type { AvatarState, VoiceConfig, LocalAvatarConfig, VisemeData } from '@/types';

import type { TalkingHead, MouthShapeValues } from '@/types';

// Test type usage
const testMessage: AzureSpeakMessage = {
  type: 'speak',
  provider: 'azure',
  text: 'Hello world',
  message_id: 'test-123',
};

// Test type guard
if (isAzureSpeakMessage(testMessage)) {
  console.log('Azure message:', testMessage.text);
}

// Test enum
const view: ViewType = ViewType.HEAD;
const mood: EmotionType = EmotionType.HAPPY;
const gesture: GestureType = GestureType.THUMBUP;

console.log('Types work!', view, mood, gesture);
```

Delete this file after verification.

---

## Verification Checklist

```
[ ] src/types/avatar-websocket.ts compiles without errors
[ ] src/types/avatar.ts compiles without errors
[ ] src/types/talking-head.d.ts compiles without errors
[ ] src/types/index.ts exports all types correctly
[ ] Type imports work: import { ... } from '@/types'
[ ] Type guards work correctly at runtime
[ ] No 'upper' in ViewType (only head, body, full)
[ ] LightingPreset and LightingOptions defined
[ ] VisemeData interface exists
[ ] VoiceConfig has speakingRate field
[ ] parseMessage and serializeMessage work
[ ] No duplicate/conflicting type names
[ ] All enums match backend Python enums
```

---

## Troubleshooting

### Error: "Cannot find module '@/types'"

Ensure `tsconfig.json` has path alias:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Error: "Duplicate identifier 'AvatarConfig'"

This was fixed by renaming:
- WebSocket config → `WebSocketAvatarConfig`
- Local config → `LocalAvatarConfig`

### Error: "Module '/lib/talkinghead/talkinghead.mjs' has no exported member"

The `.d.ts` file declares the module. Make sure:
1. The file is in `src/types/`
2. `tsconfig.json` includes the types folder

---

## Next Phase

→ [Phase 3: Vue Composables](./phase_3_composables.md)
