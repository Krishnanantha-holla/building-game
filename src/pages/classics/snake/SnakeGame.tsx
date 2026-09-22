import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import GameIntro from "@/components/GameIntro";
import { addToLeaderboard } from "@/lib/scoring";
import type { LeaderboardEntry } from "@/lib/scoring";

type GamePhase = "intro" | "setup" | "playing" | "gameover";
type Mode = "Classic" | "Wrap" | "Time Attack";
type Size = "Small" | "Medium" | "Large";

const SIZES: Record<Size, number> = { Small: 15, Medium: 20, Large: 28 };
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
  
  const [snake, setSnake] = useState<Point[]>([{ x: 7, y: 7 }]);
  const [direction, setDirection] = useState<Point>({ x: 1, y: 0 });
  const [nextDirection, setNextDirection] = useState<Point>({ x: 1, y: 0 });
  const [apple, setApple] = useState<Point>({ x: 10, y: 7 });
  const [applesEaten, setApplesEaten] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rank, setRank] = useState<number | null>(null);

  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const boardSize = SIZES[size];

  // Helper to spawn apple
  const spawnApple = useCallback((currentSnake: Point[]) => {
    let newApple: Point;
    while (true) {
      newApple = {
        x: Math.floor(Math.random() * boardSize),
        y: Math.floor(Math.random() * boardSize),
      };
      if (!currentSnake.some(seg => seg.x === newApple.x && seg.y === newApple.y)) {
        break;
      }
    }
    return newApple;
  }, [boardSize]);

  const startGame = () => {
    const initialSnake = [{ x: Math.floor(boardSize/2), y: Math.floor(boardSize/2) }];
    setSnake(initialSnake);
    setDirection({ x: 1, y: 0 });
    setNextDirection({ x: 1, y: 0 });
    setApplesEaten(0);
    setTimeLeft(60);
    setApple(spawnApple(initialSnake));
    setPhase("playing");
  };

  const endGame = useCallback(() => {
    setPhase("gameover");
    
    const finalScore = mode === "Time Attack" ? applesEaten : snake.length;
    const key = `snake-${mode.toLowerCase().replace(" ", "-")}-${size.toLowerCase()}`;
    
    const { rank: newRank, entries } = addToLeaderboard(key, {
      name: "Player",
      score: finalScore,
      date: new Date().toISOString(),
      rounds: applesEaten, // Reusing rounds to store apples eaten
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

        const isWrap = mode === "Wrap" || mode === "Time Attack";

        if (isWrap) {
          if (newX < 0) newX = boardSize - 1;
          if (newX >= boardSize) newX = 0;
          if (newY < 0) newY = boardSize - 1;
          if (newY >= boardSize) newY = 0;
        } else {
          if (newX < 0 || newX >= boardSize || newY < 0 || newY >= boardSize) {
            endGame();
            return prev;
          }
        }

        // Self collision
        if (prev.some(seg => seg.x === newX && seg.y === newY)) {
          endGame();
          return prev;
        }

        const newHead = { x: newX, y: newY };
        const newSnake = [newHead, ...prev];

        if (newX === apple.x && newY === apple.y) {
          setApplesEaten(a => a + 1);
          setApple(spawnApple(newSnake));
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
  }, [phase, nextDirection, apple, mode, boardSize, applesEaten, spawnApple, endGame]);

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
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-text">
        <h2 className="text-2xl font-bold mb-6 text-[#9bbc0f] uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>
          Setup
        </h2>
        
        <div className="mb-6 w-full max-w-xs">
          <label className="block text-sm text-text-muted mb-2 font-bold">MODE</label>
          <div className="flex flex-col gap-2">
            {(["Classic", "Wrap", "Time Attack"] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`py-2 px-4 rounded border transition-colors ${
                  mode === m ? "border-[#9bbc0f] bg-[#9bbc0f]/20 text-[#9bbc0f]" : "border-border text-text-muted hover:border-text-dim"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8 w-full max-w-xs">
          <label className="block text-sm text-text-muted mb-2 font-bold">BOARD SIZE</label>
          <div className="flex gap-2">
            {(["Small", "Medium", "Large"] as Size[]).map(s => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`flex-1 py-2 rounded border transition-colors ${
                  size === s ? "border-[#9bbc0f] bg-[#9bbc0f]/20 text-[#9bbc0f]" : "border-border text-text-muted hover:border-text-dim"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startGame}
          className="w-full max-w-xs py-3 rounded-xl bg-gradient-to-r from-[#9bbc0f] to-[#7a9609] text-black font-bold text-lg tracking-wide hover:scale-[1.02] active:scale-95 transition-all"
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
        <div className="text-sm">
          APPLES: {applesEaten}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0 min-w-0">
        <div 
          className="relative bg-black border-2 border-[#9bbc0f]/50 w-full max-w-[min(100%,_60vh)] aspect-square"
          style={{ 
            imageRendering: "pixelated" 
          }}
        >
          {/* Grid lines optional? Let's just draw snake and apple */}
          {snake.map((segment, i) => (
            <div
              key={i}
              className="absolute bg-[#9bbc0f]"
              style={{
                left: `${(segment.x / boardSize) * 100}%`,
                top: `${(segment.y / boardSize) * 100}%`,
                width: `${100 / boardSize}%`,
                height: `${100 / boardSize}%`,
                border: "1px solid rgba(0,0,0,0.2)"
              }}
            />
          ))}
          <div
            className="absolute bg-red-500 rounded-full"
            style={{
              left: `${(apple.x / boardSize) * 100}%`,
              top: `${(apple.y / boardSize) * 100}%`,
              width: `${100 / boardSize}%`,
              height: `${100 / boardSize}%`,
              transform: "scale(0.7)"
            }}
          />
        </div>
      </div>
    </div>
  );
}
