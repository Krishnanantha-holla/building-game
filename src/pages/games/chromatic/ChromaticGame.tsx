import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { addToLeaderboard, getLeaderboard } from '@/lib/scoring';
import type { LeaderboardEntry } from '@/lib/scoring';
import { unlockAudioContext, playBlip } from '@/lib/audio-engine';
import GameIntro from '@/components/GameIntro';

type GameState = 'INTRO' | 'PLAYBACK' | 'INPUT' | 'GAMEOVER';

interface PadDef {
  id: number;
  color: string;
  icon: string;
  freq: number;
  key: string;
}

const ALL_PADS: PadDef[] = [
  { id: 0, color: '#ff3b30', icon: '▲', freq: 330, key: '1' },
  { id: 1, color: '#39ff8a', icon: '■', freq: 440, key: '2' },
  { id: 2, color: '#4a90d9', icon: '●', freq: 554, key: '3' },
  { id: 3, color: '#ffb000', icon: '◆', freq: 659, key: '4' },
  { id: 4, color: '#ff2ec4', icon: '★', freq: 523, key: '5' },
  { id: 5, color: '#00e5ff', icon: '✦', freq: 784, key: '6' },
  { id: 6, color: '#e0e0e0', icon: '▼', freq: 392, key: '7' },
  { id: 7, color: '#ff6b6b', icon: '⬟', freq: 880, key: '8' },
];

