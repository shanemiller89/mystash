import React, { useCallback } from 'react';
import { useIssueStore } from '../store';
import { IssueList } from './IssueList';
import { IssueDetail } from './IssueDetail';
import { ResizableLayout } from '@/components/shared/ResizableLayout';
import { TabWithSummary } from '@/components/shared/TabWithSummary';

export const IssuesTab: React.FC = () => {
    const selectedIssueNumber = useIssueStore((s) => s.selectedIssueNumber);
    const clearSelection = useIssueStore((s) => s.clearSelection);

    const handleCloseDetail = useCallback(() => {
        clearSelection();
    }, [clearSelection]);

    const hasSelection = selectedIssueNumber !== null;

    return (
        <TabWithSummary tabKey="issues">
            <ResizableLayout
                storageKey="issues"
                hasSelection={hasSelection}
                backLabel="Back to Issues"
                onBack={handleCloseDetail}
                listContent={<IssueList />}
                detailContent={<IssueDetail onClose={handleCloseDetail} />}
            />
        </TabWithSummary>
    );
};
