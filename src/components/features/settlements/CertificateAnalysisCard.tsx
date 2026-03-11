'use client';

import { useCallback, useEffect, useState } from 'react';
import { MaterialIcon } from '@/components/ui/icon';

type GrandStats = {
    registered_owner_count: number;
    registered_unique_cert_count: number;
    registered_total_cert_sum: number;
    others_owner_count: number;
    others_unique_cert_count: number;
    others_total_cert_sum: number;
    total_unique_cert_count: number;
    shared_cert_count: number;
};

type PersonDetail = {
    entity_id: string;
    display_name: string;
    certificate_count: number;
    certificate_numbers: string[];
};

type SharedHolder = {
    certificate_number_normalized: string;
    holder_count: number;
    holder_names: string[];
    holder_groups: string[];
};

type AnalysisData = {
    stats: GrandStats;
    registered: PersonDetail[];
    others: PersonDetail[];
    shared: SharedHolder[];
};

type TabType = 'registered' | 'shared' | 'others';

export function CertificateAnalysisCard() {
    const [data, setData] = useState<AnalysisData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('registered');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/certificates/analysis', { cache: 'no-store' });
            const body = await res.json().catch(() => null);
            if (!res.ok || !body?.stats) {
                setError(body?.error || `조회 실패 (${res.status})`);
                return;
            }
            setData(body);
        } catch {
            setError('네트워크 오류');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const stats = data?.stats;

    const tabs: { id: TabType; label: string; icon: string; count?: number }[] = [
        { id: 'registered', label: '등기조합원', icon: 'verified_user', count: data?.registered?.length },
        { id: 'shared', label: '중복/공유', icon: 'warning', count: data?.shared?.length },
        { id: 'others', label: '기타 보유자', icon: 'group', count: data?.others?.length },
    ];

    return (
        <section className="rounded-xl border border-white/[0.08] bg-[#101725] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-extrabold text-foreground">권리증 정밀 분석</h3>
                    <p className="mt-1 text-[11px] text-slate-400">
                        certificate_registry 기준 등기조합원/비등기 보유 현황
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void load()}
                    disabled={loading}
                    className="h-8 px-2.5 rounded border border-white/15 bg-white/[0.04] text-slate-200 text-[11px] font-bold inline-flex items-center gap-1"
                >
                    <MaterialIcon name={loading ? 'hourglass_top' : 'refresh'} size="xs" />
                    새로고침
                </button>
            </div>

            {error && (
                <p className="mt-2 rounded border border-rose-400/20 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-200">
                    {error}
                </p>
            )}

            {/* KPI Cards */}
            {stats && (
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                    <KpiCard
                        label="등기조합원 권리증"
                        value={stats.registered_total_cert_sum}
                        sub={`${stats.registered_owner_count}명 · 고유 ${stats.registered_unique_cert_count}번호`}
                        icon="verified_user"
                        color="emerald"
                    />
                    <KpiCard
                        label="기타 보유자 권리증"
                        value={stats.others_total_cert_sum}
                        sub={`${stats.others_owner_count}명 · 고유 ${stats.others_unique_cert_count}번호`}
                        icon="group"
                        color="sky"
                    />
                    <KpiCard
                        label="전체 고유 번호"
                        value={stats.total_unique_cert_count}
                        sub="중복 제거 기준"
                        icon="tag"
                        color="slate"
                    />
                    <KpiCard
                        label="공유 권리증"
                        value={stats.shared_cert_count}
                        sub="2명 이상 보유"
                        icon="warning"
                        color={stats.shared_cert_count > 0 ? 'amber' : 'slate'}
                    />
                </div>
            )}

            {/* Tab Navigation */}
            {data && (
                <div className="mt-3">
                    <div className="flex gap-1 border-b border-white/[0.06] pb-0">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 py-2 text-[11px] font-bold rounded-t-lg transition-colors inline-flex items-center gap-1.5 ${activeTab === tab.id
                                        ? 'bg-white/[0.06] text-white border-b-2 border-blue-400'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                                    }`}
                            >
                                <MaterialIcon name={tab.icon} size="xs" />
                                {tab.label}
                                {tab.count !== undefined && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/[0.08] text-[10px]">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="mt-2 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                        {activeTab === 'registered' && (
                            <PersonTable
                                rows={data.registered}
                                emptyMessage="등기조합원 권리증 데이터가 없습니다."
                            />
                        )}
                        {activeTab === 'shared' && (
                            <SharedTable
                                rows={data.shared}
                                emptyMessage="공유/중복 권리증이 없습니다."
                            />
                        )}
                        {activeTab === 'others' && (
                            <PersonTable
                                rows={data.others}
                                emptyMessage="비등기 권리증 보유자가 없습니다."
                            />
                        )}
                    </div>
                </div>
            )}

            {loading && !data && (
                <div className="mt-4 flex items-center justify-center gap-2 py-8 text-slate-500">
                    <MaterialIcon name="hourglass_top" size="sm" className="animate-spin" />
                    <span className="text-xs font-bold">데이터 로딩 중...</span>
                </div>
            )}
        </section>
    );
}

/* ────── Sub Components ────── */

function KpiCard({
    label,
    value,
    sub,
    icon,
    color,
}: {
    label: string;
    value: number;
    sub: string;
    icon: string;
    color: string;
}) {
    const colorMap: Record<string, string> = {
        emerald: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
        sky: 'border-sky-400/20 bg-sky-500/10 text-sky-200',
        amber: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
        slate: 'border-white/[0.08] bg-[#0b1220] text-slate-200',
    };
    return (
        <div className={`rounded-lg border px-2.5 py-2 ${colorMap[color] || colorMap.slate}`}>
            <div className="flex items-center gap-1.5 mb-1">
                <MaterialIcon name={icon} size="xs" />
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</span>
            </div>
            <p className="text-xl font-black font-mono">{value.toLocaleString()}<span className="text-xs font-normal ml-0.5">장</span></p>
            <p className="text-[10px] mt-0.5 opacity-70">{sub}</p>
        </div>
    );
}

function PersonTable({ rows, emptyMessage }: { rows: PersonDetail[]; emptyMessage: string }) {
    if (!rows || rows.length === 0) {
        return <p className="text-center py-6 text-xs text-slate-500">{emptyMessage}</p>;
    }

    return (
        <table className="w-full text-left text-[11px]">
            <thead>
                <tr className="border-b border-white/[0.06] text-slate-400">
                    <th className="py-2 pr-2 font-bold">성명</th>
                    <th className="py-2 pr-2 font-bold text-right w-16">보유 수</th>
                    <th className="py-2 font-bold">권리증 번호</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr key={row.entity_id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 pr-2 font-semibold text-slate-200">{row.display_name}</td>
                        <td className="py-2 pr-2 text-right font-mono font-bold text-white">{row.certificate_count}</td>
                        <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                                {(row.certificate_numbers || []).map((n) => (
                                    <span key={n} className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono text-[10px]">
                                        {n}
                                    </span>
                                ))}
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
            <tfoot>
                <tr className="border-t border-white/[0.08]">
                    <td className="py-2 pr-2 font-bold text-slate-300">합계 ({rows.length}명)</td>
                    <td className="py-2 pr-2 text-right font-mono font-black text-white">
                        {rows.reduce((s, r) => s + r.certificate_count, 0)}
                    </td>
                    <td />
                </tr>
            </tfoot>
        </table>
    );
}

function SharedTable({ rows, emptyMessage }: { rows: SharedHolder[]; emptyMessage: string }) {
    if (!rows || rows.length === 0) {
        return <p className="text-center py-6 text-xs text-slate-500">{emptyMessage}</p>;
    }

    return (
        <table className="w-full text-left text-[11px]">
            <thead>
                <tr className="border-b border-white/[0.06] text-slate-400">
                    <th className="py-2 pr-2 font-bold">권리증 번호</th>
                    <th className="py-2 pr-2 font-bold text-right w-16">공유 인원</th>
                    <th className="py-2 font-bold">보유자</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr key={row.certificate_number_normalized} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 pr-2 font-mono font-bold text-amber-300">{row.certificate_number_normalized}</td>
                        <td className="py-2 pr-2 text-right font-mono font-bold text-white">{row.holder_count}</td>
                        <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                                {(row.holder_names || []).map((name) => (
                                    <span key={name} className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[10px] font-semibold">
                                        {name}
                                    </span>
                                ))}
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
