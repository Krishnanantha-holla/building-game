import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { computeScore, addToLeaderboard } from '@/lib/scoring';
import type { LeaderboardEntry } from '@/lib/scoring';
import { unlockAudioContext, playBlip } from '@/lib/audio-engine';
import GameIntro from '@/components/GameIntro';

type GamePhase = 'INTRO' | 'WAITING' | 'READY' | 'TOO_SOON' | 'RESULT' | 'GAMEOVER';

export default function ReflexGame() {
  const [phase, setPhase] = useState<GamePhase>('INTRO');
  const [round, setRound] = useState(1);
  const [times, setTimes] = useState<number[]>([]);
  const [lastTime, setLastTime] = useState<number>(0);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [score, setScore] = useState(0);
  const [playerRank, setPlayerRank] = useState<number | null>(null);

  const startTimeRef = useRef<number>(0);
  const timeoutRef = useRef<number | undefined>(undefined);

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  };

  useEffect(() => {
    return clearTimer;
  }, []);

  const handleAction = useCallback(() => {
    if (phase === 'WAITING') {
      clearTimer();
      setPhase('TOO_SOON');
      setLastTime(600); // 600ms penalty
      playBlip(150, 100);
      timeoutRef.current = window.setTimeout(() => {
        advanceRound(600);
      }, 1500);
    } else if (phase === 'READY') {
      const rt = Math.round(performance.now() - startTimeRef.current);
      setLastTime(rt);
      setPhase('RESULT');
      playBlip(800, 50);
      timeoutRef.current = window.setTimeout(() => {
        advanceRound(rt);
      }, 1500);
    }
  }, [phase]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (phase === 'WAITING' || phase === 'READY') {
          e.preventDefault();
          handleAction();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAction, phase]);

  const startRound = () => {
    setPhase('WAITING');
    const delay = 1500 + Math.random() * 2500;
    clearTimer();
    timeoutRef.current = window.setTimeout(() => {
      setPhase('READY');
      startTimeRef.current = performance.now();
    }, delay);
  };

  const advanceRound = (rt: number) => {
    setTimes(prev => {
      const newTimes = [...prev, rt];
      if (newTimes.length >= 5) {
        endGame(newTimes);
      } else {
        setRound(r => r + 1);
        startRound();
      }
      return newTimes;
    });
  };

  const endGame = (finalTimes: number[]) => {
    setPhase('GAMEOVER');
    const avg = finalTimes.reduce((a, b) => a + b, 0) / finalTimes.length;
    const finalScore = computeScore(avg, { fullPointsThreshold: 150, zeroPointsThreshold: 600, maxPoints: 500 });
    setScore(finalScore);
    const res = addToLeaderboard('reflex', { name: 'P1', score: finalScore, date: new Date().toISOString(), rounds: 5 });
    setLeaderboardEntries(res.entries);
    setPlayerRank(res.rank);
  };

  const resetGame = () => {
    setRound(1);
    setTimes([]);
    setPhase('INTRO');
  };

  if (phase === 'INTRO') {
    return (
      <GameIntro
        gameName="REFLEX"
        description="Wait for the flash, then tap as fast as you can. Tapping early is a fail."
        hint="Tap/click anywhere or press Space"
        accentColor="var(--reflex-accent)"
        onStart={() => {
          unlockAudioContext();
          startRound();
        }}
      />
    );
  }

  const renderGame = () => {
    if (phase === 'GAMEOVER') {
      const fastest = Math.min(...times);
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      return (
        <div className="flex flex-col items-center justify-center min-h-screen text-[var(--phosphor)] p-4 bg-[var(--crt-bg)]">
          <div className="glass p-6 w-full max-w-md flex flex-col items-center">
            <h1 className="text-3xl font-[family-name:var(--font-display)] text-[var(--reflex-accent)] mb-6">GAME OVER</h1>
            
            <div className="w-full flex flex-col gap-2 mb-6 font-[family-name:var(--font-body)]">
              {times.map((t, i) => (
                <div key={i} className="flex justify-between w-full text-lg">
                  <span>ROUND {i + 1}</span>
                  <span style={{ 
                    color: t === fastest ? 'var(--phosphor)' : (t === 600 ? 'var(--reflex-accent)' : 'inherit') 
                  }}>
                    {t === 600 ? 'MISS' : `${t}ms`}
                  </span>
                </div>
              ))}
              <div className="w-full border-t border-[var(--phosphor)]/30 my-2 pt-2 flex justify-between font-bold">
                <span>AVERAGE</span>
                <span>{Math.round(avg)}ms</span>
              </div>
            </div>

            <div className="mb-8 flex flex-col items-center text-center">
              <div className="text-sm text-[var(--phosphor)]/70 mb-1 font-[family-name:var(--font-body)]">SCORE</div>
              <div className="text-4xl font-[family-name:var(--font-display)] text-[var(--phosphor)]">{score}</div>
            </div>

            {/* Leaderboard */}
            {leaderboardEntries.length > 0 && (
              <div className="w-full mb-6">
                <div className="text-sm text-[var(--phosphor)]/50 mb-2 font-[family-name:var(--font-body)] uppercase tracking-widest text-center">Top Scores</div>
                <div className="flex flex-col gap-1">
                  {leaderboardEntries.map((entry, i) => {
                    const isYou = i + 1 === playerRank;
                    return (
                      <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm font-[family-name:var(--font-body)] ${isYou ? 'bg-[var(--phosphor)]/10 border border-[var(--phosphor)]/20' : ''}`}>
                        <span className="w-6 text-center font-bold" style={{ color: i === 0 ? '#ffb000' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--phosphor)' }}>{i + 1}</span>
                        <span className="flex-1 text-[var(--phosphor)]/70">
                          {entry.name}
                          {isYou && <span className="text-[var(--phosphor)] text-xs ml-2">← YOU</span>}
                        </span>
                        <span className="font-bold text-[var(--phosphor)]">{entry.score}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 w-full">
              <button 
                onClick={resetGame}
                className="flex-1 py-3 border-2 border-[var(--phosphor)] text-[var(--phosphor)] hover:bg-[var(--phosphor)] hover:text-[var(--crt-bg)] transition-colors font-[family-name:var(--font-display)] uppercase text-xs"
              >
                PLAY AGAIN
              </button>
              <Link 
                to="/"
                className="flex-1 py-3 border-2 border-[var(--phosphor)]/30 text-[var(--phosphor)]/70 hover:border-[var(--phosphor)] hover:text-[var(--phosphor)] transition-colors font-[family-name:var(--font-display)] uppercase text-xs text-center flex items-center justify-center"
              >
                ARCADE
              </Link>
            </div>
          </div>
        </div>
      );
    }

    let bgClass = "bg-[var(--crt-bg)]";
    let content = null;

    if (phase === 'WAITING') {
      content = <div className="text-[var(--phosphor)] opacity-30 text-2xl font-[family-name:var(--font-display)]">WAIT...</div>;
    } else if (phase === 'READY') {
      bgClass = "bg-[var(--reflex-accent)]";
      content = <div className="text-[var(--crt-bg)] text-5xl md:text-7xl font-[family-name:var(--font-display)]">TAP NOW!</div>;
    } else if (phase === 'TOO_SOON') {
      bgClass = "bg-[#4a0000]";
      content = <div className="text-[var(--reflex-accent)] text-4xl md:text-5xl font-[family-name:var(--font-display)]">TOO SOON!</div>;
    } else if (phase === 'RESULT') {
      content = <div className="text-[var(--phosphor)] text-4xl md:text-5xl font-[family-name:var(--font-display)]">{lastTime}ms</div>;
    }

    return (
      <div 
        className={`fixed inset-0 flex flex-col items-center justify-center ${bgClass} select-none cursor-pointer transition-none`}
        onTouchStart={(e) => {
          e.preventDefault();
          if (phase === 'WAITING' || phase === 'READY') handleAction();
        }}
        onMouseDown={(e) => {
          if (e.button === 0 && (phase === 'WAITING' || phase === 'READY')) handleAction();
        }}
      >
        <div className="absolute top-4 left-4 text-[var(--phosphor)]/50 font-[family-name:var(--font-body)] text-sm tracking-widest z-10 pointer-events-none">
          ROUND {round}/5
        </div>
        {content}
      </div>
    );
  };

  return renderGame();
}
