'use client';

import { UnifiedPerson } from '@/services/memberAggregation';
import { useEffect, useState } from 'react';

interface MemberReportPrintProps {
    data: UnifiedPerson[];
    isPrinting: boolean;
    onPrintComplete: () => void;
}

export function MemberReportPrint({ data, isPrinting, onPrintComplete }: MemberReportPrintProps) {
    const [renderData, setRenderData] = useState<UnifiedPerson[]>([]);

    useEffect(() => {
        if (isPrinting) {
            setRenderData(data);
            // 약간의 지연 후 인쇄 대화상자 호출 (렌더링 딜레이 확보)
            setTimeout(() => {
                window.print();
            }, 300);
        }
    }, [isPrinting, data]);

    useEffect(() => {
        const handleAfterPrint = () => {
            onPrintComplete();
            setRenderData([]); // 메모리 확보
        };
        window.addEventListener('afterprint', handleAfterPrint);
        return () => window.removeEventListener('afterprint', handleAfterPrint);
    }, [onPrintComplete]);

    if (!isPrinting && renderData.length === 0) return null;

    const today = new Date();
    const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    return (
        <div className="hidden print:block fixed inset-0 z-[9999] bg-white text-black p-8 font-sans overflow-visible">
            {/* A4 크기에 맞춘 프린트 화면 */}
            <style>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 15mm;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        background: white !important;
                    }
                    * {
                        color: black !important;
                    }
                }
            `}</style>

            <div className="mb-6 flex items-end justify-between border-b-2 border-slate-800 pb-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">인물 명단 상세 보고서</h1>
                    <p className="mt-1 text-sm text-gray-600">출력일자: {formattedDate}</p>
                </div>
                <div className="text-right text-sm font-bold">
                    총 인원: {data.length.toLocaleString()}명
                </div>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <thead>
                    <tr className="bg-slate-100 text-slate-800">
                        <th className="border border-slate-300 px-2 py-1.5 font-bold">No.</th>
                        <th className="border border-slate-300 px-2 py-1.5 font-bold">성명</th>
                        <th className="border border-slate-300 px-2 py-1.5 font-bold">연락처</th>
                        <th className="border border-slate-300 px-2 py-1.5 font-bold">구분/차수</th>
                        <th className="border border-slate-300 px-2 py-1.5 font-bold">동호수</th>
                        <th className="border border-slate-300 px-2 py-1.5 font-bold w-1/4">권리증번호</th>
                        <th className="border border-slate-300 px-2 py-1.5 font-bold">상태</th>
                    </tr>
                </thead>
                <tbody>
                    {renderData.map((person, index) => {
                        const certs = Array.isArray(person.certificate_numbers) && person.certificate_numbers.length > 0 
                            ? person.certificate_numbers.join(', ') 
                            : '-';
                        const tier = Array.isArray(person.tiers) && person.tiers.length > 0 
                            ? person.tiers.join(', ') 
                            : (person.tier || '-');

                        return (
                            <tr key={person.id} className="break-inside-avoid hover:bg-slate-50">
                                <td className="border border-slate-300 px-2 py-1 text-center text-slate-500">{index + 1}</td>
                                <td className="border border-slate-300 px-2 py-1 font-semibold text-center">{person.name}</td>
                                <td className="border border-slate-300 px-2 py-1 text-center">{person.phone || '-'}</td>
                                <td className="border border-slate-300 px-2 py-1 text-center">{tier}</td>
                                <td className="border border-slate-300 px-2 py-1 text-center">{person.unit_group || '-'}</td>
                                <td className="border border-slate-300 px-2 py-1 leading-tight">{certs}</td>
                                <td className="border border-slate-300 px-2 py-1 text-center">{person.status || '-'}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
