const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/workspace/antigravity/peopleon/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findSyncResults() {
    console.log('--- Checking Rights from sync_certificates.js ---');

    // Check rights for entities created/updated by the new sync
    const { data: entities, error: entError } = await supabase
        .from('account_entities')
        .select('id, display_name')
        .eq('meta->>sync_source', 'excel_cert_patch')
        .limit(10);

    if (entError) {
        console.error('Error fetching entities:', entError);
        return;
    }

    if (entities.length === 0) {
        console.log('No entities found with sync_source meta.');
        return;
    }

    const entityIds = entities.map(e => e.id);
    const { data: rights, error: rightsError } = await supabase
        .from('asset_rights')
        .select('entity_id, right_number, meta')
        .in('entity_id', entityIds);

    if (rightsError) {
        console.error('Error fetching rights:', rightsError);
        return;
    }

    entities.forEach(ent => {
        const entRights = rights.filter(r => r.entity_id === ent.id);
        console.log(`\nName: ${ent.display_name}`);
        entRights.forEach(r => {
            console.log(`  Number: ${r.right_number}`);
            console.log(`  Meta: ${JSON.stringify(r.meta)}`);
        });
    });
}

findSyncResults();
