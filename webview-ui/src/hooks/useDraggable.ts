import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────

export interface Position {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

export interface Geometry extends Position, Size {}

export interface UseDraggableOptions {
    /** Initial geometry (position + size). If x/y are -1, auto-centering is deferred to the caller. */
    initial: Geometry;
    /** Minimum size constraints */
    minSize?: Size;
    /** Maximum size constraints */
    maxSize?: Size;
    /** localStorage key for persisting geometry (omit to disable persistence) */
    storageKey?: string;
}

export interface UseDraggableReturn {
    /** Current geometry (position + size) */
    geo: Geometry;
    /** Set geometry directly (e.g. for auto-centering on first render) */
    setGeo: React.Dispatch<React.SetStateAction<Geometry>>;
    /** Spread onto the drag handle element's onMouseDown */
    dragHandleProps: { onMouseDown: (e: React.MouseEvent) => void };
    /** Spread onto the resize handle element's onMouseDown */
    resizeHandleProps: { onMouseDown: (e: React.MouseEvent) => void };
}

// ─── Persistence helpers ──────────────────────────────────────────

function loadGeometry(key: string): Geometry | null {
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            return JSON.parse(raw) as Geometry;
        }
    } catch { /* ignore */ }
    return null;
}

function saveGeometry(key: string, geo: Geometry): void {
    try {
        localStorage.setItem(key, JSON.stringify(geo));
    } catch { /* ignore */ }
}

// ─── Hook ─────────────────────────────────────────────────────────

/**
 * Reusable hook for drag-to-move and drag-to-resize with optional localStorage persistence.
 * Attaches `mousemove`/`mouseup` listeners on the document during drag/resize.
 */
export function useDraggable({
    initial,
    minSize = { width: 200, height: 150 },
    maxSize,
    storageKey,
}: UseDraggableOptions): UseDraggableReturn {
    const [geo, setGeo] = useState<Geometry>(() => {
        if (storageKey) {
            const saved = loadGeometry(storageKey);
            if (saved) {
                return saved;
            }
        }
        return { ...initial };
    });

    // Persist whenever geo changes (debounced via ref to avoid writes during drag)
    const persistOnEnd = useCallback(
        (current: Geometry) => {
            if (storageKey) {
                saveGeometry(storageKey, current);
            }
        },
        [storageKey],
    );

    // ── Drag (move) ───────────────────────────────────────────
    const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

    const handleDragStart = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            const currentGeo = geo;
            dragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                originX: currentGeo.x,
                originY: currentGeo.y,
            };

            const handleMove = (ev: MouseEvent) => {
                if (!dragRef.current) {
                    return;
                }
                const dx = ev.clientX - dragRef.current.startX;
                const dy = ev.clientY - dragRef.current.startY;
                setGeo((prev) => ({
                    ...prev,
                    x: Math.max(0, dragRef.current!.originX + dx),
                    y: Math.max(0, dragRef.current!.originY + dy),
                }));
            };

            const handleEnd = () => {
                dragRef.current = null;
                setGeo((cur) => {
                    persistOnEnd(cur);
                    return cur;
                });
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleEnd);
            };

            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleEnd);
        },
        [geo, persistOnEnd],
    );

    // ── Resize ────────────────────────────────────────────────
    const resizeRef = useRef<{ startX: number; startY: number; originW: number; originH: number } | null>(null);

    const handleResizeStart = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const currentGeo = geo;
            resizeRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                originW: currentGeo.width,
                originH: currentGeo.height,
            };

            const handleMove = (ev: MouseEvent) => {
                if (!resizeRef.current) {
                    return;
                }
                const dw = ev.clientX - resizeRef.current.startX;
                const dh = ev.clientY - resizeRef.current.startY;
                let newW = resizeRef.current.originW + dw;
                let newH = resizeRef.current.originH + dh;
                newW = Math.max(minSize.width, maxSize ? Math.min(maxSize.width, newW) : newW);
                newH = Math.max(minSize.height, maxSize ? Math.min(maxSize.height, newH) : newH);
                setGeo((prev) => ({ ...prev, width: newW, height: newH }));
            };

            const handleEnd = () => {
                resizeRef.current = null;
                setGeo((cur) => {
                    persistOnEnd(cur);
                    return cur;
                });
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleEnd);
            };

            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleEnd);
        },
        [geo, minSize, maxSize, persistOnEnd],
    );

    // Cleanup on unmount (defensive — should already be cleaned up by handleEnd)
    useEffect(() => {
        return () => {
            dragRef.current = null;
            resizeRef.current = null;
        };
    }, []);

    return {
        geo,
        setGeo,
        dragHandleProps: { onMouseDown: handleDragStart },
        resizeHandleProps: { onMouseDown: handleResizeStart },
    };
}
