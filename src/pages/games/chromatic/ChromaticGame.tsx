import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { addToLeaderboard } from "@/lib/scoring";
import type { LeaderboardEntry } from "@/lib/scoring";
import { unlockAudioContext, playBlip } from "@/lib/audio-engine";
import GameIntro from "@/components/GameIntro";

type GamePhase = "intro" | "playback" | "input" | "gameover";

const PADS = [
  {
    id: 0,
    color: "#ff3b30",
    icon: "▲",
    label: "Red triangle pad",
    freq: 330,
    key: "1",
  },
  {
    id: 1,
    color: "#39ff8a",
    icon: "■",
    label: "Green square pad",
    freq: 440,
    key: "2",
  },
  {
    id: 2,
    color: "#4a90d9",
    icon: "●",
    label: "Blue circle pad",
    freq: 554,
    key: "3",
  },
  {
    id: 3,
    color: "#ffb000",
    icon: "◆",
    label: "Yellow diamond pad",
    freq: 659,
    key: "4",
  },
  {
    id: 4,
    color: "#b56cff",
    icon: "★",
    label: "Violet star pad",
    freq: 784,
    key: "5",
  },
  {
    id: 5,
    color: "#ff6b9d",
    icon: "✚",
    label: "Pink plus pad",
    freq: 880,
    key: "6",
  },
];

function randomPadId(sequenceLength: number): number {
  const padCount = sequenceLength >= 4 ? PADS.length : 4;
  return Math.floor(Math.random() * padCount);
}

