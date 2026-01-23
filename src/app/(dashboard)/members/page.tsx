import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import Link from 'next/link';
import { MembersTable } from '@/components/features/members/MembersTable';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';

export const dynamic = 'force-dynamic';

export default async function MembersPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; sort?: string; order?: string }>;
}) {
    const supabase = await createClient();

    // In Next.js 16, searchParams is a Promise
    const params = await searchParams;
    const query = params?.q || '';
    const sortField = params?.sort || 'member_number';
    const sortOrder = params?.order || 'asc';

    let queryBuilder = supabase
        .from('members')
        .select('id, name, member_number, phone, tier, status, is_registered, unit_group');

    if (query) {
        queryBuilder = queryBuilder.or(`name.ilike.%${query}%,member_number.ilike.%${query}%`);
    }

    const { data: members, error } = await queryBuilder
        .order(sortField, { ascending: sortOrder === 'asc' })
        .limit(200);

    const totalCount = 1248; // Mock value as per Image 0
    const searchResultCount = members?.length || 0;

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            <Header title="조합원 관리" />

            <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
                {/* 1. Header Area with Breadcrumbs & Title */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
                            <span>홈</span>
                            <span className="text-[10px]">/</span>
                            <span>조합원 관리</span>
                            <span className="text-[10px]">/</span>
                            <span className="text-white">전체 명부 관리</span>
                        </div>
                        <h2 className="text-2xl font-extrabold tracking-tight text-white">
                            조합원 전체 명부 관리
                        </h2>
                        <p className="text-muted-foreground font-medium text-xs">
                            조합원의 상세 정보 조회 및 관리, 문자 발송 및 라벨 출력이 가능합니다.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-4 py-2 text-sm font-bold text-white hover:bg-card transition-all shadow-sm">
                            <MaterialIcon name="upload_file" size="sm" />
                            엑셀 일괄 등록
                        </button>
                        <Link
                            href="/members?action=new"
                            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/30 hover:bg-primary-hover transition-all"
                        >
                            <MaterialIcon name="add" size="sm" />
                            신규 조합원 등록
                        </Link>
                    </div>
                </div>

                {/* 2. Filter Block */}
                <div className="flex flex-col rounded-xl border border-border/50 bg-card/30 p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-4 items-end">
                        <div className="lg:col-span-4 space-y-1.5">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-0.5">통합 검색</label>
                            <div className="relative group">
                                <MaterialIcon
                                    name="search"
                                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors font-bold"
                                    size="sm"
                                />
                                <input
                                    type="text"
                                    placeholder="이름, 조합원번호(동호수), 전화번호 검색"
                                    className="h-10 w-full rounded-lg border border-border bg-card/60 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                                    defaultValue={query}
                                />
                            </div>
                        </div>
                        <div className="lg:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-0.5">차수 (TIER)</label>
                            <Select defaultValue="all">
                                <SelectTrigger className="h-10 rounded-lg bg-card/60 border-border w-full text-sm">
                                    <SelectValue placeholder="전체" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">전체</SelectItem>
                                    <SelectItem value="1">1차</SelectItem>
                                    <SelectItem value="2">2차</SelectItem>
                                    <SelectItem value="land">지주</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="lg:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-0.5">상태 (STATUS)</label>
                            <Select defaultValue="all">
                                <SelectTrigger className="h-10 rounded-lg bg-card/60 border-border w-full text-sm">
                                    <SelectValue placeholder="전체" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">전체</SelectItem>
                                    <SelectItem value="normal">정상</SelectItem>
                                    <SelectItem value="pending">탈퇴예정</SelectItem>
                                    <SelectItem value="legal">소송중</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="lg:col-span-3 space-y-1.5">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-0.5">태그 (TAGS)</label>
                            <input
                                type="text"
                                placeholder="#태그 입력"
                                className="h-10 w-full rounded-lg border border-border bg-card/60 px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all font-mono"
                            />
                        </div>
                        <div className="lg:col-span-1">
                            <button className="h-10 w-full rounded-lg bg-primary text-white font-black text-sm hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all">
                                검색
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-border/20 w-full" />

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">활성 필터:</span>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-black text-primary border border-primary/20">
                                    상태: 정상
                                    <button className="hover:text-white transition-colors">
                                        <MaterialIcon name="close" size="xs" />
                                    </button>
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-black text-primary border border-primary/20">
                                    차수: 1차
                                    <button className="hover:text-white transition-colors">
                                        <MaterialIcon name="close" size="xs" />
                                    </button>
                                </span>
                            </div>
                        </div>
                        <button className="text-[11px] font-black text-muted-foreground/60 hover:text-white underline underline-offset-4 tracking-widest transition-colors">
                            필터 초기화
                        </button>
                    </div>
                </div>

                {/* 3. Table Action Bar */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black text-white whitespace-nowrap">전체 {totalCount.toLocaleString()}명</span>
                        <span className="text-sm font-bold text-muted-foreground/60">중 검색 결과 <span className="text-primary">{searchResultCount}</span>명</span>
                    </div>
                    <div className="flex gap-2.5">
                        <button className="flex items-center gap-2 rounded-xl border border-border bg-card/40 px-4 py-2 text-[11px] font-black text-white hover:bg-card transition-all uppercase tracking-widest">
                            <MaterialIcon name="chat" size="sm" />
                            문자 발송
                        </button>
                        <button className="flex items-center gap-2 rounded-xl border border-border bg-card/40 px-4 py-2 text-[11px] font-black text-white hover:bg-card transition-all uppercase tracking-widest">
                            <MaterialIcon name="print" size="sm" />
                            라벨 출력
                        </button>
                        <button className="flex items-center gap-2 rounded-xl border border-border bg-card/40 px-4 py-2 text-[11px] font-black text-white hover:bg-card transition-all uppercase tracking-widest">
                            <MaterialIcon name="download" size="sm" />
                            엑셀 다운로드
                        </button>
                    </div>
                </div>

                {/* 4. Table area */}
                <div className="flex flex-col rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
                    {members && members.length > 0 ? (
                        <MembersTable
                            members={members}
                            tableKey={JSON.stringify(params)}
                        />
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-4">
                            <MaterialIcon name="search_off" size="xl" className="opacity-20" />
                            <p className="font-bold">검색 결과가 없습니다.</p>
                        </div>
                    )}
                </div>

                {/* 5. Pagination (Mock for now) */}
                <div className="flex justify-center mt-4">
                    <div className="flex items-center gap-2 rounded-xl bg-card border border-border/50 p-1 shadow-sm">
                        <button className="p-2 text-muted-foreground hover:text-white hover:bg-muted/10 rounded-lg transition-all">
                            <MaterialIcon name="chevron_left" size="sm" />
                        </button>
                        <div className="flex items-center px-1">
                            <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-white font-black text-sm shadow-lg shadow-primary/20">1</button>
                            <button className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/10 font-bold text-sm transition-all">2</button>
                            <button className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/10 font-bold text-sm transition-all">3</button>
                            <span className="w-9 h-9 flex items-center justify-center text-muted-foreground/40 font-bold">...</span>
                        </div>
                        <button className="p-2 text-muted-foreground hover:text-white hover:bg-muted/10 rounded-lg transition-all">
                            <MaterialIcon name="chevron_right" size="sm" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
