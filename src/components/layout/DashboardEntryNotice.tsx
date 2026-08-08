import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/icon';

const labels: Record<string, string> = {
    all: '전체 인물', registered: '등기 조합원', certificates: '원천 권리증',
    related: '대리인·관계인', expected: '환불 예정', paid: '지급 완료',
    remaining: '잔여 환불', collections: '분담금 수납 현황',
    'registered-active': '유지 · 등기완료', 'unregistered-active': '유지 · 미등기/기타',
    'registered-withdrawn': '이탈 · 등기 후', 'unregistered-withdrawn': '이탈 · 미등기',
};

export function DashboardEntryNotice({ from, view, resetHref }: { from?: string; view?: string; resetHref: string }) {
    if (from !== 'dashboard') return null;
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sky-100" role="status">
            <div className="flex items-center gap-2 text-sm font-bold"><MaterialIcon name="filter_alt" size="sm" /><span>대시보드에서 이동 · {labels[view || ''] || '선택 항목'}</span></div>
            <Link href={resetHref} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-sky-300/20 bg-black/10 px-3 text-xs font-black hover:bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">필터 해제 <MaterialIcon name="close" size="xs" /></Link>
        </div>
    );
}
