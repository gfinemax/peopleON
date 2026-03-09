'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { searchMembers, SearchResult } from '@/app/actions/members';

interface GlobalSearchProps {
    trigger?: React.ReactNode;
}

export function GlobalSearch({ trigger }: GlobalSearchProps) {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [results, setResults] = React.useState<SearchResult[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const dragOffsetRef = React.useRef({ x: 0, y: 0 });

    const clampPosition = React.useCallback((nextX: number, nextY: number) => {
        const content = contentRef.current;
        const width = content?.offsetWidth ?? 720;
        const height = content?.offsetHeight ?? 420;
        const margin = 16;

        return {
            x: Math.min(Math.max(nextX, margin), Math.max(margin, window.innerWidth - width - margin)),
            y: Math.min(Math.max(nextY, margin), Math.max(margin, window.innerHeight - height - margin)),
        };
    }, []);

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

    React.useEffect(() => {
        if (!isDragging) return;

        const handlePointerMove = (event: PointerEvent) => {
            const nextPosition = clampPosition(
                event.clientX - dragOffsetRef.current.x,
                event.clientY - dragOffsetRef.current.y,
            );
            setPosition(nextPosition);
        };

        const stopDragging = () => {
            setIsDragging(false);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', stopDragging);
        window.addEventListener('pointercancel', stopDragging);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', stopDragging);
            window.removeEventListener('pointercancel', stopDragging);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [clampPosition, isDragging]);

    const handleSelect = (id: string) => {
        setOpen(false);
        router.push(`/members/${id}`);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && results.length > 0) {
            handleSelect(results[0].id);
        }
    };

    const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || window.innerWidth < 768) return;

        const content = contentRef.current;
        if (!content) return;

        const rect = content.getBoundingClientRect();
        dragOffsetRef.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
        setPosition({ x: rect.left, y: rect.top });
        setIsDragging(true);
        event.preventDefault();
    };

    const contentStyle = position
        ? ({
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: 'translate(0, 0)',
        } satisfies React.CSSProperties)
        : undefined;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger ? (
                <DialogTrigger asChild>{trigger}</DialogTrigger>
            ) : (
                <DialogTrigger className="group relative hidden h-8 w-64 items-center rounded-md border border-border bg-card/50 pl-9 pr-3 text-left text-sm text-muted-foreground transition-all hover:border-primary/50 hover:bg-card/80 md:flex">
                    <MaterialIcon
                        name="search"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-hover:text-primary"
                        size="md"
                    />
                    <span className="line-clamp-1">회원 이름 검색...</span>
                </DialogTrigger>
            )}
            <DialogContent
                ref={contentRef}
                style={contentStyle}
                className={cn(
                    'p-0 gap-0 overflow-hidden max-w-lg bg-card border-border shadow-2xl',
                    position && 'translate-x-0 translate-y-0',
                )}
            >
                <DialogHeader className="border-b border-border/50 px-4 py-3">
                    <DialogTitle className="sr-only">전체 회원 검색</DialogTitle>
                    <div
                        onPointerDown={handleDragStart}
                        className="mb-3 hidden cursor-grab items-center justify-center gap-2 rounded-md border border-dashed border-border/60 bg-muted/20 px-2 py-1 text-[10px] font-semibold text-muted-foreground select-none md:flex"
                    >
                        <MaterialIcon name="drag_indicator" size="xs" />
                        드래그해서 이동
                    </div>
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
