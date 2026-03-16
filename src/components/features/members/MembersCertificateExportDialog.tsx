'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { AnalysisExportRow } from './membersKpiStripUtils';

function toggleSelectedColumn(
    column: string,
    setColumns: Dispatch<SetStateAction<string[]>>,
    currentColumns: string[],
) {
    setColumns((prev) => {
        if (prev.includes(column)) {
            if (currentColumns.length === 1) return prev;
            return prev.filter((item) => item !== column);
        }
        return [...prev, column];
    });
}

export function MembersCertificateExportDialog({
    analysisTitle,
    availableExportColumns,
    effectiveSelectedExportColumns,
    exportRows,
    isOpen,
    onExport,
    onOpenChange,
    resultUnit,
    setSelectedExportColumns,
}: {
    analysisTitle: string;
    availableExportColumns: string[];
    effectiveSelectedExportColumns: string[];
    exportRows: AnalysisExportRow[];
    isOpen: boolean;
    onExport: () => void;
    onOpenChange: (open: boolean) => void;
    resultUnit: string;
    setSelectedExportColumns: Dispatch<SetStateAction<string[]>>;
}) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="border-white/10 bg-[#0F172A] text-slate-200 sm:max-w-[520px]">
                <div className="border-b border-white/10 px-1 pb-4">
                    <DialogTitle className="flex items-center gap-2 text-xl font-black text-white">
                        <MaterialIcon name="download" className="text-sky-300" />
                        엑셀 다운로드 설정
                    </DialogTitle>
                    <p className="mt-2 text-sm text-slate-400">현재 권리증 분석 결과에서 내려받을 항목을 선택하세요.</p>
                </div>

                <div className="space-y-4 py-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                        <span className="font-bold text-white">{analysisTitle}</span>
                        <span className="mx-2 text-slate-500">|</span>
                        대상 {exportRows.length.toLocaleString()}
                        {resultUnit}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {availableExportColumns.map((column) => {
                            const checked = effectiveSelectedExportColumns.includes(column);
                            const disabled = checked && effectiveSelectedExportColumns.length === 1;
                            return (
                                <label
                                    key={`export-column-${column}`}
                                    className={cn(
                                        'flex items-center gap-2.5 rounded-xl border p-3 transition-colors',
                                        checked ? 'border-sky-500/40 bg-sky-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
                                        disabled ? 'cursor-not-allowed opacity-80' : 'cursor-pointer',
                                    )}
                                >
                                    <Checkbox
                                        checked={checked}
                                        onCheckedChange={() =>
                                            toggleSelectedColumn(column, setSelectedExportColumns, effectiveSelectedExportColumns)
                                        }
                                        disabled={disabled}
                                        className="border-white/20 data-[state=checked]:border-sky-500 data-[state=checked]:bg-sky-500"
                                    />
                                    <span className="text-sm font-bold text-slate-200">{column}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-4">
                    <span className="text-sm font-bold text-slate-400">
                        선택 컬럼 <span className="text-white">{effectiveSelectedExportColumns.length}</span>개
                    </span>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-300 transition-colors hover:bg-white/[0.06]">
                            취소
                        </button>
                        <button
                            type="button"
                            onClick={onExport}
                            disabled={exportRows.length === 0 || effectiveSelectedExportColumns.length === 0}
                            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <MaterialIcon name="file_download" size="sm" />
                            다운로드
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
