'use client';

import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import {
    ACCOUNT_TYPE_LABELS,
    PaymentTypeIcon,
    getAccountBadgeClass,
    getPaymentDisplayLabel,
    isSystemManagedUnionFee,
    renderPaymentStatusBadge,
    type DepositAccount,
    type PaymentRecord,
} from './paymentStatusTabUtils';

export function PaymentDetailsTable({
    accounts,
    editForm,
    editingId,
    payments,
    saving,
    onCancelEdit,
    onDelete,
    onEditFormChange,
    onSaveEdit,
    onStartEdit,
}: {
    accounts: DepositAccount[];
    editForm: Partial<PaymentRecord>;
    editingId: string | null;
    payments: PaymentRecord[];
    saving: boolean;
    onCancelEdit: () => void;
    onDelete: (id: string) => void;
    onEditFormChange: (patch: Partial<PaymentRecord>) => void;
    onSaveEdit: () => void;
    onStartEdit: (payment: PaymentRecord) => void;
}) {
    return (
        <div className="overflow-hidden rounded-lg border border-white/5 bg-[#233040] shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-xs">
                    <thead className="border-b border-white/5 bg-[#1A2633]">
                        <tr>
                            <th className="px-3 py-3 text-left font-bold text-gray-400">항목</th>
                            <th className="px-3 py-3 text-right font-bold text-gray-400">청구액</th>
                            <th className="px-3 py-3 text-right font-bold text-gray-400">수납액</th>
                            <th className="px-3 py-3 text-center font-bold text-gray-400">계좌</th>
                            <th className="px-3 py-3 text-center font-bold text-gray-400">납부일</th>
                            <th className="px-3 py-3 text-center font-bold text-gray-400">상태</th>
                            <th className="px-3 py-3 text-center font-bold text-gray-400">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {payments.map((payment) => {
                            const isEditing = editingId === payment.id;
                            const account = accounts.find((item) => item.id === payment.deposit_account_id);
                            const isPremiumType =
                                payment.payment_type === 'premium' || payment.payment_type === 'premium_recognized';
                            const isSystemUnionFee = isSystemManagedUnionFee(payment);

                            return (
                                <tr
                                    key={payment.id}
                                    className={cn(
                                        'transition-colors hover:bg-white/[0.02]',
                                        isPremiumType && 'bg-violet-500/[0.03]',
                                        isSystemUnionFee && 'bg-sky-500/[0.05]',
                                    )}
                                >
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <PaymentTypeIcon
                                                paymentType={payment.payment_type}
                                                isPremiumType={isPremiumType}
                                                isSystemUnionFee={isSystemUnionFee}
                                            />
                                            <div>
                                                <span className="font-bold text-gray-200">
                                                    {getPaymentDisplayLabel(payment)}
                                                </span>
                                                {isSystemUnionFee && (
                                                    <>
                                                        <span className="ml-1.5 rounded border border-sky-400/20 bg-sky-500/10 px-1 text-[9px] text-sky-300">
                                                            필수납부
                                                        </span>
                                                        <span className="ml-1 rounded border border-cyan-400/20 bg-cyan-500/10 px-1 text-[9px] text-cyan-300">
                                                            분담금포함
                                                        </span>
                                                    </>
                                                )}
                                                {!payment.is_contribution && (
                                                    <span className="ml-1.5 rounded border border-violet-500/20 bg-violet-500/10 px-1 text-[9px] text-violet-400">
                                                        분담금제외
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-medium text-gray-400">
                                        {Number(payment.amount_due) > 0 ? Number(payment.amount_due).toLocaleString() : '―'}
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={editForm.amount_paid ?? ''}
                                                onChange={(event) =>
                                                    onEditFormChange({ amount_paid: Number(event.target.value) })
                                                }
                                                className="w-24 rounded border border-white/10 bg-[#0F151B] px-2 py-1 text-right text-xs text-white outline-none focus:border-blue-500"
                                                autoFocus
                                            />
                                        ) : (
                                            <span
                                                className={cn(
                                                    'font-bold',
                                                    Number(payment.amount_paid) > 0 ? 'text-gray-100' : 'text-gray-600',
                                                )}
                                            >
                                                {Number(payment.amount_paid) > 0 ? Number(payment.amount_paid).toLocaleString() : '0'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        {isEditing ? (
                                            <select
                                                value={editForm.deposit_account_id || ''}
                                                onChange={(event) =>
                                                    onEditFormChange({ deposit_account_id: event.target.value || null })
                                                }
                                                className="rounded border border-white/10 bg-[#0F151B] px-1 py-1 text-[10px] text-white outline-none focus:border-blue-500"
                                            >
                                                <option value="">미지정</option>
                                                {accounts.map((accountItem) => (
                                                    <option key={accountItem.id} value={accountItem.id}>
                                                        {accountItem.account_name} (
                                                        {ACCOUNT_TYPE_LABELS[accountItem.account_type] || accountItem.account_type})
                                                    </option>
                                                ))}
                                            </select>
                                        ) : account ? (
                                            <span
                                                className={cn(
                                                    'rounded border px-1.5 py-0.5 text-[10px]',
                                                    getAccountBadgeClass(account.account_type),
                                                )}
                                            >
                                                {account.account_name}
                                            </span>
                                        ) : (
                                            <span className="text-gray-600">―</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        {isEditing ? (
                                            <input
                                                type="date"
                                                value={editForm.paid_date || ''}
                                                onChange={(event) => onEditFormChange({ paid_date: event.target.value || null })}
                                                className="rounded border border-white/10 bg-[#0F151B] px-1 py-1 text-[10px] text-white outline-none focus:border-blue-500"
                                            />
                                        ) : (
                                            <span className="font-medium text-gray-500">{payment.paid_date || '―'}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        {renderPaymentStatusBadge(payment.status, payment)}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        {isEditing ? (
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={onSaveEdit}
                                                    disabled={saving}
                                                    className="rounded p-1 text-emerald-400 transition-colors hover:bg-emerald-500/10"
                                                >
                                                    <MaterialIcon name="check" size="sm" />
                                                </button>
                                                <button
                                                    onClick={onCancelEdit}
                                                    className="rounded p-1 text-red-400 transition-colors hover:bg-red-500/10"
                                                >
                                                    <MaterialIcon name="close" size="sm" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => onStartEdit(payment)}
                                                    className="rounded p-1 text-gray-500 transition-colors hover:bg-white/10 hover:text-blue-400"
                                                >
                                                    <MaterialIcon name="edit" size="sm" />
                                                </button>
                                                {isPremiumType && (
                                                    <button
                                                        onClick={() => onDelete(payment.id)}
                                                        className="rounded p-1 text-gray-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                                                    >
                                                        <MaterialIcon name="delete_outline" size="sm" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {payments.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                                    배정 평형을 선택하면 납부 항목이 자동 생성됩니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
