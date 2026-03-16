'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import { MaterialIcon } from '@/components/ui/icon';
import {
    CERTIFICATE_SUMMARY_STATUS_LABEL,
    getRightsFlowHeadline,
    type AssetRight,
    type CertificateSummaryReviewStatus,
} from './memberDetailDialogUtils';
import type { MemberDetailDialogMember } from './memberDetailDialogTypes';

interface MemberDetailDialogAdminEmptyStateProps {
    message?: string;
}

export function MemberDetailDialogAdminEmptyState({
    message = '등록된 권리 흐름 데이터가 없습니다.',
}: MemberDetailDialogAdminEmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 py-10 text-muted-foreground opacity-50">
            <MaterialIcon name="database_off" size="xl" />
            <p className="text-sm font-bold">{message}</p>
        </div>
    );
}

interface MemberDetailDialogAdminSummaryProps {
    rightsFlowSummary: { rawCount: number; managedCount: number };
    managedCertificateNumbers: string[];
    sortedAssetRights: AssetRight[];
}

export function MemberDetailDialogAdminSummary({
    rightsFlowSummary,
    managedCertificateNumbers,
    sortedAssetRights,
}: MemberDetailDialogAdminSummaryProps) {
    return (
        <div className="grid grid-cols-1 gap-3 text-left md:grid-cols-3">
            <div className="flex min-h-[104px] flex-col gap-1.5 rounded-xl border border-white/5 bg-[#233040] px-4 py-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">권리 흐름</span>
                <span className="break-all font-mono text-xl font-black text-white">
                    {getRightsFlowHeadline(rightsFlowSummary.rawCount, rightsFlowSummary.managedCount)}
                </span>
                <span className="text-[11px] text-gray-400">원천과 현재 관리번호 기준</span>
            </div>
            <div className="flex min-h-[104px] flex-col gap-2 rounded-xl border border-purple-500/15 bg-[linear-gradient(135deg,rgba(91,33,182,0.18),rgba(35,48,64,1))] px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-200/80">통합 관리번호</span>
                    <span className="rounded border border-purple-400/15 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-200">
                        {managedCertificateNumbers.length}건
                    </span>
                </div>
                {managedCertificateNumbers.length > 0 ? (
                    <div className="space-y-1">
                        {managedCertificateNumbers.map((number) => (
                            <div key={number} className="break-all font-mono text-base font-black leading-tight text-purple-100">
                                {number}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-1 items-center">
                        <span className="text-xl font-black text-gray-500">없음</span>
                    </div>
                )}
                <span className="text-[11px] text-purple-100/60">통합 결과로 생성된 관리번호만 표시</span>
            </div>
            <div className="flex min-h-[104px] flex-col gap-1.5 rounded-xl border border-white/5 bg-[#233040] px-4 py-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">등록 금액 합계</span>
                <span className="font-mono text-xl font-black text-blue-400">
                    ₩
                    {sortedAssetRights
                        .reduce(
                            (acc, right) =>
                                acc + (Number(right.certificate_price) || Number(right.principal_amount) || 0),
                            0,
                        )
                        .toLocaleString()}
                </span>
                <span className="text-[11px] text-gray-400">원천과 관리번호 전체 기준</span>
            </div>
        </div>
    );
}

interface MemberDetailDialogCertificateReviewProps {
    member: MemberDetailDialogMember;
    formData: Partial<MemberDetailDialogMember>;
    isEditing: boolean;
    canEditCertificateSummary: boolean;
    setFormData: Dispatch<SetStateAction<Partial<MemberDetailDialogMember>>>;
}

export function MemberDetailDialogCertificateReview({
    member,
    formData,
    isEditing,
    canEditCertificateSummary,
    setFormData,
}: MemberDetailDialogCertificateReviewProps) {
    return (
        <details className="group rounded-xl border border-emerald-500/15 bg-[#162234] p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">관리 수 검토</p>
                    <p className="text-xs text-gray-400">자동 계산된 관리 수를 확인하고 필요하면 최종 인정 수를 조정합니다.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-bold text-slate-300">
                        자동 {member.provisional_certificate_count || 0}개
                    </span>
                    <span className="rounded border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-200">
                        최종 {member.manual_certificate_count ?? member.effective_certificate_count ?? 0}개
                    </span>
                    <span className="text-xs font-bold text-slate-500 group-open:hidden">열기</span>
                    <span className="hidden text-xs font-bold text-slate-500 group-open:inline">닫기</span>
                </div>
            </summary>
            <div className="mt-4 space-y-3">
                {member.certificate_summary_is_grouped ? (
                    <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-200">
                        인물 통합 묶음: 직접 수정 비활성화
                    </div>
                ) : null}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase text-gray-500">최종 인정 관리 수</span>
                        {isEditing && canEditCertificateSummary ? (
                            <Input
                                type="number"
                                min={0}
                                className="h-8 border-white/10 bg-[#1A2633] font-mono text-sm text-white"
                                value={formData.manual_certificate_count ?? ''}
                                onChange={(event) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        manual_certificate_count:
                                            event.target.value === ''
                                                ? null
                                                : Math.max(0, Number(event.target.value) || 0),
                                    }))
                                }
                                placeholder={String(member.provisional_certificate_count || 0)}
                            />
                        ) : (
                            <div className="flex h-8 items-center rounded-md border border-white/10 bg-[#1A2633] px-3 font-mono text-sm font-bold text-white">
                                {member.manual_certificate_count ?? '-'}
                            </div>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase text-gray-500">검토 상태</span>
                        {isEditing && canEditCertificateSummary ? (
                            <select
                                className="h-8 w-full rounded-md border border-white/10 bg-[#1A2633] px-2 text-sm text-white"
                                value={formData.certificate_summary_review_status || 'pending'}
                                onChange={(event) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        certificate_summary_review_status:
                                            event.target.value as CertificateSummaryReviewStatus,
                                    }))
                                }
                            >
                                {Object.entries(CERTIFICATE_SUMMARY_STATUS_LABEL).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="flex h-8 items-center rounded-md border border-white/10 bg-[#1A2633] px-3 text-sm font-bold text-white">
                                {CERTIFICATE_SUMMARY_STATUS_LABEL[member.certificate_summary_review_status || 'pending']}
                            </div>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase text-gray-500">소유 구분</span>
                        <div className="flex h-8 items-center rounded-md border border-white/10 bg-[#1A2633] px-3 text-sm font-bold text-white">
                            {member.owner_group === 'registered' ? '등기조합원' : '기타'}
                        </div>
                    </div>
                </div>
                <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-gray-500">검토 메모</span>
                    {isEditing && canEditCertificateSummary ? (
                        <Input
                            className="h-8 border-white/10 bg-[#1A2633] text-sm text-white"
                            value={formData.certificate_summary_note || ''}
                            onChange={(event) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    certificate_summary_note: event.target.value,
                                }))
                            }
                            placeholder="예: 최종 관리번호 1건으로 인정"
                        />
                    ) : (
                        <div className="min-h-8 rounded-md border border-white/10 bg-[#1A2633] px-3 py-2 text-sm font-medium text-white">
                            {member.certificate_summary_note || '-'}
                        </div>
                    )}
                </div>
            </div>
        </details>
    );
}
