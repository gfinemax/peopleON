'use client';

import { useTheme } from 'next-themes';
import { MaterialIcon } from '@/components/ui/icon';

interface HeaderProps {
    title?: string;
    showBreadcrumb?: boolean;
}

export function Header({ title = '통합 대시보드' }: HeaderProps) {
    const { theme, setTheme } = useTheme();

    return (
        <header className="sticky top-0 z-10 flex h-14 w-full items-center justify-between border-b border-border bg-background px-4">
            {/* Left: Title */}
            <div className="flex items-center gap-4">
                {/* Mobile Menu Toggle */}
                <button className="text-muted-foreground hover:text-foreground md:hidden">
                    <MaterialIcon name="menu" size="md" />
                </button>
                <h1 className="text-lg font-bold text-foreground">{title}</h1>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative hidden w-64 md:block">
                    <MaterialIcon
                        name="search"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        size="md"
                    />
                    <input
                        type="text"
                        placeholder="회원 이름 검색..."
                        className="h-8 w-full rounded-md border border-border bg-card/50 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-all"
                    />
                </div>

                {/* Notifications */}
                <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    <MaterialIcon name="notifications" size="sm" filled />
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive border border-background" />
                </button>

                {/* Calendar */}
                <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    <MaterialIcon name="calendar_month" size="sm" />
                </button>
            </div>
        </header>
    );
}
