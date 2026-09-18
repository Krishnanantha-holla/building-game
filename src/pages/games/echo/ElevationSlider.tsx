"use client";

import { useRef, useCallback, useEffect } from "react";

interface ElevationSliderProps {
  elevation: number;
  onElevationChange: (elevation: number) => void;
  actualElevation?: number | null;
  disabled?: boolean;
}

export default function ElevationSlider({
  elevation,
  onElevationChange,
  actualElevation,
  disabled = false,
}: ElevationSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const TRACK_HEIGHT = 200;
  const MIN_ELEVATION = -45;
  const MAX_ELEVATION = 45;

  const elevationToPercent = (elev: number) => {
    return ((MAX_ELEVATION - elev) / (MAX_ELEVATION - MIN_ELEVATION)) * 100;
  };

  const percentToElevation = (percent: number) => {
    return MAX_ELEVATION - (percent / 100) * (MAX_ELEVATION - MIN_ELEVATION);
  };

  const handlePointerMove = useCallback(
    (clientY: number) => {
      if (!trackRef.current || disabled) return;
      const rect = trackRef.current.getBoundingClientRect();
      const relY = clientY - rect.top;
      const percent = Math.max(0, Math.min(100, (relY / rect.height) * 100));
      const elev = percentToElevation(percent);
      onElevationChange(Math.round(elev));
    },
    [disabled, onElevationChange]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      isDraggingRef.current = true;
      handlePointerMove(e.touches[0].clientY);
    },
    [disabled, handlePointerMove]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDraggingRef.current || disabled) return;
      e.preventDefault();
      handlePointerMove(e.touches[0].clientY);
    },
    [disabled, handlePointerMove]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      isDraggingRef.current = true;
      handlePointerMove(e.clientY);
    },
    [disabled, handlePointerMove]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current || disabled) return;
      handlePointerMove(e.clientY);
    },
    [disabled, handlePointerMove]
  );

  const handleEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  useEffect(() => {
    const mouseUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener("mouseup", mouseUp);
    window.addEventListener("touchend", mouseUp);
    return () => {
      window.removeEventListener("mouseup", mouseUp);
      window.removeEventListener("touchend", mouseUp);
    };
  }, []);

  const thumbPercent = elevationToPercent(elevation);
  const actualPercent =
    actualElevation != null ? elevationToPercent(actualElevation) : null;

  return (
    <div className="flex flex-col items-center gap-1" style={{ touchAction: "none" }}>
      <span className="text-[10px] font-semibold text-text-dim uppercase tracking-wider">
        Above
      </span>

      <div
        ref={trackRef}
        className="relative w-10 rounded-full bg-surface border border-border cursor-pointer"
        style={{ height: TRACK_HEIGHT }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
      >
        {/* Center line (level) */}
        <div
          className="absolute left-1 right-1 h-px bg-accent/30"
          style={{ top: "50%" }}
        />

        {/* Actual elevation marker */}
        {actualPercent != null && (
          <div
            className="absolute left-0 right-0 flex justify-center score-pop"
            style={{ top: `${actualPercent}%`, transform: "translateY(-50%)" }}
          >
            <div className="w-8 h-4 rounded-sm bg-danger/80 border border-danger flex items-center justify-center">
              <span className="text-[8px] font-bold text-white">✦</span>
            </div>
          </div>
        )}

        {/* Thumb */}
        <div
          className="absolute left-0 right-0 flex justify-center"
          style={{ top: `${thumbPercent}%`, transform: "translateY(-50%)" }}
        >
          <div
            className="w-9 h-6 rounded-md bg-accent border-2 border-accent-glow flex items-center justify-center shadow-lg"
            style={{
              boxShadow: "0 0 12px rgba(0, 206, 201, 0.5)",
            }}
          >
            <span className="text-[9px] font-bold text-background">
              {elevation > 0 ? "+" : ""}
              {elevation}°
            </span>
          </div>
        </div>
      </div>

      <span className="text-[10px] font-semibold text-text-dim uppercase tracking-wider">
        Below
      </span>
    </div>
  );
}
