
"use client";

import React, { useRef, useEffect, useState } from 'react';
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
    const [interaction, setInteraction] = useState<'drag' | 'resize' | null>(null);
    const hasMovedRef = useRef(false);
    const interactionStartRef = useRef<{
        clientX: number;
        clientY: number;
        snapshotX: number;
        snapshotY: number;
        snapshotWidth: number;
        snapshotHeight: number;
    } | null>(null);

    useEffect(() => {
        if (!interaction) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!interactionStartRef.current) return;
            e.preventDefault();

            if (!hasMovedRef.current) {
                const dx = e.clientX - interactionStartRef.current.clientX;
                const dy = e.clientY - interactionStartRef.current.clientY;
                if (Math.sqrt(dx * dx + dy * dy) > 3) {
                    hasMovedRef.current = true;
                }
            }

            if (!hasMovedRef.current) return;

            const { clientX, clientY, snapshotX, snapshotY, snapshotWidth, snapshotHeight } = interactionStartRef.current;
            const dx = e.clientX - clientX;
            const dy = e.clientY - clientY;

            if (interaction === 'drag') {
                onUpdate(snapshot.id, { x: snapshotX + dx, y: snapshotY + dy });
            } else if (interaction === 'resize') {
                onUpdate(snapshot.id, {
                    width: Math.max(50, snapshotWidth + dx),
                    height: Math.max(50, snapshotHeight + dy),
                });
            }
        };

        const handleMouseUp = () => {
            if (!hasMovedRef.current) {
                onSelect();
                onClick();
            }
            setInteraction(null);
            interactionStartRef.current = null;
        };
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp, { once: true });

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [interaction, onUpdate, onClick, onSelect, snapshot.id]);

    const handleInteractionStart = (e: React.MouseEvent, type: 'drag' | 'resize') => {
        e.preventDefault();
        e.stopPropagation();
        
        hasMovedRef.current = false;
        setInteraction(type);

        interactionStartRef.current = {
            clientX: e.clientX,
            clientY: e.clientY,
            snapshotX: snapshot.x,
            snapshotY: snapshot.y,
            snapshotWidth: snapshot.width,
            snapshotHeight: snapshot.height,
        };
    };

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
