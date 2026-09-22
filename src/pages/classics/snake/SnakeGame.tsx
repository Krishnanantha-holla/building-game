import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import GameIntro from "@/components/GameIntro";
import { addToLeaderboard } from "@/lib/scoring";
import type { LeaderboardEntry } from "@/lib/scoring";
import { SkinPreview, getSnakeSegmentStyle, getAppleStyle, getBoardStyle } from "./SkinPreview";

type GamePhase = "intro" | "setup" | "playing" | "gameover";
type Mode = "Classic" | "Wrap" | "Time Attack" | "Obstacles" | "Zen";
type Size = "Small" | "Medium" | "Large" | "Custom";
type Skin = "Classic" | "Neon" | "Retro Pixel" | "Monochrome" | "Sunset" | "Matrix";

const DEFAULT_SIZES: Record<Exclude<Size, "Custom">, number> = { Small: 15, Medium: 20, Large: 28 };
const INITIAL_SPEED = 200;
const MIN_SPEED = 80;
const SPEED_DECREMENT = 5;
const APPLES_FOR_SPEEDUP = 3;

interface Point {
  x: number;
  y: number;
}

export default function SnakeGame() {
  const [phase, setPhase] = useState<GamePhase>("intro");
  const [mode, setMode] = useState<Mode>("Classic");
  const [size, setSize] = useState<Size>("Medium");
  const [customWidth, setCustomWidth] = useState(20);
  const [customHeight, setCustomHeight] = useState(20);
  
  const [skin, setSkin] = useState<Skin>(() => {
    const saved = localStorage.getItem("snake-skin");
    return (saved as Skin) || "Classic";
  });
  
  const [snake, setSnake] = useState<Point[]>([{ x: 7, y: 7 }]);
  const [direction, setDirection] = useState<Point>({ x: 1, y: 0 });
  const [nextDirection, setNextDirection] = useState<Point>({ x: 1, y: 0 });
  const [apple, setApple] = useState<Point>({ x: 10, y: 7 });
  const [obstacles, setObstacles] = useState<Point[]>([]);
  const [applesEaten, setApplesEaten] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rank, setRank] = useState<number | null>(null);

  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const boardWidth = size === "Custom" ? customWidth : DEFAULT_SIZES[size];
  const boardHeight = size === "Custom" ? customHeight : DEFAULT_SIZES[size];
  
  useEffect(() => {
    localStorage.setItem("snake-skin", skin);
  }, [skin]);

  // Helper to spawn apple
  const spawnApple = useCallback((currentSnake: Point[], currentObstacles: Point[]) => {
    let newApple: Point;
    while (true) {
      newApple = {
        x: Math.floor(Math.random() * boardWidth),
        y: Math.floor(Math.random() * boardHeight),
      };
      const hitSnake = currentSnake.some(seg => seg.x === newApple.x && seg.y === newApple.y);
      const hitObstacle = currentObstacles.some(obs => obs.x === newApple.x && obs.y === newApple.y);
      if (!hitSnake && !hitObstacle) {
        break;
      }
    }
    return newApple;
  }, [boardWidth, boardHeight]);

  const startGame = () => {
    const initialSnake = [{ x: Math.floor(boardWidth/2), y: Math.floor(boardHeight/2) }];
    
    let newObstacles: Point[] = [];
    if (mode === "Obstacles") {
      const numObstacles = Math.floor((boardWidth * boardHeight) * 0.05);
      for (let i = 0; i < numObstacles; i++) {
        let obs: Point;
        while (true) {
          obs = {
            x: Math.floor(Math.random() * boardWidth),
            y: Math.floor(Math.random() * boardHeight),
          };
          const hitSnake = initialSnake.some(seg => seg.x === obs.x && seg.y === obs.y);
          const alreadyExists = newObstacles.some(o => o.x === obs.x && o.y === obs.y);
          if (!hitSnake && !alreadyExists) {
            newObstacles.push(obs);
            break;
          }
        }
      }
    }
    
    setObstacles(newObstacles);
    setSnake(initialSnake);
    setDirection({ x: 1, y: 0 });
    setNextDirection({ x: 1, y: 0 });
    setApplesEaten(0);
    setTimeLeft(60);
    setApple(spawnApple(initialSnake, newObstacles));
    setPhase("playing");
  };

  const endGame = useCallback(() => {
    setPhase("gameover");
    
    if (mode === "Zen") {
      setRank(null);
      setLeaderboard([]);
      return;
    }
    
    const finalScore = mode === "Time Attack" ? applesEaten : snake.length;
    const key = `snake-${mode.toLowerCase().replace(" ", "-")}-${size.toLowerCase()}`;
    
    const { rank: newRank, entries } = addToLeaderboard(key, {
      name: "Player",
      score: finalScore,
      date: new Date().toISOString(),
      rounds: applesEaten,
    });
    setRank(newRank);
    setLeaderboard(entries);
  }, [mode, size, applesEaten, snake.length]);

  // Main loop
  useEffect(() => {
    if (phase !== "playing") {
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
      return;
    }

    const speed = Math.max(MIN_SPEED, INITIAL_SPEED - Math.floor(applesEaten / APPLES_FOR_SPEEDUP) * SPEED_DECREMENT);

    const moveSnake = () => {
      setSnake(prev => {
        const head = prev[0];
        const currentDir = nextDirection;
        setDirection(currentDir);
        
        let newX = head.x + currentDir.x;
        let newY = head.y + currentDir.y;

        const isWrap = mode === "Wrap" || mode === "Time Attack" || mode === "Zen";

        if (isWrap) {
          if (newX < 0) newX = boardWidth - 1;
          if (newX >= boardWidth) newX = 0;
          if (newY < 0) newY = boardHeight - 1;
          if (newY >= boardHeight) newY = 0;
        } else {
          if (newX < 0 || newX >= boardWidth || newY < 0 || newY >= boardHeight) {
            endGame();
            return prev;
          }
        }

        // Self collision
        if (mode !== "Zen" && prev.some(seg => seg.x === newX && seg.y === newY)) {
          endGame();
          return prev;
        }
        
        // Obstacle collision
        if (obstacles.some(obs => obs.x === newX && obs.y === newY)) {
          endGame();
          return prev;
        }

        const newHead = { x: newX, y: newY };
        const newSnake = [newHead, ...prev];

        if (newX === apple.x && newY === apple.y) {
          setApplesEaten(a => a + 1);
          setApple(spawnApple(newSnake, obstacles));
        } else {
          newSnake.pop();
        }

        return newSnake;
      });

      gameLoopRef.current = window.setTimeout(moveSnake, speed);
    };

    gameLoopRef.current = window.setTimeout(moveSnake, speed);

    return () => {
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    };
  }, [phase, nextDirection, apple, mode, boardWidth, boardHeight, applesEaten, spawnApple, endGame, obstacles]);

  // Timer for Time Attack
  useEffect(() => {
    if (phase !== "playing" || mode !== "Time Attack") return;
    
    if (timeLeft <= 0) {
      endGame();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(t => t - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, mode, timeLeft, endGame]);

  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== "playing") return;
      
      switch (e.key) {
        case "ArrowUp":
          if (direction.y !== 1) setNextDirection({ x: 0, y: -1 });
          break;
        case "ArrowDown":
          if (direction.y !== -1) setNextDirection({ x: 0, y: 1 });
          break;
        case "ArrowLeft":
          if (direction.x !== 1) setNextDirection({ x: -1, y: 0 });
          break;
        case "ArrowRight":
          if (direction.x !== -1) setNextDirection({ x: 1, y: 0 });
          break;
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, direction]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    
    const diffX = endX - touchStartRef.current.x;
    const diffY = endY - touchStartRef.current.y;
    
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 30 && direction.x !== -1) setNextDirection({ x: 1, y: 0 });
      else if (diffX < -30 && direction.x !== 1) setNextDirection({ x: -1, y: 0 });
    } else {
      if (diffY > 30 && direction.y !== -1) setNextDirection({ x: 0, y: 1 });
      else if (diffY < -30 && direction.y !== 1) setNextDirection({ x: 0, y: -1 });
    }
    touchStartRef.current = null;
  };

  if (phase === "intro") {
    return (
      <GameIntro
        gameName="Snake"
        description="Eat apples, grow longer. Don't bite yourself."
        hint="Use arrow keys or swipe to move."
        accentColor="#9bbc0f"
        onStart={() => setPhase("setup")}
      />
    );
  }

  if (phase === "setup") {
    return (
      <div className="flex-1 flex flex-col items-center justify-start p-6 text-text overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-[#9bbc0f] uppercase tracking-widest mt-4" style={{ fontFamily: "var(--font-display)" }}>
          Setup
        </h2>
        
        <div className="mb-4 w-full max-w-sm">
          <label className="block text-sm text-text-muted mb-2 font-bold">MODE</label>
          <div className="flex flex-wrap gap-2">
            {(["Classic", "Wrap", "Time Attack", "Obstacles", "Zen"] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`py-1.5 px-3 rounded border text-sm transition-colors ${
                  mode === m ? "border-[#9bbc0f] bg-[#9bbc0f]/20 text-[#9bbc0f]" : "border-border text-text-muted hover:border-text-dim"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 w-full max-w-sm">
          <label className="block text-sm text-text-muted mb-2 font-bold">BOARD SIZE</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(["Small", "Medium", "Large", "Custom"] as Size[]).map(s => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`py-1.5 px-3 rounded border text-sm transition-colors flex-1 min-w-[70px] ${
                  size === s ? "border-[#9bbc0f] bg-[#9bbc0f]/20 text-[#9bbc0f]" : "border-border text-text-muted hover:border-text-dim"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {size === "Custom" && (
            <div className="flex gap-4">
              <label className="flex flex-col text-xs text-text-dim">
                WIDTH (10-40)
                <input 
                  type="number" 
                  min="10" max="40" 
                  value={customWidth} 
                  onChange={(e) => setCustomWidth(Math.max(10, Math.min(40, Number(e.target.value))))}
                  className="bg-surface border border-border rounded p-1 text-text mt-1 w-20 text-center focus-visible:outline-none focus-visible:border-[#9bbc0f]"
                />
              </label>
              <label className="flex flex-col text-xs text-text-dim">
                HEIGHT (10-40)
                <input 
                  type="number" 
                  min="10" max="40" 
                  value={customHeight} 
                  onChange={(e) => setCustomHeight(Math.max(10, Math.min(40, Number(e.target.value))))}
                  className="bg-surface border border-border rounded p-1 text-text mt-1 w-20 text-center focus-visible:outline-none focus-visible:border-[#9bbc0f]"
                />
              </label>
            </div>
          )}
        </div>

        <div className="mb-6 w-full max-w-sm">
          <label className="block text-sm text-text-muted mb-2 font-bold">SKIN</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {(["Classic", "Neon", "Retro Pixel", "Monochrome", "Sunset", "Matrix"] as Skin[]).map(s => (
              <button
                key={s}
                onClick={() => setSkin(s)}
                className={`py-1.5 px-2 rounded border text-xs transition-colors truncate ${
                  skin === s ? "border-[#9bbc0f] bg-[#9bbc0f]/20 text-[#9bbc0f]" : "border-border text-text-muted hover:border-text-dim"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          
          {/* Live Preview for Skin */}
          <div className="text-xs text-text-dim mb-1">Preview:</div>
          <div className="w-full h-16 bg-black border border-border rounded relative flex items-center justify-center overflow-hidden">
            <SkinPreview skin={skin} />
          </div>
        </div>

        <button
          onClick={startGame}
          className="w-full max-w-sm py-3 rounded-xl bg-gradient-to-r from-[#9bbc0f] to-[#7a9609] text-black font-bold text-lg tracking-wide hover:scale-[1.02] active:scale-95 transition-all mt-auto mb-4"
        >
          START
        </button>
      </div>
    );
  }

  if (phase === "gameover") {
    const isNewBest = rank === 1;
    const finalScore = mode === "Time Attack" ? applesEaten : snake.length;

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-text fade-in">
        <h2 className="text-4xl font-extrabold mb-2 uppercase text-[#9bbc0f]">Game Over</h2>
        
        <div className="my-6">
          <div className="text-text-muted text-sm uppercase tracking-widest mb-1 font-bold">Final {mode === "Time Attack" ? "Apples" : "Length"}</div>
          <div className={`text-6xl font-black ${isNewBest ? "text-[#9bbc0f]" : "text-white"}`}>
            {finalScore}
          </div>
          {isNewBest && (
            <div className="text-[#9bbc0f] font-bold text-sm uppercase tracking-widest mt-2 blink-prompt">
              New Best!
            </div>
          )}
        </div>

        <div className="w-full max-w-xs bg-surface-hover rounded-xl p-4 mb-6 text-left border border-border">
          <h3 className="text-text-muted text-xs uppercase tracking-widest mb-3 font-bold border-b border-border pb-2">
            Leaderboard - {mode} ({size})
          </h3>
          <div className="flex flex-col gap-2">
            {leaderboard.map((entry, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-text-dim">{i + 1}. {entry.name}</span>
                <span className="font-bold text-[#9bbc0f]">{entry.score}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={startGame}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#9bbc0f] to-[#7a9609] text-black font-bold transition-all hover:scale-105 active:scale-95"
          >
            Play Again
          </button>
          <Link
            to="/classics"
            className="py-3 px-5 rounded-xl border border-border text-text-muted font-medium hover:bg-surface-hover hover:text-text transition-all active:scale-95"
          >
            Hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 flex flex-col p-4 w-full h-full relative touch-none" 
      onTouchStart={handleTouchStart} 
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex justify-between items-center mb-4 text-[#9bbc0f] font-bold" style={{ fontFamily: "var(--font-display)" }}>
        <div className="text-sm">
          {mode === "Time Attack" ? `TIME: ${timeLeft}s` : `LEN: ${snake.length}`}
        </div>
        
        {mode === "Zen" && (
          <button 
            onClick={endGame}
            className="px-3 py-1 bg-[#9bbc0f] text-black text-xs rounded hover:bg-white transition-colors"
          >
            END RUN
          </button>
        )}

        <div className="text-sm">
          APPLES: {applesEaten}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0 min-w-0">
        <div 
          className="relative border-2 border-[#9bbc0f]/50 w-full max-w-[min(100%,_60vh)]"
          style={{ 
            aspectRatio: `${boardWidth} / ${boardHeight}`,
            ...getBoardStyle(skin)
          }}
        >
          {obstacles.map((obs, i) => (
            <div
              key={`obs-${i}`}
              className="absolute bg-white/40"
              style={{
                left: `${(obs.x / boardWidth) * 100}%`,
                top: `${(obs.y / boardHeight) * 100}%`,
                width: `${100 / boardWidth}%`,
                height: `${100 / boardHeight}%`,
                border: "1px solid rgba(0,0,0,0.5)"
              }}
            />
          ))}
          {snake.map((segment, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${(segment.x / boardWidth) * 100}%`,
                top: `${(segment.y / boardHeight) * 100}%`,
                width: `${100 / boardWidth}%`,
                height: `${100 / boardHeight}%`,
                ...getSnakeSegmentStyle(skin, i, snake.length)
              }}
            >
              {skin === "Matrix" && (i % 2 === 0 ? "1" : "0")}
            </div>
          ))}
          <div
            className="absolute"
            style={{
              left: `${(apple.x / boardWidth) * 100}%`,
              top: `${(apple.y / boardHeight) * 100}%`,
              width: `${100 / boardWidth}%`,
              height: `${100 / boardHeight}%`,
              transform: skin === "Classic" || skin === "Sunset" ? "scale(0.7)" : (skin === "Monochrome" ? "scale(0.6) rotate(45deg)" : "scale(0.8)"),
              ...getAppleStyle(skin)
            }}
          />
        </div>
      </div>
    </div>
  );
}
