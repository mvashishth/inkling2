
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
  switchPage: (pageNum: number, backgroundDataUrl: string) => void;
  getDimensions: () => { width: number; height: number } | undefined;
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
    
    // --- Multi-page state ---
    const currentPageRef = useRef<number>(1);
    const pageHistoryRef = useRef(new Map<number, ImageData[]>());
    const pageHistoryIndexRef = useRef(new Map<number, number>());

    const preStrokeImageDataRef = useRef<ImageData | null>(null);
    const currentPathRef = useRef<Path2D | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.touchAction = tool ? 'none' : 'auto';
        }
    }, [tool]);

    const updateHistoryButtons = useCallback((page: number) => {
        const history = pageHistoryRef.current.get(page) ?? [];
        const index = pageHistoryIndexRef.current.get(page) ?? -1;
        onHistoryChange(index > 0, index < history.length - 1);
    }, [onHistoryChange]);

    const saveState = useCallback(() => {
      if (!canvasRef.current || !contextRef.current) return;
      const canvas = canvasRef.current;
      const page = currentPageRef.current;
      const imageData = contextRef.current.getImageData(0, 0, canvas.width, canvas.height);
      
      const history = pageHistoryRef.current.get(page) ?? [];
      const currentIndex = pageHistoryIndexRef.current.get(page) ?? -1;

      const newHistory = history.slice(0, currentIndex + 1);
      newHistory.push(imageData);
      
      pageHistoryRef.current.set(page, newHistory);
      pageHistoryIndexRef.current.set(page, newHistory.length - 1);

      updateHistoryButtons(page);
    }, [updateHistoryButtons]);

    const restoreState = useCallback((page: number, index: number) => {
        const history = pageHistoryRef.current.get(page);
        if (!contextRef.current || !history || !history[index]) return;
        contextRef.current.putImageData(history[index], 0, 0);
    }, []);

    const loadImage = useCallback((dataUrl: string | null) => {
      const img = new Image();
      img.onload = () => {
        backgroundImageRef.current = img;
        const backgroundCanvas = backgroundCanvasRef.current;
        const bgContext = backgroundContextRef.current;
        const container = containerRef.current;
        if (!backgroundCanvas || !bgContext || !container) return;

        bgContext.fillStyle = 'white';
        bgContext.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
        bgContext.drawImage(img, 0, 0);
      }
      img.onerror = () => {
          const backgroundCanvas = backgroundCanvasRef.current;
          const bgContext = backgroundContextRef.current;
          if (backgroundCanvas && bgContext) {
            bgContext.fillStyle = 'white';
            bgContext.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
          }
      }

      if (dataUrl) {
          img.src = dataUrl;
      } else {
          backgroundImageRef.current = null;
          img.src = ''; // Will trigger onerror
      }
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
        
        const dpr = window.devicePixelRatio || 1;
        
        const scaledWidth = width * dpr;
        const scaledHeight = height * dpr;
        
        if (canvas.width === scaledWidth && canvas.height === scaledHeight) return;

        // Backup current drawing
        const currentDrawing = context.getImageData(0, 0, canvas.width, canvas.height);

        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        backgroundCanvas.width = scaledWidth;
        backgroundCanvas.height = scaledHeight;
        backgroundCanvas.style.width = `${width}px`;
        backgroundCanvas.style.height = `${height}px`;

        context.scale(dpr, dpr);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        
        backgroundContext.scale(dpr, dpr);

        if (backgroundImageRef.current) {
          loadImage(backgroundImageRef.current.src);
        } else {
          loadImage(null);
        }
        
        // Restore drawing after resize. This is imperfect but better than clearing.
        context.putImageData(currentDrawing, 0, 0);
      };

      const resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(container);
      
      // Initial setup
      container.style.width = '100%';
      container.style.height = '100%';
      resizeCanvas();
      
      // Set up initial history for page 1
      pageHistoryRef.current.clear();
      pageHistoryIndexRef.current.clear();
      currentPageRef.current = 1;
      saveState();

      return () => resizeObserver.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
      if (!context || !tool || ('button' in e && e.button !== 0)) return;
      
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
      e.preventDefault();
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
        const point = lastPointRef.current;
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
            context.globalAlpha = 1.0;
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
        tempCtx.drawImage(backgroundCanvas, 0, 0);
        tempCtx.drawImage(canvas, 0, 0);
        return tempCanvas.toDataURL('image/png');
      },
      clear: () => {
        const container = containerRef.current;
        const context = contextRef.current;
        if (container && context) {
          pageHistoryRef.current.clear();
          pageHistoryIndexRef.current.clear();
          currentPageRef.current = 1;
          container.style.width = '100%';
          container.style.height = '100%';
          backgroundImageRef.current = null;
          loadImage(null);
          context.clearRect(0,0,context.canvas.width, context.canvas.height);
          saveState();
        }
      },
      undo: () => {
        const page = currentPageRef.current;
        const index = pageHistoryIndexRef.current.get(page) ?? -1;
        if (index > 0) {
          const newIndex = index - 1;
          pageHistoryIndexRef.current.set(page, newIndex);
          restoreState(page, newIndex);
          updateHistoryButtons(page);
        }
      },
      redo: () => {
        const page = currentPageRef.current;
        const history = pageHistoryRef.current.get(page) ?? [];
        const index = pageHistoryIndexRef.current.get(page) ?? -1;
        if (index < history.length - 1) {
          const newIndex = index + 1;
          pageHistoryIndexRef.current.set(page, newIndex);
          restoreState(page, newIndex);
          updateHistoryButtons(page);
        }
      },
      switchPage: (pageNum, backgroundDataUrl) => {
        currentPageRef.current = pageNum;
        loadImage(backgroundDataUrl);
        const context = contextRef.current;
        if (!context) return;
        
        const history = pageHistoryRef.current.get(pageNum);
        const index = pageHistoryIndexRef.current.get(pageNum);
        
        if (history && index !== undefined) {
          restoreState(pageNum, index);
        } else {
          context.clearRect(0, 0, context.canvas.width, context.canvas.height);
          saveState();
        }
        updateHistoryButtons(pageNum);
      },
      getDimensions: () => {
        const canvas = canvasRef.current;
        return canvas ? { width: canvas.width, height: canvas.height } : undefined;
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
