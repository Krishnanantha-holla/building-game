"use client";

import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();
  const isGamePage = location.pathname.startsWith("/games/");

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass"
         style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isGamePage && (
            <Link
              to="/"
              className="flex items-center gap-1 text-text-muted hover:text-text transition-colors duration-200 mr-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Arcade</span>
            </Link>
          )}
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-xl font-extrabold tracking-wider gradient-text group-hover:opacity-80 transition-opacity">
              INSTINCT
            </span>
            <span className="text-xs font-medium text-text-dim uppercase tracking-widest">
              Arcade
            </span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
