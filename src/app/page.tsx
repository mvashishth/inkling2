
"use client";

import * as React from 'react';
import {
  Pencil,
  Eraser,
  Download,
  Undo,
  Redo,
  Trash2,
  Highlighter,
  FileUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { DrawingCanvas, type DrawingCanvasRef } from '@/components/drawing-canvas';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Progress } from '@/components/ui/progress';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

type Tool = 'draw' | 'erase' | 'highlight';
const COLORS = ['#1A1A1A', '#EF4444', '#3B82F6', '#22C55E', '#EAB308'];

export default function Home() {
  const [tool, setTool] = React.useState<Tool | null>(null);
  const [penSize, setPenSize] = React.useState(5);
  const [penColor, setPenColor] = React.useState(COLORS[0]);
  const [eraserSize, setEraserSize] = React.useState(20);
  const [highlighterSize, setHighlighterSize] = React.useState(20);
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);

  const [pdfDoc, setPdfDoc] = React.useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(0);
  
  const [isPdfLoading, setIsPdfLoading] = React.useState(false);
  const [pdfLoadProgress, setPdfLoadProgress] = React.useState(0);
  const [isChangingPage, setIsChangingPage] = React.useState(false);

  const canvasRef = React.useRef<DrawingCanvasRef>(null);
  const pdfInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleToolClick = (selectedTool: Tool) => {
    setTool((currentTool) => (currentTool === selectedTool ? null : selectedTool));
  };

  const handleExport = () => {
    const dataUrl = canvasRef.current?.exportAsDataURL();
    if (dataUrl) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `inkling-drawing-page-${currentPage}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleHistoryChange = (canUndo: boolean, canRedo: boolean) => {
    setCanUndo(canUndo);
    setCanRedo(canRedo);
  };

  const handleSliderChange = (value: number[]) => {
    if (tool === 'draw') {
      setPenSize(value[0]);
    } else if (tool === 'highlight') {
      setHighlighterSize(value[0]);
    } else {
      setEraserSize(value[0]);
    }
  };

  const handlePdfUploadClick = () => {
    pdfInputRef.current?.click();
  };

  const renderPage = async (
    pageNum: number,
    doc: pdfjsLib.PDFDocumentProxy
  ) => {
    setIsChangingPage(true);
    const canvasDimensions = canvasRef.current?.getDimensions();

    if (!canvasDimensions || canvasDimensions.width === 0 || canvasDimensions.height === 0) {
      toast({
        title: "Canvas not ready",
        description: "The drawing canvas is not yet available to render the PDF.",
        variant: "destructive",
      });
      setIsChangingPage(false);
      return;
    }

    try {
      const page = await doc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      const scale = Math.min(
        canvasDimensions.width / unscaledViewport.width,
        canvasDimensions.height / unscaledViewport.height
      );
      const viewport = page.getViewport({ scale });

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = canvasDimensions.width;
      finalCanvas.height = canvasDimensions.height;
      const finalContext = finalCanvas.getContext('2d');
      if (!finalContext) return;
      
      finalContext.fillStyle = 'white';
      finalContext.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = viewport.width;
      pageCanvas.height = viewport.height;
      const pageContext = pageCanvas.getContext('2d');
      if (!pageContext) return;

      await page.render({
        canvasContext: pageContext,
        viewport: viewport,
      }).promise;
      
      const offsetX = (canvasDimensions.width - viewport.width) / 2;
      const offsetY = (canvasDimensions.height - viewport.height) / 2;
      finalContext.drawImage(pageCanvas, offsetX, offsetY);

      const dataUrl = finalCanvas.toDataURL('image/png');
      canvasRef.current?.switchPage(pageNum, dataUrl);

    } catch (error) {
      console.error('Failed to render page:', error);
      toast({
        title: "Error rendering page",
        description: "There was a problem rendering the PDF page.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPage(false);
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPdfLoading(true);
    setPdfLoadProgress(0);

    try {
      const arrayBuffer = await file.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument(arrayBuffer);
      loadingTask.onProgress = (progressData) => {
        const progress = Math.round((progressData.loaded / progressData.total) * 100);
        setPdfLoadProgress(progress);
      };
      
      const pdf = await loadingTask.promise;

      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      
      canvasRef.current?.clear();
      await renderPage(1, pdf);
      setCurrentPage(1);

    } catch (error) {
      console.error('Failed to render PDF:', error);
      toast({
        title: "Error loading PDF",
        description: "There was a problem rendering the PDF file. Please try another file.",
        variant: "destructive",
      });
      setPdfDoc(null);
      setTotalPages(0);
      setCurrentPage(1);
    } finally {
      if (e.target) e.target.value = '';
      setIsPdfLoading(false);
    }
  };

  const changePage = async (delta: number) => {
    if (!pdfDoc) return;
    const newPage = currentPage + delta;
    if (newPage > 0 && newPage <= totalPages) {
      await renderPage(newPage, pdfDoc);
      setCurrentPage(newPage);
    }
  };

  const sliderValue = tool === 'draw' ? penSize : tool === 'highlight' ? highlighterSize : eraserSize;
  const sliderMin = tool === 'draw' ? 1 : tool === 'highlight' ? 10 : 2;
  const sliderMax = tool === 'draw' ? 20 : tool === 'highlight' ? 50 : 100;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-dvh w-full flex-col bg-background text-foreground">
        <aside className="flex flex-row items-center justify-between gap-4 p-2 border-b bg-card shadow-md z-10">
            <div className="flex items-center gap-x-2 sm:gap-x-4">
                <h1 className="font-headline text-xl font-bold px-2 hidden sm:block">Inkling</h1>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={tool === 'draw' ? 'secondary' : 'ghost'}
                        size="icon"
                        onClick={() => handleToolClick('draw')}
                        className="h-10 w-10 rounded-lg"
                      >
                        <Pencil className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Draw</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={tool === 'erase' ? 'secondary' : 'ghost'}
                        size="icon"
                        onClick={() => handleToolClick('erase')}
                        className="h-10 w-10 rounded-lg"
                      >
                        <Eraser className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Eraser</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={tool === 'highlight' ? 'secondary' : 'ghost'}
                        size="icon"
                        onClick={() => handleToolClick('highlight')}
                        className="h-10 w-10 rounded-lg"
                      >
                        <Highlighter className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Highlight</p></TooltipContent>
                  </Tooltip>
                </div>
                
                {tool && (
                  <div className="flex flex-row items-center p-1.5 rounded-lg bg-muted/50 gap-4">
                      <div className="flex items-center gap-2 px-1">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{tool === 'erase' ? 'Size' : 'Width'}: {sliderValue}</span>
                          <Slider
                          value={[sliderValue]}
                          max={sliderMax}
                          min={sliderMin}
                          step={1}
                          onValueChange={handleSliderChange}
                          className="w-24"
                          />
                      </div>
      
                      {(tool === 'draw' || tool === 'highlight') && (
                          <>
                          <Separator orientation="vertical" className="h-6 bg-muted-foreground/20" />
                          <div className="flex flex-row flex-wrap justify-center gap-2">
                              {COLORS.map((color) => (
                              <Tooltip key={color}>
                                  <TooltipTrigger asChild>
                                  <button
                                      onClick={() => setPenColor(color)}
                                      className={cn(
                                      'h-6 w-6 rounded-full border-2 transition-all hover:scale-110',
                                      penColor === color
                                          ? 'border-primary'
                                          : 'border-muted-foreground/20'
                                      )}
                                      style={{ backgroundColor: color }}
                                      aria-label={`Set pen color to ${color}`}
                                  />
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">
                                  <p>{color.toUpperCase()}</p>
                                  </TooltipContent>
                              </Tooltip>
                              ))}
                          </div>
                          </>
                      )}
                  </div>
                )}
            </div>

            <div className="flex items-center gap-x-2 sm:gap-x-4">
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => canvasRef.current?.undo()} disabled={!canUndo} className="h-10 w-10 rounded-lg">
                        <Undo className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Undo</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => canvasRef.current?.redo()} disabled={!canRedo} className="h-10 w-10 rounded-lg">
                        <Redo className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Redo</p></TooltipContent>
                  </Tooltip>
                </div>
                
                {totalPages > 0 && (
                  <div className="flex items-center gap-1 text-sm">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => changePage(-1)} disabled={currentPage <= 1 || isChangingPage} className="h-10 w-10 rounded-lg">
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom"><p>Previous Page</p></TooltipContent>
                    </Tooltip>
                    <span className='w-20 text-center font-medium'>{isChangingPage ? "..." : `Page ${currentPage} of ${totalPages}`}</span>
                     <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => changePage(1)} disabled={currentPage >= totalPages || isChangingPage} className="h-10 w-10 rounded-lg">
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom"><p>Next Page</p></TooltipContent>
                    </Tooltip>
                  </div>
                )}

                <Separator orientation="vertical" className="h-8 mx-2" />

                <div className="flex items-center gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={handlePdfUploadClick} className="h-10 w-10 rounded-lg" disabled={isPdfLoading}>
                            <FileUp className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom"><p>Upload PDF</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => { canvasRef.current?.clear(); setTotalPages(0); setCurrentPage(1); setPdfDoc(null); }} className="h-10 w-10 rounded-lg">
                            <Trash2 className="h-5 w-5 text-destructive" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom"><p>Clear Canvas</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={handleExport} className="h-10 w-10 rounded-lg">
                            <Download className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom"><p>Export as PNG</p></TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </aside>

        <main className="flex-1 relative bg-background overflow-auto">
          {(isPdfLoading || isChangingPage) && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                <p className="mb-4 text-lg font-medium">{isChangingPage ? `Loading Page ${currentPage}...` : 'Loading PDF...'}</p>
                {isPdfLoading && <Progress value={pdfLoadProgress} className="w-1/2 max-w-sm" />}
                {isPdfLoading && <p className="mt-2 text-sm text-muted-foreground">{pdfLoadProgress}%</p>}
            </div>
          )}
          <input
            type="file"
            ref={pdfInputRef}
            onChange={handleFileSelect}
            accept="application/pdf"
            className="hidden"
          />
          <DrawingCanvas
            ref={canvasRef}
            tool={tool}
            penColor={penColor}
            penSize={penSize}
            eraserSize={eraserSize}
            highlighterSize={highlighterSize}
            onHistoryChange={handleHistoryChange}
          />
        </main>
      </div>
    </TooltipProvider>
  );
}
