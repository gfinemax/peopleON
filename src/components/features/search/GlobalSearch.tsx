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
import { MemberDetailDialog } from '@/components/features/members/MemberDetailDialog';

interface GlobalSearchProps {
    trigger?: React.ReactNode;
}

export function GlobalSearch({ trigger }: GlobalSearchProps) {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [results, setResults] = React.useState<SearchResult[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
    const [detailOpen, setDetailOpen] = React.useState(false);
    const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const dragOffsetRef = React.useRef({ x: 0, y: 0 });
    const selectedMemberIds = React.useMemo(
        () => (selectedMemberId ? [selectedMemberId] : null),
        [selectedMemberId],
    );

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
        setSelectedMemberId(id);
        setDetailOpen(true);
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
        <>
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
                        'p-0 gap-0 overflow-hidden max-w-2xl bg-card/95 backdrop-blur-2xl border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.3)]',
                        position && 'translate-x-0 translate-y-0',
                    )}
                >
                    <DialogHeader className="border-b border-white/10 p-0 relative bg-background/50">
                        <DialogTitle className="sr-only">전체 회원 검색</DialogTitle>

                        {/* Subtle Drag Handle */}
                        <div
                            onPointerDown={handleDragStart}
                            className="absolute top-0 left-0 right-0 h-6 cursor-grab active:cursor-grabbing flex items-center justify-center group z-10 hidden md:flex"
                            title="드래그해서 이동"
                        >
                            <div className="w-12 h-1 rounded-full bg-muted-foreground/20 group-hover:bg-muted-foreground/40 transition-colors" />
                        </div>

                        <div className="flex items-center gap-4 px-6 pt-8 pb-4">
                            <MaterialIcon name="search" size="lg" className="text-primary/80" />
                            <input
                                className="flex-1 bg-transparent border-none text-xl font-light text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0 h-10"
                                placeholder="이름, 주소, 권리증번호, 전화번호 검색..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            {loading && <MaterialIcon name="sync" size="md" className="animate-spin text-primary/70" />}
                        </div>
                    </DialogHeader>

                    <div className="max-h-[450px] overflow-y-auto p-2 scrollbar-thin">
                        {results.length > 0 ? (
                            <div className="flex flex-col gap-1">
                                {results.map((member) => (
                                    <button
                                        key={member.id}
                                        onClick={() => handleSelect(member.id)}
                                        className="flex items-center justify-between p-3.5 mx-1 my-0.5 rounded-xl hover:bg-white/5 dark:hover:bg-white/10 transition-all duration-200 text-left group border border-transparent hover:border-white/10"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="size-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary font-bold text-sm shadow-inner border border-primary/20 group-hover:scale-110 transition-transform">
                                                {member.name.slice(0, 1)}
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors flex items-center">
                                                    {member.name}
                                                    <span className="ml-2.5 text-[10px] font-normal text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50 border border-border/50">
                                                        {member.certificate_display || member.address || '-'}
                                                    </span>
                                                </span>
                                                {member.phone && (
                                                    <span className="text-[11px] text-muted-foreground/70 font-mono tracking-wide">
                                                        {member.phone}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                            <span className="text-[10px] text-primary/70 font-bold bg-primary/10 px-2 py-1 rounded hidden sm:block">상세보기</span>
                                            <MaterialIcon name="arrow_forward" size="sm" className="text-primary" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 flex flex-col items-center justify-center text-muted-foreground/50 text-sm">
                                <MaterialIcon name="person_search" size="xl" className="opacity-20 mb-4" />
                                <p>{query ? '검색 결과가 없습니다.' : '원하는 조합원의 정보를 검색해보세요.'}</p>
                            </div>
                        )}
                    </div>

                    {results.length > 0 && (
                        <div className="bg-background/80 px-6 py-3 border-t border-white/5 text-[11px] text-muted-foreground flex justify-between items-center">
                            <div className="flex gap-4">
                                <span className="flex items-center gap-1.5">
                                    <kbd className="bg-muted px-1.5 py-0.5 rounded shadow-sm text-[9px] font-mono border border-border/50">Enter</kbd>
                                    상세 보기
                                </span>
                            </div>
                            <span className="flex items-center gap-1.5">
                                <kbd className="bg-muted px-1.5 py-0.5 rounded shadow-sm text-[9px] font-mono border border-border/50">ESC</kbd>
                                닫기
                            </span>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <MemberDetailDialog
                memberId={selectedMemberId}
                memberIds={selectedMemberIds}
                open={detailOpen}
                onOpenChange={setDetailOpen}
                onSaved={() => router.refresh()}
            />
        </>
    );
}