export default function ChromaticGame() {
  const [gameState, setGameState] = useState<GameState>('INTRO');
  const [sequence, setSequence] = useState<number[]>([]);
  const [inputIndex, setInputIndex] = useState(0);
  const [activePad, setActivePad] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [score, setScore] = useState(0);

  const activeTimeouts = useRef<number[]>([]);

  const clearAllTimeouts = useCallback(() => {
    activeTimeouts.current.forEach(window.clearTimeout);
    activeTimeouts.current = [];
  }, []);

  useEffect(() => {
    return clearAllTimeouts;
  }, [clearAllTimeouts]);

  const getTier = (roundNum: number) => {
    if (roundNum <= 3) return { pads: 4, cols: 2, padTime: 400, gapTime: 200 };
    if (roundNum <= 6) return { pads: 6, cols: 3, padTime: 350, gapTime: 170 };
    return { pads: 8, cols: 4, padTime: 300, gapTime: 140 };
  };

  const playSequence = (seq: number[], padTime: number, gapTime: number) => {
    let delay = 500;
    
    seq.forEach((padId) => {
      const t1 = window.setTimeout(() => {
        setActivePad(padId);
        playBlip(ALL_PADS[padId].freq, padTime);
      }, delay);

      delay += padTime;

      const t2 = window.setTimeout(() => {
        setActivePad(null);
      }, delay);

      delay += gapTime;
      activeTimeouts.current.push(t1, t2);
    });

    const t3 = window.setTimeout(() => {
      setGameState('INPUT');
    }, delay);
    activeTimeouts.current.push(t3);
  };

  const startNextRound = (currentSeq: number[]) => {
    const nextRound = currentSeq.length + 1;
    const tier = getTier(nextRound);
    const newPad = Math.floor(Math.random() * tier.pads);
    const newSeq = [...currentSeq, newPad];
    
    setSequence(newSeq);
    setGameState('PLAYBACK');
    setInputIndex(0);
    setActivePad(null);
    
    playSequence(newSeq, tier.padTime, tier.gapTime);
  };

  const startGame = async () => {
    await unlockAudioContext();
    clearAllTimeouts();
    setScore(0);
    startNextRound([]);
  };

  const handleGameOver = (finalScore: number) => {
    clearAllTimeouts();
    setGameState('GAMEOVER');
    setScore(finalScore);
    const result = addToLeaderboard('chromatic', {
      name: 'PLAYER',
      score: finalScore,
      date: new Date().toISOString(),
      rounds: finalScore
    });
    setLeaderboard(result.entries);
  };

  const handlePadTap = (padId: number) => {
    if (gameState !== 'INPUT') return;

    const currentTier = getTier(sequence.length);
    playBlip(ALL_PADS[padId].freq, currentTier.padTime);
    
    setActivePad(padId);
    const t = window.setTimeout(() => setActivePad(null), 150);
    activeTimeouts.current.push(t);

    if (padId !== sequence[inputIndex]) {
      handleGameOver(sequence.length - 1);
      return;
    }

    const nextIndex = inputIndex + 1;
    if (nextIndex >= sequence.length) {
      setGameState('PLAYBACK');
      const t2 = window.setTimeout(() => startNextRound(sequence), 800);
      activeTimeouts.current.push(t2);
    } else {
      setInputIndex(nextIndex);
    }
  };

  useEffect(() => {
    if (gameState !== 'INPUT') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tier = getTier(sequence.length);
      const activePads = ALL_PADS.slice(0, tier.pads);
      const pad = activePads.find(p => p.key === e.key);
      if (pad) {
        handlePadTap(pad.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, sequence, inputIndex]);

  useEffect(() => {
    if (gameState === 'GAMEOVER') {
      setLeaderboard(getLeaderboard('chromatic'));
    }
  }, [gameState]);

  if (gameState === 'INTRO') {
    return (
      <GameIntro
        gameName="CHROMATIC"
        description="Watch the sequence, then repeat it by tapping the pads in order. One mistake ends the run."
        hint="Tap the pads or press 1-8"
        accentColor="var(--chromatic-accent)"
        onStart={startGame}
      />
    );
  }

  const currentTier = getTier(Math.max(1, sequence.length));
  const activePads = ALL_PADS.slice(0, currentTier.pads);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--crt-bg)] text-white p-4 font-[var(--font-body)]">
      <div className="w-full max-w-[360px] flex flex-col items-center">
        
        <div className="mb-8 text-center h-12">
          {gameState === 'PLAYBACK' && (
            <h2 className="text-2xl font-[var(--font-display)] text-[var(--chromatic-accent)] blink-prompt">WATCH...</h2>
          )}
          {gameState === 'INPUT' && (
            <h2 className="text-2xl font-[var(--font-display)] text-white">YOUR TURN</h2>
          )}
          {gameState === 'GAMEOVER' && (
            <h2 className="text-2xl font-[var(--font-display)] text-red-500">SYSTEM FAILURE</h2>
          )}
        </div>

        {gameState !== 'GAMEOVER' && (
          <div 
            className="grid gap-4 mb-8 w-full transition-all duration-300"
            style={{ 
              gridTemplateColumns: `repeat(${currentTier.cols}, minmax(0, 1fr))` 
            }}
          >
            {activePads.map(pad => {
              const isActive = activePad === pad.id;
              
              return (
                <button
                  key={pad.id}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handlePadTap(pad.id);
                  }}
                  className={`
                    aspect-square rounded-xl flex items-center justify-center text-4xl
                    transition-all duration-150 select-none touch-none
                  `}
                  style={{
                    border: `3px solid ${pad.color}`,
                    backgroundColor: isActive ? pad.color : `${pad.color}15`,
                    opacity: isActive ? 1 : 0.55,
                    transform: isActive ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: isActive ? `0 0 20px ${pad.color}` : 'none',
                    color: isActive ? '#000' : pad.color
                  }}
                >
                  {pad.icon}
                </button>
              );
            })}
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="w-full flex flex-col items-center fade-in">
            <div className="text-xl mb-2 text-gray-400">FINAL SEQUENCE</div>
            <div className="text-6xl font-[var(--font-display)] text-[var(--chromatic-accent)] mb-8 score-pop">
              {score}
            </div>
            
            <div className="w-full bg-black/40 border border-white/10 rounded-lg p-4 mb-8">
              <h3 className="text-center font-bold mb-4 text-[var(--chromatic-accent)]">TOP OPERATORS</h3>
              {leaderboard.length === 0 ? (
                <p className="text-center text-gray-500">NO DATA FOUND</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.slice(0, 5).map((entry, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">
                        {i + 1}. {entry.name}
                      </span>
                      <span className="font-[var(--font-display)] text-xs text-white">
                        {entry.score}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 w-full">
              <button
                onClick={startGame}
                className="w-full py-4 bg-[var(--chromatic-accent)] text-black font-bold text-lg rounded hover:bg-white transition-colors"
              >
                PLAY AGAIN
              </button>
              <Link 
                to="/" 
                className="w-full py-4 border border-[var(--chromatic-accent)] text-[var(--chromatic-accent)] font-bold text-lg rounded text-center hover:bg-[var(--chromatic-accent)] hover:text-black transition-colors"
              >
                ARCADE MENU
              </Link>
            </div>
          </div>
        )}
        
        <div className="mt-8 flex justify-between w-full text-xs text-gray-500 font-[var(--font-display)]">
          <span>{sequence.length > 0 ? `SEQ:${sequence.length}` : 'SEQ:0'}</span>
          <span>TIER:{currentTier.pads/2 - 1}</span>
        </div>
      </div>
    </div>
  );
}
