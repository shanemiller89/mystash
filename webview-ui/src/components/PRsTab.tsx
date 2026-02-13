import React, { useRef, useEffect, useState, useCallback } from 'react';
import { usePRStore } from '../prStore';
import { PRList } from './PRList';
import { PRDetail } from './PRDetail';

/** Breakpoint: below this the layout switches to narrow (replace) mode */
const NARROW_BREAKPOINT = 640;

export const PRsTab: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isNarrow, setIsNarrow] = useState(false);
    const selectedPRNumber = usePRStore((s) => s.selectedPRNumber);
    const clearSelection = usePRStore((s) => s.clearSelection);

    // ResizeObserver for responsive layout
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setIsNarrow(entry.contentRect.width < NARROW_BREAKPOINT);
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const handleCloseDetail = useCallback(() => {
        clearSelection();
    }, [clearSelection]);

    const hasSelection = selectedPRNumber !== null;

    // Narrow mode: show either list OR detail (not both)
    if (isNarrow) {
        return (
            <div ref={containerRef} className="h-full bg-bg text-fg text-[13px]">
                {hasSelection ? (
                    <div className="h-full flex flex-col">
                        <div className="px-3 py-1.5 border-b border-border flex-shrink-0">
                            <button
                                className="text-[11px] text-accent hover:underline flex items-center gap-1"
                                onClick={handleCloseDetail}
                            >
                                ← Back to PRs
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <PRDetail onClose={handleCloseDetail} />
                        </div>
                    </div>
                ) : (
                    <PRList />
                )}
            </div>
        );
    }

    // Wide mode: side-by-side 50/50
    return (
        <div ref={containerRef} className="h-full bg-bg text-fg text-[13px] flex">
            {/* Left pane — list */}
            <div
                className={`h-full overflow-hidden flex-shrink-0 transition-all duration-200 ${
                    hasSelection ? 'w-1/2 border-r border-border' : 'w-full'
                }`}
            >
                <PRList />
            </div>

            {/* Right pane — detail */}
            {hasSelection && (
                <div className="w-1/2 h-full overflow-hidden">
                    <PRDetail onClose={handleCloseDetail} />
                </div>
            )}
        </div>
    );
};
