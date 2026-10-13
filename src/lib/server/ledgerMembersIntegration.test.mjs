import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();
const route = fs.readFileSync(
    path.join(root, 'src/app/api/integrations/ledger/members/route.ts'),
    'utf8',
);

describe('ledger members integration', () => {
    it('exposes merged entity ids so a member detail URL can be linked safely', () => {
        assert.match(route, /peopleon_id:\s*person\.id,/);
        assert.match(route, /member_id:\s*person\.member_id,/);
        assert.match(route, /entity_ids:\s*person\.entity_ids,/);
    });
});
