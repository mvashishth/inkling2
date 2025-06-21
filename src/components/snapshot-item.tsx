
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
    const hasMovedRef = useRef(false);
    const lastPointRef = useRef<{clientX: number, clientY: number} | null>(null);
    
    const interactionRef = useRef<{
        type: 'drag' | 'resize';
        startX: number;
        startY: number;
        snapshotX: number;
        snapshotY: number;
        snapshotWidth: number;
        snapshotHeight: number;
    } | null>(null);

    const getEventPoint = (e: MouseEvent | TouchEvent) => {
        const point = 'touches' in e ? (e.touches[0] || e.changedTouches[0]) : e;
        if (!point) return null;
        return { clientX: point.clientX, clientY: point.clientY };
    };
    
    useEffect(() => {
        if (!containerRef.current || isInteracting) return;

        let { clientWidth, clientHeight } = containerRef.current;
        const { id, x, y, width, height } = snapshot;

        clientWidth = clientWidth || 1;
        clientHeight = clientHeight || 1;
        
        const updates: Partial<Omit<Snapshot, 'id'>> = {};
        let needsUpdate = false;

        let newWidth = width;
        let newHeight = height;
        const aspectRatio = height > 0 && width > 0 ? height / width : 1;

        if (width > clientWidth) {
            newWidth = clientWidth * 0.7;
            newHeight = newWidth * aspectRatio;
        }
        
        if (newHeight > clientHeight) {
            newHeight = clientHeight;
            newWidth = newHeight / aspectRatio;
        }
        
        const finalWidth = newWidth;
        const finalHeight = newHeight;
        
        if (Math.abs(finalWidth - width) > 1 || Math.abs(finalHeight - height) > 1) {
            updates.width = finalWidth;
            updates.height = finalHeight;
            needsUpdate = true;
        }
        
        const finalX = Math.max(0, Math.min(x, clientWidth - finalWidth));
        const finalY = Math.max(0, Math.min(y, clientHeight - finalHeight));

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

    useEffect(() => {
        if (!isInteracting) return;

        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();

            const point = getEventPoint(e);
            if (!point || !interactionRef.current) return;
            lastPointRef.current = point;
            
            if (!hasMovedRef.current) {
                const dx = Math.abs(point.clientX - interactionRef.current.startX);
                const dy = Math.abs(point.clientY - interactionRef.current.startY);
                if (dx > 5 || dy > 5) {
                    hasMovedRef.current = true;
                }
            }

            const dx = point.clientX - interactionRef.current.startX;
            const dy = point.clientY - interactionRef.current.startY;
            
            if (itemRef.current) {
                if (interactionRef.current.type === 'drag') {
                    itemRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
                } else if (interactionRef.current.type === 'resize') {
                    const { snapshotWidth, snapshotHeight } = interactionRef.current;
                    const aspectRatio = snapshotHeight > 0 && snapshotWidth > 0 ? snapshotHeight / snapshotWidth : 1;
                    const newWidth = Math.max(50, snapshotWidth + dx);
                    const newHeight = newWidth * aspectRatio;
                    itemRef.current.style.width = `${newWidth}px`;
                    itemRef.current.style.height = `${newHeight}px`;
                }
            }
        };

        const handleEnd = (e: MouseEvent | TouchEvent) => {
            e.stopPropagation();
            
            const interaction = interactionRef.current;
            if (!interaction) return;

            if (itemRef.current) {
                itemRef.current.style.transform = '';
                itemRef.current.style.width = '';
                itemRef.current.style.height = '';
            }

            if (hasMovedRef.current) {
                const point = lastPointRef.current ?? getEventPoint(e);
                if (!point) return;
                
                const dx = point.clientX - interaction.startX;
                const dy = point.clientY - interaction.startY;
                
                let newX = interaction.snapshotX + dx;
                let newY = interaction.snapshotY + dy;
                let newWidth = interaction.snapshotWidth;
                let newHeight = interaction.snapshotHeight;

                const aspectRatio = interaction.snapshotHeight > 0 && interaction.snapshotWidth > 0 
                    ? interaction.snapshotHeight / interaction.snapshotWidth 
                    : 1;

                if (interaction.type === 'resize') {
                    newWidth = Math.max(50, interaction.snapshotWidth + dx);
                    newHeight = newWidth * aspectRatio;
                }

                if (containerRef.current) {
                    const { clientWidth: containerWidth, clientHeight: containerHeight } = containerRef.current;

                    if (newWidth > containerWidth) {
                        newWidth = containerWidth * 0.7;
                        newHeight = newWidth * aspectRatio;
                    }

                    if (newHeight > containerHeight) {
                        newHeight = containerHeight;
                        newWidth = newHeight / aspectRatio;
                    }

                    newX = Math.max(0, Math.min(newX, containerWidth - newWidth));
                    newY = Math.max(0, Math.min(newY, containerHeight - newHeight));
                }

                if (interaction.type === 'drag') {
                    onUpdate(snapshot.id, { x: newX, y: newY });
                } else if (interaction.type === 'resize') {
                    onUpdate(snapshot.id, { width: newWidth, height: newHeight, x: newX, y: newY });
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
    }, [isInteracting, onUpdate, snapshot.id, containerRef, onClick, onSelect]);

    const handleInteractionStart = useCallback((e: React.MouseEvent | React.TouchEvent, type: 'drag' | 'resize') => {
        e.stopPropagation();
        if ('button' in e && e.button !== 0) return;

        const point = getEventPoint(e.nativeEvent);
        if (!point) return;

        hasMovedRef.current = false;
        lastPointRef.current = point;
        
        interactionRef.current = {
            type: type,
            startX: point.clientX,
            startY: point.clientY,
            snapshotX: snapshot.x,
            snapshotY: snapshot.y,
            snapshotWidth: snapshot.width,
            snapshotHeight: snapshot.height,
        };

        setIsInteracting(true);
    }, [snapshot]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (!hasMovedRef.current) {
            onSelect();
            onClick();
        }
    }, [onClick, onSelect]);

    return (
        <div
            ref={itemRef}
            style={{
                left: snapshot.x,
                top: snapshot.y,
                width: snapshot.width,
                height: snapshot.height,
                touchAction: 'none'
            }}
            className={cn(
                "absolute border-2 shadow-lg",
                isSelected ? "border-blue-500 ring-2 ring-blue-500 z-10" : "border-transparent hover:border-blue-500/50",
                isInteracting && "z-20",
                isInteracting && interactionRef.current?.type === 'drag' ? 'cursor-grabbing' : 'cursor-grab',
            )}
            onMouseDown={(e) => handleInteractionStart(e, 'drag')}
            onTouchStart={(e) => handleInteractionStart(e, 'drag')}
            onClick={handleClick}
            data-ai-hint="pdf snapshot"
        >
            <img
                src={snapshot.imageDataUrl}
                alt="Snapshot from PDF"
                className="w-full h-full object-cover pointer-events-none"
                draggable="false"
            />
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
                        className={cn(
                            "absolute -bottom-2 -right-2 bg-blue-500 text-white rounded-full p-1 z-20 cursor-nwse-resize hover:scale-110 transition-transform",
                            isInteracting && interactionRef.current?.type === 'resize' && 'cursor-nwse-resize'
                        )}
                        aria-label="Resize snapshot"
                    >
                        <Expand size={12} />
                    </div>
                </>
            )}
        </div>
    );
}
