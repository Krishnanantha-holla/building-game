import { Link } from "react-router-dom";
import GameTile from "@/components/GameTile";
import Navbar from "@/components/Navbar";
import GameViewport from "@/components/GameViewport";

const CLASSIC_GAMES = [
  {
    id: "snake",
    title: "Snake",
    description: "Eat apples, grow longer. Don't bite yourself.",
    icon: "🐍",
    accent: "#9bbc0f",
    href: "/classics/snake",
  },
  {
    id: "minesweeper",
    title: "Minesweeper",
    description: "Clear the board without detonating hidden mines.",
    icon: "💣",
    accent: "rgba(255,255,255,0.4)",
    comingSoon: true,
  },
  {
    id: "solitaire",
    title: "Solitaire",
    description: "Classic Klondike card game. Patience required.",
    icon: "🃏",
    accent: "rgba(255,255,255,0.4)",
    comingSoon: true,
  }
];

export default function ClassicsHub() {
  return (
    <div className="flex-1 flex flex-col pt-14 min-h-[100dvh] relative" style={{ fontFamily: "var(--font-body)" }}>
      <Navbar />
      <div className="flex-1 flex flex-col relative w-full h-full">
        <GameViewport accent="#9bbc0f">
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <h1 
              className="mb-8"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.5rem",
                color: "#9bbc0f",
                letterSpacing: "0.12em",
                textShadow: "0 0 10px rgba(155, 188, 15, 0.5)"
              }}
            >
              CLASSICS
            </h1>
            
            <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {CLASSIC_GAMES.map((game) => (
                <GameTile key={game.id} {...game} />
              ))}
            </div>
            
            <div className="mt-12">
              <Link
                to="/"
                className="py-3 px-6 rounded-xl border border-border text-text-muted font-medium hover:bg-surface-hover hover:text-text transition-all active:scale-95 inline-block"
              >
                ← Back to Arcade
              </Link>
            </div>
          </div>
        </GameViewport>
      </div>
    </div>
  );
}
