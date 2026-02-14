import React from 'react';
import { useAppStore } from '../appStore';
import { Archive, StickyNote, GitPullRequest, CircleDot, MessageSquare } from 'lucide-react';
import { Button } from './ui/button';

const tabs = [
    { key: 'mattermost' as const, label: 'Chat', Icon: MessageSquare },
    { key: 'notes' as const, label: 'Notes', Icon: StickyNote },
    { key: 'prs' as const, label: 'PRs', Icon: GitPullRequest },
    { key: 'issues' as const, label: 'Issues', Icon: CircleDot },
] as const;

export const TabBar: React.FC = () => {
    const activeTab = useAppStore((s) => s.activeTab);
    const setActiveTab = useAppStore((s) => s.setActiveTab);

    const isStashActive = activeTab === 'stashes';

    return (
        <div className="flex border-b border-border bg-card flex-shrink-0 select-none">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                    <Button
                        key={tab.key}
                        variant="ghost"
                        className={`rounded-none h-auto px-4 py-2 text-[12px] font-medium border-b-2 gap-1.5 ${
                            isActive
                                ? 'border-accent text-fg'
                                : 'border-transparent text-fg/50 hover:text-fg/80'
                        }`}
                        onClick={() => setActiveTab(tab.key)}
                        role="tab"
                        aria-selected={isActive}
                    >
                        <tab.Icon size={14} />
                        {tab.label}
                    </Button>
                );
            })}
            {/* Stash — icon-only, pushed to far right */}
            <div className="flex-1" />
            <Button
                variant="ghost"
                className={`rounded-none h-auto px-3 py-2 border-b-2 ${
                    isStashActive
                        ? 'border-accent text-fg'
                        : 'border-transparent text-fg/50 hover:text-fg/80'
                }`}
                onClick={() => setActiveTab('stashes')}
                role="tab"
                aria-selected={isStashActive}
                title="Stashes"
            >
                <Archive size={14} />
            </Button>
        </div>
    );
};
