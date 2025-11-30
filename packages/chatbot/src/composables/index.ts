/**
 * Chatbot Composables
 */

export { useChat } from './useChat';
export { useChatbot } from './useChatbot';
export { useChatbotWebSocket } from './useChatbotWebSocket';

/**
 * Avatar Composables
 */
export { useAvatar } from './useAvatar';
export { useAvatarSocket } from './useAvatarSocket';
export { useAvatarChat } from './useAvatarChat';
export { useAvatarPreloader } from './useAvatarPreloader';
export { useAzureTTS } from './useAzureTTS';
export { useGeminiLipsync } from './useGeminiLipsync';
export { useVoiceRecording } from './useVoiceRecording';
export { useStreamingText } from './useStreamingText';
export { useBot } from './useBot';

/**
 * Re-export types
 */
export type {
  UseAvatarSocketOptions,
  UseAvatarSocketReturn,
  ConnectionStatus,
  ErrorType,
  ErrorInfo,
} from './useAvatarSocket';

export type {
  UseStreamingTextOptions,
  UseStreamingTextReturn,
} from './useStreamingText';
