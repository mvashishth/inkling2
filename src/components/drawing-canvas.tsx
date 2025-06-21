"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';

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
  tool: 'draw' | 'erase' | 'highlight';
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

    const [isDrawing, setIsDrawing] = useState(false);
    const lastPointRef = useRef<Point | null>(null);

    const historyRef = useRef<ImageData[]>([]);
    const historyIndexRef = useRef<number>(-1);

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
      if (!canvas) return;
      
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      contextRef.current = context;

      const resizeCanvas = () => {
        const parent = canvas.parentElement;
        if (parent) {
          const { width, height } = parent.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          
          const lastState = historyRef.current[historyIndexRef.current];

          canvas.width = width * dpr;
          canvas.height = height * dpr;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;

          context.scale(dpr, dpr);
          context.lineCap = 'round';
          context.lineJoin = 'round';
          
          if(lastState) {
            context.putImageData(lastState, 0, 0);
          } else {
            // Initial clear state
            context.fillStyle = 'white';
            context.fillRect(0,0, canvas.width, canvas.height);
            saveState();
          }
        }
      };

      const resizeObserver = new ResizeObserver(resizeCanvas);
      if (canvas.parentElement) {
        resizeObserver.observe(canvas.parentElement);
      }
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
      e.preventDefault();
      const context = contextRef.current;
      if (!context) return;
      setIsDrawing(true);
      const point = getPoint(e);
      lastPointRef.current = point;

      if (tool === 'draw' || tool === 'highlight') {
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = tool === 'highlight' ? 0.05 : 1.0;
        context.beginPath();
        context.fillStyle = penColor;
        const size = tool === 'draw' ? penSize : highlighterSize;
        context.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
        context.fill();
      }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing || !contextRef.current || !lastPointRef.current) return;
      const context = contextRef.current;
      const currentPoint = getPoint(e);

      context.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
      context.globalAlpha = tool === 'highlight' ? 0.05 : 1.0;
      
      const lineWidth = tool === 'draw' ? penSize : tool === 'highlight' ? highlighterSize : eraserSize;
      
      context.lineWidth = lineWidth;
      context.strokeStyle = penColor;

      context.beginPath();
      context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      context.lineTo(currentPoint.x, currentPoint.y);
      context.stroke();

      lastPointRef.current = currentPoint;
    };

    const stopDrawing = () => {
      if (!isDrawing) return;
      setIsDrawing(false);
      lastPointRef.current = null;
      saveState();
    };
    
    useImperativeHandle(ref, () => ({
      exportAsDataURL: () => canvasRef.current?.toDataURL('image/png'),
      clear: () => {
        const canvas = canvasRef.current;
        const context = contextRef.current;
        if (canvas && context) {
          context.fillStyle = 'white';
          context.fillRect(0, 0, canvas.width, canvas.height);
          saveState();
        }
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
         const canvas = canvasRef.current;
         const context = contextRef.current;
         if(!canvas || !context) return;
         
         const img = new Image();
         img.onload = () => {
           context.clearRect(0, 0, canvas.width, canvas.height);
           context.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
           saveState();
         }
         img.src = dataUrl;
      }
    }));

    return (
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="touch-none bg-white"
        data-ai-hint="drawing canvas"
      />
    );
  }
);

DrawingCanvas.displayName = 'DrawingCanvas';
