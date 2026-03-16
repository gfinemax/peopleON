'use client';

import { createPortal } from 'react-dom';

import { PrintConfig } from '@/components/features/members/memberReportPrintTypes';
import { getMemberReportPrintDate, getSortedPrintData } from '@/components/features/members/memberReportPrintUtils';
import { cn } from '@/lib/utils';
import { UnifiedPerson } from '@/services/memberAggregation';

interface MemberReportPrintContentProps {
    data: UnifiedPerson[];
    config: PrintConfig;
}

export function MemberReportPrintContent({ data, config }: MemberReportPrintContentProps) {
    if (typeof document === 'undefined') return null;

    const activeColumns = config.columns.filter((column) => column.enabled);
    const sortedData = getSortedPrintData(data, config);
    const formattedDate = getMemberReportPrintDate();

    return createPortal(
        <div id="print-container" className="absolute top-0 left-0 w-full min-h-screen z-[99999] bg-white text-black p-10 font-sans print:static print:p-0 print:m-0">
            <style>{`
                @media print {
                    @page {
                        size: ${config.pageSize} ${config.orientation};
                        margin: 15mm 12mm 12mm 12mm;
                    }
                    body > *:not(#print-container) {
                        display: none !important;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        background: white !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        height: auto !important;
                        overflow: visible !important;
                    }
                    html {
                        height: auto !important;
                        overflow: visible !important;
                    }
                    * {
                        color: black !important;
                    }
                }
            `}</style>

            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">인물 명단 상세 보고서</h1>
                    <p className="mt-1 text-[12px] text-slate-500 flex items-center gap-2">
                        <span className="font-bold">출력일자:</span> {formattedDate}
                        <span className="mx-2 text-slate-300">|</span>
                        <span className="font-bold">대방동지역주택</span>
                    </p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                    <div className="bg-slate-100 px-3 py-1 rounded border border-slate-200 text-xs font-black text-slate-800">
                        총 {data.length.toLocaleString()} 명
                    </div>
                </div>
            </div>

            <table className="w-full border-collapse border-b border-slate-300">
                <thead>
                    <tr className="bg-slate-50 border-y-2 border-slate-800">
                        {activeColumns.map((column) => (
                            <th
                                key={column.id}
                                className="px-2 py-1.5 font-black text-slate-800 border-x border-slate-100 text-left text-[11px] uppercase"
                                style={{ width: column.width }}
                            >
                                {column.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {sortedData.map((person, index) => {
                        const certificates = Array.isArray(person.certificate_numbers) && person.certificate_numbers.length > 0
                            ? person.certificate_numbers.join(', ')
                            : '-';
                        const tier = Array.isArray(person.tiers) && person.tiers.length > 0
                            ? person.tiers.join(', ')
                            : (person.tier || '-');

                        return (
                            <tr key={person.id} className="break-inside-avoid align-top">
                                {activeColumns.map((column) => (
                                    <td
                                        key={column.id}
                                        className="px-2 py-[5px] text-[10.5px] border-x border-slate-50 text-slate-700 leading-tight font-medium"
                                    >
                                        {column.id === 'no' && index + 1}
                                        {column.id === 'name' && <span className="font-bold text-slate-900">{person.name}</span>}
                                        {column.id === 'phone' && <span className="font-mono">{person.phone || '-'}</span>}
                                        {column.id === 'tier' && <span>{tier}</span>}
                                        {column.id === 'unit' && <span className="font-bold">{person.unit_group || '-'}</span>}
                                        {column.id === 'cert_status' && (
                                            <div className="flex flex-col items-center">
                                                <span className="font-bold text-[10px]">{person.raw_certificate_count}장 / {person.managed_certificate_count}건</span>
                                            </div>
                                        )}
                                        {column.id === 'cert' && (
                                            <div className="flex flex-col gap-[2px] text-[10px] font-mono break-all leading-[1.1]">
                                                {certificates.split(', ').map((certificatePart, partIndex) => (
                                                    <span key={`cert-part-${partIndex}`}>{certificatePart}</span>
                                                ))}
                                            </div>
                                        )}
                                        {column.id === 'status' && (
                                            <span
                                                className={cn(
                                                    'text-[9px] font-bold px-1 py-0.5 rounded border leading-none',
                                                    person.status === '정상'
                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                        : 'bg-slate-50 border-slate-200 text-slate-600',
                                                )}
                                            >
                                                {person.status || '-'}
                                            </span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>,
        document.body,
    );
}
