'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MaterialIcon } from '@/components/ui/icon';

export function MobileNav() {
    const pathname = usePathname();

    const tabs = [
        {
            name: '홈',
            href: '/',
            icon: 'dashboard',
            activeIcon: 'dashboard'
        },
        {
            name: '조합원',
            href: '/members',
            icon: 'person',
            activeIcon: 'person'
        },
        {
            name: '재무',
            href: '/finance',
            icon: 'account_balance',
            activeIcon: 'account_balance'
        },
        {
            name: '타임라인',
            href: '/timeline',
            icon: 'history', // Changed from 'build' (Maintenance) to 'history' (Timeline) to match web structure better, but can revert if maintenance is specific
            activeIcon: 'history'
        },
        {
            name: '프로필',
            href: '/profile', // This might need a real route later
            icon: 'settings',
            activeIcon: 'settings'
        }
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-t border-border px-2 pb-[env(safe-area-inset-bottom)] lg:hidden transition-all duration-300">
            <div className="flex justify-around items-center h-16">
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href;
                    return (
                        <Link
                            key={tab.name}
                            href={tab.href}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors group active:scale-95",
                                isActive
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <span className={cn(
                                "transition-transform duration-200",
                                isActive ? "scale-110" : "group-hover:scale-110"
                            )}>
                                <MaterialIcon
                                    name={tab.icon}
                                    size="md"
                                    className={isActive ? "filled" : ""}
                                />
                            </span>
                            <span className="text-[10px] font-medium tracking-tight">
                                {tab.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
