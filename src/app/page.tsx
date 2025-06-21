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

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

type Tool = 'draw' | 'erase' | 'highlight';
const COLORS = ['#1A1A1A', '#EF4444', '#3B82F6', '#22C55E', '#EAB308'];

export default function Home() {
  const [tool, setTool] = React.useState<Tool>('draw');
  const [penSize, setPenSize] = React.useState(5);
  const [penColor, setPenColor] = React.useState(COLORS[0]);
  const [eraserSize, setEraserSize] = React.useState(20);
  const [highlighterSize, setHighlighterSize] = React.useState(20);
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);

  const canvasRef = React.useRef<DrawingCanvasRef>(null);
  const pdfInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleExport = () => {
    const dataUrl = canvasRef.current?.exportAsDataURL();
    if (dataUrl) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'inkling-drawing.png';
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

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      const page = await pdf.getPage(1); // Render first page

      const viewport = page.getViewport({ scale: 2.0 }); // Render at 2x scale for quality

      const tempCanvas = document.createElement('canvas');
      const tempContext = tempCanvas.getContext('2d');
      if (!tempContext) return;

      tempCanvas.width = viewport.width;
      tempCanvas.height = viewport.height;

      await page.render({
        canvasContext: tempContext,
        viewport: viewport,
      }).promise;

      const dataUrl = tempCanvas.toDataURL('image/png');
      canvasRef.current?.loadImage(dataUrl);

    } catch (error) {
      console.error('Failed to render PDF:', error);
      toast({
        title: "Error loading PDF",
        description: "There was a problem rendering the PDF file. Please try another file.",
        variant: "destructive",
      });
    } finally {
      // Reset file input to allow uploading the same file again
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const sliderValue = tool === 'draw' ? penSize : tool === 'highlight' ? highlighterSize : eraserSize;
  const sliderMin = tool === 'draw' ? 1 : tool === 'highlight' ? 10 : 2;
  const sliderMax = tool === 'draw' ? 20 : tool === 'highlight' ? 50 : 100;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-dvh w-full flex-col md:flex-row bg-background text-foreground overflow-hidden">
        <aside className="w-full md:w-24 flex flex-row md:flex-col items-center gap-4 p-2 md:p-4 border-b md:border-r bg-card shadow-md md:shadow-lg">
          <div className="flex flex-row md:flex-col items-center gap-2 md:gap-4">
            <h1 className="font-headline text-2xl font-bold hidden md:block">Inkling</h1>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={tool === 'draw' ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setTool('draw')}
                    className="h-12 w-12 rounded-lg data-[state=active]:bg-accent"
                  >
                    <Pencil className="h-6 w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right"><p>Draw</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={tool === 'erase' ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setTool('erase')}
                    className="h-12 w-12 rounded-lg data-[state=active]:bg-accent"
                  >
                    <Eraser className="h-6 w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right"><p>Eraser</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={tool === 'highlight' ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setTool('highlight')}
                    className="h-12 w-12 rounded-lg data-[state=active]:bg-accent"
                  >
                    <Highlighter className="h-6 w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right"><p>Highlight</p></TooltipContent>
              </Tooltip>
            </div>
            
            <div className="w-auto md:w-full flex flex-col items-stretch justify-center p-2 rounded-lg bg-muted/50 gap-3">
              <div className="flex flex-col items-center gap-2 px-1">
                <div className="w-full flex justify-between text-xs text-muted-foreground">
                  <span>{tool === 'erase' ? 'Size' : 'Width'}</span>
                  <span>{sliderValue}</span>
                </div>
                <Slider
                  value={[sliderValue]}
                  max={sliderMax}
                  min={sliderMin}
                  step={1}
                  onValueChange={handleSliderChange}
                  className="w-28 md:w-full"
                />
              </div>

              {(tool === 'draw' || tool === 'highlight') && (
                <>
                  <Separator className="bg-muted-foreground/20" />
                  <div className="flex flex-row flex-wrap justify-center gap-2">
                    {COLORS.map((color) => (
                      <Tooltip key={color}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setPenColor(color)}
                            className={cn(
                              'h-7 w-7 rounded-full border-2 transition-all hover:scale-110',
                              penColor === color
                                ? 'border-primary'
                                : 'border-muted-foreground/20'
                            )}
                            style={{ backgroundColor: color }}
                            aria-label={`Set pen color to ${color}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{color.toUpperCase()}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            <Separator className="hidden md:block" />
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => canvasRef.current?.undo()} disabled={!canUndo} className="h-12 w-12 rounded-lg">
                    <Undo className="h-6 w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right"><p>Undo</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => canvasRef.current?.redo()} disabled={!canRedo} className="h-12 w-12 rounded-lg">
                    <Redo className="h-6 w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right"><p>Redo</p></TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex flex-row md:flex-col items-center gap-2 ml-auto md:ml-0 md:mt-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handlePdfUploadClick} className="h-12 w-12 rounded-lg">
                  <FileUp className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>Upload PDF</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => canvasRef.current?.clear()} className="h-12 w-12 rounded-lg">
                  <Trash2 className="h-6 w-6 text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>Clear Canvas</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleExport} className="h-12 w-12 rounded-lg">
                  <Download className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>Export as PNG</p></TooltipContent>
            </Tooltip>
          </div>
        </aside>

        <main className="flex-1 relative bg-background overflow-auto">
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
