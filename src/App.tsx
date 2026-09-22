import { Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import HubPage from "./pages/hub/HubPage";
import EchoGame from "./pages/games/echo/EchoGame";
import ReflexGame from "./pages/games/reflex/ReflexGame";
import ChromaticGame from "./pages/games/chromatic/ChromaticGame";
import TempoGame from "./pages/games/tempo/TempoGame";
import VectorGame from "./pages/games/vector/VectorGame";
import StroopGame from "./pages/games/stroop/StroopGame";
import GlitchTapGame from "./pages/games/glitch-tap/GlitchTapGame";
import SnakeGame from "./pages/games/snake/SnakeGame";
import Navbar from "./components/Navbar";
import GameViewport from "./components/GameViewport";
import { loadMutePreference } from "./lib/audio-engine";

function GamesLayout({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="flex-1 flex flex-col pt-14 min-h-[100dvh] relative" style={{ fontFamily: "var(--font-body)" }}>
      <Navbar />
      <div className="flex-1 flex flex-col relative w-full h-full">
        <GameViewport accent={accent}>
          {children}
        </GameViewport>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    loadMutePreference();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<HubPage />} />
      <Route
        path="/games/echo"
        element={
          <GamesLayout accent="#00e5ff">
            <EchoGame />
          </GamesLayout>
        }
      />
      <Route
        path="/games/reflex"
        element={
          <GamesLayout accent="#ff3b30">
            <ReflexGame />
          </GamesLayout>
        }
      />
      <Route
        path="/games/chromatic"
        element={
          <GamesLayout accent="#ff2ec4">
            <ChromaticGame />
          </GamesLayout>
        }
      />
      <Route
        path="/games/tempo"
        element={
          <GamesLayout accent="#ffb000">
            <TempoGame />
          </GamesLayout>
        }
      />
      <Route
        path="/games/vector"
        element={
          <GamesLayout accent="#b026ff">
            <VectorGame />
          </GamesLayout>
        }
      />
      <Route
        path="/games/stroop"
        element={
          <GamesLayout accent="#a6ff00">
            <StroopGame />
          </GamesLayout>
        }
      />
      <Route
        path="/games/glitch-tap"
        element={
          <GamesLayout accent="#00a8ff">
            <GlitchTapGame />
          </GamesLayout>
        }
      />
      <Route
        path="/games/snake"
        element={
          <GamesLayout accent="#9bbc0f">
            <SnakeGame />
          </GamesLayout>
        }
      />
    </Routes>
  );
}

export default App;
