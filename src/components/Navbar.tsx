import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { playBlip, getAudioContext, isMuted, setMuted } from "@/lib/audio-engine";
import { getLeaderboard } from "@/lib/scoring";

export default function Navbar() {
  const location = useLocation();
  const isGamePage = location.pathname.startsWith("/games/");
  const [showSettings, setShowSettings] = useState(false);
  const [muted, setMutedState] = useState(isMuted());

  const handleNavClick = () => {
    if (getAudioContext() && !isMuted()) {
      playBlip(880, 40);
    }
  };

  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    setMutedState(newMuted);
    if (!newMuted && getAudioContext()) {
      playBlip(660, 40);
    }
  };

  const toggleSettings = () => {
    setShowSettings((prev) => !prev);
    if (getAudioContext() && !isMuted()) {
      playBlip(550, 30);
    }
  };

  // Aggregate stats from leaderboards
  const stats = showSettings
    ? {
        echo: getLeaderboard("echo")[0]?.score ?? "—",
        reflex: getLeaderboard("reflex")[0]?.score ?? "—",
        chromatic: getLeaderboard("chromatic")[0]?.score ?? "—",
        tempo: getLeaderboard("tempo")[0]?.score ?? "—",
        vector: getLeaderboard("vector")[0]?.score ?? "—",
        stroop: getLeaderboard("stroop")[0]?.score ?? "—",
        glitchTap: getLeaderboard("glitch-tap")[0]?.score ?? "—",
      }
    : null;

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          background: "rgba(10, 10, 15, 0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(57, 255, 138, 0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isGamePage && (
              <Link
                to="/"
                onClick={handleNavClick}
                className="flex items-center gap-1 transition-colors duration-200 mr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--phosphor)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--crt-bg)] rounded"
                style={{ color: "var(--phosphor)", opacity: 0.7 }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = "0.7";
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                  }}
                >
                  ARCADE
                </span>
              </Link>
            )}
            <Link
              to="/"
              onClick={handleNavClick}
              className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--phosphor)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--crt-bg)] rounded"
            >
              <span
                className="crt-logo-glow"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "0.85rem",
                  color: "var(--phosphor)",
                  letterSpacing: "0.15em",
                }}
              >
                REFLEX//ARC
              </span>
            </Link>
          </div>

          {/* Right side: settings icon */}
          <div className="flex items-center gap-2">
            {/* Mute toggle */}
            <button
              onClick={toggleMute}
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--phosphor)]"
              style={{
                color: muted ? "rgba(255,255,255,0.3)" : "var(--phosphor)",
                background: muted ? "rgba(255,255,255,0.05)" : "rgba(57, 255, 138, 0.08)",
              }}
              aria-label={muted ? "Unmute sound" : "Mute sound"}
              title={muted ? "Sound off" : "Sound on"}
            >
              {muted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>

            {/* Settings/stats icon */}
            <button
              onClick={toggleSettings}
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--phosphor)]"
              style={{
                color: showSettings ? "var(--phosphor)" : "rgba(255,255,255,0.4)",
                background: showSettings ? "rgba(57, 255, 138, 0.1)" : "transparent",
              }}
              aria-label="Settings and stats"
              title="Stats & settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Settings Panel */}
      {showSettings && (
        <div
          className="fixed top-14 right-0 z-40 glass rounded-bl-xl p-4 fade-in"
          style={{
            marginTop: "env(safe-area-inset-top)",
            width: "min(280px, 90vw)",
            borderLeft: "1px solid rgba(57, 255, 138, 0.1)",
            borderBottom: "1px solid rgba(57, 255, 138, 0.1)",
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.6rem",
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              marginBottom: "0.75rem",
            }}
          >
            Best Scores
          </h3>
          {stats && (
            <div className="space-y-2 mb-3">
              {[
                { name: "Echo", val: stats.echo, color: "#00e5ff" },
                { name: "Reflex", val: stats.reflex, color: "#ff3b30" },
                { name: "Chromatic", val: stats.chromatic, color: "#ff2ec4" },
                { name: "Tempo", val: stats.tempo, color: "#ffb000" },
                { name: "Vector", val: stats.vector, color: "#b026ff" },
                { name: "Stroop", val: stats.stroop, color: "#a6ff00" },
                { name: "Glitch Tap", val: stats.glitchTap, color: "#00a8ff" },
              ].map((g) => (
                <div
                  key={g.name}
                  className="flex items-center justify-between px-2 py-1.5 rounded"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.75rem",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <span style={{ color: g.color }}>{g.name}</span>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "0.6rem",
                      color: "var(--phosphor)",
                    }}
                  >
                    {g.val}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowSettings(false)}
            className="w-full py-2 rounded text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--phosphor)]"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.4)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            CLOSE
          </button>
        </div>
      )}
    </>
  );
}
