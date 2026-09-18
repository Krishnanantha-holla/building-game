import { Routes, Route } from "react-router-dom";
import HubPage from "./pages/hub/HubPage";
import EchoGame from "./pages/games/echo/EchoGame";
import Navbar from "./components/Navbar";

// We need a layout component that matches the Next.js games/layout.tsx
function GamesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col pt-16">
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
    </Routes>
  );
}

export default App;
