const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function normalizePhone(phone) {
    if (!phone) return null;
    return String(phone).replace(/[^0-9]/g, '');
}

async function debugSync() {
    console.log('🔍 Debugging Sync for 박기월...');
    const filePath = path.resolve(__dirname, '../data/권리증(프로그램용).xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 2 });

    const targetRow = data.find(row => row && String(row[0]).trim() === '박기월');
    if (!targetRow) {
        console.error('❌ 박기월 not found in Excel');
        return;
    }

    console.log('Row Data:', JSON.stringify(targetRow));
    const name = String(targetRow[0]).trim();
    const phone = normalizePhone(targetRow[2]);
    const certNo = targetRow[10] ? String(targetRow[10]).trim() : null;

    console.log(`Checking DB for name: "${name}", phone: "${phone}"`);

    let matchedEntity = null;
    if (phone) {
        const { data: phoneMatch } = await supabase
            .from('account_entities')
            .select('id, display_name, phone, meta')
            .eq('display_name', name)
            .eq('phone', phone)
            .maybeSingle();
        if (phoneMatch) {
            console.log('✅ Found exact phone match:', phoneMatch.id);
            matchedEntity = phoneMatch;
        } else {
            console.log('ℹ️ No exact phone match.');
        }
    }

    if (!matchedEntity) {
        const { data: nameMatches } = await supabase
            .from('account_entities')
            .select('id, display_name, phone, meta')
            .eq('display_name', name);

        console.log(`Name search returned ${nameMatches?.length || 0} matches.`);
        if (nameMatches && nameMatches.length === 1) {
            matchedEntity = nameMatches[0];
            console.log('✅ Found unique name match:', matchedEntity.id);
        } else if (nameMatches && nameMatches.length > 1) {
            console.warn('⚠️ Multiple matches found, skipping.');
        }
    }

    if (matchedEntity) {
        console.log('Final Entity ID:', matchedEntity.id);
        if (certNo) {
            console.log('Upserting asset_rights for cert:', certNo);
            const { error: rtErr } = await supabase.from('asset_rights').upsert({
                entity_id: matchedEntity.id,
                right_type: 'certificate',
                right_number: certNo,
                meta: { debug: 'surgical_sync' }
            }, { onConflict: 'right_type,right_number' });
            if (rtErr) console.error('❌ Upsert Error:', rtErr.message);
            else console.log('🚀 Success!');
        }
    } else {
        console.log('❌ No match found in DB for', name);
    }
}

debugSync().catch(console.error);
