
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
    onDelete: (id:string) => void;
    onClick: () => void;
    isSelected: boolean;
    onSelect: () => void;
    containerRef: React.RefObject<HTMLDivElement>;
}

type InteractionType = 'drag' | 'resize';

export const SnapshotItem: React.FC<SnapshotItemProps> = ({ snapshot, onUpdate, onDelete, onClick, isSelected, onSelect, containerRef }) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const [interactionType, setInteractionType] = useState<InteractionType | null>(null);

    const interactionStartRef = useRef<{
        startX: number;
        startY: number;
        snapshotX: number;
        snapshotY: number;
        snapshotWidth: number;
        snapshotHeight: number;
    } | null>(null);
    
    const wasDraggedRef = useRef(false);

    const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent, type: InteractionType) => {
        e.stopPropagation();
        
        const isTouchEvent = 'touches' in e;
        const point = isTouchEvent ? e.touches[0] : e;

        interactionStartRef.current = {
            startX: point.clientX,
            startY: point.clientY,
            snapshotX: snapshot.x,
            snapshotY: snapshot.y,
            snapshotWidth: snapshot.width,
            snapshotHeight: snapshot.height,
        };
        wasDraggedRef.current = false;
        setInteractionType(type);
    };
    
    const handleBodyClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (wasDraggedRef.current) return;
        onSelect();
        onClick();
    }
    
    const handleResizeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (wasDraggedRef.current) return;
        onSelect();
    }

    useEffect(() => {
        if (!interactionType) return;

        const lastMovePoint = { x: 0, y: 0 };

        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (!interactionStartRef.current) return;
            
            if ('preventDefault' in e && e.cancelable) {
                e.preventDefault();
            }

            const isTouchEvent = 'touches' in e;
            const point = isTouchEvent ? e.touches[0] : e;
            
            if (!point) return;

            lastMovePoint.x = point.clientX;
            lastMovePoint.y = point.clientY;

            const dx = point.clientX - interactionStartRef.current.startX;
            const dy = point.clientY - interactionStartRef.current.startY;

            if (!wasDraggedRef.current && Math.sqrt(dx*dx + dy*dy) > 5) {
                wasDraggedRef.current = true;
            }

            if (wasDraggedRef.current && itemRef.current) {
                if (interactionType === 'drag') {
                    itemRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
                } else if (interactionType === 'resize') {
                    const { snapshotWidth, snapshotHeight } = interactionStartRef.current;
                    const aspectRatio = snapshotHeight / snapshotWidth;
                    const newWidth = Math.max(50, snapshotWidth + dx);
                    const newHeight = newWidth * aspectRatio;
                    itemRef.current.style.width = `${newWidth}px`;
                    itemRef.current.style.height = `${newHeight}px`;
                }
            }
        };

        const handleEnd = (e: MouseEvent | TouchEvent) => {
            if (!interactionStartRef.current) {
                 setInteractionType(null);
                 return;
            }

            if (wasDraggedRef.current) {
                if (!itemRef.current || !containerRef.current) return;
                
                itemRef.current.style.transform = '';
                itemRef.current.style.width = '';
                itemRef.current.style.height = '';
                
                const { startX, startY, snapshotX, snapshotY, snapshotWidth, snapshotHeight } = interactionStartRef.current;
                
                const dx = lastMovePoint.x - startX;
                const dy = lastMovePoint.y - startY;

                if (interactionType === 'drag') {
                    const { clientWidth, clientHeight } = containerRef.current;
                    let newX = snapshotX + dx;
                    let newY = snapshotY + dy;
                    newX = Math.max(0, Math.min(newX, clientWidth - snapshotWidth));
                    newY = Math.max(0, Math.min(newY, clientHeight - snapshotHeight));
                    onUpdate(snapshot.id, { x: newX, y: newY });
                } else if (interactionType === 'resize') {
                    const { clientWidth, clientHeight } = containerRef.current;
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
            
            setInteractionType(null);
            interactionStartRef.current = null;
        };
        
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [interactionType, snapshot.id, containerRef, onUpdate, snapshot.x, snapshot.y, snapshot.width, snapshot.height]);

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
            onClick={handleBodyClick}
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
                        onClick={handleResizeClick}
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
