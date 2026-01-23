'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MaterialIcon } from '@/components/ui/icon';

interface InteractionLog {
    id: string;
    type: string;
    summary: string;
    direction: string | null;
    staff_name: string | null;
    attachment: string | null;
    created_at: string;
}

interface ActivityTimelineTabProps {
    memberId: string;
}

export function ActivityTimelineTab({ memberId }: ActivityTimelineTabProps) {
    const [logs, setLogs] = useState<InteractionLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'CALL' | 'MEET' | 'SMS'>('all');

    useEffect(() => {
        async function fetchLogs() {
            setLoading(true);
            const supabase = createClient();

            let query = supabase
                .from('interaction_logs')
                .select('*')
                .eq('member_id', memberId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (filter !== 'all') {
                query = query.eq('type', filter);
            }

            const { data } = await query;
            setLogs(data || []);
            setLoading(false);
        }

        fetchLogs();
    }, [memberId, filter]);

    const getTypeInfo = (type: string) => {
        switch (type) {
            case 'CALL':
                return { icon: 'phone_in_talk', bg: 'bg-blue-50 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400', label: '전화' };
            case 'MEET':
                return { icon: 'location_on', bg: 'bg-green-50 dark:bg-green-900/30', color: 'text-green-600 dark:text-green-400', label: '방문' };
            case 'SMS':
                return { icon: 'chat_bubble', bg: 'bg-purple-50 dark:bg-purple-900/30', color: 'text-purple-600 dark:text-purple-400', label: '문자' };
            case 'DOC':
                return { icon: 'mail', bg: 'bg-orange-50 dark:bg-orange-900/30', color: 'text-orange-600 dark:text-orange-400', label: '문서' };
            default:
                return { icon: 'info', bg: 'bg-gray-50 dark:bg-gray-900/30', color: 'text-gray-600 dark:text-gray-400', label: '기타' };
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;
        if (diffDays < 7) return `${diffDays}일 전`;
        return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Header with Filter */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">활동 타임라인</h3>
                <div className="flex bg-muted p-1 rounded-lg">
                    {[
                        { value: 'all', label: '전체' },
                        { value: 'CALL', label: '통화' },
                        { value: 'MEET', label: '방문' },
                    ].map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => setFilter(value as typeof filter)}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${filter === value
                                    ? 'bg-card shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-10">
                    <MaterialIcon name="progress_activity" className="animate-spin text-muted-foreground" size="lg" />
                </div>
            )}

            {/* Empty State */}
            {!loading && logs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <MaterialIcon name="history" size="xl" className="mb-2" />
                    <p className="text-sm">활동 이력이 없습니다</p>
                </div>
            )}

            {/* Timeline */}
            {!loading && logs.length > 0 && (
                <div className="relative flex flex-col gap-6 pl-2">
                    <div className="absolute left-[19px] top-2 bottom-4 w-0.5 bg-border" />

                    {logs.map((log, idx) => {
                        const typeInfo = getTypeInfo(log.type);
                        const isLast = idx === logs.length - 1;

                        return (
                            <div key={log.id} className="relative pl-10 group">
                                <div className={`absolute left-0 top-1 size-10 rounded-full ${typeInfo.bg} border border-border flex items-center justify-center z-10`}>
                                    <MaterialIcon name={typeInfo.icon} size="md" className={typeInfo.color} />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="text-sm font-semibold text-foreground">
                                            {log.summary?.split('\n')[0] || typeInfo.label}
                                        </h4>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {formatDate(log.created_at)}
                                        </span>
                                    </div>

                                    {log.summary && log.summary.includes('\n') && (
                                        <p className="text-sm text-muted-foreground">
                                            {log.summary.split('\n').slice(1).join('\n')}
                                        </p>
                                    )}

                                    {log.direction && (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-fit ${log.direction === 'Inbound'
                                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                            }`}>
                                            {log.direction === 'Inbound' ? '수신' : '발신'}
                                        </span>
                                    )}

                                    {log.staff_name && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="size-5 rounded-full bg-primary flex items-center justify-center text-[8px] text-white font-bold">
                                                {log.staff_name.charAt(0)}
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                기록: {log.staff_name}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add New Log Button */}
            <button className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors">
                <MaterialIcon name="add" size="md" />
                <span className="text-sm font-medium">새 활동 기록</span>
            </button>
        </div>
    );
}
