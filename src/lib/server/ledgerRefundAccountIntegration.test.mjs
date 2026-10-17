import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const route = fs.readFileSync(
    path.join(root, 'src/app/api/integrations/ledger/members/[peopleonId]/refund-account/route.ts'),
    'utf8',
);
const proxy = fs.readFileSync(path.join(root, 'src/proxy.ts'), 'utf8');

test('ledger refund account integration uses the exact bridged person and atomic account fields', () => {
    assert.match(route, /hasValidApiKey\(request\.headers\)/);
    assert.match(route, /candidate\.id === peopleonId/);
    assert.match(route, /bank_name: bankName/);
    assert.match(route, /account_number: accountNumber/);
    assert.match(route, /account_holder: accountHolder/);
    assert.match(route, /purpose: 'refund'/);
    assert.match(route, /confirmOverwrite/);
    assert.match(route, /expectedUpdatedAt/);
    assert.match(route, /\.eq\('updated_at', existing\.updated_at\)/);
    assert.match(route, /result\.error\?\.code === '23505'/);
});

test('ledger refund account integration masks responses and audit details', () => {
    assert.match(route, /account_number_masked: maskBankAccountNumber/);
    assert.match(route, /account_number_last4: accountDigits\.slice\(-4\)/);
    assert.match(route, /LEDGER_UPDATE_MEMBER_REFUND_ACCOUNT/);
    assert.doesNotMatch(route, /details:\s*\{[^}]*account_number:\s*accountNumber/s);
    assert.match(proxy, /refund-account/);
});
