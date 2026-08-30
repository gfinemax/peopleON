import assert from 'node:assert/strict';
import test from 'node:test';

import {
    normalizeMemberWorkspaceIds,
    normalizeMemberWorkspaceReturnTo,
} from './memberWorkspaceRouting.ts';

test('통합현황 복귀 경로는 조합원·납부 화면만 허용한다', () => {
    assert.equal(normalizeMemberWorkspaceReturnTo('/payments?page=3'), '/payments?page=3');
    assert.equal(normalizeMemberWorkspaceReturnTo('/members?category=refund'), '/members?category=refund');
    assert.equal(normalizeMemberWorkspaceReturnTo('/settings'), '/members');
    assert.equal(normalizeMemberWorkspaceReturnTo('//example.com'), '/members');
});

test('묶인 조합원 ID는 기본 ID를 포함해 중복과 잘못된 값을 제거한다', () => {
    assert.deepEqual(
        normalizeMemberWorkspaceIds('entity-2, entity-1, invalid/id', 'entity-1'),
        ['entity-1', 'entity-2'],
    );
});
