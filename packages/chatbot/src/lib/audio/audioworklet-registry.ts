/**
 * AudioWorklet Registry
 *
 * Utility for creating and managing AudioWorklet modules from source strings.
 * Creates blob URLs for worklet registration.
 *
 * Based on Google's Gemini Multimodal Live API reference implementation.
 *
 * Copyright 2024 Google LLC
 * Licensed under the Apache License, Version 2.0
 */

/**
 * Graph structure for tracking worklet connections
 */
export type WorkletGraph = {
  node?: AudioWorkletNode;
  handlers: Array<(this: MessagePort, ev: MessageEvent) => void>;
};

/**
 * Registry mapping AudioContexts to their registered worklets
 */
export const registeredWorklets: Map<
  AudioContext,
  Record<string, WorkletGraph>
> = new Map();

/**
 * Create a blob URL for an AudioWorklet from source code string
 *
 * @param workletName - Name to register the processor under
 * @param workletSrc - Worklet class source code (without registerProcessor call)
 * @returns Blob URL that can be used with audioWorklet.addModule()
 *
 * @example
 * const src = createWorkletFromSrc('my-processor', MyWorkletSource);
 * await audioContext.audioWorklet.addModule(src);
 */
export const createWorkletFromSrc = (
  workletName: string,
  workletSrc: string,
): string => {
  const script = new Blob(
    [`registerProcessor("${workletName}", ${workletSrc})`],
    {
      type: "application/javascript",
    },
  );

  return URL.createObjectURL(script);
};
