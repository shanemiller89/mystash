import React, { useCallback } from 'react';
import { useAIStore } from '../aiStore';
import { Button } from './ui/button';
import { Sparkles } from 'lucide-react';

// ─── Component ────────────────────────────────────────────────────

interface TabSummaryProps {
    tabKey: string;
}

/**
 * Small toggle button placed on the far-right of a tab's header area.
 * Toggles the AI summary right pane for this tab.
 */
export const TabSummaryButton: React.FC<TabSummaryProps> = React.memo(({ tabKey }) => {
    const isOpen = useAIStore((s) => s.summaryPaneTabKey === tabKey);
    const toggleSummaryPane = useAIStore((s) => s.toggleSummaryPane);

    const handleToggle = useCallback(() => {
        toggleSummaryPane(tabKey);
    }, [tabKey, toggleSummaryPane]);

    return (
        <Button
            variant="ghost"
            size="icon-xs"
            className={`shrink-0 ${isOpen ? 'text-accent' : 'text-fg/40 hover:text-fg/70'}`}
            onClick={handleToggle}
            title={isOpen ? 'Close AI Summary' : 'AI Summary'}
        >
            <Sparkles size={12} />
        </Button>
    );
});
TabSummaryButton.displayName = 'TabSummaryButton';
