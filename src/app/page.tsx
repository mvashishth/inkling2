
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
  Save,
  Camera,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { DrawingCanvas, type DrawingCanvasRef, type AnnotationData } from '@/components/drawing-canvas';
import { SnapshotItem, type Snapshot } from '@/components/snapshot-item';
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

type Tool = 'draw' | 'erase' | 'highlight' | 'snapshot';
const COLORS = ['#1A1A1A', '#EF4444', '#3B82F6', '#22C55E', '#EAB308'];

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const CHUNK_SIZE = 0x8000;
    const bytes = new Uint8Array(buffer);
    let result = '';
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, i + CHUNK_SIZE);
        result += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(result);
}

export default function Home() {
  const [tool, setTool] = React.useState<Tool | null>(null);
  const [penSize, setPenSize] = React.useState(5);
  const [penColor, setPenColor] = React.useState(COLORS[0]);
  const [highlighterColor, setHighlighterColor] = React.useState(COLORS[3]);
  const [eraserSize, setEraserSize] = React.useState(20);
  const [highlighterSize, setHighlighterSize] = React.useState(20);
  
  const [pageImages, setPageImages] = React.useState<string[]>([]);
  
  const [isPdfLoading, setIsPdfLoading] = React.useState(false);
  const [pdfLoadProgress, setPdfLoadProgress] = React.useState(0);
  const [originalPdfFile, setOriginalPdfFile] = React.useState<ArrayBuffer | null>(null);
  const [originalPdfFileName, setOriginalPdfFileName] = React.useState<string | null>(null);
  const [annotationDataToLoad, setAnnotationDataToLoad] = React.useState<AnnotationData | null>(null);

  const pdfCanvasRef = React.useRef<DrawingCanvasRef>(null);
  const pinupCanvasRef = React.useRef<DrawingCanvasRef>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [activeCanvas, setActiveCanvas] = React.useState<'pdf' | 'pinup'>('pdf');
  
  const [pdfCanUndo, setPdfCanUndo] = React.useState(false);
  const [pdfCanRedo, setPdfCanRedo] = React.useState(false);
  const [pinupCanUndo, setPinupCanUndo] = React.useState(false);
  const [pinupCanRedo, setPinupCanRedo] = React.useState(false);

  const [snapshots, setSnapshots] = React.useState<Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = React.useState<string | null>(null);

  const canUndo = activeCanvas === 'pdf' ? pdfCanUndo : pinupCanUndo;
  const canRedo = activeCanvas === 'pdf' ? pdfCanRedo : pinupCanRedo;
  const activeCanvasRef = activeCanvas === 'pdf' ? pdfCanvasRef : pinupCanvasRef;
  const currentTool = activeCanvas === 'pdf' ? tool : null;

  const handleToolClick = (selectedTool: Tool) => {
    setTool((currentTool) => (currentTool === selectedTool ? null : selectedTool));
  };

  const handleExport = () => {
    const exportData = activeCanvasRef.current?.exportAsDataURL();
    if (exportData?.dataUrl) {
      const link = document.createElement('a');
      link.href = exportData.dataUrl;
      const fileName = activeCanvas === 'pdf'
        ? `inkling-drawing-page-${exportData.pageNum}.png`
        : 'inkling-pinup-board.png';
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSave = () => {
    if (!originalPdfFile) {
        toast({
            title: "Cannot Save",
            description: "Please upload a PDF before saving.",
            variant: "destructive",
        });
        return;
    }
    const annotationData = pdfCanvasRef.current?.getAnnotationData();
    if (!annotationData) return;
    
    const defaultFileName = originalPdfFileName ? originalPdfFileName.replace(/\.pdf$/i, '') : 'annotated-project';
    const chosenFileName = window.prompt("Enter filename for your project:", defaultFileName);

    if (!chosenFileName) {
        return;
    }

    const pdfDataBase64 = arrayBufferToBase64(originalPdfFile.slice(0));

    const projectData = {
        originalPdfFileName: originalPdfFileName,
        pdfDataBase64: pdfDataBase64,
        annotations: annotationData,
        snapshots: snapshots,
        fileType: 'inkling-project'
    };
    
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const downloadFileName = chosenFileName.endsWith('.json') ? chosenFileName : `${chosenFileName}.json`;
    link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePdfHistoryChange = React.useCallback((canUndo: boolean, canRedo: boolean) => {
    setPdfCanUndo(canUndo);
    setPdfCanRedo(canRedo);
  }, []);

  const handlePinupHistoryChange = React.useCallback((canUndo: boolean, canRedo: boolean) => {
    setPinupCanUndo(canUndo);
    setPinupCanRedo(canRedo);
  }, []);

  const handleSliderChange = (value: number[]) => {
    if (tool === 'draw') {
      setPenSize(value[0]);
    } else if (tool === 'highlight') {
      setHighlighterSize(value[0]);
    } else {
      setEraserSize(value[0]);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  const loadPdf = async (arrayBuffer: ArrayBuffer) => {
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      toast({
        title: "Cannot load PDF",
        description: "The provided file is empty or invalid.",
        variant: "destructive",
      });
      setIsPdfLoading(false);
      return;
    }

    setIsPdfLoading(true);
    setPdfLoadProgress(0);
    setPageImages([]);
    setSnapshots([]);
    pdfCanvasRef.current?.clear();
    pinupCanvasRef.current?.clear();

    try {
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      loadingTask.onProgress = (progressData) => {};
      
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      pdfCanvasRef.current?.initializePages(numPages);

      const newPageImages: string[] = [];
      
      for (let i = 1; i <= numPages; i++) {
        setPdfLoadProgress(Math.round((i / numPages) * 100));
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); 

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
      setIsPdfLoading(false);
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const projectData = JSON.parse(event.target?.result as string);
              if (projectData.fileType === 'inkling-project' && projectData.pdfDataBase64 && projectData.annotations) {
                  const byteCharacters = window.atob(projectData.pdfDataBase64);
                  const byteNumbers = new Array(byteCharacters.length);
                  for (let i = 0; i < byteCharacters.length; i++) {
                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                  }
                  const byteArray = new Uint8Array(byteNumbers);
                  const arrayBuffer = byteArray.buffer;
                  
                  setOriginalPdfFile(arrayBuffer.slice(0));
                  setOriginalPdfFileName(projectData.originalPdfFileName || file.name.replace(/\.json$/i, ".pdf"));
                  setAnnotationDataToLoad(projectData.annotations);
                  setSnapshots(projectData.snapshots || []);
                  await loadPdf(arrayBuffer.slice(0));
              } else {
                  throw new Error("Invalid project file format.");
              }
          } catch (error) {
              console.error('Failed to load project file:', error);
              toast({
                  title: "Error loading project",
                  description: "The selected file is not a valid project file.",
                  variant: "destructive",
              });
          }
      };
      reader.readAsText(file);
    } else if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        setOriginalPdfFile(arrayBuffer.slice(0));
        setOriginalPdfFileName(file.name);
        setAnnotationDataToLoad(null);
        setSnapshots([]);
        await loadPdf(arrayBuffer.slice(0));
    } else {
        toast({
            title: "Unsupported File Type",
            description: "Please upload a PDF or a saved .json project file.",
            variant: "destructive",
        });
    }

    if (e.target) e.target.value = '';
  };
  
  const handleClear = () => {
    if (activeCanvas === 'pdf') {
        pdfCanvasRef.current?.clear();
        setPageImages([]);
        setOriginalPdfFile(null);
        setOriginalPdfFileName(null);
        setAnnotationDataToLoad(null);
        setSnapshots([]);
    } else {
        pinupCanvasRef.current?.clear();
        setSnapshots([]);
    }
  };

  const handleSnapshot = React.useCallback((
    imageDataUrl: string,
    sourcePage: number,
    sourceRect: { x: number; y: number; width: number; height: number }
  ) => {
    const newSnapshot: Snapshot = {
      id: `snapshot_${Date.now()}`,
      imageDataUrl,
      x: 50,
      y: 50,
      width: sourceRect.width,
      height: sourceRect.height,
      sourcePage,
      sourceRect,
    };
    setSnapshots((prev) => [...prev, newSnapshot]);
    setTool(null);
  }, []);

  const updateSnapshot = React.useCallback((id: string, newProps: Partial<Omit<Snapshot, 'id'>>) => {
    setSnapshots(snapshots => snapshots.map(s => s.id === id ? {...s, ...newProps} : s));
  }, []);

  const deleteSnapshot = React.useCallback((id: string) => {
    setSnapshots(snapshots => snapshots.filter(s => s.id !== id));
  }, []);

  const handleSnapshotClick = React.useCallback((snapshot: Snapshot) => {
    const pageElement = pdfCanvasRef.current?.getPageElement(snapshot.sourcePage);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={tool === 'snapshot' ? 'secondary' : 'ghost'}
                        size="icon"
                        onClick={() => handleToolClick('snapshot')}
                        className="h-10 w-10 rounded-lg"
                        disabled={pageImages.length === 0}
                      >
                        <Camera className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Snapshot</p></TooltipContent>
                  </Tooltip>
                </div>
            </div>

            <div className="flex items-center gap-x-2 sm:gap-x-4">
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => activeCanvasRef.current?.undo()} disabled={!canUndo} className="h-10 w-10 rounded-lg">
                        <Undo className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Undo</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => activeCanvasRef.current?.redo()} disabled={!canRedo} className="h-10 w-10 rounded-lg">
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
                            <Button variant="ghost" size="icon" onClick={handleUploadClick} className="h-10 w-10 rounded-lg" disabled={isPdfLoading}>
                            <FileUp className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom"><p>Open PDF or Project</p></TooltipContent>
                    </Tooltip>
                     <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={handleSave} className="h-10 w-10 rounded-lg" disabled={!originalPdfFile}>
                            <Save className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom"><p>Save Project</p></TooltipContent>
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

        {tool && tool !== 'snapshot' && activeCanvas === 'pdf' && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-x-8 px-4 py-2 border-b bg-card shadow-sm z-10">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {tool === 'erase' ? 'Size' : 'Width'}:
                    </span>
                    <Slider
                        value={[sliderValue]}
                        max={sliderMax}
                        min={sliderMin}
                        step={1}
                        onValueChange={handleSliderChange}
                        className="w-32"
                    />
                    <span className="text-sm font-mono w-8 text-center bg-muted/50 rounded-md py-0.5">
                        {sliderValue}
                    </span>
                </div>

                {(tool === 'draw' || tool === 'highlight') && (
                    <>
                        <Separator orientation="vertical" className="h-8 hidden sm:block" />
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">Color:</span>
                            <div className="flex flex-row flex-wrap justify-center gap-2">
                                {COLORS.map((color) => (
                                    <Tooltip key={color}>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={() => {
                                                    if (tool === 'draw') {
                                                        setPenColor(color);
                                                    } else if (tool === 'highlight') {
                                                        setHighlighterColor(color);
                                                    }
                                                }}
                                                className={cn(
                                                    'h-6 w-6 rounded-full border-2 transition-all hover:scale-110',
                                                    (tool === 'draw' && penColor === color) || (tool === 'highlight' && highlighterColor === color)
                                                        ? 'border-primary'
                                                        : 'border-muted-foreground/20'
                                                )}
                                                style={{ backgroundColor: color }}
                                                aria-label={`Set color to ${color}`}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">
                                            <p>{color.toUpperCase()}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        )}

        <main className="flex-1 flex flex-row overflow-hidden">
          <div 
            className="w-3/5 flex flex-col"
            onMouseDownCapture={() => setActiveCanvas('pdf')}
          >
            <div 
              className="flex-1 relative bg-background overflow-auto"
            >
              {isPdfLoading && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                    <p className="mb-4 text-lg font-medium">{'Loading PDF...'}</p>
                    <Progress value={pdfLoadProgress} className="w-1/2 max-w-sm" />
                    <p className="mt-2 text-sm text-muted-foreground">{pdfLoadProgress}%</p>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="application/pdf,application/json"
                className="hidden"
              />
              <DrawingCanvas
                ref={pdfCanvasRef}
                pages={pageImages}
                tool={currentTool}
                penColor={penColor}
                penSize={penSize}
                eraserSize={eraserSize}
                highlighterSize={highlighterSize}
                highlighterColor={highlighterColor}
                onHistoryChange={handlePdfHistoryChange}
                initialAnnotations={annotationDataToLoad}
                toast={toast}
                onSnapshot={handleSnapshot}
              />
            </div>
          </div>
          <Separator orientation="vertical" className="h-full" />
          <div className="w-2/5 flex flex-col">
              <header className="p-2 text-center font-semibold bg-card border-b">Pinup Board</header>
              <div 
                className="flex-1 relative bg-background overflow-auto"
                onMouseDownCapture={(e) => {
                  setActiveCanvas('pinup');
                  if(e.target === e.currentTarget) {
                    setSelectedSnapshot(null);
                  }
                }}
              >
                <DrawingCanvas
                    ref={pinupCanvasRef}
                    pages={[]}
                    tool={null}
                    penColor={penColor}
                    penSize={penSize}
                    eraserSize={eraserSize}
                    highlighterSize={highlighterSize}
                    highlighterColor={highlighterColor}
                    onHistoryChange={handlePinupHistoryChange}
                    initialAnnotations={null}
                    toast={toast}
                />
                {snapshots.map(snapshot => (
                  <SnapshotItem 
                    key={snapshot.id}
                    snapshot={snapshot}
                    onUpdate={updateSnapshot}
                    onDelete={deleteSnapshot}
                    onClick={() => handleSnapshotClick(snapshot)}
                    isSelected={selectedSnapshot === snapshot.id}
                    onSelect={() => setSelectedSnapshot(snapshot.id)}
                  />
                ))}
              </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
