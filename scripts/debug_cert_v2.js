const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const names = ['권영희', '김점이', '김정자', '김정호'];

    const results = [];
    for (const name of names) {
        const { data: entities } = await supabase
            .from('account_entities')
            .select('id, display_name, member_number')
            .eq('display_name', name);

        if (!entities || entities.length === 0) continue;

        for (const e of entities) {
            const { data: rights } = await supabase
                .from('asset_rights')
                .select('id, right_number, right_type')
                .eq('entity_id', e.id);

            const certNumbers = (rights || []).filter(r => r.right_type === 'certificate').map(r => r.right_number?.trim()).filter(Boolean);
            const isDateLike = (v) => /^(19|20)\d{2}[\.-]\d{2}[\.-]\d{2}$/.test(v.trim()) || /^(19|20)\d{6}$/.test(v.trim());
            const realCertNumbers = certNumbers.filter(cn => !isDateLike(cn));

            results.push({
                name: e.display_name,
                member_number: e.member_number,
                certNumbers,
                realCertNumbers,
            });
        }
    }

    console.log(JSON.stringify(results, null, 2));
}

check();
