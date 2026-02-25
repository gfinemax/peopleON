import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type LegacyRecord = {
    member_id: string;
    original_name: string | null;
    raw_data: unknown;
};

type MemberPatchPayload = {
    address_legal?: string;
    memo?: string;
};

type SyncLogItem = {
    memberId: string;
    name: string | null;
    found: {
        address: string | null;
        memo: string | null;
    };
    payload: MemberPatchPayload;
};

function asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';
    const syncAccounting = searchParams.get('syncAccounting') !== 'false';

    try {
        // 1. Fetch matched legacy records
        const { data: records, error } = await supabase
            .from('legacy_records')
            .select('*')
            .not('member_id', 'is', null)
            .order('id', { ascending: true }); // Stable order for deterministic overwrite in Map

        if (error) throw error;
        if (!records) return NextResponse.json({ message: 'No records found', count: 0 });

        // 2. Process records (Deduplicate by member_id)
        const memberMap = new Map<string, LegacyRecord>();
        for (const row of (records as LegacyRecord[] | null) || []) {
            memberMap.set(row.member_id, row);
        }

        console.log(`[Migration] Found ${records.length} records, ${memberMap.size} unique members.`);

        // 3. Helper to find values recursively
        const findValue = (obj: unknown, searchKeys: string[]): string | null => {
            const objectValue = asObject(obj);
            if (!objectValue) return null;

            // 1. Direct key match (Exact or Partial)
            for (const key of Object.keys(objectValue)) {
                if (searchKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
                    const val = objectValue[key];
                    if (typeof val === 'string' && val.trim().length > 0) return val.trim();
                    if (typeof val === 'number') return String(val);
                }
            }

            // 2. Recursive search
            for (const key of Object.keys(objectValue)) {
                const nested = objectValue[key];
                if (nested && typeof nested === 'object') {
                    const found = findValue(nested, searchKeys);
                    if (found) return found;
                }
            }
            return null;
        };

        const addressKeys = ['주소', '거주지', '집', 'Address', 'ADDR'];
        const memoKeys = ['비고', '메모', '특이사항', '참고', 'Note', 'MEMO', 'REMARK'];

        const updates: PromiseLike<unknown>[] = [];
        const logs: SyncLogItem[] = [];

        // 4. Prepare updates
        for (const [memberId, record] of memberMap.entries()) {
            const address = findValue(record.raw_data, addressKeys);
            const memo = findValue(record.raw_data, memoKeys);

            if (address || memo) {
                const payload: MemberPatchPayload = {};
                // Only update if we found something
                // Note: This logic assumes we want to OVERWRITE or FILL. 
                // For safety, let's just push what we found.
                if (address) payload.address_legal = address;
                if (memo) payload.memo = memo;

                logs.push({
                    memberId,
                    name: record.original_name,
                    found: { address, memo },
                    payload
                });

                if (!dryRun) {
                    updates.push(
                        supabase.from('account_entities').update(payload).eq('id', memberId)
                    );
                }
            }
        }

        // 5. Execute API Calls (Parallel)
        // Note: Supabase might rate limit if 116 is too fast, but usually fine.
        // If needed, we can batch. For 116, Promise.all is typically okay.

        let successCount = 0;
        let accountingSyncSuccess = 0;
        let accountingSyncFail = 0;
        if (!dryRun) {
            const results = await Promise.allSettled(updates);
            successCount = results.filter(r => r.status === 'fulfilled').length;

            if (syncAccounting && logs.length > 0) {
                const memberIds = Array.from(new Set(logs.map((item) => item.memberId)));
                const { data: syncedMembers, error: syncedMembersError } = await supabase
                    .from('account_entities')
                    .select('id, display_name, phone')
                    .in('id', memberIds);

                if (syncedMembersError) {
                    accountingSyncFail = memberIds.length;
                    console.warn('[sync-legacy] failed to load members for sync:', syncedMembersError);
                } else {
                    accountingSyncSuccess = (syncedMembers || []).length;
                }
            }
        }

        return NextResponse.json({
            success: true,
            mode: dryRun ? 'DRY_RUN' : 'LIVE',
            matched_members: memberMap.size,
            actions_queued: updates.length,
            success_count: successCount,
            accounting_sync: dryRun
                ? { enabled: syncAccounting, skipped: true }
                : { enabled: syncAccounting, success_count: accountingSyncSuccess, fail_count: accountingSyncFail },
            sample_logs: logs.slice(0, 10) // Show first 10 for debug
        });

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
