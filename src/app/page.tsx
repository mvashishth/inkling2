"use client";

import * as React from 'react';
import {
  Pencil,
  Eraser,
  Download,
  Undo,
  Redo,
  Trash2,
} from 'lucide-react';
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

type Tool = 'draw' | 'erase';
const COLORS = ['#1A1A1A', '#EF4444', '#3B82F6', '#22C55E', '#EAB308'];

export default function Home() {
  const [tool, setTool] = React.useState<Tool>('draw');
  const [penSize, setPenSize] = React.useState(5);
  const [penColor, setPenColor] = React.useState(COLORS[0]);
  const [eraserSize, setEraserSize] = React.useState(20);
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);

  const canvasRef = React.useRef<DrawingCanvasRef>(null);

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
    } else {
      setEraserSize(value[0]);
    }
  };

  const sliderValue = tool === 'draw' ? penSize : eraserSize;
  const sliderMin = tool === 'draw' ? 1 : 2;
  const sliderMax = tool === 'draw' ? 20 : 100;

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
            </div>
            
            <div className="w-auto md:w-full flex flex-col items-stretch justify-center p-2 rounded-lg bg-muted/50 gap-3">
              <div className="flex flex-col items-center gap-2 px-1">
                <div className="w-full flex justify-between text-xs text-muted-foreground">
                  <span>{tool === 'draw' ? 'Width' : 'Size'}</span>
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

              {tool === 'draw' && (
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
          <DrawingCanvas
            ref={canvasRef}
            tool={tool}
            penColor={penColor}
            penSize={penSize}
            eraserSize={eraserSize}
            onHistoryChange={handleHistoryChange}
          />
        </main>
      </div>
    </TooltipProvider>
  );
}
