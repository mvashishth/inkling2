"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Expand } from 'lucide-react';
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
    const [interaction, setInteraction] = useState<{ type: 'drag' | 'resize' | null }>({ type: null });
    const hasMovedRef = useRef(false);
    const interactionStartRef = useRef({
        startX: 0,
        startY: 0,
        snapshotStartX: 0,
        snapshotStartY: 0,
        startWidth: 0,
        startHeight: 0,
    });

    const handleInteractionStart = (
        e: React.MouseEvent,
        type: 'drag' | 'resize'
    ) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
        hasMovedRef.current = false;
        
        interactionStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            snapshotStartX: snapshot.x,
            snapshotStartY: snapshot.y,
            startWidth: snapshot.width,
            startHeight: snapshot.height,
        };
        
        setInteraction({ type });
    };

    useEffect(() => {
        if (!interaction.type) return;

        const handleMouseMove = (e: MouseEvent) => {
            e.preventDefault();
            hasMovedRef.current = true;
            
            const { startX, startY, snapshotStartX, snapshotStartY, startWidth, startHeight } = interactionStartRef.current;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (interaction.type === 'drag') {
                onUpdate(snapshot.id, {
                    x: snapshotStartX + dx,
                    y: snapshotStartY + dy,
                });
            } else if (interaction.type === 'resize') {
                onUpdate(snapshot.id, {
                    width: Math.max(50, startWidth + dx),
                    height: Math.max(50, startHeight + dy),
                });
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            e.preventDefault();
            setInteraction({ type: null });
        };
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [interaction.type, onUpdate, snapshot.id]);


    return (
        <div
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
                // A brief timeout allows the mouseup from the drag to settle, preventing click from firing accidentally
                setTimeout(() => {
                    if (!hasMovedRef.current) {
                        onClick();
                    }
                }, 0);
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
                        <Expand size={12} />
                    </div>
                </>
            )}
        </div>
    );
}
