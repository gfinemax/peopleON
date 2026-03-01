const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qhmgtqihwvysfrcxelnn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobWd0cWlod3Z5c2ZyY3hlbG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5ODcxMTUsImV4cCI6MjA4NDU2MzExNX0.nxnCrfGrmY52LDwbHhZzOFNdwiQ9u8n2dQSzq98I8Mo';

async function check() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('--- Checking Counts ---');

    // 1. Total Registered
    const { data: roles } = await supabase.from('membership_roles').select('entity_id').eq('is_registered', true);
    const registeredIds = Array.from(new Set(roles.map(r => r.entity_id)));
    console.log('Total Registered Entities in membership_roles:', registeredIds.length);

    // 2. Entities in asset_rights that are registered
    const { data: rights } = await supabase.from('asset_rights').select('entity_id');
    const entitiesWithRights = new Set(rights.map(r => r.entity_id));

    const registeredWithRights = registeredIds.filter(id => entitiesWithRights.has(id));
    console.log('Registered Entities WITH asset_rights:', registeredWithRights.length);

    const registeredWithoutRights = registeredIds.filter(id => !entitiesWithRights.has(id));
    console.log('Registered Entities WITHOUT asset_rights:', registeredWithoutRights.length);

    if (registeredWithoutRights.length > 0) {
        const { data: names } = await supabase.from('account_entities').select('display_name').in('id', registeredWithoutRights.slice(0, 5));
        console.log('Samples without rights:', JSON.stringify(names));
    }
}

check();
