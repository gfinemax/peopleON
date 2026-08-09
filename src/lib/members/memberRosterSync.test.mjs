import assert from 'node:assert/strict';
import test from 'node:test';
import {
    findRosterColumn,
    normalizeRosterName,
} from './memberRosterSync.ts';

test('명부 이름은 공백과 호환 문자를 제거해 비교한다', () => {
    assert.equal(normalizeRosterName(' 오 학동 '), '오학동');
});

test('엑셀 열 제목 후보를 정확히 자동 선택한다', () => {
    const headers = ['성명', '평형'];
    assert.equal(findRosterColumn(headers, ['이름', '성명']), '성명');
});
