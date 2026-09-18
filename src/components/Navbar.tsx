import { Link, useLocation } from "react-router-dom";
import { playBlip, getAudioContext } from "@/lib/audio-engine";

export default function Navbar() {
  const location = useLocation();
  const isGamePage = location.pathname.startsWith("/games/");

  const handleNavClick = () => {
    if (getAudioContext()) {
      playBlip(880, 40);
    }
  };

  return (
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
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
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
              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 500 }}>
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
              INSTINCT
            </span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
