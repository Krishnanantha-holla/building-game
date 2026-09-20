import { Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import HubPage from "./pages/hub/HubPage";
import EchoGame from "./pages/games/echo/EchoGame";
import ReflexGame from "./pages/games/reflex/ReflexGame";
import ChromaticGame from "./pages/games/chromatic/ChromaticGame";
import TempoGame from "./pages/games/tempo/TempoGame";
import VectorGame from "./pages/games/vector/VectorGame";
import Navbar from "./components/Navbar";
import { loadMutePreference } from "./lib/audio-engine";

function GamesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col pt-16" style={{ fontFamily: "var(--font-body)" }}>
      <Navbar />
      {children}
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
          <GamesLayout>
            <EchoGame />
          </GamesLayout>
        }
      />
      <Route
        path="/games/reflex"
        element={
          <GamesLayout>
            <ReflexGame />
          </GamesLayout>
        }
      />
      <Route
        path="/games/chromatic"
        element={
          <GamesLayout>
            <ChromaticGame />
          </GamesLayout>
        }
      />
      <Route
        path="/games/tempo"
        element={
          <GamesLayout>
            <TempoGame />
          </GamesLayout>
        }
      />
      <Route
        path="/games/vector"
        element={
          <GamesLayout>
            <VectorGame />
          </GamesLayout>
        }
      />
    </Routes>
  );
}

export default App;
