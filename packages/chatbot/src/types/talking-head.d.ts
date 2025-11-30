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
