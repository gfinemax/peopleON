import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const helper = fs.readFileSync(path.join(root, 'src/lib/members/unreportedMembership.ts'), 'utf8');
const aggregation = fs.readFileSync(path.join(root, 'src/services/memberAggregationUtils.ts'), 'utf8');
const integration = fs.readFileSync(path.join(root, 'src/app/api/integrations/ledger/unreported-members/route.ts'), 'utf8');
const refundTargets = fs.readFileSync(path.join(root, 'src/lib/server/ledgerRefundTargets.ts'), 'utf8');

test('미신고조합원은 신고 완료가 아닌 조합원 역할로 집계한다', () => {
    assert.match(aggregation, /미신고조합원/);
    assert.match(aggregation, /return 'member'/);
    assert.match(helper, /UNREPORTED_CLAIMED_AMOUNT = 43_000_000/);
});

test('회계 연동은 고유 record_id와 PeopleON UUID 및 신고액을 제공한다', () => {
    assert.match(integration, /peopleon_id: person\.id/);
    assert.match(integration, /record_id/);
    assert.match(integration, /declared_total/);
    assert.match(integration, /hasValidApiKey/);
});

test('회계 API 장애 시 다른 이름의 임시 명단으로 대체하지 않는다', () => {
    assert.doesNotMatch(refundTargets, /FALLBACK_REFUND_TARGETS/);
    assert.match(refundTargets, /targets: \[\]/);
});
