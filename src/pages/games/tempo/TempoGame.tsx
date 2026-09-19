import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { computeScore, StreakTracker, addToLeaderboard } from '@/lib/scoring';
import type { LeaderboardEntry } from '@/lib/scoring';
import { unlockAudioContext, getAudioContext, playMetronomeClick } from '@/lib/audio-engine';
import GameIntro from '@/components/GameIntro';

type GamePhase = 'intro' | 'playing' | 'gameover';

type FeedbackInfo = {
  text: string;
  type: 'perfect' | 'good' | 'miss';
  id: number;
};

export default function TempoGame() {
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [score, setScore] = useState(0);
  const [bpm, setBpm] = useState(90);
  const [streak, setStreak] = useState(0);
  const [misses, setMisses] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackInfo | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [pulse, setPulse] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [accuracyScore, setAccuracyScore] = useState(0);

  const streakTracker = useRef(new StreakTracker());
  const rafRef = useRef<number | null>(null);
  
  const stateRef = useRef({
    bpm: 90,
    score: 0,
    nextBeatTime: 0,
    lastBeatTime: 0,
    startTimeMs: 0,
    misses: 0,
    consecutiveCorrect: 0,
    totalOffsetMs: 0,
    totalTaps: 0,
    beatCounter: 0,
    tappedBeats: new Set<number>(),
    missRegisteredForBeat: false,
    gameOver: false,
    isPlaying: false
  });

  const endGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const state = stateRef.current;
    state.gameOver = true;
    state.isPlaying = false;
    
    const avgOffset = state.totalTaps > 0 ? state.totalOffsetMs / state.totalTaps : 200;
    const accScore = computeScore(avgOffset, { fullPointsThreshold: 30, zeroPointsThreshold: 200, maxPoints: 500 });
    
    setAccuracyScore(accScore);
    const finalScore = state.score + accScore;
    setScore(finalScore);
    
    const entry = { name: 'PLAYER', score: finalScore, date: new Date().toISOString(), rounds: state.totalTaps };
    const { entries, rank: r } = addToLeaderboard('tempo', entry);
    setLeaderboardEntries(entries);
    setRank(r);
    
    setPhase('gameover');
  }, []);

  const loop = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    const now = ctx.currentTime;
    const state = stateRef.current;
    
    if (state.gameOver) return;
    
    const elapsed = (performance.now() - state.startTimeMs) / 1000;
    const remaining = Math.max(0, 60 - Math.floor(elapsed));
    setTimeLeft(remaining);
    
    if (elapsed >= 60 || state.misses >= 3) {
      endGame();
      return;
    }
    
    if (now > state.lastBeatTime + 0.15 && state.beatCounter > 0 && !state.tappedBeats.has(state.beatCounter) && !state.missRegisteredForBeat) {
      state.missRegisteredForBeat = true;
      state.misses++;
      setMisses(state.misses);
      state.consecutiveCorrect = 0;
      streakTracker.current.record(false);
      setStreak(streakTracker.current.current);
      setFeedback({ text: 'MISS', type: 'miss', id: Date.now() });
    }
    
    if (now >= state.nextBeatTime) {
      playMetronomeClick();
      state.lastBeatTime = state.nextBeatTime;
      state.beatCounter++;
      state.missRegisteredForBeat = false;
      
      const beatInterval = 60 / state.bpm;
      state.nextBeatTime += beatInterval;
      
      setPulse(true);
      setTimeout(() => setPulse(false), 100);
    }
    
    rafRef.current = requestAnimationFrame(loop);
  }, [endGame]);

  const handleStart = async () => {
    const ctx = await unlockAudioContext();
    if (!ctx) return;
    setPhase('playing');
    setScore(0);
    setBpm(90);
    setStreak(0);
    setMisses(0);
    setFeedback(null);
    setTimeLeft(60);
    streakTracker.current.reset();
    
    stateRef.current = {
      bpm: 90,
      score: 0,
      nextBeatTime: ctx.currentTime + 1,
      lastBeatTime: ctx.currentTime,
      startTimeMs: performance.now(),
      misses: 0,
      consecutiveCorrect: 0,
      totalOffsetMs: 0,
      totalTaps: 0,
      beatCounter: 0,
      tappedBeats: new Set<number>(),
      missRegisteredForBeat: true,
      gameOver: false,
      isPlaying: true
    };

    loop();
  };

  const handleTap = useCallback((e?: React.MouseEvent | React.TouchEvent | KeyboardEvent) => {
    if (!stateRef.current.isPlaying || stateRef.current.gameOver) return;
    
    if (e && e.type === 'keydown') {
      const kbEvent = e as KeyboardEvent;
      if (kbEvent.code !== 'Space' && kbEvent.code !== 'Enter') return;
      kbEvent.preventDefault();
    }
    
    const ctx = getAudioContext();
    if (!ctx) return;
    
    const now = ctx.currentTime;
    const state = stateRef.current;
    
    const timeSinceLast = now - state.lastBeatTime;
    const timeToNext = state.nextBeatTime - now;
    
    let closestBeatTime: number;
    let targetBeatCounter: number;
    
    if (timeSinceLast < timeToNext) {
      closestBeatTime = state.lastBeatTime;
      targetBeatCounter = state.beatCounter;
    } else {
      closestBeatTime = state.nextBeatTime;
      targetBeatCounter = state.beatCounter + 1;
    }
    
    if (state.tappedBeats.has(targetBeatCounter)) return;
    state.tappedBeats.add(targetBeatCounter);
    
    const offsetSec = Math.abs(now - closestBeatTime);
    const offsetMs = offsetSec * 1000;
    
    state.totalTaps++;
    state.totalOffsetMs += Math.min(offsetMs, 200);
    
    let isCorrect = false;
    let fbType: 'perfect' | 'good' | 'miss' = 'miss';
    let fbText = 'MISS';
    let addedScore = 0;
    
    if (offsetMs <= 50) {
      isCorrect = true;
      fbType = 'perfect';
      fbText = 'PERFECT';
      addedScore = 10;
    } else if (offsetMs <= 150) {
      isCorrect = true;
      fbType = 'good';
      fbText = 'GOOD';
      addedScore = 5;
    }
    
    streakTracker.current.record(isCorrect);
    setStreak(streakTracker.current.current);
    
    state.score += addedScore;
    setScore(state.score);
    
    setFeedback({ text: fbText, type: fbType, id: Date.now() });
    
    if (isCorrect) {
      state.consecutiveCorrect++;
      state.misses = 0;
      setMisses(0);
      if (state.consecutiveCorrect % 8 === 0) {
        state.bpm += 5;
        setBpm(state.bpm);
      }
    } else {
      state.consecutiveCorrect = 0;
      state.misses++;
      setMisses(state.misses);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => handleTap(e);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleTap]);

  return (
    <div className="w-full h-screen bg-[var(--crt-bg)] overflow-hidden font-mono text-white select-none">
      {phase === 'intro' && (
        <GameIntro 
          gameName="TEMPO" 
          description="Tap in time with the beat. Precision matters more than speed." 
          hint="Tap/click anywhere or press Space" 
          accentColor="var(--tempo-accent)" 
          onStart={handleStart} 
        />
      )}

      {phase === 'playing' && (
        <div 
          className="relative w-full h-full flex flex-col"
          onClick={handleTap}
          onTouchStart={(e) => { e.preventDefault(); handleTap(); }}
        >
          <div className="absolute top-6 left-6 text-[var(--tempo-accent)] text-2xl" style={{ fontFamily: 'var(--font-display)' }}>
            BPM: {bpm}
          </div>
          
          <div className="absolute top-6 right-6 text-right">
            <div className="text-[var(--tempo-accent)] text-2xl score-pop" style={{ fontFamily: 'var(--font-display)' }}>{score}</div>
            <div className="text-[var(--phosphor)] text-lg streak-pop mt-2" style={{ fontFamily: 'var(--font-body)' }}>Streak: {streak}</div>
          </div>
          
          <div className="absolute bottom-6 left-6 text-white/50 text-xl" style={{ fontFamily: 'var(--font-body)' }}>
            Time: {timeLeft}s
          </div>
          
          <div className="absolute bottom-6 right-6 text-[var(--reflex-accent)] text-xl" style={{ fontFamily: 'var(--font-body)' }}>
            Misses: {misses}/3
          </div>

          <div 
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full border-4 flex items-center justify-center transition-transform duration-100 ${pulse ? 'scale-110' : 'scale-100'}`}
            style={{ borderColor: 'var(--tempo-accent)' }}
          >
            {feedback && (
              <div 
                key={feedback.id} 
                className="text-2xl font-bold fade-in text-center" 
                style={{ 
                  fontFamily: 'var(--font-display)',
                  color: feedback.type === 'perfect' ? 'var(--tempo-accent)' : feedback.type === 'good' ? 'var(--phosphor)' : 'var(--reflex-accent)' 
                }}
              >
                {feedback.text}
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--crt-bg)]/90 z-20 p-6 glass fade-in">
          <h2 className="text-4xl text-[var(--tempo-accent)] mb-8" style={{ fontFamily: 'var(--font-display)' }}>GAME OVER</h2>
          
          <div className="text-center mb-8 space-y-4" style={{ fontFamily: 'var(--font-body)' }}>
            <div className="text-2xl">Final Score: <span className="text-[var(--tempo-accent)] score-pop font-bold">{score}</span></div>
            <div className="text-xl text-[var(--phosphor)]">Accuracy Bonus: +{Math.round(accuracyScore)}</div>
            <div className="text-xl text-[var(--echo-accent)]">Best Streak: {streakTracker.current.best}</div>
          </div>

          {/* Leaderboard */}
          {leaderboardEntries.length > 0 && (
            <div className="w-full max-w-sm mb-8" style={{ fontFamily: 'var(--font-body)' }}>
              <div className="text-sm text-[var(--tempo-accent)]/50 mb-2 uppercase tracking-widest text-center">Top Scores</div>
              <div className="flex flex-col gap-1">
                {leaderboardEntries.map((entry, i) => {
                  const isYou = i + 1 === rank;
                  return (
                    <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${isYou ? 'bg-[var(--tempo-accent)]/10 border border-[var(--tempo-accent)]/20' : ''}`}>
                      <span className="w-6 text-center font-bold" style={{ color: i === 0 ? '#ffb000' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--tempo-accent)' }}>{i + 1}</span>
                      <span className="flex-1 text-[var(--tempo-accent)]/70">
                        {entry.name}
                        {isYou && <span className="text-[var(--tempo-accent)] text-xs ml-2">← YOU</span>}
                      </span>
                      <span className="font-bold text-[var(--tempo-accent)]">{entry.score}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-4 mt-4" style={{ fontFamily: 'var(--font-display)' }}>
            <button 
              className="px-6 py-4 bg-[var(--tempo-accent)] text-black font-bold uppercase hover:bg-white transition-colors text-sm"
              onClick={handleStart}
            >
              Play Again
            </button>
            <Link 
              to="/" 
              className="px-6 py-4 border-2 border-[var(--tempo-accent)] text-[var(--tempo-accent)] font-bold uppercase hover:bg-[var(--tempo-accent)] hover:text-black transition-colors text-sm flex items-center justify-center"
            >
              Arcade
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}