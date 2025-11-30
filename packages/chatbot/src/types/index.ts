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
