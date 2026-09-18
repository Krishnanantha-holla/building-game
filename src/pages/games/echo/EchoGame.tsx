
import { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  unlockAudioContext,
  playSpatialPing,
  disposeAudioContext,
} from "@/lib/audio-engine";
import {
  computeScore,
  StreakTracker,
  addToLeaderboard,
} from "@/lib/scoring";
import type { LeaderboardEntry } from "@/lib/scoring";
import CompassUI from "./CompassUI";
import ElevationSlider from "./ElevationSlider";

type GamePhase = "intro" | "headphones" | "playing" | "feedback" | "gameover";

const MAX_ROUNDS = 15;
const MAX_MISSES = 3;
const MISS_THRESHOLD = 60;
const FEEDBACK_DURATION = 1500;
const BASE_PING_DURATION = 250;
const MIN_PING_DURATION = 150;

export default function EchoGame() {
  const [gamePhase, setGamePhase] = useState<GamePhase>("intro");
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [guessAngle, setGuessAngle] = useState(0);
  const [guessElevation, setGuessElevation] = useState(0);
  const [actualAngle, setActualAngle] = useState(0);
  const [actualElevation, setActualElevation] = useState(0);
  const [misses, setMisses] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [showElevation, setShowElevation] = useState(false);
  const [isHit, setIsHit] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<
    LeaderboardEntry[]
  >([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [streakCurrent, setStreakCurrent] = useState(0);
  const [streakBest, setStreakBest] = useState(0);

  const streakRef = useRef(new StreakTracker());
  const feedbackTimerRef = useRef<number | null>(null);
  const pingParamsRef = useRef<{
    azimuth: number;
    elevation: number;
    duration: number;
    frequency: number;
  } | null>(null);
  const roundRef = useRef(1);
  const scoreRef = useRef(0);
  const missesRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disposeAudioContext();
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  // Count-up animation for final score
  useEffect(() => {
    if (gamePhase !== "gameover") return;
    const target = scoreRef.current;
    const duration = 1000;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [gamePhase]);

  const getPingDuration = useCallback((currentRound: number) => {
    const reduction = Math.floor((currentRound - 1) / 5) * 20;
    return Math.max(MIN_PING_DURATION, BASE_PING_DURATION - reduction);
  }, []);

  const startRound = useCallback(
    (currentRound: number) => {
      const az = Math.random() * 360;
      const useElevation = currentRound >= 10;
      const el = useElevation ? (Math.random() - 0.5) * 60 : 0;
      const dur = getPingDuration(currentRound);
      const freq = 660 + Math.random() * 440;

      setActualAngle(az);
      setActualElevation(el);
      setShowElevation(useElevation);
      setGuessAngle(0);
      setGuessElevation(0);
      setRoundScore(0);
      setIsHit(false);
      setGamePhase("playing");

      pingParamsRef.current = {
        azimuth: az,
        elevation: el,
        duration: dur,
        frequency: freq,
      };

      // Small delay before playing ping to let UI settle
      setTimeout(() => {
        playSpatialPing({
          azimuth: az,
          elevation: el,
          duration: dur,
          frequency: freq,
        });
      }, 300);
    },
    [getPingDuration]
  );

  const handlePlay = useCallback(async () => {
    // MUST unlock audio context inside user gesture handler
    await unlockAudioContext();
    setGamePhase("headphones");
  }, []);

  const handleGotIt = useCallback(() => {
    roundRef.current = 1;
    scoreRef.current = 0;
    missesRef.current = 0;
    setRound(1);
    setScore(0);
    setMisses(0);
    streakRef.current.reset();
    startRound(1);
  }, [startRound]);

  const handleLockIn = useCallback(() => {
    if (gamePhase !== "playing") return;

    // Calculate angular error
    let azError = Math.abs(guessAngle - actualAngle);
    if (azError > 180) azError = 360 - azError;


    let totalError = azError;
    if (showElevation) {
      const elError = Math.abs(guessElevation - actualElevation);
      totalError = Math.sqrt(azError * azError + elError * elError);
    }

    const pts = computeScore(totalError);
    const hit = totalError <= MISS_THRESHOLD;

    streakRef.current.record(hit);
    const newScore = scoreRef.current + pts;
    const newMisses = missesRef.current + (hit ? 0 : 1);

    scoreRef.current = newScore;
    missesRef.current = newMisses;

    setRoundScore(pts);
    setIsHit(hit);
    setScore(newScore);
    setMisses(newMisses);
    setStreakCurrent(streakRef.current.current);
    setStreakBest(streakRef.current.best);
    setGamePhase("feedback");

    feedbackTimerRef.current = setTimeout(() => {
      const currentRound = roundRef.current;

      if (currentRound >= MAX_ROUNDS || newMisses >= MAX_MISSES) {
        // Game over
        const entry: LeaderboardEntry = {
          name: "Player",
          score: newScore,
          date: new Date().toISOString(),
          rounds: currentRound,
        };
        const result = addToLeaderboard("echo", entry);
        setLeaderboardEntries(result.entries);
        setPlayerRank(result.rank);
        setGamePhase("gameover");
      } else {
        // Next round
        const nextRound = currentRound + 1;
        roundRef.current = nextRound;
        setRound(nextRound);
        startRound(nextRound);
      }
    }, FEEDBACK_DURATION);
  }, [
    gamePhase,
    guessAngle,
    actualAngle,
    guessElevation,
    actualElevation,
    showElevation,
    startRound,
  ]);

  const handleReplayPing = useCallback(() => {
    if (pingParamsRef.current) {
      playSpatialPing(pingParamsRef.current);
    }
  }, []);

  const handlePlayAgain = useCallback(async () => {
    await unlockAudioContext();
    roundRef.current = 1;
    scoreRef.current = 0;
    missesRef.current = 0;
    setRound(1);
    setScore(0);
    setMisses(0);
    setDisplayScore(0);
    streakRef.current.reset();
    startRound(1);
  }, [startRound]);

  // ─── INTRO SCREEN ──────────────────────────────────
  if (gamePhase === "intro") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 fade-in">
        {/* Sonar decoration */}
        <div className="relative mb-8">
          <div className="w-28 h-28 rounded-full border-2 border-accent/20 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full border border-accent/30 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border border-accent/40 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-accent/60" />
              </div>
            </div>
          </div>
          {/* Sweep line */}
          <div
            className="absolute inset-0 sonar-sweep"
            style={{ transformOrigin: "50% 50%" }}
          >
            <div
              className="absolute top-1/2 left-1/2 w-0.5 bg-gradient-to-t from-accent/40 to-transparent"
              style={{
                height: "56px",
                transformOrigin: "bottom center",
                transform: "translateX(-50%) translateY(-100%)",
              }}
            />
          </div>
        </div>

        <h1 className="text-5xl font-extrabold tracking-tight mb-2 gradient-text">
          Echo
        </h1>
        <p className="text-text-muted text-center mb-2 text-lg">
          Locate the sound in 3D space
        </p>
        <p className="text-text-dim text-center text-sm mb-10 max-w-xs leading-relaxed">
          A ping will play through headphones — spin the compass to where you
          think it came from, then lock in your answer.
        </p>

        <button
          onClick={handlePlay}
          className="px-10 py-4 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-bold text-lg tracking-wide btn-glow transition-all duration-300 hover:scale-105 active:scale-95"
        >
          ▶ Play
        </button>
      </div>
    );
  }

  // ─── HEADPHONES OVERLAY ────────────────────────────
  if (gamePhase === "headphones") {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="glass rounded-3xl p-8 max-w-sm w-full text-center fade-in">
          <div className="text-5xl mb-4">🎧</div>
          <h2 className="text-xl font-bold mb-2">Headphones Required</h2>
          <p className="text-text-muted text-sm mb-6 leading-relaxed">
            This game uses 3D spatial audio that won&apos;t work on speakers. Put on
            headphones for the full experience.
          </p>
          <button
            onClick={handleGotIt}
            className="px-8 py-3 rounded-xl bg-accent text-background font-bold text-base transition-all duration-200 hover:bg-accent-glow active:scale-95"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  // ─── GAME OVER SCREEN ─────────────────────────────
  if (gamePhase === "gameover") {
    return (
      <div className="flex-1 flex flex-col items-center px-4 py-6 overflow-y-auto fade-in">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-extrabold mb-1 gradient-text">
            Game Over
          </h2>
          <p className="text-text-muted text-sm">
            {misses >= MAX_MISSES
              ? "Too many misses!"
              : "All rounds complete!"}
          </p>
        </div>

        {/* Score display */}
        <div className="glass rounded-2xl p-6 w-full max-w-sm mb-6 text-center">
          <p className="text-text-dim text-xs uppercase tracking-widest mb-1">
            Final Score
          </p>
          <p className="text-5xl font-extrabold text-accent tabular-nums count-up">
            {displayScore}
          </p>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div>
              <p className="text-text-dim text-xs">Rounds</p>
              <p className="font-bold text-text">{round}</p>
            </div>
            <div>
              <p className="text-text-dim text-xs">Best Streak</p>
              <p className="font-bold text-warning">
                🔥 {streakBest}
              </p>
            </div>
            <div>
              <p className="text-text-dim text-xs">Misses</p>
              <p className="font-bold text-danger">{misses}</p>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="glass rounded-2xl p-4 w-full max-w-sm mb-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-text-dim mb-3 text-center">
            Top Scores
          </h3>
          {leaderboardEntries.length === 0 ? (
            <p className="text-center text-text-dim text-sm py-4">
              No scores yet — you&apos;re the first!
            </p>
          ) : (
            <div className="space-y-1">
              {leaderboardEntries.map((entry, i) => {
                const isCurrentRun = i + 1 === playerRank;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                      isCurrentRun
                        ? "bg-accent/10 border border-accent/30"
                        : "hover:bg-surface-hover"
                    }`}
                  >
                    <span
                      className={`w-6 text-center font-bold ${
                        i === 0
                          ? "text-warning"
                          : i === 1
                          ? "text-text-muted"
                          : i === 2
                          ? "text-amber-600"
                          : "text-text-dim"
                      }`}
                    >
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                    </span>
                    <span className="flex-1 font-medium text-text truncate">
                      {entry.name}
                      {isCurrentRun && (
                        <span className="text-accent text-xs ml-2">← You</span>
                      )}
                    </span>
                    <span className="font-bold text-accent tabular-nums">
                      {entry.score}
                    </span>
                    <span className="text-text-dim text-xs">
                      R{entry.rounds}
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
            onClick={handlePlayAgain}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold btn-glow transition-all hover:scale-105 active:scale-95"
          >
            Play Again
          </button>
          <Link
            to="/"
            className="py-3 px-5 rounded-xl border border-border text-text-muted font-medium hover:bg-surface-hover hover:text-text transition-all active:scale-95 text-center"
          >
            Arcade
          </Link>
        </div>
      </div>
    );
  }

  // ─── PLAYING / FEEDBACK SCREEN ─────────────────────
  const isFeedback = gamePhase === "feedback";
  const missesLeft = MAX_MISSES - misses;

  return (
    <div className="flex-1 flex flex-col px-4 py-2">
      {/* Top status bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-text-muted">
            Round{" "}
            <span className="text-text font-bold">
              {round}/{MAX_ROUNDS}
            </span>
          </span>
          {streakCurrent > 1 && (
            <span
              className={`text-sm font-bold text-warning ${
                isFeedback && isHit ? "streak-pop" : ""
              }`}
            >
              🔥 {streakCurrent}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-accent tabular-nums">
            {score} pts
          </span>
          <div className="flex gap-0.5">
            {Array.from({ length: MAX_MISSES }, (_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${
                  i < missesLeft ? "bg-accent/60" : "bg-danger/60"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main game area */}
      <div className="flex-1 flex items-center justify-center gap-4">
        <CompassUI
          angle={guessAngle}
          onAngleChange={setGuessAngle}
          actualAngle={isFeedback ? actualAngle : null}
          disabled={isFeedback}
          showSweep={!isFeedback}
        />

        {showElevation && (
          <ElevationSlider
            elevation={guessElevation}
            onElevationChange={setGuessElevation}
            actualElevation={isFeedback ? actualElevation : null}
            disabled={isFeedback}
          />
        )}
      </div>

      {/* Feedback overlay */}
      {isFeedback && (
        <div className="text-center mb-2 score-pop">
          <span
            className={`text-3xl font-extrabold ${
              isHit ? "text-accent-glow" : "text-danger"
            }`}
          >
            {isHit ? "Hit!" : "Miss!"}
          </span>
          <span className="text-xl font-bold text-text ml-3 tabular-nums">
            +{roundScore}
          </span>
        </div>
      )}

      {/* Bottom controls */}
      <div className="flex gap-3 pb-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        {!isFeedback && (
          <>
            <button
              onClick={handleReplayPing}
              className="w-14 h-14 rounded-xl border border-border bg-surface flex items-center justify-center text-xl hover:bg-surface-hover active:scale-90 transition-all"
              aria-label="Replay ping"
            >
              🔊
            </button>
            <button
              onClick={handleLockIn}
              className="flex-1 h-14 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold text-lg tracking-wide btn-glow transition-all hover:scale-[1.02] active:scale-95"
            >
              Lock In
            </button>
          </>
        )}
        {isFeedback && (
          <div className="flex-1 h-14 rounded-xl border border-border bg-surface flex items-center justify-center text-text-dim text-sm">
            Next round in a moment...
          </div>
        )}
      </div>
    </div>
  );
}
