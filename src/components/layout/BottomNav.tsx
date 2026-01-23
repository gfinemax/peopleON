'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, CreditCard, Settings, Plus } from 'lucide-react';

const mobileMenuItems = [
    { name: '홈', href: '/', icon: LayoutDashboard },
    { name: '조합원', href: '/members', icon: Users },
    { name: '현장기록', href: '/quick-action', icon: Plus, isAction: true },
    { name: '자금', href: '/finance', icon: CreditCard },
    { name: '설정', href: '/settings', icon: Settings },
];

export function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border h-16 px-2 flex items-center justify-around z-50 overflow-visible pb-safe transition-colors">
            {mobileMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                if (item.isAction) {
                    return (
                        <button
                            key={item.name}
                            className="relative -top-3 bg-primary text-primary-foreground w-14 h-14 rounded-full shadow-lg flex items-center justify-center border-4 border-card active:scale-95 transition-all"
                        >
                            <Plus className="w-7 h-7" />
                        </button>
                    );
                }

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 flex-1 min-w-0 transition-colors",
                            isActive ? "text-primary" : "text-muted-foreground"
                        )}
                    >
                        <Icon className={cn("w-5 h-5 transition-transform", isActive && "scale-110")} />
                        <span className="text-[10px] font-medium truncate">{item.name}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
