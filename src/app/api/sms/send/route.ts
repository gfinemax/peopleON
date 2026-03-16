import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/app/actions/audit';
import { getSmsDeliveryMode, sendSmsViaWebhook } from '@/lib/server/smsDelivery';
import { revalidateActivityFeedTag } from '@/lib/server/cacheTags';

export const dynamic = 'force-dynamic';

type SendRecipient = {
    entityId: string;
    name: string;
    phone: string | null;
    unitGroup: string | null;
    unpaidAmount: number;
};

type SendPayload = {
    recipients?: SendRecipient[];
    messageTemplate?: string;
    scheduledAt?: string | null;
};

const renderTemplate = (template: string, recipient: SendRecipient, scheduledAt?: string | null) => {
    const dueDate = scheduledAt ? new Date(scheduledAt).toLocaleString('ko-KR') : '추후 안내';

    return template
        .replaceAll('{이름}', recipient.name)
        .replaceAll('{동호수}', recipient.unitGroup || '-')
        .replaceAll('{미납액}', recipient.unpaidAmount.toLocaleString('ko-KR'))
        .replaceAll('{납부기한}', dueDate);
};

export async function POST(request: Request) {
    const payload = (await request.json()) as SendPayload;
    const recipients = payload.recipients || [];
    const messageTemplate = (payload.messageTemplate || '').trim();
    const scheduledAt = payload.scheduledAt || null;

    if (!messageTemplate) {
        return NextResponse.json({ error: '메시지 내용이 비어 있습니다.' }, { status: 400 });
    }

    if (recipients.length === 0) {
        return NextResponse.json({ error: '발송 대상이 없습니다.' }, { status: 400 });
    }

    const validRecipients = recipients.filter((recipient) => recipient.entityId && recipient.phone);
    if (validRecipients.length === 0) {
        return NextResponse.json({ error: '저장 가능한 연락처 대상이 없습니다.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const actor = authData.user?.email || authData.user?.user_metadata?.name || '관리자';
    const deliveryMode = getSmsDeliveryMode();

    const renderedMessages = validRecipients.map((recipient) => ({
        entityId: recipient.entityId,
        to: recipient.phone as string,
        name: recipient.name,
        unitGroup: recipient.unitGroup,
        unpaidAmount: recipient.unpaidAmount,
        text: renderTemplate(messageTemplate, recipient, scheduledAt),
    }));

    if (deliveryMode === 'webhook') {
        const providerResult = await sendSmsViaWebhook({
            messages: renderedMessages,
            scheduledAt,
        });

        if (!providerResult.ok) {
            console.error('SMS webhook delivery failed:', providerResult.status, providerResult.body);
            return NextResponse.json(
                { error: '외부 문자 발송 서비스 호출에 실패했습니다.' },
                { status: 502 },
            );
        }
    }

    const rows = renderedMessages.map((message) => ({
        entity_id: message.entityId,
        type: 'SMS',
        direction: 'Outbound',
        summary: `${scheduledAt ? '[예약발송] ' : deliveryMode === 'webhook' ? '[실발송] ' : '[기록저장] '}${message.text}`,
        staff_name: actor,
    }));

    const { error } = await supabase.from('interaction_logs').insert(rows);
    if (error) {
        console.error('Failed to save sms interaction logs:', error.message);
        return NextResponse.json({ error: '발송 기록 저장에 실패했습니다.' }, { status: 500 });
    }

    await createAuditLog('SEND_BULK_SMS', undefined, {
        recipientCount: validRecipients.length,
        scheduledAt,
        deliveryMode,
        preview: messageTemplate.slice(0, 120),
    });

    revalidatePath('/sms');
    revalidatePath('/timeline');
    revalidatePath('/members');
    revalidateActivityFeedTag();

    return NextResponse.json({
        success: true,
        sentCount: validRecipients.length,
        deliveryMode,
    });
}
