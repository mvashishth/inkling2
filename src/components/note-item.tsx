
"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { X, Expand } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from './ui/textarea';

export interface Note {
    id: string;
    content: string;
    x: number;
    y: number;
    width: number;
    height: number;
}
  
interface NoteItemProps {
    note: Note;
    onUpdate: (id: string, newProps: Partial<Omit<Note, 'id'>>) => void;
    onDelete: (id:string) => void;
    isSelected: boolean;
    onSelect: () => void;
    containerRef: React.RefObject<HTMLDivElement>;
}

export const NoteItem: React.FC<NoteItemProps> = ({ note, onUpdate, onDelete, isSelected, onSelect, containerRef }) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const interactionRef = useRef<{
        type: 'drag' | 'resize';
        startX: number;
        startY: number;
    } | null>(null);
    
    const getEventPoint = (e: MouseEvent | TouchEvent) => {
        const point = 'touches' in e ? (e.touches[0] || e.changedTouches[0]) : e;
        return { clientX: point.clientX, clientY: point.clientY };
    };

    const handleInteractionStart = useCallback((e: React.MouseEvent | React.TouchEvent, type: 'drag' | 'resize') => {
        if (!containerRef.current) return;
        
        const target = e.target as HTMLElement;
        const isResizeHandle = target.closest('[aria-label="Resize note"]');
        const isDeleteHandle = target.closest('[aria-label="Delete note"]');

        if (type === 'drag' && (isResizeHandle || isDeleteHandle)) {
            return;
        }

        e.stopPropagation();
        if ('button' in e && e.button !== 0) return;

        const point = getEventPoint(e.nativeEvent);

        interactionRef.current = {
            type: type,
            startX: point.clientX,
            startY: point.clientY,
        };
        
        onSelect();

        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (e.cancelable) e.preventDefault();
            const { clientX, clientY } = getEventPoint(e);
            
            requestAnimationFrame(() => {
                if (!interactionRef.current || !itemRef.current) return;
                
                const dx = clientX - interactionRef.current.startX;
                const dy = clientY - interactionRef.current.startY;
                const { type } = interactionRef.current;
                
                const currentX = parseFloat(itemRef.current.style.getPropertyValue('--x'));
                const currentY = parseFloat(itemRef.current.style.getPropertyValue('--y'));
                const currentWidth = parseFloat(itemRef.current.style.getPropertyValue('--w'));
                const currentHeight = parseFloat(itemRef.current.style.getPropertyValue('--h'));

                if (type === 'drag') {
                    itemRef.current.style.transform = `translate(${currentX + dx}px, ${currentY + dy}px)`;
                } else if (type === 'resize') {
                    itemRef.current.style.width = `${Math.max(100, currentWidth + dx)}px`;
                    itemRef.current.style.height = `${Math.max(80, currentHeight + dy)}px`;
                }
            });
        };

        const handleEnd = (e: MouseEvent | TouchEvent) => {
            if (e.cancelable) e.preventDefault();
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('touchend', handleEnd);

            if (!interactionRef.current || !containerRef.current) return;

            const { clientX, clientY } = getEventPoint(e);
            const dx = clientX - interactionRef.current.startX;
            const dy = clientY - interactionRef.current.startY;
            const { type } = interactionRef.current;
            
            const padding = containerRef.current.clientWidth * 0.01;
            const containerWidth = containerRef.current.clientWidth - 2 * padding;
            const containerHeight = containerRef.current.clientHeight - 2 * padding;

            let newX = note.x;
            let newY = note.y;
            let newWidth = note.width;
            let newHeight = note.height;

            if (type === 'drag') {
                newX += dx;
                newY += dy;
            } else if (type === 'resize') {
                newWidth = Math.max(100, newWidth + dx);
                newHeight = Math.max(80, newHeight + dy);
            }
            
            newX = Math.max(0, Math.min(newX, containerWidth - newWidth));
            newY = Math.max(0, Math.min(newY, containerHeight - newHeight));

            onUpdate(note.id, { x: newX, y: newY, width: newWidth, height: newHeight });

            interactionRef.current = null;
        };

        document.addEventListener('mousemove', handleMove, { passive: false });
        document.addEventListener('mouseup', handleEnd, { passive: false });
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', handleEnd, { passive: false });

    }, [containerRef, note.id, note.x, note.y, note.width, note.height, onUpdate, onSelect]);

    useEffect(() => {
        if (!itemRef.current) return;
        itemRef.current.style.setProperty('--x', `${note.x}px`);
        itemRef.current.style.setProperty('--y', `${note.y}px`);
        itemRef.current.style.setProperty('--w', `${note.width}px`);
        itemRef.current.style.setProperty('--h', `${note.height}px`);
        itemRef.current.style.transform = `translate(${note.x}px, ${note.y}px)`;
        itemRef.current.style.width = `${note.width}px`;
        itemRef.current.style.height = `${note.height}px`;
    }, [note.x, note.y, note.width, note.height]);
    
    useEffect(() => {
        if (!containerRef.current || interactionRef.current) return;
        
        const { id, x, y, width, height } = note;
        const container = containerRef.current;
        const padding = container.clientWidth * 0.01;
        const containerWidth = container.clientWidth - 2 * padding;

        let newX = x;
        let newWidth = width;

        if (width > containerWidth) {
          newWidth = containerWidth * 0.7;
        }

        newX = Math.max(0, Math.min(newX, containerWidth - newWidth));
        
        if (Math.abs(newX - x) > 1 || Math.abs(newWidth - width) > 1) {
          onUpdate(id, { x: newX, width: newWidth });
        }
      }, [note, containerRef, onUpdate]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate(note.id, { content: e.target.value });
    };

    return (
        <div
            ref={itemRef}
            style={{
                position: 'absolute',
                left: 0,
                top: 0,
                touchAction: 'none'
            }}
            className={cn(
                "shadow-lg bg-yellow-200/80 backdrop-blur-sm p-2 rounded-md flex flex-col",
                isSelected ? "z-10" : "z-0",
            )}
            onMouseDown={(e) => handleInteractionStart(e, 'drag')}
            onTouchStart={(e) => handleInteractionStart(e, 'drag')}
            onClick={(e) => {
                const target = e.target as HTMLElement;
                if(target.closest('[aria-label="Resize note"]') || target.closest('[aria-label="Delete note"]')) {
                    return;
                }
                onSelect();
            }}
            data-ai-hint="sticky note"
            data-note-id={note.id}
        >
             <div className={cn(
                "w-full h-full border-2 rounded-md flex flex-col",
                isSelected ? "border-blue-500 ring-2 ring-blue-500" : "border-transparent",
            )}>
                <Textarea
                    value={note.content}
                    onChange={handleTextChange}
                    placeholder="Type your note..."
                    className="flex-grow w-full h-full bg-transparent border-0 focus-visible:ring-0 resize-none p-1 text-sm"
                />
            </div>
            {isSelected && (
                <>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(note.id);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => { e.stopPropagation(); onDelete(note.id); }}
                        className="absolute -top-3 -right-3 bg-destructive text-destructive-foreground rounded-full p-0.5 z-20 flex items-center justify-center hover:scale-110 transition-transform"
                        aria-label="Delete note"
                    >
                        <X size={14} />
                    </button>
                    <div 
                        onMouseDown={(e) => handleInteractionStart(e, 'resize')}
                        onTouchStart={(e) => handleInteractionStart(e, 'resize')}
                        className={cn(
                            "absolute -bottom-2 -right-2 bg-blue-500 text-white rounded-full p-1 z-20 cursor-se-resize hover:scale-110 transition-transform"
                        )}
                        aria-label="Resize note"
                    >
                        <Expand size={12} />
                    </div>
                </>
            )}
        </div>
    );
}
