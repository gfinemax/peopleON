import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAssignedUnitType } from './memberUnitDisplay.ts';

test('조합 공급형 기준으로 제곱미터를 평형으로 표시한다', () => {
    assert.equal(formatAssignedUnitType('84', 'pyeong'), '32평형');
    assert.equal(formatAssignedUnitType('59㎡', 'pyeong'), '24평형');
    assert.equal(formatAssignedUnitType('84㎡ A형', 'pyeong'), '32평형 A형');
});

test('평형 원본도 제곱미터 선택 시 조합 기준으로 표시한다', () => {
    assert.equal(formatAssignedUnitType('24평형', 'sqm'), '59㎡');
    assert.equal(formatAssignedUnitType('32평형', 'sqm'), '84㎡');
});
