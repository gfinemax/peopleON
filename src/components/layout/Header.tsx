'use client';

import { useTheme } from 'next-themes';
import { MaterialIcon } from '@/components/ui/icon';
import { signOut } from '@/app/actions/auth';
import { GlobalSearch } from '@/components/features/search/GlobalSearch';

interface HeaderProps {
    title?: string;
    showBreadcrumb?: boolean;
}

export function Header({ title = '통합 대시보드' }: HeaderProps) {
    const { theme, setTheme } = useTheme();
    // useRouter and state removed as GlobalSearch handles it

    return (
        <header className="sticky top-0 z-10 flex h-14 w-full items-center justify-between border-b border-border bg-background px-4">
            {/* Left: Title */}
            {/* Left: Search & Menu */}
            <div className="flex items-center gap-4">
                {/* Mobile Menu Toggle */}
                <button className="text-muted-foreground hover:text-foreground md:hidden">
                    <MaterialIcon name="menu" size="md" />
                </button>
                {/* Global Search (Moved from Right) */}
                <GlobalSearch />
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-4">


                {/* Notifications */}
                <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    <MaterialIcon name="notifications" size="sm" filled />
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive border border-background" />
                </button>

                {/* Users Profile */}
                <div className="flex items-center gap-3 pl-2 ml-2 border-l border-border/50">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-xs font-bold text-foreground">김관리</span>
                        <span className="text-[10px] text-muted-foreground/60 font-mono tracking-tight">admin@peopleon.com</span>
                    </div>
                    <div className="size-8 rounded-full bg-muted/50 border border-border flex items-center justify-center">
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
