import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/icon';
import { RefundPaymentInlineForm } from '@/components/features/settlements/RefundPaymentInlineForm';
import {
    ownerTypeLabel,
    type CaseStatus,
    type SettlementDashboardRow,
} from '@/lib/server/settlementDashboard';
import type { SettlementOwnerType } from '@/lib/settlement/partyOwnership';
import { SettlementAmountCell } from './SettlementsPagePrimitives';

const statusClassMap: Record<CaseStatus, string> = {
    draft: 'bg-slate-500/10 text-slate-200 border-slate-400/20',
    review: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
    approved: 'bg-sky-500/10 text-sky-200 border-sky-400/20',
    paid: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/20',
    rejected: 'bg-rose-500/10 text-rose-200 border-rose-400/20',
};

const statusLabelMap: Record<CaseStatus, string> = {
    draft: '작성중',
    review: '검토중',
    approved: '승인',
    paid: '지급완료',
    rejected: '반려',
};

const ownerBadgeClass: Record<SettlementOwnerType, string> = {
    member_linked: 'text-emerald-200',
    certificate_holder: 'text-sky-200',
    unlinked: 'text-slate-400',
};

export function SettlementsCasesTableSection({
    loadErrorMessage,
    pagedRows,
    totalCases,
    from,
    to,
    normalizedPage,
    totalPages,
    prevHref,
    nextHref,
}: {
    loadErrorMessage: string | null;
    pagedRows: SettlementDashboardRow[];
    totalCases: number;
    from: number;
    to: number;
    normalizedPage: number;
    totalPages: number;
    prevHref: string;
    nextHref: string;
}) {
    return (
        <div className="min-h-[360px] max-h-[72vh] overflow-hidden rounded-xl border border-white/[0.08] bg-[#101725]">
            {loadErrorMessage ? (
                <div className="flex h-full items-center justify-center text-sm text-rose-300">
                    정산 데이터를 불러오지 못했습니다: {loadErrorMessage}
                </div>
            ) : pagedRows.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                    <MaterialIcon name="inventory_2" size="xl" className="opacity-40" />
                    <p>조건에 맞는 정산 케이스가 없습니다.</p>
                </div>
            ) : (
                <div className="h-full overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#121d2d] text-slate-300">
                            <tr>
                                <th className="px-4 py-3 text-left">인물</th>
                                <th className="px-4 py-3 text-left">상태</th>
                                <th className="px-4 py-3 text-left">금액 요약</th>
                                <th className="px-4 py-3 text-center">지급등록</th>
                                <th className="px-4 py-3 text-left">케이스 정보</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                            {pagedRows.map(({ settlementCase, party, ownership, expected, paid, remaining }) => (
                                <tr key={settlementCase.id} className="hover:bg-white/[0.02]">
                                    <td className="px-4 py-3 text-slate-100">
                                        <p className="font-semibold">{ownership.owner_name}</p>
                                        <p className={`text-[11px] ${ownerBadgeClass[ownership.owner_type]}`}>
                                            {ownerTypeLabel(ownership.owner_type)}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClassMap[settlementCase.case_status]}`}>
                                            {statusLabelMap[settlementCase.case_status]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <SettlementAmountCell expected={expected} paid={paid} remaining={remaining} />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <RefundPaymentInlineForm
                                            caseId={settlementCase.id}
                                            remainingAmount={remaining}
                                            defaultReceiverName={ownership.owner_name || party?.display_name || ''}
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-slate-300">
                                        <div className="space-y-1">
                                            <p className="font-mono text-xs text-slate-200">{settlementCase.id}</p>
                                            <p className="text-[11px] text-slate-400">
                                                생성일 {new Date(settlementCase.created_at).toLocaleDateString('ko-KR')}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-3 text-xs">
                <p className="text-slate-400">
                    총 <span className="font-bold text-slate-200">{totalCases.toLocaleString()}건</span> 중 {totalCases === 0 ? 0 : from + 1}-{Math.min(to, totalCases)}
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
        </div>
    );
}
