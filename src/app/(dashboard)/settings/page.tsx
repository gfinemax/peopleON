'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // hydration mismatch 방지
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <Header title="설정" />

            <main className="flex-1 overflow-y-auto bg-background">
                <div className="p-5 lg:p-8 max-w-[800px] mx-auto space-y-5">
                    {/* Page Header */}
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">설정</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            시스템 설정 및 사용자 프로필을 관리합니다.
                        </p>
                    </div>

                    {/* Profile Section */}
                    <div className="rounded-lg border border-border bg-card shadow-sm">
                        <div className="p-4 border-b border-border">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <MaterialIcon name="person" size="sm" className="text-muted-foreground" />
                                프로필 정보
                            </h3>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex items-center gap-4">
                                <div className="size-16 rounded-full bg-muted flex items-center justify-center">
                                    <MaterialIcon name="person" size="xl" className="text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="font-bold text-foreground">김관리</p>
                                    <p className="text-sm text-muted-foreground">시스템 관리자</p>
                                </div>
                                <button className="ml-auto px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-accent transition-colors">
                                    사진 변경
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">이름</label>
                                    <input
                                        type="text"
                                        defaultValue="김관리"
                                        className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">이메일</label>
                                    <input
                                        type="email"
                                        defaultValue="admin@peopleon.co.kr"
                                        className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Theme Section */}
                    <div className="rounded-lg border border-border bg-card shadow-sm">
                        <div className="p-4 border-b border-border">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <MaterialIcon name="palette" size="sm" className="text-muted-foreground" />
                                테마 설정
                            </h3>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-3 gap-4">
                                {/* Light Theme */}
                                <button
                                    onClick={() => setTheme('light')}
                                    className={cn(
                                        "group relative flex flex-col gap-2 text-left transition-all",
                                        theme === 'light' ? "scale-[1.02]" : "hover:scale-[1.01]"
                                    )}
                                >
                                    <div className={cn(
                                        "relative aspect-[4/3] rounded-xl border-2 overflow-hidden bg-[#F8FAFC] p-2 transition-all",
                                        theme === 'light' ? "border-primary ring-2 ring-primary/20" : "border-border group-hover:border-primary/50"
                                    )}>
                                        {/* Mini UI Representation */}
                                        <div className="w-full h-full space-y-1.5 opacity-80">
                                            <div className="w-full h-3 bg-white border border-slate-200 rounded" />
                                            <div className="flex gap-1.5 h-full">
                                                <div className="w-4 h-full bg-white border border-slate-200 rounded" />
                                                <div className="flex-1 space-y-1.5">
                                                    <div className="w-full h-12 bg-white border border-slate-200 rounded shadow-sm" />
                                                    <div className="w-2/3 h-4 bg-slate-100 rounded" />
                                                </div>
                                            </div>
                                        </div>
                                        {theme === 'light' && (
                                            <div className="absolute top-2 right-2 size-5 bg-primary text-white rounded-full flex items-center justify-center shadow-lg">
                                                <MaterialIcon name="check" size="xs" />
                                            </div>
                                        )}
                                    </div>
                                    <span className={cn(
                                        "text-sm font-bold text-center",
                                        theme === 'light' ? "text-primary" : "text-muted-foreground"
                                    )}>라이트 모드</span>
                                </button>

                                {/* Dark Theme */}
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={cn(
                                        "group relative flex flex-col gap-2 text-left transition-all",
                                        theme === 'dark' ? "scale-[1.02]" : "hover:scale-[1.01]"
                                    )}
                                >
                                    <div className={cn(
                                        "relative aspect-[4/3] rounded-xl border-2 overflow-hidden bg-[#0F172A] p-2 transition-all",
                                        theme === 'dark' ? "border-primary ring-2 ring-primary/20" : "border-border group-hover:border-primary/50"
                                    )}>
                                        {/* Mini UI Representation */}
                                        <div className="w-full h-full space-y-1.5 opacity-80">
                                            <div className="w-full h-3 bg-[#1e293b] border border-slate-800 rounded" />
                                            <div className="flex gap-1.5 h-full">
                                                <div className="w-4 h-full bg-[#1e293b] border border-slate-800 rounded" />
                                                <div className="flex-1 space-y-1.5">
                                                    <div className="w-full h-12 bg-[#1e293b] border border-slate-800 rounded shadow-sm" />
                                                    <div className="w-2/3 h-4 bg-slate-800 rounded" />
                                                </div>
                                            </div>
                                        </div>
                                        {theme === 'dark' && (
                                            <div className="absolute top-2 right-2 size-5 bg-primary text-white rounded-full flex items-center justify-center shadow-lg">
                                                <MaterialIcon name="check" size="xs" />
                                            </div>
                                        )}
                                    </div>
                                    <span className={cn(
                                        "text-sm font-bold text-center",
                                        theme === 'dark' ? "text-primary" : "text-muted-foreground"
                                    )}>다크 모드</span>
                                </button>

                                {/* System Theme */}
                                <button
                                    onClick={() => setTheme('system')}
                                    className={cn(
                                        "group relative flex flex-col gap-2 text-left transition-all",
                                        theme === 'system' ? "scale-[1.02]" : "hover:scale-[1.01]"
                                    )}
                                >
                                    <div className={cn(
                                        "relative aspect-[4/3] rounded-xl border-2 overflow-hidden bg-slate-100 transition-all",
                                        theme === 'system' ? "border-primary ring-2 ring-primary/20" : "border-border group-hover:border-primary/50"
                                    )}>
                                        <div className="absolute inset-0 flex">
                                            <div className="flex-1 bg-[#F8FAFC] p-2 flex flex-col gap-1.5">
                                                <div className="w-full h-3 bg-white border border-slate-200 rounded" />
                                                <div className="w-full h-12 bg-white border border-slate-200 rounded" />
                                            </div>
                                            <div className="flex-1 bg-[#0F172A] p-2 flex flex-col gap-1.5">
                                                <div className="w-full h-3 bg-[#1e293b] border border-slate-800 rounded" />
                                                <div className="w-full h-12 bg-[#1e293b] border border-slate-800 rounded" />
                                            </div>
                                        </div>
                                        {theme === 'system' && (
                                            <div className="absolute top-2 right-2 z-10 size-5 bg-primary text-white rounded-full flex items-center justify-center shadow-lg">
                                                <MaterialIcon name="check" size="xs" />
                                            </div>
                                        )}
                                    </div>
                                    <span className={cn(
                                        "text-sm font-bold text-center",
                                        theme === 'system' ? "text-primary" : "text-muted-foreground"
                                    )}>시스템 설정</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Notification Section */}
                    <div className="rounded-lg border border-border bg-card shadow-sm">
                        <div className="p-4 border-b border-border">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <MaterialIcon name="notifications" size="sm" className="text-muted-foreground" />
                                알림 설정
                            </h3>
                        </div>
                        <div className="p-4 space-y-3">
                            {[
                                { label: '이메일 알림', desc: '중요 업데이트 이메일 수신' },
                                { label: '미납 알림', desc: '미납 발생 시 즉시 알림' },
                                { label: '신규 가입 알림', desc: '신규 조합원 가입 시 알림' },
                            ].map((item) => (
                                <div key={item.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                                    <div>
                                        <p className="font-medium text-foreground">{item.label}</p>
                                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                                    </div>
                                    <button className="relative w-11 h-6 bg-muted rounded-full transition-colors">
                                        <span className="absolute left-1 top-1 size-4 bg-muted-foreground rounded-full transition-transform" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Data Section */}
                    <div className="rounded-lg border border-border bg-card shadow-sm">
                        <div className="p-4 border-b border-border">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <MaterialIcon name="database" size="sm" className="text-muted-foreground" />
                                데이터 관리
                            </h3>
                        </div>
                        <div className="p-4 space-y-3">
                            <button className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left">
                                <MaterialIcon name="download" size="md" className="text-muted-foreground" />
                                <div>
                                    <p className="font-medium text-foreground">데이터 내보내기</p>
                                    <p className="text-sm text-muted-foreground">전체 데이터를 엑셀로 다운로드</p>
                                </div>
                            </button>
                            <button className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left">
                                <MaterialIcon name="upload" size="md" className="text-muted-foreground" />
                                <div>
                                    <p className="font-medium text-foreground">데이터 가져오기</p>
                                    <p className="text-sm text-muted-foreground">엑셀 파일에서 데이터 일괄 등록</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end">
                        <button className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold shadow-md hover:bg-[#0f6bd0] transition-colors">
                            변경사항 저장
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
