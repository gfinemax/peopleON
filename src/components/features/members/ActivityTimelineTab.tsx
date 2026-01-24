'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import Image from 'next/image';

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

interface ActivityTimelineTabProps {
    memberId: string;
}

export function ActivityTimelineTab({ memberId }: ActivityTimelineTabProps) {
    const [logs, setLogs] = useState<InteractionLog[]>([]);
    const [loading, setLoading] = useState(true);

    // New Log Input State
    const [newLogText, setNewLogText] = useState('');

    useEffect(() => {
        // Mock Data to match the design image
        const mockLogs: InteractionLog[] = [
            {
                id: '1',
                type: 'CALL',
                title: '관리비 문의 (Maintenance Fee)',
                summary: '9월 관리비 내역 중 난방비 과다 청구에 대한 문의가 있었습니다. 계량기 점검 일정을 10월 27일 오후 2시로 예약하였습니다.',
                staff_name: '박지성 매니저',
                created_at: '2023-10-24 14:30',
                attachment: null,
            },
            {
                id: '2',
                type: 'REPAIR',
                title: '세대 내부 수리 건 (Renovation)',
                summary: '욕실 누수 관련 방문 점검 완료. 윗집(1304호) 배관 문제로 확인되어 윗집 소유주와 통화 후 공사 일정 조율하기로 함.',
                staff_name: '김민수 팀장',
                created_at: '2023-10-15 10:00',
                attachment: '현장사진_01.jpg',
            },
            {
                id: '3',
                type: 'SMS',
                title: '미납 안내 발송 (Payment Reminder)',
                summary: '[People On] 9월 관리비 미납 안내입니다. 10월 10일까지 납부 부탁드립니다.',
                staff_name: '시스템 자동발송',
                created_at: '2023-10-01 09:00',
                attachment: null,
            }
        ];

        setLogs(mockLogs);
        setLoading(false);
    }, [memberId]);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'CALL': return { name: 'call', bg: 'bg-[#151f2b] border-[#233040]', bgIcon: 'bg-[#1A2633]', text: 'text-blue-400' };
            case 'REPAIR': return { name: 'engineering', bg: 'bg-[#151f2b] border-[#233040]', bgIcon: 'bg-[#1A2633]', text: 'text-purple-400' };
            case 'SMS': return { name: 'sms', bg: 'bg-[#151f2b] border-[#233040]', bgIcon: 'bg-[#1A2633]', text: 'text-emerald-400' };
            default: return { name: 'edit', bg: 'bg-[#151f2b] border-[#233040]', bgIcon: 'bg-[#1A2633]', text: 'text-gray-400' };
        }
    };

    return (
        <div className="flex flex-col gap-8 pb-4">

            {/* 1. New Activity Input Area */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <MaterialIcon name="edit_note" className="text-blue-400" size="sm" />
                    </div>
                    <h3 className="text-sm font-bold text-white">새로운 활동 기록</h3>
                    <div className="ml-auto">
                        <span className="text-[10px] font-bold text-gray-500 bg-[#151f2b] px-2 py-1 rounded border border-white/5">오늘, 10월 26일</span>
                    </div>
                </div>

                <div className="relative group">
                    <textarea
                        className="w-full h-32 bg-[#151f2b] rounded-xl border border-white/5 p-4 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none transition-all"
                        placeholder="상담 내용이나 메모를 입력하세요..."
                        value={newLogText}
                        onChange={(e) => setNewLogText(e.target.value)}
                    />
                    <div className="absolute right-3 bottom-3 flex items-center gap-2">
                        <button className="p-2 rounded-full hover:bg-white/5 text-gray-500 hover:text-white transition-colors" title="음성 입력">
                            <MaterialIcon name="mic" size="sm" />
                        </button>
                        {newLogText && (
                            <button className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors">
                                저장
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Timeline List */}
            <div className="flex flex-col gap-4">
                {logs.map((log) => {
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
                })}
            </div>

            {/* 3. Load More */}
            <div className="flex justify-center pt-4">
                <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#151f2b] border border-white/5 text-xs font-bold text-gray-500 hover:text-white hover:bg-[#1A2633] transition-all">
                    <MaterialIcon name="history" size="xs" />
                    이전 기록 3건 더 보기...
                </button>
            </div>

        </div>
    );
}
