/**
 * SmartMouthAnalyzer AudioWorklet
 *
 * Analyzes audio frequency bands in real-time to drive avatar mouth shapes.
 * Used for Gemini Live lip-sync where Azure TTS visemes aren't available.
 *
 * Frequency Bands:
 *   - Low (100-800Hz): Vowel sounds -> mouthOpen
 *   - Mid (800-2000Hz): Consonants -> mouthFunnel, mouthPucker
 *   - High (2000-8000Hz): Sibilants -> mouthSmile
 *   - RMS: Overall energy -> jawOpen
 *
 * Outputs MouthShape object every 25ms with 5 blendshape values (0-1 range).
 *
 * Based on Google's Gemini Multimodal Live API reference implementation.
 *
 * Copyright 2024 Google LLC
 * Licensed under the Apache License, Version 2.0
 */

/**
 * MouthShape output from SmartMouthAnalyzer
 */
export interface MouthShape {
  /** Overall jaw movement (0-1), based on RMS energy */
  jawOpen: number;
  /** Vowel sounds width (0-1), based on low frequencies (100-800Hz) */
  mouthOpen: number;
  /** Sibilant sounds (s, z, sh) (0-1), based on high frequencies (2000-8000Hz) */
  mouthSmile: number;
  /** Round vowels (o, u) (0-1), based on mid frequencies (800-2000Hz) */
  mouthFunnel: number;
  /** Tight round sounds (0-1), based on mid frequencies (800-2000Hz) */
  mouthPucker: number;
}

