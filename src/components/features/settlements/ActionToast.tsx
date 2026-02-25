'use client';

import { cn } from '@/lib/utils';

interface ActionToastProps {
    open: boolean;
    message: string;
    tone?: 'success' | 'error' | 'info';
}

export function ActionToast({ open, message, tone = 'info' }: ActionToastProps) {
    if (!open || !message) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[100]">
            <div
                className={cn(
                    'min-w-[260px] max-w-[420px] rounded-lg border px-3 py-2 text-sm shadow-xl backdrop-blur',
                    tone === 'success' && 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100',
                    tone === 'error' && 'border-rose-400/30 bg-rose-500/15 text-rose-100',
                    tone === 'info' && 'border-sky-400/30 bg-sky-500/15 text-sky-100',
                )}
            >
                {message}
            </div>
        </div>
    );
}

