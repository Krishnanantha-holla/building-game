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
  nextDirection: Point,
  progress: number,
  cellSize: number,
  skin: string,
  boardWidth: number,
  boardHeight: number
) {
  if (currSnake.length === 0) return;

  const points: { x: number; y: number }[] = [];
  
  // 1. Extrapolated Head (Instant zero-latency response)
  const currHead = currSnake[0];
  const exHeadX = currHead.x + nextDirection.x * progress;
  const exHeadY = currHead.y + nextDirection.y * progress;
  points.push({ x: exHeadX * cellSize + cellSize / 2, y: exHeadY * cellSize + cellSize / 2 });

  // 2. Fixed grid centers of the body
  for (let i = 0; i < currSnake.length; i++) {
    points.push({ x: currSnake[i].x * cellSize + cellSize / 2, y: currSnake[i].y * cellSize + cellSize / 2 });
  }

  // 3. Shrunk Tail (unless growing)
  const isGrowing = currSnake.length > prevSnake.length;
  if (currSnake.length > 1) {
    const currTail = currSnake[currSnake.length - 1];
    let tx = currTail.x;
    let ty = currTail.y;
    
    if (!isGrowing) {
      const targetTail = currSnake[currSnake.length - 2];
      if (Math.abs(currTail.x - targetTail.x) <= 1 && Math.abs(currTail.y - targetTail.y) <= 1) {
        tx = lerp(currTail.x, targetTail.x, progress);
        ty = lerp(currTail.y, targetTail.y, progress);
      }
    }
    points[points.length - 1] = { x: tx * cellSize + cellSize / 2, y: ty * cellSize + cellSize / 2 };
  } else {
    // Length 1: The tail just follows the head interpolation
    points[points.length - 1] = { x: exHeadX * cellSize + cellSize / 2, y: exHeadY * cellSize + cellSize / 2 };
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

  // Draw Eyes
  if (skin !== "Retro Pixel" && skin !== "Matrix") {
    ctx.shadowBlur = 0; 
    const head = points[0];
    let dx = nextDirection.x;
    let dy = nextDirection.y;
    
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) { dx = 1; dy = 0; } 
    else { dx /= dist; dy /= dist; }
    
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
