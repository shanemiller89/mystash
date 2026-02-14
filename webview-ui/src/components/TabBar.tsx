import React from 'react';
import { useAppStore } from '../appStore';
import { useAIStore } from '../aiStore';
import { Archive, StickyNote, GitPullRequest, CircleDot, MessageSquare, Kanban, Bot, Wand2 } from 'lucide-react';
import { Button } from './ui/button';
import { RepoSwitcher } from './RepoSwitcher';

const tabs = [
    { key: 'mattermost' as const, label: 'Chat', Icon: MessageSquare },
    { key: 'notes' as const, label: 'Notes', Icon: StickyNote },
    { key: 'prs' as const, label: 'PRs', Icon: GitPullRequest },
    { key: 'issues' as const, label: 'Issues', Icon: CircleDot },
    { key: 'projects' as const, label: 'Projects', Icon: Kanban },
    { key: 'agent' as const, label: 'Agent', Icon: Wand2 },
] as const;

export const TabBar: React.FC = () => {
    const activeTab = useAppStore((s) => s.activeTab);
    const setActiveTab = useAppStore((s) => s.setActiveTab);

    const isStashActive = activeTab === 'stashes';
    const chatPanelOpen = useAIStore((s) => s.chatPanelOpen);
    const toggleChatPanel = useAIStore((s) => s.toggleChatPanel);

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
            {/* Stash — icon-only, pushed to far right + repo switcher */}
            <div className="flex-1" />
            <div className="flex items-center gap-1 pr-1">
                <RepoSwitcher />
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
                <Button
                    variant="ghost"
                    className={`rounded-none h-auto px-3 py-2 border-b-2 ${
                        chatPanelOpen
                            ? 'border-accent text-accent'
                            : 'border-transparent text-fg/50 hover:text-fg/80'
                    }`}
                    onClick={toggleChatPanel}
                    title={chatPanelOpen ? 'Close AI Chat' : 'Open AI Chat'}
                >
                    <Bot size={14} />
                </Button>
            </div>
        </div>
    );
};
