import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue';
import { io, type Socket } from 'socket.io-client';
import type {
  SessionConfig,
  SpeakMessage,
  AvatarControlMessage,
} from '../types/index';

// ========================================
// TYPES
// ========================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export type ErrorType =
  | 'connection'
  | 'disconnected'
  | 'message_parse'
  | 'tts_failure'
  | 'avatar_load'
  | 'unknown';

export interface ErrorInfo {
  type: ErrorType;
  message: string;
  recoverable: boolean;
  timestamp: number;
  details?: Record<string, unknown>;
}

export interface UseAvatarSocketOptions {
  /** Backend URL (e.g., 'http://localhost:8001') */
  url: string;
  /** TTS provider for new sessions */
  provider?: 'azure' | 'gemini-live';
  /** Voice ID for new sessions */
  voiceId?: string;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Max reconnection attempts (default: 5) */
  maxReconnectAttempts?: number;

  // Callbacks
  onSessionStart?: (sessionId: string, config: SessionConfig) => void;
  onSpeak?: (message: SpeakMessage) => void;
  onAvatarControl?: (command: string, params: Record<string, unknown>) => void;
  onConfigUpdate?: (config: SessionConfig) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onReconnect?: () => void;
  onDisconnectWhileSpeaking?: () => void;
  onMaxReconnectAttemptsReached?: () => void;
  onInterrupt?: () => void;
}

export interface UseAvatarSocketReturn {
  // State (readonly)
  isConnected: ComputedRef<boolean>;
  isConnecting: ComputedRef<boolean>;
  connectionStatus: ComputedRef<ConnectionStatus>;
  sessionId: ComputedRef<string | null>;
  currentConfig: ComputedRef<SessionConfig | null>;
  error: ComputedRef<string | null>;
  errorInfo: ComputedRef<ErrorInfo | null>;
  isSpeaking: ComputedRef<boolean>;
  isInterrupted: ComputedRef<boolean>;
  pendingMessagesCount: ComputedRef<number>;
  reconnectAttempts: ComputedRef<number>;

  // Actions
  connect: () => void;
  disconnect: () => void;
  retry: () => void;
  sendReady: (avatarLoaded: boolean, ttsInitialized: boolean) => void;
  sendSpeechComplete: (messageId: string) => void;
  sendUserInterrupt: () => void;
  sendUserMessage: (text: string, language?: string) => void;
  sendUserVoice: (audioChunk: string, sampleRate: number, isFinal: boolean) => void;
  sendError: (error: string, details?: Record<string, unknown>) => void;
  setIsSpeaking: (speaking: boolean) => void;
  interruptSpeaking: () => void;
  clearError: () => void;
  clearInterrupted: () => void;
}

// ========================================
// COMPOSABLE
// ========================================

