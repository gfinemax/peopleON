'use client';

import type { ReactNode } from 'react';
import { MaterialIcon } from '@/components/ui/icon';

export function FinancialSettingsSectionLoading() {
    return (
        <div className="flex justify-center py-6">
            <MaterialIcon name="progress_activity" className="animate-spin text-muted-foreground" />
        </div>
    );
}

export function FinancialSettingsSectionCard({
    title,
    iconName,
    iconClassName,
    onAdd,
    children,
}: {
    title: string;
    iconName: string;
    iconClassName: string;
    onAdd: () => void;
    children: ReactNode;
}) {
    return (
        <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border p-4">
                <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <MaterialIcon name={iconName} size="sm" className={iconClassName} />
                    {title}
                </h3>
                <button
                    onClick={onAdd}
                    className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
                >
                    <MaterialIcon name="add" size="xs" /> 추가
                </button>
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}
