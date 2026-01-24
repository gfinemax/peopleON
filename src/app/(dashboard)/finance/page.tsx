import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { LegacyRecordsTable } from '@/components/features/finance/LegacyRecordsTable';
import { MobileFinanceView } from '@/components/features/finance/MobileFinanceView';

export const dynamic = 'force-dynamic';

export default async function FinancePage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; sort?: string; order?: string }>;
}) {
    const supabase = await createClient();

    // In Next.js 16, searchParams is a Promise
    const params = await searchParams;
    const query = params?.q || '';
    const sortField = params?.sort || 'rights_count';
    const sortOrder = params?.order || 'desc';

    // 1. Stats Calculation
    const { count: totalLegacyCount } = await supabase.from('legacy_records').select('*', { count: 'exact', head: true });
    const { count: refundedCount } = await supabase.from('legacy_records').select('*', { count: 'exact', head: true }).eq('is_refunded', true);

    // 2. Fetch List - No limit to show all records
    let queryBuilder = supabase
        .from('legacy_records')
        .select('*');

    if (query) {
        queryBuilder = queryBuilder.ilike('original_name', `%${query}%`);
    }

    const { data: legacyRecords } = await queryBuilder
        .order(sortField, { ascending: sortOrder === 'asc' });

    return (
        <>
            <div className="lg:hidden">
                <MobileFinanceView />
            </div>
            <div className="hidden lg:flex flex-1 flex-col h-full bg-slate-50">
                <Header title="자금 및 권리 관리" />

                <div className="p-8 space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">총 과거 기록 (Legacy)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalLegacyCount}건</div>
                                <p className="text-[11px] font-bold text-muted-foreground/30 uppercase tracking-wider">마이그레이션 된 전체 데이터</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">과거/환불 대상자</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{refundedCount}명</div>
                                <p className="text-[11px] font-bold text-muted-foreground/30 uppercase tracking-wider">현재 조합원 명부에 없는 인원</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">권리증 보유 (환불자 중)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">169명</div>
                                <p className="text-[11px] font-bold text-muted-foreground/30 uppercase tracking-wider">(자동 집계 예정)</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Search Bar */}
                    <div className="flex items-center justify-between">
                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <form action="">
                                <Input
                                    name="q"
                                    placeholder="과거 기록(이름) 검색..."
                                    className="pl-9 bg-white"
                                    defaultValue={query}
                                />
                            </form>
                        </div>
                        <div className="text-sm text-slate-500">
                            총 {legacyRecords?.length || 0}건 표시
                        </div>
                    </div>

                    {/* Legacy Records Table with Dialog */}
                    <Card>
                        <CardHeader>
                            <CardTitle>과거 권리증/환불 데이터 목록</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {legacyRecords && legacyRecords.length > 0 ? (
                                <LegacyRecordsTable
                                    records={legacyRecords}
                                    tableKey={JSON.stringify(params)}
                                />
                            ) : (
                                <div className="h-24 flex items-center justify-center text-slate-500">
                                    데이터가 없습니다.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
