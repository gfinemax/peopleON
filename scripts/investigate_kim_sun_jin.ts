const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
    // Attempting to select common fields found in the codebase
    const { data, error } = await supabase
        .from('account_entities')
        .select('id, display_name, member_number, phone, email, birth_date, created_at, source_party_id')
        .eq('display_name', '김선진');

    if (error) {
        console.error('Error fetching 김선진 records:', error);
        return;
    }

    console.log('김선진 Records Found:', data.length);
    data.forEach((e: any, i: number) => {
        console.log(`\n[${i}]`);
        console.log(`  ID: ${e.id}`);
        console.log(`  Name: ${e.display_name}`);
        console.log(`  MemNo: ${e.member_number}`);
        console.log(`  Phone: ${e.phone}`);
        console.log(`  Birth: ${e.birth_date}`);
        console.log(`  Created: ${e.created_at}`);
        console.log(`  SourcePartyId: ${e.source_party_id}`);
    });
}

investigate();

export { };