export default function ChromaticGame() {
  const [phase, setPhase] = useState<GamePhase>("intro");
  const [score, setScore] = useState(0);
  const [activePad, setActivePad] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);

  const sequenceRef = useRef<number[]>([]);
  const playerPosRef = useRef(0);
  const isMountedRef = useRef(true);
  const playbackTimeoutsRef = useRef<number[]>([]);
  const padTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      playbackTimeoutsRef.current.forEach((t) => clearTimeout(t));
      if (padTimeoutRef.current) clearTimeout(padTimeoutRef.current);
    };
  }, []);

  const clearPlaybackTimeouts = () => {
    playbackTimeoutsRef.current.forEach((t) => clearTimeout(t));
    playbackTimeoutsRef.current = [];
  };

  const playSequence = useCallback(async () => {
    clearPlaybackTimeouts();

    // Brief pause before playback starts
    await new Promise<void>((resolve) => {
      const t = window.setTimeout(resolve, 600);
      playbackTimeoutsRef.current.push(t);
    });

    const playbackGap = Math.max(100, 200 - sequenceRef.current.length * 12);

    for (let i = 0; i < sequenceRef.current.length; i++) {
      if (!isMountedRef.current) return;

      const padId = sequenceRef.current[i];

      // Light up pad
      setActivePad(padId);
      playBlip(PADS[padId].freq, 200);

      // Hold for 400ms
      await new Promise<void>((resolve) => {
        const t = window.setTimeout(resolve, 400);
        playbackTimeoutsRef.current.push(t);
      });

      if (!isMountedRef.current) return;
      setActivePad(null);

      // Later rounds keep their longer sequences moving at a quicker pace.
      await new Promise<void>((resolve) => {
        const t = window.setTimeout(resolve, playbackGap);
        playbackTimeoutsRef.current.push(t);
      });
    }

    if (isMountedRef.current) {
      playerPosRef.current = 0;
      setPhase("input");
    }
  }, []);

  // Trigger playback when phase changes to playback
  useEffect(() => {
    if (phase === "playback") {
      playSequence();
    }
  }, [phase, playSequence]);

  const startGame = async () => {
    await unlockAudioContext();
    playBlip(440, 80);
    sequenceRef.current = [randomPadId(1)];
    playerPosRef.current = 0;
    setScore(0);
    setActivePad(null);
    setPlayerRank(null);
    setPhase("playback");
  };

  const endGame = useCallback(
    (finalLength: number) => {
      playBlip(150, 300);
      const entry: LeaderboardEntry = {
        name: "Player",
        score: finalLength,
        date: new Date().toISOString(),
        rounds: finalLength,
      };
      const result = addToLeaderboard("chromatic", entry);
      setLeaderboard(result.entries);
      setPlayerRank(result.rank);
      setScore(finalLength);
      setPhase("gameover");
    },
    []
  );

  const handlePadTap = useCallback(
    (id: number) => {
      if (phase !== "input") return;

      // Visual feedback
      if (padTimeoutRef.current) clearTimeout(padTimeoutRef.current);
      setActivePad(id);
      playBlip(PADS[id].freq, 150);
      padTimeoutRef.current = window.setTimeout(() => {
        setActivePad(null);
      }, 200);

      const expected = sequenceRef.current[playerPosRef.current];

      if (id === expected) {
        playerPosRef.current++;
        if (playerPosRef.current === sequenceRef.current.length) {
          // Completed the sequence — grow it
          const newLength = sequenceRef.current.length;
          setScore(newLength);
          sequenceRef.current.push(randomPadId(sequenceRef.current.length + 1));
          playerPosRef.current = 0;

          // Brief pause then replay
          const t = window.setTimeout(() => {
            if (isMountedRef.current) {
              setPhase("playback");
            }
          }, 800);
          playbackTimeoutsRef.current.push(t);
        }
      } else {
        // Wrong pad — game over
        const finalLength = sequenceRef.current.length - 1; // last completed length
        endGame(Math.max(0, finalLength));
      }
    },
    [phase, endGame]
  );

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== "input") return;
      const pad = PADS.find((p) => p.key === e.key);
      if (pad) {
        e.preventDefault();
        handlePadTap(pad.id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, handlePadTap]);

  // ─── INTRO ──────────────────────────
  if (phase === "intro") {
    return (
      <GameIntro
        gameName="CHROMATIC"
        description="Watch the sequence, then repeat it by tapping the pads in order. One mistake ends the run."
        hint="Tap the pads in order or press keys 1-6"
        accentColor="var(--chromatic-accent)"
        onStart={startGame}
      />
      );
  }

  // ─── GAME OVER ──────────────────────
  if (phase === "gameover") {
    return (
      <div className="flex-1 flex flex-col items-center px-4 py-6 overflow-y-auto fade-in">
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.1rem",
            color: "var(--chromatic-accent)",
            letterSpacing: "0.1em",
            marginBottom: "0.5rem",
            textShadow: "0 0 15px rgba(255, 46, 196, 0.4)",
          }}
        >
          GAME OVER
        </h2>

        {/* Score */}
        <div
          className="glass rounded-xl p-5 w-full max-w-xs mb-5 text-center"
          style={{ borderColor: "rgba(255, 46, 196, 0.2)" }}
        >
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.6rem",
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              marginBottom: "0.25rem",
            }}
          >
            Sequence Reached
          </p>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2rem",
              color: "var(--phosphor)",
              textShadow: "0 0 15px rgba(57, 255, 138, 0.5)",
            }}
          >
            {score}
          </p>
        </div>

        {/* Leaderboard */}
        <div className="glass rounded-xl p-4 w-full max-w-xs mb-5">
          <h3
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.6rem",
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
                      background: isYou
                        ? "rgba(57, 255, 138, 0.1)"
                        : "transparent",
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
                    <span
                      className="flex-1"
                      style={{ color: "rgba(255,255,255,0.7)" }}
                    >
                      {entry.name}
                      {isYou && (
                        <span
                          style={{
                            color: "var(--phosphor)",
                            marginLeft: "0.5rem",
                            fontSize: "0.65rem",
                          }}
                        >
                          ← YOU
                        </span>
                      )}
                    </span>
                    <span
                      style={{ color: "var(--phosphor)", fontWeight: 700 }}
                    >
                      {entry.score}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={startGame}
            className="flex-1 py-3 rounded-lg font-bold transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chromatic-accent)]"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8rem",
              background: "var(--chromatic-accent)",
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

  // ─── PLAYBACK / INPUT ──────────────────────
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-4 py-6"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* Score display */}
      <div className="mb-6 text-center">
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.6rem",
            color: "rgba(255,255,255,0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            marginBottom: "0.25rem",
          }}
        >
          Sequence
        </p>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            color: "var(--chromatic-accent)",
            textShadow: "0 0 10px rgba(255, 46, 196, 0.4)",
          }}
        >
          {sequenceRef.current.length}
        </p>
      </div>

      {/* Phase indicator */}
      <p
        className="mb-4"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.7rem",
          color:
            phase === "playback"
              ? "rgba(255,255,255,0.4)"
              : "var(--chromatic-accent)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {phase === "playback" ? "WATCH..." : "YOUR TURN"}
      </p>

      {/* Pad grid expands when the sequence reaches the later rounds. */}
      <div
        className={`grid ${sequenceRef.current.length >= 4 ? "grid-cols-3" : "grid-cols-2"} gap-3 w-full max-w-[280px] aspect-square`}
        style={{ touchAction: "none" }}
      >
        {PADS.slice(0, sequenceRef.current.length >= 4 ? 6 : 4).map((pad) => {
          const isActive = activePad === pad.id;
          return (
            <button
              key={pad.id}
              onClick={() => handlePadTap(pad.id)}
              disabled={phase !== "input"}
              aria-label={pad.label}
              className="relative flex items-center justify-center rounded-xl transition-all duration-100 focus-visible:outline-none"
              style={{
                border: `3px solid ${pad.color}`,
                background: isActive ? pad.color : `${pad.color}15`,
                opacity: isActive ? 1 : 0.55,
                transform: isActive ? "scale(1.05)" : "scale(1)",
                boxShadow: isActive
                  ? `0 0 25px ${pad.color}88, inset 0 0 15px ${pad.color}44`
                  : "none",
                cursor: phase === "input" ? "pointer" : "default",
                // Focus ring in pad's color
                outline: "none",
              }}
              onFocus={(e) => {
                if (phase === "input") {
                  (e.target as HTMLElement).style.boxShadow = `0 0 0 3px ${pad.color}88`;
                }
              }}
              onBlur={(e) => {
                (e.target as HTMLElement).style.boxShadow = "none";
              }}
            >
              <span
                style={{
                  fontSize: "2.5rem",
                  color: isActive ? "#000" : pad.color,
                  filter: isActive ? "none" : "brightness(0.7)",
                  transition: "color 0.1s",
                }}
              >
                {pad.icon}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
