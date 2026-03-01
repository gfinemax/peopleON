import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MaterialIcon } from '@/components/ui/icon';

export default async function AuditLogsPage() {
    const supabase = await createClient();

    // 1. Verify Authentication & Role
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/login');
    }

    console.log('[DEBUG] Admin Audit Page - Current user email:', user.email);

    // Role Check: In this example, only gfinemax@gmail.com can access.
    // In production, this might check a user_roles table
    const isAdmin = user?.email === 'gfinemax@gmail.com';

    if (!isAdmin) {
        // Redirect non-admins out of this page
        redirect('/');
    }

    // 2. Fetch Audit Logs
    // Note: This relies on the RLS policy ensuring only admins can select from system_audit_logs.
    // Even if we query here, if RLS fails, we get 0 rows or an error.
    const { data: logs, error: logsError } = await supabase
        .from('system_audit_logs')
        .select(`
            *,
            account_entities(display_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

    if (logsError) {
        console.error('Audit logs fetch error:', logsError);
    }

    const formatActionType = (type: string) => {
        switch (type) {
            case 'UPDATE_ASSET_RIGHTS': return '권리증 수정';
            case 'UPDATE_MEMBER_INFO': return '회원정보 수정';
            case 'UPDATE_MULTIPLE_MEMBERS_INFO': return '다수 회원 일괄 수정';
            default: return type;
        }
    };

    const generateActionSummary = (log: any) => {
        try {
            if (!log.details) return null;

            if (log.action_type === 'UPDATE_ASSET_RIGHTS') {
                const rights = log.details.rightsInfo;
                if (Array.isArray(rights)) {
                    if (rights.length === 0) return '권리증 전체 삭제됨';
                    const certs = rights.map((r: any) => r.right_number || '번호없음').join(', ');
                    return `권리증 ${rights.length}건: ${certs}`;
                }
            } else if (log.action_type === 'UPDATE_MEMBER_INFO') {
                if (log.details.updates) {
                    const keys = Object.keys(log.details.updates);
                    if (keys.length > 0) {
                        return `${keys.length}개 필드 업데이트: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ' 외' : ''}`;
                    }
                }
            } else if (log.action_type === 'UPDATE_MULTIPLE_MEMBERS_INFO') {
                if (Array.isArray(log.details.entity_ids)) {
                    return `조합원 ${log.details.entity_ids.length}명 일괄 업데이트`;
                }
            }
            return null;
        } catch (e) {
            return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden p-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="size-10 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                    <MaterialIcon name="admin_panel_settings" className="text-red-400" size="md" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        시스템 감사 로그 (Audit Logs)
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-wider">
                            Super Admin Only
                        </span>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        시스템 내 민감한 정보 열람 및 변경 내역을 안전하게 기록하고 모니터링합니다.
                    </p>
                </div>
            </div>

            <div className="bg-[#151f2b] border border-white/5 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-500 uppercase bg-[#1A2633] border-b border-white/5 sticky top-0 z-10">
                            <tr>
                                <th scope="col" className="px-4 py-3 font-bold tracking-wider whitespace-nowrap w-[130px] min-w-[130px]">발생 일시 / IP</th>
                                <th scope="col" className="px-4 py-3 font-bold tracking-wider whitespace-nowrap w-[200px] min-w-[200px]">대상 조합원 / 행위자</th>
                                <th scope="col" className="px-4 py-3 font-bold tracking-wider whitespace-nowrap w-[180px] min-w-[180px]">액션 종류 및 요약</th>
                                <th scope="col" className="w-full px-4 py-3 font-bold tracking-wider">상세 내용 (JSON)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {!logs || logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        <MaterialIcon name="history_toggle_off" size="xl" className="opacity-50 mx-auto mb-3" />
                                        기록된 감사 로그가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log: any) => {
                                    const summary = generateActionSummary(log);
                                    return (
                                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors align-top">
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-1 text-[11px] text-gray-500 font-mono">
                                                    <span>{new Date(log.created_at).toLocaleDateString('ko-KR')}</span>
                                                    <span className="text-gray-400">{new Date(log.created_at).toLocaleTimeString('ko-KR')}</span>
                                                    <span className="text-[10px] text-gray-600 mt-1">{log.ip_address}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-xs">
                                                <div className="flex flex-col gap-2">
                                                    {log.target_entity_id ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-bold text-white whitespace-nowrap text-sm">{log.account_entities?.display_name || 'Altered Member'}</span>
                                                            </div>
                                                            <span className="text-[10px] font-mono text-gray-500 break-all leading-normal max-w-[200px]">{log.target_entity_id}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-600 italic whitespace-nowrap font-medium">다수 조합원 / 시스템 대상</span>
                                                    )}

                                                    <div className="flex items-center gap-1.5 mt-1 pt-2 border-t border-white/5">
                                                        <MaterialIcon name="person" size="sm" className="text-gray-500" />
                                                        <span className="text-blue-400/80 font-mono text-[11px] break-all">{log.actor_email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 pt-4">
                                                <div className="flex flex-col items-start gap-2">
                                                    <span className="px-2.5 py-1 rounded bg-[#1A2633] text-gray-300 font-bold text-[11px] tracking-wide border border-white/5 inline-block whitespace-nowrap">
                                                        {formatActionType(log.action_type)}
                                                    </span>
                                                    {summary && (
                                                        <div className="text-[11px] text-emerald-400/80 bg-emerald-500/10 px-2 py-1.5 rounded-md border border-emerald-500/20 max-w-full break-all leading-relaxed">
                                                            {summary}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 w-full">
                                                <div className="bg-[#0F151B] p-3 rounded-md border border-white/5 text-[11px] font-mono whitespace-pre-wrap max-h-[160px] overflow-y-auto w-full custom-scrollbar leading-relaxed text-blue-100/70 shadow-inner">
                                                    {JSON.stringify(log.details, null, 2)}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
