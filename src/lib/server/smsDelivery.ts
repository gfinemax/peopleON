export type SmsDeliveryMode = 'log-only' | 'webhook';

export type SmsOutboundMessage = {
    entityId: string;
    to: string;
    name: string;
    unitGroup: string | null;
    unpaidAmount: number;
    text: string;
};

type SmsWebhookResponse = {
    ok: boolean;
    status: number;
    body: string;
};

const trimEnv = (value?: string | null) => {
    const next = value?.trim();
    return next ? next : null;
};

export const getSmsDeliveryMode = (): SmsDeliveryMode => {
    const explicit = trimEnv(process.env.SMS_PROVIDER_MODE);
    if (explicit === 'webhook') return 'webhook';
    return trimEnv(process.env.SMS_WEBHOOK_URL) ? 'webhook' : 'log-only';
};

export const getSmsDeliveryLabel = (mode: SmsDeliveryMode) =>
    mode === 'webhook' ? '실발송 연동' : '기록 저장 모드';

export async function sendSmsViaWebhook({
    messages,
    scheduledAt,
}: {
    messages: SmsOutboundMessage[];
    scheduledAt?: string | null;
}): Promise<SmsWebhookResponse> {
    const webhookUrl = trimEnv(process.env.SMS_WEBHOOK_URL);
    if (!webhookUrl) {
        throw new Error('SMS_WEBHOOK_URL 환경변수가 설정되지 않았습니다.');
    }

    const sender = trimEnv(process.env.SMS_SENDER_NUMBER);
    const token = trimEnv(process.env.SMS_WEBHOOK_TOKEN);

    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
            sender,
            scheduledAt: scheduledAt || null,
            messages,
        }),
        cache: 'no-store',
    });

    const body = await response.text();
    return {
        ok: response.ok,
        status: response.status,
        body,
    };
}
