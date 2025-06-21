
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

interface Point {
  x: number;
  y: number;
}

interface SerializableImageData {
  width: number;
  height: number;
  data: string;
}
export interface AnnotationData {
  history: [number, SerializableImageData[]][];
  historyIndex: [number, number][];
}

export interface DrawingCanvasRef {
  exportAsDataURL: () => { dataUrl: string | undefined; pageNum: number } | undefined;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  initializePages: (numPages: number) => void;
  getAnnotationData: () => AnnotationData | undefined;
  getPageElement: (pageIndex: number) => HTMLDivElement | null;
}

interface DrawingCanvasProps {
  pages: string[];
  tool: 'draw' | 'erase' | 'highlight' | 'snapshot' | null;
  penColor: string;
  penSize: number;
  eraserSize: number;
  highlighterSize: number;
  highlighterColor: string;
  onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
  initialAnnotations: AnnotationData | null;
  toast: (options: { title: string; description: string; variant?: 'default' | 'destructive' }) => void;
  onSnapshot?: (imageDataUrl: string, pageIndex: number, rect: { x: number; y: number; width: number; height: number }) => void;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ pages, tool, penColor, penSize, eraserSize, highlighterSize, highlighterColor, onHistoryChange, initialAnnotations, toast, onSnapshot }, ref) => {
    const isDrawingRef = useRef(false);
    const hasMovedRef = useRef(false);

    const pageContainerRef = useRef<HTMLDivElement>(null);
    const drawingCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
    const contextRefs = useRef<(CanvasRenderingContext2D | null)[]>([]);
    
    const lastActivePageRef = useRef<number>(0);
    const pageHistoryRef = useRef(new Map<number, ImageData[]>());
    const pageHistoryIndexRef = useRef(new Map<number, number>());

    const preStrokeImageDataRef = useRef<ImageData | null>(null);
    const currentPathRef = useRef<Path2D | null>(null);
    const lastPointRef = useRef<Point | null>(null);

    const [selection, setSelection] = useState<{ pageIndex: number; startX: number; startY: number; endX: number; endY: number} | null>(null);


    useEffect(() => {
        drawingCanvasRefs.current = drawingCanvasRefs.current.slice(0, pages.length || 1);
        contextRefs.current = contextRefs.current.slice(0, pages.length || 1);
    }, [pages]);
    
    useEffect(() => {
        const container = pageContainerRef.current;
        if (container) {
            container.style.touchAction = tool ? 'none' : 'auto';
        }
    }, [tool]);

    const updateHistoryButtons = useCallback((page: number) => {
        const history = pageHistoryRef.current.get(page) ?? [];
        const index = pageHistoryIndexRef.current.get(page) ?? -1;
        onHistoryChange(index > 0, index < history.length - 1);
    }, [onHistoryChange]);

    const saveState = useCallback((pageIndex: number) => {
      const canvas = drawingCanvasRefs.current[pageIndex];
      const context = contextRefs.current[pageIndex];
      if (!canvas || !context) return;

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      const history = pageHistoryRef.current.get(pageIndex) ?? [];
      const currentIndex = pageHistoryIndexRef.current.get(pageIndex) ?? -1;

      const newHistory = history.slice(0, currentIndex + 1);
      newHistory.push(imageData);
      
      pageHistoryRef.current.set(pageIndex, newHistory);
      pageHistoryIndexRef.current.set(pageIndex, newHistory.length - 1);

      updateHistoryButtons(pageIndex);
    }, [updateHistoryButtons]);

    const restoreState = useCallback((pageIndex: number, historyIndex: number) => {
        const history = pageHistoryRef.current.get(pageIndex);
        const context = contextRefs.current[pageIndex];
        if (!context || !history || !history[historyIndex]) return;
        context.putImageData(history[historyIndex], 0, 0);
    }, []);

    useEffect(() => {
      if (initialAnnotations && pages.length > 0) {
        const base64ToUint8ClampedArray = (base64: string) => {
            const CHUNK_SIZE = 0x8000;
            let result = '';
            for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
                const chunk = base64.substring(i, i + CHUNK_SIZE);
                result += window.atob(chunk);
            }
            const len = result.length;
            const bytes = new Uint8ClampedArray(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = result.charCodeAt(i);
            }
            return bytes;
        }

        const newHistoryMap = new Map<number, ImageData[]>();
        const newHistoryIndexMap = new Map<number, number>();

        try {
            for (const [pageIndex, history] of initialAnnotations.history) {
                const newPageHistory = history.map(s_img => {
                    const dataArray = base64ToUint8ClampedArray(s_img.data);
                    return new ImageData(dataArray, s_img.width, s_img.height);
                });
                newHistoryMap.set(pageIndex, newPageHistory);
            }
            
            for (const [pageIndex, index] of initialAnnotations.historyIndex) {
                newHistoryIndexMap.set(pageIndex, index);
            }

            pageHistoryRef.current = newHistoryMap;
            pageHistoryIndexRef.current = newHistoryIndexMap;
        } catch(e) {
            console.error("Failed to load annotations, file may be corrupt.", e);
            toast({
                title: "Error loading project",
                description: "The project file may be corrupt. Loading PDF without annotations.",
                variant: "destructive",
            });
            pageHistoryRef.current.clear();
            pageHistoryIndexRef.current.clear();
        }
      }
    }, [initialAnnotations, pages.length, restoreState, toast]);

    const getPoint = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent, canvasIndex: number): Point => {
      const canvas = drawingCanvasRefs.current[canvasIndex];
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const touch = 'touches' in e ? e.touches[0] : null;
      return {
        x: ((touch ? touch.clientX : e.clientX) - rect.left),
        y: ((touch ? touch.clientY : e.clientY) - rect.top),
      };
    }, []);

    const draw = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current) return;
      if ('preventDefault' in e && e.cancelable) e.preventDefault();

      const pageIndex = lastActivePageRef.current;
      const point = getPoint(e, pageIndex);

      if(tool === 'snapshot' && selection){
        setSelection(prev => prev ? { ...prev, endX: point.x, endY: point.y } : null);
        return;
      }
      
      const context = contextRefs.current[pageIndex];
      if (!context || !lastPointRef.current) return;

      if (!hasMovedRef.current) {
        hasMovedRef.current = true;
      }
      
      if (tool === 'highlight' && preStrokeImageDataRef.current && currentPathRef.current) {
        context.putImageData(preStrokeImageDataRef.current, 0, 0);
        currentPathRef.current.lineTo(point.x, point.y);
        context.stroke(currentPathRef.current);
      } else {
        context.lineTo(point.x, point.y);
        context.stroke();
      }
      
      lastPointRef.current = point;
    };

    const stopDrawing = () => {
      if (!isDrawingRef.current) return;

      if(tool === 'snapshot' && selection) {
        const { pageIndex, startX, startY, endX, endY } = selection;
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);

        if (width > 5 && height > 5 && onSnapshot) {
          const pageImageElement = pageContainerRef.current?.querySelectorAll('.page-image')[pageIndex] as HTMLImageElement;
          
          if (pageImageElement) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              const scaleX = pageImageElement.naturalWidth / pageImageElement.width;
              const scaleY = pageImageElement.naturalHeight / pageImageElement.height;
              
              tempCtx.drawImage(
                pageImageElement,
                x * scaleX, y * scaleY, width * scaleX, height * scaleY,
                0, 0, width, height
              );
              
              const dataUrl = tempCanvas.toDataURL('image/png');
              onSnapshot(dataUrl, pageIndex, { x, y, width, height });
            }
          }
        }
        setSelection(null);
        isDrawingRef.current = false;
        return;
      }
      
      const pageIndex = lastActivePageRef.current;
      const context = contextRefs.current[pageIndex];
      if (!context) return;
      
      if (!hasMovedRef.current && lastPointRef.current) {
        const point = lastPointRef.current;
        if (tool === 'highlight' && preStrokeImageDataRef.current) {
          context.putImageData(preStrokeImageDataRef.current, 0, 0);
        }

        const size = tool === 'draw' ? penSize : tool === 'highlight' ? highlighterSize : eraserSize;
        context.fillStyle = tool === 'highlight' ? highlighterColor : penColor;
        context.beginPath();
        context.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
        context.fill();
      }

      isDrawingRef.current = false;
      lastPointRef.current = null;
      preStrokeImageDataRef.current = null;
      currentPathRef.current = null;
      if (context.globalCompositeOperation !== 'source-over') {
        context.globalCompositeOperation = 'source-over';
      }
      context.globalAlpha = 1.0;
      saveState(pageIndex);
    };

    const stopDrawingRef = useRef(stopDrawing);
    stopDrawingRef.current = stopDrawing;

    useEffect(() => {
        const handleUp = () => {
            if (isDrawingRef.current) {
                stopDrawingRef.current();
            }
        };
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchend', handleUp);
        return () => {
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchend', handleUp);
        };
    }, []);

    const drawRef = useRef(draw);
    drawRef.current = draw;
    useEffect(() => {
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if(isDrawingRef.current) {
                drawRef.current(e);
            }
        }
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchmove', handleMove, { passive: false });

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchmove', handleMove);
        }
    }, []);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent, pageIndex: number) => {
      if (!tool || ('button' in e && e.button !== 0)) return;
      e.preventDefault();
      isDrawingRef.current = true;
      hasMovedRef.current = false;
      lastActivePageRef.current = pageIndex;
      updateHistoryButtons(pageIndex);
      const point = getPoint(e, pageIndex);
      
      if (tool === 'snapshot') {
        setSelection({ pageIndex, startX: point.x, startY: point.y, endX: point.x, endY: point.y });
        return;
      }
      
      const context = contextRefs.current[pageIndex];
      if (!context) return;
      lastPointRef.current = point;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      
      if (tool === 'draw') {
        context.strokeStyle = penColor;
        context.lineWidth = penSize;
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = 1.0;
      } else if (tool === 'erase') {
        context.lineWidth = eraserSize;
        context.globalCompositeOperation = 'destination-out';
      } else if (tool === 'highlight') {
        context.strokeStyle = highlighterColor;
        context.lineWidth = highlighterSize;
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = 0.2;
      }

      if (tool === 'highlight') {
        preStrokeImageDataRef.current = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
        currentPathRef.current = new Path2D();
        currentPathRef.current.moveTo(point.x, point.y);
      } else {
        context.beginPath();
        context.moveTo(point.x, point.y);
      }
    };
    
    useImperativeHandle(ref, () => ({
      initializePages: (numPages: number) => {
        pageHistoryRef.current.clear();
        pageHistoryIndexRef.current.clear();
        for (let i = 0; i < numPages; i++) {
          pageHistoryRef.current.set(i, []);
          pageHistoryIndexRef.current.set(i, -1);
        }
      },
      exportAsDataURL: () => {
        const pageIndex = lastActivePageRef.current;
        const drawingCanvas = drawingCanvasRefs.current[pageIndex];
        if (!drawingCanvas) return;
        
        const pageImage = pageContainerRef.current?.querySelectorAll('.page-image')[pageIndex] as HTMLImageElement;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = drawingCanvas.width;
        tempCanvas.height = drawingCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        if (pageImage) {
            tempCtx.drawImage(pageImage, 0, 0, tempCanvas.width, tempCanvas.height);
        } else {
            tempCtx.fillStyle = 'white';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        }
        
        tempCtx.drawImage(drawingCanvas, 0, 0);

        return { 
          dataUrl: tempCanvas.toDataURL('image/png'),
          pageNum: pageIndex + 1
        };
      },
      clear: () => {
        contextRefs.current.forEach((context, index) => {
            if (context) {
              context.clearRect(0,0,context.canvas.width, context.canvas.height);
              pageHistoryRef.current.set(index, []);
              pageHistoryIndexRef.current.set(index, -1);
            }
        });
        
        if (pageHistoryRef.current.size === 0) {
            pageHistoryRef.current.set(0, []);
            pageHistoryIndexRef.current.set(0, -1);
        }
        
        const activePage = lastActivePageRef.current;
        saveState(activePage);
        updateHistoryButtons(activePage);
      },
      undo: () => {
        const page = lastActivePageRef.current;
        const index = pageHistoryIndexRef.current.get(page) ?? -1;
        if (index > 0) {
          const newIndex = index - 1;
          pageHistoryIndexRef.current.set(page, newIndex);
          restoreState(page, newIndex);
          updateHistoryButtons(page);
        }
      },
      redo: () => {
        const page = lastActivePageRef.current;
        const history = pageHistoryRef.current.get(page) ?? [];
        const index = pageHistoryIndexRef.current.get(page) ?? -1;
        if (index < history.length - 1) {
          const newIndex = index + 1;
          pageHistoryIndexRef.current.set(page, newIndex);
          restoreState(page, newIndex);
          updateHistoryButtons(page);
        }
      },
      getAnnotationData: () => {
        if (pageHistoryRef.current.size === 0) return undefined;

        const uint8ClampedArrayToBase64 = (arr: Uint8ClampedArray) => {
            const CHUNK_SIZE = 0x8000;
            let result = '';
            for (let i = 0; i < arr.length; i += CHUNK_SIZE) {
                const chunk = arr.subarray(i, i + CHUNK_SIZE);
                result += String.fromCharCode.apply(null, chunk as unknown as number[]);
            }
            return btoa(result);
        }

        const serializedHistory: [number, SerializableImageData[]][] = [];
        for (const [pageIndex, history] of pageHistoryRef.current.entries()) {
            if (history.length > 0) {
              const pageHistory = history.map(imageData => ({
                  width: imageData.width,
                  height: imageData.height,
                  data: uint8ClampedArrayToBase64(imageData.data),
              }));
              serializedHistory.push([pageIndex, pageHistory]);
            }
        }

        const serializedHistoryIndex = Array.from(pageHistoryIndexRef.current.entries());

        return {
            history: serializedHistory,
            historyIndex: serializedHistoryIndex,
        };
      },
      getPageElement: (pageIndex: number) => {
        const pageWrapper = pageContainerRef.current?.querySelectorAll('.page-wrapper')[pageIndex];
        return pageWrapper as HTMLDivElement | null;
      },
    }));

    const Page = ({ pageDataUrl, index, currentSelection }: { pageDataUrl: string, index: number, currentSelection: typeof selection }) => {
        const imgRef = useRef<HTMLImageElement>(null);
        
        useEffect(() => {
            const drawingCanvas = drawingCanvasRefs.current[index];
            const image = imgRef.current;
            if (!drawingCanvas || !image) return;

            const context = drawingCanvas.getContext('2d', { willReadFrequently: true });
            if (!context) return;
            contextRefs.current[index] = context;
            
            const setCanvasSize = () => {
              if (image.naturalWidth > 0 && pageContainerRef.current) {
                  const containerWidth = pageContainerRef.current.clientWidth;
                  const scale = (containerWidth - 32) / image.naturalWidth; // 32 for padding
                  const width = image.naturalWidth * scale;
                  const height = image.naturalHeight * scale;

                  drawingCanvas.width = width;
                  drawingCanvas.height = height;
                  
                  const history = pageHistoryRef.current.get(index) ?? [];
                  const historyIdx = pageHistoryIndexRef.current.get(index) ?? -1;

                  if (history.length > 0 && historyIdx > -1 && history[historyIdx]) {
                    restoreState(index, historyIdx);
                  } else {
                    saveState(index);
                  }
              }
            }

            if(image.complete) {
              setCanvasSize();
            } else {
              image.onload = setCanvasSize;
            }

            const resizeObserver = new ResizeObserver(setCanvasSize);
            if(pageContainerRef.current) {
                resizeObserver.observe(pageContainerRef.current);
            }
            return () => resizeObserver.disconnect();
            
        }, [index, restoreState, saveState]);

        return (
            <div className="relative shadow-lg my-4 mx-auto w-fit page-wrapper">
                <img ref={imgRef} src={pageDataUrl} alt={`Page ${index + 1}`} className="block pointer-events-none w-full h-auto max-w-[calc(100vw-2rem)] page-image" data-ai-hint="pdf page" />
                <canvas
                    ref={(el) => (drawingCanvasRefs.current[index] = el)}
                    onMouseDown={(e) => startDrawing(e, index)}
                    onTouchStart={(e) => startDrawing(e, index)}
                    className={cn(
                        "absolute inset-0",
                        !tool && 'pointer-events-none',
                        tool === 'snapshot' && 'cursor-crosshair'
                    )}
                />
                {currentSelection && currentSelection.pageIndex === index && (
                  <div 
                      className="absolute border-2 border-dashed border-blue-500 bg-blue-500/20 pointer-events-none"
                      style={{
                          left: Math.min(currentSelection.startX, currentSelection.endX),
                          top: Math.min(currentSelection.startY, currentSelection.endY),
                          width: Math.abs(currentSelection.endX - currentSelection.startX),
                          height: Math.abs(currentSelection.endY - currentSelection.startY),
                      }}
                  />
                )}
            </div>
        )
    };
    
    useEffect(() => {
      if (pages.length === 0) {
        const canvas = drawingCanvasRefs.current[0];
        const context = canvas?.getContext('2d', { willReadFrequently: true });
        const container = pageContainerRef.current;
        if(canvas && context && container) {
            contextRefs.current[0] = context;
            const resize = () => {
                const { width, height } = container.getBoundingClientRect();
                canvas.width = width;
                canvas.height = height;
                pageHistoryRef.current.clear();
                pageHistoryIndexRef.current.clear();
                pageHistoryRef.current.set(0, []);
                pageHistoryIndexRef.current.set(0, -1);
                saveState(0);
            }
            const resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(container);
            resize();
            return () => resizeObserver.disconnect();
        }
      }
    }, [pages.length, saveState]);

    if (pages.length === 0) {
        return (
          <div
            ref={pageContainerRef}
            className="w-full h-full"
          >
            <div className="relative w-full h-full bg-white">
              <canvas
                ref={el => { if(el) drawingCanvasRefs.current[0] = el}}
                onMouseDown={(e) => startDrawing(e, 0)}
                onTouchStart={(e) => startDrawing(e, 0)}
                className={cn(
                  'w-full h-full',
                  !tool && 'pointer-events-none'
                )}
                data-ai-hint="drawing layer"
              />
            </div>
          </div>
        )
    }

    return (
      <div 
        ref={pageContainerRef}
        className="w-full h-full overflow-y-auto bg-muted/20 p-4"
      >
        <div className="max-w-5xl mx-auto">
            {pages.map((pageDataUrl, index) => (
                <Page key={index} pageDataUrl={pageDataUrl} index={index} currentSelection={selection} />
            ))}
        </div>
      </div>
    );
  }
);

DrawingCanvas.displayName = 'DrawingCanvas';
