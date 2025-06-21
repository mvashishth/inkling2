
"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { cn } from '@/lib/utils';

// --- Types ---
interface Point {
  x: number;
  y: number;
}

export interface DrawingCanvasRef {
  exportAsDataURL: () => string | undefined;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  loadImage: (dataUrl: string) => void;
}

interface DrawingCanvasProps {
  tool: 'draw' | 'erase' | 'highlight' | null;
  penColor: string;
  penSize: number;
  eraserSize: number;
  highlighterSize: number;
  onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
}

// --- Component ---
export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ tool, penColor, penSize, eraserSize, highlighterSize, onHistoryChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);
    const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
    const backgroundContextRef = useRef<CanvasRenderingContext2D | null>(null);
    const backgroundImageRef = useRef<HTMLImageElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const lastPointRef = useRef<Point | null>(null);
    const hasMovedRef = useRef(false);

    // Refs for highlighter tool to prevent opacity buildup
    const preStrokeImageDataRef = useRef<ImageData | null>(null);
    const currentPathRef = useRef<Path2D | null>(null);

    const historyRef = useRef<ImageData[]>([]);
    const historyIndexRef = useRef<number>(-1);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.touchAction = tool ? 'none' : 'auto';
        }
    }, [tool]);

    const saveState = useCallback(() => {
      if (!canvasRef.current || !contextRef.current) return;
      const canvas = canvasRef.current;
      const imageData = contextRef.current.getImageData(0, 0, canvas.width, canvas.height);
      
      historyRef.current.splice(historyIndexRef.current + 1);
      historyRef.current.push(imageData);
      historyIndexRef.current = historyRef.current.length - 1;

      onHistoryChange(historyIndexRef.current > 0, false);
    }, [onHistoryChange]);

    const restoreState = useCallback((index: number) => {
      if (!contextRef.current || !historyRef.current[index]) return;
      contextRef.current.putImageData(historyRef.current[index], 0, 0);
    }, []);
    
    // --- Setup and Resize ---
    useEffect(() => {
      const canvas = canvasRef.current;
      const backgroundCanvas = backgroundCanvasRef.current;
      const container = containerRef.current;
      if (!canvas || !backgroundCanvas || !container) return;
      
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const backgroundContext = backgroundCanvas.getContext('2d', { willReadFrequently: true });
      if (!context || !backgroundContext) return;
      contextRef.current = context;
      backgroundContextRef.current = backgroundContext;

      const resizeCanvas = () => {
        const { width, height } = container.getBoundingClientRect();
        
        if (Math.round(canvas.width / (window.devicePixelRatio || 1)) === Math.round(width) && Math.round(canvas.height / (window.devicePixelRatio || 1)) === Math.round(height)) {
          return;
        }

        const dpr = window.devicePixelRatio || 1;
        
        // Resize both canvases
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        backgroundCanvas.width = width * dpr;
        backgroundCanvas.height = height * dpr;
        backgroundCanvas.style.width = `${width}px`;
        backgroundCanvas.style.height = `${height}px`;

        // Scale contexts
        context.scale(dpr, dpr);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        
        backgroundContext.scale(dpr, dpr);

        // Redraw background
        if (backgroundImageRef.current) {
          const img = backgroundImageRef.current;
          backgroundContext.fillStyle = 'white';
          backgroundContext.fillRect(0, 0, width, height);
          backgroundContext.drawImage(img, 0, 0, width, height);
        } else {
           backgroundContext.fillStyle = 'white';
           backgroundContext.fillRect(0, 0, width, height);
        }
        
        context.clearRect(0,0, canvas.width, canvas.height);
        historyRef.current = [];
        historyIndexRef.current = -1;
        saveState();
      };

      const resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(container);
      resizeCanvas();

      return () => resizeObserver.disconnect();
    }, [saveState]);

    const getPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const touch = 'touches' in e ? e.touches[0] : null;
      return {
        x: (touch ? touch.clientX : e.clientX) - rect.left,
        y: (touch ? touch.clientY : e.clientY) - rect.top,
      };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      const context = contextRef.current;
      if (!context || !tool) return;
      
      hasMovedRef.current = false;
      setIsDrawing(true);
      
      const point = getPoint(e);
      lastPointRef.current = point;

      if (tool === 'highlight') {
        preStrokeImageDataRef.current = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
        currentPathRef.current = new Path2D();
        currentPathRef.current.moveTo(point.x, point.y);
      }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || !contextRef.current || !lastPointRef.current) return;
      hasMovedRef.current = true;
      const context = contextRef.current;
      const currentPoint = getPoint(e);

      if (tool === 'highlight' && preStrokeImageDataRef.current && currentPathRef.current) {
        context.putImageData(preStrokeImageDataRef.current, 0, 0);

        currentPathRef.current.lineTo(currentPoint.x, currentPoint.y);
        
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = 0.2;
        context.strokeStyle = penColor;
        context.lineWidth = highlighterSize;
        context.stroke(currentPathRef.current);

        // Reset context
        context.globalAlpha = 1.0;
      } else {
        context.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
        context.globalAlpha = 1.0;
        
        const lineWidth = tool === 'draw' ? penSize : eraserSize;
        
        context.lineWidth = lineWidth;
        context.strokeStyle = penColor;

        context.beginPath();
        context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
        context.lineTo(currentPoint.x, currentPoint.y);
        context.stroke();
      }
      
      lastPointRef.current = currentPoint;
    };

    const stopDrawing = () => {
      if (!isDrawing) return;
      
      const context = contextRef.current;
      if (context && !hasMovedRef.current && lastPointRef.current) {
        // This was a click, not a drag. Draw a dot.
        const point = lastPointRef.current;

        // If it's a highlighter click, we need to restore the canvas first
        if (tool === 'highlight' && preStrokeImageDataRef.current) {
          context.putImageData(preStrokeImageDataRef.current, 0, 0);
        }

        const size = tool === 'draw' ? penSize : tool === 'highlight' ? highlighterSize : eraserSize;

        if (tool === 'draw' || tool === 'highlight') {
            context.globalCompositeOperation = 'source-over';
            context.globalAlpha = tool === 'highlight' ? 0.2 : 1.0;
            context.fillStyle = penColor;
            
            context.beginPath();
            context.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
            context.fill();
            context.globalAlpha = 1.0; // Reset alpha
        } else if (tool === 'erase') {
            context.globalCompositeOperation = 'destination-out';
            context.fillStyle = 'white';
            context.beginPath();
            context.arc(point.x, point.y, eraserSize / 2, 0, Math.PI * 2);
            context.fill();
        }
      }

      setIsDrawing(false);
      lastPointRef.current = null;
      preStrokeImageDataRef.current = null;
      currentPathRef.current = null;
      
      saveState();
    };
    
    useImperativeHandle(ref, () => ({
      exportAsDataURL: () => {
        const canvas = canvasRef.current;
        const backgroundCanvas = backgroundCanvasRef.current;
        if (!canvas || !backgroundCanvas) return;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;
        
        // Draw background first, then drawing on top
        tempCtx.drawImage(backgroundCanvas, 0, 0);
        tempCtx.drawImage(canvas, 0, 0);
        
        return tempCanvas.toDataURL('image/png');
      },
      clear: () => {
        const container = containerRef.current;
        if (container) {
          container.style.width = '100%';
          container.style.height = '100%';
        }
        backgroundImageRef.current = null;
      },
      undo: () => {
        if (historyIndexRef.current > 0) {
          historyIndexRef.current -= 1;
          restoreState(historyIndexRef.current);
          onHistoryChange(historyIndexRef.current > 0, true);
        }
      },
      redo: () => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
          historyIndexRef.current += 1;
          restoreState(historyIndexRef.current);
          onHistoryChange(true, historyIndexRef.current < historyRef.current.length - 1);
        }
      },
      loadImage: (dataUrl) => {
         const container = containerRef.current;
         if(!container) return;
         
         const img = new Image();
         img.onload = () => {
           backgroundImageRef.current = img;
           
           container.style.width = `${img.width}px`;
           container.style.height = `${img.height}px`;
         }
         img.src = dataUrl;
      }
    }));

    return (
      <div 
        ref={containerRef}
        className="relative w-full h-full bg-white mx-auto"
      >
        <canvas
          ref={backgroundCanvasRef}
          className="absolute inset-0 pointer-events-none"
          data-ai-hint="background pdf"
        />
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={cn(
            'absolute inset-0',
            !tool && 'pointer-events-none'
          )}
          data-ai-hint="drawing layer"
        />
      </div>
    );
  }
);

DrawingCanvas.displayName = 'DrawingCanvas';
