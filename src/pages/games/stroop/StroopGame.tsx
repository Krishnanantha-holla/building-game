import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { addToLeaderboard, getLeaderboard } from '@/lib/scoring';
import type { LeaderboardEntry } from '@/lib/scoring';
import { unlockAudioContext, playBlip } from '@/lib/audio-engine';
import GameIntro from '@/components/GameIntro';

type GamePhase = 'intro' | 'playing' | 'gameover';

interface ColorDef {
  id: string;
  name: string;
  hex: string;
  key: string;
}

const COLORS: ColorDef[] = [
  { id: 'red', name: 'RED', hex: '#ff3b30', key: '1' },
  { id: 'blue', name: 'BLUE', hex: '#00a8ff', key: '2' },
  { id: 'green', name: 'GREEN', hex: '#39ff8a', key: '3' },
  { id: 'yellow', name: 'YELLOW', hex: '#ffea00', key: '4' },
];

const ACCENT_COLOR = '#a6ff00';
const BASE_TIME_LIMIT_MS = 2500;
const MIN_TIME_LIMIT_MS = 650;
const TIME_DECREMENT_PER_ROUND_MS = 85;

export default function StroopGame() {
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [round, setRound] = useState(1);
  const [currentWord, setCurrentWord] = useState<ColorDef>(COLORS[0]);
  const [currentColor, setCurrentColor] = useState<ColorDef>(COLORS[1]);
  const [score, setScore] = useState(0);
  const [timeFraction, setTimeFraction] = useState(1);
  const [isNewBest, setIsNewBest] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const roundDurationRef = useRef(BASE_TIME_LIMIT_MS);
  const isOverRef = useRef(false);

  // Generate next mismatch word and color
  const getNextPairing = useCallback((prevWordId?: string, prevColorId?: string) => {
    // Pick word
    let wordCandidates = COLORS;
    if (prevWordId) {
      wordCandidates = COLORS.filter(c => c.id !== prevWordId);
    }
    const word = wordCandidates[Math.floor(Math.random() * wordCandidates.length)];

    // Pick rendered color strictly DIFFERENT from the word text
    const colorCandidates = COLORS.filter(c => c.id !== word.id && c.id !== prevColorId);
    const color = colorCandidates.length > 0
      ? colorCandidates[Math.floor(Math.random() * colorCandidates.length)]
      : COLORS.filter(c => c.id !== word.id)[0];

    return { word, color };
  }, []);

  const endGame = useCallback((roundsSurvived: number) => {
    if (isOverRef.current) return;
    isOverRef.current = true;
    if (timerRef.current) cancelAnimationFrame(timerRef.current);

    playBlip(160, 300); // Fail sound

    setScore(roundsSurvived);

    const prevScores = getLeaderboard('stroop');
    const newBest = prevScores.length === 0 || roundsSurvived > prevScores[0].score;
    setIsNewBest(newBest);

    const entry: LeaderboardEntry = {
      name: 'OPERATOR',
      score: roundsSurvived,
      date: new Date().toISOString(),
      rounds: roundsSurvived,
    };

    const { entries, rank } = addToLeaderboard('stroop', entry);
    setLeaderboardEntries(entries);
    setPlayerRank(rank);
    setPhase('gameover');
  }, []);

  const startRound = useCallback((roundNum: number, prevWordId?: string, prevColorId?: string) => {
    const { word, color } = getNextPairing(prevWordId, prevColorId);
    setCurrentWord(word);
    setCurrentColor(color);
    setRound(roundNum);

    const duration = Math.max(
      MIN_TIME_LIMIT_MS,
      BASE_TIME_LIMIT_MS - (roundNum - 1) * TIME_DECREMENT_PER_ROUND_MS
    );
    roundDurationRef.current = duration;
    startTimeRef.current = performance.now();
    setTimeFraction(1);

    if (timerRef.current) cancelAnimationFrame(timerRef.current);

    const checkTimer = () => {
      if (isOverRef.current) return;
      const now = performance.now();
      const elapsed = now - startTimeRef.current;
      const remaining = Math.max(0, 1 - elapsed / roundDurationRef.current);
      setTimeFraction(remaining);

      if (remaining <= 0) {
        endGame(roundNum - 1);
      } else {
        timerRef.current = requestAnimationFrame(checkTimer);
      }
    };

    timerRef.current = requestAnimationFrame(checkTimer);
  }, [getNextPairing, endGame]);

  const handleStart = async () => {
    await unlockAudioContext();
    isOverRef.current = false;
    setScore(0);
    setPhase('playing');
    startRound(1);
  };

  const handleSwatchTap = (colorId: string) => {
    if (phase !== 'playing' || isOverRef.current) return;

    if (colorId === currentColor.id) {
      // Correct! Player tapped the ink color!
      playBlip(750 + Math.min(600, round * 25), 60);
      startRound(round + 1, currentWord.id, currentColor.id);
    } else {
      // Wrong swatch tapped!
      endGame(round - 1);
    }
  };

  // Keyboard controls (1, 2, 3, 4 or R, B, G, Y)
  useEffect(() => {
    if (phase !== 'playing') return;

    const onKeyDown = (e: KeyboardEvent) => {
      const match = COLORS.find(c => c.key === e.key || c.name[0].toLowerCase() === e.key.toLowerCase());
      if (match) {
        e.preventDefault();
        handleSwatchTap(match.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, round, currentColor]);

  // Clean up timer
  useEffect(() => {
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, []);

  if (phase === 'intro') {
    return (
      <GameIntro
        gameName="STROOP"
        description="The word lies. Tap the color it's actually shown in, not what it says."
        hint="Ignore the word text. Focus on the ink color. Speed increases each round."
        accentColor={ACCENT_COLOR}
        onStart={handleStart}
      />
    );
  }

  if (phase === 'gameover') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--crt-bg)]/95 z-20 p-6 glass fade-in">
        <h2
          className="text-3xl sm:text-4xl text-[var(--stroop-accent)] mb-3"
          style={{ fontFamily: 'var(--font-display)', textShadow: '0 0 20px rgba(166, 255, 0, 0.6)' }}
        >
          COGNITIVE OVERLOAD
        </h2>

        {isNewBest && (
          <div
            className="mb-4 px-3 py-1 bg-[var(--phosphor)]/20 border border-[var(--phosphor)] text-[var(--phosphor)] text-xs uppercase tracking-widest rounded animate-pulse"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            ★ NEW BEST SCORE! ★
          </div>
        )}

        <div className="text-center mb-6 space-y-1" style={{ fontFamily: 'var(--font-body)' }}>
          <div className="text-gray-400 text-sm">ROUNDS SURVIVED</div>
          <div className="text-5xl font-bold text-[var(--stroop-accent)] score-pop">
            {score}
          </div>
        </div>

        {/* Leaderboard */}
        {leaderboardEntries.length > 0 && (
          <div className="w-full max-w-sm mb-6" style={{ fontFamily: 'var(--font-body)' }}>
            <div className="text-xs text-[var(--stroop-accent)]/70 mb-2 uppercase tracking-widest text-center">
              Top Operators
            </div>
            <div className="flex flex-col gap-1.5 bg-black/40 border border-white/10 rounded-lg p-3">
              {leaderboardEntries.slice(0, 5).map((entry, i) => {
                const isYou = i + 1 === playerRank;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                      isYou ? 'bg-[var(--stroop-accent)]/20 border border-[var(--stroop-accent)]/40' : ''
                    }`}
                  >
                    <span
                      className="w-5 text-center font-bold"
                      style={{
                        color: i === 0 ? '#ffb000' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--stroop-accent)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 text-gray-300 truncate">
                      {entry.name}
                      {isYou && <span className="text-[var(--stroop-accent)] ml-2">← YOU</span>}
                    </span>
                    <span className="font-bold text-[var(--stroop-accent)] tabular-nums">
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
            className="flex-1 py-3 bg-[var(--stroop-accent)] text-black font-bold uppercase hover:bg-white transition-colors text-xs rounded"
            onClick={handleStart}
          >
            Play Again
          </button>
          <Link
            to="/"
            className="flex-1 py-3 border border-[var(--stroop-accent)] text-[var(--stroop-accent)] font-bold uppercase hover:bg-[var(--stroop-accent)] hover:text-black transition-colors text-xs flex items-center justify-center rounded"
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
      {/* Top Status Bar & Timer */}
      <div className="w-full flex flex-col gap-2 z-10 font-mono">
        <div className="flex justify-between items-center text-sm">
          <span className="text-[var(--stroop-accent)] font-bold tracking-widest uppercase">
            ROUND {round}
          </span>
          <span className="text-gray-400 text-xs">
            SURVIVED: <span className="text-white font-bold">{round - 1}</span>
          </span>
        </div>

        {/* Progress Timer Bar */}
        <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden border border-white/20">
          <div
            className="h-full transition-all duration-75 ease-linear rounded-full"
            style={{
              width: `${Math.max(0, timeFraction * 100)}%`,
              backgroundColor: timeFraction > 0.3 ? 'var(--stroop-accent)' : 'var(--reflex-accent)',
              boxShadow: `0 0 10px ${timeFraction > 0.3 ? 'var(--stroop-accent)' : 'var(--reflex-accent)'}`,
            }}
          />
        </div>
      </div>

      {/* Center Stroop Word Display */}
      <div className="flex-1 flex flex-col items-center justify-center my-6 z-10">
        <div className="text-xs text-gray-400 font-mono tracking-widest uppercase mb-3">
          TAP THE INK COLOR
        </div>
        <div
          className="text-5xl sm:text-7xl font-bold tracking-wider uppercase transition-transform duration-100 score-pop"
          style={{
            fontFamily: 'var(--font-display)',
            color: currentColor.hex,
            textShadow: `0 0 30px ${currentColor.hex}`,
          }}
        >
          {currentWord.name}
        </div>
      </div>

      {/* Bottom Swatches Grid */}
      <div className="w-full max-w-md mx-auto grid grid-cols-2 gap-4 pb-4 z-10">
        {COLORS.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSwatchTap(c.id)}
            className="h-20 sm:h-24 rounded-xl border-3 flex flex-col items-center justify-center transition-transform duration-100 hover:scale-[1.03] active:scale-95 cursor-pointer"
            style={{
              borderColor: c.hex,
              background: `color-mix(in srgb, ${c.hex} 20%, #14141d)`,
              boxShadow: `0 0 15px ${c.hex}40`,
            }}
          >
            <span
              className="text-lg sm:text-xl font-bold uppercase tracking-wider"
              style={{
                fontFamily: 'var(--font-display)',
                color: c.hex,
                textShadow: `0 0 10px ${c.hex}`,
              }}
            >
              {c.name}
            </span>
            <span className="text-[10px] text-gray-400 font-mono mt-1 opacity-60">
              [{c.key}]
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
