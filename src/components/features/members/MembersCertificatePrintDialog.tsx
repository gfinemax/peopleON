'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { MaterialIcon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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

export function MembersCertificatePrintDialog({
    availablePrintColumns,
    effectivePrintSortBy,
    effectiveSelectedPrintColumns,
    isOpen,
    onOpenChange,
    onPrint,
    printOrientation,
    printPageSize,
    printSortOrder,
    resultUnit,
    setPrintOrientation,
    setPrintPageSize,
    setPrintSortBy,
    setPrintSortOrder,
    setSelectedPrintColumns,
    sortedPrintRows,
}: {
    availablePrintColumns: string[];
    effectivePrintSortBy: string;
    effectiveSelectedPrintColumns: string[];
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onPrint: () => void;
    printOrientation: 'portrait' | 'landscape';
    printPageSize: 'A4' | 'A3' | 'Letter';
    printSortOrder: 'asc' | 'desc';
    resultUnit: string;
    setPrintOrientation: Dispatch<SetStateAction<'portrait' | 'landscape'>>;
    setPrintPageSize: Dispatch<SetStateAction<'A4' | 'A3' | 'Letter'>>;
    setPrintSortBy: Dispatch<SetStateAction<string>>;
    setPrintSortOrder: Dispatch<SetStateAction<'asc' | 'desc'>>;
    setSelectedPrintColumns: Dispatch<SetStateAction<string[]>>;
    sortedPrintRows: AnalysisExportRow[];
}) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="border-white/10 bg-[#0F172A] text-slate-200 sm:max-w-[580px]">
                <div className="border-b border-white/10 px-1 pb-4">
                    <DialogTitle className="flex items-center gap-2 text-xl font-black text-white">
                        <MaterialIcon name="print" className="text-emerald-300" />
                        보고서 인쇄 설정
                    </DialogTitle>
                    <p className="mt-2 text-sm text-slate-400">현재 권리증 분석 결과를 인쇄하기 전에 레이아웃과 컬럼을 고르세요.</p>
                </div>

                <div className="space-y-6 py-2">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">용지 방향</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => setPrintOrientation('portrait')} className={cn('rounded-xl border px-3 py-3 text-xs font-bold transition-all', printOrientation === 'portrait' ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]')}>
                                    세로
                                </button>
                                <button type="button" onClick={() => setPrintOrientation('landscape')} className={cn('rounded-xl border px-3 py-3 text-xs font-bold transition-all', printOrientation === 'landscape' ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]')}>
                                    가로
                                </button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">용지 크기</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['A4', 'A3', 'Letter'] as const).map((size) => (
                                    <button key={size} type="button" onClick={() => setPrintPageSize(size)} className={cn('rounded-xl border px-3 py-3 text-xs font-bold transition-all', printPageSize === size ? 'border-sky-400/40 bg-sky-500/10 text-sky-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]')}>
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[1fr_140px]">
                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">정렬 기준</Label>
                            <Select value={effectivePrintSortBy} onValueChange={setPrintSortBy}>
                                <SelectTrigger className="border-white/10 bg-white/[0.03] text-slate-200">
                                    <SelectValue placeholder="정렬 기준 선택" />
                                </SelectTrigger>
                                <SelectContent className="border-white/10 bg-[#1E293B] text-slate-200">
                                    {availablePrintColumns.map((column) => (
                                        <SelectItem key={`print-sort-${column}`} value={column}>
                                            {column}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">정렬 순서</Label>
                            <Select value={printSortOrder} onValueChange={(value: 'asc' | 'desc') => setPrintSortOrder(value)}>
                                <SelectTrigger className="border-white/10 bg-white/[0.03] text-slate-200">
                                    <SelectValue placeholder="오름차순" />
                                </SelectTrigger>
                                <SelectContent className="border-white/10 bg-[#1E293B] text-slate-200">
                                    <SelectItem value="asc">오름차순</SelectItem>
                                    <SelectItem value="desc">내림차순</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">포함할 컬럼</Label>
                        <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            {availablePrintColumns.map((column) => {
                                const checked = effectiveSelectedPrintColumns.includes(column);
                                const disabled = checked && effectiveSelectedPrintColumns.length === 1;
                                return (
                                    <label
                                        key={`print-column-${column}`}
                                        className={cn(
                                            'flex items-center gap-2.5 rounded-xl border p-3 transition-colors',
                                            checked ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-white/10 bg-[#0f172a] hover:bg-white/[0.04]',
                                            disabled ? 'cursor-not-allowed opacity-80' : 'cursor-pointer',
                                        )}
                                    >
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={() => toggleSelectedColumn(column, setSelectedPrintColumns, effectiveSelectedPrintColumns)}
                                            disabled={disabled}
                                            className="border-white/20 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
                                        />
                                        <span className="text-sm font-bold text-slate-200">{column}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-4">
                    <span className="text-sm font-bold text-slate-400">
                        대상 <span className="text-white">{sortedPrintRows.length.toLocaleString()}{resultUnit}</span>
                    </span>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-300 transition-colors hover:bg-white/[0.06]">
                            취소
                        </button>
                        <button
                            type="button"
                            onClick={onPrint}
                            disabled={sortedPrintRows.length === 0 || effectiveSelectedPrintColumns.length === 0}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <MaterialIcon name="print" size="sm" />
                            보고서 생성 및 인쇄
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
