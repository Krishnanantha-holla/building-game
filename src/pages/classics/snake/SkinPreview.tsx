import { useEffect, useRef } from "react";
import { drawFluidSnake } from "./SnakeEngine";

type Skin = "Classic" | "Neon" | "Retro Pixel" | "Monochrome" | "Sunset" | "Matrix";

export function SkinPreview({ skin }: { skin: Skin }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    const boardWidth = 10;
    const boardHeight = 4;
    const cellSize = width / boardWidth;
    
    // Clear background
    ctx.fillStyle = skin === "Retro Pixel" ? "#9ca3af" : "#000000";
    ctx.fillRect(0, 0, width, height);
    
    const dummySnake = [
      { x: 5, y: 1 }, { x: 4, y: 1 }, { x: 3, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }
    ];
    const dummyApple = { x: 7, y: 1 };
    
    // Draw Snake
    drawFluidSnake(ctx, dummySnake, dummySnake, 1, cellSize, skin, boardWidth, boardHeight);
    
    // Draw Apple (we can just draw an emoji or standard apple)
    ctx.font = `${cellSize * 0.8}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🍎", dummyApple.x * cellSize + cellSize/2, dummyApple.y * cellSize + cellSize/2);
    
  }, [skin]);
  
  return (
    <canvas 
      ref={canvasRef} 
      width={200} 
      height={80} 
      className="w-full h-full object-contain"
    />
  );
}
