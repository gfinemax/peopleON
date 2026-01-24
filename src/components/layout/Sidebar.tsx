'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MaterialIcon } from '@/components/ui/icon';
import { signOut } from '@/app/actions/auth';
import { useState, useEffect } from 'react';

const menuItems = [
    { name: '대시보드', href: '/', icon: 'dashboard' },
    { name: '회원 관리', href: '/members', icon: 'group' },
    { name: '분담금 관리', href: '/payments', icon: 'payments' },
    { name: '권리/환불 관리', href: '/finance', icon: 'account_balance' },
    { name: '활동 타임라인', href: '/timeline', icon: 'history' },
    { name: '대량 문자 발송', href: '/sms', icon: 'send' },
];

export function Sidebar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Auto-collapse on member detail page
    useEffect(() => {
        const isDetailPage = pathname.startsWith('/members/') && pathname !== '/members';
        if (isDetailPage) {
            setIsCollapsed(true);
        } else {
            setIsCollapsed(false);
        }
    }, [pathname]);

    return (
        <aside
            className={cn(
                "hidden flex-col border-r border-sidebar-border bg-sidebar md:flex h-screen sticky top-0 z-20 overflow-y-auto transition-all duration-300 ease-in-out",
                isCollapsed ? "w-16" : "w-44"
            )}
        >
            <div className={cn("flex min-h-full flex-col justify-between p-4 transition-all text-nowrap", isCollapsed && "px-3")}>
                <div className="flex flex-col gap-6 flex-1">
                    {/* Brand & Toggle */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3 px-1 overflow-hidden">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-lg shadow-primary/20 flex-shrink-0 transition-transform duration-300">
                                <MaterialIcon name="apartment" size="md" />
                            </div>
                            {!isCollapsed && (
                                <div className="flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300">
                                    <h1 className="text-base font-bold leading-none tracking-tight text-foreground truncate">
                                        People On
                                    </h1>
                                    <p className="mt-1 text-[10px] font-bold text-muted-foreground/40 truncate uppercase tracking-wider">
                                        통합 관리 시스템
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Collapse Toggle Button */}
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="flex items-center justify-center p-1.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 text-muted-foreground hover:text-foreground transition-all hover:bg-sidebar-accent mx-1"
                            title={isCollapsed ? "펼치기" : "접기"}
                        >
                            <MaterialIcon
                                name={isCollapsed ? "chevron_right" : "chevron_left"}
                                size="sm"
                                className="transition-transform duration-300"
                            />
                        </button>
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
                                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                                    )}
                                >
                                    <MaterialIcon
                                        name={item.icon}
                                        size="sm"
                                        filled={isActive}
                                        className={isActive ? "text-primary-foreground" : "group-hover:text-foreground transition-colors"}
                                    />
                                    {!isCollapsed && (
                                        <span className={cn(
                                            "text-[12.5px] font-semibold transition-colors truncate animate-in fade-in slide-in-from-left-1",
                                            isActive ? "text-primary-foreground" : "group-hover:text-foreground"
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

                    {/* User Profile */}
                    <div
                        className={cn(
                            "flex items-center rounded-lg bg-sidebar-accent/60 border border-sidebar-border/50 hover:bg-sidebar-accent transition-colors overflow-hidden relative",
                            isCollapsed ? "flex-col p-2 gap-2" : "gap-2 p-2"
                        )}
                    >
                        <div
                            className="size-7 overflow-hidden rounded-full border border-sidebar-border bg-sidebar-accent flex items-center justify-center flex-shrink-0"
                        >
                            <MaterialIcon name="person" size="xs" className="text-muted-foreground" />
                        </div>
                        {!isCollapsed && (
                            <div className="flex flex-col overflow-hidden flex-1 animate-in fade-in slide-in-from-left-1">
                                <p className="truncate text-xs font-bold text-foreground">김관리</p>
                                <p className="truncate text-[9px] text-muted-foreground/40 font-mono tracking-tighter">admin@peopleon...</p>
                            </div>
                        )}
                        <form action={signOut} className={isCollapsed ? "w-full" : ""}>
                            <button
                                type="submit"
                                title="로그아웃"
                                className={cn(
                                    "flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
                                    isCollapsed ? "w-full p-1.5" : "p-1"
                                )}
                            >
                                <MaterialIcon name="logout" size="sm" />
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </aside>
    );
}
