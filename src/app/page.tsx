
"use client";

import * as React from 'react';
import {
  Pencil,
  Eraser,
  Undo,
  Redo,
  Trash2,
  Highlighter,
  FileUp,
  Save,
  Camera,
  Link as LinkIcon,
  XCircle,
  StickyNote,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { DrawingCanvas, type DrawingCanvasRef, type AnnotationData } from '@/components/drawing-canvas';
import { SnapshotItem, type Snapshot } from '@/components/snapshot-item';
import { NoteItem, type Note } from '@/components/note-item';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Progress } from '@/components/ui/progress';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

type Tool = 'draw' | 'erase' | 'highlight' | 'snapshot' | 'inkling' | 'note';
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

interface PdfPoint {
  pageIndex: number;
  x: number;
  y: number;
}
interface PinupPoint {
    targetId: string;
    targetType: 'snapshot' | 'note';
    x: number;
    y: number;
}
export interface Inkling {
  id: string;
  pdfPoint: PdfPoint;
  pinupPoint: PinupPoint;
}

interface InklingRenderData {
  id: string;
  path: string;
  startCircle: { cx: number; cy: number };
  endCircle: { cx: number; cy: number };
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
  const mainContainerRef = React.useRef<HTMLDivElement>(null);
  const pdfContainerRef = React.useRef<HTMLDivElement>(null);
  const pinupContainerRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [activeCanvas, setActiveCanvas] = React.useState<'pdf' | 'pinup'>('pdf');
  
  const [pdfCanUndo, setPdfCanUndo] = React.useState(false);
  const [pdfCanRedo, setPdfCanRedo] = React.useState(false);
  const [pinupCanUndo, setPinupCanUndo] = React.useState(false);
  const [pinupCanRedo, setPinupCanRedo] = React.useState(false);

  const [snapshots, setSnapshots] = React.useState<Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = React.useState<string | null>(null);

  const [notes, setNotes] = React.useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = React.useState<string | null>(null);

  const [inklings, setInklings] = React.useState<Inkling[]>([]);
  const [pendingInkling, setPendingInkling] = React.useState<PdfPoint | null>(null);
  const [inklingRenderData, setInklingRenderData] = React.useState<InklingRenderData[]>([]);
  const [pendingInklingRenderPoint, setPendingInklingRenderPoint] = React.useState<{cx: number, cy: number} | null>(null);
  const [hoveredInkling, setHoveredInkling] = React.useState<string | null>(null);

  const [isClearConfirmOpen, setIsClearConfirmOpen] = React.useState(false);
  const [viewerWidth, setViewerWidth] = React.useState(40);

  const canUndo = activeCanvas === 'pdf' ? pdfCanUndo : pinupCanUndo;
  const canRedo = activeCanvas === 'pdf' ? pdfCanRedo : pinupCanRedo;
  const activeCanvasRef = activeCanvas === 'pdf' ? pdfCanvasRef : pinupCanvasRef;
  
  const pdfTool = ['draw', 'erase', 'highlight', 'snapshot', 'inkling'].includes(tool || '') ? tool : null;
  const pinupTool = ['note'].includes(tool || '') ? tool : null;

  const handleToolClick = (selectedTool: Tool) => {
    setTool((currentTool) => (currentTool === selectedTool ? null : selectedTool));
    if (selectedTool !== 'inkling') {
      setPendingInkling(null);
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
        inklings: inklings,
        notes: notes,
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
    setInklings([]);
    setNotes([]);
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
                  setInklings(projectData.inklings || []);
                  setNotes(projectData.notes || []);
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
        setInklings([]);
        setNotes([]);
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
    setIsClearConfirmOpen(true);
  };
  
  const handleConfirmClear = () => {
    // Clear PDF viewer
    pdfCanvasRef.current?.clear();
    setPageImages([]);
    setOriginalPdfFile(null);
    setOriginalPdfFileName(null);
    setAnnotationDataToLoad(null);

    // Clear Pinup board
    pinupCanvasRef.current?.clear();
    setSnapshots([]);
    setNotes([]);
    setInklings([]);

    setIsClearConfirmOpen(false);
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
    setInklings(inklings => inklings.filter(i => !(i.pinupPoint.targetType === 'snapshot' && i.pinupPoint.targetId === id)));
  }, []);

  const handleNoteCreate = React.useCallback((rect: { x: number; y: number; width: number; height: number }) => {
    const newNote: Note = {
      id: `note_${Date.now()}`,
      content: '',
      ...rect,
    };
    setNotes(prev => [...prev, newNote]);
    setTool(null);
  }, []);

