
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
    const [isInteracting, setIsInteracting] = useState(false);
    
    const interactionRef = useRef<{
        type: 'drag' | 'resize';
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
        if (!containerRef.current || isInteracting) return;

        const { clientWidth, clientHeight } = containerRef.current;
        const { id, x, y, width, height } = snapshot;
        const updates: Partial<Omit<Snapshot, 'id'>> = {};
        let needsUpdate = false;

        let newWidth = width;
        let newHeight = height;
        const aspectRatio = height > 0 && width > 0 ? height / width : 1;

        if (width > clientWidth && clientWidth > 0) {
            newWidth = clientWidth * 0.9;
            newHeight = newWidth * aspectRatio;
        }
        
        const finalWidth = newWidth;
        const finalHeight = newHeight;
        const finalX = Math.max(0, Math.min(x, clientWidth - finalWidth));
        const finalY = Math.max(0, Math.min(y, clientHeight - finalHeight));

        if (Math.abs(finalWidth - width) > 1) {
            updates.width = finalWidth;
            needsUpdate = true;
        }
        if (Math.abs(finalHeight - height) > 1) {
            updates.height = finalHeight;
            needsUpdate = true;
        }
        if (Math.abs(finalX - x) > 1) {
            updates.x = finalX;
            needsUpdate = true;
        }
        if (Math.abs(finalY - y) > 1) {
            updates.y = finalY;
            needsUpdate = true;
        }

        if (needsUpdate) {
            onUpdate(id, updates);
        }
    }, [snapshot, containerRef, onUpdate, isInteracting]);

    const getEventPoint = (e: MouseEvent | TouchEvent) => {
        if ('touches' in e) {
            return e.touches[0] || e.changedTouches[0];
        }
        return e;
    };

    const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent, type: 'drag' | 'resize') => {
        e.stopPropagation();
        if (!itemRef.current) return;

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
        
        setIsInteracting(true);
    };

    useEffect(() => {
        if (!isInteracting || !interactionRef.current) return;

        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (!itemRef.current || !interactionRef.current) return;
            
            e.preventDefault();

            const point = getEventPoint(e);
            if (!point) return;
            
            interactionRef.current.lastMoveX = point.clientX;
            interactionRef.current.lastMoveY = point.clientY;

            const dx = point.clientX - interactionRef.current.startX;
            const dy = point.clientY - interactionRef.current.startY;

            if (!interactionRef.current.hasDragged && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
                interactionRef.current.hasDragged = true;
            }

            if (interactionRef.current.type === 'drag') {
                const newX = interactionRef.current.snapshotX + dx;
                const newY = interactionRef.current.snapshotY + dy;
                itemRef.current.style.transform = `translate(${newX - snapshot.x}px, ${newY - snapshot.y}px)`;
            } else if (interactionRef.current.type === 'resize') {
                const { snapshotWidth, snapshotHeight } = interactionRef.current;
                const aspectRatio = snapshotHeight / snapshotWidth;
                
                let newWidth = Math.max(50, snapshotWidth + dx);
                let newHeight = newWidth * aspectRatio;

                itemRef.current.style.width = `${newWidth}px`;
                itemRef.current.style.height = `${newHeight}px`;
            }
        };

        const handleEnd = () => {
            if (!itemRef.current || !interactionRef.current) return;
            
            const { type, startX, startY, snapshotX, snapshotY, snapshotWidth, snapshotHeight, hasDragged, lastMoveX, lastMoveY } = interactionRef.current;

            itemRef.current.style.transform = '';
            itemRef.current.style.width = '';
            itemRef.current.style.height = '';

            if (hasDragged) {
                const dx = lastMoveX - startX;
                const dy = lastMoveY - startY;

                if (type === 'drag') {
                    onUpdate(snapshot.id, { x: snapshotX + dx, y: snapshotY + dy });
                } else if (type === 'resize') {
                    const aspectRatio = snapshotHeight / snapshotWidth;
                    let newWidth = Math.max(50, snapshotWidth + dx);
                    let newHeight = newWidth * aspectRatio;
                    onUpdate(snapshot.id, { width: newWidth, height: newHeight });
                }
            } else {
                 onSelect();
                 onClick();
            }

            interactionRef.current = null;
            setIsInteracting(false);
        };
        
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', handleEnd);

        return () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('touchend', handleEnd);
        };
    }, [isInteracting, snapshot.id, snapshot.x, snapshot.y, onUpdate, onClick, onSelect]);

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
                isSelected ? "border-blue-500 ring-2 ring-blue-500 z-10" : "border-transparent hover:border-blue-500/50",
                isInteracting && "z-20"
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
