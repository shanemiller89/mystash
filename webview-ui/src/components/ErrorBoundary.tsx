import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

interface ErrorBoundaryProps {
    /** Label shown in the error UI (e.g. "List", "Detail") */
    label?: string;
    children: ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

/**
 * Catches render errors in a subtree and displays them inline
 * instead of blanking the entire webview.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, info.componentStack);
    }

    private handleRetry = (): void => {
        this.setState({ error: null });
    };

    render(): ReactNode {
        if (this.state.error) {
            return (
                <div className="h-full flex items-center justify-center p-4">
                    <div className="max-w-sm text-center space-y-3">
                        <AlertTriangle size={24} className="mx-auto text-yellow-400" />
                        <div className="text-[11px] font-medium text-fg/70">
                            {this.props.label ? `${this.props.label} crashed` : 'Something went wrong'}
                        </div>
                        <div className="text-[10px] text-fg/40 bg-bg/50 border border-border rounded p-2 text-left font-mono break-all max-h-32 overflow-y-auto">
                            {this.state.error.message}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] gap-1.5"
                            onClick={this.handleRetry}
                        >
                            <RotateCcw size={10} />
                            Retry
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
