'use client';

import { useEffect, useRef, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import {
    MEMBER_WORKSPACE_COLUMNS,
    MEMBER_WORKSPACE_PRESETS,
    type MemberWorkspaceColumnId,
    type MemberWorkspacePresetId,
} from './memberWorkspacePresets';

interface MemberWorkspaceHeaderProps {
    activePreset: MemberWorkspacePresetId;
    visibleColumns: MemberWorkspaceColumnId[];
    onPresetChange: (preset: Exclude<MemberWorkspacePresetId, 'custom'>) => void;
    onColumnsChange: (columns: MemberWorkspaceColumnId[]) => void;
}

export function MemberWorkspaceHeader({
    activePreset,
    visibleColumns,
    onPresetChange,
    onColumnsChange,
}: MemberWorkspaceHeaderProps) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!pickerOpen) return;
        const closeOnOutside = (event: PointerEvent) => {
            if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setPickerOpen(false);
        };
        window.addEventListener('pointerdown', closeOnOutside);
        window.addEventListener('keydown', closeOnEscape);
        return () => {
            window.removeEventListener('pointerdown', closeOnOutside);
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, [pickerOpen]);

    const toggleColumn = (columnId: MemberWorkspaceColumnId) => {
        if (visibleColumns.includes(columnId)) {
            if (visibleColumns.length === 1) return;
            onColumnsChange(visibleColumns.filter((id) => id !== columnId));
            return;
        }
        const ordered = MEMBER_WORKSPACE_COLUMNS
            .map((column) => column.id)
            .filter((id) => id === columnId || visibleColumns.includes(id));
        onColumnsChange(ordered);
    };

    return (
        <header className="relative z-40 flex min-h-14 shrink-0 items-center gap-5 overflow-visible border-b border-white/[0.08] bg-[#081b2e] px-4 text-white sm:px-5">
            <div className="flex shrink-0 items-center gap-2 border-r border-white/10 pr-5">
                <span className="text-lg font-black tracking-tight">People<span className="text-cyan-400">ON</span></span>
                <span className="hidden text-xs font-bold text-slate-400 sm:inline">조합원 관리</span>
            </div>

            <nav className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto scrollbar-none" aria-label="조합원 보기 구성">
                {MEMBER_WORKSPACE_PRESETS.map((preset) => {
                    const active = activePreset === preset.id;
                    return (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => onPresetChange(preset.id)}
                            aria-pressed={active}
                            className={cn(
                                'relative flex min-h-14 shrink-0 items-center gap-1.5 px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70',
                                active ? 'text-cyan-300' : 'text-slate-400 hover:text-slate-100',
                            )}
                        >
                            <span>{preset.label}</span>
                            <span className={cn('rounded-full px-1.5 py-0.5 text-xs', active ? 'bg-cyan-400/10 text-cyan-300' : 'bg-white/5 text-slate-500')}>
                                {preset.columns.length}열
                            </span>
                            {active ? <span className="absolute inset-x-2 bottom-0 h-0.5 bg-cyan-400" /> : null}
                        </button>
                    );
                })}
            </nav>

            <div ref={pickerRef} className="relative shrink-0">
                <button
                    type="button"
                    onClick={() => setPickerOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={pickerOpen}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 text-sm font-bold text-cyan-100 transition-colors hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                >
                    <MaterialIcon name="view_column" size="xs" />
                    <span className="hidden sm:inline">열 선택</span>
                    <span className="rounded-full bg-cyan-400/15 px-1.5 py-0.5 text-xs">{visibleColumns.length}</span>
                    <MaterialIcon name={pickerOpen ? 'expand_less' : 'expand_more'} size="xs" />
                </button>

                {pickerOpen ? (
                    <div role="menu" aria-label="표시할 열 선택" className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-white/10 bg-[#10243a] p-2 shadow-2xl shadow-black/40">
                        <div className="px-2 py-2">
                            <p className="text-xs font-black text-white">표시할 열</p>
                            <p className="mt-0.5 text-xs text-slate-400">한 개 이상의 열을 선택해 주세요.</p>
                        </div>
                        <div className="space-y-1">
                            {MEMBER_WORKSPACE_COLUMNS.map((column) => {
                                const checked = visibleColumns.includes(column.id);
                                const removalDisabled = checked && visibleColumns.length === 1;
                                return (
                                    <label key={column.id} className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm transition-colors hover:bg-white/5', removalDisabled && 'cursor-not-allowed opacity-60')}>
                                        <Checkbox checked={checked} disabled={removalDisabled} onCheckedChange={() => toggleColumn(column.id)} />
                                        <MaterialIcon name={column.icon} size="xs" className="text-slate-400" />
                                        <span className="font-semibold text-slate-200">{column.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                ) : null}
            </div>
        </header>
    );
}
