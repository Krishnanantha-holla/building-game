import { useState, useEffect, useRef } from "react";
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
  },
  {
    id: "vector",
    title: "Vector",
    description: "Dodge the falling debris. Survive the void.",
    icon: "🚀",
    accent: "#b026ff",
  },
  {
    id: "stroop",
    title: "Stroop",
    description: "The word lies. Tap the ink color before the clock runs out.",
    icon: "👁️",
    accent: "#a6ff00",
  },
  {
    id: "glitch-tap",
    title: "Glitch Tap",
    description: "Tap the glowing matrix cell before it fades. Speed accelerates.",
    icon: "💠",
    accent: "#00a8ff",
  },
  {
    id: "snake",
    title: "Snake",
    description: "Eat apples, grow longer. Fluid arcade action.",
    icon: "🐍",
    accent: "#9bbc0f",
  },
];

export default function HubPage() {
  const [booted, setBooted] = useState(false);
  const [bootDone, setBootDone] = useState(false);
  const [attractIndex, setAttractIndex] = useState(-1);
  const idleTimerRef = useRef<number | null>(null);
  const attractIntervalRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if boot animation already played this session
    const alreadyBooted = sessionStorage.getItem("reflex-arc-booted");
    if (alreadyBooted) {
      setBooted(true);
      setBootDone(true);
      return;
    }

    // Respect prefers-reduced-motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      sessionStorage.setItem("reflex-arc-booted", "1");
      setBooted(true);
      setBootDone(true);
      return;
    }

    // Play boot animation
    setBooted(true);
    const timer = window.setTimeout(() => {
      sessionStorage.setItem("reflex-arc-booted", "1");
      setBootDone(true);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // Attract mode: after 25s idle, cycle cabinet glows
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const resetIdle = () => {
      // Clear attract mode
      setAttractIndex(-1);
      if (attractIntervalRef.current) {
        clearInterval(attractIntervalRef.current);
        attractIntervalRef.current = null;
      }

      // Reset idle timer
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        // Start attract mode: cycle through cabinets
        let idx = 0;
        setAttractIndex(0);
        attractIntervalRef.current = window.setInterval(() => {
          idx = (idx + 1) % GAMES.length;
          setAttractIndex(idx);
        }, 2000);
      }, 25000);
    };

    resetIdle();

    const events = ["mousemove", "mousedown", "touchstart", "keydown", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdle));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (attractIntervalRef.current) clearInterval(attractIntervalRef.current);
    };
  }, []);

  if (!booted) {
    return (
      <div style={{ background: "var(--crt-bg)", minHeight: "100dvh" }} />
    );
  }

  return (
    <div className={!bootDone ? "crt-boot" : ""} ref={containerRef}>
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
              REFLEX//ARC
            </h1>
            <p
              style={{
                color: "rgba(57, 255, 138, 0.5)",
                fontFamily: "var(--font-body)",
                fontSize: "0.9rem",
                letterSpacing: "0.05em",
              }}
            >
              React. Don't think.
            </p>
          </div>
        </section>

        {/* Game Cabinets Grid */}
        <section className="flex-1 px-4 pb-12 fade-in-delay">
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {GAMES.map((game, i) => (
                <GameTile
                  key={game.id}
                  {...game}
                  attractHighlight={attractIndex === i}
                />
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
