import { type SupabaseClient } from '@supabase/supabase-js';
import { type UnifiedPerson } from '@/services/memberAggregation';
import { type SmsHistoryItem, type SmsRecipient } from '@/components/features/sms/bulkSmsWorkspaceTypes';

type PaymentRow = {
    entity_id: string;
    amount_due: number | null;
    amount_paid: number | null;
};

type InteractionLogRow = {
    id: string;
    entity_id: string;
    summary: string | null;
    staff_name: string | null;
    created_at: string;
};

export type SmsDashboardData = {
    recipients: SmsRecipient[];
    history: SmsHistoryItem[];
    totalPeople: number;
    reachableCount: number;
    unpaidCount: number;
};

const normalizePhone = (value?: string | null) => (value || '').replace(/\D/g, '');

const extractPrimaryPhone = (rawPhone?: string | null) => {
    const candidates = (rawPhone || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    for (const candidate of candidates) {
        const digits = normalizePhone(candidate);
        if (digits.length === 10 || digits.length === 11) {
            return candidate;
        }
    }

    return candidates[0] || null;
};

function buildRecipient(person: UnifiedPerson, paymentRows: PaymentRow[]): SmsRecipient {
    const rows = paymentRows.filter((row) => person.entity_ids.includes(row.entity_id));
    const totalDue = rows.reduce((sum, row) => sum + Number(row.amount_due || 0), 0);
    const totalPaid = rows.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0);
    const unpaidAmount = Math.max(totalDue - totalPaid, 0);
    const primaryPhone = extractPrimaryPhone(person.phone);

    return {
        id: person.id,
        entityId: person.id,
        name: person.name,
        phone: primaryPhone,
        fullPhone: person.phone,
        tier: person.tier,
        status: person.status,
        isRegistered: person.is_registered,
        unitGroup: person.unit_group,
        totalDue,
        totalPaid,
        unpaidAmount,
        paymentStatus: totalDue <= 0 ? 'none' : unpaidAmount > 0 ? 'unpaid' : 'paid',
        hasReachablePhone: Boolean(primaryPhone && normalizePhone(primaryPhone).length >= 10),
    };
}

function buildHistory(logRows: InteractionLogRow[], recipients: SmsRecipient[]) {
    const recipientByEntityId = new Map(recipients.map((recipient) => [recipient.entityId, recipient]));
    return logRows.map<SmsHistoryItem>((log) => ({
        id: log.id,
        entityId: log.entity_id,
        memberName: recipientByEntityId.get(log.entity_id)?.name || '이름 미확인',
        phone: recipientByEntityId.get(log.entity_id)?.phone || null,
        summary: log.summary || '',
        staffName: log.staff_name || '관리자',
        createdAt: log.created_at,
    }));
}

export async function fetchSmsDashboardData(
    supabase: SupabaseClient,
    unifiedPeople: UnifiedPerson[],
): Promise<SmsDashboardData> {
    const [paymentsRes, logsRes] = await Promise.all([
        supabase
            .from('member_payments')
            .select('entity_id, amount_due, amount_paid'),
        supabase
            .from('interaction_logs')
            .select('id, entity_id, summary, staff_name, created_at')
            .eq('type', 'SMS')
            .order('created_at', { ascending: false })
            .limit(60),
    ]);

    if (paymentsRes.error) {
        console.error('Failed to load member payments for sms workspace:', paymentsRes.error.message);
    }

    if (logsRes.error) {
        console.error('Failed to load sms history logs:', logsRes.error.message);
    }

    const paymentRows = (paymentsRes.data || []) as PaymentRow[];
    const recipients = unifiedPeople.map((person) => buildRecipient(person, paymentRows));
    const logRows = (logsRes.data || []) as InteractionLogRow[];
    const history = buildHistory(logRows, recipients);
    const reachableCount = recipients.filter((recipient) => recipient.hasReachablePhone).length;
    const unpaidCount = recipients.filter((recipient) => recipient.paymentStatus === 'unpaid').length;

    return {
        recipients,
        history,
        totalPeople: recipients.length,
        reachableCount,
        unpaidCount,
    };
}
