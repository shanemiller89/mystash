import React, { useCallback } from 'react';
import { useProjectStore } from '../projectStore';
import { ProjectList } from './ProjectList';
import { ProjectDetail } from './ProjectDetail';
import { ResizableLayout } from './ResizableLayout';

export const ProjectsTab: React.FC = () => {
    const selectedItemId = useProjectStore((s) => s.selectedItemId);
    const clearSelection = useProjectStore((s) => s.clearSelection);

    const handleCloseDetail = useCallback(() => {
        clearSelection();
    }, [clearSelection]);

    const hasSelection = selectedItemId !== null;

    return (
        <ResizableLayout
            storageKey="projects"
            hasSelection={hasSelection}
            backLabel="Back to Project"
            onBack={handleCloseDetail}
            listContent={<ProjectList />}
            detailContent={<ProjectDetail onClose={handleCloseDetail} />}
        />
    );
};
