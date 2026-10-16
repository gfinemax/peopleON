import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('조합원 구분에서 소송 조합원을 선택하고 저장할 수 있다', () => {
    const workspace = read('src/components/features/members/MemberWorkspacePage.tsx');
    const route = read('src/app/api/members/inline-update/route.ts');
    const aggregation = read('src/services/memberAggregationUtils.ts');

    assert.match(workspace, /label: '조합원\(소송\)', value: '소송'/);
    assert.match(workspace, /hasTier\('소송'\).*'조합원\(소송\)'/);
    assert.match(route, /소송: \{ roleCode: '소송', isRegistered: false \}/);
    assert.match(aggregation, /'소송'/);
    assert.match(aggregation, /\.includes\(t\)\) return 'member'/);
});

test('소송 조합원은 목록, 필터, 엑셀에서도 같은 이름으로 표시된다', () => {
    const tableHelpers = read('src/components/features/members/MembersTableSectionHelpers.tsx');
    const tableUtils = read('src/components/features/members/membersTableUtils.tsx');
    const filters = read('src/components/features/members/MembersFilter.tsx');
    const exportSource = read('src/components/features/members/MemberExportExcel.ts');

    assert.match(tableHelpers, /label: '조합원\(소송\)', value: '소송'/);
    assert.match(tableUtils, /primaryTier === '소송'.*'조합원\(소송\)'/);
    assert.match(filters, /member: \[[^\]]*'소송'[^\]]*\]/);
    assert.match(exportSource, /primaryTier === '소송'.*'조합원\(소송\)'/);
});

test('membership role enum migration includes the litigation role', () => {
    const migration = read('supabase/migrations/20261016000000_add_litigation_member_role.sql');
    assert.match(migration, /add value if not exists '소송'/i);
});
