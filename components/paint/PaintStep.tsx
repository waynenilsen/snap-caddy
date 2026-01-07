"use client";

import { Eraser, Paintbrush, Redo2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface PaintStepProps {
  imageUrl: string;
  onPaintingComplete: (mask: ImageData) => void;
}

interface HistoryEntry {
  imageData: ImageData;
}

export function PaintStep({ imageUrl, onPaintingComplete }: PaintStepProps) {
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isEmpty, setIsEmpty] = useState(true);

  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load image and initialize canvases
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = () => {
      const container = containerRef.current;
      if (!container) return;

      // Calculate canvas size to fit container while maintaining aspect ratio
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const imgAspect = img.width / img.height;
      const containerAspect = containerWidth / containerHeight;

      let width: number, height: number;
      if (imgAspect > containerAspect) {
        width = containerWidth;
        height = containerWidth / imgAspect;
      } else {
        height = containerHeight;
        width = containerHeight * imgAspect;
      }

      setCanvasSize({ width, height });

      // Draw image on background canvas
      const bgCanvas = backgroundCanvasRef.current;
      if (bgCanvas) {
        const bgCtx = bgCanvas.getContext("2d");
        if (bgCtx) {
          bgCanvas.width = width;
          bgCanvas.height = height;
          bgCtx.drawImage(img, 0, 0, width, height);
        }
      }

      // Initialize paint canvas
      const paintCanvas = paintCanvasRef.current;
      if (paintCanvas) {
        const paintCtx = paintCanvas.getContext("2d");
        if (paintCtx) {
          paintCanvas.width = width;
          paintCanvas.height = height;
          paintCtx.clearRect(0, 0, width, height);

          // Save initial empty state to history
          const initialImageData = paintCtx.getImageData(0, 0, width, height);
          setHistory([{ imageData: initialImageData }]);
          setHistoryIndex(0);
        }
      }
    };

    img.onerror = () => {
      console.error("Failed to load image:", imageUrl);
    };
  }, [imageUrl]);

  // Check if the canvas has any painted content
  const checkIfEmpty = useCallback((imageData: ImageData) => {
    const data = imageData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) {
        setIsEmpty(false);
        return;
      }
    }
    setIsEmpty(true);
  }, []);

  // Save current state to history
  const saveToHistory = useCallback(() => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Remove any "future" history if we're not at the end
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ imageData });

    // Limit history to 50 entries to prevent memory issues
    if (newHistory.length > 50) {
      newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    } else {
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }

    // Check if canvas is empty
    checkIfEmpty(imageData);
  }, [history, historyIndex, checkIfEmpty]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;

    const canvas = paintCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newIndex = historyIndex - 1;
    const entry = history[newIndex];
    ctx.putImageData(entry.imageData, 0, 0);
    setHistoryIndex(newIndex);
    checkIfEmpty(entry.imageData);
  }, [history, historyIndex, checkIfEmpty]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    const canvas = paintCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newIndex = historyIndex + 1;
    const entry = history[newIndex];
    ctx.putImageData(entry.imageData, 0, 0);
    setHistoryIndex(newIndex);
    checkIfEmpty(entry.imageData);
  }, [history, historyIndex, checkIfEmpty]);

  // Start Over
  const handleStartOver = useCallback(() => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
    setIsEmpty(true);
  }, [saveToHistory]);

  // Get mouse position relative to canvas
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Draw a circle at the given position
  const drawCircle = useCallback(
    (x: number, y: number) => {
      const canvas = paintCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    },
    [brushSize],
  );

  // Draw a line between two points (for smooth painting)
  const drawLine = useCallback(
    (x1: number, y1: number, x2: number, y2: number) => {
      const canvas = paintCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const steps = Math.max(1, Math.ceil(distance / (brushSize / 4)));

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        drawCircle(x, y);
      }
    },
    [brushSize, drawCircle],
  );

  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const pos = getMousePos(e);
    lastPosRef.current = pos;
    drawCircle(pos.x, pos.y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const pos = getMousePos(e);
    if (lastPosRef.current) {
      drawLine(lastPosRef.current.x, lastPosRef.current.y, pos.x, pos.y);
    }
    lastPosRef.current = pos;
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPosRef.current = null;
      saveToHistory();
    }
  };

  const handleMouseLeave = () => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPosRef.current = null;
      saveToHistory();
    }
  };

  const handleConfirm = () => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const maskImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    onPaintingComplete(maskImageData);
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Top Toolbar */}
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Paintbrush className="h-4 w-4" />
            <span className="text-sm font-medium">Brush Size:</span>
          </div>
          <div className="flex flex-1 items-center gap-4">
            <Slider
              value={[brushSize]}
              onValueChange={(value) => setBrushSize(value[0])}
              min={5}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="w-12 text-sm text-muted-foreground">
              {brushSize}px
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo"
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo"
          >
            <Redo2 className="mr-2 h-4 w-4" />
            Redo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartOver}
            disabled={isEmpty}
            title="Start Over"
          >
            <Eraser className="mr-2 h-4 w-4" />
            Start Over
          </Button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden rounded-lg border bg-muted"
      >
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
          }}
        >
          {/* Background Image Canvas */}
          <canvas
            ref={backgroundCanvasRef}
            className="absolute left-0 top-0"
            style={{
              width: canvasSize.width,
              height: canvasSize.height,
            }}
          />
          {/* Paint Overlay Canvas */}
          <canvas
            ref={paintCanvasRef}
            className="absolute left-0 top-0 cursor-crosshair"
            style={{
              width: canvasSize.width,
              height: canvasSize.height,
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          />
          {/* Brush Preview Cursor */}
          {isDrawing && (
            <div
              className="pointer-events-none absolute rounded-full border-2 border-white opacity-50"
              style={{
                width: brushSize,
                height: brushSize,
                left: lastPosRef.current
                  ? lastPosRef.current.x - brushSize / 2
                  : 0,
                top: lastPosRef.current
                  ? lastPosRef.current.y - brushSize / 2
                  : 0,
              }}
            />
          )}
        </div>
      </div>

      {/* Bottom Confirm Button */}
      <div className="flex justify-end">
        <Button onClick={handleConfirm} disabled={isEmpty} size="lg">
          Confirm Selection
        </Button>
      </div>
    </div>
  );
}
