import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import GameIntro from "@/components/GameIntro";
import { addToLeaderboard } from "@/lib/scoring";
import type { LeaderboardEntry } from "@/lib/scoring";
import { SkinPreview } from "./SkinPreview";
import { drawFluidSnake } from "./SnakeEngine";
import type { Point } from "./SnakeEngine";

type GamePhase = "intro" | "setup" | "playing" | "gameover";
type Mode = "Classic" | "Wrap" | "Time Attack" | "Obstacles" | "Zen" | "Twin" | "Poison Apple";
type Size = "Small" | "Medium" | "Large" | "Custom";
type Skin = "Classic" | "Neon" | "Retro Pixel" | "Monochrome" | "Sunset" | "Matrix";
type Speed = "Slow" | "Normal" | "Fast";
type Fruit = "Apple" | "Banana" | "Grapes" | "Strawberry" | "Mushroom";

const FRUIT_EMOJIS: Record<Fruit, string> = {
  Apple: "🍎", Banana: "🍌", Grapes: "🍇", Strawberry: "🍓", Mushroom: "🍄"
};

const DEFAULT_SIZES: Record<Exclude<Size, "Custom">, number> = { Small: 15, Medium: 20, Large: 28 };
const SPEEDS: Record<Speed, number> = { Slow: 250, Normal: 150, Fast: 80 };

