
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
    containerRef: React.RefObject<HTMLDivElement>;
}

export const SnapshotItem: React.FC<SnapshotItemProps> = ({ snapshot, onUpdate, onDelete, onClick, isSelected, onSelect, containerRef }) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const interactionStartRef = useRef<{
        type: 'drag' | 'resize';
        clientX: number;
        clientY: number;
        snapshotX: number;
        snapshotY: number;
        snapshotWidth: number;
        snapshotHeight: number;
    } | null>(null);

    const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent, type: 'drag' | 'resize') => {
        if (!itemRef.current || !containerRef.current) return;
        
        e.preventDefault();
        e.stopPropagation();

        const isTouchEvent = 'touches' in e;
        const startX = isTouchEvent ? e.touches[0].clientX : e.clientX;
        const startY = isTouchEvent ? e.touches[0].clientY : e.clientY;

        interactionStartRef.current = {
            type: type,
            clientX: startX,
            clientY: startY,
            snapshotX: snapshot.x,
            snapshotY: snapshot.y,
            snapshotWidth: snapshot.width,
            snapshotHeight: snapshot.height,
        };

        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
            if ('preventDefault' in moveEvent && moveEvent.cancelable) {
                moveEvent.preventDefault();
            }
            if (!itemRef.current || !containerRef.current || !interactionStartRef.current) return;

            const isMoveTouchEvent = 'touches' in moveEvent;
            const moveX = isMoveTouchEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const moveY = isMoveTouchEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
            
            const dx = moveX - interactionStartRef.current.clientX;
            const dy = moveY - interactionStartRef.current.clientY;

            if (interactionStartRef.current.type === 'drag') {
                const { clientWidth, clientHeight } = containerRef.current;
                const { snapshotX, snapshotY, snapshotWidth, snapshotHeight } = interactionStartRef.current;
                
                let newX = snapshotX + dx;
                let newY = snapshotY + dy;

                newX = Math.max(0, Math.min(newX, clientWidth - snapshotWidth));
                newY = Math.max(0, Math.min(newY, clientHeight - snapshotHeight));

                itemRef.current!.style.transform = `translate(${newX - snapshotX}px, ${newY - snapshotY}px)`;
            } else { // resize
                const { snapshotX, snapshotY, snapshotWidth, snapshotHeight } = interactionStartRef.current;
                const { clientWidth, clientHeight } = containerRef.current;
                const aspectRatio = snapshotHeight / snapshotWidth;

                let newWidth = Math.max(50, snapshotWidth + dx);
                let newHeight = newWidth * aspectRatio;

                if (newWidth > clientWidth) {
                    newWidth = clientWidth * 0.9;
                    newHeight = newWidth * aspectRatio;
                }
                
                if (snapshotX + newWidth > clientWidth) {
                    newWidth = clientWidth - snapshotX;
                    newHeight = newWidth * aspectRatio;
                }
                if (snapshotY + newHeight > clientHeight) {
                    newHeight = clientHeight - snapshotY;
                    newWidth = newHeight / aspectRatio;
                }

                itemRef.current!.style.width = `${newWidth}px`;
                itemRef.current!.style.height = `${newHeight}px`;
            }
        };

        const handleEnd = (upEvent: MouseEvent | TouchEvent) => {
            if (!itemRef.current || !interactionStartRef.current) return;

            const interactionStart = interactionStartRef.current;
            interactionStartRef.current = null;

            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);

            const isEndTouchEvent = 'changedTouches' in upEvent;
            const endX = isEndTouchEvent ? upEvent.changedTouches[0].clientX : upEvent.clientX;
            const endY = isEndTouchEvent ? upEvent.changedTouches[0].clientY : upEvent.clientY;

            const dx = endX - interactionStart.clientX;
            const dy = endY - interactionStart.clientY;

            const hasDragged = Math.sqrt(dx * dx + dy * dy) > 5;

            // Reset the temporary styles
            itemRef.current.style.transform = '';
            itemRef.current.style.width = ``;
            itemRef.current.style.height = ``;
            
            if (hasDragged) {
                if (interactionStart.type === 'drag') {
                    const { clientWidth, clientHeight } = containerRef.current!;
                    const { snapshotX, snapshotY, snapshotWidth, snapshotHeight } = interactionStart;
                    let newX = snapshotX + dx;
                    let newY = snapshotY + dy;
                    newX = Math.max(0, Math.min(newX, clientWidth - snapshotWidth));
                    newY = Math.max(0, Math.min(newY, clientHeight - snapshotHeight));

                    onUpdate(snapshot.id, { x: newX, y: newY });
                } else { // resize
                    const { snapshotX, snapshotY, snapshotWidth, snapshotHeight } = interactionStart;
                    const { clientWidth, clientHeight } = containerRef.current!;
                    const aspectRatio = snapshotHeight / snapshotWidth;

                    let newWidth = Math.max(50, snapshotWidth + dx);
                    let newHeight = newWidth * aspectRatio;

                    if (newWidth > clientWidth) {
                        newWidth = clientWidth * 0.9;
                        newHeight = newWidth * aspectRatio;
                    }

                    if (snapshotX + newWidth > clientWidth) {
                        newWidth = clientWidth - snapshotX;
                        newHeight = newWidth * aspectRatio;
                    }
                    if (snapshotY + newHeight > clientHeight) {
                        newHeight = clientHeight - snapshotY;
                        newWidth = newHeight / aspectRatio;
                    }
                    
                    onUpdate(snapshot.id, {
                        width: newWidth,
                        height: newHeight,
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
