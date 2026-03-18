'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MaterialIcon } from '@/components/ui/icon';
import { useState } from 'react';

const menuItems = [
    { name: '대시보드', href: '/', icon: 'dashboard' },
    { name: '조합원 관리', href: '/members', icon: 'group' },
    { name: '분담금 관리', href: '/payments', icon: 'payments' },
    { name: '정산/환불', href: '/settlements', icon: 'currency_exchange' },
    { name: '활동 타임라인', href: '/timeline', icon: 'history' },
    { name: '부가관리기능', href: '/sms', icon: 'send' },
    { name: '중복 인물 관리', href: '/admin/duplicates', icon: 'person_search' },
    { name: '감사 로그 (Admin)', href: '/admin/audit', icon: 'admin_panel_settings' },
];

export function Sidebar() {
    const pathname = usePathname();
    // Default to unpinned (collapsed) unless the user manually pins it. Since we don't persist it yet, we'll start with false.
    const [isPinned, setIsPinned] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const isDetailPage = pathname.startsWith('/members/') && pathname !== '/members';
    
    // Sidebar is collapsed if it's neither pinned nor hovered.
    // However, on detail pages, we might want to prioritize space unless hovered.
    const isCollapsed = isDetailPage ? !isHovered : !isPinned && !isHovered;

    return (
        <aside
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                "hidden flex-col border-r border-sidebar-border bg-sidebar md:flex h-screen sticky top-0 z-50 overflow-y-auto transition-all duration-300 ease-in-out",
                isCollapsed ? "w-16" : "w-44 shadow-2xl border-r-0 md:shadow-none md:border-r" // Added shadow when expanded over content but wait, width change pushes content automatically.
            )}
        >
            <div className={cn("flex min-h-full flex-col justify-between p-4 transition-all text-nowrap", isCollapsed && "px-3")}>
                <div className="flex flex-col gap-6 flex-1">
                    {/* Brand & Toggle */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 px-1 overflow-hidden relative">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-lg shadow-primary/20 flex-shrink-0 transition-transform duration-300">
                                <MaterialIcon name="apartment" size="md" />
                            </div>
                            
                            {!isCollapsed && (
                                <>
                                    <div className="flex flex-col flex-1 overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300 pr-6">
                                        <h1 className="text-base font-bold leading-none tracking-tight text-foreground truncate">
                                            People On
                                        </h1>
                                        <p className="mt-1 text-[10px] font-bold text-muted-foreground/40 truncate uppercase tracking-wider">
                                            통합 관리 시스템
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setIsPinned(!isPinned)}
                                        className="absolute right-0 p-1 rounded-md text-muted-foreground hover:text-foreground opacity-50 hover:opacity-100 transition-all hover:bg-white/5 active:scale-95"
                                        title={isPinned ? "고정 해제" : "사이드바 고정"}
                                    >
                                        <MaterialIcon
                                            name="push_pin"
                                            size="sm"
                                            className={cn("transition-transform", !isPinned && "rotate-45")}
                                            filled={isPinned}
                                        />
                                    </button>
                                </>
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


                </div>
            </div>
        </aside>
    );
}
