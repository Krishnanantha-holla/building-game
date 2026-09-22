export interface Point {
  x: number;
  y: number;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function drawFluidSnake(
  ctx: CanvasRenderingContext2D,
  prevSnake: Point[],
  currSnake: Point[],
  progress: number,
  cellSize: number,
  skin: string,
  boardWidth: number,
  boardHeight: number
) {
  if (currSnake.length === 0) return;

  const points: { x: number; y: number }[] = [];
  
  for (let i = 0; i < currSnake.length; i++) {
    const curr = currSnake[i];
    const prev = i < prevSnake.length ? prevSnake[i] : prevSnake[prevSnake.length - 1];
    
    let vx = curr.x;
    let vy = curr.y;
    
    if (prev) {
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
        vx = lerp(prev.x, curr.x, progress);
        vy = lerp(prev.y, curr.y, progress);
      } else {
        if (dx > 1) { 
          vx = lerp(prev.x, curr.x + boardWidth, progress) % boardWidth;
        } else if (dx < -1) { 
          vx = lerp(prev.x, curr.x - boardWidth, progress);
          if (vx < 0) vx += boardWidth;
        } else if (dy > 1) {
          vy = lerp(prev.y, curr.y + boardHeight, progress) % boardHeight;
        } else if (dy < -1) {
          vy = lerp(prev.y, curr.y - boardHeight, progress);
          if (vy < 0) vy += boardHeight;
        }
      }
    }
    
    points.push({
      x: vx * cellSize + cellSize / 2,
      y: vy * cellSize + cellSize / 2
    });
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  
  if (skin === "Neon") {
    ctx.strokeStyle = "#06b6d4";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#06b6d4";
  } else if (skin === "Sunset") {
    const grad = ctx.createLinearGradient(0, 0, boardWidth * cellSize, boardHeight * cellSize);
    grad.addColorStop(0, "#ff7e5f");
    grad.addColorStop(1, "#feb47b");
    ctx.strokeStyle = grad;
    ctx.shadowBlur = 0;
  } else if (skin === "Monochrome") {
    ctx.strokeStyle = "#10b981";
    ctx.shadowBlur = 0;
  } else {
    ctx.strokeStyle = "#22c55e";
    ctx.shadowBlur = 0;
  }
  
  if (skin === "Retro Pixel") {
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
  }

  ctx.lineWidth = cellSize * 0.8;
  
  if (skin === "Matrix") {
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = cellSize * 0.7;
    if (points.length === 1) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[0].x + 0.1, points[0].y);
      ctx.stroke();
    } else {
      for (let i = 0; i < points.length - 1; i++) {
        ctx.beginPath();
        
        const p1 = points[i];
        const p2 = points[i+1];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        
        if (dist < cellSize * 2) {
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.globalAlpha = 1 - (i / points.length);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1.0;
  } else {
    ctx.beginPath();
    
    let lastP = points[0];
    ctx.moveTo(lastP.x, lastP.y);
    
    if (points.length === 1) {
      // If snake is only 1 block long, draw a tiny line so lineCap renders a dot
      ctx.lineTo(lastP.x + 0.1, lastP.y);
    } else {
      for (let i = 1; i < points.length; i++) {
        const p = points[i];
        const dist = Math.hypot(p.x - lastP.x, p.y - lastP.y);
        if (dist > cellSize * 2) {
          ctx.moveTo(p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }
        lastP = p;
      }
    }
    ctx.stroke();
  }

  if (skin !== "Retro Pixel" && skin !== "Matrix") {
    ctx.shadowBlur = 0; 
    const head = points[0];
    let dx = 0;
    let dy = 0;
    if (points.length > 1) {
      dx = points[0].x - points[1].x;
      dy = points[0].y - points[1].y;
      
      // If distance is too large (wrapping), fallback to previous dx/dy or default
      const dist = Math.hypot(dx, dy);
      if (dist > cellSize * 2 || dist < 0.001) {
        dx = 1; dy = 0; 
      } else {
        dx /= dist;
        dy /= dist;
      }
    } else {
      dx = 1; dy = 0;
    }
    
    const nx = -dy;
    const ny = dx;
    
    const eyeOffset = cellSize * 0.25;
    const eyeForward = cellSize * 0.1;
    
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(head.x + dx * eyeForward + nx * eyeOffset, head.y + dy * eyeForward + ny * eyeOffset, cellSize * 0.15, 0, Math.PI * 2);
    ctx.arc(head.x + dx * eyeForward - nx * eyeOffset, head.y + dy * eyeForward - ny * eyeOffset, cellSize * 0.15, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(head.x + dx * (eyeForward + 2) + nx * eyeOffset, head.y + dy * (eyeForward + 2) + ny * eyeOffset, cellSize * 0.07, 0, Math.PI * 2);
    ctx.arc(head.x + dx * (eyeForward + 2) - nx * eyeOffset, head.y + dy * (eyeForward + 2) - ny * eyeOffset, cellSize * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
}
