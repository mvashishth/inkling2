
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

    const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent, type: 'drag' | 'resize') => {
        if (!itemRef.current) return;
        
        e.stopPropagation();

        const isTouchEvent = 'touches' in e;
        if (isTouchEvent) {
            e.preventDefault();
        }

        const startX = isTouchEvent ? e.touches[0].clientX : e.clientX;
        const startY = isTouchEvent ? e.touches[0].clientY : e.clientY;

        const interactionStart = {
            type: type,
            clientX: startX,
            clientY: startY,
            snapshotX: snapshot.x,
            snapshotY: snapshot.y,
            snapshotWidth: snapshot.width,
            snapshotHeight: snapshot.height,
        };

        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
            if ('preventDefault' in moveEvent) {
                moveEvent.preventDefault();
            }

            const isMoveTouchEvent = 'touches' in moveEvent;
            const moveX = isMoveTouchEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const moveY = isMoveTouchEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
            
            const dx = moveX - interactionStart.clientX;
            const dy = moveY - interactionStart.clientY;

            if (interactionStart.type === 'drag') {
                itemRef.current!.style.transform = `translate(${dx}px, ${dy}px)`;
            } else { // resize
                const newWidth = Math.max(50, interactionStart.snapshotWidth + dx);
                const newHeight = Math.max(50, interactionStart.snapshotHeight + dy);
                itemRef.current!.style.width = `${newWidth}px`;
                itemRef.current!.style.height = `${newHeight}px`;
            }
        };

        const handleEnd = (upEvent: MouseEvent | TouchEvent) => {
            if (isTouchEvent) {
                window.removeEventListener('touchmove', handleMove);
                window.removeEventListener('touchend', handleEnd);
            } else {
                window.removeEventListener('mousemove', handleMove);
                window.removeEventListener('mouseup', handleEnd);
            }
            
            const isEndTouchEvent = 'changedTouches' in upEvent;
            const endX = isEndTouchEvent ? upEvent.changedTouches[0].clientX : upEvent.clientX;
            const endY = isEndTouchEvent ? upEvent.changedTouches[0].clientY : upEvent.clientY;

            const dx = endX - interactionStart.clientX;
            const dy = endY - interactionStart.clientY;

            const hasDragged = Math.sqrt(dx * dx + dy * dy) > 5;

            // Reset the temporary styles
            if (itemRef.current) {
                itemRef.current.style.transform = '';
                itemRef.current.style.width = `${snapshot.width}px`;
                itemRef.current.style.height = `${snapshot.height}px`;
            }

            if (hasDragged) {
                if (interactionStart.type === 'drag') {
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
                onSelect();
                onClick();
            }
        };

        if (isTouchEvent) {
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleEnd, { passive: false });
        } else {
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);
        }
    };

    return (
        <div
            ref={itemRef}
            style={{ 
                left: snapshot.x, 
                top: snapshot.y, 
                width: snapshot.width, 
                height: snapshot.height,
                backgroundImage: `url(${snapshot.imageDataUrl})`,
                touchAction: 'none'
            }}
            className={cn(
                "absolute border-2 bg-cover bg-center shadow-lg cursor-grab active:cursor-grabbing",
                isSelected ? "border-blue-500 ring-2 ring-blue-500 z-10" : "border-transparent hover:border-blue-500/50"
            )}
            onMouseDown={(e) => handleInteractionStart(e, 'drag')}
            onTouchStart={(e) => handleInteractionStart(e, 'drag')}
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
                        onTouchStart={(e) => { e.stopPropagation(); onDelete(snapshot.id); }}
                        className="absolute -top-3 -right-3 bg-destructive text-destructive-foreground rounded-full p-0.5 z-20 flex items-center justify-center hover:scale-110 transition-transform"
                        aria-label="Delete snapshot"
                    >
                        <X size={14} />
                    </button>
                    <div 
                        onMouseDown={(e) => handleInteractionStart(e, 'resize')}
                        onTouchStart={(e) => handleInteractionStart(e, 'resize')}
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
