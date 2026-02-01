'use client';

import { useTheme } from 'next-themes';
import { MaterialIcon } from '@/components/ui/icon';
import { signOut } from '@/app/actions/auth';
import { GlobalSearch } from '@/components/features/search/GlobalSearch';

interface HeaderProps {
    title?: string;
    iconName?: string; // New prop for icon
    showBreadcrumb?: boolean;
    leftContent?: React.ReactNode;
}

export function Header({ title = '통합 대시보드', iconName, leftContent }: HeaderProps) {
    const { theme, setTheme } = useTheme();
    // useRouter and state removed as GlobalSearch handles it

    return (
        <header className="sticky top-0 z-10 flex h-auto min-h-14 w-full items-center justify-between border-b border-border bg-background px-4 pt-[calc(env(safe-area-inset-top)+5px)] pb-3 md:pt-0 md:pb-0 md:h-14">
            {/* Left: icon + Title (Mobile/Desktop consistent) */}
            <div className="flex items-center gap-4">
                {/* Mobile Menu Toggle or Custom Content */}
                {leftContent ? (
                    <div className="md:hidden">
                        {leftContent}
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <button className="text-muted-foreground hover:text-foreground md:hidden">
                            <MaterialIcon name="menu" size="md" />
                        </button>
                        {/* Title with Icon */}
                        <div className="flex items-center gap-2">
                            {iconName && (
                                <MaterialIcon name={iconName} size="md" className="text-muted-foreground" />
                            )}
                            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
                        </div>
                    </div>
                )}
                {/* Global Search (Moved from Right) */}
                <GlobalSearch />
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1">
                {/* Notifications */}
                <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    <MaterialIcon name="notifications" size="sm" filled />
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive border border-background" />
                </button>

                {/* Users Profile */}
                <div className="flex items-center gap-1 pl-1 ml-0 border-l border-border/50">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-xs font-bold text-foreground">김관리</span>
                        <span className="text-[10px] text-muted-foreground/60 font-mono tracking-tight">admin@peopleon.com</span>
                    </div>
                    <div className="hidden md:flex size-8 rounded-full bg-muted/50 border border-border items-center justify-center">
                        <MaterialIcon name="person" size="sm" className="text-muted-foreground" />
                    </div>
                    <form action={signOut}>
                        <button
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="로그아웃"
                        >
                            <MaterialIcon name="logout" size="sm" />
                        </button>
                    </form>
                </div>
            </div>
        </header>
    );
}
