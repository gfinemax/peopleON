/** Share a concurrent cache fill; release both successful and failed results. */
export function singleFlight<T>(load: () => Promise<T>): () => Promise<T> {
    let pending: Promise<T> | undefined;
    return () => {
        if (!pending) {
            pending = Promise.resolve().then(load).finally(() => { pending = undefined; });
        }
        return pending;
    };
}