  const updateNote = React.useCallback((id: string, newProps: Partial<Omit<Note, 'id'>>) => {
    setNotes(notes => notes.map(n => n.id === id ? {...n, ...newProps} : n));
  }, []);

  const deleteNote = React.useCallback((id: string) => {
    setNotes(notes => notes.filter(n => n.id !== id));
    setInklings(inklings => inklings.filter(i => !(i.pinupPoint.targetType === 'note' && i.pinupPoint.targetId === id)));
  }, []);


  const handleSnapshotClick = React.useCallback((snapshot: Snapshot, e: React.MouseEvent<HTMLDivElement>) => {
    if (pendingInkling) {
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const newInkling: Inkling = {
            id: `inkling_${Date.now()}`,
            pdfPoint: pendingInkling,
            pinupPoint: { targetId: snapshot.id, targetType: 'snapshot', x, y },
        };
        setInklings(prev => [...prev, newInkling]);
        setPendingInkling(null);
        setTool(null);
        toast({
            title: "Link Created!",
            description: "A new link between the PDF and the snapshot has been created.",
        });
        e.stopPropagation();
        return;
    }
    
    setSelectedSnapshot(snapshot.id);
    setSelectedNote(null);
    const pageElement = pdfCanvasRef.current?.getPageElement(snapshot.sourcePage);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [pendingInkling, toast]);

  const handleNoteClick = React.useCallback((note: Note, e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    if (pendingInkling) {
      const isHeaderClick = !!target.closest('[data-drag-handle="true"]');
      if (isHeaderClick) {
        const noteElement = e.currentTarget;
        const rect = noteElement.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
  
        const newInkling: Inkling = {
          id: `inkling_${Date.now()}`,
          pdfPoint: pendingInkling,
          pinupPoint: { targetId: note.id, targetType: 'note', x, y },
        };
        setInklings(prev => [...prev, newInkling]);
        setPendingInkling(null);
        setTool(null);
        toast({
          title: "Link Created!",
          description: "A new link between the PDF and the note has been created.",
        });
        e.stopPropagation();
      }
      return;
    }
    
    setSelectedNote(note.id);
    setSelectedSnapshot(null);
  }, [pendingInkling, toast]);

  const handleCanvasClick = (pageIndex: number, point: { x: number; y: number; }) => {
    if (tool !== 'inkling') return;
    setPendingInkling({ pageIndex, x: point.x, y: point.y });
    toast({
        title: "Link Started",
        description: "Click on a snapshot or a note's header in the pinup board to complete the link.",
    });
  };
  
  const handleInklingEndpointClick = (inklingId: string, endpoint: 'pdf' | 'pinup') => {
    const inkling = inklings.find(i => i.id === inklingId);
    if (!inkling) return;

    if (endpoint === 'pinup') {
      const pageElement = pdfCanvasRef.current?.getPageElement(inkling.pdfPoint.pageIndex);
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else { // 'pdf' endpoint clicked, go to pinup item
      const { targetId, targetType } = inkling.pinupPoint;
      const selector = targetType === 'snapshot' 
        ? `[data-snapshot-id="${targetId}"]` 
        : `[data-note-id="${targetId}"]`;
      
      const pinupElement = pinupContainerRef.current?.querySelector(selector) as HTMLDivElement;
      
      if (pinupElement) {
        pinupElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        if (targetType === 'snapshot') {
          setSelectedSnapshot(targetId);
          setSelectedNote(null);
        } else {
          setSelectedNote(targetId);
          setSelectedSnapshot(null);
        }
      }
    }
  };

  const handleDeleteInkling = (id: string) => {
    setInklings(prev => prev.filter(ink => ink.id !== id));
  };

  React.useEffect(() => {
    const mainContainer = mainContainerRef.current;
    if (!mainContainer) return;

    const pdfView = pdfContainerRef.current?.querySelector('.overflow-y-auto');
    const pinupView = pinupContainerRef.current?.querySelector('.overflow-auto');

    const updatePaths = () => {
        if (!mainContainer) return;
        const mainRect = mainContainer.getBoundingClientRect();
        
        const newRenderData: InklingRenderData[] = [];
        inklings.forEach(inkling => {
            const pdfPageElement = pdfCanvasRef.current?.getPageElement(inkling.pdfPoint.pageIndex)?.querySelector('canvas');
            const { targetId, targetType, x, y } = inkling.pinupPoint;
            const selector = targetType === 'snapshot'
                ? `[data-snapshot-id="${targetId}"]`
                : `[data-note-id="${targetId}"]`;
            const pinupElement = pinupContainerRef.current?.querySelector(selector) as HTMLDivElement;
            
            if (pdfPageElement && pinupElement) {
                const pdfRect = pdfPageElement.getBoundingClientRect();
                const pinupRect = pinupElement.getBoundingClientRect();

                const startX = pdfRect.left - mainRect.left + inkling.pdfPoint.x;
                const startY = pdfRect.top - mainRect.top + inkling.pdfPoint.y;
                const endX = pinupRect.left - mainRect.left + x;
                const endY = pinupRect.top - mainRect.top + y;
                
                const pathD = `M ${startX} ${startY} C ${startX + 50} ${startY}, ${endX - 50} ${endY}, ${endX} ${endY}`;
                newRenderData.push({
                    id: inkling.id,
                    path: pathD,
                    startCircle: { cx: startX, cy: startY },
                    endCircle: { cx: endX, cy: endY },
                });
            }
        });
        setInklingRenderData(newRenderData);

        if (pendingInkling) {
            const pdfPageElement = pdfCanvasRef.current?.getPageElement(pendingInkling.pageIndex)?.querySelector('canvas');
            if (pdfPageElement) {
                const pdfRect = pdfPageElement.getBoundingClientRect();
                const startX = pdfRect.left - mainRect.left + pendingInkling.x;
                const startY = pdfRect.top - mainRect.top + pendingInkling.y;
                setPendingInklingRenderPoint({ cx: startX, cy: startY });
            }
        } else {
            setPendingInklingRenderPoint(null);
        }
    };

    const throttledUpdate = () => requestAnimationFrame(updatePaths);
    throttledUpdate();

    window.addEventListener('resize', throttledUpdate);
    pdfView?.addEventListener('scroll', throttledUpdate);
    pinupView?.addEventListener('scroll', throttledUpdate);
    
    return () => {
      window.removeEventListener('resize', throttledUpdate);
      pdfView?.removeEventListener('scroll', throttledUpdate);
      pinupView?.removeEventListener('scroll', throttledUpdate);
    };
  }, [inklings, snapshots, pageImages, pendingInkling, notes, viewerWidth]);

  const sliderValue = tool === 'draw' ? penSize : tool === 'highlight' ? highlighterSize : eraserSize;
  const sliderMin = tool === 'draw' ? 1 : tool === 'highlight' ? 10 : 2;
  const sliderMax = tool === 'draw' ? 20 : tool === 'highlight' ? 50 : 100;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-dvh w-full flex-col bg-background text-foreground">
        <aside className="flex flex-row items-center justify-between gap-4 p-2 border-b bg-card shadow-md z-30">
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
                   <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={tool === 'inkling' ? 'secondary' : 'ghost'}
                        size="icon"
                        onClick={() => handleToolClick('inkling')}
                        className="h-10 w-10 rounded-lg"
                        disabled={pageImages.length === 0}
                      >
                        <LinkIcon className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Create Link</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={tool === 'note' ? 'secondary' : 'ghost'}
                        size="icon"
                        onClick={() => handleToolClick('note')}
                        className="h-10 w-10 rounded-lg"
                      >
                        <StickyNote className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Add Note</p></TooltipContent>
                  </Tooltip>
                </div>
            </div>
            
            <div className="flex-grow flex items-center justify-center px-4">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="w-full max-w-xs flex items-center gap-2">
                             <span className="text-sm text-muted-foreground">PDF</span>
                             <Slider
                                 value={[viewerWidth]}
                                 onValueChange={(val) => setViewerWidth(val[0])}
                                 min={20}
                                 max={80}
                                 step={1}
                                 className="w-full"
                             />
                             <span className="text-sm text-muted-foreground">Pinup</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Adjust Panel Split</p></TooltipContent>
                </Tooltip>
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
                </div>
            </div>
        </aside>

        {tool && ['draw', 'erase', 'highlight'].includes(tool) && activeCanvas === 'pdf' && (
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

        <main ref={mainContainerRef} className="flex-1 flex flex-row overflow-hidden relative">
          <div 
            ref={pdfContainerRef}
            className="flex flex-col"
            style={{ width: `${viewerWidth}%` }}
            onMouseDownCapture={() => {
              setActiveCanvas('pdf');
              setSelectedSnapshot(null);
              setSelectedNote(null);
            }}
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
                tool={pdfTool}
                penColor={penColor}
                penSize={penSize}
                eraserSize={eraserSize}
                highlighterSize={highlighterSize}
                highlighterColor={highlighterColor}
                onHistoryChange={handlePdfHistoryChange}
                initialAnnotations={annotationDataToLoad}
                toast={toast}
                onSnapshot={handleSnapshot}
                onCanvasClick={handleCanvasClick}
              />
            </div>
          </div>
          <Separator orientation="vertical" className="h-full" />
          <div 
            className="flex flex-col"
            style={{ width: `${100 - viewerWidth}%` }}
          >
              <header className="p-2 text-center font-semibold bg-card border-b">Pinup Board</header>
              <div 
                className="flex-1 relative bg-background overflow-auto"
                onMouseDownCapture={(e) => {
                  if (e.target === e.currentTarget) {
                    setActiveCanvas('pinup');
                    setSelectedSnapshot(null);
                    setSelectedNote(null);
                  }
                }}
              >
                <div
                    ref={pinupContainerRef}
                    className="relative w-full h-full p-[1%]"
                    onMouseDownCapture={() => {
                        setActiveCanvas('pinup');
                    }}
                >
                    <DrawingCanvas
                        ref={pinupCanvasRef}
                        pages={[]}
                        tool={pinupTool}
                        penColor={penColor}
                        penSize={penSize}
                        eraserSize={eraserSize}
                        highlighterSize={highlighterSize}
                        highlighterColor={highlighterColor}
                        onHistoryChange={handlePinupHistoryChange}
                        initialAnnotations={null}
                        toast={toast}
                        onNoteCreate={handleNoteCreate}
                    />
                    {snapshots.map(snapshot => (
                      <SnapshotItem 
                        key={snapshot.id}
                        snapshot={snapshot}
                        onUpdate={updateSnapshot}
                        onDelete={deleteSnapshot}
                        onClick={(e) => handleSnapshotClick(snapshot, e)}
                        isSelected={selectedSnapshot === snapshot.id}
                        onSelect={() => {
                            setSelectedSnapshot(snapshot.id);
                            setSelectedNote(null);
                        }}
                        containerRef={pinupContainerRef}
                      />
                    ))}
                    {notes.map(note => (
                      <NoteItem
                        key={note.id}
                        note={note}
                        onUpdate={updateNote}
                        onDelete={deleteNote}
                        onClick={(e) => handleNoteClick(note, e)}
                        isSelected={selectedNote === note.id}
                        containerRef={pinupContainerRef}
                      />
                    ))}
                </div>
              </div>
          </div>
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
            {inklingRenderData.map(data => (
                <g key={data.id} onMouseEnter={() => setHoveredInkling(data.id)} onMouseLeave={() => setHoveredInkling(null)}>
                    <path d={data.path} stroke="transparent" strokeWidth="15" fill="none" className="pointer-events-auto" />
                    <path 
                        d={data.path} 
                        stroke={hoveredInkling === data.id ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} 
                        strokeWidth="2" 
                        fill="none" 
                        className="transition-all pointer-events-none"
                    />

                    {/* Visible dots */}
                    <circle cx={data.startCircle.cx} cy={data.startCircle.cy} r="4" fill={hoveredInkling === data.id ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} className="transition-all pointer-events-none"/>
                    <circle cx={data.endCircle.cx} cy={data.endCircle.cy} r="4" fill={hoveredInkling === data.id ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} className="transition-all pointer-events-none"/>

                    {/* Clickable areas for endpoints */}
                    <circle cx={data.startCircle.cx} cy={data.startCircle.cy} r="10" fill="transparent" className="pointer-events-auto cursor-pointer" onClick={() => handleInklingEndpointClick(data.id, 'pdf')} />
                    <circle cx={data.endCircle.cx} cy={data.endCircle.cy} r="10" fill="transparent" className="pointer-events-auto cursor-pointer" onClick={() => handleInklingEndpointClick(data.id, 'pinup')} />

                    {hoveredInkling === data.id && (
                      <g className="pointer-events-auto cursor-pointer" onClick={() => handleDeleteInkling(data.id)}>
                          <circle cx={(data.startCircle.cx + data.endCircle.cx) / 2} cy={(data.startCircle.cy + data.endCircle.cy) / 2} r="10" fill="white" stroke="hsl(var(--destructive))" />
                          <XCircle x={(data.startCircle.cx + data.endCircle.cx) / 2 - 8} y={(data.startCircle.cy + data.endCircle.cy) / 2 - 8} size={16} className="text-destructive" />
                      </g>
                    )}
                </g>
            ))}
            {pendingInklingRenderPoint && (
                <circle 
                    cx={pendingInklingRenderPoint.cx} 
                    cy={pendingInklingRenderPoint.cy} 
                    r="5" 
                    fill="hsl(var(--primary))" 
                    stroke="white"
                    strokeWidth="2"
                    className="animate-pulse" 
                />
            )}
          </svg>
        </main>

        <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action will clear the entire canvas, including the loaded PDF, all annotations, snapshots, notes, and links. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleConfirmClear}
              >
                Yes, Clear All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </TooltipProvider>
  );
}
