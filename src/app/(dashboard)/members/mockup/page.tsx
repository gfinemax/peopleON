'use client';

import { useMemo, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';

type MemberStatus = '활성' | '휴면' | '탈퇴';
type PaymentStatus = '완납' | '분납' | '미납';

type CohortTab = {
    id: string;
    label: string;
    icon: string;
    total: number;
    newCount: number;
    overdueCount: number;
    memo: string;
};

type MemberRow = {
    id: string;
    name: string;
    phone: string;
    status: MemberStatus;
    joinDate: string;
    district: string;
    payment: PaymentStatus;
    cohort: string;
    tag: string;
};

const cohortTabs: CohortTab[] = [
    { id: 'all', label: '전체', icon: 'folder_open', total: 712, newCount: 18, overdueCount: 64, memo: '전체 흐름과 미납 추이를 함께 점검하는 기본 보기입니다.' },
    { id: '1st', label: '1차', icon: 'folder', total: 164, newCount: 4, overdueCount: 12, memo: '완납 비율이 높아 주요 이력 점검 중심으로 운영합니다.' },
    { id: '2nd', label: '2차', icon: 'folder', total: 203, newCount: 7, overdueCount: 19, memo: '이번 주 신규 유입이 가장 많아 초기 응대 태스크를 우선합니다.' },
    { id: '3rd', label: '3차', icon: 'folder', total: 191, newCount: 3, overdueCount: 21, memo: '분납 전환 문의가 많아 상담 로그 관리가 중요합니다.' },
    { id: '4th', label: '4차', icon: 'folder', total: 154, newCount: 4, overdueCount: 12, memo: '미납자 재안내 배치가 필요해 일괄 문자 발송을 권장합니다.' },
];

const memberRows: MemberRow[] = [
    { id: 'M-2031', name: '김민준', phone: '010-3831-2401', status: '활성', joinDate: '2025-12-11', district: '동부 2구역', payment: '완납', cohort: '2차', tag: '정기참여' },
    { id: 'M-2013', name: '박서윤', phone: '010-5527-7720', status: '활성', joinDate: '2025-12-01', district: '중앙 1구역', payment: '분납', cohort: '2차', tag: '상담필요' },
    { id: 'M-1887', name: '최지훈', phone: '010-7041-6134', status: '휴면', joinDate: '2025-10-14', district: '서부 3구역', payment: '미납', cohort: '3차', tag: '재연락' },
    { id: 'M-1754', name: '이하린', phone: '010-4476-9181', status: '활성', joinDate: '2025-08-28', district: '북부 1구역', payment: '완납', cohort: '1차', tag: '핵심조합원' },
    { id: 'M-1672', name: '정도윤', phone: '010-2248-5310', status: '탈퇴', joinDate: '2025-07-19', district: '남부 2구역', payment: '분납', cohort: '4차', tag: '탈퇴이력' },
    { id: 'M-1598', name: '한지아', phone: '010-8882-7012', status: '활성', joinDate: '2025-06-30', district: '중앙 2구역', payment: '미납', cohort: '3차', tag: '미납관리' },
    { id: 'M-1523', name: '오태성', phone: '010-3076-4402', status: '활성', joinDate: '2025-06-02', district: '동부 1구역', payment: '완납', cohort: '1차', tag: '우수참여' },
];

function getStatusClass(status: MemberStatus) {
    if (status === '활성') return 'bg-emerald-400/15 text-emerald-300 border border-emerald-300/20';
    if (status === '휴면') return 'bg-amber-300/15 text-amber-200 border border-amber-300/20';
    return 'bg-rose-300/15 text-rose-200 border border-rose-300/20';
}

function getPaymentClass(status: PaymentStatus) {
    if (status === '완납') return 'bg-sky-400/15 text-sky-300 border border-sky-300/25';
    if (status === '분납') return 'bg-violet-300/15 text-violet-200 border border-violet-300/20';
    return 'bg-orange-300/15 text-orange-200 border border-orange-300/20';
}

export default function MembersCohortMockupPage() {
    const [selectedTab, setSelectedTab] = useState<string>('2nd');
    const [query, setQuery] = useState<string>('');

    const activeTab = useMemo(
        () => cohortTabs.find((tab) => tab.id === selectedTab) ?? cohortTabs[0],
        [selectedTab]
    );

    const visibleRows = useMemo(() => {
        const selectedLabel = activeTab.label;
        const baseRows = selectedLabel === '전체'
            ? memberRows
            : memberRows.filter((row) => row.cohort === selectedLabel);

        if (!query.trim()) return baseRows;
        const normalized = query.trim().toLowerCase();
        return baseRows.filter((row) =>
            [row.name, row.phone, row.id, row.tag, row.district].some((value) =>
                value.toLowerCase().includes(normalized)
            )
        );
    }, [activeTab.label, query]);

    return (
        <div className="flex min-h-full flex-col bg-background">
            <Header
                title="조합원 차수별 폴더탭 목업"
                iconName="folder"
                leftContent={
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <MaterialIcon name="inventory_2" size="md" className="text-muted-foreground" />
                        <span className="text-[18px] font-bold text-foreground">차수 탭 운영 시안</span>
                    </div>
                }
            />

            <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 px-3 pb-6 pt-3 lg:px-6 lg:pt-5">
                <section className="overflow-hidden rounded-2xl border border-[#22344f] bg-gradient-to-b from-[#0b1626] to-[#09111f] shadow-[0_15px_40px_rgba(0,0,0,0.35)]">
                    <div className="hidden px-3 pt-3 md:block">
                        <div className="relative rounded-xl bg-[#070f1c] px-2 pt-2">
                            <div className="absolute inset-x-0 bottom-0 h-11 rounded-t-lg bg-[#102038]" />
                            <div className="relative flex gap-2 overflow-x-auto pb-6 scrollbar-thin">
                                {cohortTabs.map((tab) => {
                                    const isActive = tab.id === selectedTab;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setSelectedTab(tab.id)}
                                            className={[
                                                'group min-w-[172px] rounded-t-2xl px-4 pb-4 pt-3 text-left transition-all duration-200',
                                                isActive
                                                    ? 'relative -mb-1 border border-[#41638c] bg-[#1b2f4a] text-white shadow-[0_16px_24px_rgba(0,0,0,0.28)]'
                                                    : 'border border-transparent bg-[#0a1628] text-slate-400 hover:bg-[#102038] hover:text-slate-200',
                                            ].join(' ')}
                                        >
                                            <div className="flex items-center gap-2">
                                                <MaterialIcon
                                                    name={tab.icon}
                                                    size="sm"
                                                    className={isActive ? 'text-sky-300' : 'text-slate-500 group-hover:text-slate-300'}
                                                />
                                                <span className="text-[15px] font-bold">{tab.label}</span>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className="text-xl font-black tracking-tight">{tab.total}</span>
                                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                                                    신규 {tab.newCount}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-[#24334a] bg-[#102038] px-3 py-3 md:hidden">
                        <label htmlFor="cohort-tab-select" className="mb-1 block text-[11px] font-semibold tracking-wide text-slate-300">
                            차수 선택
                        </label>
                        <div className="relative">
                            <select
                                id="cohort-tab-select"
                                value={selectedTab}
                                onChange={(event) => setSelectedTab(event.target.value)}
                                className="h-11 w-full appearance-none rounded-lg border border-[#38557a] bg-[#0a1628] px-3 pr-10 text-sm font-semibold text-slate-100 outline-none transition-colors focus:border-sky-400"
                            >
                                {cohortTabs.map((tab) => (
                                    <option key={tab.id} value={tab.id}>
                                        {tab.label} ({tab.total})
                                    </option>
                                ))}
                            </select>
                            <MaterialIcon name="expand_more" size="md" className="pointer-events-none absolute right-3 top-3 text-slate-400" />
                        </div>
                    </div>

                    <div className="grid gap-3 border-t border-[#24334a] bg-[#102038] p-3 lg:grid-cols-[2fr,1fr] lg:p-4">
                        <div className="rounded-xl border border-[#2f4562] bg-[#091425] p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <MaterialIcon name="folder_managed" size="sm" className="text-sky-300" />
                                    <p className="text-sm font-bold text-slate-100">{activeTab.label} 폴더 메모</p>
                                </div>
                                <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-0.5 text-[11px] font-semibold text-sky-200">
                                    미납 {activeTab.overdueCount}명
                                </span>
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-slate-300">{activeTab.memo}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-xl border border-[#304866] bg-[#0a1628] p-2.5">
                                <p className="text-[11px] text-slate-400">총 조합원</p>
                                <p className="mt-1 text-lg font-black text-slate-50">{activeTab.total}</p>
                            </div>
                            <div className="rounded-xl border border-[#304866] bg-[#0a1628] p-2.5">
                                <p className="text-[11px] text-slate-400">신규 등록</p>
                                <p className="mt-1 text-lg font-black text-emerald-300">+{activeTab.newCount}</p>
                            </div>
                            <div className="rounded-xl border border-[#304866] bg-[#0a1628] p-2.5">
                                <p className="text-[11px] text-slate-400">일괄 액션</p>
                                <p className="mt-1 text-sm font-bold text-sky-300">문자/이동</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-white/10 bg-card">
                    <div className="flex flex-col gap-3 border-b border-white/10 bg-[#101725] p-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="relative w-full lg:max-w-[360px]">
                            <MaterialIcon name="search" size="sm" className="pointer-events-none absolute left-3 top-3 text-slate-400" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="이름, 연락처, 관리 태그 검색"
                                className="h-10 w-full rounded-lg border border-[#324764] bg-[#0d182b] pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" className="rounded-full border border-[#37516f] bg-[#0d182b] px-3 py-1.5 text-xs font-semibold text-slate-200">
                                활성만 보기
                            </button>
                            <button type="button" className="rounded-full border border-[#37516f] bg-[#0d182b] px-3 py-1.5 text-xs font-semibold text-slate-200">
                                미납 우선
                            </button>
                            <button type="button" className="rounded-full border border-sky-300/40 bg-sky-300/10 px-3 py-1.5 text-xs font-semibold text-sky-200">
                                차수 이동
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-[#0d1523] text-xs uppercase tracking-wide text-slate-400">
                                <tr>
                                    <th className="px-3 py-3 text-left font-semibold">이름</th>
                                    <th className="px-3 py-3 text-left font-semibold">연락처</th>
                                    <th className="px-3 py-3 text-left font-semibold">상태</th>
                                    <th className="px-3 py-3 text-left font-semibold">가입일</th>
                                    <th className="px-3 py-3 text-left font-semibold">차수</th>
                                    <th className="px-3 py-3 text-left font-semibold">납부</th>
                                    <th className="px-3 py-3 text-left font-semibold">태그</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.length > 0 ? (
                                    visibleRows.map((row) => (
                                        <tr key={row.id} className="border-t border-white/8 bg-[#101725] transition-colors hover:bg-[#142036]">
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-slate-50">{row.name}</span>
                                                    <span className="text-[11px] text-slate-400">{row.id}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-slate-300">{row.phone}</td>
                                            <td className="px-3 py-3">
                                                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getStatusClass(row.status)}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-slate-300">{row.joinDate}</td>
                                            <td className="px-3 py-3">
                                                <span className="rounded-md bg-slate-700/40 px-2 py-1 text-xs font-semibold text-slate-200">
                                                    {row.cohort}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getPaymentClass(row.payment)}`}>
                                                    {row.payment}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-slate-300">{row.tag}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                                            검색 조건에 맞는 조합원이 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
}
