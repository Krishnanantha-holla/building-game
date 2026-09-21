import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { addToLeaderboard, getLeaderboard } from '@/lib/scoring';
import type { LeaderboardEntry } from '@/lib/scoring';
import { unlockAudioContext, playBlip } from '@/lib/audio-engine';
import GameIntro from '@/components/GameIntro';

type GamePhase = 'intro' | 'playing' | 'gameover';

interface Debris {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  rotation: number;
  rotSpeed: number;
  shape: 'square' | 'diamond' | 'triangle' | 'hexagon';
}

const ACCENT_COLOR = '#b026ff';
const SHIP_RADIUS = 18;

export default function VectorGame() {
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [score, setScore] = useState(0);
  const [survivalDisplay, setSurvivalDisplay] = useState('0.0');
  const [speedMultiplierDisplay, setSpeedMultiplierDisplay] = useState('1.00');
  const [isNewBest, setIsNewBest] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  // Mutable game state
  const stateRef = useRef({
    width: 600,
    height: 800,
    shipX: 300,
    shipY: 740,
    keysDown: new Set<string>(),
    isDragging: false,
    debris: [] as Debris[],
    debrisIdCounter: 0,
    startTime: 0,
    lastFrameTime: 0,
    lastSpawnTime: 0,
    isGameOver: false,
    stars: [] as { x: number; y: number; speed: number; size: number }[],
  });

  const handleStart = useCallback(async () => { console.log("HANDLE START CALLED");
    await unlockAudioContext();

    const rect = containerRef.current?.getBoundingClientRect();
    const width = rect?.width || 600;
    const height = rect?.height || 800;

    // Generate background stars
    const stars = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: Math.random() * 40 + 20,
      size: Math.random() * 2 + 1,
    }));

    const now = performance.now();
    stateRef.current = {
      width,
      height,
      shipX: width / 2,
      shipY: height - 55,
      keysDown: new Set(),
      isDragging: false,
      debris: [],
      debrisIdCounter: 0,
      startTime: now,
      lastFrameTime: now,
      lastSpawnTime: now,
      isGameOver: false,
      stars,
    };

    setScore(0);
    setSurvivalDisplay('0.0');
    setSpeedMultiplierDisplay('1.00');
    setIsNewBest(false);
    console.log("SETTING PHASE PLAYING"); setPhase('playing');
  }, []);

  const endGame = useCallback((finalSeconds: number) => {
    stateRef.current.isGameOver = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    playBlip(140, 450); // Crash audio

    const finalScore = Math.floor(finalSeconds);
    setScore(finalScore);

    const prevScores = getLeaderboard('vector');
    const newBest = prevScores.length === 0 || finalScore > prevScores[0].score;
    setIsNewBest(newBest);

    const entry: LeaderboardEntry = {
      name: 'PILOT',
      score: finalScore,
      date: new Date().toISOString(),
      rounds: 1,
    };

    const { entries, rank } = addToLeaderboard('vector', entry);
    setLeaderboardEntries(entries);
    setPlayerRank(rank);
    setPhase('gameover');
  }, []);

  // Main animation / physics loop
  useEffect(() => {
    if (phase !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localRafId: number;

    const gameLoop = (time: number) => {
      const state = stateRef.current;
      if (state.isGameOver) return;

      const dt = Math.min((time - state.lastFrameTime) / 1000, 0.1);
      state.lastFrameTime = time;

      const elapsed = (time - state.startTime) / 1000;
      // Speed increases 5% every 10 seconds survived
      const speedMultiplier = 1 + (elapsed / 10) * 0.05;

      // Update HUD display at ~10Hz
      setSurvivalDisplay(elapsed.toFixed(1));
      setSpeedMultiplierDisplay(speedMultiplier.toFixed(2));

      // Handle keyboard movement
      const shipSpeed = 400; // px / sec
      if (state.keysDown.has('ArrowLeft') || state.keysDown.has('KeyA')) {
        state.shipX -= shipSpeed * dt;
      }
      if (state.keysDown.has('ArrowRight') || state.keysDown.has('KeyD')) {
        state.shipX += shipSpeed * dt;
      }

      // Clamp ship position within lane
      const minX = SHIP_RADIUS + 8;
      const maxX = state.width - SHIP_RADIUS - 8;
      state.shipX = Math.max(minX, Math.min(maxX, state.shipX));
      state.shipY = state.height - 55;

      // Spawn debris
      const spawnInterval = Math.max(260, 480 / Math.sqrt(speedMultiplier)); // ms
      if (time - state.lastSpawnTime > spawnInterval) {
        state.lastSpawnTime = time;
        const shapes: Debris['shape'][] = ['square', 'diamond', 'triangle', 'hexagon'];
        const chosenShape = shapes[Math.floor(Math.random() * shapes.length)];
        const size = Math.random() * 16 + 18; // 18 - 34 px
        const debrisX = Math.random() * (state.width - size * 2) + size;

        state.debris.push({
          id: state.debrisIdCounter++,
          x: debrisX,
          y: -size,
          size,
          speed: (Math.random() * 50 + 170) * speedMultiplier,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 4,
          shape: chosenShape,
        });
      }

      // Update debris positions & check collisions
      for (let i = state.debris.length - 1; i >= 0; i--) {
        const d = state.debris[i];
        d.y += d.speed * dt;
        d.rotation += d.rotSpeed * dt;

        // Collision check with ship
        const dx = d.x - state.shipX;
        const dy = d.y - state.shipY;
        const distance = Math.hypot(dx, dy);
        const collisionThreshold = SHIP_RADIUS + d.size * 0.45;

        if (distance < collisionThreshold) {
          endGame(elapsed);
          return;
        }

        // Remove offscreen debris
        if (d.y > state.height + d.size * 2) {
          state.debris.splice(i, 1);
        }
      }

      // Update background stars
      for (const star of state.stars) {
        star.y += star.speed * speedMultiplier * dt;
        if (star.y > state.height) {
          star.y = 0;
          star.x = Math.random() * state.width;
        }
      }

      // ── DRAW ────────────────────────────────────────────────────────
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, state.width, state.height);

      // Background grid / stars
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, state.width, state.height);

      // Stars
      ctx.fillStyle = 'rgba(176, 38, 255, 0.4)';
      for (const star of state.stars) {
        ctx.fillRect(star.x, star.y, star.size, star.size);
      }

      // Lane guide line at bottom
      ctx.strokeStyle = 'rgba(176, 38, 255, 0.2)';
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(10, state.shipY);
      ctx.lineTo(state.width - 10, state.shipY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Debris
      for (const d of state.debris) {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rotation);

        ctx.strokeStyle = ACCENT_COLOR;
        ctx.fillStyle = 'rgba(176, 38, 255, 0.15)';
        ctx.shadowColor = ACCENT_COLOR;
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2;

        ctx.beginPath();
        const s = d.size;
        if (d.shape === 'square') {
          ctx.rect(-s / 2, -s / 2, s, s);
        } else if (d.shape === 'diamond') {
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.7, 0);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.7, 0);
          ctx.closePath();
        } else if (d.shape === 'triangle') {
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.86, s * 0.5);
          ctx.lineTo(-s * 0.86, s * 0.5);
          ctx.closePath();
        } else {
          // Hexagon
          for (let k = 0; k < 6; k++) {
            const angle = (k * Math.PI) / 3;
            const hx = Math.cos(angle) * (s * 0.6);
            const hy = Math.sin(angle) * (s * 0.6);
            if (k === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Draw Player Ship (Retro Vector Spaceship)
      ctx.save();
      ctx.translate(state.shipX, state.shipY);

      // Engine Thruster Flame
      const flameHeight = 10 + Math.random() * 8;
      ctx.fillStyle = Math.random() > 0.5 ? '#ff3b30' : '#ffb000';
      ctx.shadowColor = '#ffb000';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(-6, 12);
      ctx.lineTo(0, 12 + flameHeight);
      ctx.lineTo(6, 12);
      ctx.closePath();
      ctx.fill();

      // Ship Body (Crisp Triangle / Fighter)
      ctx.strokeStyle = '#39ff8a';
      ctx.fillStyle = '#14141d';
      ctx.shadowColor = '#39ff8a';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(0, -SHIP_RADIUS); // Nose
      ctx.lineTo(SHIP_RADIUS * 0.85, SHIP_RADIUS * 0.75); // Right wing tip
      ctx.lineTo(SHIP_RADIUS * 0.4, SHIP_RADIUS * 0.45); // Wing inner
      ctx.lineTo(0, SHIP_RADIUS * 0.65); // Rear center
      ctx.lineTo(-SHIP_RADIUS * 0.4, SHIP_RADIUS * 0.45); // Wing inner
      ctx.lineTo(-SHIP_RADIUS * 0.85, SHIP_RADIUS * 0.75); // Left wing tip
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cockpit / Core Glow
      ctx.fillStyle = '#00e5ff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      ctx.restore();

      localRafId = requestAnimationFrame(gameLoop);
    };

    localRafId = requestAnimationFrame(gameLoop);
    rafRef.current = localRafId;

    return () => {
      cancelAnimationFrame(localRafId);
    };
  }, [phase, endGame]);

  // Keyboard controls
  useEffect(() => {
    if (phase !== 'playing') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        stateRef.current.keysDown.add(e.code);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keysDown.delete(e.code);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [phase]);

  // Resize canvas to match container
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);

      if (w <= 0 || h <= 0) return;

      canvasRef.current.width = w * dpr;
      canvasRef.current.height = h * dpr;
      canvasRef.current.style.width = `${w}px`;
      canvasRef.current.style.height = `${h}px`;

      stateRef.current.width = w;
      stateRef.current.height = h;
      stateRef.current.shipY = h - 55;
      stateRef.current.shipX = Math.max(SHIP_RADIUS + 8, Math.min(w - SHIP_RADIUS - 8, stateRef.current.shipX));
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [phase]);

  // Touch / Pointer controls (Drag)
  const updateShipFromPointer = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const localX = clientX - rect.left;
    const minX = SHIP_RADIUS + 8;
    const maxX = stateRef.current.width - SHIP_RADIUS - 8;
    stateRef.current.shipX = Math.max(minX, Math.min(maxX, localX));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (phase !== 'playing') return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails
    }
    stateRef.current.isDragging = true;
    updateShipFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!stateRef.current.isDragging || phase !== 'playing') return;
    updateShipFromPointer(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    stateRef.current.isDragging = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
  };

  // Touch fallback
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0 && phase === 'playing') {
      e.preventDefault();
      updateShipFromPointer(e.touches[0].clientX);
    }
  };

  if (phase === 'intro') {
    return (
      <GameIntro
        gameName="VECTOR"
        description="Dodge the falling debris. Drag or use arrow keys to move your ship."
        hint="Speed increases 5% every 10 seconds survived."
        accentColor={ACCENT_COLOR}
        onStart={handleStart}
      />
    );
  }

  if (phase === 'gameover') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--crt-bg)]/95 z-20 p-6 glass fade-in">
        <h2
          className="text-3xl sm:text-4xl text-[var(--vector-accent)] mb-4"
          style={{ fontFamily: 'var(--font-display)', textShadow: '0 0 20px rgba(176, 38, 255, 0.6)' }}
        >
          CRASHED
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
          <div className="text-gray-400 text-sm">SURVIVAL TIME</div>
          <div className="text-4xl font-bold text-[var(--vector-accent)] score-pop">
            {score}s
          </div>
        </div>

        {/* Leaderboard */}
        {leaderboardEntries.length > 0 && (
          <div className="w-full max-w-sm mb-6" style={{ fontFamily: 'var(--font-body)' }}>
            <div className="text-xs text-[var(--vector-accent)]/70 mb-2 uppercase tracking-widest text-center">
              Top Pilots (Seconds)
            </div>
            <div className="flex flex-col gap-1.5 bg-black/40 border border-white/10 rounded-lg p-3">
              {leaderboardEntries.slice(0, 5).map((entry, i) => {
                const isYou = i + 1 === playerRank;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                      isYou ? 'bg-[var(--vector-accent)]/20 border border-[var(--vector-accent)]/40' : ''
                    }`}
                  >
                    <span
                      className="w-5 text-center font-bold"
                      style={{
                        color: i === 0 ? '#ffb000' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--vector-accent)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 text-gray-300 truncate">
                      {entry.name}
                      {isYou && <span className="text-[var(--vector-accent)] ml-2">← YOU</span>}
                    </span>
                    <span className="font-bold text-[var(--vector-accent)] tabular-nums">
                      {entry.score}s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-4 w-full max-w-xs" style={{ fontFamily: 'var(--font-display)' }}>
          <button
            className="flex-1 py-3 bg-[var(--vector-accent)] text-black font-bold uppercase hover:bg-white transition-colors text-xs rounded"
            onClick={handleStart}
          >
            Retry
          </button>
          <Link
            to="/"
            className="flex-1 py-3 border border-[var(--vector-accent)] text-[var(--vector-accent)] font-bold uppercase hover:bg-[var(--vector-accent)] hover:text-black transition-colors text-xs flex items-center justify-center rounded"
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
      ref={containerRef}
      className="flex-1 w-full h-full relative overflow-hidden touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchMove={handleTouchMove}
    >
      {/* Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

      {/* HUD Bar */}
      <div className="absolute top-3 left-4 right-4 z-10 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col">
          <span className="text-xs text-[var(--vector-accent)]/70 uppercase tracking-widest font-mono">SURVIVAL</span>
          <span className="text-xl font-bold text-[var(--vector-accent)] font-mono tabular-nums">
            {survivalDisplay}s
          </span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">+5% / 10s</span>
          <span className="text-sm font-bold text-gray-300 font-mono tabular-nums">
            SPEED {speedMultiplierDisplay}x
          </span>
        </div>
      </div>

      {/* Mobile drag hint (subtle) */}
      <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-white/20 pointer-events-none font-mono">
        DRAG OR USE ARROW KEYS
      </div>
    </div>
  );
}
