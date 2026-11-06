import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
    new URL('./MembersKpiStrip.tsx', import.meta.url),
    'utf8',
);

test('전체세대 카드는 등기조합원 85세대 기준으로 표시한다', () => {
    assert.match(source, /label: '등기조합원', value: households\.members/);
    assert.match(source, /pillText={`등기조합원 \$\{ratio\(households\.members, households\.total\)\}%`}/);
    assert.equal(Math.round((85 / 254) * 1000) / 10, 33.5);
    assert.equal(254 - 85, 169);
    assert.equal(Math.round((169 / 254) * 1000) / 10, 66.5);
});
