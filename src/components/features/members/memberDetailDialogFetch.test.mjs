import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = fs.readFileSync(
    path.join(process.cwd(), 'src/components/features/members/memberDetailDialogFetch.ts'),
    'utf8',
);

test('조합원 상세 기본 조회는 제거된 account_entities 구형 컬럼을 요청하지 않는다', () => {
    const accountEntityProjection = source.match(
        /\.from\('account_entities'\)\s*\.select\('([^']+)'\)/,
    )?.[1];

    assert.ok(accountEntityProjection, 'account_entities 상세 조회 projection을 찾을 수 있어야 한다');
    const columns = accountEntityProjection.split(',').map((column) => column.trim());
    assert.equal(columns.includes('tier'), false);
    assert.equal(columns.includes('member_number'), false);
});

test('조합원 상세 구분은 membership_roles에서 계산한 tiers를 사용한다', () => {
    assert.match(source, /tier:\s*tiers\[0\]\s*\|\|\s*null/);
    assert.match(source, /member_number:\s*latestCertificateNumber\s*\|\|\s*'-'/);
});
