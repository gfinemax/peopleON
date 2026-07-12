'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MaterialIcon } from '@/components/ui/icon';
import { cn, formatSafeDateTime } from '@/lib/utils';
import { logInteraction } from '@/app/actions/interaction';

interface InteractionLog {
    id: string;
    type: 'CALL' | 'MEET' | 'SMS' | 'DOC' | 'REPAIR' | 'NOTE';
    title: string;
    summary: string;
    staff_name: string | null;
    attachment: string | null;
    created_at: string;
    tags?: string[];
}

type InteractionLogRow = Partial<InteractionLog> & {
    id: string;
    type?: string | null;
    created_at: string;
};

interface ActivityTimelineTabProps {
    memberIds: string[];
}

const ACTIVITY_TYPES: Array<{ type: InteractionLog['type']; label: string; icon: string; textClass: string; bgClass: string }> = [
    { type: 'NOTE', label: '기타 메모', icon: 'edit_note', textClass: 'text-gray-400', bgClass: 'bg-gray-500/10' },
    { type: 'CALL', label: '전화 상담', icon: 'call', textClass: 'text-blue-400', bgClass: 'bg-blue-500/10' },
    { type: 'MEET', label: '대면 상담', icon: 'groups', textClass: 'text-amber-400', bgClass: 'bg-amber-500/10' },
    { type: 'SMS', label: '문자 기록', icon: 'sms', textClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10' },
    { type: 'DOC', label: '서류 기록', icon: 'description', textClass: 'text-rose-400', bgClass: 'bg-rose-500/10' },
    { type: 'REPAIR', label: '수리 내역', icon: 'engineering', textClass: 'text-purple-400', bgClass: 'bg-purple-500/10' },
];

export function ActivityTimelineTab({ memberIds }: ActivityTimelineTabProps) {
    const [logs, setLogs] = useState<InteractionLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const itemsPerPage = 5;

    // New Log States
    const [newLogText, setNewLogText] = useState('');
    const [activeType, setActiveType] = useState<InteractionLog['type']>('NOTE');
    const [isSaving, setIsSaving] = useState(false);
    const [isListening, setIsListening] = useState(false);

    const recognitionRef = useRef<any>(null);

    // Dynamic Today's Date
    const todayStr = (() => {
        const now = new Date();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        return `오늘, ${month}월 ${date}일`;
    })();

    // Unified & Optimized Log Fetching
    const fetchLogs = useCallback(async (isCancelled: () => boolean = () => false) => {
        setLoading(true);
        const supabase = createClient();

        try {
            // Fetch total count first (only on page 1)
            if (page === 1) {
                const { count } = await supabase
                    .from('interaction_logs')
                    .select('*', { count: 'exact', head: true })
                    .in('entity_id', memberIds);

                if (!isCancelled()) {
                    setTotalCount(count || 0);
                }
            }

            // Fetch paginated data
            const from = (page - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;

            const { data, error } = await supabase
                .from('interaction_logs')
                .select('*')
                .in('entity_id', memberIds)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (isCancelled()) return;

            if (!error && data) {
                const formattedLogs: InteractionLog[] = (data as InteractionLogRow[]).map((d) => ({
                    id: d.id,
                    type: (d.type as InteractionLog['type']) || 'NOTE',
                    title: d.type === 'CALL' ? '전화 상담' :
                        d.type === 'MEET' ? '대면 상담' :
                            d.type === 'SMS' ? '문자 발송' :
                                d.type === 'DOC' ? '서류 기록' :
                                    d.type === 'REPAIR' ? '수리 건' : '기타 메모',
                    summary: d.summary || '',
                    staff_name: d.staff_name || null,
                    created_at: formatSafeDateTime(d.created_at),
                    attachment: null
                }));

                if (page === 1) {
                    setLogs(formattedLogs);
                } else {
                    setLogs(prev => [...prev, ...formattedLogs]);
                }
            }
        } catch (err) {
            console.error('Error fetching interaction logs:', err);
        } finally {
            if (!isCancelled()) {
                setLoading(false);
            }
        }
    }, [memberIds, page]);

    // Single useEffect for Log Loading sync
    useEffect(() => {
        let cancelled = false;
        void fetchLogs(() => cancelled);
        return () => {
            cancelled = true;
        };
    }, [fetchLogs]);

    // Handle Speech-to-Text (STT) with Web Speech API
    const handleSpeechRecognition = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('현재 브라우저에서는 음성 인식을 지원하지 않습니다. Chrome 등 Chromium 계열 브라우저를 권장합니다.');
            return;
        }

        if (isListening) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            setIsListening(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event: any) => {
            const speechToText = event.results[0][0].transcript;
            if (speechToText) {
                setNewLogText(prev => prev ? `${prev} ${speechToText}` : speechToText);
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const handleSaveActivity = async () => {
        if (!newLogText.trim() || isSaving) return;

        setIsSaving(true);
        try {
            const formData = new FormData();
            formData.append('memberId', memberIds[0]); // Primary ID
            formData.append('type', activeType); // Dynamically set active type
            formData.append('direction', 'Inbound');
            formData.append('summary', newLogText.trim());

            const result = await logInteraction({}, formData);
            if (result.success) {
                setNewLogText('');
                setActiveType('NOTE'); // Reset active type to default
                if (page === 1) {
                    await fetchLogs();
                } else {
                    setPage(1);
                }
            } else {
                alert(result.error || '저장에 실패했습니다.');
            }
        } catch (error) {
            console.error('Save activity log error:', error);
            alert('오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'CALL': return { name: 'call', bg: 'bg-[#151f2b] border-[#233040]', bgIcon: 'bg-[#1A2633]', text: 'text-blue-400' };
            case 'MEET': return { name: 'groups', bg: 'bg-[#151f2b] border-[#233040]', bgIcon: 'bg-[#1A2633]', text: 'text-amber-400' };
            case 'SMS': return { name: 'sms', bg: 'bg-[#151f2b] border-[#233040]', bgIcon: 'bg-[#1A2633]', text: 'text-emerald-400' };
            case 'DOC': return { name: 'description', bg: 'bg-[#151f2b] border-[#233040]', bgIcon: 'bg-[#1A2633]', text: 'text-rose-400' };
            case 'REPAIR': return { name: 'engineering', bg: 'bg-[#151f2b] border-[#233040]', bgIcon: 'bg-[#1A2633]', text: 'text-purple-400' };
            default: return { name: 'edit_note', bg: 'bg-[#151f2b] border-[#233040]', bgIcon: 'bg-[#1A2633]', text: 'text-gray-400' };
        }
    };

    return (
        <div className="flex flex-col gap-6 pb-4">

            {/* 1. New Activity Input Area */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <MaterialIcon name="edit_note" className="text-blue-400" size="sm" />
                    </div>
                    <h3 className="text-sm font-bold text-white">새로운 활동 기록</h3>
                    {!loading && (
                        <span className="px-2 py-0.5 rounded-full bg-[#1A2633] text-gray-400 text-[10px] font-bold border border-white/5">
                            총 {totalCount}건
                        </span>
                    )}
                    <div className="ml-auto">
                        <span className="text-[10px] font-bold text-gray-500 bg-[#151f2b] px-2 py-1 rounded border border-white/5">{todayStr}</span>
                    </div>
                </div>

                {/* Activity Type Selector Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {ACTIVITY_TYPES.map((act) => {
                        const isSelected = activeType === act.type;
                        return (
                            <button
                                key={act.type}
                                type="button"
                                onClick={() => setActiveType(act.type)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all shrink-0 cursor-pointer",
                                    isSelected 
                                        ? "bg-blue-600 border-blue-500 text-white shadow-sm"
                                        : "bg-[#151f2b] border-white/5 text-gray-400 hover:text-white hover:border-white/10"
                                )}
                            >
                                <MaterialIcon name={act.icon} className={isSelected ? "text-white" : act.textClass} size="xs" />
                                {act.label}
                            </button>
                        );
                    })}
                </div>

                {/* Textarea Area */}
                <div className="relative group">
                    <textarea
                        className="w-full h-32 bg-[#151f2b] rounded-xl border border-white/5 p-4 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none transition-all"
                        placeholder={`${ACTIVITY_TYPES.find(a => a.type === activeType)?.label || '기록'}에 대한 상담 내용이나 메모를 입력하세요...`}
                        value={newLogText}
                        onChange={(e) => setNewLogText(e.target.value)}
                    />
                    <div className="absolute right-3 bottom-3 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSpeechRecognition}
                            className={cn(
                                "p-2 rounded-full hover:bg-white/5 transition-all cursor-pointer flex items-center justify-center",
                                isListening 
                                    ? "text-red-500 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.3)] animate-pulse" 
                                    : "text-gray-500 hover:text-white"
                            )}
                            title={isListening ? "음성 인식 중지" : "음성 입력 시작 (한국어)"}
                        >
                            <MaterialIcon name={isListening ? "mic_off" : "mic"} size="sm" />
                        </button>
                        {newLogText && (
                            <button
                                type="button"
                                onClick={handleSaveActivity}
                                disabled={isSaving}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer",
                                    isSaving && "opacity-70 cursor-not-allowed"
                                )}
                            >
                                {isSaving ? (
                                    <>
                                        <MaterialIcon name="refresh" size="xs" className="animate-spin" />
                                        저장 중...
                                    </>
                                ) : (
                                    '저장'
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Timeline List */}
            <div className="flex flex-col gap-4">
                {logs.length === 0 && !loading ? (
                    <div className="flex flex-col items-center justify-center py-10 my-4 text-muted-foreground opacity-50 gap-3 border border-dashed border-white/10 rounded-2xl">
                        <MaterialIcon name="history_toggle_off" size="xl" className="text-gray-500" />
                        <p className="text-sm font-bold text-gray-400">등록된 활동 기록이 없습니다.</p>
                    </div>
                ) : (
                    logs.map((log) => {
                        const style = getTypeIcon(log.type);

                        return (
                            <div key={log.id} className="flex gap-4 group">
                                {/* Left Icon Column */}
                                <div className="flex flex-col items-center shrink-0">
                                    <div className={cn(
                                        "size-10 rounded-lg flex items-center justify-center border shadow-sm z-10",
                                        "bg-[#1A2633] border-white/5"
                                    )}>
                                        <MaterialIcon name={style.name} className={style.text} size="sm" />
                                    </div>
                                    {/* Connector Line */}
                                    <div className="w-[1px] h-full bg-gradient-to-b from-white/5 to-transparent my-2" />
                                </div>

                                {/* Right Content Card */}
                                <div className="flex-1 bg-[#151f2b] rounded-xl border border-white/5 p-5 shadow-sm hover:border-white/10 transition-colors relative">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-bold text-white tracking-tight">
                                                {log.title}
                                            </h4>
                                            {log.staff_name && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1A2633] text-gray-400 border border-white/5">
                                                    {log.staff_name}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[11px] font-mono text-gray-600">
                                            {log.created_at}
                                        </span>
                                    </div>

                                    {/* Body */}
                                    <p className="text-sm text-gray-400 leading-relaxed font-normal mb-4 whitespace-pre-wrap">
                                        {log.summary}
                                    </p>

                                    {/* Attachment */}
                                    {log.attachment && (
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0F151B] border border-white/5 w-fit group/file cursor-pointer hover:border-white/10 transition-colors">
                                            <div className="size-8 rounded bg-red-500/10 flex items-center justify-center text-red-400">
                                                <MaterialIcon name="image" size="sm" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-300 group-hover/file:text-white transition-colors">
                                                    {log.attachment}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* 3. Load More */}
            {logs.length < totalCount && (
                <div className="flex justify-center pt-4">
                    <button
                        type="button"
                        onClick={() => setPage(p => p + 1)}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#151f2b] border border-white/5 text-xs font-bold text-gray-500 hover:text-white hover:bg-[#1A2633] transition-all cursor-pointer"
                    >
                        <MaterialIcon name="history" size="xs" />
                        이전 기록 {Math.min(itemsPerPage, totalCount - logs.length)}건 더 보기...
                    </button>
                </div>
            )}
        </div>
    );
}
