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

function parseKoreanMoney(str) {
    if (!str || typeof str !== 'string') return 0;
    const clean = str.replace(/[,원\s]/g, '');
    let total = 0;
    const numericOnly = parseFloat(clean.replace(/[^0-9.]/g, ''));
    if (str.includes('억') && numericOnly < 10000) return numericOnly * 100000000;
    if (str.includes('만') && numericOnly < 1000000) return numericOnly * 10000;
    return numericOnly || 0;
}

async function sync() {
    console.log('🚀 권리증 데이터 동기화 시작 (Correct Columns)...');

    const filePath = path.resolve(__dirname, '../data/권리증(프로그램용).xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 2 }); // 3행부터 (Data)

    console.log(`Excel Records: ${data.length}`);

    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[0]) continue;

        const name = String(row[0]).trim();
        const phone = normalizePhone(row[2]);
        const birthDate = row[9]; // 1974.2.7
        const certNo = row[10] && row[10] !== '없음' ? String(row[10]).trim() : null; // 2006-1-145
        const certName = row[11] ? String(row[11]).trim() : null;
        const certDate = row[12];
        const amountStr = String(row[13] || '');
        const amount = parseKoreanMoney(amountStr);
        const source = amountStr; // The "3000+2500" style data is in index 13
        const agent = row[14] ? String(row[14]).trim() : null;

        // 1. Find or Create Entity
        let entityId = null;
        let matchedEntity = null;

        // Try exact match with phone first
        if (phone) {
            const { data: phoneMatch } = await supabase
                .from('account_entities')
                .select('id, display_name, phone, meta')
                .eq('display_name', name)
                .eq('phone', phone)
                .maybeSingle();

            if (phoneMatch) {
                matchedEntity = phoneMatch;
            }
        }

        // If no phone match, try name-only match IF unique
        if (!matchedEntity) {
            const { data: nameMatches } = await supabase
                .from('account_entities')
                .select('id, display_name, phone, meta')
                .eq('display_name', name);

            if (nameMatches && nameMatches.length === 1) {
                matchedEntity = nameMatches[0];
                // If phone is different, register as secondary
                if (phone && matchedEntity.phone !== phone) {
                    console.log(`Row ${i + 3}: Name match found for ${name} but phone differs. Registering secondary phone: ${phone}`);
                    const updatedMeta = { ...(matchedEntity.meta || {}), secondary_phone: phone };
                    await supabase.from('account_entities').update({ meta: updatedMeta }).eq('id', matchedEntity.id);
                }
            } else if (nameMatches && nameMatches.length > 1) {
                console.warn(`Row ${i + 3}: Multiple entities found for name ${name}. Skipping due to ambiguity.`);
                errorCount++;
                continue;
            }
        }

        if (matchedEntity) {
            entityId = matchedEntity.id;
        } else {
            console.log(`Row ${i + 3}: No match found for ${name}. Creating new entity.`);
            const { data: newEnt, error: createError } = await supabase
                .from('account_entities')
                .insert({
                    display_name: name,
                    phone: phone,
                    meta: { sync_source: 'excel_cert_patch' }
                })
                .select('id')
                .single();

            if (createError) {
                console.error(`Row ${i + 3}: Failed to create entity ${name}:`, createError.message);
                errorCount++;
                continue;
            }
            entityId = newEnt.id;
            createdCount++;
        }

        // 2. Add '권리증보유자' Role
        const { error: roleError } = await supabase
            .from('membership_roles')
            .upsert({
                entity_id: entityId,
                role_code: '권리증보유자',
                role_status: 'active'
            }, { onConflict: 'entity_id,role_code,role_status' });

        if (roleError) {
            console.error(`Row ${i + 3}: Role insertion failed for ${name}:`, roleError.message);
            // This will fail if ENUM is not fixed yet!
        }

        // 3. Asset Rights Cleanup & Sync
        // Always clean up potential birthday-style garbage for anyone in this sheet
        await supabase.from('asset_rights')
            .delete()
            .eq('entity_id', entityId)
            .eq('right_type', 'certificate')
            .or('right_number.ilike.19%,right_number.ilike.%대%');

        if (certNo) {
            const { error: rightError } = await supabase
                .from('asset_rights')
                .upsert({
                    entity_id: entityId,
                    right_type: 'certificate',
                    right_number: certNo,
                    principal_amount: amount,
                    issued_at: (certDate && certDate instanceof Date) ? certDate.toISOString() : null,
                    meta: {
                        cert_name: certName,
                        source: source,
                        birth_date: birthDate,
                        agent: agent
                    }
                }, { onConflict: 'right_type,right_number' });

            if (rightError) {
                console.error(`Row ${i + 3}: Asset right insertion failed for ${certNo}:`, rightError.message);
            }
        }

        updatedCount++;
        if (i % 10 === 0) console.log(`Progress: Row ${i + 3} processed (${updatedCount} successes/skips)...`);
    }

    console.log(`✅ 완료! 생성: ${createdCount}, 처리: ${updatedCount}, 오류: ${errorCount}`);
}

sync().catch(err => {
    console.error('❌ Sync script failed:', err);
    process.exit(1);
});
