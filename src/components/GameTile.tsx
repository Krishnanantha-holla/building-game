"use client";

import { Link } from "react-router-dom";

interface GameTileProps {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  comingSoon?: boolean;
}

export default function GameTile({
  id,
  title,
  description,
  icon,
  color,
  comingSoon = false,
}: GameTileProps) {
  const content = (
    <div
      className={`
        relative rounded-2xl border border-border bg-surface p-6
        transition-all duration-300 ease-out min-h-[140px]
        flex flex-col justify-between overflow-hidden group
        ${comingSoon
          ? "opacity-50 cursor-not-allowed shimmer"
          : "hover:scale-[1.03] hover:border-primary/50 hover:bg-surface-hover cursor-pointer active:scale-[0.98] glow-pulse"
        }
      `}
      style={{
        ["--tile-color" as string]: color,
      }}
    >
      {/* Accent glow in corner */}
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 transition-opacity duration-300 group-hover:opacity-40"
        style={{ background: color }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <span className="text-4xl" role="img" aria-label={title}>
            {icon}
          </span>
          {comingSoon && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-primary/20 text-primary-glow border border-primary/30">
              Soon
            </span>
          )}
        </div>
        <h3 className="text-lg font-bold text-text mb-1">{title}</h3>
        <p className="text-sm text-text-muted leading-relaxed">{description}</p>
      </div>

      {/* Bottom accent bar */}
      <div className="mt-4 flex items-center gap-2">
        <div
          className="h-0.5 flex-1 rounded-full opacity-30"
          style={{ background: `linear-gradient(to right, ${color}, transparent)` }}
        />
        {!comingSoon && (
          <span className="text-xs font-medium text-text-dim group-hover:text-accent transition-colors">
            Play →
          </span>
        )}
      </div>
    </div>
  );

  if (comingSoon) {
    return content;
  }

  return (
    <Link to={`/games/${id}`} className="block no-underline">
      {content}
    </Link>
  );
}
