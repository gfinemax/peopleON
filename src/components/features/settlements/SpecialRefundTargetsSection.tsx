import type { LedgerRefundTarget } from '@/lib/server/ledgerRefundTargets';

const won = new Intl.NumberFormat('ko-KR');

export function SpecialRefundTargetsSection({
    targets,
    generatedAt,
    error,
}: {
    targets: LedgerRefundTarget[];
    generatedAt: string | null;
    error: string | null;
}) {
    return <section className="overflow-hidden rounded-xl border border-amber-400/20 bg-card shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
            <div>
                <h2 className="text-sm font-black text-slate-100">2020년 5월 추가모집 환불대상</h2>
                <p className="mt-1 text-xs text-slate-400">회계 원장의 미연결 입금 후보를 조회해. 금액은 확인 전까지 자동 귀속하지 않아.</p>
            </div>
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold text-amber-300">대상 {targets.length || 10}명</span>
        </div>
        {error ? <p className="px-4 py-5 text-sm font-semibold text-rose-300">{error}</p> : <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-white/[0.025] text-slate-400"><tr><th className="px-4 py-2.5">성명</th><th className="px-4 py-2.5">분류</th><th className="px-4 py-2.5 text-right">원장 입금 후보</th><th className="px-4 py-2.5 text-center">거래</th><th className="px-4 py-2.5">확인 상태</th></tr></thead>
                <tbody>{targets.map((target) => <tr key={target.id} className="border-t border-white/[0.055]">
                    <td className="px-4 py-3 font-black text-slate-100">{target.target_name}</td>
                    <td className="px-4 py-3 text-slate-400">2020.05 추가모집</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-200">{target.amount_status === 'candidate' ? `${won.format(target.ledger_deposit_total)}원` : '금액 미확인'}</td>
                    <td className="px-4 py-3 text-center text-slate-300">{target.candidate_count}건</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${target.amount_status === 'candidate' ? 'bg-sky-500/10 text-sky-300' : 'bg-amber-400/10 text-amber-300'}`}>{target.amount_status === 'candidate' ? '원장 후보 · 연결 전' : '원장 금액 미확인'}</span></td>
                </tr>)}</tbody>
            </table>
        </div>}
        {generatedAt ? <p className="border-t border-white/[0.055] px-4 py-2 text-[10px] text-slate-500">회계프로그램 조회 기준 {new Date(generatedAt).toLocaleString('ko-KR')}</p> : null}
    </section>;
}
