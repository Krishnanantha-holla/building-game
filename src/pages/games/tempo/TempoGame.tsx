import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { addToLeaderboard, getLeaderboard } from '@/lib/scoring';
import type { LeaderboardEntry } from '@/lib/scoring';
import { unlockAudioContext, getAudioContext, playMetronomeClick, playBlip } from '@/lib/audio-engine';
import GameIntro from '@/components/GameIntro';

type GamePhase = 'intro' | 'playing' | 'gameover';

type Judgment = 'PERFECT' | 'GOOD' | 'MISS';

interface Feedback {
  text: Judgment;
  color: string;
  id: number;
}

const ACCENT_COLOR = '#ffb000';
const INITIAL_BPM = 90;
const ROUND_DURATION_SEC = 30;
const MAX_MISS_STREAK = 4;

export default function TempoGame() {
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [bpm, setBpm] = useState(INITIAL_BPM);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [bpmMessage, setBpmMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION_SEC);
  const [score, setScore] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);

  // Animated visual ring state (updated via requestAnimationFrame)
  const [ringScale, setRingScale] = useState(2.0);
  const [ringFlash, setRingFlash] = useState(false);

  const rafRef = useRef<number | null>(null);

  const stateRef = useRef({
    bpm: INITIAL_BPM,
    startTime: 0,
    nextBeatTime: 0,
    lastBeatTime: 0,
    beatCounter: 0,
    tappedBeats: new Set<number>(),
    judgedBeats: new Set<number>(),
    hitsCount: 0,
    totalJudgments: 0,
    accuracyPointsTotal: 0,
    currentStreak: 0,
    bestStreak: 0,
    consecutiveHits: 0,
    missStreak: 0,
    score: 0,
    isGameOver: false,
    isPlaying: false,
  });

  const endGame = useCallback(() => {
    const state = stateRef.current;
    if (state.isGameOver) return;
    state.isGameOver = true;
    state.isPlaying = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const finalAccuracy = state.totalJudgments > 0
      ? Math.round((state.accuracyPointsTotal / state.totalJudgments) * 10) / 10
      : 0;

    // Score based on accuracy %, best streak, and successful hits
    const finalScore = Math.max(0, Math.round(finalAccuracy * 10 + state.bestStreak * 30 + state.hitsCount * 15));
    setScore(finalScore);

    const prevLeaderboard = getLeaderboard('tempo');
    const newBest = prevLeaderboard.length === 0 || finalScore > prevLeaderboard[0].score;
    setIsNewBest(newBest);

    const entry: LeaderboardEntry = {
      name: 'PULSE',
      score: finalScore,
      date: new Date().toISOString(),
      rounds: state.hitsCount,
    };

    const { entries, rank } = addToLeaderboard('tempo', entry);
    setLeaderboardEntries(entries);
    setPlayerRank(rank);
    setPhase('gameover');
  }, []);

  // Main animation / audio scheduling loop
  useEffect(() => {
    if (phase !== 'playing') return;

    let animId: number;

    const loop = () => {
      const state = stateRef.current;
      if (state.isGameOver || !state.isPlaying) return;

      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const elapsed = (performance.now() - state.startTime) / 1000;
      const remaining = Math.max(0, Math.ceil(ROUND_DURATION_SEC - elapsed));
      setTimeLeft(remaining);

      // Check end conditions: duration or miss streak
      if (elapsed >= ROUND_DURATION_SEC || state.missStreak >= MAX_MISS_STREAK) {
        endGame();
        return;
      }

      // Check if previous beat was missed completely (no tap within +150ms)
      if (
        state.beatCounter > 0 &&
        !state.judgedBeats.has(state.beatCounter) &&
        now > state.lastBeatTime + 0.16
      ) {
        state.judgedBeats.add(state.beatCounter);
        state.currentStreak = 0;
        state.consecutiveHits = 0;
        state.missStreak++;
        state.totalJudgments++;
        // 0 accuracy points for miss
        const acc = (state.accuracyPointsTotal / state.totalJudgments);
        setAccuracy(Math.round(acc * 10) / 10);
        setStreak(0);
        setFeedback({ text: 'MISS', color: 'var(--reflex-accent)', id: Date.now() });
        playBlip(180, 80);

        if (state.missStreak >= MAX_MISS_STREAK) {
          endGame();
          return;
        }
      }

      // Time for next beat: play metronome click and schedule next beat
      if (now >= state.nextBeatTime) {
        playMetronomeClick();
        state.lastBeatTime = state.nextBeatTime;
        state.beatCounter++;

        const beatInterval = 60 / state.bpm;
        state.nextBeatTime += beatInterval;

        setRingFlash(true);
        window.setTimeout(() => setRingFlash(false), 80);
      }

      // Visual shrink ring: calculates scale from 2.0 down to 1.0 at nextBeatTime
      const beatInterval = 60 / state.bpm;
      const timeToNext = state.nextBeatTime - now;
      const progress = Math.max(0, Math.min(1, 1 - (timeToNext / beatInterval)));
      // Shrinks from 2.0 down to 1.0 (reaches 1.0 exactly on the beat)
      const scale = 2.0 - (progress * 1.0);
      setRingScale(scale);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    rafRef.current = animId;

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [phase, endGame]);

  const handleStart = async () => {
    const ctx = await unlockAudioContext();
    if (!ctx) return;

    const startBeatDelay = 0.8; // Brief pause before 1st beat
    const firstBeatTime = ctx.currentTime + startBeatDelay;

    stateRef.current = {
      bpm: INITIAL_BPM,
      startTime: performance.now(),
      nextBeatTime: firstBeatTime,
      lastBeatTime: ctx.currentTime,
      beatCounter: 0,
      tappedBeats: new Set(),
      judgedBeats: new Set(),
      hitsCount: 0,
      totalJudgments: 0,
      accuracyPointsTotal: 0,
      currentStreak: 0,
      bestStreak: 0,
      consecutiveHits: 0,
      missStreak: 0,
      score: 0,
      isGameOver: false,
      isPlaying: true,
    };

    setBpm(INITIAL_BPM);
    setStreak(0);
    setBestStreak(0);
    setAccuracy(100);
    setFeedback(null);
    setBpmMessage(null);
    setTimeLeft(ROUND_DURATION_SEC);
    setPhase('playing');
  };

  const registerTap = useCallback(() => {
    const state = stateRef.current;
    if (!state.isPlaying || state.isGameOver) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const sinceLastMs = (now - state.lastBeatTime) * 1000;
    const toNextMs = (state.nextBeatTime - now) * 1000;

    let judgment: Judgment | null = null;
    let accPoints = 0;
    let color = '';

    // Check if within window of last beat (if not yet judged)
    if (state.beatCounter > 0 && !state.judgedBeats.has(state.beatCounter) && sinceLastMs <= 150) {
      state.judgedBeats.add(state.beatCounter);
      if (sinceLastMs <= 50) {
        judgment = 'PERFECT';
        accPoints = 100;
        color = 'var(--tempo-accent)';
        playBlip(920, 60);
      } else {
        judgment = 'GOOD';
        accPoints = 75;
        color = 'var(--phosphor)';
        playBlip(680, 50);
      }
    }
    // Check if within window of next beat
    else if (!state.judgedBeats.has(state.beatCounter + 1) && toNextMs <= 150) {
      state.judgedBeats.add(state.beatCounter + 1);
      if (toNextMs <= 50) {
        judgment = 'PERFECT';
        accPoints = 100;
        color = 'var(--tempo-accent)';
        playBlip(920, 60);
      } else {
        judgment = 'GOOD';
        accPoints = 75;
        color = 'var(--phosphor)';
        playBlip(680, 50);
      }
    }
    // Off-beat tap (outside the 150ms window)
    else {
      judgment = 'MISS';
      accPoints = 0;
      color = 'var(--reflex-accent)';
      playBlip(180, 80);
    }

    state.totalJudgments++;
    state.accuracyPointsTotal += accPoints;
    const runningAccuracy = Math.round((state.accuracyPointsTotal / state.totalJudgments) * 10) / 10;
    setAccuracy(runningAccuracy);

    if (judgment !== 'MISS') {
      state.hitsCount++;
      state.currentStreak++;
      state.consecutiveHits++;
      state.missStreak = 0;
      if (state.currentStreak > state.bestStreak) {
        state.bestStreak = state.currentStreak;
      }

      // Raise difficulty: increase BPM slightly after every 4 consecutive Perfect/Good hits
      if (state.consecutiveHits > 0 && state.consecutiveHits % 4 === 0) {
        const newBpm = Math.min(160, state.bpm + 5);
        state.bpm = newBpm;
        setBpm(newBpm);
        setBpmMessage(`+5 BPM! (${newBpm})`);
        window.setTimeout(() => setBpmMessage(null), 1200);
      }
    } else {
      state.currentStreak = 0;
      state.consecutiveHits = 0;
      state.missStreak++;
    }

    setStreak(state.currentStreak);
    setBestStreak(state.bestStreak);
    setFeedback({ text: judgment, color, id: Date.now() });

    if (state.missStreak >= MAX_MISS_STREAK) {
      endGame();
    }
  }, [endGame]);

  // Keyboard controls
  useEffect(() => {
    if (phase !== 'playing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        registerTap();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, registerTap]);

  if (phase === 'intro') {
    return (
      <GameIntro
        gameName="TEMPO"
        description="Tap in time with the beat. Precision matters more than speed."
        hint="Watch the ring shrink to the target on the click. Tap anywhere or press Space."
        accentColor={ACCENT_COLOR}
        onStart={handleStart}
      />
    );
  }

  if (phase === 'gameover') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--crt-bg)]/95 z-20 p-6 glass fade-in">
        <h2
          className="text-3xl sm:text-4xl text-[var(--tempo-accent)] mb-3"
          style={{ fontFamily: 'var(--font-display)', textShadow: '0 0 20px rgba(255, 176, 0, 0.6)' }}
        >
          ROUND COMPLETE
        </h2>

        {isNewBest && (
          <div
            className="mb-4 px-3 py-1 bg-[var(--phosphor)]/20 border border-[var(--phosphor)] text-[var(--phosphor)] text-xs uppercase tracking-widest rounded animate-pulse"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            ★ NEW BEST SCORE! ★
          </div>
        )}

        <div className="text-center mb-6 space-y-2" style={{ fontFamily: 'var(--font-body)' }}>
          <div className="text-4xl font-bold text-[var(--tempo-accent)] score-pop">
            {score} pts
          </div>
          <div className="flex gap-4 justify-center text-sm">
            <span className="text-gray-300">
              ACCURACY: <span className="text-[var(--phosphor)] font-bold">{accuracy.toFixed(1)}%</span>
            </span>
            <span className="text-gray-300">
              BEST STREAK: <span className="text-[var(--tempo-accent)] font-bold">{bestStreak}</span>
            </span>
          </div>
        </div>

        {/* Leaderboard */}
        {leaderboardEntries.length > 0 && (
          <div className="w-full max-w-sm mb-6" style={{ fontFamily: 'var(--font-body)' }}>
            <div className="text-xs text-[var(--tempo-accent)]/70 mb-2 uppercase tracking-widest text-center">
              Top Rhythm Keepers
            </div>
            <div className="flex flex-col gap-1.5 bg-black/40 border border-white/10 rounded-lg p-3">
              {leaderboardEntries.slice(0, 5).map((entry, i) => {
                const isYou = i + 1 === playerRank;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                      isYou ? 'bg-[var(--tempo-accent)]/20 border border-[var(--tempo-accent)]/40' : ''
                    }`}
                  >
                    <span
                      className="w-5 text-center font-bold"
                      style={{
                        color: i === 0 ? '#ffb000' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--tempo-accent)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 text-gray-300 truncate">
                      {entry.name}
                      {isYou && <span className="text-[var(--tempo-accent)] ml-2">← YOU</span>}
                    </span>
                    <span className="font-bold text-[var(--tempo-accent)] tabular-nums">
                      {entry.score}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-4 w-full max-w-xs" style={{ fontFamily: 'var(--font-display)' }}>
          <button
            className="flex-1 py-3 bg-[var(--tempo-accent)] text-black font-bold uppercase hover:bg-white transition-colors text-xs rounded"
            onClick={handleStart}
          >
            Play Again
          </button>
          <Link
            to="/"
            className="flex-1 py-3 border border-[var(--tempo-accent)] text-[var(--tempo-accent)] font-bold uppercase hover:bg-[var(--tempo-accent)] hover:text-black transition-colors text-xs flex items-center justify-center rounded"
          >
            Arcade
          </Link>
        </div>
      </div>
    );
  }

  // Playing Phase
  return (
    <div
      className="flex-1 w-full h-full relative overflow-hidden flex flex-col justify-between p-6 select-none touch-none cursor-pointer"
      onPointerDown={(e) => {
        e.preventDefault();
        registerTap();
      }}
    >
      {/* Top HUD */}
      <div className="w-full flex justify-between items-start z-10 font-mono pointer-events-none">
        <div>
          <div className="text-xs text-[var(--tempo-accent)]/70 tracking-widest uppercase">TEMPO</div>
          <div className="text-xl sm:text-2xl font-bold text-[var(--tempo-accent)] tabular-nums">
            {bpm} BPM
          </div>
          {bpmMessage && (
            <div
              className="text-xs text-[var(--phosphor)] font-bold animate-bounce mt-1"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {bpmMessage}
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-xs text-gray-400 tracking-widest uppercase">ACCURACY</div>
          <div className="text-xl sm:text-2xl font-bold text-[var(--phosphor)] tabular-nums">
            {accuracy.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-300 mt-1">
            STREAK: <span className="text-[var(--tempo-accent)] font-bold">{streak}</span>
          </div>
        </div>
      </div>

      {/* Central Visual Beat Indicator */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Stationary Target Ring */}
        <div
          className={`relative rounded-full border-4 flex items-center justify-center transition-all duration-75 ${
            ringFlash ? 'scale-105 border-white shadow-[0_0_35px_#ffb000]' : 'border-[var(--tempo-accent)] shadow-[0_0_15px_rgba(255,176,0,0.3)]'
          }`}
          style={{
            width: '130px',
            height: '130px',
            background: 'rgba(255, 176, 0, 0.05)',
          }}
        >
          {/* Target Center Dot */}
          <div className="w-3 h-3 rounded-full bg-[var(--tempo-accent)] shadow-[0_0_10px_var(--tempo-accent)]" />

          {/* Shrinking Outer Approach Ring (syncs continuously to metronome beat) */}
          <div
            className="absolute rounded-full border-2 border-[var(--tempo-accent)] pointer-events-none"
            style={{
              width: '130px',
              height: '130px',
              transform: `scale(${ringScale})`,
              opacity: Math.max(0.2, 1 - (ringScale - 1) * 0.7),
              boxShadow: '0 0 10px rgba(255, 176, 0, 0.4)',
            }}
          />

          {/* Real-time Feedback Text Flash */}
          {feedback && (
            <div
              key={feedback.id}
              className="absolute -top-14 text-center font-bold text-xl sm:text-2xl score-pop"
              style={{
                fontFamily: 'var(--font-display)',
                color: feedback.color,
                textShadow: `0 0 15px ${feedback.color}`,
              }}
            >
              {feedback.text}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="w-full flex justify-between items-end z-10 font-mono text-xs text-gray-400 pointer-events-none">
        <div>
          TIME LEFT: <span className="text-white font-bold">{timeLeft}s</span>
        </div>
        <div className="text-center text-[11px] text-white/30">
          TAP ON THE BEAT (OR SPACE)
        </div>
        <div>
          BEST: <span className="text-[var(--tempo-accent)] font-bold">{bestStreak}</span>
        </div>
      </div>
    </div>
  );
}