export function useAvatarSocket(options: UseAvatarSocketOptions): UseAvatarSocketReturn {
  const {
    url,
    provider = 'azure',
    voiceId,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    onSessionStart,
    onSpeak,
    onAvatarControl,
    onConfigUpdate,
    onError,
    onConnect,
    onDisconnect,
    onReconnect,
    onDisconnectWhileSpeaking,
    onMaxReconnectAttemptsReached,
    onInterrupt,
  } = options;

  // ========================================
  // STATE
  // ========================================

  const isConnected = ref(false);
  const isConnecting = ref(false);
  const connectionStatus = ref<ConnectionStatus>('disconnected');
  const sessionId = ref<string | null>(null);
  const currentConfig = ref<SessionConfig | null>(null);
  const error = ref<string | null>(null);
  const errorInfo = ref<ErrorInfo | null>(null);
  const isSpeaking = ref(false);
  const isInterrupted = ref(false);
  const pendingMessagesCount = ref(0);
  const reconnectAttempts = ref(0);

  // Internal refs
  let socket: Socket | null = null;
  let intentionalDisconnect = false;
  let wasSpeaking = false;
  const pendingMessages: SpeakMessage[] = [];

  // ========================================
  // HELPERS
  // ========================================

  function createErrorInfo(
    type: ErrorType,
    message: string,
    recoverable = true,
    details?: Record<string, unknown>
  ): ErrorInfo {
    return { type, message, recoverable, timestamp: Date.now(), details };
  }

  function setErrorState(info: ErrorInfo) {
    error.value = info.message;
    errorInfo.value = info;
    connectionStatus.value = 'error';
    onError?.(info.message);
  }

  function buildSocketUrl(): string {
    // Extract base URL (protocol + host + port)
    let baseUrl = url.replace(/^ws/, 'http');
    try {
      const parsed = new URL(baseUrl);
      return parsed.origin;
    } catch {
      return baseUrl.replace(/\/ws\/avatar\/?$/, '').replace(/\/avatar\/?$/, '');
    }
  }

  // ========================================
  // ACTIONS
  // ========================================

  function connect() {
    if (socket?.connected) {
      console.log('[useAvatarSocket] Already connected');
      return;
    }

    // Cleanup existing socket
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    intentionalDisconnect = false;
    isConnecting.value = true;
    connectionStatus.value = 'connecting';
    error.value = null;
    errorInfo.value = null;

    const baseUrl = buildSocketUrl();

    // CRITICAL: Include /avatar namespace in URL
    const fullUrl = `${baseUrl}/avatar`;
    console.log('[useAvatarSocket] Connecting to:', fullUrl);

    try {
      socket = io(fullUrl, {
        path: '/socket.io/',
        // Auth for new sessions (backend controls session management)
        auth: {
          voice_id: voiceId,
          provider,
        },
        reconnection: autoReconnect,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
      });

      // ========================================
      // CONNECTION EVENTS
      // ========================================

      socket.on('connect', () => {
        console.log('[useAvatarSocket] Connected');
        isConnected.value = true;
        isConnecting.value = false;
        connectionStatus.value = 'connected';
        error.value = null;
        errorInfo.value = null;
        reconnectAttempts.value = 0;
        onConnect?.();
      });

      socket.on('connect_error', (err) => {
        console.error('[useAvatarSocket] Connection error:', err);
        setErrorState(createErrorInfo('connection', `Connection error: ${err.message}`, true));
      });

      socket.on('disconnect', (reason) => {
        console.log('[useAvatarSocket] Disconnected:', reason);

        // Check if disconnected while speaking
        if (wasSpeaking && !intentionalDisconnect) {
          console.warn('[useAvatarSocket] Disconnected while speaking');
          onDisconnectWhileSpeaking?.();
        }
        wasSpeaking = false;

        const info = intentionalDisconnect
          ? null
          : createErrorInfo('disconnected', `Disconnected: ${reason}`, true);

        isConnected.value = false;
        isConnecting.value = false;
        isSpeaking.value = false;
        connectionStatus.value = intentionalDisconnect ? 'disconnected' : 'error';
        if (info) {
          error.value = info.message;
          errorInfo.value = info;
        }

        onDisconnect?.(reason);
      });

      // ========================================
      // RECONNECTION EVENTS
      // ========================================

      socket.on('reconnect', (attempt: number) => {
        console.log('[useAvatarSocket] Reconnected after', attempt, 'attempts');
        onReconnect?.();
      });

      socket.io.on('reconnect_attempt', (attempt: number) => {
        console.log(`[useAvatarSocket] Reconnection attempt ${attempt}/${maxReconnectAttempts}`);
        connectionStatus.value = 'reconnecting';
        reconnectAttempts.value = attempt;
      });

      socket.io.on('reconnect_failed', () => {
        console.error('[useAvatarSocket] Max reconnection attempts reached');
        setErrorState(createErrorInfo(
          'connection',
          `Failed to reconnect after ${maxReconnectAttempts} attempts`,
          false
        ));
        onMaxReconnectAttemptsReached?.();
      });

      // ========================================
      // MESSAGE EVENTS
      // ========================================

      socket.on('session_start', (data: { session_id: string; config: SessionConfig; is_resumed?: boolean }) => {
        console.log('[useAvatarSocket] Session started:', data.session_id, data.is_resumed ? '(resumed)' : '(new)');
        sessionId.value = data.session_id;
        currentConfig.value = data.config;
        onSessionStart?.(data.session_id, data.config);
      });

      socket.on('speak', (message: SpeakMessage) => {
        pendingMessages.push(message);
        pendingMessagesCount.value = pendingMessages.length;
        isInterrupted.value = false;
        onSpeak?.(message);
      });

      socket.on('avatar_control', (data: { command: string; params: Record<string, unknown> }) => {
        onAvatarControl?.(data.command, data.params);
      });

      socket.on('config_update', (data: { config: SessionConfig }) => {
        currentConfig.value = data.config;
        onConfigUpdate?.(data.config);
      });

      socket.on('error', (data: { error: string; details?: Record<string, unknown> }) => {
        console.error('[useAvatarSocket] Server error:', data);
        setErrorState(createErrorInfo('unknown', data.error, true, data.details));
      });

    } catch (err) {
      console.error('[useAvatarSocket] Failed to create connection:', err);
      isConnecting.value = false;
      setErrorState(createErrorInfo(
        'connection',
        err instanceof Error ? err.message : 'Failed to connect',
        true
      ));
    }
  }

  function disconnect() {
    console.log('[useAvatarSocket] Disconnecting...');
    intentionalDisconnect = true;

    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    // Reset state
    isConnected.value = false;
    isConnecting.value = false;
    connectionStatus.value = 'disconnected';
    sessionId.value = null;
    currentConfig.value = null;
    error.value = null;
    errorInfo.value = null;
    isSpeaking.value = false;
    isInterrupted.value = false;
    pendingMessagesCount.value = 0;
    reconnectAttempts.value = 0;
    pendingMessages.length = 0;
  }

  function retry() {
    console.log('[useAvatarSocket] Retry requested');
    error.value = null;
    errorInfo.value = null;
    reconnectAttempts.value = 0;
    connect();
  }

  function sendReady(avatarLoaded: boolean, ttsInitialized: boolean) {
    if (!socket?.connected) return;
    socket.emit('ready', { avatar_loaded: avatarLoaded, tts_initialized: ttsInitialized });
  }

  function sendSpeechComplete(messageId: string) {
    if (!socket?.connected) return;
    socket.emit('speech_complete', { message_id: messageId });

    // Remove message from queue
    const index = pendingMessages.findIndex(msg => msg.message_id === messageId);
    if (index !== -1) {
      pendingMessages.splice(index, 1);
      pendingMessagesCount.value = pendingMessages.length;
    }
  }

  function sendUserInterrupt() {
    if (!socket?.connected) return;
    socket.emit('user_interrupt', { timestamp: Date.now() });
  }

  function sendUserMessage(text: string, language?: string) {
    if (!socket?.connected) return;
    socket.emit('user_message', { text, language, timestamp: Date.now() });
  }

  function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
    if (!socket?.connected) return;
    socket.emit('user_voice', { audio_chunk: audioChunk, sample_rate: sampleRate, is_final: isFinal });
  }

  function sendError(errorMsg: string, details?: Record<string, unknown>) {
    if (!socket?.connected) return;
    socket.emit('error', { error: errorMsg, details });
  }

  function setIsSpeaking(speaking: boolean) {
    wasSpeaking = speaking;
    isSpeaking.value = speaking;
  }

  function interruptSpeaking() {
    console.log('[useAvatarSocket] User interruption triggered');

    // Clear pending messages
    const clearedCount = pendingMessages.length;
    pendingMessages.length = 0;

    // Update state
    isSpeaking.value = false;
    isInterrupted.value = true;
    pendingMessagesCount.value = 0;

    // Send interrupt to backend
    sendUserInterrupt();

    // Call UI callback
    onInterrupt?.();

    console.log(`[useAvatarSocket] Cleared ${clearedCount} pending messages`);
  }

  function clearError() {
    error.value = null;
    errorInfo.value = null;
  }

  function clearInterrupted() {
    isInterrupted.value = false;
  }

  // ========================================
  // CLEANUP
  // ========================================

  onUnmounted(() => {
    console.log('[useAvatarSocket] Cleanup on unmount');
    intentionalDisconnect = true;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
  });

  // ========================================
  // RETURN
  // ========================================

  return {
    // State
    isConnected: computed(() => isConnected.value),
    isConnecting: computed(() => isConnecting.value),
    connectionStatus: computed(() => connectionStatus.value),
    sessionId: computed(() => sessionId.value),
    currentConfig: computed(() => currentConfig.value),
    error: computed(() => error.value),
    errorInfo: computed(() => errorInfo.value),
    isSpeaking: computed(() => isSpeaking.value),
    isInterrupted: computed(() => isInterrupted.value),
    pendingMessagesCount: computed(() => pendingMessagesCount.value),
    reconnectAttempts: computed(() => reconnectAttempts.value),

    // Actions
    connect,
    disconnect,
    retry,
    sendReady,
    sendSpeechComplete,
    sendUserInterrupt,
    sendUserMessage,
    sendUserVoice,
    sendError,
    setIsSpeaking,
    interruptSpeaking,
    clearError,
    clearInterrupted,
  };
}
