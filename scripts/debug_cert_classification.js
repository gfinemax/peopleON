const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const names = ['권영희', '김영수', '김점이', '김정자', '김정호', '고은정', '고영근', '금미경'];

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

            console.log(`\n=== ${e.display_name} (${e.id}) ===`);
            console.log(`  member_number: ${e.member_number}`);
            console.log(`  asset_rights: ${JSON.stringify((rights || []).map(r => ({ type: r.right_type, num: r.right_number })))}`);

            // Simulate the logic
            const certNumbers = (rights || []).filter(r => r.right_type === 'certificate').map(r => r.right_number?.trim()).filter(Boolean);
            const isDateLike = (v) => /^(19|20)\d{2}[\.-]\d{2}[\.-]\d{2}$/.test(v.trim()) || /^(19|20)\d{6}$/.test(v.trim());
            const realCertNumbers = certNumbers.filter(cn => !isDateLike(cn));
            const sanitizeNumber = (val) => {
                if (!val) return null;
                const v = val.trim();
                if (v.startsWith('19')) return null;
                if (/^\d{4}\.\d{2}\.\d{2}$/.test(v)) return null;
                return v;
            };

            let displayNum = '-';
            if (realCertNumbers.length > 0) {
                displayNum = realCertNumbers.join(', ');
            } else {
                const mainNum = sanitizeNumber(e.member_number);
                if (mainNum) displayNum = mainNum;
            }

            const hasNumericCert = displayNum !== '-' && displayNum !== '';
            console.log(`  realCertNumbers: ${JSON.stringify(realCertNumbers)}`);
            console.log(`  displayNum: ${displayNum}`);
            console.log(`  hasNumericCert: ${hasNumericCert}`);
            console.log(`  => Would be: ${hasNumericCert ? '권리증번호있음' : '권리증번호없음'}`);
        }
    }
}

check();
