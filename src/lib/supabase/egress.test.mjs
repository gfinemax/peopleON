import assert from 'node:assert/strict';
import test from 'node:test';
import { readAllPages } from './readAllPages.ts';
import { createDeduplicatedFetch } from './deduplicateFetch.ts';
import { encodeSnapshot, decodeSnapshot } from '../server/snapshotCodec.ts';
import { singleFlight } from '../server/singleFlight.ts';

test('simultaneous snapshot cache misses share a fill and a rejected fill can recover', async () => {
    let calls = 0;
    const load = singleFlight(async () => { calls++; if (calls === 1) throw new Error('offline'); return 'ok'; });
    const failures = await Promise.allSettled([load(), load()]);
    assert.ok(failures.every((result) => result.status === 'rejected'));
    assert.equal(calls, 1);
    assert.deepEqual(await Promise.all([load(), load()]), ['ok', 'ok']);
    assert.equal(calls, 2);
});

test('complete aggregates cross the former 1000 row boundary without dropping rows', async () => {
    const rows = Array.from({ length: 1107 }, (_, id) => ({ id }));
    const ranges = [];
    const result = await readAllPages({ range(from, to) {
        ranges.push([from, to]);
        return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    } });
    assert.deepEqual(result.data, rows);
    assert.ok(ranges.every(([from, to]) => to - from === 49));
    assert.equal(ranges.length, 23);
});

test('a later page error returns no misleading partial dataset and is not retried', async () => {
    let calls = 0;
    const error = { code: '402' };
    const result = await readAllPages({ range() {
        calls++;
        return Promise.resolve(calls === 1 ? { data: Array(50).fill({ id: 1 }), error: null } : { data: null, error });
    } });
    assert.deepEqual(result, { data: null, error });
    assert.equal(calls, 2);
});

test('concurrent equal reads share one response, each caller can consume its body', async () => {
    let calls = 0;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const request = createDeduplicatedFetch(async () => { calls++; await gate; return new Response('[{"id":1}]'); });
    const a = request('https://example.test/rest/v1/members', { headers: { Authorization: 'Bearer user-a' } });
    const b = request('https://example.test/rest/v1/members', { headers: { Authorization: 'Bearer user-a' } });
    release();
    assert.deepEqual(await (await a).json(), [{ id: 1 }]);
    assert.deepEqual(await (await b).json(), [{ id: 1 }]);
    assert.equal(calls, 1);
    await request('https://example.test/rest/v1/members', { headers: { Authorization: 'Bearer user-a' } });
    assert.equal(calls, 2, 'settled data is not cached');
});

test('different users and writes never share requests', async () => {
    let calls = 0;
    const request = createDeduplicatedFetch(async () => { calls++; return new Response('[]'); });
    await Promise.all([
        request('https://example.test', { headers: { Authorization: 'Bearer user-a' } }),
        request('https://example.test', { headers: { Authorization: 'Bearer user-b' } }),
        request('https://example.test', { method: 'POST', body: '{}' }),
        request('https://example.test', { method: 'POST', body: '{}' }),
    ]);
    assert.equal(calls, 4);
});

test('failed reads are released without automatic retries', async () => {
    let calls = 0;
    const request = createDeduplicatedFetch(async () => { calls++; throw new Error('offline'); });
    await assert.rejects(request('https://example.test'), /offline/);
    await assert.rejects(request('https://example.test'), /offline/);
    assert.equal(calls, 2);
});

test('large repeated Korean notes survive compression exactly', () => {
    const rows = [{ id: 'fixture', notes: '[시스템 알림] 동일한 필증번호가 등록되었습니다.\n'.repeat(100000) }];
    const encoded = encodeSnapshot(rows);
    assert.deepEqual(decodeSnapshot(encoded), rows);
    assert.ok(Buffer.byteLength(encoded) < Buffer.byteLength(JSON.stringify(rows)) * 0.1);
    assert.ok(Buffer.byteLength(encoded) < 2 * 1024 * 1024);
});
