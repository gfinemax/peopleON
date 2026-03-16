import type { SmsHistoryItem, SmsRecipient } from './bulkSmsWorkspaceTypes';

export const smsTemplates = {
    payment_notice: '안녕하세요 {이름}님, 현재 미납액은 {미납액}원입니다. 납부기한은 {납부기한}입니다.',
    meeting_notice: '안녕하세요 {이름}님, 조합 회의 관련 안내를 드립니다. {동호수} 관련 세부 내용은 공지를 참고해 주세요.',
    schedule_notice: '안녕하세요 {이름}님, 조합 일정 안내드립니다. {동호수} 관련 세부 일정은 별도 공지를 확인해 주세요.',
    emergency_notice: '긴급 안내드립니다. {이름}님, 조합 운영 관련 즉시 확인이 필요한 사항이 있습니다.',
    greeting: '안녕하세요 {이름}님, 조합 소식과 함께 감사 인사를 드립니다.',
    custom: '',
} as const;

export type SmsTemplateKey = keyof typeof smsTemplates;

export const smsTemplateMeta: Record<SmsTemplateKey, { label: string; icon: string }> = {
    payment_notice: { label: '납부 안내', icon: 'payments' },
    meeting_notice: { label: '회의 소집', icon: 'groups' },
    schedule_notice: { label: '일정 공지', icon: 'calendar_month' },
    emergency_notice: { label: '긴급 공지', icon: 'warning' },
    greeting: { label: '축하 메시지', icon: 'celebration' },
    custom: { label: '직접 작성', icon: 'edit' },
};

export const SMS_VARIABLES = ['{이름}', '{동호수}', '{미납액}', '{납부기한}'] as const;

export function renderSmsMessage(template: string, recipient?: SmsRecipient, dueDate?: string | null) {
    if (!recipient) return template;
    return template
        .replaceAll('{이름}', recipient.name)
        .replaceAll('{동호수}', recipient.unitGroup || '-')
        .replaceAll('{미납액}', recipient.unpaidAmount.toLocaleString('ko-KR'))
        .replaceAll('{납부기한}', dueDate || '추후 안내');
}

export function formatSmsHistoryRelativeTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const diff = Date.now() - date.getTime();
    if (diff < 60_000) return '방금 전';
    if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}분 전`;
    if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))}시간 전`;
    return `${Math.max(1, Math.floor(diff / 86_400_000))}일 전`;
}

export function getSmsPaymentLabel(status: SmsRecipient['paymentStatus']) {
    if (status === 'paid') return '완납';
    if (status === 'unpaid') return '미납';
    return '납부정보 없음';
}

export function getSmsTierLabel(value: string | null) {
    return value || '미지정';
}

export function buildSmsFilterOptions(recipients: SmsRecipient[]) {
    return {
        tierOptions: ['all', ...Array.from(new Set(recipients.map((item) => item.tier).filter(Boolean) as string[]))],
        statusOptions: ['all', ...Array.from(new Set(recipients.map((item) => item.status).filter(Boolean) as string[]))],
    };
}

export function filterSmsRecipients(
    recipients: SmsRecipient[],
    filters: { query: string; tier: string; status: string; paymentStatus: string },
) {
    return recipients.filter((recipient) => {
        if (filters.tier !== 'all' && recipient.tier !== filters.tier) return false;
        if (filters.status !== 'all' && recipient.status !== filters.status) return false;
        if (filters.paymentStatus !== 'all' && recipient.paymentStatus !== filters.paymentStatus) return false;

        const query = filters.query.trim().toLowerCase();
        if (!query) return true;

        const target = [
            recipient.name,
            recipient.phone,
            recipient.fullPhone,
            recipient.unitGroup,
            recipient.tier,
            recipient.status,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return target.includes(query);
    });
}

export function getSendableSmsRecipients(recipients: SmsRecipient[]) {
    return recipients.filter((recipient) => recipient.hasReachablePhone);
}

export function buildSmsPreviewRecipient(recipients: SmsRecipient[]) {
    return recipients[0];
}

export function getSmsMissingCount(filteredRecipients: SmsRecipient[], sendableRecipients: SmsRecipient[]) {
    return filteredRecipients.length - sendableRecipients.length;
}

export function hasSmsHistory(history: SmsHistoryItem[]) {
    return history.length > 0;
}
