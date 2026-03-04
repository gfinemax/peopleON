import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { db: { schema: 'public' } }
    );

    const results: { step: string; ok: boolean; error?: string }[] = [];

    // Helper to run SQL via rpc (if available) or handle gracefully
    async function tryTable(name: string, createFn: () => Promise<void>) {
        try {
            await createFn();
            results.push({ step: name, ok: true });
        } catch (e: any) {
            results.push({ step: name, ok: false, error: e.message });
        }
    }

    // 1. Create unit_types - test if it exists first
    const { error: utCheck } = await supabase.from('unit_types').select('id').limit(1);
    if (utCheck && utCheck.message.includes('does not exist')) {
        results.push({ step: 'unit_types', ok: false, error: 'Table does not exist. Please run scripts/financial_tables.sql in Supabase Dashboard SQL Editor.' });
    } else {
        results.push({ step: 'unit_types check', ok: true });

        // Check if seed data exists
        const { data: utData } = await supabase.from('unit_types').select('id').limit(1);
        if (!utData || utData.length === 0) {
            // Insert seed data
            const { error: seedErr } = await supabase.from('unit_types').insert([
                { name: '59㎡', area_sqm: 59, total_contribution: 160000000, certificate_amount: 30000000, contract_amount: 20000000, installment_1_amount: 50000000, installment_2_amount: 60000000, balance_amount: 0 },
                { name: '74㎡', area_sqm: 74, total_contribution: 180000000, certificate_amount: 30000000, contract_amount: 20000000, installment_1_amount: 50000000, installment_2_amount: 60000000, balance_amount: 20000000 },
                { name: '84㎡', area_sqm: 84, total_contribution: 200000000, certificate_amount: 30000000, contract_amount: 20000000, installment_1_amount: 50000000, installment_2_amount: 60000000, balance_amount: 40000000 },
            ]);
            results.push({ step: 'unit_types seed', ok: !seedErr, error: seedErr?.message });
        } else {
            results.push({ step: 'unit_types seed', ok: true, error: 'Already has data' });
        }
    }

    // 2. Check deposit_accounts
    const { error: daCheck } = await supabase.from('deposit_accounts').select('id').limit(1);
    if (daCheck && daCheck.message.includes('does not exist')) {
        results.push({ step: 'deposit_accounts', ok: false, error: 'Table does not exist. Please run scripts/financial_tables.sql in Supabase Dashboard SQL Editor.' });
    } else {
        results.push({ step: 'deposit_accounts check', ok: true });

        const { data: daData } = await supabase.from('deposit_accounts').select('id').limit(1);
        if (!daData || daData.length === 0) {
            const { error: seedErr } = await supabase.from('deposit_accounts').insert([
                { account_name: '조합 주거래계좌', bank_name: '국민은행', account_type: 'union', is_official: true },
                { account_name: '신탁계좌 1', bank_name: '한국토지신탁', account_type: 'trust', is_official: true },
                { account_name: '신탁계좌 2', bank_name: '코리아신탁', account_type: 'trust', is_official: true },
                { account_name: '전 조합장 계좌', bank_name: '우리은행', account_type: 'external', is_official: false },
                { account_name: '기타 인정 계좌 1', bank_name: '신한은행', account_type: 'recognized', is_official: false },
                { account_name: '기타 인정 계좌 2', bank_name: '하나은행', account_type: 'recognized', is_official: false },
            ]);
            results.push({ step: 'deposit_accounts seed', ok: !seedErr, error: seedErr?.message });
        } else {
            results.push({ step: 'deposit_accounts seed', ok: true, error: 'Already has data' });
        }
    }

    // 3. Check member_payments
    const { error: mpCheck } = await supabase.from('member_payments').select('id').limit(1);
    if (mpCheck && mpCheck.message.includes('does not exist')) {
        results.push({ step: 'member_payments', ok: false, error: 'Table does not exist. Please run scripts/financial_tables.sql in Supabase Dashboard SQL Editor.' });
    } else {
        results.push({ step: 'member_payments check', ok: true });
    }

    const allOk = results.every(r => r.ok);

    return NextResponse.json({
        success: allOk,
        results,
        message: allOk
            ? 'All tables exist and seed data applied.'
            : 'Some tables are missing. Run scripts/financial_tables.sql in Supabase SQL Editor first.'
    });
}