export default function SnakeGame() {
  const [phase, setPhase] = useState<GamePhase>("intro");
  const [mode, setMode] = useState<Mode>("Classic");
  const [size, setSize] = useState<Size>("Medium");
  const [speedOption, setSpeedOption] = useState<Speed>("Normal");
  const [fruit, setFruit] = useState<Fruit>("Apple");
  
  const [customWidth, setCustomWidth] = useState(20);
  const [customHeight, setCustomHeight] = useState(20);
  
  const [skin, setSkin] = useState<Skin>(() => {
    return (localStorage.getItem("snake-skin") as Skin) || "Classic";
  });
  
  const [snake, setSnake] = useState<Point[]>([{ x: 7, y: 7 }]);
  const [prevSnake, setPrevSnake] = useState<Point[]>([{ x: 7, y: 7 }]);
  const [direction, setDirection] = useState<Point>({ x: 1, y: 0 });
  const [nextDirection, setNextDirection] = useState<Point>({ x: 1, y: 0 });
  
  const [apples, setApples] = useState<Point[]>([{ x: 10, y: 7 }]);
  const [poisonApples, setPoisonApples] = useState<Point[]>([]);
  const [obstacles, setObstacles] = useState<Point[]>([]);
  
  const [applesEaten, setApplesEaten] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rank, setRank] = useState<number | null>(null);

  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastTickTimeRef = useRef<number>(Date.now());
  const requestRef = useRef<number>(0);

  const boardWidth = size === "Custom" ? customWidth : DEFAULT_SIZES[size];
  const boardHeight = size === "Custom" ? customHeight : DEFAULT_SIZES[size];
  
  useEffect(() => localStorage.setItem("snake-skin", skin), [skin]);

  const generateRandomPoint = useCallback((occupied: Point[]) => {
    let p: Point;
    while (true) {
      p = { x: Math.floor(Math.random() * boardWidth), y: Math.floor(Math.random() * boardHeight) };
      if (!occupied.some(o => o.x === p.x && o.y === p.y)) break;
    }
    return p;
  }, [boardWidth, boardHeight]);

  const startGame = () => {
    const initialSnake = [{ x: Math.floor(boardWidth/2), y: Math.floor(boardHeight/2) }];
    
    let newObstacles: Point[] = [];
    if (mode === "Obstacles") {
      const numObstacles = Math.floor((boardWidth * boardHeight) * 0.05);
      for (let i = 0; i < numObstacles; i++) {
        newObstacles.push(generateRandomPoint([...initialSnake, ...newObstacles]));
      }
    }
    setObstacles(newObstacles);
    
    let newApples = [generateRandomPoint([...initialSnake, ...newObstacles])];
    if (mode === "Twin") {
      newApples.push(generateRandomPoint([...initialSnake, ...newObstacles, ...newApples]));
    }
    setApples(newApples);
    
    if (mode === "Poison Apple") {
      setPoisonApples([generateRandomPoint([...initialSnake, ...newObstacles, ...newApples])]);
    } else {
      setPoisonApples([]);
    }
    
    setSnake(initialSnake);
    setPrevSnake(initialSnake);
    setDirection({ x: 1, y: 0 });
    setNextDirection({ x: 1, y: 0 });
    setApplesEaten(0);
    setTimeLeft(60);
    setPhase("playing");
    lastTickTimeRef.current = Date.now();
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

  // Logic Tick
  useEffect(() => {
    if (phase !== "playing") {
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
      return;
    }

    const tickSpeed = SPEEDS[speedOption];

    const moveSnake = () => {
      lastTickTimeRef.current = Date.now();
      
      setSnake(prev => {
        setPrevSnake(prev);
        const head = prev[0];
        const currentDir = nextDirection;
        setDirection(currentDir);
        
        let newX = head.x + currentDir.x;
        let newY = head.y + currentDir.y;

        const isWrap = ["Wrap", "Time Attack", "Zen", "Twin", "Poison Apple"].includes(mode);

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

        if (mode !== "Zen" && prev.some(seg => seg.x === newX && seg.y === newY)) {
          endGame(); return prev;
        }
        if (obstacles.some(obs => obs.x === newX && obs.y === newY)) {
          endGame(); return prev;
        }
        if (poisonApples.some(p => p.x === newX && p.y === newY)) {
          endGame(); return prev;
        }

        const newHead = { x: newX, y: newY };
        const newSnake = [newHead, ...prev];

        const eatenAppleIndex = apples.findIndex(a => a.x === newX && a.y === newY);
        
        if (eatenAppleIndex !== -1) {
          setApplesEaten(a => a + 1);
          setApples(currApples => {
            const next = [...currApples];
            next[eatenAppleIndex] = generateRandomPoint([...newSnake, ...obstacles, ...poisonApples, ...currApples]);
            return next;
          });
          
          if (mode === "Poison Apple") {
            setPoisonApples([generateRandomPoint([...newSnake, ...obstacles, ...apples])]);
          }
        } else {
          newSnake.pop();
        }

        return newSnake;
      });

      gameLoopRef.current = window.setTimeout(moveSnake, tickSpeed);
    };

    gameLoopRef.current = window.setTimeout(moveSnake, tickSpeed);
    return () => { if (gameLoopRef.current) clearTimeout(gameLoopRef.current); };
  }, [phase, nextDirection, apples, poisonApples, mode, boardWidth, boardHeight, applesEaten, speedOption, generateRandomPoint, endGame, obstacles]);

  // Timer
  useEffect(() => {
    if (phase !== "playing" || mode !== "Time Attack") return;
    if (timeLeft <= 0) { endGame(); return; }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [phase, mode, timeLeft, endGame]);

  // Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== "playing") return;
      switch (e.key) {
        case "ArrowUp": if (direction.y !== 1) setNextDirection({ x: 0, y: -1 }); break;
        case "ArrowDown": if (direction.y !== -1) setNextDirection({ x: 0, y: 1 }); break;
        case "ArrowLeft": if (direction.x !== 1) setNextDirection({ x: -1, y: 0 }); break;
        case "ArrowRight": if (direction.x !== -1) setNextDirection({ x: 1, y: 0 }); break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, direction]);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const endX = e.changedTouches[0].clientX; const endY = e.changedTouches[0].clientY;
    const diffX = endX - touchStartRef.current.x; const diffY = endY - touchStartRef.current.y;
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 30 && direction.x !== -1) setNextDirection({ x: 1, y: 0 });
      else if (diffX < -30 && direction.x !== 1) setNextDirection({ x: -1, y: 0 });
    } else {
      if (diffY > 30 && direction.y !== -1) setNextDirection({ x: 0, y: 1 });
      else if (diffY < -30 && direction.y !== 1) setNextDirection({ x: 0, y: -1 });
    }
    touchStartRef.current = null;
  };

  // Render Loop
  useEffect(() => {
    if (phase !== "playing") return;
    const animate = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          const cellSize = width / boardWidth;
          
          ctx.fillStyle = skin === "Retro Pixel" ? "#9ca3af" : "#000000";
          ctx.fillRect(0, 0, width, height);

          // Grid lines optional
          // ...

          // Draw obstacles
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
          for (const obs of obstacles) {
            ctx.fillRect(obs.x * cellSize, obs.y * cellSize, cellSize, cellSize);
            ctx.strokeRect(obs.x * cellSize, obs.y * cellSize, cellSize, cellSize);
          }

          const progress = Math.min(1, (Date.now() - lastTickTimeRef.current) / SPEEDS[speedOption]);
          drawFluidSnake(ctx, prevSnake, snake, progress, cellSize, skin, boardWidth, boardHeight);

          // Draw apples
          ctx.font = `${cellSize * 0.8}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          for (const a of apples) {
            ctx.fillText(FRUIT_EMOJIS[fruit], a.x * cellSize + cellSize/2, a.y * cellSize + cellSize/2);
          }
          for (const p of poisonApples) {
            ctx.fillText("💀", p.x * cellSize + cellSize/2, p.y * cellSize + cellSize/2);
          }
        }
      }
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [phase, snake, prevSnake, apples, poisonApples, obstacles, boardWidth, boardHeight, skin, speedOption, fruit]);


  if (phase === "intro") {
    return (
      <GameIntro
        gameName="Snake"
        description="Eat food, grow longer. Fluid arcade action."
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
            {(["Classic", "Wrap", "Time Attack", "Obstacles", "Zen", "Twin", "Poison Apple"] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)} className={`py-1.5 px-3 rounded border text-sm transition-colors ${mode === m ? "border-[#9bbc0f] bg-[#9bbc0f]/20 text-[#9bbc0f]" : "border-border text-text-muted hover:border-text-dim"}`}>{m}</button>
            ))}
          </div>
        </div>

        <div className="mb-4 w-full max-w-sm">
          <label className="block text-sm text-text-muted mb-2 font-bold">BOARD SIZE</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(["Small", "Medium", "Large", "Custom"] as Size[]).map(s => (
              <button key={s} onClick={() => setSize(s)} className={`py-1.5 px-3 rounded border text-sm transition-colors flex-1 min-w-[70px] ${size === s ? "border-[#9bbc0f] bg-[#9bbc0f]/20 text-[#9bbc0f]" : "border-border text-text-muted hover:border-text-dim"}`}>{s}</button>
            ))}
          </div>
          {size === "Custom" && (
            <div className="flex gap-4">
              <label className="flex flex-col text-xs text-text-dim">WIDTH (10-40)<input type="number" min="10" max="40" value={customWidth} onChange={(e) => setCustomWidth(Math.max(10, Math.min(40, Number(e.target.value))))} className="bg-surface border border-border rounded p-1 text-text mt-1 w-20 text-center focus-visible:outline-none focus-visible:border-[#9bbc0f]"/></label>
              <label className="flex flex-col text-xs text-text-dim">HEIGHT (10-40)<input type="number" min="10" max="40" value={customHeight} onChange={(e) => setCustomHeight(Math.max(10, Math.min(40, Number(e.target.value))))} className="bg-surface border border-border rounded p-1 text-text mt-1 w-20 text-center focus-visible:outline-none focus-visible:border-[#9bbc0f]"/></label>
            </div>
          )}
        </div>

        <div className="mb-4 w-full max-w-sm flex gap-4">
          <div className="flex-1">
            <label className="block text-sm text-text-muted mb-2 font-bold">SPEED</label>
            <div className="flex flex-col gap-2">
              {(["Slow", "Normal", "Fast"] as Speed[]).map(s => (
                <button key={s} onClick={() => setSpeedOption(s)} className={`py-1.5 px-3 rounded border text-sm transition-colors ${speedOption === s ? "border-[#9bbc0f] bg-[#9bbc0f]/20 text-[#9bbc0f]" : "border-border text-text-muted hover:border-text-dim"}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm text-text-muted mb-2 font-bold">FOOD</label>
            <div className="flex flex-wrap gap-2">
              {(["Apple", "Banana", "Grapes", "Strawberry", "Mushroom"] as Fruit[]).map(f => (
                <button key={f} onClick={() => setFruit(f)} className={`py-1.5 px-3 rounded border text-sm transition-colors ${fruit === f ? "border-[#9bbc0f] bg-[#9bbc0f]/20 text-[#9bbc0f]" : "border-border text-text-muted hover:border-text-dim"}`}>
                  {FRUIT_EMOJIS[f]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-6 w-full max-w-sm">
          <label className="block text-sm text-text-muted mb-2 font-bold">AVATAR SKIN</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {(["Classic", "Neon", "Retro Pixel", "Monochrome", "Sunset", "Matrix"] as Skin[]).map(s => (
              <button key={s} onClick={() => setSkin(s)} className={`py-1.5 px-2 rounded border text-xs transition-colors truncate ${skin === s ? "border-[#9bbc0f] bg-[#9bbc0f]/20 text-[#9bbc0f]" : "border-border text-text-muted hover:border-text-dim"}`}>{s}</button>
            ))}
          </div>
          
          <div className="text-xs text-text-dim mb-1">Preview:</div>
          <div className="w-full h-16 bg-black border border-border rounded relative flex items-center justify-center overflow-hidden">
            <SkinPreview skin={skin} />
          </div>
        </div>

        <button onClick={startGame} className="w-full max-w-sm py-3 rounded-xl bg-gradient-to-r from-[#9bbc0f] to-[#7a9609] text-black font-bold text-lg tracking-wide hover:scale-[1.02] active:scale-95 transition-all mt-auto mb-4">
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
          <div className="text-text-muted text-sm uppercase tracking-widest mb-1 font-bold">Final {mode === "Time Attack" ? "Score" : "Length"}</div>
          <div className={`text-6xl font-black ${isNewBest ? "text-[#9bbc0f]" : "text-white"}`}>{finalScore}</div>
          {isNewBest && <div className="text-[#9bbc0f] font-bold text-sm uppercase tracking-widest mt-2 blink-prompt">New Best!</div>}
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
          <button onClick={startGame} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#9bbc0f] to-[#7a9609] text-black font-bold transition-all hover:scale-105 active:scale-95">
            Play Again
          </button>
          <Link to="/classics" className="py-3 px-5 rounded-xl border border-border text-text-muted font-medium hover:bg-surface-hover hover:text-text transition-all active:scale-95">
            Hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 w-full h-full relative touch-none" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="flex justify-between items-center mb-4 text-[#9bbc0f] font-bold" style={{ fontFamily: "var(--font-display)" }}>
        <div className="text-sm">
          {mode === "Time Attack" ? `TIME: ${timeLeft}s` : `LEN: ${snake.length}`}
        </div>
        {mode === "Zen" && <button onClick={endGame} className="px-3 py-1 bg-[#9bbc0f] text-black text-xs rounded hover:bg-white transition-colors">END RUN</button>}
        <div className="text-sm">SCORE: {applesEaten}</div>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0 min-w-0">
        <canvas 
          ref={canvasRef}
          width={boardWidth * 20}
          height={boardHeight * 20}
          className="relative border-2 border-[#9bbc0f]/50 w-full max-w-[min(100%,_60vh)] object-contain"
          style={{ aspectRatio: `${boardWidth} / ${boardHeight}` }}
        />
      </div>
    </div>
  );
}
