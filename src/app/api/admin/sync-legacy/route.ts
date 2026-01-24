import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    try {
        // 1. Fetch matched legacy records
        const { data: records, error } = await supabase
            .from('legacy_records')
            .select('*')
            .not('member_id', 'is', null)
            .order('created_at', { ascending: true }); // Oldest first, so newest overwrites in Map

        if (error) throw error;
        if (!records) return NextResponse.json({ message: 'No records found', count: 0 });

        // 2. Process records (Deduplicate by member_id)
        const memberMap = new Map<string, any>();
        records.forEach(r => memberMap.set(r.member_id, r));

        console.log(`[Migration] Found ${records.length} records, ${memberMap.size} unique members.`);

        // 3. Helper to find values recursively
        const findValue = (obj: any, searchKeys: string[]): string | null => {
            if (!obj) return null;

            // 1. Direct key match (Exact or Partial)
            for (const key of Object.keys(obj)) {
                if (searchKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
                    const val = obj[key];
                    if (typeof val === 'string' && val.trim().length > 0) return val.trim();
                    if (typeof val === 'number') return String(val);
                }
            }

            // 2. Recursive search
            for (const key of Object.keys(obj)) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    const found = findValue(obj[key], searchKeys);
                    if (found) return found;
                }
            }
            return null;
        };

        const addressKeys = ['주소', '거주지', '집', 'Address', 'ADDR'];
        const memoKeys = ['비고', '메모', '특이사항', '참고', 'Note', 'MEMO', 'REMARK'];

        const updates = [];
        const logs = [];

        // 4. Prepare updates
        for (const [memberId, record] of memberMap.entries()) {
            const address = findValue(record.raw_data, addressKeys);
            const memo = findValue(record.raw_data, memoKeys);

            if (address || memo) {
                const payload: any = {};
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
                        supabase.from('members').update(payload).eq('id', memberId)
                    );
                }
            }
        }

        // 5. Execute API Calls (Parallel)
        // Note: Supabase might rate limit if 116 is too fast, but usually fine.
        // If needed, we can batch. For 116, Promise.all is typically okay.

        let successCount = 0;
        if (!dryRun) {
            const results = await Promise.allSettled(updates);
            successCount = results.filter(r => r.status === 'fulfilled').length;
        }

        return NextResponse.json({
            success: true,
            mode: dryRun ? 'DRY_RUN' : 'LIVE',
            matched_members: memberMap.size,
            actions_queued: updates.length,
            success_count: successCount,
            sample_logs: logs.slice(0, 10) // Show first 10 for debug
        });

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
