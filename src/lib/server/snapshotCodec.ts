import { gzipSync, gunzipSync } from 'node:zlib';

// Repeated historical memo text can exceed the Next Data Cache item limit.
// Compress inside the server cache, without discarding searchable/exportable notes.
export function encodeSnapshot(value: unknown): string {
    return gzipSync(JSON.stringify(value)).toString('base64');
}

export function decodeSnapshot<T>(value: string): T {
    return JSON.parse(gunzipSync(Buffer.from(value, 'base64')).toString('utf8')) as T;
}
