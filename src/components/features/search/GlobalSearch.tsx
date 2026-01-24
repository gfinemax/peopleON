'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MaterialIcon } from '@/components/ui/icon';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { searchMembers, SearchResult } from '@/app/actions/members';

export function GlobalSearch() {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [results, setResults] = React.useState<SearchResult[]>([]);
    const [loading, setLoading] = React.useState(false);

    // Debounce search
    React.useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (query.trim()) {
                setLoading(true);
                try {
                    const data = await searchMembers(query);
                    setResults(data);
                } catch (error) {
                    console.error('Search failed', error);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [query]);

    const handleSelect = (id: string) => {
        setOpen(false);
        router.push(`/members/${id}`);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && results.length > 0) {
            handleSelect(results[0].id);
        }
    };

    // Reset state when closed // Changed logic: Don't reset query immediately to allow re-opening with context
    // But for now let's keep it simple.

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <div className="relative hidden w-64 md:block cursor-pointer group">
                    <MaterialIcon
                        name="search"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-hover:text-primary transition-colors"
                        size="md"
                    />
                    <div className="h-8 w-full rounded-md border border-border bg-card/50 pl-9 pr-3 text-sm text-muted-foreground flex items-center group-hover:bg-card/80 group-hover:border-primary/50 transition-all">
                        회원 이름 검색...
                    </div>
                </div>
            </DialogTrigger>
            <DialogContent className="p-0 gap-0 overflow-hidden max-w-lg bg-card border-border shadow-2xl">
                <DialogHeader className="px-4 py-3 border-b border-border/50">
                    <DialogTitle className="sr-only">전체 회원 검색</DialogTitle>
                    <div className="flex items-center gap-3">
                        <MaterialIcon name="search" size="md" className="text-muted-foreground" />
                        <input
                            className="flex-1 bg-transparent border-none text-base text-foreground placeholder:text-muted-foreground focus:outline-none h-9"
                            placeholder="이름, 동호수, 전화번호로 검색..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        {loading && <MaterialIcon name="sync" size="sm" className="animate-spin text-muted-foreground" />}
                    </div>
                </DialogHeader>
                <div className="max-h-[300px] overflow-y-auto p-1">
                    {results.length > 0 ? (
                        <div className="flex flex-col gap-1">
                            {results.map((member) => (
                                <button
                                    key={member.id}
                                    onClick={() => handleSelect(member.id)}
                                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs group-hover:bg-primary group-hover:text-white transition-colors">
                                            {member.name.slice(0, 1)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-foreground">
                                                {member.name}
                                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                                    ({member.member_number})
                                                </span>
                                            </span>
                                            {member.phone && (
                                                <span className="text-[10px] text-muted-foreground/60 font-mono">
                                                    {member.phone}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <MaterialIcon name="chevron_right" size="sm" className="text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 text-center text-muted-foreground/50 text-sm">
                            {query ? '검색 결과가 없습니다.' : '검색어를 입력하세요.'}
                        </div>
                    )}
                </div>
                {results.length > 0 && (
                    <div className="bg-muted/30 px-3 py-1.5 border-t border-border/30 text-[10px] text-muted-foreground flex justify-between">
                        <span>선택: <strong>클릭</strong> 또는 <strong>Enter</strong></span>
                        <span>ESC: 닫기</span>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
