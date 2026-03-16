'use client';

import { Dispatch, SetStateAction } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MaterialIcon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PrintConfig, PrintPageSize } from '@/components/features/members/memberReportPrintTypes';
import { cn } from '@/lib/utils';

interface MemberReportPrintDialogProps {
    open: boolean;
    config: PrintConfig;
    setConfig: Dispatch<SetStateAction<PrintConfig>>;
    onClose: () => void;
    onStartPrint: () => void;
}

export function MemberReportPrintDialog({
    open,
    config,
    setConfig,
    onClose,
    onStartPrint,
}: MemberReportPrintDialogProps) {
    const toggleColumn = (id: string) => {
        setConfig((previous) => ({
            ...previous,
            columns: previous.columns.map((column) => (
                column.id === id ? { ...column, enabled: !column.enabled } : column
            )),
        }));
    };

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <DialogContent className="sm:max-w-[500px] bg-[#0F172A] border-white/10 text-slate-200">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white text-xl">
                        <MaterialIcon name="print" />
                        인쇄 보고서 설정
                    </DialogTitle>
                </DialogHeader>

                <div className="py-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <Label className="text-gray-400 text-xs font-bold uppercase tracking-wider">용지 방향</Label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setConfig((previous) => ({ ...previous, orientation: 'portrait' }))}
                                    className={cn(
                                        'flex-1 py-3 px-2 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-2',
                                        config.orientation === 'portrait'
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10',
                                    )}
                                >
                                    <MaterialIcon name="portrait" />
                                    세로 (Portrait)
                                </button>
                                <button
                                    onClick={() => setConfig((previous) => ({ ...previous, orientation: 'landscape' }))}
                                    className={cn(
                                        'flex-1 py-3 px-2 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-2',
                                        config.orientation === 'landscape'
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10',
                                    )}
                                >
                                    <MaterialIcon name="landscape" />
                                    가로 (Landscape)
                                </button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-gray-400 text-xs font-bold uppercase tracking-wider">용지 크기 & 정렬 기준</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {['A4', 'A3', 'Letter'].map((size) => (
                                    <button
                                        key={size}
                                        onClick={() => setConfig((previous) => ({ ...previous, pageSize: size as PrintPageSize }))}
                                        className={cn(
                                            'py-2 px-1 rounded-md border text-xs font-bold transition-all',
                                            config.pageSize === size
                                                ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10',
                                        )}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2 mt-2">
                                <Select
                                    value={config.sortBy}
                                    onValueChange={(value) => setConfig((previous) => ({ ...previous, sortBy: value }))}
                                >
                                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-slate-200">
                                        <SelectValue placeholder="정렬 기준" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1E293B] border-white/10 text-slate-200">
                                        <SelectItem value="no">작성순 (기본)</SelectItem>
                                        <SelectItem value="name">성명순 (가나다)</SelectItem>
                                        <SelectItem value="unit_group">동호수순</SelectItem>
                                        <SelectItem value="tier">구분/차수순</SelectItem>
                                        <SelectItem value="status">상태순</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={config.sortOrder}
                                    onValueChange={(value: 'asc' | 'desc') => setConfig((previous) => ({ ...previous, sortOrder: value }))}
                                >
                                    <SelectTrigger className="w-24 bg-white/5 border-white/10 text-slate-200">
                                        <SelectValue placeholder="오름차순" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1E293B] border-white/10 text-slate-200">
                                        <SelectItem value="asc">오름차순</SelectItem>
                                        <SelectItem value="desc">내림차순</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-gray-400 text-xs font-bold uppercase tracking-wider">포함할 항목 (컬럼)</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                            {config.columns.map((column) => (
                                <div key={column.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`col-${column.id}`}
                                        checked={column.enabled}
                                        onCheckedChange={() => toggleColumn(column.id)}
                                        className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                    />
                                    <Label htmlFor={`col-${column.id}`} className="text-sm font-medium cursor-pointer text-slate-300">
                                        {column.label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:bg-white/5">취소</Button>
                    <Button onClick={onStartPrint} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2">
                        <MaterialIcon name="print" size="sm" />
                        보고서 생성 및 인쇄
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
