'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MaterialIcon } from '@/components/ui/icon';
import { resolveCertificateRight } from '@/lib/certificates/rightNumbers';
import {
    getReadableRightNote,
    parseCertificateMeta,
    type AssetRight,
} from './memberDetailDialogUtils';
import type { MemberDetailDialogMember } from './memberDetailDialogTypes';

interface MemberDetailDialogRightsListProps {
    member: MemberDetailDialogMember;
    sortedAssetRights: AssetRight[];
    manageableRights: AssetRight[];
    conflictRightNumbers: string[];
    selectedRightIds: string[];
    setSelectedRightIds: Dispatch<SetStateAction<string[]>>;
    isEditing: boolean;
    isAdmin: boolean;
    onDeleteRight: (rightId: string) => void;
    onRightChange: (rightId: string, field: string, value: string) => void;
    onShowLineage: (rightId: string) => void;
}

export function MemberDetailDialogRightsList({
    member,
    sortedAssetRights,
    manageableRights,
    conflictRightNumbers,
    selectedRightIds,
    setSelectedRightIds,
    isEditing,
    isAdmin,
    onDeleteRight,
    onRightChange,
    onShowLineage,
}: MemberDetailDialogRightsListProps) {
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-base font-bold text-white">
                        <span className="h-4 w-1 rounded-full bg-sky-500"></span>권리 흐름 상세
                    </h3>
                    <span className="text-[11px] font-bold text-slate-400">{member.assetRights?.length || 0}개 항목</span>
                </div>
            </div>
            <div className="space-y-4">
                <div className="grid gap-3">
                    {sortedAssetRights.map((right) => {
                        const meta = parseCertificateMeta(right.right_number_note);
                        const isManaged = meta?.node_type === 'derivative';
                        const canSelect =
                            !isEditing &&
                            manageableRights.some((item) => item.id === right.id) &&
                            manageableRights.length > 1;

                        return (
                            <div
                                key={right.id}
                                className="rounded-xl border border-white/5 bg-[#233040] p-4 transition-colors hover:border-white/10"
                            >
                                <div className="mb-3 flex items-start justify-between gap-4 text-left">
                                    <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                                        <div className="flex items-center gap-2">
                                            <span className="text-left text-[10px] font-bold uppercase tracking-widest text-sky-400">
                                                {isManaged
                                                    ? '통합 관리번호'
                                                    : right.right_type === 'certificate'
                                                      ? '원천 권리증'
                                                      : right.right_type || '원천 권리증'}
                                            </span>
                                            {isManaged ? (
                                                <span className="shrink-0 rounded border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-black text-purple-400">
                                                    관리번호
                                                </span>
                                            ) : null}
                                            {conflictRightNumbers.includes(right.right_number || '') ? (
                                                <span className="shrink-0 rounded border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-black text-rose-500">
                                                    ⚠️ 중복(경합)
                                                </span>
                                            ) : null}
                                        </div>
                                        {isEditing ? (
                                            <Input
                                                className="h-8 border-white/10 bg-[#1A2633] font-mono text-sm font-bold text-white"
                                                value={right.right_number_raw || right.right_number || ''}
                                                onChange={(event) => onRightChange(right.id, 'right_number', event.target.value)}
                                                placeholder="번호 또는 원문 입력"
                                            />
                                        ) : (
                                            <span className="break-all text-left font-mono text-base font-black tracking-tight text-white">
                                                {resolveCertificateRight(right).confirmedNumber ||
                                                    right.right_number_raw ||
                                                    right.right_number ||
                                                    '번호 없음'}
                                            </span>
                                        )}
                                        {!isEditing &&
                                        right.right_number_status &&
                                        right.right_number_status !== 'confirmed' &&
                                        right.right_number_raw ? (
                                            <span className="break-all text-left text-[11px] text-gray-400">
                                                원문: {right.right_number_raw}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="flex shrink-0 flex-col gap-1 pt-1 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {isManaged ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onShowLineage(right.id)}
                                                    className="h-6 border border-purple-500/30 bg-purple-500/10 px-1.5 text-[9px] font-bold text-purple-300 hover:bg-purple-500/20"
                                                >
                                                    <MaterialIcon name="account_tree" size="xs" className="mr-1" />
                                                    흐름보기
                                                </Button>
                                            ) : null}
                                            {canSelect ? (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRightIds.includes(right.id)}
                                                    onChange={(event) => {
                                                        if (event.target.checked) {
                                                            setSelectedRightIds((prev) => [...prev, right.id]);
                                                            return;
                                                        }
                                                        setSelectedRightIds((prev) => prev.filter((id) => id !== right.id));
                                                    }}
                                                    className="size-4 rounded border-white/10 bg-white/5 accent-emerald-500"
                                                    title="통합 관리번호로 묶을 권리증 선택"
                                                />
                                            ) : null}
                                            {isEditing ? (
                                                <button
                                                    onClick={() => onDeleteRight(right.id)}
                                                    className="flex items-center justify-center gap-1 rounded border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-400 transition-colors hover:bg-rose-500/20"
                                                >
                                                    <MaterialIcon name="delete" size="xs" className="text-[12px]" />
                                                    삭제
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-4 border-t border-white/5 pt-3 text-left md:grid-cols-3">
                                    <div className="flex min-w-0 flex-col gap-1 text-left">
                                        <span className="text-left text-[10px] font-bold uppercase text-gray-500">발급일</span>
                                        {isEditing ? (
                                            <Input
                                                className="h-8 border-white/10 bg-[#1A2633] px-2 font-mono text-xs text-white"
                                                value={right.issued_at || ''}
                                                onChange={(event) => onRightChange(right.id, 'issued_at', event.target.value)}
                                                placeholder="YYYY-MM-DD"
                                            />
                                        ) : (
                                            <span className="text-left font-mono text-sm font-bold text-white">
                                                {right.issued_at || '미상'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex min-w-0 flex-col gap-1 text-left">
                                        <span className="text-left text-[10px] font-bold uppercase text-gray-500">가액 / 납부액</span>
                                        {isEditing ? (
                                            <div className="flex items-center gap-1">
                                                <span className="text-sm font-bold text-gray-500">₩</span>
                                                <Input
                                                    type="number"
                                                    className="h-8 w-full border-white/10 bg-[#1A2633] font-mono text-sm text-white"
                                                    value={right.principal_amount || ''}
                                                    onChange={(event) => onRightChange(right.id, 'principal_amount', event.target.value)}
                                                    placeholder="0"
                                                />
                                            </div>
                                        ) : (
                                            <span className="truncate text-left font-mono text-sm font-bold text-white">
                                                ₩{(Number(right.principal_amount) || 0).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex min-w-0 flex-col gap-1 text-left">
                                        <span className="text-left text-[10px] font-bold uppercase text-gray-500">관리 메모</span>
                                        {isEditing ? (
                                            <Input
                                                className="h-8 w-full border-white/10 bg-[#1A2633] text-sm text-white"
                                                value={right.right_number_note || ''}
                                                onChange={(event) => onRightChange(right.id, 'right_number_note', event.target.value)}
                                                placeholder="관리 메모"
                                            />
                                        ) : (
                                            <span className="text-left text-sm font-bold text-white">
                                                {isAdmin ? getReadableRightNote(right.right_number_note) : '***'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {isAdmin &&
                                (right.holder_name ||
                                    right.price_text ||
                                    right.acquisition_source ||
                                    right.issued_date) ? (
                                    <div className="mt-3 border-t border-white/5 pt-3">
                                        <div className="mb-2 flex items-center gap-1.5">
                                            <MaterialIcon name="receipt_long" size="xs" className="text-amber-400/70" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/70">
                                                취득 정보
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                            {right.holder_name ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[9px] font-bold uppercase text-gray-500">필증 성명</span>
                                                    <span className="text-xs font-bold text-gray-200">{right.holder_name}</span>
                                                </div>
                                            ) : null}
                                            {right.issued_date ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[9px] font-bold uppercase text-gray-500">필증 발급일</span>
                                                    <span className="font-mono text-xs font-bold text-gray-200">{right.issued_date}</span>
                                                </div>
                                            ) : null}
                                            {right.price_text ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[9px] font-bold uppercase text-gray-500">거래 가격</span>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {Number(right.certificate_price) > 0 ? (
                                                            <span className="rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
                                                                필증 {(Number(right.certificate_price) / 10000).toLocaleString()}만
                                                            </span>
                                                        ) : null}
                                                        {Number(right.premium_price) > 0 ? (
                                                            <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                                                                P {(Number(right.premium_price) / 10000).toLocaleString()}만
                                                            </span>
                                                        ) : null}
                                                        {Number(right.broker_fee) > 0 ? (
                                                            <span className="rounded border border-gray-500/20 bg-gray-500/10 px-1.5 py-0.5 text-[10px] font-bold text-gray-400">
                                                                수수료 {(Number(right.broker_fee) / 10000).toLocaleString()}만
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            ) : null}
                                            {right.acquisition_source ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[9px] font-bold uppercase text-gray-500">구입처</span>
                                                    <span className="text-xs font-bold text-gray-200">{right.acquisition_source}</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
