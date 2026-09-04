/** Share only concurrent GET/HEAD responses, scoped to the complete request headers.
 * No settled response or user data is retained, and writes are never shared.
 */
type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export function createDeduplicatedFetch(fetcher: FetchFunction = fetch): FetchFunction {
    const pending = new Map<string, Promise<Response>>();
    return async (input, init) => {
        const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (!['GET', 'HEAD'].includes(method) || init?.signal || input instanceof Request) {
            return fetcher(input, init);
        }
        const headers = [...new Headers(init?.headers).entries()].sort(([a], [b]) => a.localeCompare(b));
        const key = JSON.stringify([String(input), method, headers, init?.credentials, init?.cache]);
        let request = pending.get(key);
        if (!request) {
            request = fetcher(input, init);
            pending.set(key, request);
        }
        try {
            return (await request).clone();
        } finally {
            if (pending.get(key) === request) pending.delete(key);
        }
    };
}
