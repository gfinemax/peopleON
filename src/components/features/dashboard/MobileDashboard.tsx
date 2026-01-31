'use client';

import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useState } from 'react';

export interface DashboardStats {
    totalMembers: number;
    totalAmount: number;     // Total expected from payments
    collectedAmount: number; // Total collected
    paymentRate: number;     // Percentage
}

export interface DashboardEvent {
    id: string;
    title: string;
    time: string;
    desc: string;
    type: 'payment' | 'member' | 'issue';
}

interface MobileDashboardProps {
    stats: DashboardStats;
    events: DashboardEvent[];
}

export function MobileDashboard({ stats, events }: MobileDashboardProps) {
    return (
        <div className="flex flex-col min-h-screen bg-background pb-24">
            {/* 1. Header & Search - Sticky */}
            <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm transition-colors border-b border-border/40">
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="size-10 rounded-full bg-muted/20 border-2 border-primary/20 overflow-hidden">
                                <img
                                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin"
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-success ring-2 ring-background"></span>
                        </div>
                        <div>
                            <h2 className="text-xs font-medium text-muted-foreground leading-tight">안녕하세요,</h2>
                            <h1 className="text-lg font-bold leading-tight text-foreground">관리자님</h1>
                        </div>
                    </div>
                    <button className="flex items-center justify-center size-10 rounded-full hover:bg-muted/10 transition-colors relative">
                        <MaterialIcon name="notifications" size="md" className="text-muted-foreground" />
                        <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-destructive border border-background"></span>
                    </button>
                </div>
                <div className="px-4 py-2 pb-3">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MaterialIcon name="search" size="sm" className="text-muted-foreground group-focus-within:text-primary transition-colors" />
                        </div>
                        <input
                            className="block w-full pl-10 pr-3 py-3 border-none rounded-xl leading-5 bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm transition-all font-medium text-sm"
                            placeholder="조합원, 동호수 검색..."
                            type="text"
                        />
                    </div>
                </div>
            </header>

            {/* 2. Key Metrics Cards */}
            <div className="p-4 space-y-4">
                <div className="flex items-center justify-between px-1">
                    <div>
                        <span className="text-[10px] font-bold tracking-wider text-primary uppercase mb-0.5 block">현재 사업장</span>
                        <h3 className="text-xl font-extrabold tracking-tight text-foreground">그린밸리 조합</h3>
                    </div>
                    <button className="text-[10px] font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors">
                        변경
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {/* Total Members */}
                    <div className="bg-card p-4 rounded-xl shadow-sm border border-border/50 flex flex-col justify-between h-32 relative overflow-hidden group">
                        <div className="absolute right-[-10px] top-[-10px] bg-primary/5 h-20 w-20 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                        <div className="relative z-10">
                            <div className="inline-flex p-1.5 rounded-lg bg-primary/10 text-primary mb-2">
                                <MaterialIcon name="groups" size="sm" />
                            </div>
                            <p className="text-xs font-bold text-muted-foreground">전체 조합원</p>
                        </div>
                        <p className="text-3xl font-black relative z-10 text-foreground">{stats.totalMembers.toLocaleString()}</p>
                    </div>

                    {/* Issues Card */}
                    <div className="bg-card p-4 rounded-xl shadow-sm border border-border/50 flex flex-col justify-between h-32 relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-1 bg-orange-500"></div>
                        <div>
                            <div className="inline-flex p-1.5 rounded-lg bg-orange-500/10 text-orange-500 mb-2">
                                <MaterialIcon name="warning" size="sm" />
                            </div>
                            <p className="text-xs font-bold text-muted-foreground">진행 중 이슈</p>
                        </div>
                        <div className="flex items-end gap-2">
                            <p className="text-3xl font-black text-foreground">3</p>
                            <span className="text-[10px] font-black text-orange-500 mb-1.5 uppercase">긴급</span>
                        </div>
                    </div>
                </div>

                {/* Payment Status Card */}
                <div className="bg-card p-5 rounded-xl shadow-sm border border-border/50">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <MaterialIcon name="payments" size="sm" className="text-success" />
                            <h4 className="font-bold text-sm text-foreground">납부 현황</h4>
                        </div>
                        <span className="text-sm font-black text-foreground">{stats.paymentRate}% <span className="text-muted-foreground font-medium text-xs">수납 완료</span></span>
                    </div>
                    <div className="w-full bg-muted/30 rounded-full h-2.5 mb-3 overflow-hidden">
                        <div className="bg-primary h-full rounded-full relative" style={{ width: `${stats.paymentRate}%` }}>
                            <div className="absolute inset-0 bg-white/20 w-full h-full animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"></div>
                        </div>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                        <span>₩{(stats.collectedAmount / 100000000).toFixed(1)}억 수납</span>
                        <span>₩{((stats.totalAmount - stats.collectedAmount) / 100000000).toFixed(1)}억 미납</span>
                    </div>
                </div>
            </div>

            {/* 3. Feeds Section */}
            <div className="px-4 mb-6">
                <div className="flex items-center justify-between mb-4 mt-2">
                    <h3 className="text-lg font-extrabold text-foreground">최근 활동</h3>
                    <button className="text-xs text-primary font-bold hover:underline">더 보기</button>
                </div>

                <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50">
                    <div className="relative pl-2">
                        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border/40"></div>

                        {events.length > 0 ? events.map((event, i) => (
                            <TimelineItem
                                key={event.id}
                                title={event.title}
                                time={event.time}
                                desc={event.desc}
                                color={event.type === 'payment' ? 'bg-success' : event.type === 'issue' ? 'bg-destructive' : 'bg-primary'}
                            />
                        )) : (
                            <div className="py-4 text-center text-xs text-muted-foreground">
                                최근 활동 내역이 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Floating Action Button */}
            <button className="fixed right-4 bottom-24 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 hover:bg-primary-hover transition-all active:scale-90">
                <MaterialIcon name="add" size="lg" />
            </button>
        </div>
    );
}

function TimelineItem({ title, time, desc, color }: any) {
    return (
        <div className="relative flex gap-4 mb-6 last:mb-0 group">
            <div className="relative z-10 mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-card ring-2 ring-border">
                <div className={cn("h-2 w-2 rounded-full", color)}></div>
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm text-foreground">{title}</h4>
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded">{time}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-medium">{desc}</p>
            </div>
        </div>
    );
}

function ActivityCard({ initials, icon, img, bg, text, name, detail, badge, badgeColor }: any) {
    return (
        <div className="flex items-center gap-3 bg-card p-3 rounded-xl shadow-sm border border-border/50 active:scale-[0.98] transition-transform cursor-pointer">
            <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden", bg)}>
                {img ? (
                    <img src={img} alt={name} className="w-full h-full object-cover" />
                ) : icon ? (
                    <MaterialIcon name={icon} size="sm" className={text} />
                ) : (
                    <span className={cn("font-bold text-sm", text)}>{initials}</span>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold truncate text-foreground">{name}</h4>
                <p className="text-xs text-muted-foreground truncate font-medium">{detail}</p>
            </div>
            <div className="shrink-0">
                <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold ring-1 ring-inset", badgeColor)}>
                    {badge}
                </span>
            </div>
        </div>
    );
}
