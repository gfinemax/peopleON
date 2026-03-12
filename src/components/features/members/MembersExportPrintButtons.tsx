'use client';

import { useState } from 'react';
import { UnifiedPerson } from '@/services/memberAggregation';
import { MaterialIcon } from '@/components/ui/icon';
import { MembersExportDialog } from './MembersExportDialog';
import { MemberReportPrint } from './MemberReportPrint';

interface MembersExportPrintButtonsProps {
    data: UnifiedPerson[];
}

export function MembersExportPrintButtons({ data }: MembersExportPrintButtonsProps) {
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    return (
        <>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setIsExportOpen(true)}
                    className="h-9 px-3 rounded-md bg-[#0F172A] border border-white/10 hover:border-sky-500/50 hover:bg-sky-500/10 text-slate-300 hover:text-sky-300 transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
                >
                    <MaterialIcon name="download" size="sm" />
                    엑셀 다운로드
                </button>
                <button
                    onClick={() => setIsPrinting(true)}
                    className="h-9 px-3 rounded-md bg-[#0F172A] border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-slate-300 hover:text-emerald-300 transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
                >
                    <MaterialIcon name="print" size="sm" />
                    보고서 인쇄
                </button>
            </div>

            <MembersExportDialog
                isOpen={isExportOpen}
                onClose={() => setIsExportOpen(false)}
                data={data}
            />

            <MemberReportPrint
                isPrinting={isPrinting}
                onPrintComplete={() => setIsPrinting(false)}
                data={data}
            />
        </>
    );
}
