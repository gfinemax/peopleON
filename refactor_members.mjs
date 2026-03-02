import fs from 'fs';

const filePath = 'src/app/(dashboard)/members/page.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add import
if (!content.includes('getUnifiedMembers')) {
    content = content.replace(
        "import React from 'react';",
        "import React from 'react';\nimport { getUnifiedMembers, UnifiedPerson, normalizeText } from '@/services/memberAggregation';"
    );
}

// 2. Remove types and duplicate helpers
const typeStartMarker = "type RoleType = 'member' | 'certificate_holder' | 'related_party' | 'refund_applicant' | 'agent';";
const typeEndMarker = "};";

// We'll use regex to remove everything from RoleType to UnifiedPerson
content = content.replace(
    /type RoleType = .*?type UnifiedPerson = \{[\s\S]*?^\};\n?/m,
    ''
);

// Remove the locally defined helpers that we now import/no longer need
content = content.replace(/const normalizeText = [\s\S]*?return rawTier\?\.trim\(\) \|\| null;\n\};\n?/m, '');
content = content.replace(/const getUiRoleFromTier = [\s\S]*?return 'other';\n\};\n?/m, '');

// 3. Replace the massive unified logic block inside MembersPage component
const queryStart = "let fetchError: unknown = null;";
const queryEnd = "const isTierMatch = (person: UnifiedPerson, targetTier: string) => {";

const indexStart = content.indexOf(queryStart);
const indexEnd = content.indexOf(queryEnd);

if (indexStart !== -1 && indexEnd !== -1) {
    const replacement = `
    const { unifiedPeople, fetchError: fetchErr } = await getUnifiedMembers(supabase);
    let fetchError: unknown = fetchErr;

    `;

    // Some lines to replace correctly: We want to replace from queryStart up to right before queryEnd 
    content = content.substring(0, indexStart) + replacement + content.substring(indexEnd);
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully refactored members/page.tsx');
