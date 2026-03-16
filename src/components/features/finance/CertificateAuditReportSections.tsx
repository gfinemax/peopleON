import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/icon';
import {
    CertificateAuditQualityBadge,
    CertificateAuditSummaryStat,
} from '@/components/features/finance/CertificateAuditPrimitives';
import {
    RIGHT_NUMBER_STATUS_LABEL,
    type RightNumberStatus,
} from '@/lib/certificates/rightNumbers';

export {
    CertificateAuditLegacyExclusiveSection,
    CertificateAuditSegmentOverviewSection,
    CertificateAuditStatisticsSection,
} from './CertificateAuditLegacyReportSections';

type PersonSummaryRollup = {
    owner_count: number;
    owner_with_certificate_count: number;
    provisional_certificate_count: number;
    effective_certificate_count: number;
    conflict_certificate_count: number;
    manual_locked_count: number;
};

type PersonSummaryReviewRow = {
    entity_id: string;
    display_name: string | null;
    provisional_certificate_count: number;
    effective_certificate_count: number;
    conflict_certificate_count: number;
    review_status: string;
};

type ReviewRequiredRightRow = {
    id: string;
    ownerName: string;
    rawValue: string;
    status: RightNumberStatus;
    note: string;
};

export function CertificateAuditPersonSummarySection({
    registeredPersonRollup,
    othersPersonRollup,
    registeredSummaryReviewRows,
}: {
    registeredPersonRollup: PersonSummaryRollup;
    othersPersonRollup: PersonSummaryRollup;
    registeredSummaryReviewRows: PersonSummaryReviewRow[];
}) {
    return (
        <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#101725]">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div>
                    <h3 className="text-sm font-extrabold text-foreground">사람별 최종 권리증 확정</h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                        `person_certificate_summaries` 기준입니다. 수동 고정된 최종 개수가 있으면 registry 잠정값보다 우선합니다.
                    </p>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-200">
                    등기 {registeredPersonRollup.owner_count.toLocaleString()}명 / 기타 {othersPersonRollup.owner_count.toLocaleString()}명
                </span>
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                <div className="overflow-hidden rounded-lg border border-border/60">
                    <div className="border-b border-border/60 bg-muted/20 px-3 py-2">
                        <p className="text-xs font-bold text-foreground">등기조합원 사람별 집계</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-3 text-xs">
                        <CertificateAuditSummaryStat label="전체 인원" value={`${registeredPersonRollup.owner_count}명`} />
                        <CertificateAuditSummaryStat label="보유 인원" value={`${registeredPersonRollup.owner_with_certificate_count}명`} />
                        <CertificateAuditSummaryStat label="잠정 개수" value={`${registeredPersonRollup.provisional_certificate_count}개`} />
                        <CertificateAuditSummaryStat label="최종 개수" value={`${registeredPersonRollup.effective_certificate_count}개`} tone="emerald" />
                        <CertificateAuditSummaryStat label="충돌 건수" value={`${registeredPersonRollup.conflict_certificate_count}개`} tone="amber" />
                        <CertificateAuditSummaryStat label="수동 고정" value={`${registeredPersonRollup.manual_locked_count}명`} />
                    </div>
                </div>
                <div className="overflow-hidden rounded-lg border border-border/60">
                    <div className="border-b border-border/60 bg-muted/20 px-3 py-2">
                        <p className="text-xs font-bold text-foreground">등기 사람별 검수 대기</p>
                    </div>
                    <div className="max-h-52 overflow-auto">
                        {registeredSummaryReviewRows.length > 0 ? (
                            <table className="w-full text-xs">
                                <thead className="bg-muted/10 text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-bold">이름</th>
                                        <th className="px-3 py-2 text-right font-bold">잠정</th>
                                        <th className="px-3 py-2 text-right font-bold">최종</th>
                                        <th className="px-3 py-2 text-right font-bold">충돌</th>
                                        <th className="px-3 py-2 text-left font-bold">상태</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {registeredSummaryReviewRows.slice(0, 20).map((row) => (
                                        <tr key={row.entity_id}>
                                            <td className="px-3 py-2 text-foreground">
                                                <Link href={`/members?q=${encodeURIComponent(row.display_name || '')}`} className="hover:text-sky-300">
                                                    {row.display_name || '-'}
                                                </Link>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-muted-foreground">{row.provisional_certificate_count}</td>
                                            <td className="px-3 py-2 text-right font-mono text-emerald-300">{row.effective_certificate_count}</td>
                                            <td className="px-3 py-2 text-right font-mono text-amber-300">{row.conflict_certificate_count}</td>
                                            <td className="px-3 py-2 text-muted-foreground">{row.review_status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="p-4 text-center text-xs text-muted-foreground">등기 사람별 검수 대기가 없습니다.</p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

export function CertificateAuditQualitySection({
    qualityIssueCount,
    memberWithoutPartyCount,
    settlementCaseMissingCount,
    finalRefundMissingCount,
    settlementStatusMismatchCount,
}: {
    qualityIssueCount: number;
    memberWithoutPartyCount: number;
    settlementCaseMissingCount: number;
    finalRefundMissingCount: number;
    settlementStatusMismatchCount: number;
}) {
    return (
        <section className="rounded-xl border border-white/[0.08] bg-[#101725] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <MaterialIcon name="verified_user" size="sm" className="text-sky-300" />
                    <p className="text-sm font-extrabold text-foreground">정산 데이터 품질 경고</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${qualityIssueCount > 0 ? 'border-amber-400/30 bg-amber-500/10 text-amber-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
                        {qualityIssueCount > 0 ? `이슈 ${qualityIssueCount.toLocaleString()}건` : '이슈 없음'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/api/settlement/diagnostics/export?scope=issues" className="inline-flex h-8 items-center gap-1 rounded border border-emerald-400/30 bg-emerald-500/10 px-2.5 text-[11px] font-bold text-emerald-200">
                        <MaterialIcon name="download" size="xs" />
                        진단CSV
                    </Link>
                    <Link href="/settlements" className="inline-flex h-8 items-center gap-1 rounded border border-white/15 bg-white/[0.04] px-2.5 text-[11px] font-bold text-slate-200">
                        <MaterialIcon name="open_in_new" size="xs" />
                        정산페이지
                    </Link>
                </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
                <CertificateAuditQualityBadge label="파티 미연결 회원" count={memberWithoutPartyCount} tone={memberWithoutPartyCount > 0 ? 'warn' : 'ok'} href="/members?status=%EC%97%B0%EA%B2%B0%ED%95%84%EC%9A%94" />
                <CertificateAuditQualityBadge label="정산케이스 누락" count={settlementCaseMissingCount} tone={settlementCaseMissingCount > 0 ? 'warn' : 'ok'} href="/members?status=%EC%BC%80%EC%9D%B4%EC%8A%A4%EB%88%84%EB%9D%BD" />
                <CertificateAuditQualityBadge label="최종환불선 미설정" count={finalRefundMissingCount} tone={finalRefundMissingCount > 0 ? 'warn' : 'ok'} href="/settlements?diag=no_final_refund" />
                <CertificateAuditQualityBadge label="상태 불일치" count={settlementStatusMismatchCount} tone={settlementStatusMismatchCount > 0 ? 'danger' : 'ok'} href="/settlements?diag=status_mismatch" />
            </div>
        </section>
    );
}

export function CertificateAuditReviewQueueSection({
    reviewRequiredRightRows,
}: {
    reviewRequiredRightRows: ReviewRequiredRightRow[];
}) {
    return (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div>
                    <h3 className="text-sm font-extrabold text-foreground">권리증 검수 대기</h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                        자동 분류로 확정하지 못한 권리증 원문입니다. 멤버 상세에서 상태를 수동 확정하세요.
                    </p>
                </div>
                <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-200">
                    {reviewRequiredRightRows.length.toLocaleString()}건
                </span>
            </div>
            <div className="max-h-72 overflow-auto">
                {reviewRequiredRightRows.length > 0 ? (
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 border-b border-border/60 bg-[#161B22] text-muted-foreground">
                            <tr>
                                <th className="px-4 py-2 text-left font-bold">명의자</th>
                                <th className="px-4 py-2 text-left font-bold">원문값</th>
                                <th className="px-4 py-2 text-left font-bold">상태</th>
                                <th className="px-4 py-2 text-left font-bold">메모</th>
                                <th className="px-4 py-2 text-left font-bold">바로가기</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {reviewRequiredRightRows.slice(0, 20).map((row) => (
                                <tr key={row.id}>
                                    <td className="px-4 py-2 text-foreground">{row.ownerName}</td>
                                    <td className="px-4 py-2 font-mono text-amber-200">{row.rawValue}</td>
                                    <td className="px-4 py-2 font-bold text-amber-300">{RIGHT_NUMBER_STATUS_LABEL[row.status]}</td>
                                    <td className="px-4 py-2 text-muted-foreground">{row.note}</td>
                                    <td className="px-4 py-2">
                                        <Link
                                            href={`/members?q=${encodeURIComponent(row.rawValue)}`}
                                            className="inline-flex items-center gap-1 rounded border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[10px] font-bold text-sky-200 hover:bg-sky-500/20"
                                        >
                                            <MaterialIcon name="open_in_new" size="xs" />
                                            멤버 찾기
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="p-4 text-center text-xs text-muted-foreground">검수 대기 권리증이 없습니다.</p>
                )}
            </div>
        </section>
    );
}
