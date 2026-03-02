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

async function checkMissing() {
    const filePath = path.resolve(__dirname, '../data/권리증(프로그램용).xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 2 });

    let missingLog = [];

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[0]) continue;

        const name = String(row[0]).trim();
        const phone = normalizePhone(row[2]);
        const historyText = row[21];

        if (!historyText || String(historyText).trim() === '') continue;

        let entityId = null;

        // Try phone match
        if (phone) {
            const { data: phoneMatch } = await supabase
                .from('account_entities')
                .select('id, display_name, phone')
                .eq('display_name', name)
                .eq('phone', phone)
                .maybeSingle();
            if (phoneMatch) entityId = phoneMatch.id;
        }

        // Try exact name match if no phone match
        if (!entityId) {
            const { data: nameMatches } = await supabase
                .from('account_entities')
                .select('id, display_name, phone')
                .eq('display_name', name);
            if (nameMatches && nameMatches.length === 1) {
                entityId = nameMatches[0].id;
            }
        }

        // Try finding by name ignoring phone, if multiple, take first (or just flag it)
        if (!entityId) {
            const { data: fuzzy } = await supabase
                .from('account_entities')
                .select('id, display_name, phone')
                .ilike('display_name', `%${name}%`);

            missingLog.push({
                excelRow: i + 3,
                name,
                phone,
                fuzzyMatches: fuzzy ? fuzzy.length : 0,
                fuzzyExamples: fuzzy ? fuzzy.slice(0, 2) : []
            });
        }
    }

    console.log(`Missing Matches: ${missingLog.length} rows`);
    if (missingLog.length > 0) {
        console.log("Examples of missing rows:");
        console.dir(missingLog.slice(0, 10), { depth: null });
    }
}

checkMissing();
