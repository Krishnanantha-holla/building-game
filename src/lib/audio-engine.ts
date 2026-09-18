/**
 * Web Audio engine for Instinct Arcade.
 * Provides spatial audio (HRTF) for Echo and generic blip sounds for all games' UI.
 * Opt-in module — only imported by games/components that need sound.
 */

let audioContext: AudioContext | null = null;

/**
 * Creates and unlocks the AudioContext. MUST be called inside a user gesture
 * handler (click/tap) to satisfy iOS Safari autoplay policy.
 * Calling multiple times is safe — returns the existing context if already unlocked.
 */
export async function unlockAudioContext(): Promise<AudioContext> {
  if (audioContext && audioContext.state !== "closed") {
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    return audioContext;
  }

  audioContext = new AudioContext();

  // iOS Safari requires resume() inside user gesture
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  // Play a silent buffer to fully unlock on iOS
  const buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start(0);

  return audioContext;
}

/**
 * Returns the current AudioContext or null if not yet unlocked.
 */
export function getAudioContext(): AudioContext | null {
  return audioContext;
}

// ─── Generic Blip Sound ──────────────────────────────────────────────

/**
 * Plays a short chiptune blip sound. Used for UI navigation sounds,
 * Simon-Says pad tones, and general game feedback.
 *
 * @param frequency - Oscillator frequency in Hz (e.g., 440 for A4)
 * @param durationMs - Duration of the blip in milliseconds (default: 80)
 */
export function playBlip(frequency: number, durationMs: number = 80): void {
  if (!audioContext || audioContext.state === "closed") {
    return;
  }

  const ctx = audioContext;
  const now = ctx.currentTime;
  const dur = durationMs / 1000;

  // Square wave for that chiptune feel
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(frequency, now);

  // Gain envelope: quick attack, short sustain, quick decay
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.005); // 5ms attack
  gain.gain.setValueAtTime(0.3, now + dur * 0.6);       // sustain
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur); // decay

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + dur);

  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

/** Starts an audible metronome and reports each beat's performance timestamp. */
export function scheduleBeat(
  bpm: number,
  onBeat?: (timestamp: number) => void
): () => void {
  const intervalMs = 60000 / bpm;
  const emitBeat = () => {
    playBlip(880, 35);
    onBeat?.(performance.now());
  };

  emitBeat();
  const intervalId = window.setInterval(emitBeat, intervalMs);
  return () => window.clearInterval(intervalId);
}

// ─── Spatial Audio (used by Echo game) ───────────────────────────────

interface SpatialPingOptions {
  /** Azimuth in degrees (0=front/north, 90=right/east, 180=behind, 270=left/west) */
  azimuth: number;
  /** Elevation in degrees from horizontal (positive = above, negative = below). Default: 0 */
  elevation?: number;
  /** Duration of the ping in milliseconds. Default: 200 */
  duration?: number;
  /** Oscillator frequency in Hz. Default: 880 */
  frequency?: number;
}

/**
 * Synthesizes a short spatial chirp/ping using HRTF panning.
 * Creates an oscillator with attack/decay envelope routed through a PannerNode.
 *
 * Coordinate system:
 *   azimuth 0°   = front (north)  → x=0,  z=-1
 *   azimuth 90°  = right (east)   → x=1,  z=0
 *   azimuth 180° = behind (south) → x=0,  z=1
 *   azimuth 270° = left (west)    → x=-1, z=0
 *
 * Web Audio uses right-hand coordinate system where -z is forward.
 */
export function playSpatialPing(options: SpatialPingOptions): void {
  if (!audioContext || audioContext.state === "closed") {
    console.warn("AudioContext not initialized. Call unlockAudioContext() first.");
    return;
  }

  const {
    azimuth,
    elevation = 0,
    duration = 200,
    frequency = 880,
  } = options;

  const ctx = audioContext;
  const now = ctx.currentTime;
  const durationSec = duration / 1000;

  // Convert azimuth/elevation to 3D position
  const azRad = (azimuth * Math.PI) / 180;
  const elRad = (elevation * Math.PI) / 180;
  const cosEl = Math.cos(elRad);

  const x = Math.sin(azRad) * cosEl;
  const y = Math.sin(elRad);
  const z = -Math.cos(azRad) * cosEl; // negative: -z is forward in Web Audio

  // Create panner with HRTF
  const panner = ctx.createPanner();
  panner.panningModel = "HRTF";
  panner.distanceModel = "inverse";
  panner.refDistance = 1;
  panner.maxDistance = 10000;
  panner.rolloffFactor = 1;
  panner.coneInnerAngle = 360;
  panner.coneOuterAngle = 360;
  panner.coneOuterGain = 0;
  panner.positionX.setValueAtTime(x, now);
  panner.positionY.setValueAtTime(y, now);
  panner.positionZ.setValueAtTime(z, now);

  // Create gain node with attack/decay envelope to avoid clicks
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, now);
  // Attack: ramp up over 10ms
  gainNode.gain.linearRampToValueAtTime(0.6, now + 0.01);
  // Sustain until decay starts
  gainNode.gain.setValueAtTime(0.6, now + durationSec - 0.05);
  // Decay: ramp down over last 50ms
  gainNode.gain.linearRampToValueAtTime(0, now + durationSec);

  // Create oscillator
  const oscillator = ctx.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, now);
  // Slight frequency sweep for a chirp effect
  oscillator.frequency.exponentialRampToValueAtTime(
    frequency * 0.8,
    now + durationSec
  );

  // Connect: oscillator → gain → panner → destination
  oscillator.connect(gainNode);
  gainNode.connect(panner);
  panner.connect(ctx.destination);

  // Play
  oscillator.start(now);
  oscillator.stop(now + durationSec);

  // Cleanup
  oscillator.onended = () => {
    oscillator.disconnect();
    gainNode.disconnect();
    panner.disconnect();
  };
}

/**
 * Closes and disposes the AudioContext.
 */
export function disposeAudioContext(): void {
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
}
