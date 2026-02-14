import React, { useCallback, useMemo, useState } from 'react';
import { useAppStore, type RepoInfo } from '../appStore';
import { postMessage } from '../vscode';
import { Button } from './ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Input } from './ui/input';
import { GitBranch, ChevronDown, Check, Globe } from 'lucide-react';

/**
 * Compact repo switcher displayed in the TabBar.
 * Shows the current owner/repo and lets the user pick from discovered
 * git remotes or type a custom owner/repo.
 */
export const RepoSwitcher: React.FC = () => {
    const currentRepo = useAppStore((s) => s.currentRepo);
    const availableRepos = useAppStore((s) => s.availableRepos);
    const [customInput, setCustomInput] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);

    const currentKey = currentRepo
        ? `${currentRepo.owner}/${currentRepo.repo}`
        : null;

    const handleSelect = useCallback(
        (repo: RepoInfo) => {
            postMessage('switchRepo', { owner: repo.owner, repo: repo.repo });
        },
        [],
    );

    const handleCustomSubmit = useCallback(() => {
        const trimmed = customInput.trim();
        const match = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
        if (match) {
            postMessage('switchRepo', { owner: match[1], repo: match[2] });
            setCustomInput('');
            setShowCustomInput(false);
        }
    }, [customInput]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleCustomSubmit();
            }
            if (e.key === 'Escape') {
                setShowCustomInput(false);
                setCustomInput('');
            }
        },
        [handleCustomSubmit],
    );

    // Determine label for trigger
    const triggerLabel = currentKey ?? 'No repo';

    // Build the list — available remotes + current (if custom / not in remotes)
    const menuRepos = useMemo(() => {
        const items = availableRepos.map((r) => ({
            owner: r.owner,
            repo: r.repo,
            label: `${r.owner}/${r.repo}`,
            remote: r.remote,
        }));
        // If the current repo isn't in the discovered list, add it
        if (
            currentRepo &&
            !items.some(
                (r) =>
                    r.owner.toLowerCase() === currentRepo.owner.toLowerCase() &&
                    r.repo.toLowerCase() === currentRepo.repo.toLowerCase(),
            )
        ) {
            items.unshift({
                owner: currentRepo.owner,
                repo: currentRepo.repo,
                label: `${currentRepo.owner}/${currentRepo.repo}`,
                remote: 'custom',
            });
        }
        return items;
    }, [availableRepos, currentRepo]);

    // Only show the switcher when there's repo context available
    const hasContext = currentRepo || availableRepos.length > 0;
    if (!hasContext) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-2 text-[11px] font-normal text-fg/60 hover:text-fg/90 max-w-[200px]"
                    >
                        <GitBranch size={12} className="shrink-0" />
                        <span className="truncate">{triggerLabel}</span>
                        <ChevronDown size={10} className="shrink-0 opacity-50" />
                    </Button>
                }
            />
            <DropdownMenuContent align="end" sideOffset={4} className="min-w-[220px]">
                <DropdownMenuLabel>Repository</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {menuRepos.map((r) => {
                    const isActive =
                        currentRepo &&
                        r.owner.toLowerCase() === currentRepo.owner.toLowerCase() &&
                        r.repo.toLowerCase() === currentRepo.repo.toLowerCase();
                    return (
                        <DropdownMenuItem
                            key={`${r.owner}/${r.repo}`}
                            className="gap-2 text-[12px]"
                            onClick={() => handleSelect({ owner: r.owner, repo: r.repo })}
                        >
                            {isActive ? (
                                <Check size={12} className="shrink-0 text-accent" />
                            ) : (
                                <div className="w-3 shrink-0" />
                            )}
                            <span className="truncate font-medium">
                                {r.owner}/{r.repo}
                            </span>
                            {r.remote !== 'custom' && (
                                <span className="ml-auto text-[10px] text-fg/40">
                                    {r.remote}
                                </span>
                            )}
                        </DropdownMenuItem>
                    );
                })}
                <DropdownMenuSeparator />
                {showCustomInput ? (
                    <div className="px-2 py-1.5">
                        <Input
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="owner/repo"
                            className="h-6 text-[11px]"
                            autoFocus
                        />
                        <div className="mt-1 flex gap-1">
                            <Button
                                variant="default"
                                size="sm"
                                className="h-5 text-[10px] px-2 flex-1"
                                onClick={handleCustomSubmit}
                                disabled={!customInput.trim().match(/^[^/\s]+\/[^/\s]+$/)}
                            >
                                Switch
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[10px] px-2"
                                onClick={() => {
                                    setShowCustomInput(false);
                                    setCustomInput('');
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <DropdownMenuItem
                        className="gap-2 text-[12px]"
                        closeOnClick={false}
                        onClick={() => {
                            setShowCustomInput(true);
                        }}
                    >
                        <Globe size={12} className="shrink-0 text-fg/50" />
                        <span>Other repository…</span>
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
