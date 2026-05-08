import { type SupabaseClient } from '@supabase/supabase-js';
import { type UnifiedPerson } from '@/services/memberAggregation';
import { type SmsHistoryItem, type SmsRecipient } from '@/components/features/sms/bulkSmsWorkspaceTypes';

type PaymentRow = {
    entity_id: string;
    amount_due: number | null;
    amount_paid: number | null;
};

type PaymentSummaryRow = {
    entity_id: string;
    total_due: number | string | null;
    total_paid: number | string | null;
};

type InteractionLogRow = {
    id: string;
    entity_id: string;
    summary: string | null;
    staff_name: string | null;
    created_at: string;
};

type PaymentTotals = Map<string, { totalDue: number; totalPaid: number }>;

export type SmsDashboardData = {
    recipients: SmsRecipient[];
    history: SmsHistoryItem[];
    totalPeople: number;
    reachableCount: number;
    unpaidCount: number;
};

const ENTITY_ID_QUERY_CHUNK_SIZE = 100;

const normalizePhone = (value?: string | null) => (value || '').replace(/\D/g, '');

const parseMoney = (value: number | string | null | undefined) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

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

function buildPaymentTotalsByEntity(paymentRows: PaymentRow[]) {
    const totalsByEntity = new Map<string, { totalDue: number; totalPaid: number }>();

    for (const row of paymentRows) {
        const current = totalsByEntity.get(row.entity_id) || { totalDue: 0, totalPaid: 0 };
        current.totalDue += parseMoney(row.amount_due);
        current.totalPaid += parseMoney(row.amount_paid);
        totalsByEntity.set(row.entity_id, current);
    }

    return totalsByEntity;
}

function buildPaymentTotalsFromSummaryRows(summaryRows: PaymentSummaryRow[]) {
    return new Map(
        summaryRows.map((row) => [
            row.entity_id,
            {
                totalDue: parseMoney(row.total_due),
                totalPaid: parseMoney(row.total_paid),
            },
        ]),
    );
}

function mergePaymentTotals(target: PaymentTotals, source: PaymentTotals) {
    for (const [entityId, totals] of source) {
        const current = target.get(entityId) || { totalDue: 0, totalPaid: 0 };
        current.totalDue += totals.totalDue;
        current.totalPaid += totals.totalPaid;
        target.set(entityId, current);
    }
}

function chunkList<T>(items: T[], chunkSize: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += chunkSize) {
        chunks.push(items.slice(index, index + chunkSize));
    }
    return chunks;
}

function buildRecipient(person: UnifiedPerson, totalsByEntity: Map<string, { totalDue: number; totalPaid: number }>): SmsRecipient {
    let totalDue = 0;
    let totalPaid = 0;

    for (const entityId of person.entity_ids) {
        const totals = totalsByEntity.get(entityId);
        if (!totals) continue;
        totalDue += totals.totalDue;
        totalPaid += totals.totalPaid;
    }

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

function buildRecipientLookupByEntity(unifiedPeople: UnifiedPerson[], recipients: SmsRecipient[]) {
    const recipientById = new Map(recipients.map((recipient) => [recipient.id, recipient]));
    const recipientByEntityId = new Map<string, SmsRecipient>();

    for (const person of unifiedPeople) {
        const recipient = recipientById.get(person.id);
        if (!recipient) continue;
        for (const entityId of person.entity_ids) {
            recipientByEntityId.set(entityId, recipient);
        }
    }

    return recipientByEntityId;
}

function buildHistory(logRows: InteractionLogRow[], recipientByEntityId: Map<string, SmsRecipient>) {
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

async function fetchPaymentTotalsByEntity(supabase: SupabaseClient, entityIds: string[]) {
    if (entityIds.length === 0) return new Map<string, { totalDue: number; totalPaid: number }>();

    const totalsByEntity: PaymentTotals = new Map();
    const entityIdChunks = chunkList(entityIds, ENTITY_ID_QUERY_CHUNK_SIZE);
    let shouldFallbackToPayments = false;

    try {
        for (const chunk of entityIdChunks) {
            const { data: summaryRows, error: summaryError } = await supabase
                .from('vw_member_payment_entity_summary')
                .select('entity_id, total_due, total_paid')
                .in('entity_id', chunk);

            if (summaryError) {
                shouldFallbackToPayments = true;
                break;
            }

            mergePaymentTotals(
                totalsByEntity,
                buildPaymentTotalsFromSummaryRows((summaryRows || []) as PaymentSummaryRow[]),
            );
        }

        if (!shouldFallbackToPayments) {
            return totalsByEntity;
        }
    } catch (error) {
        console.warn(
            'Failed to load payment summary view for sms workspace:',
            error instanceof Error ? error.message : error,
        );
    }

    totalsByEntity.clear();

    try {
        for (const chunk of entityIdChunks) {
            const { data: paymentRows, error: paymentsError } = await supabase
                .from('member_payments')
                .select('entity_id, amount_due, amount_paid')
                .in('entity_id', chunk);

            if (paymentsError) {
                console.warn('Failed to load member payments for sms workspace:', paymentsError.message);
                continue;
            }

            mergePaymentTotals(
                totalsByEntity,
                buildPaymentTotalsByEntity((paymentRows || []) as PaymentRow[]),
            );
        }
    } catch (error) {
        console.warn(
            'Failed to load member payments for sms workspace:',
            error instanceof Error ? error.message : error,
        );
    }

    return totalsByEntity;
}

export async function fetchSmsDashboardData(
    supabase: SupabaseClient,
    unifiedPeople: UnifiedPerson[],
): Promise<SmsDashboardData> {
    const entityIds = Array.from(new Set(unifiedPeople.flatMap((person) => person.entity_ids)));
    const [totalsByEntity, logsRes] = await Promise.all([
        fetchPaymentTotalsByEntity(supabase, entityIds),
        supabase
            .from('interaction_logs')
            .select('id, entity_id, summary, staff_name, created_at')
            .eq('type', 'SMS')
            .order('created_at', { ascending: false })
            .limit(60),
    ]);

    if (logsRes.error) {
        console.error('Failed to load sms history logs:', logsRes.error.message);
    }

    const recipients = unifiedPeople.map((person) => buildRecipient(person, totalsByEntity));
    const recipientByEntityId = buildRecipientLookupByEntity(unifiedPeople, recipients);
    const logRows = (logsRes.data || []) as InteractionLogRow[];
    const history = buildHistory(logRows, recipientByEntityId);
    let reachableCount = 0;
    let unpaidCount = 0;

    for (const recipient of recipients) {
        if (recipient.hasReachablePhone) reachableCount += 1;
        if (recipient.paymentStatus === 'unpaid') unpaidCount += 1;
    }

    return {
        recipients,
        history,
        totalPeople: recipients.length,
        reachableCount,
        unpaidCount,
    };
}
