/**
 * 권리증 취득 정보 재마이그레이션 스크립트 (v2)
 * 
 * 1단계: 숫자형 필증NO → right_number 매칭 (기존)
 * 2단계: 한글 필증NO (보유, 없음, 있음 등) → 이름 매칭 → asset_rights 업데이트/신규 생성
 * 
 * 실행: npx ts-node scripts/migrate_certificate_prices.ts
 */

const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parsePrice(priceText: string): { cert: number; prem: number; fee: number } {
    if (!priceText || priceText === '?') return { cert: 0, prem: 0, fee: 0 };
    const cleaned = priceText.replace(/\s/g, '').replace(/,/g, '');
    const parts = cleaned.split('+').map((p: string) => {
        const num = parseFloat(p.replace(/[^0-9.]/g, ''));
        return isNaN(num) ? 0 : num;
    });
    return {
        cert: (parts[0] || 0) * 10000,
        prem: (parts[1] || 0) * 10000,
        fee: (parts[2] || 0) * 10000,
    };
}

function parseDate(dateStr: string): string | null {
    if (!dateStr) return null;
    const firstLine = dateStr.split('\n')[0].trim();
    const match = firstLine.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (!match) return null;
    const [, y, m, d] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function normalizeRightNumber(num: string): string {
    return num.replace(/\s/g, '').trim();
}

async function migrate() {
    console.log('=== 권리증 취득 정보 재마이그레이션 (v2) ===\n');

    const wb = XLSX.readFile('data/권리증(프로그램용).xlsx');
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

    // Separate entries into numeric and Korean-text groups
    const numericEntries: any[] = [];
    const koreanEntries: any[] = [];

    for (let i = 2; i < rows.length; i++) {
        const row = rows[i];
        const name = row[0] ? String(row[0]).trim() : '';
        if (!name) continue;

        const certNo = row[10] ? String(row[10]).trim() : '';
        if (!certNo) continue;

        const holderName = row[11] ? String(row[11]).trim() : '';
        const dateRaw = row[12] ? String(row[12]).trim() : '';
        const priceRaw = row[13] ? String(row[13]).trim() : '';
        const sourceRaw = row[14] ? String(row[14]).trim() : '';
        const parsed = parsePrice(priceRaw);
        const issuedDate = parseDate(dateRaw);

        const entry = {
            name,
            rightNumber: normalizeRightNumber(certNo),
            holderName,
            issuedDate,
            priceText: priceRaw || null,
            certPrice: parsed.cert,
            premPrice: parsed.prem,
            brokerFee: parsed.fee,
            source: sourceRaw || null,
        };

        if (/\d{4}-/.test(certNo)) {
            numericEntries.push(entry);
        } else {
            koreanEntries.push(entry);
        }
    }

    console.log(`숫자형 필증NO: ${numericEntries.length}건`);
    console.log(`한글 필증NO: ${koreanEntries.length}건 (없음 포함)\n`);

    // Fetch DB data
    const { data: existingRights } = await supabase.from('asset_rights').select('id, right_number, entity_id');
    const { data: entities } = await supabase.from('account_entities').select('id, display_name');

    const rightMap = new Map<string, string>();
    (existingRights || []).forEach((r: any) => {
        if (r.right_number) rightMap.set(normalizeRightNumber(r.right_number), r.id);
    });

    const nameToEntityId = new Map<string, string>();
    const nameDuplicates = new Set<string>();
    (entities || []).forEach((e: any) => {
        if (nameToEntityId.has(e.display_name)) nameDuplicates.add(e.display_name);
        nameToEntityId.set(e.display_name, e.id);
    });

    const entityRightsMap = new Map<string, string>();
    (existingRights || []).forEach((r: any) => {
        if (r.entity_id && !entityRightsMap.has(r.entity_id)) {
            entityRightsMap.set(r.entity_id, r.id);
        }
    });

    // ── STEP 1: Numeric entries (right_number match) ──
    console.log('── 1단계: 숫자형 필증NO 매칭 ──');
    let s1Matched = 0, s1Updated = 0, s1Unmatched = 0;

    for (const entry of numericEntries) {
        const dbId = rightMap.get(entry.rightNumber);
        if (!dbId) { s1Unmatched++; continue; }
        s1Matched++;

        const updateData: any = {};
        if (entry.holderName) updateData.holder_name = entry.holderName;
        if (entry.issuedDate) updateData.issued_date = entry.issuedDate;
        if (entry.priceText) updateData.price_text = entry.priceText;
        if (entry.certPrice > 0) updateData.certificate_price = entry.certPrice;
        if (entry.premPrice > 0) updateData.premium_price = entry.premPrice;
        if (entry.brokerFee > 0) updateData.broker_fee = entry.brokerFee;
        if (entry.source) updateData.acquisition_source = entry.source;

        if (Object.keys(updateData).length === 0) continue;

        const { error } = await supabase.from('asset_rights').update(updateData).eq('id', dbId);
        if (!error) s1Updated++;
    }
    console.log(`  매칭: ${s1Matched}, 업데이트: ${s1Updated}, 미매칭: ${s1Unmatched}\n`);

    // ── STEP 2: Korean text entries (name match) ──
    console.log('── 2단계: 한글 필증NO 이름 매칭 ──');
    let s2Matched = 0, s2Updated = 0, s2Created = 0, s2Unmatched = 0, s2Errors = 0;

    for (const entry of koreanEntries) {
        const entityId = nameToEntityId.get(entry.name);
        if (!entityId) {
            s2Unmatched++;
            console.log(`  ⚠️  DB에 없는 이름: ${entry.name} (필증NO: ${entry.rightNumber})`);
            continue;
        }
        s2Matched++;

        if (nameDuplicates.has(entry.name)) {
            console.log(`  ⚠️  동명이인: ${entry.name} — 마지막 등록된 entity로 매칭`);
        }

        const updateData: any = {};
        if (entry.holderName) updateData.holder_name = entry.holderName;
        if (entry.issuedDate) updateData.issued_date = entry.issuedDate;
        if (entry.priceText) updateData.price_text = entry.priceText;
        if (entry.certPrice > 0) updateData.certificate_price = entry.certPrice;
        if (entry.premPrice > 0) updateData.premium_price = entry.premPrice;
        if (entry.brokerFee > 0) updateData.broker_fee = entry.brokerFee;
        if (entry.source) updateData.acquisition_source = entry.source;

        // Check if this entity already has an asset_right
        const existingRightId = entityRightsMap.get(entityId);

        if (existingRightId) {
            // Update existing record
            if (Object.keys(updateData).length === 0) continue;
            const { error } = await supabase.from('asset_rights').update(updateData).eq('id', existingRightId);
            if (error) { s2Errors++; console.log(`  ❌ 업데이트 실패: ${entry.name} - ${error.message}`); }
            else s2Updated++;
        } else {
            // Create new asset_rights record
            const newRecord: any = {
                entity_id: entityId,
                right_number: entry.rightNumber,
                right_type: 'certificate',
                ...updateData,
            };
            const { error } = await supabase.from('asset_rights').insert(newRecord);
            if (error) { s2Errors++; console.log(`  ❌ 생성 실패: ${entry.name} - ${error.message}`); }
            else s2Created++;
        }
    }

    console.log(`  매칭: ${s2Matched}, 업데이트: ${s2Updated}, 신규생성: ${s2Created}, 미매칭: ${s2Unmatched}, 오류: ${s2Errors}\n`);

    // ── Summary ──
    console.log('=== 최종 결과 ===');
    console.log(`  1단계 (숫자형): ${s1Updated}건 업데이트`);
    console.log(`  2단계 (한글):   ${s2Updated}건 업데이트, ${s2Created}건 신규생성`);
    console.log(`  총 처리:        ${s1Updated + s2Updated + s2Created}건`);

    // Verify
    const { data: verifyCount } = await supabase.from('asset_rights').select('id', { count: 'exact', head: true }).not('acquisition_source', 'is', null);
    const { data: totalCount } = await supabase.from('asset_rights').select('id', { count: 'exact', head: true });
    console.log(`\n  asset_rights 전체: ${totalCount?.length ?? '?'}건`);
    console.log(`  취득정보 있는 건: ${verifyCount?.length ?? '?'}건`);
}

migrate().catch(console.error);

export { };
