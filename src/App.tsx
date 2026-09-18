import { Routes, Route } from "react-router-dom";
import HubPage from "./pages/hub/HubPage";
import EchoGame from "./pages/games/echo/EchoGame";
import ReflexGame from "./pages/games/reflex/ReflexGame";
import ChromaticGame from "./pages/games/chromatic/ChromaticGame";
import TempoGame from "./pages/games/tempo/TempoGame";
import Navbar from "./components/Navbar";

function GamesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col pt-16" style={{ fontFamily: "var(--font-body)" }}>
      <Navbar />
      {children}
    </div>
  );
}

function App() {
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
    </Routes>
  );
}

export default App;
