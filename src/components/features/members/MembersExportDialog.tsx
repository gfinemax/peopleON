'use client';

import { useState } from 'react';
import { MaterialIcon } from '@/components/ui/icon';
import { exportToExcel, ExportColumn } from './MemberExportExcel';
import { UnifiedPerson } from '@/services/memberAggregation';
import { cn } from '@/lib/utils';

interface MembersExportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    data: UnifiedPerson[];
}

const AVAILABLE_COLUMNS = [
    { id: 'name', label: '성명', defaultChecked: true },
    { id: 'phone', label: '연락처', defaultChecked: true },
    { id: 'certificate_numbers', label: '권리증번호', defaultChecked: true, required: true },
    { id: 'tier', label: '구분/차수', defaultChecked: true },
    { id: 'unit_group', label: '동호수', defaultChecked: true },
    { id: 'address', label: '주소', defaultChecked: false },
    { id: 'status', label: '상태', defaultChecked: true },
    { id: 'roles', label: '역할', defaultChecked: false },
    { id: 'memo', label: '메모', defaultChecked: false },
];

export function MembersExportDialog({ isOpen, onClose, data }: MembersExportDialogProps) {
    const [selectedCols, setSelectedCols] = useState<Set<string>>(
        new Set(AVAILABLE_COLUMNS.filter(c => c.defaultChecked).map(c => c.id))
    );

    if (!isOpen) return null;

    const toggleCol = (id: string, required?: boolean) => {
        if (required) return; // 필수 항목은 토글 불가

        setSelectedCols(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleExport = () => {
        const columnsToExport: ExportColumn[] = AVAILABLE_COLUMNS
            .filter(c => selectedCols.has(c.id))
            .map(c => ({ id: c.id, label: c.label }));
        
        exportToExcel(data, columnsToExport);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:hidden">
            <div className="w-full max-w-md bg-[#0F172A] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <MaterialIcon name="download" className="text-sky-400" />
                        엑셀 다운로드
                    </h2>
                    <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-slate-400 transition-colors">
                        <MaterialIcon name="close" />
                    </button>
                </div>
                
                <div className="p-5 overflow-y-auto max-h-[60vh]">
                    <p className="text-sm text-slate-300 mb-4 font-bold">
                        출력물에 포함할 항목을 선택하세요.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                        {AVAILABLE_COLUMNS.map(col => {
                            const isSelected = selectedCols.has(col.id);
                            return (
                                <label 
                                    key={col.id} 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        toggleCol(col.id, col.required);
                                    }}
                                    className={cn(
                                        "flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors select-none",
                                        isSelected ? "border-sky-500/50 bg-sky-500/10" : "border-white/10 bg-white/5 hover:bg-white/10",
                                        col.required ? "opacity-90 cursor-not-allowed" : ""
                                    )}
                                >
                                    <div className={cn(
                                        "w-4 h-4 rounded-sm flex items-center justify-center border",
                                        isSelected ? "bg-sky-500 border-sky-500 text-white" : "border-slate-500 bg-transparent text-transparent",
                                        col.required ? "bg-slate-600 border-slate-600" : ""
                                    )}>
                                        <MaterialIcon name="check" className="text-[12px] font-bold" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-200">{col.label}</span>
                                    {col.required && <span className="ml-auto text-[10px] text-sky-400 font-bold bg-sky-400/20 px-1.5 py-0.5 rounded">필수</span>}
                                </label>
                            );
                        })}
                    </div>

                    <div className="mt-6 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex gap-3">
                        <MaterialIcon name="info" className="text-emerald-400 shrink-0 mt-0.5" size="sm" />
                        <div className="text-xs text-emerald-200">
                            <strong>권리증번호 전체 출력:</strong> 엑셀로 추출 시, 화면 상의 축약 표시와 무관하게 <strong>보유한 모든 권리증 번호가 온전히 표기</strong>됩니다.
                        </div>
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-white/10 bg-[#0B1120] flex items-center justify-between">
                    <span className="text-sm text-slate-400 font-bold">
                        대상: <span className="text-white">{data.length.toLocaleString()}</span>명
                    </span>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-300 hover:bg-white/5 transition-colors">
                            취소
                        </button>
                        <button onClick={handleExport} className="px-4 py-2 rounded-lg text-sm font-bold bg-sky-500 hover:bg-sky-400 text-white transition-colors shadow-lg shadow-sky-500/20 flex items-center gap-1.5">
                            <MaterialIcon name="file_download" size="sm" />
                            다운로드
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
