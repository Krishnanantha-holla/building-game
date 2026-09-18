import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { computeScore, addToLeaderboard } from "@/lib/scoring";
import type { LeaderboardEntry } from "@/lib/scoring";
import { unlockAudioContext, playBlip } from "@/lib/audio-engine";
import GameIntro from "@/components/GameIntro";

type GamePhase = "intro" | "waiting" | "flash" | "tooSoon" | "result" | "gameover";

const TOTAL_ROUNDS = 5;
const PENALTY_TIME = 600;

export default function ReflexGame() {
  const [phase, setPhase] = useState<GamePhase>("intro");
  const [round, setRound] = useState(1);
  const [times, setTimes] = useState<number[]>([]);
  const [lastTime, setLastTime] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [playerRank, setPlayerRank] = useState<number | null>(null);

  const timeoutRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const roundRef = useRef(1);
  const timesRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const clearExistingTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const finishGame = useCallback((allTimes: number[]) => {
    const validTimes = allTimes.filter((t) => t < PENALTY_TIME);
    const avgTime =
      validTimes.length > 0
        ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length
        : PENALTY_TIME;

    const score = computeScore(avgTime, {
      fullPointsThreshold: 150,
      zeroPointsThreshold: 600,
      maxPoints: 500,
    });

    setFinalScore(Math.round(score));
    playBlip(880, 200);

    const entry: LeaderboardEntry = {
      name: "Player",
      score: Math.round(score),
      date: new Date().toISOString(),
      rounds: TOTAL_ROUNDS,
    };

    const result = addToLeaderboard("reflex", entry);
    setLeaderboard(result.entries);
    setPlayerRank(result.rank);
    setPhase("gameover");
  }, []);

  const startWaitingPhase = useCallback(() => {
    setPhase("waiting");
    clearExistingTimeout();

    const delay = Math.floor(Math.random() * 2500) + 1500;
    timeoutRef.current = window.setTimeout(() => {
      setPhase("flash");
      startTimeRef.current = performance.now();
      playBlip(600, 80);
    }, delay);
  }, []);

  const advanceRound = useCallback(
    (allTimes: number[]) => {
      if (roundRef.current < TOTAL_ROUNDS) {
        roundRef.current++;
        setRound(roundRef.current);
        startWaitingPhase();
      } else {
        finishGame(allTimes);
      }
    },
    [startWaitingPhase, finishGame]
  );

  const handleStart = async () => {
    await unlockAudioContext();
    playBlip(440, 80);
    roundRef.current = 1;
    timesRef.current = [];
    setRound(1);
    setTimes([]);
    setLastTime(null);
    setFinalScore(null);
    setPlayerRank(null);
    startWaitingPhase();
  };

  const handleAction = useCallback(() => {
    if (phase === "waiting") {
      // False start
      clearExistingTimeout();
      playBlip(150, 150);
      setPhase("tooSoon");
      setLastTime(null);
      const newTimes = [...timesRef.current, PENALTY_TIME];
      timesRef.current = newTimes;
      setTimes(newTimes);

      timeoutRef.current = window.setTimeout(() => {
        advanceRound(newTimes);
      }, 1500);
    } else if (phase === "flash") {
      const reactionTime = Math.round(performance.now() - startTimeRef.current);
      playBlip(880, 80);
      setPhase("result");
      setLastTime(reactionTime);
      const newTimes = [...timesRef.current, reactionTime];
      timesRef.current = newTimes;
      setTimes(newTimes);

      timeoutRef.current = window.setTimeout(() => {
        advanceRound(newTimes);
      }, 1500);
    }
  }, [phase, advanceRound]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.code === "Space" || e.code === "Enter") &&
        (phase === "waiting" || phase === "flash")
      ) {
        e.preventDefault();
        handleAction();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, handleAction]);

  const validTimes = times.filter((t) => t < PENALTY_TIME);
  const avgTime =
    validTimes.length > 0
      ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length)
      : 0;
  const fastestTime = validTimes.length > 0 ? Math.min(...validTimes) : null;

  // ─── INTRO ──────────────────────────
  if (phase === "intro") {
    return (
      <GameIntro
        gameName="REFLEX"
        description="Wait for the flash, then tap as fast as you can. Tapping early is a fail."
        hint="Tap the screen or press SPACE when it flashes"
        accentColor="var(--reflex-accent)"
        onStart={handleStart}
      />
    );
  }

  // ─── GAMEPLAY (waiting / flash / tooSoon / result) ──────────
  if (phase !== "gameover") {
    const bgColor =
      phase === "flash"
        ? "var(--reflex-accent)"
        : phase === "tooSoon"
        ? "#5c1018"
        : "var(--crt-bg)";
    const textColor =
      phase === "flash"
        ? "#fff"
        : phase === "tooSoon"
        ? "var(--reflex-accent)"
        : "rgba(255,255,255,0.3)";

    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center select-none"
        style={{
          background: bgColor,
          color: textColor,
          transition: "background 0.05s, color 0.05s",
          cursor: "pointer",
          zIndex: 40,
        }}
        onMouseDown={handleAction}
        onTouchStart={(e) => {
          e.preventDefault();
          handleAction();
        }}
        role="button"
        tabIndex={0}
        aria-label={phase === "flash" ? "Tap now!" : "Wait for the flash"}
      >
        {/* Round indicator */}
        <div
          style={{
            position: "absolute",
            top: "5rem",
            left: "1.5rem",
            fontFamily: "var(--font-body)",
            fontSize: "0.75rem",
            opacity: 0.5,
          }}
        >
          ROUND {round}/{TOTAL_ROUNDS}
        </div>

        {phase === "waiting" && (
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.2rem, 5vw, 2rem)",
              letterSpacing: "0.2em",
              opacity: 0.4,
            }}
          >
            WAIT...
          </span>
        )}

        {phase === "flash" && (
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.5rem, 6vw, 2.5rem)",
              letterSpacing: "0.15em",
              textShadow: "0 0 30px rgba(255,255,255,0.8)",
            }}
          >
            TAP NOW!
          </span>
        )}

        {phase === "tooSoon" && (
          <div className="flex flex-col items-center gap-3">
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1rem, 4vw, 1.8rem)",
                letterSpacing: "0.1em",
              }}
            >
              TOO SOON!
            </span>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.8rem",
                opacity: 0.5,
              }}
            >
              Penalty applied
            </span>
          </div>
        )}

        {phase === "result" && lastTime !== null && (
          <div className="flex flex-col items-center gap-2">
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.5rem, 6vw, 2.5rem)",
                color: "var(--phosphor)",
                textShadow: "0 0 15px rgba(57, 255, 138, 0.6)",
              }}
            >
              {lastTime}ms
            </span>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.8rem",
                color: "rgba(57, 255, 138, 0.6)",
              }}
            >
              {lastTime <= 150
                ? "LIGHTNING!"
                : lastTime <= 250
                ? "FAST!"
                : lastTime <= 350
                ? "OK"
                : "SLOW"}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ─── GAME OVER ──────────────────────
  return (
    <div className="flex-1 flex flex-col items-center px-4 py-6 overflow-y-auto fade-in">
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.2rem",
          color: "var(--reflex-accent)",
          letterSpacing: "0.1em",
          marginBottom: "1.5rem",
          textShadow: "0 0 15px rgba(255, 59, 48, 0.4)",
        }}
      >
        GAME OVER
      </h2>

      {/* Stats */}
      <div
        className="glass rounded-xl p-5 w-full max-w-sm mb-5"
        style={{ borderColor: "rgba(255, 59, 48, 0.2)" }}
      >
        <div className="flex justify-between items-end mb-4">
          <div>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.65rem",
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Avg Reaction
            </p>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.1rem",
                color: "#fff",
              }}
            >
              {avgTime}ms
            </p>
          </div>
          <div className="text-right">
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.65rem",
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Score
            </p>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.3rem",
                color: "var(--phosphor)",
                textShadow: "0 0 10px rgba(57, 255, 138, 0.5)",
              }}
            >
              {finalScore}
            </p>
          </div>
        </div>

        {/* Individual rounds */}
        <div className="flex gap-2 justify-center">
          {times.map((t, i) => (
            <div
              key={i}
              className="text-center px-2 py-1 rounded"
              style={{
                background:
                  t >= PENALTY_TIME
                    ? "rgba(255, 59, 48, 0.15)"
                    : t === fastestTime
                    ? "rgba(255, 176, 0, 0.2)"
                    : "rgba(57, 255, 138, 0.1)",
                border: t === fastestTime ? "1px solid #ffb000" : "1px solid transparent",
                fontFamily: "var(--font-body)",
                fontSize: "0.65rem",
                color:
                  t >= PENALTY_TIME
                    ? "var(--reflex-accent)"
                    : t === fastestTime
                    ? "#ffb000"
                    : "var(--phosphor)",
              }}
            >
              {t >= PENALTY_TIME ? "MISS" : t === fastestTime ? `${t}ms FASTEST` : `${t}ms`}
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="glass rounded-xl p-4 w-full max-w-sm mb-5">
        <h3
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.65rem",
            color: "rgba(255,255,255,0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            marginBottom: "0.75rem",
            textAlign: "center",
          }}
        >
          Top Scores
        </h3>
        {leaderboard.length === 0 ? (
          <p
            className="text-center py-3"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            No scores yet
          </p>
        ) : (
          <div className="space-y-1">
            {leaderboard.map((entry, i) => {
              const isYou = i + 1 === playerRank;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2 py-1.5 rounded"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.75rem",
                    background: isYou ? "rgba(57, 255, 138, 0.1)" : "transparent",
                    border: isYou
                      ? "1px solid rgba(57, 255, 138, 0.2)"
                      : "1px solid transparent",
                  }}
                >
                  <span
                    style={{
                      width: "1.5rem",
                      textAlign: "center",
                      fontWeight: 700,
                      color:
                        i === 0
                          ? "#ffb000"
                          : i === 1
                          ? "#c0c0c0"
                          : i === 2
                          ? "#cd7f32"
                          : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {entry.name}
                    {isYou && (
                      <span style={{ color: "var(--phosphor)", marginLeft: "0.5rem", fontSize: "0.65rem" }}>
                        ← YOU
                      </span>
                    )}
                  </span>
                  <span style={{ color: "var(--phosphor)", fontWeight: 700 }}>
                    {entry.score}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 w-full max-w-sm">
        <button
          onClick={handleStart}
          className="flex-1 py-3 rounded-lg font-bold transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--reflex-accent)]"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8rem",
            background: "var(--reflex-accent)",
            color: "#fff",
            letterSpacing: "0.05em",
          }}
        >
          PLAY AGAIN
        </button>
        <Link
          to="/"
          className="py-3 px-4 rounded-lg font-medium transition-all active:scale-95 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--phosphor)]"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8rem",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          ARCADE
        </Link>
      </div>
    </div>
  );
}
