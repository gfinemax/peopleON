import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'src/app/api/integrations/ledger/members/[peopleonId]/supply-type/route.ts'), 'utf8');
const proxy = fs.readFileSync(path.join(root, 'src/proxy.ts'), 'utf8');

test('ledger supply type integration updates exact bridged entities with audit', () => {
    assert.match(route, /hasValidApiKey\(request\.headers\)/);
    assert.match(route, /candidate\.id === peopleonId/);
    assert.match(route, /\.update\(\{ unit_group: supplyType \}\)/);
    assert.match(route, /\.in\('id', entityIds\)/);
    assert.match(route, /LEDGER_UPDATE_MEMBER_UNIT_GROUP/);
    assert.match(route, /revalidateUnifiedMembersTag\(\)/);
    assert.match(proxy, /ledger\\\/members\\\/\[\^\/\]\+\\\/supply-type/);
});
