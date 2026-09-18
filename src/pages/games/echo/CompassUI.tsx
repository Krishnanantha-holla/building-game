
import { useRef, useCallback, useEffect } from "react";

interface CompassUIProps {
  angle: number;
  onAngleChange: (angle: number) => void;
  actualAngle?: number | null;
  disabled?: boolean;
  showSweep?: boolean;
}

export default function CompassUI({
  angle,
  onAngleChange,
  actualAngle,
  disabled = false,
  showSweep = true,
}: CompassUIProps) {
  const compassRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef(false);

  const SIZE = 280;
  const CENTER = SIZE / 2;
  const OUTER_R = 125;
  const POINTER_R = 12;
  const RING_WIDTHS = [125, 100, 75, 50, 25];

  const angleToXY = useCallback(
    (deg: number, radius: number) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return {
        x: CENTER + Math.cos(rad) * radius,
        y: CENTER + Math.sin(rad) * radius,
      };
    },
    [CENTER]
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!compassRef.current || disabled) return;
      const rect = compassRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      let a = Math.atan2(dx, -dy) * (180 / Math.PI);
      if (a < 0) a += 360;
      onAngleChange(Math.round(a * 10) / 10);
    },
    [disabled, onAngleChange]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      isDraggingRef.current = true;
      const touch = e.touches[0];
      handlePointerMove(touch.clientX, touch.clientY);
    },
    [disabled, handlePointerMove]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDraggingRef.current || disabled) return;
      e.preventDefault();
      const touch = e.touches[0];
      handlePointerMove(touch.clientX, touch.clientY);
    },
    [disabled, handlePointerMove]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      isDraggingRef.current = true;
      handlePointerMove(e.clientX, e.clientY);
    },
    [disabled, handlePointerMove]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current || disabled) return;
      handlePointerMove(e.clientX, e.clientY);
    },
    [disabled, handlePointerMove]
  );

  const handleEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Global mouse up listener
  useEffect(() => {
    const handler = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener("mouseup", handler);
    window.addEventListener("touchend", handler);
    return () => {
      window.removeEventListener("mouseup", handler);
      window.removeEventListener("touchend", handler);
    };
  }, []);

  const guessPos = angleToXY(angle, OUTER_R);

  // Angular error arc
  let errorArc = null;
  let actualPos = null;
  if (actualAngle != null) {
    actualPos = angleToXY(actualAngle, OUTER_R);

    let error = Math.abs(angle - actualAngle);
    if (error > 180) error = 360 - error;

    const startAngle = Math.min(angle, actualAngle);
    const endAngle = Math.max(angle, actualAngle);
    const diff = endAngle - startAngle;
    const useStart = diff <= 180 ? startAngle : endAngle;
    const useEnd = diff <= 180 ? endAngle : startAngle + 360;
    const sweep = diff <= 180 ? diff : 360 - diff;

    if (sweep > 0) {
      const startPos = angleToXY(useStart, OUTER_R - 15);
      const endPos = angleToXY(useEnd, OUTER_R - 15);
      const largeArc = sweep > 180 ? 1 : 0;

      const errorColor =
        error < 20 ? "#55efc4" : error < 45 ? "#feca57" : "#ff6b6b";

      errorArc = (
        <path
          d={`M ${startPos.x} ${startPos.y} A ${OUTER_R - 15} ${
            OUTER_R - 15
          } 0 ${largeArc} 1 ${endPos.x} ${endPos.y}`}
          fill="none"
          stroke={errorColor}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.7"
        />
      );
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        ref={compassRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="select-none"
        style={{ touchAction: "none", maxWidth: "80vw", maxHeight: "80vw" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
      >
        {/* Background */}
        <circle cx={CENTER} cy={CENTER} r={OUTER_R + 10} fill="#0a0b1e" />

        {/* Concentric rings */}
        {RING_WIDTHS.map((r, i) => (
          <circle
            key={i}
            cx={CENTER}
            cy={CENTER}
            r={r}
            fill="none"
            stroke="rgba(0, 206, 201, 0.12)"
            strokeWidth="1"
          />
        ))}

        {/* Cross hairs */}
        <line
          x1={CENTER}
          y1={CENTER - OUTER_R}
          x2={CENTER}
          y2={CENTER + OUTER_R}
          stroke="rgba(0, 206, 201, 0.08)"
          strokeWidth="1"
        />
        <line
          x1={CENTER - OUTER_R}
          y1={CENTER}
          x2={CENTER + OUTER_R}
          y2={CENTER}
          stroke="rgba(0, 206, 201, 0.08)"
          strokeWidth="1"
        />

        {/* 45° lines */}
        {[45, 135, 225, 315].map((d) => {
          const p1 = angleToXY(d, 20);
          const p2 = angleToXY(d, OUTER_R);
          return (
            <line
              key={d}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="rgba(0, 206, 201, 0.05)"
              strokeWidth="1"
            />
          );
        })}

        {/* Sonar sweep */}
        {showSweep && !actualAngle && (
          <g className="sonar-sweep" style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}>
            <defs>
              <linearGradient
                id="sweepGrad"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="rgba(0, 206, 201, 0)" />
                <stop offset="100%" stopColor="rgba(0, 206, 201, 0.3)" />
              </linearGradient>
            </defs>
            <line
              x1={CENTER}
              y1={CENTER}
              x2={CENTER}
              y2={CENTER - OUTER_R}
              stroke="url(#sweepGrad)"
              strokeWidth="2"
            />
            {/* Sweep trail */}
            <path
              d={`M ${CENTER} ${CENTER} L ${CENTER} ${CENTER - OUTER_R} A ${OUTER_R} ${OUTER_R} 0 0 1 ${
                CENTER + OUTER_R * Math.sin((30 * Math.PI) / 180)
              } ${CENTER - OUTER_R * Math.cos((30 * Math.PI) / 180)} Z`}
              fill="rgba(0, 206, 201, 0.04)"
            />
          </g>
        )}

        {/* Error arc */}
        {errorArc}

        {/* Actual position marker (feedback mode) */}
        {actualPos && (
          <>
            {/* Line from center to actual */}
            <line
              x1={CENTER}
              y1={CENTER}
              x2={actualPos.x}
              y2={actualPos.y}
              stroke="#ff6b6b"
              strokeWidth="2"
              strokeDasharray="4 4"
              opacity="0.6"
            />
            {/* Actual dot */}
            <circle
              cx={actualPos.x}
              cy={actualPos.y}
              r={POINTER_R - 2}
              fill="#ff6b6b"
              stroke="#ff8787"
              strokeWidth="2"
              className="score-pop"
            />
            <text
              x={actualPos.x}
              y={actualPos.y + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize="8"
              fontWeight="700"
            >
              ✦
            </text>
          </>
        )}

        {/* Guess pointer */}
        <>
          {/* Line from center to guess */}
          <line
            x1={CENTER}
            y1={CENTER}
            x2={guessPos.x}
            y2={guessPos.y}
            stroke="rgba(0, 206, 201, 0.4)"
            strokeWidth="2"
          />
          {/* Guess dot */}
          <circle
            cx={guessPos.x}
            cy={guessPos.y}
            r={POINTER_R}
            fill="#00cec9"
            stroke="#55efc4"
            strokeWidth="2.5"
            className={disabled ? "" : "drop-shadow-lg"}
            style={{
              filter: disabled
                ? "none"
                : "drop-shadow(0 0 8px rgba(0, 206, 201, 0.6))",
            }}
          />
          <text
            x={guessPos.x}
            y={guessPos.y + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize="9"
            fontWeight="700"
          >
            ⊕
          </text>
        </>

        {/* Center dot */}
        <circle cx={CENTER} cy={CENTER} r={4} fill="#00cec9" opacity="0.6" />
        <circle cx={CENTER} cy={CENTER} r={2} fill="white" opacity="0.8" />

        {/* Cardinal labels */}
        {[
          { label: "N", deg: 0 },
          { label: "E", deg: 90 },
          { label: "S", deg: 180 },
          { label: "W", deg: 270 },
        ].map(({ label, deg }) => {
          const pos = angleToXY(deg, OUTER_R + 18);
          return (
            <text
              key={label}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="rgba(0, 206, 201, 0.6)"
              fontSize="12"
              fontWeight="600"
              fontFamily="var(--font-outfit), system-ui"
            >
              {label}
            </text>
          );
        })}

        {/* Degree tick marks */}
        {Array.from({ length: 36 }, (_, i) => i * 10).map((d) => {
          const isMajor = d % 90 === 0;
          const innerR = isMajor ? OUTER_R - 8 : OUTER_R - 4;
          const p1 = angleToXY(d, innerR);
          const p2 = angleToXY(d, OUTER_R);
          return (
            <line
              key={d}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={
                isMajor
                  ? "rgba(0, 206, 201, 0.4)"
                  : "rgba(0, 206, 201, 0.15)"
              }
              strokeWidth={isMajor ? 2 : 1}
            />
          );
        })}
      </svg>

      {/* Angle readout */}
      <div className="text-center">
        <span className="text-2xl font-bold text-accent tabular-nums">
          {Math.round(angle)}°
        </span>
        {actualAngle != null && (
          <span className="text-sm text-text-muted ml-2">
            (actual: {Math.round(actualAngle)}°)
          </span>
        )}
      </div>
    </div>
  );
}
