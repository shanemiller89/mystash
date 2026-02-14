import React, { useCallback } from 'react';
import { useMattermostStore } from '../mattermostStore';
import { MattermostChannelList } from './MattermostChannelList';
import { MattermostChat } from './MattermostChat';
import { ResizableLayout } from './ResizableLayout';

export const MattermostTab: React.FC = () => {
    const selectedChannelId = useMattermostStore((s) => s.selectedChannelId);
    const clearChannelSelection = useMattermostStore((s) => s.clearChannelSelection);

    const handleCloseDetail = useCallback(() => {
        clearChannelSelection();
    }, [clearChannelSelection]);

    const hasSelection = selectedChannelId !== null;

    return (
        <ResizableLayout
            storageKey="mattermost"
            hasSelection={hasSelection}
            backLabel="Back to Channels"
            onBack={handleCloseDetail}
            listContent={<MattermostChannelList />}
            detailContent={<MattermostChat onClose={handleCloseDetail} />}
        />
    );
};