const SmartMouthAnalyzer = `
  class SmartMouthAnalyzer extends AudioWorkletProcessor {
    mouthShape
    updateIntervalInMS
    nextUpdateFrame
    processCallCount
    hasLoggedFirstAudio

    constructor() {
      super()

      // Log sample rate (Gemini Live audio is typically 24kHz, but 48kHz also works)
      console.info('SmartMouthAnalyzer: Worklet constructed at ' + sampleRate + 'Hz')
      if (sampleRate !== 24000) {
        console.info('SmartMouthAnalyzer: Running at ' + sampleRate + 'Hz (designed for 24kHz, dynamically adapts)')
      }

      // Initialize mouth shape with all values at 0 (closed mouth)
      this.mouthShape = {
        jawOpen: 0,
        mouthOpen: 0,
        mouthSmile: 0,
        mouthFunnel: 0,
        mouthPucker: 0
      }

      // Send updates every 25ms (40 times per second) - matches reference implementation
      this.updateIntervalInMS = 25
      this.nextUpdateFrame = this.updateIntervalInMS
      this.processCallCount = 0
      this.hasLoggedFirstAudio = false

      // Listen for configuration messages from main thread
      this.port.onmessage = event => {
        if (event.data.updateIntervalInMS) {
          this.updateIntervalInMS = event.data.updateIntervalInMS
        }
      }
    }

    get intervalInFrames() {
      return (this.updateIntervalInMS / 1000) * sampleRate
    }

    /**
     * Analyzes a specific frequency band from audio samples.
     *
     * @param {Float32Array} samples - Audio samples from the input buffer
     * @param {number} startFreq - Start frequency in Hz
     * @param {number} endFreq - End frequency in Hz
     * @returns {number} Average magnitude in the frequency band (0-1 range)
     */
    analyzeFrequencyBand(samples, startFreq, endFreq) {
      const nyquist = sampleRate / 2 // 12000 Hz for 24kHz audio

      // Convert frequency range to sample array indices
      const startIndex = Math.floor((startFreq / nyquist) * samples.length)
      const endIndex = Math.ceil((endFreq / nyquist) * samples.length)

      // Calculate average magnitude in the frequency band
      let sum = 0
      for (let i = startIndex; i < endIndex; i++) {
        sum += Math.abs(samples[i])
      }

      const average = sum / (endIndex - startIndex)

      // Clamp to 0-1 range
      return Math.max(0, Math.min(1, average))
    }

    /**
     * Calculates mouth shape values from audio samples.
     *
     * @param {Float32Array} samples - Audio samples from the input buffer
     * @returns {Object} MouthShape object with 5 blendshape values
     */
    calculateMouthShape(samples) {
      // Calculate RMS (Root Mean Square) for overall energy
      let sum = 0
      for (let i = 0; i < samples.length; i++) {
        sum += samples[i] * samples[i]
      }
      const rms = Math.sqrt(sum / samples.length)

      // Analyze frequency bands
      const lowFreq = this.analyzeFrequencyBand(samples, 100, 800)    // Vowels
      const midFreq = this.analyzeFrequencyBand(samples, 800, 2000)   // Consonants
      const highFreq = this.analyzeFrequencyBand(samples, 2000, 8000) // Sibilants

      // Map frequency bands to blendshape values with multipliers
      // All values clamped to 0-1 range
      return {
        jawOpen: Math.min(rms * 1.2, 1.0),           // Overall jaw movement
        mouthOpen: Math.min(lowFreq * 1.5, 1.0),     // Vowel sounds (wider)
        mouthSmile: Math.min(highFreq * 0.8, 1.0),   // Sibilants (s, z, sh)
        mouthFunnel: Math.min(midFreq * 0.8, 1.0),   // Round vowels (o, u)
        mouthPucker: Math.min(midFreq * 0.7, 1.0)    // Tight round sounds
      }
    }

    /**
     * Main audio processing function called by the browser.
     *
     * PARALLEL ROUTING (TAP): This worklet receives audio as a tap/copy.
     * Audio flows: source -> analyzerNode (tap) AND source -> gainNode -> destination
     *
     * This matches the working reference implementation.
     *
     * @param {Array} inputs - Input audio buffers
     * @returns {boolean} true to keep processor alive
     */
    process(inputs) {
      this.processCallCount++

      // Log first few process calls
      if (this.processCallCount <= 5) {
        console.log('SmartMouthAnalyzer.process() call #' + this.processCallCount + ', inputs.length:', inputs.length)
      }

      const input = inputs[0]

      if (input && input.length > 0) {
        const samples = input[0]

        // Guard against empty sample buffer (can happen during audio glitches)
        if (!samples || samples.length === 0) {
          if (this.processCallCount <= 5) {
            console.log('SmartMouthAnalyzer: Empty samples array')
          }
          return true
        }

        // Log first audio received
        if (!this.hasLoggedFirstAudio) {
          console.log('SmartMouthAnalyzer: ✅ FIRST AUDIO RECEIVED! samples.length:', samples.length)
          console.log('SmartMouthAnalyzer: First 10 samples:', Array.from(samples.slice(0, 10)))
          // Check for non-zero samples
          let maxAbs = 0
          for (let i = 0; i < samples.length; i++) {
            const abs = Math.abs(samples[i])
            if (abs > maxAbs) maxAbs = abs
          }
          console.log('SmartMouthAnalyzer: Max abs value in first buffer:', maxAbs)
          this.hasLoggedFirstAudio = true
        }

        // Calculate mouth shape from current audio samples
        this.mouthShape = this.calculateMouthShape(samples)

        // Debug: Log every 20th message (roughly every 500ms)
        if (this.processCallCount % 200 === 0) {
          console.log('SmartMouthAnalyzer: Process #' + this.processCallCount + ', mouthShape:', JSON.stringify(this.mouthShape))
        }

        // Send updates at configured interval (default: every 25ms)
        this.nextUpdateFrame -= samples.length
        if (this.nextUpdateFrame < 0) {
          this.nextUpdateFrame += this.intervalInFrames
          this.port.postMessage(this.mouthShape)
        }
      } else {
        if (this.processCallCount <= 5) {
          console.log('SmartMouthAnalyzer: No input channels')
        }
      }

      return true
    }
  }`;

export default SmartMouthAnalyzer;
