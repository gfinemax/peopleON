const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

function normalizePhone(phone) {
    if (!phone) return '';
    return String(phone).replace(/[^0-9]/g, '');
}

async function fix() {
    console.log('📖 조합원 명단 읽기...');
    const memberWb = XLSX.readFile(path.resolve(__dirname, '../data/조합원 명단 및 세부내역(프로그램용).xlsx'));
    const memberWs = memberWb.Sheets['최근 주소록'];
    const memberData = XLSX.utils.sheet_to_json(memberWs, { header: 1, range: 2 });

    let fixedCount = 0;
    let skipCount = 0;

    for (const row of memberData) {
        const [_, no, role, memberNo, name, phone] = row;
        if (!name || role !== '등기조합원') continue;

        const phoneNorm = normalizePhone(phone);

        // Find existing entity
        const { data: ent, error: findError } = await supabase
            .from('account_entities')
            .select('id, tags')
            .eq('display_name', name)
            .eq('phone', phoneNorm)
            .maybeSingle();

        if (findError || !ent) {
            console.log(`⚠️  Entity not found: ${name} (${phoneNorm})`);
            skipCount++;
            continue;
        }

        // 1. 역할 추가 또는 업데이트
        const { data: existingRole, error: fetchRoleErr } = await supabase
            .from('membership_roles')
            .select('id')
            .eq('entity_id', ent.id)
            .eq('role_code', '등기조합원')
            .maybeSingle();

        if (fetchRoleErr) {
            console.error(`❌ Fetch Role Error for ${name}:`, fetchRoleErr.message);
            continue;
        }

        if (existingRole) {
            const { error: updErr } = await supabase
                .from('membership_roles')
                .update({ role_status: 'active', is_registered: true })
                .eq('id', existingRole.id);
            if (updErr) console.error(`❌ Update Role Error for ${name}:`, updErr.message);
        } else {
            const { error: insErr } = await supabase
                .from('membership_roles')
                .insert({
                    entity_id: ent.id,
                    role_code: '등기조합원',
                    role_status: 'active',
                    is_registered: true
                });
            if (insErr) console.error(`❌ Insert Role Error for ${name}:`, insErr.message);
        }

        // 2. 태그 추가
        const currentTags = ent.tags || [];
        if (!currentTags.includes('등기')) {
            const newTags = [...currentTags, '등기'];
            await supabase
                .from('account_entities')
                .update({ tags: newTags })
                .eq('id', ent.id);
        }

        fixedCount++;
        if (fixedCount % 10 === 0) console.log(`... ${fixedCount}명 처리 중`);
    }

    console.log(`✅ 완료! 총 ${fixedCount}명 등기조합원 분류 완료. (건너뜀: ${skipCount}명)`);
}

fix().catch(console.error);
