import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { addToLeaderboard, getLeaderboard } from '@/lib/scoring';
import type { LeaderboardEntry } from '@/lib/scoring';
import { unlockAudioContext, playBlip } from '@/lib/audio-engine';
import GameIntro from '@/components/GameIntro';

type GamePhase = 'intro' | 'playing' | 'gameover';

const GRID_SIZE = 4;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE; // 16 cells
const ACCENT_COLOR = '#00a8ff';
const BASE_DURATION_MS = 1100;
const MIN_DURATION_MS = 320;
const MAX_STRIKES = 3;

export default function GlitchTapGame() {
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [litCell, setLitCell] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [cellProgress, setCellProgress] = useState(1);
  const [isNewBest, setIsNewBest] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);

  const cellTimerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const stateRef = useRef({
    litIndex: -1,
    cellStartTime: 0,
    cellDuration: BASE_DURATION_MS,
    score: 0,
    streak: 0,
    bestStreak: 0,
    strikes: 0,
    isGameOver: false,
  });

  const endGame = useCallback(() => {
    const state = stateRef.current;
    if (state.isGameOver) return;
    state.isGameOver = true;

    if (cellTimerRef.current) clearTimeout(cellTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    playBlip(150, 350); // Glitch crash sound

    const finalScore = state.score;
    setScore(finalScore);

    const prevScores = getLeaderboard('glitch-tap');
    const newBest = prevScores.length === 0 || finalScore > prevScores[0].score;
    setIsNewBest(newBest);

    const entry: LeaderboardEntry = {
      name: 'SYNAPSE',
      score: finalScore,
      date: new Date().toISOString(),
      rounds: finalScore,
    };

    const { entries, rank } = addToLeaderboard('glitch-tap', entry);
    setLeaderboardEntries(entries);
    setPlayerRank(rank);
    setPhase('gameover');
  }, []);

  const spawnNextCell = useCallback(() => {
    const state = stateRef.current;
    if (state.isGameOver) return;

    if (cellTimerRef.current) clearTimeout(cellTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    // Pick random cell index different from current
    let nextIndex = Math.floor(Math.random() * TOTAL_CELLS);
    while (nextIndex === state.litIndex && TOTAL_CELLS > 1) {
      nextIndex = Math.floor(Math.random() * TOTAL_CELLS);
    }
    state.litIndex = nextIndex;
    setLitCell(nextIndex);

    // Exponential speedup: duration decreases with score/streak
    const duration = Math.max(
      MIN_DURATION_MS,
      BASE_DURATION_MS * Math.pow(0.96, state.score)
    );
    state.cellDuration = duration;
    state.cellStartTime = performance.now();
    setCellProgress(1);

    // Frame animation for shrinking progress inside the cell
    const updateProgress = () => {
      if (state.isGameOver) return;
      const elapsed = performance.now() - state.cellStartTime;
      const remaining = Math.max(0, 1 - elapsed / state.cellDuration);
      setCellProgress(remaining);

      if (remaining > 0) {
        animFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };
    animFrameRef.current = requestAnimationFrame(updateProgress);

    // Expiry timeout: cell faded out without being tapped
    cellTimerRef.current = window.setTimeout(() => {
      if (state.isGameOver) return;

      playBlip(200, 100); // Miss blip
      state.streak = 0;
      setStreak(0);
      state.strikes++;
      setStrikes(state.strikes);

      if (state.strikes >= MAX_STRIKES) {
        endGame();
      } else {
        spawnNextCell();
      }
    }, duration);
  }, [endGame]);

  const handleStart = async () => {
    await unlockAudioContext();

    stateRef.current = {
      litIndex: -1,
      cellStartTime: 0,
      cellDuration: BASE_DURATION_MS,
      score: 0,
      streak: 0,
      bestStreak: 0,
      strikes: 0,
      isGameOver: false,
    };

    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setStrikes(0);
    setPhase('playing');

    spawnNextCell();
  };

  const handleCellClick = (index: number) => {
    const state = stateRef.current;
    if (phase !== 'playing' || state.isGameOver) return;

    if (index === state.litIndex) {
      // Correct tap!
      playBlip(600 + Math.min(650, state.streak * 30), 50);
      state.score++;
      state.streak++;
      if (state.streak > state.bestStreak) {
        state.bestStreak = state.streak;
      }
      setScore(state.score);
      setStreak(state.streak);
      setBestStreak(state.bestStreak);

      spawnNextCell();
    } else {
      // Wrong cell tapped!
      playBlip(180, 120);
      state.streak = 0;
      setStreak(0);
      state.strikes++;
      setStrikes(state.strikes);

      if (state.strikes >= MAX_STRIKES) {
        endGame();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (cellTimerRef.current) clearTimeout(cellTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  if (phase === 'intro') {
    return (
      <GameIntro
        gameName="GLITCH TAP"
        description="Tap the lit cell before it fades. It gets faster."
        hint="4x4 grid. 3 strikes allowed. Every hit accelerates the next cell."
        accentColor={ACCENT_COLOR}
        onStart={handleStart}
      />
    );
  }

  if (phase === 'gameover') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--crt-bg)]/95 z-20 p-6 glass fade-in">
        <h2
          className="text-3xl sm:text-4xl text-[var(--glitch-accent)] mb-3"
          style={{ fontFamily: 'var(--font-display)', textShadow: '0 0 20px rgba(0, 168, 255, 0.6)' }}
        >
          CIRCUIT OVERHEAT
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
          <div className="text-gray-400 text-sm">TOTAL CELLS TAPPED</div>
          <div className="text-5xl font-bold text-[var(--glitch-accent)] score-pop">
            {score}
          </div>
          <div className="text-sm text-gray-300">
            HIGHEST STREAK: <span className="text-[var(--phosphor)] font-bold">{bestStreak}</span>
          </div>
        </div>

        {/* Leaderboard */}
        {leaderboardEntries.length > 0 && (
          <div className="w-full max-w-sm mb-6" style={{ fontFamily: 'var(--font-body)' }}>
            <div className="text-xs text-[var(--glitch-accent)]/70 mb-2 uppercase tracking-widest text-center">
              Top Glitch Tappers
            </div>
            <div className="flex flex-col gap-1.5 bg-black/40 border border-white/10 rounded-lg p-3">
              {leaderboardEntries.slice(0, 5).map((entry, i) => {
                const isYou = i + 1 === playerRank;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                      isYou ? 'bg-[var(--glitch-accent)]/20 border border-[var(--glitch-accent)]/40' : ''
                    }`}
                  >
                    <span
                      className="w-5 text-center font-bold"
                      style={{
                        color: i === 0 ? '#ffb000' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--glitch-accent)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 text-gray-300 truncate">
                      {entry.name}
                      {isYou && <span className="text-[var(--glitch-accent)] ml-2">← YOU</span>}
                    </span>
                    <span className="font-bold text-[var(--glitch-accent)] tabular-nums">
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
            className="flex-1 py-3 bg-[var(--glitch-accent)] text-black font-bold uppercase hover:bg-white transition-colors text-xs rounded"
            onClick={handleStart}
          >
            Play Again
          </button>
          <Link
            to="/"
            className="flex-1 py-3 border border-[var(--glitch-accent)] text-[var(--glitch-accent)] font-bold uppercase hover:bg-[var(--glitch-accent)] hover:text-black transition-colors text-xs flex items-center justify-center rounded"
          >
            Arcade
          </Link>
        </div>
      </div>
    );
  }

  // Playing Phase
  return (
    <div className="flex-1 w-full h-full flex flex-col justify-between p-6 select-none relative overflow-hidden">
      {/* Top Status Bar */}
      <div className="w-full flex justify-between items-center z-10 font-mono text-sm">
        <div>
          <span className="text-xs text-[var(--glitch-accent)]/70 uppercase tracking-widest block">SCORE</span>
          <span className="text-2xl font-bold text-[var(--glitch-accent)] tabular-nums">{score}</span>
        </div>

        <div className="text-center">
          <span className="text-xs text-gray-400 uppercase tracking-widest block">STREAK</span>
          <span className="text-xl font-bold text-[var(--phosphor)] tabular-nums">{streak}</span>
        </div>

        <div className="text-right">
          <span className="text-xs text-gray-400 uppercase tracking-widest block">STRIKES</span>
          <div className="flex gap-1 justify-end mt-1">
            {Array.from({ length: MAX_STRIKES }).map((_, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-sm border ${
                  i < strikes
                    ? 'bg-[var(--reflex-accent)] border-[var(--reflex-accent)] shadow-[0_0_8px_var(--reflex-accent)]'
                    : 'bg-white/5 border-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Center 4x4 Grid */}
      <div className="flex-1 flex items-center justify-center my-4 z-10">
        <div
          className="grid grid-cols-4 gap-3 w-full max-w-[340px] sm:max-w-[400px] aspect-square p-3 bg-black/40 border-2 border-white/10 rounded-2xl"
          style={{ boxShadow: '0 0 25px rgba(0, 168, 255, 0.1)' }}
        >
          {Array.from({ length: TOTAL_CELLS }).map((_, index) => {
            const isLit = litCell === index;
            return (
              <button
                key={index}
                onClick={() => handleCellClick(index)}
                className={`relative rounded-xl border-2 overflow-hidden transition-transform duration-75 active:scale-95 cursor-pointer ${
                  isLit
                    ? 'border-[var(--glitch-accent)] shadow-[0_0_20px_var(--glitch-accent)] bg-[var(--glitch-accent)]/20'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                }`}
              >
                {/* Lit Cell Depletion Fill */}
                {isLit && (
                  <div
                    className="absolute inset-0 bg-[var(--glitch-accent)]/40 pointer-events-none origin-bottom transition-transform duration-75 ease-linear"
                    style={{
                      transform: `scaleY(${cellProgress})`,
                    }}
                  />
                )}
                {/* Center Pulse Dot */}
                {isLit && (
                  <div className="absolute inset-0 m-auto w-3 h-3 rounded-full bg-white shadow-[0_0_12px_#fff]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="text-center text-xs text-white/30 font-mono">
        TAP THE GLITCHED CELL BEFORE IT EXPIRES
      </div>
    </div>
  );
}
