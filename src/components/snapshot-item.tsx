
"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, ArrowsExpand } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Snapshot {
    id: string;
    imageDataUrl: string;
    x: number;
    y: number;
    width: number;
    height: number;
    sourcePage: number;
    sourceRect: { x: number; y: number; width: number; height: number };
}
  
interface SnapshotItemProps {
    snapshot: Snapshot;
    onUpdate: (id: string, newProps: Partial<Omit<Snapshot, 'id'>>) => void;
    onDelete: (id: string) => void;
    onClick: () => void;
    isSelected: boolean;
    onSelect: () => void;
}

export const SnapshotItem: React.FC<SnapshotItemProps> = ({ snapshot, onUpdate, onDelete, onClick, isSelected, onSelect }) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const interactionRef = useRef<{
        type: 'drag' | 'resize' | null;
        offsetX: number;
        offsetY: number;
        startWidth: number;
        startHeight: number;
    }>({ type: null, offsetX: 0, offsetY: 0, startWidth: 0, startHeight: 0 });
    const hasMovedRef = useRef(false);

    const handleInteractionStart = (
        e: React.MouseEvent,
        type: 'drag' | 'resize'
    ) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
        hasMovedRef.current = false;
        
        interactionRef.current = {
            type,
            offsetX: e.clientX,
            offsetY: e.clientY,
            startWidth: snapshot.width,
            startHeight: snapshot.height,
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const { type, offsetX, offsetY, startWidth, startHeight } = interactionRef.current;
        if (!type) return;

        hasMovedRef.current = true;
        const dx = e.clientX - offsetX;
        const dy = e.clientY - offsetY;

        if (type === 'drag') {
            onUpdate(snapshot.id, {
                x: snapshot.x + dx,
                y: snapshot.y + dy,
            });
        } else if (type === 'resize') {
            onUpdate(snapshot.id, {
                width: Math.max(50, startWidth + dx),
                height: Math.max(50, startHeight + dy),
            });
        }
        
        interactionRef.current.offsetX = e.clientX;
        interactionRef.current.offsetY = e.clientY;
    }, [snapshot, onUpdate]);

    const handleMouseUp = useCallback(() => {
        interactionRef.current.type = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        
        // Use a timeout to reset hasMovedRef to allow click event to process
        setTimeout(() => {
            hasMovedRef.current = false;
        }, 0);
    }, [handleMouseMove]);
    
    useEffect(() => {
        // Cleanup listeners on unmount
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);


    return (
        <div
            ref={itemRef}
            style={{ 
                left: snapshot.x, 
                top: snapshot.y, 
                width: snapshot.width, 
                height: snapshot.height,
                backgroundImage: `url(${snapshot.imageDataUrl})`
            }}
            className={cn(
                "absolute border-2 bg-cover bg-center shadow-lg cursor-grab active:cursor-grabbing",
                isSelected ? "border-blue-500 ring-2 ring-blue-500 z-10" : "border-transparent hover:border-blue-500/50"
            )}
            onMouseDown={(e) => handleInteractionStart(e, 'drag')}
            onClickCapture={(e) => {
                e.stopPropagation();
                if (!hasMovedRef.current) {
                    onClick();
                }
            }}
            data-ai-hint="pdf snapshot"
        >
            {isSelected && (
                <>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(snapshot.id);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="absolute -top-3 -right-3 bg-destructive text-destructive-foreground rounded-full p-0.5 z-20 flex items-center justify-center hover:scale-110 transition-transform"
                        aria-label="Delete snapshot"
                    >
                        <X size={14} />
                    </button>
                    <div 
                        onMouseDown={(e) => handleInteractionStart(e, 'resize')}
                        className="absolute -bottom-2 -right-2 bg-blue-500 text-white rounded-full p-1 z-20 cursor-nwse-resize hover:scale-110 transition-transform"
                        aria-label="Resize snapshot"
                    >
                        <ArrowsExpand size={12} />
                    </div>
                </>
            )}
        </div>
    );
}
