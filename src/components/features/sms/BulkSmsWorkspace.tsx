'use client';

import { useMemo, useState, useTransition } from 'react';
import type { SmsDeliveryMode } from '@/lib/server/smsDelivery';
import {
    BulkSmsComposer,
    BulkSmsFeedbackBanner,
    BulkSmsHeader,
    BulkSmsHistoryDialog,
    BulkSmsSidebar,
} from './BulkSmsWorkspaceSections';
import {
    buildSmsFilterOptions,
    buildSmsPreviewRecipient,
    filterSmsRecipients,
    getSendableSmsRecipients,
    getSmsMissingCount,
    smsTemplates,
    type SmsTemplateKey,
} from './bulkSmsWorkspaceUtils';
import type { SmsFeedback, SmsFilterState, SmsHistoryItem, SmsRecipient } from './bulkSmsWorkspaceTypes';

export type { SmsHistoryItem, SmsRecipient } from './bulkSmsWorkspaceTypes';

export function BulkSmsWorkspace({
    recipients,
    history,
    totalPeople,
    reachableCount,
    unpaidCount,
    deliveryMode,
}: {
    recipients: SmsRecipient[];
    history: SmsHistoryItem[];
    totalPeople: number;
    reachableCount: number;
    unpaidCount: number;
    deliveryMode: SmsDeliveryMode;
}) {
    const initialFilters: SmsFilterState = { query: '', tier: 'all', status: 'all', paymentStatus: 'all' };
    const [draft, setDraft] = useState<SmsFilterState>(initialFilters);
    const [filters, setFilters] = useState<SmsFilterState>(initialFilters);
    const [message, setMessage] = useState('');
    const [templateKey, setTemplateKey] = useState<SmsTemplateKey>('custom');
    const [scheduledAt, setScheduledAt] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [feedback, setFeedback] = useState<SmsFeedback | null>(null);
    const [isPending, startTransition] = useTransition();

    const { tierOptions, statusOptions } = useMemo(() => buildSmsFilterOptions(recipients), [recipients]);
    const filteredRecipients = useMemo(() => filterSmsRecipients(recipients, filters), [filters, recipients]);
    const sendableRecipients = useMemo(() => getSendableSmsRecipients(filteredRecipients), [filteredRecipients]);
    const previewRecipient = useMemo(() => buildSmsPreviewRecipient(sendableRecipients), [sendableRecipients]);
    const missingCount = useMemo(
        () => getSmsMissingCount(filteredRecipients, sendableRecipients),
        [filteredRecipients, sendableRecipients],
    );

    const applyTemplate = (key: SmsTemplateKey) => {
        setTemplateKey(key);
        setMessage(smsTemplates[key]);
    };

    const onSend = () => {
        if (!message.trim()) {
            setFeedback({ tone: 'error', text: '메시지 내용을 먼저 입력하세요.' });
            return;
        }

        if (sendableRecipients.length === 0) {
            setFeedback({ tone: 'error', text: '발송 가능한 연락처가 있는 수신자를 먼저 조회하세요.' });
            return;
        }

        startTransition(async () => {
            try {
                const response = await fetch('/api/sms/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipients: sendableRecipients.map((recipient) => ({
                            entityId: recipient.entityId,
                            name: recipient.name,
                            phone: recipient.phone,
                            unitGroup: recipient.unitGroup,
                            unpaidAmount: recipient.unpaidAmount,
                        })),
                        messageTemplate: message,
                        scheduledAt: scheduledAt || null,
                    }),
                });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload?.error || '발송 기록 저장에 실패했습니다.');

                const mode = payload.deliveryMode as SmsDeliveryMode;
                const successText = scheduledAt
                    ? `${payload.sentCount}건을 예약 발송 기록으로 저장했습니다.`
                    : mode === 'webhook'
                      ? `${payload.sentCount}건을 외부 문자 서비스로 전송했습니다.`
                      : `${payload.sentCount}건의 발송 기록을 저장했습니다.`;
                setFeedback({ tone: 'success', text: successText });
            } catch (error) {
                setFeedback({
                    tone: 'error',
                    text: error instanceof Error ? error.message : '문자 발송 기록 저장 중 오류가 발생했습니다.',
                });
            }
        });
    };

    const resetFilters = () => {
        setDraft(initialFilters);
        setFilters(initialFilters);
    };

    const resetDraft = () => {
        setTemplateKey('custom');
        setMessage('');
        setScheduledAt('');
        setFeedback({ tone: 'info', text: '작성 내용을 초기화했습니다.' });
    };

    return (
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 py-6 lg:px-10 lg:py-10">
            <BulkSmsHeader deliveryMode={deliveryMode} onOpenHistory={() => setShowHistory(true)} />
            <BulkSmsFeedbackBanner feedback={feedback} />

            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <BulkSmsSidebar
                    draft={draft}
                    filteredRecipients={filteredRecipients}
                    missingCount={missingCount}
                    reachableCount={reachableCount}
                    sendableCount={sendableRecipients.length}
                    statusOptions={statusOptions}
                    tierOptions={tierOptions}
                    totalPeople={totalPeople}
                    unpaidCount={unpaidCount}
                    onApplyFilters={() => setFilters(draft)}
                    onDraftChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
                    onResetFilters={resetFilters}
                />

                <BulkSmsComposer
                    deliveryMode={deliveryMode}
                    filteredRecipients={filteredRecipients}
                    isPending={isPending}
                    message={message}
                    missingCount={missingCount}
                    previewRecipient={previewRecipient}
                    scheduledAt={scheduledAt}
                    sendableRecipients={sendableRecipients}
                    templateKey={templateKey}
                    onApplyTemplate={applyTemplate}
                    onMessageChange={(value) =>
                        setMessage((prev) => (typeof value === 'function' ? value(prev) : value))
                    }
                    onScheduledAtChange={setScheduledAt}
                    onSend={onSend}
                    onResetDraft={resetDraft}
                />
            </div>

            <BulkSmsHistoryDialog history={history} open={showHistory} onOpenChange={setShowHistory} />
        </div>
    );
}
