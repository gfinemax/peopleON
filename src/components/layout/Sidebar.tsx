'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MaterialIcon } from '@/components/ui/icon';
import { useEffect, useState } from 'react';

const menuItems = [
    { name: '대시보드', href: '/', icon: 'dashboard' },
    { name: '조합원 관리', href: '/members', icon: 'group' },
    { name: '분담금 관리', href: '/payments', icon: 'payments' },
    { name: '정산/환불', href: '/settlements', icon: 'currency_exchange' },
    { name: '활동 타임라인', href: '/timeline', icon: 'history' },
    { name: '부가관리기능', href: '/sms', icon: 'send' },
    { name: '중복 인물 관리', href: '/admin/duplicates', icon: 'person_search' },
    { name: '계정 권한 관리', href: '/admin/users', icon: 'manage_accounts' },
    { name: '감사 로그 (Admin)', href: '/admin/audit', icon: 'admin_panel_settings' },
];

export function Sidebar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        const frameId = window.requestAnimationFrame(() => {
            const savedState = window.localStorage.getItem('peopleon-sidebar-collapsed');
            if (savedState) {
                setIsCollapsed(savedState === 'true');
            }
        });

        return () => window.cancelAnimationFrame(frameId);
    }, []);

    const toggleSidebar = () => {
        setIsCollapsed((current) => {
            const next = !current;
            window.localStorage.setItem('peopleon-sidebar-collapsed', String(next));
            return next;
        });
    };

    return (
        <>
            <aside
                className={cn(
                    "hidden flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl md:flex h-screen sticky top-0 z-50 overflow-hidden transition-[width,box-shadow,border-color] duration-300 ease-in-out",
                    isCollapsed
                        ? "w-0 border-r-0 shadow-none"
                        : "w-44 border-r shadow-2xl md:shadow-none"
                )}
            >
                <div
                    className={cn(
                        "flex min-h-full flex-col justify-between p-4 text-nowrap transition-[opacity,transform,visibility] duration-200 ease-out",
                        isCollapsed && "pointer-events-none invisible -translate-x-3 opacity-0"
                    )}
                    aria-hidden={isCollapsed}
                >
                    <div className="flex flex-col gap-6 flex-1">
                        {/* Brand & Toggle */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3 px-1 overflow-hidden relative">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-success to-primary text-white shadow-lg shadow-primary/20 flex-shrink-0 transition-transform duration-300">
                                    <MaterialIcon name="apartment" size="md" />
                                </div>

                                {!isCollapsed && (
                                    <div className="flex flex-col flex-1 overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300 pr-2">
                                        <h1 className="text-base font-bold leading-none tracking-tight text-foreground truncate">
                                            People On
                                        </h1>
                                        <p className="mt-1 text-[10px] font-bold text-muted-foreground/40 truncate uppercase tracking-wider">
                                            통합 관리 시스템
                                        </p>
                                    </div>
                                )}
                            </div>
                            {/* The large collapse button block is removed */}
                        </div>

                        {/* Navigation */}
                        <nav className="flex flex-col gap-1.5">
                            {menuItems.map((item) => {
                                const isActive = pathname === item.href ||
                                    (item.href !== '/' && pathname.startsWith(item.href));

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        title={isCollapsed ? item.name : undefined}
                                        className={cn(
                                            "group flex items-center rounded-lg transition-all duration-200",
                                            isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                                            isActive
                                                ? "bg-primary/15 text-primary shadow-md shadow-primary/10 ring-1 ring-primary/25"
                                                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                                        )}
                                    >
                                        <MaterialIcon
                                            name={item.icon}
                                            size="sm"
                                            filled={isActive}
                                            className={isActive ? "text-primary" : "group-hover:text-foreground transition-colors"}
                                        />
                                        {!isCollapsed && (
                                            <span className={cn(
                                                "text-[12.5px] font-semibold transition-colors truncate animate-in fade-in slide-in-from-left-1",
                                                isActive ? "text-foreground" : "group-hover:text-foreground"
                                            )}>
                                                {item.name}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col gap-3 pt-6 mt-auto">
                        <Link
                            href="/settings"
                            title={isCollapsed ? "설정" : undefined}
                            className={cn(
                                "group flex items-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all",
                                isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
                            )}
                        >
                            <MaterialIcon name="settings" size="sm" className="group-hover:text-foreground" />
                            {!isCollapsed && <span className="text-[12.5px] font-semibold group-hover:text-foreground animate-in fade-in slide-in-from-left-1">설정</span>}
                        </Link>


                    </div>
                </div>
            </aside>

            {/* Manual sidebar toggle badge */}
            <button
                type="button"
                onClick={toggleSidebar}
                aria-label={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
                aria-expanded={!isCollapsed}
                className={cn(
                    "fixed top-1/2 z-[1100] flex h-[120px] w-[38px] -translate-y-1/2 cursor-pointer flex-col items-center justify-center border border-[#8fe900] bg-[#95ed00] text-[#101725] shadow-[6px_0_14px_rgba(2,6,23,0.28)] transition-[left,width,border-radius,background-color,box-shadow] duration-200 ease-out after:pointer-events-none after:absolute after:inset-y-2 after:-right-3 after:w-3 after:rounded-r-full after:bg-gradient-to-r after:from-black/35 after:to-transparent after:content-[''] hover:w-[40px] hover:bg-[#a8ff00] hover:shadow-[8px_0_18px_rgba(2,6,23,0.34)] focus-visible:ring-2 focus-visible:ring-[#101725]/30 focus-visible:ring-offset-2",
                    isCollapsed ? "left-0 rounded-r-[12px] border-l-0" : "left-44 rounded-r-[12px] border-l-0",
                    isCollapsed && "shadow-[6px_0_16px_rgba(2,6,23,0.32)]"
                )}
                title={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            >
                <div className="flex flex-col items-center gap-1.5">
                    <MaterialIcon
                        name={isCollapsed ? "chevron_right" : "chevron_left"}
                        size="sm"
                        className="stroke-[3]"
                    />
                    <span
                        style={{ writingMode: 'vertical-rl' }}
                        className="text-[11px] font-black uppercase leading-none tracking-[0.14em]"
                    >
                        {isCollapsed ? 'SIDEBAR' : 'WIDE'}
                    </span>
                </div>
            </button>
        </>
    );
}
