import assert from 'node:assert/strict';
import test from 'node:test';
import { getMemberRelationLabel } from './memberRelation.ts';

test('부부 관계는 배우자로 표시한다', () => {
    assert.equal(getMemberRelationLabel('부부'), '배우자');
    assert.equal(getMemberRelationLabel(' 부부 '), '배우자');
});

test('다른 관계 명칭은 유지한다', () => {
    assert.equal(getMemberRelationLabel('자녀'), '자녀');
    assert.equal(getMemberRelationLabel(null), '');
});
