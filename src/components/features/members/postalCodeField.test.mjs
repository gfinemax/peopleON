import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('우편번호 컬럼 마이그레이션은 기존 행을 보존하는 nullable text 컬럼을 추가한다', () => {
    const migration = read('supabase/migrations/20260911054907_add_postal_code_to_account_entities.sql');

    assert.match(migration, /alter table public\.account_entities/i);
    assert.match(migration, /add column if not exists postal_code text/i);
    assert.doesNotMatch(migration, /not null/i);
});

test('조합원 상세 우편번호는 조회, 수정 요청, 서버 저장 계약에 포함된다', () => {
    const fetchSource = read('src/components/features/members/memberDetailDialogFetch.ts');
    const mutationSource = read('src/components/features/members/memberDetailDialogMutations.ts');
    const payloadSource = read('src/lib/server/memberUpdateRouteTypes.ts');
    const patchSource = read('src/lib/server/memberUpdateBasicUtils.ts');

    assert.match(fetchSource, /\.select\('[^']*postal_code[^']*'\)/);
    assert.match(mutationSource, /postal_code:\s*formData\.postal_code/);
    assert.match(payloadSource, /postal_code\?:\s*string\s*\|\s*null/);
    assert.match(patchSource, /patch\.postal_code\s*=\s*body\.postal_code\.trim\(\)\s*\|\|\s*null/);
});

test('신규 등록과 엑셀 일괄 등록도 우편번호를 저장한다', () => {
    const createDialog = read('src/components/features/members/MemberCreateDialog.tsx');
    const createRoute = read('src/app/api/members/create/route.ts');
    const bulkDialog = read('src/components/features/members/MemberBulkUploadDialog.tsx');
    const bulkRoute = read('src/app/api/members/bulk-upload/route.ts');

    assert.match(createDialog, /htmlFor="postal_code"/);
    assert.match(createRoute, /postal_code:\s*typeof postal_code === 'string'/);
    assert.match(bulkDialog, /row\["우편번호"\]/);
    assert.match(bulkRoute, /postal_code:\s*typeof m\.postal_code === 'string'/);
});

test('통합 목록 캐시와 상세 화면이 우편번호를 반환하고 표시한다', () => {
    const dataSource = read('src/services/memberAggregationData.ts');
    const builderSource = read('src/services/memberAggregationBuilders.ts');
    const workspaceSource = read('src/components/features/members/MemberWorkspacePage.tsx');
    const editorSource = read('src/components/features/members/MemberWorkspaceProfileEditor.tsx');
    const cacheSource = read('src/lib/server/unifiedMembersSnapshot.ts');

    assert.match(dataSource, /\.select\('[^']*postal_code[^']*'\)/);
    assert.match(builderSource, /postal_code:\s*entity\.postal_code\s*\|\|\s*null/);
    assert.match(workspaceSource, /<Row label="우편번호">\{value\(member\.postal_code\)\}<\/Row>/);
    assert.match(editorSource, /onFieldChange\('postal_code', event\.target\.value\)/);
    assert.match(cacheSource, /unified-members-snapshot-v8-postal-code/);
});

test('주소 검색 API는 사용자가 선택한 주소와 우편번호를 신규·수정 폼에 함께 반영한다', () => {
    const searchButton = read('src/components/features/members/KakaoPostcodeSearchButton.tsx');
    const createDialog = read('src/components/features/members/MemberCreateDialog.tsx');
    const editor = read('src/components/features/members/MemberWorkspaceProfileEditor.tsx');

    assert.match(searchButton, /https:\/\/t1\.kakaocdn\.net\/mapjsapi\/bundle\/postcode\/prod\/postcode\.v2\.js/);
    assert.match(searchButton, /data\.zonecode\.trim\(\)/);
    assert.match(searchButton, /data\.userSelectedType === 'R'/);
    assert.match(searchButton, /data\.roadAddress/);
    assert.match(searchButton, /data\.jibunAddress/);
    assert.match(searchButton, /postcode\.open\(\{/);
    assert.match(searchButton, /\.\.\.\(query \? \{ q: query \} : \{\}\)/);

    assert.match(createDialog, /<KakaoPostcodeSearchButton/);
    assert.match(createDialog, /postal_code: postalCode/);
    assert.match(createDialog, /address_legal: address/);
    assert.match(editor, /<KakaoPostcodeSearchButton/);
    assert.match(editor, /onFieldChange\('postal_code', postalCode\)/);
    assert.match(editor, /onFieldChange\('address_legal', address\)/);
});

test('회계원장 연동 API는 우편번호와 주소를 함께 반환한다', () => {
    const integrationRoute = read('src/app/api/integrations/ledger/members/route.ts');

    assert.match(integrationRoute, /postal_code:\s*person\.postal_code\s*\|\|\s*null/);
    assert.match(integrationRoute, /address:\s*person\.address_legal\s*\|\|\s*null/);
});
