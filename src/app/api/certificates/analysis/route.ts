import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1) Grand stats (single row)
        const { data: statsRaw, error: statsError } = await supabase
            .from('vw_certificate_grand_stats')
            .select('*')
            .maybeSingle();

        if (statsError) {
            console.error('[cert-analysis] stats error:', statsError);
            return NextResponse.json({ error: statsError.message }, { status: 500 });
        }

        const stats = statsRaw || {
            registered_owner_count: 0,
            registered_unique_cert_count: 0,
            registered_total_cert_sum: 0,
            others_owner_count: 0,
            others_unique_cert_count: 0,
            others_total_cert_sum: 0,
            total_unique_cert_count: 0,
            shared_cert_count: 0,
        };

        // 2) Registered detail (per person)
        const { data: registeredDetail, error: regError } = await supabase
            .from('vw_certificate_registered_detail')
            .select('*')
            .order('certificate_count', { ascending: false })
            .order('display_name', { ascending: true });

        if (regError) {
            console.error('[cert-analysis] registered detail error:', regError);
        }

        // 3) Others detail (per person)
        const { data: othersDetail, error: othError } = await supabase
            .from('vw_certificate_others_detail')
            .select('*')
            .order('certificate_count', { ascending: false })
            .order('display_name', { ascending: true });

        if (othError) {
            console.error('[cert-analysis] others detail error:', othError);
        }

        // 4) Shared holders
        const { data: sharedHolders, error: sharedError } = await supabase
            .from('vw_certificate_shared_holders')
            .select('*')
            .order('holder_count', { ascending: false });

        if (sharedError) {
            console.error('[cert-analysis] shared holders error:', sharedError);
        }

        return NextResponse.json({
            stats,
            registered: registeredDetail || [],
            others: othersDetail || [],
            shared: sharedHolders || [],
        });
    } catch (err) {
        console.error('[cert-analysis] unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
