'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MaterialIcon } from '@/components/ui/icon';
import { cn, formatSafeDateTime } from '@/lib/utils';
import type { SmsDeliveryMode } from '@/lib/server/smsDelivery';
import {
    SMS_VARIABLES,
    formatSmsHistoryRelativeTime,
    getSmsPaymentLabel,
    getSmsTierLabel,
    renderSmsMessage,
    smsTemplateMeta,
    type SmsTemplateKey,
} from './bulkSmsWorkspaceUtils';
import type { SmsFilterState, SmsHistoryItem, SmsRecipient } from './bulkSmsWorkspaceTypes';

export function BulkSmsSidebar({
    draft,
    filteredRecipients,
    missingCount,
    reachableCount,
    sendableCount,
    statusOptions,
    tierOptions,
    totalPeople,
    unpaidCount,
    onApplyFilters,
    onDraftChange,
    onResetFilters,
}: {
    draft: SmsFilterState;
    filteredRecipients: SmsRecipient[];
    missingCount: number;
    reachableCount: number;
    sendableCount: number;
    statusOptions: string[];
    tierOptions: string[];
    totalPeople: number;
    unpaidCount: number;
    onApplyFilters: () => void;
    onDraftChange: (patch: Partial<SmsFilterState>) => void;
    onResetFilters: () => void;
}) {
    return (
        <aside className="space-y-6">
            <section className="rounded-[24px] border border-white/8 bg-card/90 p-5">
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                        <MaterialIcon name="contacts" size="lg" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">연락처 명부</p>
                        <p className="text-lg font-bold text-white">조합원 데이터 연동</p>
                    </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    {[
                        ['전체 인물', `${totalPeople.toLocaleString()}명`, 'text-white'],
                        ['발송 가능', `${reachableCount.toLocaleString()}명`, 'text-emerald-300'],
                        ['미납자', `${unpaidCount.toLocaleString()}명`, 'text-amber-300'],
                        ['선택 대상', `${sendableCount.toLocaleString()}명`, 'text-sky-300'],
                    ].map(([label, value, tone]) => (
                        <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                            <p className={cn('mt-2 text-2xl font-black tracking-[-0.03em]', tone)}>{value}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-[24px] border border-white/8 bg-card/90 p-5">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">수신자 필터</p>
                <div className="space-y-4">
                    <Input
                        value={draft.query}
                        onChange={(event) => onDraftChange({ query: event.target.value })}
                        placeholder="이름, 동호수, 전화번호"
                        className="h-11 rounded-2xl border-white/10 bg-white/[0.03] text-white placeholder:text-slate-500"
                    />
                    <select
                        value={draft.tier}
                        onChange={(event) => onDraftChange({ tier: event.target.value })}
                        className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none"
                    >
                        <option value="all">전체 차수</option>
                        {tierOptions.filter((value) => value !== 'all').map((value) => (
                            <option key={value} value={value}>
                                {value}
                            </option>
                        ))}
                    </select>
                    <select
                        value={draft.status}
                        onChange={(event) => onDraftChange({ status: event.target.value })}
                        className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none"
                    >
                        <option value="all">전체 상태</option>
                        {statusOptions.filter((value) => value !== 'all').map((value) => (
                            <option key={value} value={value}>
                                {value}
                            </option>
                        ))}
                    </select>
                    <select
                        value={draft.paymentStatus}
                        onChange={(event) => onDraftChange({ paymentStatus: event.target.value })}
                        className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none"
                    >
                        <option value="all">전체 납부 상태</option>
                        <option value="unpaid">미납자만</option>
                        <option value="paid">완납자만</option>
                        <option value="none">납부정보 없음</option>
                    </select>
                    <div className="flex gap-3">
                        <Button type="button" className="h-11 flex-1 rounded-2xl bg-primary text-white" onClick={onApplyFilters}>
                            <MaterialIcon name="search" size="md" />
                            대상 조회
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-11 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-white hover:bg-white/[0.08]"
                            onClick={onResetFilters}
                        >
                            초기화
                        </Button>
                    </div>
                </div>
            </section>

            <section className="rounded-[24px] border border-white/8 bg-card/90 p-5">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">연락처 명부</p>
                        <p className="text-lg font-bold text-white">{filteredRecipients.length.toLocaleString()}명</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
                        누락 {missingCount.toLocaleString()}명
                    </span>
                </div>
                <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
                    {filteredRecipients.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-slate-400">
                            조건에 맞는 수신자가 없습니다.
                        </div>
                    ) : (
                        filteredRecipients.map((recipient) => (
                            <div
                                key={recipient.id}
                                className={cn('rounded-2xl border px-4 py-3', recipient.hasReachablePhone ? 'border-white/8 bg-white/[0.02]' : 'border-rose-500/20 bg-rose-500/6')}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-base font-black tracking-[-0.02em] text-white">{recipient.name}</p>
                                        <p className="mt-1 text-sm text-slate-300">{recipient.phone || '연락처 미입력'}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-slate-300">
                                            {getSmsTierLabel(recipient.tier)}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                                    <span>{recipient.unitGroup || '동호수 미입력'}</span>
                                    <span className={cn(recipient.paymentStatus === 'unpaid' ? 'text-amber-300' : recipient.paymentStatus === 'paid' ? 'text-emerald-300' : 'text-slate-400')}>
                                        {getSmsPaymentLabel(recipient.paymentStatus)} · {recipient.unpaidAmount.toLocaleString('ko-KR')}원
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </aside>
    );
}

export function BulkSmsComposer({
    deliveryMode,
    filteredRecipients,
    isPending,
    message,
    missingCount,
    previewRecipient,
    scheduledAt,
    sendableRecipients,
    templateKey,
    onApplyTemplate,
    onMessageChange,
    onScheduledAtChange,
    onSend,
    onResetDraft,
}: {
    deliveryMode: SmsDeliveryMode;
    filteredRecipients: SmsRecipient[];
    isPending: boolean;
    message: string;
    missingCount: number;
    previewRecipient?: SmsRecipient;
    scheduledAt: string;
    sendableRecipients: SmsRecipient[];
    templateKey: SmsTemplateKey;
    onApplyTemplate: (key: SmsTemplateKey) => void;
    onMessageChange: (value: string | ((prev: string) => string)) => void;
    onScheduledAtChange: (value: string) => void;
    onSend: () => void;
    onResetDraft: () => void;
}) {
    return (
        <section className="space-y-6">
            <section className="rounded-[24px] border border-white/8 bg-card/90 p-5">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">메시지 템플릿</p>
                <div className="grid gap-3 md:grid-cols-3">
                    {(Object.keys(smsTemplateMeta) as SmsTemplateKey[]).map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onApplyTemplate(key)}
                            className={cn('rounded-[22px] border px-4 py-5 text-left transition-all', templateKey === key ? 'border-primary/40 bg-primary/10' : 'border-white/8 bg-white/[0.02] hover:border-white/14 hover:bg-white/[0.04]')}
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-slate-200">
                                    <MaterialIcon name={smsTemplateMeta[key].icon} size="lg" />
                                </div>
                                <div>
                                    <p className="text-base font-black text-white">{smsTemplateMeta[key].label}</p>
                                    <p className="mt-1 text-xs text-slate-400">{key === 'custom' ? '직접 작성합니다.' : '기본 문구를 불러옵니다.'}</p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6">
                    <section className="rounded-[24px] border border-white/8 bg-card/90 p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">메시지 내용</p>
                                <p className="text-lg font-bold text-white">공통 발송 문구</p>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
                                {message.length.toLocaleString()} / 90자
                            </span>
                        </div>
                        <Textarea
                            value={message}
                            onChange={(event) => onMessageChange(event.target.value)}
                            placeholder="문자 내용을 입력하세요. 예: 안녕하세요 {이름}님, 미납액은 {미납액}원입니다."
                            className="min-h-[220px] rounded-[22px] border-white/10 bg-[#0b1220] px-5 py-4 text-base leading-7 text-white placeholder:text-slate-500"
                        />
                        <div className="mt-4 flex flex-wrap gap-2">
                            {SMS_VARIABLES.map((variable) => (
                                <button
                                    key={variable}
                                    type="button"
                                    onClick={() => onMessageChange((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${variable}`)}
                                    className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20"
                                >
                                    {variable}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-[24px] border border-white/8 bg-card/90 p-5">
                        <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">미리보기</p>
                        <div className="rounded-[22px] border border-white/8 bg-[#0b1220] p-6">
                            <div className="mx-auto max-w-[360px] rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(25,34,51,0.98),rgba(17,24,38,0.98))] p-5">
                                <div className="mb-4 flex items-center gap-3 border-b border-white/8 pb-4">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                                        <MaterialIcon name="apartment" size="lg" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-white">People On</p>
                                        <p className="text-xs text-slate-400">{previewRecipient ? `${previewRecipient.name} 기준` : '수신자 없음'}</p>
                                    </div>
                                </div>
                                <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-100">
                                    {message.trim() ? renderSmsMessage(message, previewRecipient, scheduledAt ? formatSafeDateTime(scheduledAt) : null) : '메시지 내용이 여기에 표시됩니다.'}
                                </p>
                            </div>
                        </div>
                    </section>
                </div>

                <aside className="space-y-6">
                    <section className="rounded-[24px] border border-white/8 bg-card/90 p-5">
                        <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">발송 시점</p>
                        <Input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(event) => onScheduledAtChange(event.target.value)}
                            className="h-12 rounded-2xl border-white/10 bg-white/[0.03] text-white"
                        />
                        <p className="mt-3 text-sm leading-6 text-slate-400">예약 시간을 입력하면 예약 발송 기록으로 저장됩니다.</p>
                    </section>

                    <section className="rounded-[24px] border border-white/8 bg-card/90 p-5">
                        <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">발송 실행</p>
                        <div className="space-y-3 rounded-[22px] border border-white/8 bg-white/[0.02] p-4">
                            <div className="flex items-center justify-between text-sm text-slate-400">
                                <span>조회 결과</span>
                                <span className="font-semibold text-white">{filteredRecipients.length.toLocaleString()}명</span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-slate-400">
                                <span>발송 가능</span>
                                <span className="font-semibold text-emerald-300">{sendableRecipients.length.toLocaleString()}명</span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-slate-400">
                                <span>연락처 누락</span>
                                <span className="font-semibold text-rose-300">{missingCount.toLocaleString()}명</span>
                            </div>
                        </div>
                        <div className="mt-4 flex gap-3">
                            <Button type="button" variant="outline" className="h-12 flex-1 rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]" onClick={onResetDraft}>
                                임시 초기화
                            </Button>
                            <Button type="button" className="h-12 flex-1 rounded-2xl bg-primary text-white" onClick={onSend} disabled={isPending}>
                                <MaterialIcon name="send" size="md" />
                                {isPending ? (scheduledAt || deliveryMode === 'webhook' ? '전송 중...' : '저장 중...') : '발송하기'}
                            </Button>
                        </div>
                    </section>
                </aside>
            </div>
        </section>
    );
}

export function BulkSmsHistoryDialog({
    history,
    open,
    onOpenChange,
}: {
    history: SmsHistoryItem[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[860px] border-white/10 bg-[#0f1726] text-white">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black tracking-[-0.03em]">발송 이력</DialogTitle>
                    <DialogDescription className="text-slate-400">발송 이력은 활동 로그에 기록됩니다.</DialogDescription>
                </DialogHeader>
                <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                    {history.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-12 text-center text-sm text-slate-400">
                            발송 이력이 없습니다.
                        </div>
                    ) : (
                        history.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-lg font-black text-white">{item.memberName}</p>
                                        <p className="mt-1 text-sm text-slate-400">{item.phone || '연락처 미기록'}</p>
                                    </div>
                                    <div className="text-right text-xs text-slate-400">
                                        <p>{formatSmsHistoryRelativeTime(item.createdAt)}</p>
                                        <p className="mt-1">{formatSafeDateTime(item.createdAt)}</p>
                                    </div>
                                </div>
                                <div className="mt-4 rounded-2xl border border-white/8 bg-[#0b1220] px-4 py-3 text-sm leading-6 text-slate-200">
                                    {item.summary}
                                </div>
                                <div className="mt-3 text-xs text-slate-400">기록자: {item.staffName}</div>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
