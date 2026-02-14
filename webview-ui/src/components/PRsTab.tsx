import React, { useCallback } from 'react';
import { usePRStore } from '../prStore';
import { PRList } from './PRList';
import { PRDetail } from './PRDetail';
import { ResizableLayout } from './ResizableLayout';
import { TabWithSummary } from './TabWithSummary';

export const PRsTab: React.FC = () => {
    const selectedPRNumber = usePRStore((s) => s.selectedPRNumber);
    const clearSelection = usePRStore((s) => s.clearSelection);

    const handleCloseDetail = useCallback(() => {
        clearSelection();
    }, [clearSelection]);

    const hasSelection = selectedPRNumber !== null;

    return (
        <TabWithSummary tabKey="prs">
            <ResizableLayout
                storageKey="prs"
                hasSelection={hasSelection}
                backLabel="Back to PRs"
                onBack={handleCloseDetail}
                listContent={<PRList />}
                detailContent={<PRDetail onClose={handleCloseDetail} />}
            />
        </TabWithSummary>
    );
};
