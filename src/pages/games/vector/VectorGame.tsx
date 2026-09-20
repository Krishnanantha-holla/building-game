import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { addToLeaderboard } from '@/lib/scoring';
import type { LeaderboardEntry } from '@/lib/scoring';
import { unlockAudioContext, playBlip } from '@/lib/audio-engine';
import GameIntro from '@/components/GameIntro';

type GamePhase = 'intro' | 'playing' | 'gameover';

interface Obstacle {
  id: number;
  x: number;
  y: number;
  speed: number;
  size: number;
  type: 'asteroid' | 'enemy';
}

export default function VectorGame() {
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [score, setScore] = useState(0);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  
  // Game state refs for the physics loop
  const stateRef = useRef({
    playerX: 50, // percentage 0-100
    obstacles: [] as Obstacle[],
    score: 0,
    speedMultiplier: 1,
    lastTime: 0,
    obstacleIdCounter: 0,
    isGameOver: false,
  });

  const handleStart = useCallback(async () => {
    await unlockAudioContext();
    
    stateRef.current = {
      playerX: 50,
      obstacles: [],
      score: 0,
      speedMultiplier: 1,
      lastTime: performance.now(),
      obstacleIdCounter: 0,
      isGameOver: false,
    };
    
    setScore(0);
    setPhase('playing');
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(gameLoop);
  }, []);

  const endGame = useCallback(() => {
    stateRef.current.isGameOver = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    playBlip(150, 400); // crash sound
    
    const finalScore = Math.floor(stateRef.current.score);
    setScore(finalScore);
    
    const entry = { name: 'PLAYER', score: finalScore, date: new Date().toISOString(), rounds: 1 };
    const { entries, rank } = addToLeaderboard('vector', entry);
    setLeaderboardEntries(entries);
    setPlayerRank(rank);
    
    setPhase('gameover');
  }, []);

  const gameLoop = useCallback((time: number) => {
    const state = stateRef.current;
    if (state.isGameOver) return;
    
    const dt = (time - state.lastTime) / 1000;
    state.lastTime = time;
    
    // Increase speed and score over time
    state.speedMultiplier += dt * 0.05;
    state.score += dt * 100 * state.speedMultiplier;
    
    // Spawn obstacles
    if (Math.random() < 0.03 * state.speedMultiplier) {
      state.obstacles.push({
        id: state.obstacleIdCounter++,
        x: Math.random() * 90 + 5, // 5% to 95%
        y: -10, // above screen
        speed: (Math.random() * 30 + 30) * state.speedMultiplier,
        size: Math.random() * 15 + 10, // 10% to 25% width
        type: Math.random() > 0.8 ? 'enemy' : 'asteroid'
      });
    }
    
    // Move obstacles and check collisions
    const playerWidth = 10;
    const playerY = 85; // 85% down the screen
    const playerHeight = 5;
    
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const obs = state.obstacles[i];
      obs.y += obs.speed * dt;
      
      // Collision detection (AABB percentage based)
      const hitX = Math.abs(obs.x - state.playerX) < (obs.size/2 + playerWidth/2);
      const hitY = Math.abs(obs.y - playerY) < (obs.size/2 + playerHeight/2);
      
      if (hitX && hitY) {
        endGame();
        return;
      }
      
      // Remove off-screen
      if (obs.y > 110) {
        state.obstacles.splice(i, 1);
      }
    }
    
    // Trigger React render every few frames to update UI
    // (In a real high-perf game we'd manipulate DOM directly, but for this simple arcade React state is okay)
    // Actually, to keep it smooth, we update a score ref and only force render if needed, 
    // but React's concurrent mode can handle it if we just mutate DOM refs.
    // Let's do DOM ref mutation for the objects to ensure 60fps!
    
    updateDOM();
    
    if (!state.isGameOver) {
      rafRef.current = requestAnimationFrame(gameLoop);
    }
  }, [endGame]);

  const updateDOM = () => {
    const container = containerRef.current;
    if (!container) return;
    
    const state = stateRef.current;
    
    // Update player
    const playerEl = container.querySelector('#vector-player') as HTMLElement;
    if (playerEl) {
      playerEl.style.left = `${state.playerX}%`;
    }
    
    // Update score
    const scoreEl = container.querySelector('#vector-score') as HTMLElement;
    if (scoreEl) {
      scoreEl.textContent = Math.floor(state.score).toString();
    }
    
    // We will sync React state for obstacles every frame to keep it simple.
    // For a mini-game this is usually fine, but to avoid React overhead we can just use React state.
    // Wait, since I'm in requestAnimationFrame, I'll just call a fast setState.
    // Actually, forceUpdate is better.
  };

  useEffect(() => {
    if (phase === 'playing') {
      const interval = setInterval(() => {
        // Trigger a re-render to update obstacles DOM manually
        setScore((prev) => prev); // dummy state update to force render loop
      }, 1000 / 30); // 30fps react updates for obstacles, physics runs at 60fps
      return () => clearInterval(interval);
    }
  }, [phase]);

  // Input handling
  useEffect(() => {
    if (phase !== 'playing') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        stateRef.current.playerX = Math.max(5, stateRef.current.playerX - 10);
      } else if (e.key === 'ArrowRight') {
        stateRef.current.playerX = Math.min(95, stateRef.current.playerX + 10);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (phase !== 'playing') return;
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    stateRef.current.playerX = x * 100;
  };

  if (phase === 'intro') {
    return (
      <GameIntro
        gameName="VECTOR"
        description="Dodge the falling debris. Drag or use arrow keys to move your ship."
        hint="Speed increases over time. Survive."
        accentColor="var(--vector-accent)"
        onStart={handleStart}
      />
    );
  }

  if (phase === 'gameover') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--crt-bg)]/90 z-20 p-6 glass fade-in">
        <h2 className="text-4xl text-[var(--vector-accent)] mb-8" style={{ fontFamily: 'var(--font-display)' }}>CRASHED</h2>
        
        <div className="text-center mb-8 space-y-4" style={{ fontFamily: 'var(--font-body)' }}>
          <div className="text-2xl">Distance: <span className="text-[var(--vector-accent)] score-pop font-bold">{score}</span></div>
        </div>

        {/* Leaderboard */}
        {leaderboardEntries.length > 0 && (
          <div className="w-full max-w-sm mb-8" style={{ fontFamily: 'var(--font-body)' }}>
            <div className="text-sm text-[var(--vector-accent)]/50 mb-2 uppercase tracking-widest text-center">Top Distances</div>
            <div className="flex flex-col gap-1">
              {leaderboardEntries.map((entry, i) => {
                const isYou = i + 1 === playerRank;
                return (
                  <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${isYou ? 'bg-[var(--vector-accent)]/10 border border-[var(--vector-accent)]/20' : ''}`}>
                    <span className="w-6 text-center font-bold" style={{ color: i === 0 ? '#ffb000' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--vector-accent)' }}>{i + 1}</span>
                    <span className="flex-1 text-[var(--vector-accent)]/70">
                      {entry.name}
                      {isYou && <span className="text-[var(--vector-accent)] text-xs ml-2">← YOU</span>}
                    </span>
                    <span className="font-bold text-[var(--vector-accent)]">{entry.score}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-4 mt-4" style={{ fontFamily: 'var(--font-display)' }}>
          <button 
            className="px-6 py-4 bg-[var(--vector-accent)] text-black font-bold uppercase hover:bg-white transition-colors text-sm"
            onClick={handleStart}
          >
            Retry
          </button>
          <Link 
            to="/" 
            className="px-6 py-4 border-2 border-[var(--vector-accent)] text-[var(--vector-accent)] font-bold uppercase hover:bg-[var(--vector-accent)] hover:text-black transition-colors text-sm flex items-center justify-center"
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
      className="flex-1 relative overflow-hidden touch-none"
      ref={containerRef}
      onPointerDown={handlePointerMove}
      onPointerMove={(e) => {
        if (e.buttons > 0) handlePointerMove(e);
      }}
    >
      <div className="absolute top-4 right-4 z-10 text-right font-[family-name:var(--font-display)]">
        <div className="text-[var(--vector-accent)]/70 text-xs mb-1">DISTANCE</div>
        <div id="vector-score" className="text-2xl text-[var(--vector-accent)]">{Math.floor(stateRef.current.score)}</div>
      </div>

      {/* Grid background effect */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: `linear-gradient(var(--vector-accent) 1px, transparent 1px), linear-gradient(90deg, var(--vector-accent) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
        transform: `translateY(${Math.floor(stateRef.current.score % 40)}px)`
      }} />

      {/* Obstacles */}
      {stateRef.current.obstacles.map(obs => (
        <div
          key={obs.id}
          className="absolute border-2 bg-[var(--crt-bg)]"
          style={{
            left: `${obs.x}%`,
            top: `${obs.y}%`,
            width: `${obs.size}%`,
            height: `${obs.size}%`,
            transform: 'translate(-50%, -50%)',
            borderColor: obs.type === 'enemy' ? '#ff3b30' : 'var(--vector-accent)',
            boxShadow: `0 0 10px ${obs.type === 'enemy' ? '#ff3b30' : 'var(--vector-accent)'}80`,
            borderRadius: obs.type === 'enemy' ? '50%' : '2px',
          }}
        />
      ))}

      {/* Player Ship */}
      <div
        id="vector-player"
        className="absolute bottom-[15%] w-[10%] h-[5%] bg-[var(--phosphor)] rounded-t-full shadow-[0_0_15px_var(--phosphor)]"
        style={{
          left: `${stateRef.current.playerX}%`,
          transform: 'translateX(-50%)',
          transition: 'left 0.05s linear'
        }}
      />
    </div>
  );
}
