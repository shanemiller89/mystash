import React from 'react';
import { useAppStore } from '../appStore';

const tabs = [
    { key: 'stashes' as const, label: 'Stashes', icon: '📦' },
    { key: 'notes' as const, label: 'Notes', icon: '📝' },
] as const;

export const TabBar: React.FC = () => {
    const activeTab = useAppStore((s) => s.activeTab);
    const setActiveTab = useAppStore((s) => s.setActiveTab);

    return (
        <div className="flex border-b border-border bg-card flex-shrink-0 select-none">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                    <button
                        key={tab.key}
                        className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium transition-colors border-b-2 ${
                            isActive
                                ? 'border-accent text-fg'
                                : 'border-transparent text-fg/50 hover:text-fg/80 hover:bg-hover'
                        }`}
                        onClick={() => setActiveTab(tab.key)}
                        role="tab"
                        aria-selected={isActive}
                    >
                        <span className="text-[14px]">{tab.icon}</span>
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
};
