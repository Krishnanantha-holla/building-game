interface GameIntroProps {
  gameName: string;
  description: string;
  hint: string;
  accentColor: string;
  onStart: () => void;
}

export default function GameIntro({
  gameName,
  description,
  hint,
  accentColor,
  onStart,
}: GameIntroProps) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-6 fade-in"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.3rem, 5vw, 2.2rem)",
          color: accentColor,
          letterSpacing: "0.08em",
          marginBottom: "1.25rem",
          textShadow: `0 0 20px color-mix(in srgb, ${accentColor} 50%, transparent)`,
          textTransform: "uppercase",
        }}
      >
        {gameName}
      </h1>
      <p
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: "0.85rem",
          textAlign: "center",
          marginBottom: "0.5rem",
          maxWidth: "300px",
          lineHeight: "1.6",
        }}
      >
        {description}
      </p>
      <p
        style={{
          color: "rgba(255,255,255,0.35)",
          fontSize: "0.7rem",
          textAlign: "center",
          marginBottom: "2.5rem",
          maxWidth: "300px",
          fontStyle: "italic",
        }}
      >
        {hint}
      </p>

      <button
        onClick={onStart}
        className="blink-prompt focus-visible:outline-none rounded"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "0.65rem",
          color: accentColor,
          letterSpacing: "0.12em",
          padding: "1rem 2rem",
          border: `2px solid ${accentColor}`,
          background: "transparent",
          cursor: "pointer",
          outline: "none",
        }}
        onFocus={(e) => {
          (e.target as HTMLElement).style.boxShadow = `0 0 0 2px ${accentColor}, 0 0 15px ${accentColor}`;
        }}
        onBlur={(e) => {
          (e.target as HTMLElement).style.boxShadow = "none";
        }}
        aria-label="Start game"
      >
        PRESS START
      </button>
    </div>
  );
}
