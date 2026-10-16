import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('조합원 구분에서 행불 조합원을 선택하고 저장할 수 있다', () => {
    const workspace = read('src/components/features/members/MemberWorkspacePage.tsx');
    const route = read('src/app/api/members/inline-update/route.ts');
    const aggregation = read('src/services/memberAggregationUtils.ts');

    assert.match(workspace, /label: '조합원\(행불\)', value: '행불'/);
    assert.match(workspace, /hasTier\('행불'\).*'조합원\(행불\)'/);
    assert.match(route, /행불: \{ roleCode: '행불', isRegistered: false \}/);
    assert.match(aggregation, /'행불'\]\.includes\(t\)\) return 'member'/);
});

test('행불 조합원은 목록, 필터, 엑셀에서도 같은 이름으로 표시된다', () => {
    const tableHelpers = read('src/components/features/members/MembersTableSectionHelpers.tsx');
    const tableUtils = read('src/components/features/members/membersTableUtils.tsx');
    const filters = read('src/components/features/members/MembersFilter.tsx');
    const exportSource = read('src/components/features/members/MemberExportExcel.ts');

    assert.match(tableHelpers, /label: '조합원\(행불\)', value: '행불'/);
    assert.match(tableUtils, /primaryTier === '행불'.*'조합원\(행불\)'/);
    assert.match(filters, /'소송', '행불', '미신고조합원'/);
    assert.match(exportSource, /primaryTier === '행불'.*'조합원\(행불\)'/);
});

test('membership role enum migration includes the absent role', () => {
    const migration = read('supabase/migrations/20261016045952_add_absent_member_role.sql');
    assert.match(migration, /add value if not exists '행불'/i);
});
