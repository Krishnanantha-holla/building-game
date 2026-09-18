import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import GameTile from "@/components/GameTile";

const GAMES = [
  {
    id: "echo",
    title: "Echo",
    description: "Locate sounds in 3D space — where is the ping coming from?",
    icon: "📡",
    accent: "#00e5ff",
  },
  {
    id: "reflex",
    title: "Reflex",
    description: "Test your reaction speed — tap the instant the screen flashes.",
    icon: "⚡",
    accent: "#ff3b30",
  },
  {
    id: "chromatic",
    title: "Chromatic",
    description: "Repeat the color sequence from memory. How long can you go?",
    icon: "🎨",
    accent: "#ff2ec4",
  },
  {
    id: "tempo",
    title: "Tempo",
    description: "Feel the rhythm, keep the beat — timing is everything.",
    icon: "🥁",
    accent: "#ffb000",
    comingSoon: true,
  },
];

export default function HubPage() {
  const [booted, setBooted] = useState(false);
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    // Check if boot animation already played this session
    const alreadyBooted = sessionStorage.getItem("instinct-booted");
    if (alreadyBooted) {
      setBooted(true);
      setBootDone(true);
      return;
    }

    // Respect prefers-reduced-motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      sessionStorage.setItem("instinct-booted", "1");
      setBooted(true);
      setBootDone(true);
      return;
    }

    // Play boot animation
    setBooted(true);
    const timer = setTimeout(() => {
      sessionStorage.setItem("instinct-booted", "1");
      setBootDone(true);
    }, 800); // flicker 300ms + degauss 500ms

    return () => clearTimeout(timer);
  }, []);

  if (!booted) {
    return (
      <div style={{ background: "var(--crt-bg)", minHeight: "100dvh" }} />
    );
  }

  return (
    <div className={!bootDone ? "crt-boot" : ""}>
      <Navbar />
      <main
        className="flex-1 flex flex-col"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {/* Hero */}
        <section className="pt-24 pb-6 px-4 text-center fade-in">
          <div className="max-w-2xl mx-auto">
            <h1
              className="crt-logo-glow mb-3"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.4rem, 5vw, 2.2rem)",
                color: "var(--phosphor)",
                letterSpacing: "0.12em",
                lineHeight: 1.4,
              }}
            >
              INSTINCT
            </h1>
            <p
              style={{
                color: "rgba(57, 255, 138, 0.5)",
                fontFamily: "var(--font-body)",
                fontSize: "0.9rem",
                letterSpacing: "0.05em",
              }}
            >
              Test your senses. Trust your instincts.
            </p>
          </div>
        </section>

        {/* Game Cabinets Grid */}
        <section className="flex-1 px-4 pb-12 fade-in-delay">
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {GAMES.map((game) => (
                <GameTile key={game.id} {...game} />
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-6 text-center">
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.7rem",
              color: "rgba(57, 255, 138, 0.2)",
              letterSpacing: "0.08em",
            }}
          >
            INSERT COIN TO CONTINUE
          </p>
        </footer>
      </main>
    </div>
  );
}
