import { Link } from "react-router-dom";
import { playBlip, getAudioContext } from "@/lib/audio-engine";

interface GameTileProps {
  id: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
  comingSoon?: boolean;
  attractHighlight?: boolean;
  href?: string;
}

export default function GameTile({
  id,
  title,
  description,
  icon,
  accent,
  comingSoon = false,
  attractHighlight = false,
  href,
}: GameTileProps) {
  const handleHover = () => {
    if (getAudioContext()) {
      playBlip(660, 30);
    }
  };

  const handleFocus = () => {
    if (getAudioContext()) {
      playBlip(660, 30);
    }
  };

  const content = (
    <div
      className={`cabinet ${comingSoon ? "cabinet-dim" : "cabinet-lit"}`}
      style={{
        ["--cabinet-accent" as string]: accent,
        // Attract mode: pulse glow when highlighted
        ...(attractHighlight && !comingSoon
          ? {
              boxShadow: `0 0 30px -3px ${accent}, 0 0 60px -10px ${accent}50`,
              borderColor: `color-mix(in srgb, ${accent} 60%, var(--color-border))`,
              transition: "box-shadow 0.8s ease, border-color 0.8s ease",
            }
          : {}),
      }}
      onMouseEnter={comingSoon ? undefined : handleHover}
      onFocus={comingSoon ? undefined : handleFocus}
      tabIndex={comingSoon ? -1 : 0}
      role={comingSoon ? "presentation" : "link"}
      aria-label={comingSoon ? `${title} — coming soon` : `Play ${title}`}
    >
      {/* Marquee Title Bar */}
      <div
        className="cabinet-marquee"
        style={{
          background: comingSoon
            ? "rgba(255,255,255,0.03)"
            : `linear-gradient(135deg, ${accent}22, ${accent}11)`,
          borderBottom: `1px solid ${comingSoon ? "rgba(255,255,255,0.05)" : accent + "33"}`,
        }}
      >
        <span className="cabinet-marquee-icon">{icon}</span>
        <span
          className="cabinet-marquee-title"
          style={{
            color: comingSoon ? "rgba(255,255,255,0.2)" : accent,
          }}
        >
          {title}
        </span>
      </div>

      {/* Screen Area */}
      <div className="cabinet-screen">
        <p
          className="cabinet-description"
          style={{
            color: comingSoon ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)",
          }}
        >
          {description}
        </p>

        {/* CTA or locked state */}
        {!comingSoon && (
          <div className="cabinet-cta">
            <span
              className="blink-prompt"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "0.6rem",
                color: accent,
                letterSpacing: "0.1em",
              }}
            >
              PRESS START
            </span>
          </div>
        )}

        {/* Static noise overlay for locked cabinets */}
        {comingSoon && <div className="cabinet-static" aria-hidden="true" />}
      </div>
    </div>
  );

  if (comingSoon) {
    return content;
  }

  return (
    <Link
      to={href || `/games/${id}`}
      className="block no-underline focus-visible:outline-none"
      style={{ ["--cabinet-accent" as string]: accent }}
    >
      {content}
    </Link>
  );
}
