import type { CSSProperties } from "react";

type Skin = "Classic" | "Neon" | "Retro Pixel" | "Monochrome" | "Sunset" | "Matrix";

export function getSnakeSegmentStyle(skin: Skin, index: number, length: number): CSSProperties {
  const isHead = index === 0;
  
  switch (skin) {
    case "Classic":
      return {
        backgroundColor: "#22c55e",
        border: "1px solid rgba(0,0,0,0.2)"
      };
    case "Neon":
      return {
        backgroundColor: isHead ? "#67e8f9" : "#06b6d4",
        boxShadow: `0 0 ${isHead ? 10 : 5}px #06b6d4`,
        borderRadius: isHead ? "4px" : "2px"
      };
    case "Retro Pixel":
      return {
        backgroundColor: "#fff",
        border: "2px solid #000",
        imageRendering: "pixelated"
      };
    case "Monochrome":
      return {
        backgroundColor: "#10b981",
        opacity: isHead ? 1 : 0.7,
        borderRadius: "2px"
      };
    case "Sunset": {
      // gradient from orange to pink
      const ratio = length > 1 ? index / (length - 1) : 0;
      // interpolate between orange (ff7e5f) and pink (feb47b)
      // Actually CSS linear-gradient per segment is hard, let's just use RGB interpolation
      const r = Math.round(255 - ratio * (255 - 254));
      const g = Math.round(126 + ratio * (180 - 126));
      const b = Math.round(95 + ratio * (123 - 95));
      return {
        backgroundColor: `rgb(${r}, ${g}, ${b})`,
        borderRadius: "4px"
      };
    }
    case "Matrix":
      return {
        backgroundColor: "#22c55e",
        opacity: 1 - (index / Math.max(length, 5)) * 0.8,
        fontFamily: "monospace",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: "8px"
      };
    default:
      return {};
  }
}

export function getAppleStyle(skin: Skin): CSSProperties {
  switch (skin) {
    case "Classic":
      return { backgroundColor: "#ef4444", borderRadius: "50%" };
    case "Neon":
      return { backgroundColor: "#d946ef", boxShadow: "0 0 10px #d946ef", borderRadius: "50%" };
    case "Retro Pixel":
      return { backgroundColor: "#fff", border: "2px dashed #000", imageRendering: "pixelated" };
    case "Monochrome":
      return { backgroundColor: "#10b981", borderRadius: "0", transform: "rotate(45deg)" };
    case "Sunset":
      return { backgroundColor: "#fde047", borderRadius: "50%" };
    case "Matrix":
      return { backgroundColor: "#4ade80", borderRadius: "2px" };
    default:
      return {};
  }
}

export function getBoardStyle(skin: Skin): CSSProperties {
  switch (skin) {
    case "Retro Pixel": return { backgroundColor: "#9ca3af" };
    default: return { backgroundColor: "#000" };
  }
}

export function SkinPreview({ skin }: { skin: Skin }) {
  const dummySnake = [
    { x: 5, y: 1 }, { x: 4, y: 1 }, { x: 3, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }
  ];
  const dummyApple = { x: 7, y: 1 };
  const boardWidth = 10;
  const boardHeight = 4;
  
  return (
    <div className="w-full h-full relative" style={getBoardStyle(skin)}>
      {dummySnake.map((segment, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${(segment.x / boardWidth) * 100}%`,
            top: `${(segment.y / boardHeight) * 100}%`,
            width: `${100 / boardWidth}%`,
            height: `${100 / boardHeight}%`,
            ...getSnakeSegmentStyle(skin, i, dummySnake.length)
          }}
        >
          {skin === "Matrix" && (i % 2 === 0 ? "1" : "0")}
        </div>
      ))}
      <div
        className="absolute"
        style={{
          left: `${(dummyApple.x / boardWidth) * 100}%`,
          top: `${(dummyApple.y / boardHeight) * 100}%`,
          width: `${100 / boardWidth}%`,
          height: `${100 / boardHeight}%`,
          transform: skin === "Classic" || skin === "Sunset" ? "scale(0.7)" : (skin === "Monochrome" ? "scale(0.6) rotate(45deg)" : "scale(0.8)"),
          ...getAppleStyle(skin)
        }}
      />
    </div>
  );
}
