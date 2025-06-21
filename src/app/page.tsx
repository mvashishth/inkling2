
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
const HIGHLIGHTER_COLOR = '#22C55E'; // Use a specific color for the highlighter

export default function Home() {
  const [tool, setTool] = React.useState<Tool | null>(null);
  const [penSize, setPenSize] = React.useState(5);
  const [penColor, setPenColor] = React.useState(COLORS[0]);
  const [eraserSize, setEraserSize] = React.useState(20);
  const [highlighterSize, setHighlighterSize] = React.useState(20);
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);

  const [pageImages, setPageImages] = React.useState<string[]>([]);
  
  const [isPdfLoading, setIsPdfLoading] = React.useState(false);
  const [pdfLoadProgress, setPdfLoadProgress] = React.useState(0);

  const canvasRef = React.useRef<DrawingCanvasRef>(null);
  const pdfInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleToolClick = (selectedTool: Tool) => {
    setTool((currentTool) => (currentTool === selectedTool ? null : selectedTool));
  };

  const handleExport = () => {
    const exportData = canvasRef.current?.exportAsDataURL();
    if (exportData?.dataUrl) {
      const link = document.createElement('a');
      link.href = exportData.dataUrl;
      link.download = `inkling-drawing-page-${exportData.pageNum}.png`;
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPdfLoading(true);
    setPdfLoadProgress(0);
    setPageImages([]);
    canvasRef.current?.clear();


    try {
      const arrayBuffer = await file.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument(arrayBuffer);
      loadingTask.onProgress = (progressData) => {
        // This progress is for download, we'll manually update for rendering
      };
      
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      canvasRef.current?.initializePages(numPages);

      const newPageImages: string[] = [];
      
      for (let i = 1; i <= numPages; i++) {
        setPdfLoadProgress(Math.round((i / numPages) * 100));
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // Render at high resolution for quality

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        if (!context) continue;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        newPageImages.push(canvas.toDataURL('image/png'));
      }
      setPageImages(newPageImages);

    } catch (error) {
      console.error('Failed to render PDF:', error);
      toast({
        title: "Error loading PDF",
        description: "There was a problem rendering the PDF file. Please try another file.",
        variant: "destructive",
      });
      setPageImages([]);
    } finally {
      if (e.target) e.target.value = '';
      setIsPdfLoading(false);
    }
  };
  
  const handleClear = () => {
    canvasRef.current?.clear();
    setPageImages([]);
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
      
                      {tool === 'draw' && (
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
                            <Button variant="ghost" size="icon" onClick={handleClear} className="h-10 w-10 rounded-lg">
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
          {isPdfLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                <p className="mb-4 text-lg font-medium">{'Loading PDF...'}</p>
                <Progress value={pdfLoadProgress} className="w-1/2 max-w-sm" />
                <p className="mt-2 text-sm text-muted-foreground">{pdfLoadProgress}%</p>
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
            pages={pageImages}
            tool={tool}
            penColor={penColor}
            penSize={penSize}
            eraserSize={eraserSize}
            highlighterSize={highlighterSize}
            highlighterColor={HIGHLIGHTER_COLOR}
            onHistoryChange={handleHistoryChange}
          />
        </main>
      </div>
    </TooltipProvider>
  );
}
