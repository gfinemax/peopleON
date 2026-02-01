'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { signOut } from '@/app/actions/auth';

export default function ProfilePage() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            {/* Header - Matching Member Page Style */}
            <Header
                title="프로필"
                iconName="person"
                leftContent={
                    <div className="flex items-center gap-2">
                        <MaterialIcon name="manage_accounts" size="md" className="text-muted-foreground mr-[-2px]" />
                        <span className="text-[19px] font-bold text-foreground">내 프로필</span>
                    </div>
                }
            />

            <main className="flex-1 overflow-y-auto bg-background">
                <div className="pb-24 lg:pb-8 max-w-[800px] mx-auto">

                    {/* 1. Profile Card Section */}
                    <div className="p-4 lg:p-6">
                        <div className="rounded-2xl border border-white/[0.08] bg-[#161B22] p-5 shadow-sm relative overflow-hidden group">
                            {/* Background Decoration */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors"></div>

                            <div className="flex items-center gap-5 relative z-10">
                                <div className="relative">
                                    <div className="size-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border-2 border-white/10 shadow-inner">
                                        <MaterialIcon name="person" size="3xl" className="text-blue-400" />
                                    </div>
                                    <button className="absolute bottom-0 right-0 p-1.5 rounded-full bg-blue-500 text-white shadow-lg hover:bg-blue-400 transition-colors">
                                        <MaterialIcon name="edit" size="xs" />
                                    </button>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h2 className="text-xl font-bold text-white tracking-tight">김관리</h2>
                                        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">
                                            관리자
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-400 font-medium mb-3">admin@peopleon.co.kr</p>

                                    <div className="flex gap-2">
                                        <form action={signOut}>
                                            <button className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/10 transition-colors flex items-center gap-1.5">
                                                <MaterialIcon name="logout" size="sm" />
                                                로그아웃
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Settings Section */}
                    <div className="px-4 lg:px-6 space-y-6">

                        {/* Theme Settings */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 mb-3 px-1 flex items-center gap-1.5">
                                <MaterialIcon name="palette" size="sm" />
                                테마 설정
                            </h3>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { mode: 'light', label: '라이트', icon: 'light_mode', color: 'bg-[#F8FAFC]' },
                                    { mode: 'dark', label: '다크', icon: 'dark_mode', color: 'bg-[#0F172A]' },
                                    { mode: 'system', label: '시스템', icon: 'settings_brightness', color: 'bg-gradient-to-br from-gray-100 to-gray-900' }
                                ].map((item) => (
                                    <button
                                        key={item.mode}
                                        onClick={() => setTheme(item.mode)}
                                        className={cn(
                                            "relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all active:scale-95",
                                            theme === item.mode
                                                ? "bg-[#161B22] border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                                                : "bg-[#161B22]/50 border-white/[0.05] hover:bg-[#161B22]"
                                        )}
                                    >
                                        <div className={cn(
                                            "size-10 rounded-full flex items-center justify-center mb-1",
                                            item.color,
                                            theme === item.mode ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-[#161B22]" : "opacity-70"
                                        )}>
                                            <MaterialIcon name={item.icon} size="md" className={theme === item.mode ? 'text-blue-500' : 'text-gray-400'} />
                                        </div>
                                        <span className={cn(
                                            "text-xs font-bold",
                                            theme === item.mode ? "text-blue-400" : "text-gray-500"
                                        )}>
                                            {item.label}
                                        </span>
                                        {theme === item.mode && (
                                            <div className="absolute top-2 right-2 size-2 rounded-full bg-blue-500 shadow-lg animate-pulse" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Notification Settings */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 mb-3 px-1 flex items-center gap-1.5">
                                <MaterialIcon name="notifications" size="sm" />
                                알림 설정
                            </h3>
                            <div className="rounded-xl border border-white/[0.08] bg-[#161B22] divide-y divide-white/[0.05]">
                                {[
                                    { label: '중요 업데이트 알림', desc: '서비스 점검 및 기능 업데이트', active: true },
                                    { label: '미납자 발생 알림', desc: '새로운 미납 건 발생 시 즉시 알림', active: true },
                                    { label: '신규 가입 알림', desc: '새로운 조합원 가입 시 알림', active: false },
                                ].map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4">
                                        <div>
                                            <p className="text-sm font-bold text-gray-200">{item.label}</p>
                                            <p className="text-[11px] text-gray-500 mt-0.5">{item.desc}</p>
                                        </div>
                                        <button className={cn(
                                            "w-11 h-6 rounded-full transition-colors relative",
                                            item.active ? "bg-blue-500" : "bg-white/10"
                                        )}>
                                            <span className={cn(
                                                "absolute top-1 size-4 rounded-full bg-white transition-all shadow-sm",
                                                item.active ? "left-6" : "left-1"
                                            )} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* App Info */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 mb-3 px-1 flex items-center gap-1.5">
                                <MaterialIcon name="info" size="sm" />
                                앱 정보
                            </h3>
                            <div className="rounded-xl border border-white/[0.08] bg-[#161B22] p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-gray-200">PeopleOn Admin</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">버전 1.0.0 (BETA)</p>
                                </div>
                                <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20">
                                    최신 버전
                                </span>
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
