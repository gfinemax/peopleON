const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Strict date validation: year 1920-2010, month 1-12, day 1-31
 */
function isValidBirthDate(v) {
    if (!v) return false;
    const s = v.trim();
    // Pattern: YYYY.M.D or YYYY-M-D
    const m = s.match(/^(19[2-9]\d|20[0-1]\d)[\.\-](\d{1,2})[\.\-](\d{1,2})$/);
    if (m) {
        const mo = parseInt(m[2], 10);
        const d = parseInt(m[3], 10);
        return mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
    }
    // Pattern: YYYYMMDD (8 digits)
    const m2 = s.match(/^(19[2-9]\d|20[0-1]\d)(\d{2})(\d{2})$/);
    if (m2) {
        const mo = parseInt(m2[2], 10);
        const d = parseInt(m2[3], 10);
        return mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
    }
    return false;
}

async function migrate() {
    console.log('=== Birthdate Re-Migration (Trusted Sources Only) ===\n');

    // Fetch all asset_rights with meta.birth_date
    const { data: rights, error: rightError } = await supabase
        .from('asset_rights')
        .select('entity_id, right_number, meta');

    if (rightError) {
        console.error('Error fetching rights:', rightError);
        return;
    }

    // Source A: asset_rights.meta.birth_date (highest trust)
    const birthDateByEntity = new Map();
    let metaCount = 0;

    for (const r of rights) {
        if (r.meta && r.meta.birth_date) {
            const bd = r.meta.birth_date.trim();
            if (isValidBirthDate(bd)) {
                if (!birthDateByEntity.has(r.entity_id)) {
                    birthDateByEntity.set(r.entity_id, bd);
                    metaCount++;
                }
            } else {
                console.log(`  ⚠ Skipping invalid meta.birth_date: "${bd}" for entity ${r.entity_id}`);
            }
        }
    }

    console.log(`Source A (meta.birth_date): ${metaCount} valid records found`);

    // Source B: asset_rights.right_number that look like valid birthdates
    // ONLY for entities not already covered by Source A
    // Additional filter: year must be 1920-2000 (actual birth years, not management years like 2006/2007/2008)
    let rightNumCount = 0;

    for (const r of rights) {
        if (birthDateByEntity.has(r.entity_id)) continue; // Source A already has it
        const rn = (r.right_number || '').trim();
        if (!rn) continue;

        const m = rn.match(/^(19[2-9]\d)[\.\-](\d{1,2})[\.\-](\d{1,2})$/);
        if (m) {
            const year = parseInt(m[1], 10);
            const mo = parseInt(m[2], 10);
            const d = parseInt(m[3], 10);
            // Strict: birth year 1920-1999, valid month/day, exclude 2000s management numbers entirely
            if (year <= 1999 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
                birthDateByEntity.set(r.entity_id, rn);
                rightNumCount++;
            }
        }
    }

    console.log(`Source B (right_number, year<=2005): ${rightNumCount} additional records found`);
    console.log(`\nTotal: ${birthDateByEntity.size} records to update\n`);

    // Perform updates
    const entries = Array.from(birthDateByEntity.entries());
    const batchSize = 50;
    for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        await Promise.all(batch.map(([id, bd]) =>
            supabase.from('account_entities').update({ birth_date: bd }).eq('id', id)
        ));
        console.log(`Updated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(entries.length / batchSize)}`);
    }

    // Verification
    const { count } = await supabase.from('account_entities').select('*', { count: 'exact', head: true }).not('birth_date', 'is', null);
    console.log(`\n✅ Migration complete. ${count} records now have birth_date.`);

    // Show samples
    const { data: samples } = await supabase.from('account_entities').select('display_name, birth_date').not('birth_date', 'is', null).limit(15);
    console.log('\nSamples:');
    samples?.forEach(r => console.log(`  ${r.display_name} → ${r.birth_date}`));
}

migrate();
