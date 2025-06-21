
"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
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
    onDelete: (id:string) => void;
    onClick: () => void;
    isSelected: boolean;
    onSelect: () => void;
    containerRef: React.RefObject<HTMLDivElement>;
}

export const SnapshotItem: React.FC<SnapshotItemProps> = ({ snapshot, onUpdate, onDelete, onClick, isSelected, onSelect, containerRef }) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const interactionRef = useRef<{
        type: 'drag' | 'resize' | null;
        startX: number;
        startY: number;
        lastMoveX: number;
        lastMoveY: number;
        snapshotX: number;
        snapshotY: number;
        snapshotWidth: number;
        snapshotHeight: number;
        hasDragged: boolean;
    } | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const { clientWidth, clientHeight } = containerRef.current;
        const { id, x, y, width, height } = snapshot;

        const updates: Partial<Omit<Snapshot, 'id'>> = {};
        let needsUpdate = false;

        let newWidth = width;
        let newHeight = height;

        if (width > clientWidth && clientWidth > 0) {
            const aspectRatio = height / width;
            newWidth = clientWidth * 0.9;
            newHeight = newWidth * aspectRatio;
            updates.width = newWidth;
            updates.height = newHeight;
            needsUpdate = true;
        }

        const finalX = Math.max(0, Math.min(x, clientWidth - newWidth));
        if (finalX !== x) {
            updates.x = finalX;
            needsUpdate = true;
        }

        const finalY = Math.max(0, Math.min(y, clientHeight - newHeight));
        if (finalY !== y) {
            updates.y = finalY;
            needsUpdate = true;
        }

        if (needsUpdate) {
            onUpdate(id, updates);
        }
    }, [snapshot, containerRef, onUpdate]);

    const getEventPoint = (e: MouseEvent | TouchEvent) => {
        const isTouchEvent = 'touches' in e;
        return isTouchEvent ? e.touches[0] : e;
    };

    const handleInteractionStart = useCallback((e: React.MouseEvent | React.TouchEvent, type: 'drag' | 'resize') => {
        e.stopPropagation();
        const point = getEventPoint(e.nativeEvent);
        if (!point) return;

        interactionRef.current = {
            type: type,
            startX: point.clientX,
            startY: point.clientY,
            lastMoveX: point.clientX,
            lastMoveY: point.clientY,
            snapshotX: snapshot.x,
            snapshotY: snapshot.y,
            snapshotWidth: snapshot.width,
            snapshotHeight: snapshot.height,
            hasDragged: false,
        };
    }, [snapshot.x, snapshot.y, snapshot.width, snapshot.height]);

    useEffect(() => {
        const interaction = interactionRef.current;
        if (!interaction?.type) return;

        const handleMove = (e: MouseEvent | TouchEvent) => {
            const point = getEventPoint(e);
            if (!point || !interactionRef.current) return;

            const dx = point.clientX - interactionRef.current.startX;
            const dy = point.clientY - interactionRef.current.startY;
            
            if (!interactionRef.current.hasDragged && Math.sqrt(dx * dx + dy * dy) > 5) {
                interactionRef.current.hasDragged = true;
            }
            
            interactionRef.current.lastMoveX = point.clientX;
            interactionRef.current.lastMoveY = point.clientY;
        };

        const handleEnd = (e: MouseEvent | TouchEvent) => {
            if (!interactionRef.current) return;
            
            const { type, startX, startY, lastMoveX, lastMoveY, snapshotX, snapshotY, snapshotWidth, snapshotHeight, hasDragged } = interactionRef.current;
            
            if (!hasDragged) {
                interactionRef.current = null;
                return;
            }

            const finalMoveX = 'touches' in e ? lastMoveX : getEventPoint(e)?.clientX ?? lastMoveX;
            const finalMoveY = 'touches' in e ? lastMoveY : getEventPoint(e)?.clientY ?? lastMoveY;

            if (containerRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                const dx = finalMoveX - startX;
                const dy = finalMoveY - startY;

                if (type === 'drag') {
                    let newX = snapshotX + dx;
                    let newY = snapshotY + dy;
                    newX = Math.max(0, Math.min(newX, clientWidth - snapshotWidth));
                    newY = Math.max(0, Math.min(newY, clientHeight - snapshotHeight));
                    onUpdate(snapshot.id, { x: newX, y: newY });
                } else if (type === 'resize') {
                    const aspectRatio = snapshotHeight / snapshotWidth;
                    let newWidth = Math.max(50, snapshotWidth + dx);

                    if (snapshotX + newWidth > clientWidth) {
                        newWidth = clientWidth - snapshotX;
                    }

                    let newHeight = newWidth * aspectRatio;

                    if (snapshotY + newHeight > clientHeight) {
                        newHeight = clientHeight - snapshotY;
                        newWidth = newHeight / aspectRatio;
                    }
                    onUpdate(snapshot.id, { width: newWidth, height: newHeight });
                }
            }

            interactionRef.current = null;
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove, { passive: true });
        window.addEventListener('touchend', handleEnd);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [snapshot.id, onUpdate, containerRef]);

    const handleClick = (e: React.MouseEvent) => {
        if (interactionRef.current?.hasDragged) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        onSelect();
        onClick();
    }

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
            onClick={handleClick}
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
                        onClick={(e) => e.stopPropagation()}
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
