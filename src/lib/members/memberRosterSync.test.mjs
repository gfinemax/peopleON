import assert from 'node:assert/strict';
import test from 'node:test';
import {
    calculateRosterAdjustment,
    findRosterColumn,
    normalizeRosterName,
    parseRosterMoney,
} from './memberRosterSync.ts';

test('명부 이름은 공백과 호환 문자를 제거해 비교한다', () => {
    assert.equal(normalizeRosterName(' 오 학동 '), '오학동');
});

test('총납입금액은 쉼표와 원 표시를 제거해 숫자로 변환한다', () => {
    assert.equal(parseRosterMoney('210,000,000원'), 210000000);
    assert.equal(parseRosterMoney(42000000), 42000000);
});

test('총납입 조정선은 목표 총액에서 기존 상세 합계를 뺀다', () => {
    assert.equal(calculateRosterAdjustment(210000000, 180000000), 30000000);
    assert.equal(calculateRosterAdjustment(150000000, 180000000), -30000000);
});

test('엑셀 열 제목 후보를 정확히 자동 선택한다', () => {
    const headers = ['성명', '평형', '총 납입금액'];
    assert.equal(findRosterColumn(headers, ['이름', '성명']), '성명');
    assert.equal(findRosterColumn(headers, ['총납입금액']), '총 납입금액');
});
