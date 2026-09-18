import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import GameIntro from "@/components/GameIntro";
import { addToLeaderboard } from "@/lib/scoring";
import type { LeaderboardEntry } from "@/lib/scoring";
import { playBlip, scheduleBeat, unlockAudioContext } from "@/lib/audio-engine";

type GamePhase = "intro" | "playing" | "gameover";

const GAME_DURATION = 30000;
const MISS_STREAK_LIMIT = 3;
const PERFECT_WINDOW = 50;
const GOOD_WINDOW = 150;
const START_BPM = 90;
const BPM_STEP = 8;
const CORRECT_TAPS_PER_LEVEL = 8;

export default function TempoGame() {
  const [phase, setPhase] = useState<GamePhase>("intro");
  const [bpm, setBpm] = useState(START_BPM);
  const [accuracy, setAccuracy] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastResult, setLastResult] = useState("LISTEN...");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);

  const stopBeatRef = useRef<(() => void) | null>(null);
  const endTimerRef = useRef<number | null>(null);
  const beatTimesRef = useRef<number[]>([]);
  const phaseRef = useRef<GamePhase>("intro");
  const tapsRef = useRef(0);
  const pointsRef = useRef(0);
  const streakRef = useRef(0);
  const correctRef = useRef(0);
  const missStreakRef = useRef(0);
  const bpmRef = useRef(START_BPM);

  const finishGame = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    stopBeatRef.current?.();
    stopBeatRef.current = null;
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);

    const finalAccuracy = tapsRef.current
      ? Math.round((pointsRef.current / (tapsRef.current * 100)) * 100)
      : 0;
    const entry: LeaderboardEntry = {
      name: "Player",
      score: finalAccuracy,
      date: new Date().toISOString(),
      rounds: tapsRef.current,
    };
    const result = addToLeaderboard("tempo", entry);
    setLeaderboard(result.entries);
    setPlayerRank(result.rank);
    setAccuracy(finalAccuracy);
    phaseRef.current = "gameover";
    setPhase("gameover");
  }, []);

  const startBeatSchedule = useCallback((nextBpm: number) => {
    stopBeatRef.current?.();
    stopBeatRef.current = scheduleBeat(nextBpm, (timestamp) => {
      beatTimesRef.current.push(timestamp);
      beatTimesRef.current = beatTimesRef.current.slice(-8);
    });
  }, []);

  const startGame = async () => {
    await unlockAudioContext();
    stopBeatRef.current?.();
    beatTimesRef.current = [];
    tapsRef.current = 0;
    pointsRef.current = 0;
    streakRef.current = 0;
    correctRef.current = 0;
    missStreakRef.current = 0;
    bpmRef.current = START_BPM;
    setBpm(START_BPM);
    setAccuracy(0);
    setStreak(0);
    setLastResult("LISTEN...");
    phaseRef.current = "playing";
    setPhase("playing");
    startBeatSchedule(START_BPM);
    endTimerRef.current = window.setTimeout(finishGame, GAME_DURATION);
  };

  const handleTap = useCallback(() => {
    if (phaseRef.current !== "playing" || beatTimesRef.current.length === 0) return;

    const now = performance.now();
    const offset = Math.min(
      ...beatTimesRef.current.map((beatTime) => Math.abs(now - beatTime))
    );
    const points = offset <= PERFECT_WINDOW ? 100 : offset <= GOOD_WINDOW ? 60 : 0;
    tapsRef.current++;
    pointsRef.current += points;

    if (points > 0) {
      correctRef.current++;
      streakRef.current++;
      missStreakRef.current = 0;
      setStreak(streakRef.current);
      setLastResult(points === 100 ? "PERFECT" : "GOOD");
      if (correctRef.current % CORRECT_TAPS_PER_LEVEL === 0) {
        bpmRef.current += BPM_STEP;
        setBpm(bpmRef.current);
        startBeatSchedule(bpmRef.current);
      }
    } else {
      streakRef.current = 0;
      missStreakRef.current++;
      setStreak(0);
      setLastResult("MISS");
      if (missStreakRef.current >= MISS_STREAK_LIMIT) finishGame();
    }

    const nextAccuracy = Math.round(
      (pointsRef.current / (tapsRef.current * 100)) * 100
    );
    setAccuracy(nextAccuracy);
    playBlip(points > 0 ? 660 : 150, points > 0 ? 45 : 100);
  }, [finishGame, startBeatSchedule]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        handleTap();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTap]);

  useEffect(() => {
    return () => {
      stopBeatRef.current?.();
      if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    };
  }, []);

  if (phase === "intro") {
    return (
      <GameIntro
        gameName="TEMPO"
        description="Tap in time with the beat. Precision matters more than speed."
        hint="Tap the field or press SPACE with each beat"
        accentColor="var(--tempo-accent)"
        onStart={startGame}
      />
    );
  }

  if (phase === "gameover") {
    return (
      <div className="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto fade-in">
        <h2 style={{ fontFamily: "var(--font-display)", color: "var(--tempo-accent)", letterSpacing: "0.1em", marginBottom: "1.5rem" }}>
          TEMPO COMPLETE
        </h2>
        <div className="glass rounded-xl p-6 w-full max-w-sm mb-5 text-center">
          <p className="text-text-dim text-xs uppercase tracking-widest mb-1">Final Accuracy</p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "2rem", color: "var(--tempo-accent)" }}>{accuracy}%</p>
          <p className="text-text-muted text-sm mt-3">{tapsRef.current} taps recorded</p>
        </div>
        <div className="glass rounded-xl p-4 w-full max-w-sm mb-5">
          <h3 className="text-center text-text-dim text-xs uppercase tracking-widest mb-3">Top Scores</h3>
          {leaderboard.map((entry, index) => (
            <div key={`${entry.date}-${index}`} className="flex items-center gap-3 px-2 py-1.5 text-sm">
              <span className="w-5 text-text-dim">{index + 1}</span>
              <span className="flex-1 text-text-muted">{entry.name}{index + 1 === playerRank && <span className="text-warning ml-2">YOU</span>}</span>
              <span className="font-bold" style={{ color: "var(--tempo-accent)" }}>{entry.score}%</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 w-full max-w-sm">
          <button onClick={startGame} className="flex-1 py-3 rounded-lg font-bold" style={{ background: "var(--tempo-accent)", color: "#111" }}>PLAY AGAIN</button>
          <Link to="/" className="py-3 px-4 rounded-lg text-center border border-border text-text-muted">ARCADE</Link>
        </div>
      </div>
    );
  }

  return (
    <button
      className="flex-1 flex flex-col items-center justify-center select-none w-full"
      style={{ background: "var(--crt-bg)", color: "var(--tempo-accent)", cursor: "pointer", touchAction: "manipulation" }}
      onClick={handleTap}
      aria-label="Tap in time with the beat"
    >
      <div className="text-center">
        <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.3rem, 5vw, 2rem)", letterSpacing: "0.12em" }}>TAP</p>
        <p className="mt-5 text-text-muted text-sm">{lastResult}</p>
        <div className="flex gap-8 justify-center mt-8 text-sm">
          <span>{bpm} BPM</span>
          <span>{accuracy}% ACC</span>
          <span>{streak} STREAK</span>
        </div>
      </div>
    </button>
  );
}