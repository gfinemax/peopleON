import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DebugPage() {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let connectionResult = 'Not tested';
    let connectionError = null;
    let details = '';

    try {
        const supabase = await createClient();
        // Force a REAL network request (HEAD request to count members)
        const { count, error } = await supabase.from('members').select('*', { count: 'exact', head: true });

        if (error) {
            connectionResult = 'Failed (Supabase Error)';
            connectionError = error.message;
            details = JSON.stringify(error, null, 2);
        } else {
            connectionResult = 'Success';
            details = `Connected to Supabase successfully. Member count access: ${count ?? 'Allowed'}`;
        }
    } catch (e: any) {
        connectionResult = 'Exception (Network/Config)';
        connectionError = e.message;
        details = e.stack || JSON.stringify(e);
    }

    return (
        <div className="p-8 text-white bg-slate-950 min-h-screen font-mono whitespace-pre-wrap">
            <h1 className="text-3xl font-bold mb-6 text-blue-400">Environment Debugger</h1>

            <div className="space-y-4">
                <div className="p-4 border border-white/10 rounded bg-white/5">
                    <h2 className="text-xl font-bold mb-2 text-yellow-400">Environment Variables</h2>

                    <div className="grid grid-cols-[200px_1fr] gap-2">
                        <div className="opacity-50">NEXT_PUBLIC_SUPABASE_URL</div>
                        <div className={sbUrl ? 'text-green-400' : 'text-red-500'}>
                            {sbUrl ? `✅ Present (${sbUrl.length} chars)` : '❌ MISSING'}
                        </div>

                        <div className="opacity-50">Value Preview</div>
                        <div>{sbUrl ? `"${sbUrl.substring(0, 15)}..."` : '-'}</div>

                        <div className="h-px bg-white/10 col-span-2 my-2"></div>

                        <div className="opacity-50">NEXT_PUBLIC_SUPABASE_ANON_KEY</div>
                        <div className={sbKey ? 'text-green-400' : 'text-red-500'}>
                            {sbKey ? `✅ Present (${sbKey.length} chars)` : '❌ MISSING'}
                        </div>

                        <div className="opacity-50">Value Preview</div>
                        <div>{sbKey ? `"${sbKey.substring(0, 10)}..."` : '-'}</div>
                    </div>
                </div>

                <div className="p-4 border border-white/10 rounded bg-white/5">
                    <h2 className="text-xl font-bold mb-2 text-pink-400">Connection Test</h2>

                    <div className="mb-2">
                        Status: <span className={connectionResult === 'Success' ? 'text-green-400 font-bold' : 'text-red-500 font-bold'}>{connectionResult}</span>
                    </div>

                    {connectionError && (
                        <div className="bg-red-500/20 p-4 rounded text-red-200 border border-red-500/30">
                            <strong>Error:</strong> {connectionError}
                        </div>
                    )}

                    <div className="mt-4 text-xs opacity-50 bg-black p-4 rounded overflow-auto max-h-[300px]">
                        {details}
                    </div>
                </div>
            </div>
        </div>
    );
}
