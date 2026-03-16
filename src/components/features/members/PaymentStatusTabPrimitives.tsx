'use client';

import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { UnitType } from './paymentStatusTabUtils';

export function UnitTypeSelectorSection({
    unitTypes,
    selectedUnitTypeId,
    selectedUnitType,
    saving,
    onAssignUnitType,
}: {
    unitTypes: UnitType[];
    selectedUnitTypeId: string | null;
    selectedUnitType?: UnitType;
    saving: boolean;
    onAssignUnitType: (unitTypeId: string) => void;
}) {
    return (
        <div className="rounded-lg border border-white/5 bg-[#233040] p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
                <MaterialIcon name="straighten" className="text-[20px] text-sky-400" />
                <p className="text-xs font-bold text-gray-300">배정 평형</p>
            </div>
            <div className="flex flex-wrap gap-2">
                {unitTypes.map((unitType) => (
                    <button
                        key={unitType.id}
                        onClick={() => onAssignUnitType(unitType.id)}
                        disabled={saving}
                        className={cn(
                            'rounded-lg border px-4 py-2 text-sm font-bold transition-all',
                            selectedUnitTypeId === unitType.id
                                ? 'border-sky-400/40 bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30'
                                : 'border-white/[0.08] bg-white/[0.03] text-gray-400 hover:bg-white/[0.06] hover:text-gray-200',
                        )}
                    >
                        {unitType.name}
                    </button>
                ))}
                {unitTypes.length === 0 && (
                    <p className="text-xs text-gray-500">평형 정보가 없습니다. 설정에서 추가해주세요.</p>
                )}
            </div>
            {selectedUnitType && (
                <p className="mt-2 text-[11px] text-gray-500">
                    총 분담금: <span className="font-bold text-gray-300">₩{selectedUnitType.total_contribution.toLocaleString()}</span>
                </p>
            )}
        </div>
    );
}

export function PaymentSummarySection({
    totalInvestment,
    certificateAmount,
    premiumRecognized,
    pureAdditionalBurden,
}: {
    totalInvestment: number;
    certificateAmount: number;
    premiumRecognized: number;
    pureAdditionalBurden: number;
}) {
    return (
        <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/5 bg-[#233040] p-4 shadow-sm">
                <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <MaterialIcon name="savings" className="text-[14px] text-emerald-500" />
                    출자금 (필증+인정분)
                </p>
                <p className="text-lg font-black tracking-tight text-emerald-400">₩{totalInvestment.toLocaleString()}</p>
                <p className="mt-0.5 text-[10px] text-gray-500">
                    필증 {certificateAmount.toLocaleString()} + 인정 {premiumRecognized.toLocaleString()}
                </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-[#233040] p-4 shadow-sm">
                <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <MaterialIcon name="account_balance_wallet" className="text-[14px] text-amber-500" />
                    추가 부담금
                </p>
                <p
                    className={cn(
                        'text-lg font-black tracking-tight',
                        pureAdditionalBurden > 0 ? 'text-amber-400' : 'text-gray-500',
                    )}
                >
                    ₩{Math.max(0, pureAdditionalBurden).toLocaleString()}
                </p>
                <p className="mt-0.5 text-[10px] text-gray-500">총분담금 - 출자금</p>
            </div>
        </div>
    );
}

export function PaymentProgressSection({
    contributionRate,
    totalContributionDue,
    totalContributionPaid,
    totalContributionUnpaid,
}: {
    contributionRate: number;
    totalContributionDue: number;
    totalContributionPaid: number;
    totalContributionUnpaid: number;
}) {
    return (
        <div className="rounded-lg border border-white/5 bg-[#233040] p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">분담금 납부 진행률</span>
                    <span className="text-[10px] text-gray-500">(프리미엄 제외)</span>
                </div>
                <span className="text-xs font-black text-white">{contributionRate}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0F151B]">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-500 ease-out"
                    style={{ width: `${contributionRate}%` }}
                />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                    <p className="text-[10px] text-gray-500">총 청구</p>
                    <p className="text-xs font-bold text-white">₩{totalContributionDue.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-[10px] text-emerald-500">수납</p>
                    <p className="text-xs font-bold text-emerald-400">₩{totalContributionPaid.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-[10px] text-red-500">미납</p>
                    <p className="text-xs font-bold text-red-400">₩{totalContributionUnpaid.toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
}

export function AddPremiumControls({
    addingPremium,
    hasPayments,
    saving,
    onAddPremium,
    onToggleAddingPremium,
}: {
    addingPremium: boolean;
    hasPayments: boolean;
    saving: boolean;
    onAddPremium: (type: 'premium' | 'premium_recognized') => void;
    onToggleAddingPremium: (value: boolean) => void;
}) {
    if (!hasPayments) return null;

    return (
        <div className="flex gap-2">
            {!addingPremium ? (
                <button
                    onClick={() => onToggleAddingPremium(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs font-bold text-violet-400 transition-colors hover:bg-violet-500/10"
                >
                    <MaterialIcon name="add" size="sm" />
                    프리미엄 항목 추가
                </button>
            ) : (
                <div className="flex gap-2">
                    <button
                        onClick={() => onAddPremium('premium')}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-300 transition-colors hover:bg-violet-500/20"
                    >
                        <MaterialIcon name="diamond" size="sm" />
                        프리미엄 (분담금 제외)
                    </button>
                    <button
                        onClick={() => onAddPremium('premium_recognized')}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-500/20"
                    >
                        <MaterialIcon name="verified" size="sm" />
                        프리미엄 인정분 (출자금 반영)
                    </button>
                    <button
                        onClick={() => onToggleAddingPremium(false)}
                        className="rounded-lg px-2 py-2 text-xs text-gray-500 transition-colors hover:text-gray-300"
                    >
                        취소
                    </button>
                </div>
            )}
        </div>
    );
}

export function PaymentRequestButton({ totalContributionUnpaid }: { totalContributionUnpaid: number }) {
    if (totalContributionUnpaid <= 0) return null;

    return (
        <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-500 active:scale-[0.98]">
            <MaterialIcon name="send" size="sm" />
            <span className="text-sm">납부 요청 문자 발송</span>
        </button>
    );
}
