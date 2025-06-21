
"use client";

import React, { useRef } from 'react';
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
    const itemRef = useRef<HTMLDivElement>(null);

    const handleInteractionStart = (e: React.MouseEvent, type: 'drag' | 'resize') => {
        if (!itemRef.current) return;
        
        // Prevent default browser behavior, like text selection or image dragging
        e.preventDefault();
        e.stopPropagation();

        const interactionStart = {
            type: type,
            clientX: e.clientX,
            clientY: e.clientY,
            snapshotX: snapshot.x,
            snapshotY: snapshot.y,
            snapshotWidth: snapshot.width,
            snapshotHeight: snapshot.height,
        };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            moveEvent.preventDefault();
            const dx = moveEvent.clientX - interactionStart.clientX;
            const dy = moveEvent.clientY - interactionStart.clientY;

            if (interactionStart.type === 'drag') {
                // By using transform, we don't trigger React re-renders during the drag.
                itemRef.current!.style.transform = `translate(${dx}px, ${dy}px)`;
            } else { // resize
                const newWidth = Math.max(50, interactionStart.snapshotWidth + dx);
                const newHeight = Math.max(50, interactionStart.snapshotHeight + dy);
                itemRef.current!.style.width = `${newWidth}px`;
                itemRef.current!.style.height = `${newHeight}px`;
            }
        };

        const handleMouseUp = (upEvent: MouseEvent) => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            
            const dx = upEvent.clientX - interactionStart.clientX;
            const dy = upEvent.clientY - interactionStart.clientY;

            const hasDragged = Math.sqrt(dx * dx + dy * dy) > 5;

            // Reset the temporary styles
            itemRef.current!.style.transform = '';
            itemRef.current!.style.width = `${snapshot.width}px`;
            itemRef.current!.style.height = `${snapshot.height}px`;

            if (hasDragged) {
                if (interactionStart.type === 'drag') {
                    // Now we call onUpdate once with the final position.
                    onUpdate(snapshot.id, {
                        x: interactionStart.snapshotX + dx,
                        y: interactionStart.snapshotY + dy,
                    });
                } else { // resize
                     onUpdate(snapshot.id, {
                        width: Math.max(50, interactionStart.snapshotWidth + dx),
                        height: Math.max(50, interactionStart.snapshotHeight + dy),
                    });
                }
            } else {
                // If it wasn't a drag, it was a click.
                onSelect();
                onClick();
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

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
