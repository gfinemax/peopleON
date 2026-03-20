'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/icon';
import { MemberDetailDialog } from '@/components/features/members/MemberDetailDialog';
import type { PersonPaymentSummary } from '@/lib/server/paymentDashboard';
import { PersonPaymentRow } from './PaymentsPagePrimitives';

interface PaymentsTableClientProps {
    pagedRows: PersonPaymentSummary[];
    totalRows: number;
    from: number;
    to: number;
    normalizedPage: number;
    totalPages: number;
    prevHref: string;
    nextHref: string;
}

export function PaymentsTableClient({
    pagedRows,
    totalRows,
    from,
    to,
    normalizedPage,
    totalPages,
    prevHref,
    nextHref,
}: PaymentsTableClientProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<PersonPaymentSummary | null>(null);

    const openMemberDetail = (row: PersonPaymentSummary) => {
        setSelectedRow(row);
        setDialogOpen(true);
    };

    return (
        <>
            <section className="overflow-hidden rounded-xl border border-white/10 bg-[#101725]">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="border-b border-white/[0.08] bg-[#121d2d] text-slate-300">
                            <tr>
                                <th className="px-3 py-3 text-left">성명 / 연락처</th>
                                <th className="px-3 py-3 text-left">구분 / 상태</th>
                                <th className="px-4 py-3 text-left">권리 / 평형</th>
                                <th className="px-4 py-3 text-left">금액 요약</th>
                                <th className="px-4 py-3 text-left">최근 납부 / 계좌</th>
                                <th className="px-4 py-3 text-center">정산 요약</th>
                                <th className="px-4 py-3 text-center">보기</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                            {pagedRows.length > 0 ? (
                                pagedRows.map((row) => (
                                    <PersonPaymentRow key={row.id} row={row} onOpenMemberDetail={openMemberDetail} />
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                                        조건에 맞는 납부 내역이 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-3 text-xs">
                    <p className="text-slate-400">
                        총 <span className="font-bold text-slate-200">{totalRows.toLocaleString()}명</span> 중 {totalRows === 0 ? 0 : from + 1}-{Math.min(to, totalRows)}
                    </p>
                    <div className="flex items-center gap-1">
                        <Link href={prevHref} className={`inline-flex size-7 items-center justify-center rounded border border-white/[0.1] ${normalizedPage <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-white/[0.06]'}`}>
                            <MaterialIcon name="chevron_left" size="sm" />
                        </Link>
                        <span className="px-2 text-slate-300">{normalizedPage} / {totalPages}</span>
                        <Link href={nextHref} className={`inline-flex size-7 items-center justify-center rounded border border-white/[0.1] ${normalizedPage >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-white/[0.06]'}`}>
                            <MaterialIcon name="chevron_right" size="sm" />
                        </Link>
                    </div>
                </div>
            </section>

            <MemberDetailDialog
                memberId={selectedRow?.entityIds?.[0] || null}
                memberIds={selectedRow?.entityIds || null}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                initialTab="info"
            />
        </>
    );
}
