/**
 * Generic scoring module for REFLEX//ARC.
 * Medium-agnostic — works for any game type (reflex, visual, audio, etc.)
 * Zero references to audio or any specific game mechanic.
 */

// ─── Score Computation ───────────────────────────────────────────────

interface ScoreOptions {
  /** Error below this threshold earns full points (default: 10) */
  fullPointsThreshold?: number;
  /** Error above this threshold earns zero points (default: 90) */
  zeroPointsThreshold?: number;
  /** Maximum points per round (default: 100) */
  maxPoints?: number;
}

/**
 * Computes a score from an accuracy/error value on a smooth cosine curve.
 * Full points under fullPointsThreshold, scales smoothly to 0 at zeroPointsThreshold.
 *
 * @param error - The error/distance metric (lower is better, 0 = perfect)
 * @param options - Scoring curve configuration
 * @returns Integer score between 0 and maxPoints
 */
export function computeScore(error: number, options?: ScoreOptions): number {
  const {
    fullPointsThreshold = 10,
    zeroPointsThreshold = 90,
    maxPoints = 100,
  } = options ?? {};

  if (error <= fullPointsThreshold) return maxPoints;
  if (error >= zeroPointsThreshold) return 0;

  // Cosine interpolation for smooth falloff
  const range = zeroPointsThreshold - fullPointsThreshold;
  const normalized = (error - fullPointsThreshold) / range; // 0..1
  const curved = (1 + Math.cos(normalized * Math.PI)) / 2; // 1..0 smooth

  return Math.round(curved * maxPoints);
}

// ─── Streak Tracking ─────────────────────────────────────────────────

export class StreakTracker {
  current: number = 0;
  best: number = 0;

  /**
   * Record a round result. Increments streak on success, resets on failure.
   */
  record(isCorrect: boolean): void {
    if (isCorrect) {
      this.current++;
      if (this.current > this.best) {
        this.best = this.current;
      }
    } else {
      this.current = 0;
    }
  }

  /**
   * Reset all streak counters to 0.
   */
  reset(): void {
    this.current = 0;
    this.best = 0;
  }
}

// ─── Leaderboard ─────────────────────────────────────────────────────

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
  rounds: number;
}

const MAX_LEADERBOARD_SIZE = 10;

function leaderboardKey(gameId: string): string {
  return `leaderboard:${gameId}`;
}

/**
 * Reads the top-10 leaderboard for a game from localStorage.
 * Returns an empty array if no data exists or running server-side.
 */
export function getLeaderboard(gameId: string): LeaderboardEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(leaderboardKey(gameId));
    if (!raw) return [];
    const entries: LeaderboardEntry[] = JSON.parse(raw);
    return entries
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_LEADERBOARD_SIZE);
  } catch {
    return [];
  }
}

/**
 * Adds an entry to a game's leaderboard, keeps top 10, saves to localStorage.
 *
 * @returns The updated leaderboard and the rank (1-indexed) if the entry placed, null otherwise.
 */
export function addToLeaderboard(
  gameId: string,
  entry: LeaderboardEntry
): { entries: LeaderboardEntry[]; rank: number | null } {
  if (typeof window === "undefined") {
    return { entries: [], rank: null };
  }

  try {
    const existing = getLeaderboard(gameId);
    const combined = [...existing, entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_LEADERBOARD_SIZE);

    localStorage.setItem(leaderboardKey(gameId), JSON.stringify(combined));

    // Find the rank of the just-added entry
    const rankIndex = combined.findIndex(
      (e) =>
        e.score === entry.score &&
        e.date === entry.date &&
        e.name === entry.name &&
        e.rounds === entry.rounds
    );
    const rank = rankIndex !== -1 ? rankIndex + 1 : null;

    return { entries: combined, rank };
  } catch {
    return { entries: [], rank: null };
  }
}
