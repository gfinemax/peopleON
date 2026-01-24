'use client';

import { useState } from 'react';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { ActivityTimelineTab } from './ActivityTimelineTab';
import { LegacyHistoryCard } from './LegacyHistoryCard';

interface MemberDetailRightPanelProps {
    memberId: string;
    legacyRecords: any[];
}

type TabType = 'activity' | 'financials' | 'documents';

export function MemberDetailRightPanel({ memberId, legacyRecords }: MemberDetailRightPanelProps) {
    const [activeTab, setActiveTab] = useState<TabType>('activity');

    const tabs = [
        { id: 'activity' as TabType, label: '활동 이력 (Activity)', icon: 'history' },
        { id: 'financials' as TabType, label: '재정 현황 (Financials)', icon: 'payments' },
        { id: 'documents' as TabType, label: '관련 문서 (Documents)', icon: 'folder_open' },
    ];

    return (
        <div className="flex-1 flex flex-col min-h-0 relative px-0 pb-0 bg-transparent">
            {/* 1. Tab Navigation & Top Actions */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-end mb-4 px-4 sm:px-0">
                <div className="flex gap-2 ml-auto">
                    <button className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-[11px] font-black text-foreground hover:bg-muted/10 transition-all uppercase tracking-widest shadow-sm">
                        <MaterialIcon name="edit_square" size="sm" />
                        프로필 수정
                    </button>
                    <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-[11px] font-black text-foreground hover:bg-muted/10 transition-all uppercase tracking-widest shadow-sm">
                        <MaterialIcon name="picture_as_pdf" size="sm" />
                        PDF 내보내기
                    </button>
                    <button className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-5 py-2.5 text-[11px] font-black text-destructive hover:bg-destructive/20 transition-all uppercase tracking-widest">
                        <MaterialIcon name="block" size="sm" />
                        비활성화
                    </button>
                </div>
            </div>

            {/* 2. Folder Tabs */}
            <div className="flex items-end px-4 relative z-10">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "relative group flex items-center justify-center min-w-[140px] pb-3 px-6 outline-none transition-all",
                                isActive ? "pt-3.5 z-20" : "pt-4 text-gray-500 hover:text-gray-300 z-10"
                            )}
                        >
                            {isActive ? (
                                <>
                                    {/* Active Tab Backgrounds */}
                                    <div className="absolute bottom-0 -left-4 w-4 h-4 z-10 pointer-events-none"
                                        style={{ background: 'radial-gradient(circle at top left, transparent 16px, #1A2633 16.5px)' }} />
                                    <div className="absolute inset-0 bg-[#1A2633] rounded-t-xl z-0 shadow-[-1px_-1px_0_rgba(255,255,255,0.05)]" />

                                    {/* LIGHTING EFFECT (Blue Gradient Line) */}
                                    <div className="absolute top-0 left-2 right-2 h-[2px] bg-gradient-to-r from-blue-400/0 via-blue-400 to-blue-400/0 opacity-70 z-20" />

                                    <div className="absolute bottom-0 -right-4 w-4 h-4 z-10 pointer-events-none"
                                        style={{ background: 'radial-gradient(circle at top right, transparent 16px, #1A2633 16.5px)' }} />

                                    {/* Active Content */}
                                    <div className="relative z-20 flex items-center gap-2">
                                        <MaterialIcon
                                            name={tab.icon}
                                            className="text-[18px] text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                        />
                                        <p className="text-white text-sm font-bold tracking-wide">{tab.label}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Hover Effect */}
                                    <div className="absolute inset-x-2 top-2 bottom-0 rounded-t-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    {/* Inactive Content */}
                                    <div className="relative z-10 flex items-center gap-2">
                                        <MaterialIcon name={tab.icon} className="text-[18px]" />
                                        <p className="text-xs font-semibold">{tab.label}</p>
                                    </div>
                                </>
                            )}
                        </button>
                    );
                })}
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#1A2633] z-0" />
            </div>

            {/* 3. Content Area */}
            <div className="flex-1 bg-[#1A2633] relative z-0 overflow-hidden flex flex-col rounded-b-xl shadow-sm border border-white/5">
                <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-white/10">

                    {activeTab === 'activity' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Legacy History Card */}
                            <LegacyHistoryCard records={legacyRecords || []} />

                            {/* Activity Timeline */}
                            <ActivityTimelineTab memberId={memberId} />
                        </div>
                    )}

                    {activeTab === 'financials' && (
                        <div className="flex items-center justify-center h-64 text-gray-500 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="text-center">
                                <MaterialIcon name="payments" size="xl" className="mb-2 opacity-50" />
                                <p>재정 현황 준비 중...</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'documents' && (
                        <div className="flex items-center justify-center h-64 text-gray-500 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="text-center">
                                <MaterialIcon name="folder_open" size="xl" className="mb-2 opacity-50" />
                                <p>관련 문서 준비 중...</p>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
