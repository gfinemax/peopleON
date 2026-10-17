import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const route = fs.readFileSync(
    path.join(root, 'src/app/api/integrations/ledger/members/[peopleonId]/profile/route.ts'),
    'utf8',
);
const proxy = fs.readFileSync(path.join(root, 'src/proxy.ts'), 'utf8');

test('ledger profile integration only fills selected empty PeopleON fields', () => {
    assert.match(route, /hasValidApiKey\(request\.headers\)/);
    assert.match(route, /candidate\.id === peopleonId/);
    assert.match(route, /selectedProfileFields/);
    assert.match(route, /currentEntity\[column\]/);
    assert.match(route, /이미 있어 덮어쓰지 않았습니다/);
    assert.match(route, /only_empty_fields: true/);
    assert.match(route, /LEDGER_REGISTER_EMPTY_MEMBER_FIELDS/);
});

test('ledger profile integration writes membership data to a matching certificate only', () => {
    assert.match(route, /certificate_no_context/);
    assert.match(route, /matchingCertificateRows\.length === 1/);
    assert.match(route, /가입일을 연결할 PeopleON 필증을 하나로 확인할 수 없습니다/);
    assert.match(route, /certificate_status: 'confirmed'/);
    assert.match(route, /source_type: 'dbapt-ledger'/);
    assert.match(route, /revalidateUnifiedMembersTag\(\)/);
    assert.match(proxy, /ledger\\\/members\\\/\[\^\/\]\+\\\/profile/);
});
