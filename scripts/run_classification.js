const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runClassification() {
    console.log('--- 등기조합원 분류 시작 ---');

    // 1. membership_roles 업데이트
    console.log('1. membership_roles 업데이트 중...');
    const { data: updatedRoles, error: roleError, count: roleCount } = await supabase
        .from('membership_roles')
        .update({ is_registered: true })
        .eq('role_code', '등기조합원')
        .select('entity_id');

    if (roleError) {
        console.error('Role Update Error:', roleError);
        process.exit(1);
    }
    console.log(`✅ ${updatedRoles.length}개의 역할을 '등기조합원'으로 마킹 완료.`);

    // 2. account_entities 태그 보강
    console.log('2. account_entities 태그 보강 중...');
    const entityIds = updatedRoles.map(r => r.entity_id);

    // 개별적으로 태그를 추가하는 대신 한 번에 처리하고 싶지만 Supabase JS client는 array_append를 직접 지원하지 않으므로
    // 각각의 현재 태그를 가져와서 업데이트하거나, 또는 단순히 덮어쓰기 위험이 있으므로 주의가 필요함.
    // 하지만 현재 마이그레이션 직후라 태그가 거의 없을 것이므로 간단하게 가져와서 처리함.

    const { data: entities, error: entFetchError } = await supabase
        .from('account_entities')
        .select('id, tags')
        .in('id', entityIds);

    if (entFetchError) {
        console.error('Entity Fetch Error:', entFetchError);
        process.exit(1);
    }

    let entUpdateCount = 0;
    for (const ent of entities) {
        const currentTags = ent.tags || [];
        if (!currentTags.includes('등기')) {
            const newTags = [...currentTags, '등기'];
            const { error: entUpdError } = await supabase
                .from('account_entities')
                .update({ tags: newTags })
                .eq('id', ent.id);

            if (!entUpdError) entUpdateCount++;
        }
    }

    console.log(`✅ ${entUpdateCount}명의 인물에 '등기' 태그 추가 완료.`);
    console.log('--- 분류 완료 ---');
}

runClassification().catch(console.error);
