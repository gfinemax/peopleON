import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const paymentTab = fs.readFileSync(
    path.join(root, 'src/components/features/members/PaymentStatusTab.tsx'),
    'utf8',
);
const workspace = fs.readFileSync(
    path.join(root, 'src/components/features/members/MemberWorkspacePage.tsx'),
    'utf8',
);
const hook = fs.readFileSync(
    path.join(root, 'src/components/features/members/useLedgerJournalSummary.ts'),
    'utf8',
);
const serverIntegration = fs.readFileSync(
    path.join(root, 'src/lib/server/ledgerJournalSummary.ts'),
    'utf8',
);

test('통합현황과 상세 납부현황은 같은 회계원장 API 훅을 사용한다', () => {
    assert.match(workspace, /useLedgerJournalSummary\(member\.id\)/);
    assert.match(paymentTab, /useLedgerJournalSummary\(memberIds\[0\] \|\| ''\)/);
    assert.match(hook, /ledger-journal-summary/);
    assert.match(hook, /cache: 'no-store'/);
});

test('상세 납부현황은 회계원장 값과 PeopleON 수기 관리 값을 구분한다', () => {
    assert.match(paymentTab, /회계원장 API 납부현황/);
    assert.match(paymentTab, /payment\.total_paid/);
    assert.match(paymentTab, /payment\.gross_paid/);
    assert.match(paymentTab, /payment\.allocations\[key\]/);
    assert.match(paymentTab, /PeopleON 납부 계획 · 수기 관리/);
});

test('회계원장 호출은 인증 헤더가 리다이렉트에서 유실되지 않도록 HTTPS를 직접 사용한다', () => {
    assert.match(serverIntegration, /https:\/\/dbapt-ledger\.duckdns\.org/);
    assert.doesNotMatch(serverIntegration, /http:\/\/dbapt-ledger\.duckdns\.org/);
});
