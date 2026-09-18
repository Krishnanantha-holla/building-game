import Navbar from "@/components/Navbar";
import GameTile from "@/components/GameTile";

const GAMES = [
  {
    id: "echo",
    title: "Echo",
    description: "Locate sounds in 3D space — where is the ping coming from?",
    icon: "🎯",
    color: "#00cec9",
  },
  {
    id: "reflex",
    title: "Reflex",
    description: "Test your reaction speed with split-second challenges",
    icon: "⚡",
    color: "#feca57",
    comingSoon: true,
  },
  {
    id: "chromatic",
    title: "Chromatic",
    description: "Match colors from memory before they fade away",
    icon: "🎨",
    color: "#ff6b6b",
    comingSoon: true,
  },
  {
    id: "tempo",
    title: "Tempo",
    description: "Feel the rhythm, keep the beat — timing is everything",
    icon: "🥁",
    color: "#a29bfe",
    comingSoon: true,
  },
];

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="pt-24 pb-8 px-4 text-center fade-in">
          <div className="max-w-2xl mx-auto">
            {/* Decorative rings */}
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 rounded-full border border-primary/20 ring-pulse" />
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl shadow-lg shadow-primary/30">
                🧠
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
              <span className="gradient-text">INSTINCT</span>
            </h1>
            <p className="text-lg sm:text-xl text-text-muted font-light leading-relaxed max-w-md mx-auto">
              Test your senses. Trust your instincts.
            </p>
            <p className="text-sm text-text-dim mt-2">
              Quick-fire sensory mini-games for sharp minds
            </p>
          </div>
        </section>

        {/* Games Grid */}
        <section className="flex-1 px-4 pb-12 fade-in-delay">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-text-dim">
                Games
              </h2>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-text-dim">
                {GAMES.filter((g) => !g.comingSoon).length} playable
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {GAMES.map((game) => (
                <GameTile key={game.id} {...game} />
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-6 text-center">
          <p className="text-xs text-text-dim">
            More games coming soon · Built with 🎮 by instinct
          </p>
        </footer>
      </main>
    </>
  );
}
