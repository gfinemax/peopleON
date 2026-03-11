const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase env is required');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DECLARED_OWNED_KEYWORDS = ['보유', '권리증보유', '권리보유', '권리증 있음', '있음', '소지'];
const PENDING_KEYWORDS = ['차후', '추후', '나중', '확인후', '확인 후', '제출예정', '제출 예정', '쪽지로', '미제출', '추후통보', '추후 통보', '예정'];
const MISSING_KEYWORDS = ['없음', '미보유', '해당없음', '해당 없음', '없다', 'x', 'null', 'none'];
const REVIEW_REQUIRED_KEYWORDS = ['분실', '구두', '참조', '메모', '외', '복수', '기존자료', '기존 자료'];
const SUPPORTIVE_TOKENS = ['보유', '권리증', '권리증번호', '필증', '증서', '번호', '있음', '소지', '권리보유', '확정', '명의변경', '명의 변경', '재발급', '재 발급'];
const EXACT_MISSING_VALUES = new Set(['', '-', '--', 'x', 'X', 'null', 'NULL', 'none', 'None']);
const CERTIFICATE_PATTERNS = [
    /\b\d{2,4}[-./]\d{1,2}[-./][0-9A-Za-z가-힣]+\b/u,
    /\b\d{1,2}[-./]\d{1,2}\s*no\.?\s*\d{1,2}[-./]\d{1,2}\b/iu,
    /\b\d{4}[-./]\d{1,2}\b/u,
    /\b특[-./]?[0-9A-Za-z가-힣-]+\b/u,
    /\b[0-9A-Za-z가-힣-]+[-./]?특\b/u,
    /\b\d{2,4}[-./]특[-./]?[0-9A-Za-z가-힣]+\b/u,
    /\b2\d{3}\b/u,
];

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, '').trim().toLowerCase();
}

function includesKeyword(raw, keywords) {
    const normalized = normalizeText(raw);
    return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

function isLikelyPhoneNumber(value) {
    const digits = String(value || '').replace(/\D/g, '');
    return /^01\d{8,9}$/.test(digits);
}

function isObviouslyInvalidRaw(value) {
    const raw = String(value || '').trim();
    if (isLikelyPhoneNumber(raw)) return true;
    if (/^19\d{2}[./-]\d{2}[./-]\d{2}$/.test(raw)) return true;
    if (/^19\d{2}\d{2}\d{2}$/.test(raw)) return true;
    return false;
}

function extractConfirmedCertificateNumber(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    let bestMatch = null;
    for (const pattern of CERTIFICATE_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
        const matches = raw.match(regex);
        if (!matches) continue;
        for (const match of matches) {
            const candidate = match.replace(/[./]/g, '-').replace(/\s+/g, '');
            if (isLikelyPhoneNumber(candidate)) continue;
            if (!bestMatch || candidate.length > bestMatch.length) {
                bestMatch = candidate;
            }
        }
    }

    return bestMatch;
}

function stripCandidateRemainder(raw, candidate) {
    let remainder = String(raw || '').replace(candidate, ' ');
    remainder = remainder.replace(/[()[\],:;]+/g, ' ');
    remainder = remainder.replace(/\s+/g, ' ').trim();
    if (!remainder) return '';

    let normalized = normalizeText(remainder);
    for (const token of SUPPORTIVE_TOKENS) {
        normalized = normalized.replaceAll(normalizeText(token), '');
    }
    normalized = normalized.replace(/[-_/]/g, '');
    return normalized.trim();
}

function classifyCertificateInput(value) {
    const rawValue = String(value || '').trim() || null;

    if (!rawValue || EXACT_MISSING_VALUES.has(rawValue)) {
        return { rawValue: null, confirmedNumber: null, status: 'missing', note: null };
    }

    if (includesKeyword(rawValue, MISSING_KEYWORDS)) {
        return { rawValue, confirmedNumber: null, status: 'missing', note: null };
    }

    const confirmedNumber = extractConfirmedCertificateNumber(rawValue);
    if (confirmedNumber) {
        const remainder = stripCandidateRemainder(rawValue, confirmedNumber);
        const status = remainder ? 'review_required' : 'confirmed';
        return {
            rawValue,
            confirmedNumber: status === 'confirmed' ? confirmedNumber : null,
            status,
            note: status === 'review_required' ? rawValue : null,
        };
    }

    if (includesKeyword(rawValue, DECLARED_OWNED_KEYWORDS)) {
        return { rawValue, confirmedNumber: null, status: 'declared_owned', note: null };
    }

    if (includesKeyword(rawValue, PENDING_KEYWORDS)) {
        return { rawValue, confirmedNumber: null, status: 'pending', note: null };
    }

    if (includesKeyword(rawValue, REVIEW_REQUIRED_KEYWORDS)) {
        return { rawValue, confirmedNumber: null, status: 'review_required', note: rawValue };
    }

    if (isObviouslyInvalidRaw(rawValue)) {
        return { rawValue, confirmedNumber: null, status: 'invalid', note: rawValue };
    }

    return { rawValue, confirmedNumber: null, status: 'review_required', note: rawValue };
}

async function run() {
    const shouldWrite = process.argv.includes('--run');
    console.log(`=== asset_rights 권리증 백필 (${shouldWrite ? 'run' : 'dry-run'}) ===`);

    const { data, error } = await supabase
        .from('asset_rights')
        .select('id, right_type, right_number, right_number_raw, right_number_status, right_number_note, classification_source')
        .eq('right_type', 'certificate');

    if (error) throw error;

    const rows = data || [];
    let scanned = 0;
    let changed = 0;
    let skippedManual = 0;

    for (const row of rows) {
        scanned += 1;

        if (row.classification_source === 'manual') {
            skippedManual += 1;
            continue;
        }

        const rawSeed = row.right_number_raw || row.right_number || '';
        const classified = classifyCertificateInput(rawSeed);
        const patch = {
            right_number: classified.confirmedNumber,
            right_number_raw: classified.rawValue,
            right_number_status: classified.status,
            right_number_note: classified.note,
            classification_source: 'auto',
            classified_at: new Date().toISOString(),
        };

        const isSame =
            (row.right_number || null) === patch.right_number &&
            (row.right_number_raw || null) === patch.right_number_raw &&
            (row.right_number_status || null) === patch.right_number_status &&
            (row.right_number_note || null) === patch.right_number_note &&
            row.classification_source === patch.classification_source;

        if (isSame) continue;
        changed += 1;

        if (shouldWrite) {
            const { error: updateError } = await supabase
                .from('asset_rights')
                .update(patch)
                .eq('id', row.id);

            if (updateError) {
                console.error(`update failed: ${row.id}`, updateError.message);
            }
        } else {
            console.log({
                id: row.id,
                before: {
                    right_number: row.right_number,
                    right_number_raw: row.right_number_raw,
                    right_number_status: row.right_number_status,
                },
                after: patch,
            });
        }
    }

    console.log({
        scanned,
        changed,
        skippedManual,
        mode: shouldWrite ? 'run' : 'dry-run',
    });
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
