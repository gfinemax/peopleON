"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import * as XLSX from 'xlsx';
import { MaterialIcon } from '@/components/ui/icon';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type SummaryBlock = {
    total: number;
    members: number;
    recruitmentTarget: number;
};

type CertificateBlock = {
    total: number;
    memberHeld: number;
    externalHeld: number;
    refundEligible: number;
    duplicateExcluded: number;
    registeredInternalDistinct: number;
};

type MemberHeldDetail = {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
    sourceCount: number;
    sourceNumbers: string[];
    excludedSourceNumbers: string[];
    rightsFlow: string;
};

type DuplicateSourceDetail = {
    id: string;
    number: string;
    duplicateCount: number;
    registeredCount: number;
    refundCount: number;
    holders: { id: string; name: string; isRegistered: boolean; phone?: string | null; address?: string | null }[];
};

type RelationBlock = {
    total: number;
    agents: number;
    others: number;
};

type AnalysisExportRow = Record<string, string | number>;

type Segment = {
    label: string;
    value: number;
    colorClass: string;
    stroke: string;
    interactive?: boolean;
};

interface MembersKpiStripProps {
    households: SummaryBlock;
    certificates: CertificateBlock;
    allSourceDetails: MemberHeldDetail[];
    memberHeldDetails: MemberHeldDetail[];
    memberHeldDetailsInternal: MemberHeldDetail[];
    refundSourceDetails: MemberHeldDetail[];
    duplicateSourceDetails: DuplicateSourceDetail[];
    relations: RelationBlock;
}

function ratio(value: number, total: number) {
    if (total <= 0) return 0;
    return Math.round((value / total) * 1000) / 10;
}

function formatCount(value: number, unit: string) {
    return `${value.toLocaleString()}${unit}`;
}

function normalizeDisplayNumber(value: string) {
    return value.replace(/\s+/g, '').toLowerCase();
}

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function sortAnalysisRows(rows: AnalysisExportRow[], sortBy: string, sortOrder: 'asc' | 'desc') {
    if (!sortBy) return rows;

    return [...rows].sort((left, right) => {
        const leftValue = left[sortBy] ?? '';
        const rightValue = right[sortBy] ?? '';

        const leftText = String(leftValue).trim();
        const rightText = String(rightValue).trim();
        const leftNumber = Number(leftText);
        const rightNumber = Number(rightText);

        let compare = 0;
        if (leftText !== '' && rightText !== '' && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
            compare = leftNumber - rightNumber;
        } else {
            compare = leftText.localeCompare(rightText, 'ko-KR', { numeric: true, sensitivity: 'base' });
        }

        return sortOrder === 'asc' ? compare : -compare;
    });
}

function exportAnalysisRows(rows: AnalysisExportRow[], selectedColumns: string[], filename: string) {
    if (rows.length === 0 || selectedColumns.length === 0) return;

    const excelRows = rows.map((row) => {
        const nextRow: AnalysisExportRow = {};
        for (const column of selectedColumns) {
            nextRow[column] = row[column] ?? '';
        }
        return nextRow;
    });

    const sheet = XLSX.utils.json_to_sheet(excelRows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, '권리증분석');
    XLSX.writeFile(book, filename);
}

function openAnalysisPrintWindow(args: {
    title: string;
    rows: AnalysisExportRow[];
    selectedColumns: string[];
    orientation: 'portrait' | 'landscape';
    pageSize: 'A4' | 'A3' | 'Letter';
    resultLabel: string;
}) {
    const { title, rows, selectedColumns, orientation, pageSize, resultLabel } = args;
    if (rows.length === 0 || selectedColumns.length === 0) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return;

    const rowsHtml = rows.map((row) => (
        `<tr>${selectedColumns.map((column) => {
            const cellClass = column === '이름' || column === '성명' ? ' class="name-column"' : '';
            return `<td${cellClass}>${escapeHtml(String(row[column] ?? ''))}</td>`;
        }).join('')}</tr>`
    )).join('');

    printWindow.document.write(`
        <!doctype html>
        <html lang="ko">
        <head>
            <meta charset="utf-8" />
            <title>${escapeHtml(title)}</title>
            <style>
                @page { size: ${pageSize} ${orientation}; margin: 10mm 8mm; }
                body { font-family: Arial, sans-serif; padding: 12px; color: #0f172a; }
                h1 { font-size: 20px; margin: 0 0 6px; }
                p { margin: 0 0 10px; color: #475569; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; vertical-align: top; font-size: 11px; line-height: 1.35; }
                th { background: #f8fafc; font-weight: 700; }
                th.name-column, td.name-column { white-space: nowrap; width: 1%; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(resultLabel)}</p>
            <table>
                <thead>
                    <tr>${selectedColumns.map((column) => {
                        const cellClass = column === '이름' || column === '성명' ? ' class="name-column"' : '';
                        return `<th${cellClass}>${escapeHtml(column)}</th>`;
                    }).join('')}</tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

function DonutChart({
    segments,
    total,
}: {
    segments: Segment[];
    total: number;
}) {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const circleSegments = segments
        .filter((segment) => segment.value > 0)
        .reduce<{ segment: Segment; length: number; offset: number }[]>((acc, segment) => {
            const length = total > 0 ? (segment.value / total) * circumference : 0;
            const previous = acc[acc.length - 1];
            const offset = previous ? previous.offset + previous.length : 0;

            acc.push({ segment, length, offset });
            return acc;
        }, []);

    return (
        <svg viewBox="0 0 84 84" className="h-24 w-24 shrink-0 -rotate-90">
            <circle cx="42" cy="42" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            {circleSegments.map(({ segment, length, offset }) => (
                <circle
                    key={segment.label}
                    cx="42"
                    cy="42"
                    r={radius}
                    fill="none"
                    stroke={segment.stroke}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={-offset}
                />
            ))}
        </svg>
    );
}

function LegendRow({
    segment,
    total,
    unit,
    onClick,
}: {
    segment: Segment;
    total: number;
    unit: string;
    onClick?: () => void;
}) {
    const clickable = segment.interactive && onClick;

    return (
        <button
            type="button"
            onClick={clickable ? onClick : undefined}
            className={`flex w-full items-center justify-between gap-3 border-t border-white/8 pt-2 text-left ${
                clickable ? 'cursor-pointer rounded-lg transition-colors hover:bg-white/[0.03] focus:outline-none focus:ring-1 focus:ring-violet-400/40' : 'cursor-default'
            }`}
        >
            <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${segment.colorClass}`} />
                <span className="truncate text-[11px] font-semibold text-slate-200">{segment.label}</span>
                {clickable && (
                    <span className="rounded border border-violet-400/20 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold text-violet-200">
                        클릭
                    </span>
                )}
            </div>
            <div className="text-right">
                <p className="text-sm font-black text-white">{formatCount(segment.value, unit)}</p>
                <p className="text-[10px] text-slate-400">{ratio(segment.value, total)}%</p>
            </div>
        </button>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-2">
            <span className="text-[11px] font-semibold text-slate-400">{label}</span>
            <span className="text-sm font-black text-white">{value}</span>
        </div>
    );
}

function CompactDonutCard({
    icon,
    title,
    subtitle,
    total,
    unit,
    pillText,
    pillClassName,
    segments,
    summaryRows,
    onSegmentClick,
    onPillClick,
}: {
    icon: string;
    title: string;
    subtitle: string;
    total: number;
    unit: string;
    pillText: string;
    pillClassName: string;
    segments: Segment[];
    summaryRows?: { label: string; value: string }[];
    onSegmentClick?: (segment: Segment) => void;
    onPillClick?: () => void;
}) {
    return (
        <article className="min-w-0 rounded-2xl border border-white/10 bg-[#111a29] p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-slate-100">
                        <MaterialIcon name={icon} size="sm" className="opacity-90" />
                        <p className="truncate text-sm font-extrabold">{title}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{subtitle}</p>
                </div>
                {onPillClick ? (
                    <button
                        type="button"
                        onClick={onPillClick}
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors hover:brightness-110 ${pillClassName}`}
                    >
                        {pillText}
                    </button>
                ) : (
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${pillClassName}`}>
                        {pillText}
                    </span>
                )}
            </div>

            <div className="mt-4 flex items-center gap-4">
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                    <DonutChart segments={segments} total={total} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-semibold text-slate-400">총합</span>
                        <span className="text-lg font-black tracking-tight text-white">{total.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-500">{unit}</span>
                    </div>
                </div>

                <div className="grid flex-1 gap-2">
                    {segments.map((segment) => (
                        <LegendRow
                            key={segment.label}
                            segment={segment}
                            total={total}
                            unit={unit}
                            onClick={onSegmentClick ? () => onSegmentClick(segment) : undefined}
                        />
                    ))}
                    {summaryRows?.map((row) => (
                        <SummaryRow key={row.label} label={row.label} value={row.value} />
                    ))}
                </div>
            </div>
        </article>
    );
}

export function MembersKpiStrip({
    households,
    certificates,
    allSourceDetails,
    memberHeldDetails,
    memberHeldDetailsInternal,
    refundSourceDetails,
    duplicateSourceDetails,
    relations,
}: MembersKpiStripProps) {
    const [analysisOpen, setAnalysisOpen] = useState(false);
    const [analysisMode, setAnalysisMode] = useState<'all' | 'registered_global' | 'registered_internal' | 'refund' | 'duplicates'>('registered_global');
    const [analysisView, setAnalysisView] = useState<'person' | 'number'>('person');
    const [analysisQuery, setAnalysisQuery] = useState('');
    const [isExportConfigOpen, setIsExportConfigOpen] = useState(false);
    const [isPrintConfigOpen, setIsPrintConfigOpen] = useState(false);
    const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>([]);
    const [selectedPrintColumns, setSelectedPrintColumns] = useState<string[]>([]);
    const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
    const [printPageSize, setPrintPageSize] = useState<'A4' | 'A3' | 'Letter'>('A4');
    const [printSortBy, setPrintSortBy] = useState('');
    const [printSortOrder, setPrintSortOrder] = useState<'asc' | 'desc'>('asc');
    const householdSegments: Segment[] = [
        { label: '조합원', value: households.members, colorClass: 'bg-sky-400', stroke: '#38bdf8' },
        { label: '추가모집 예정', value: households.recruitmentTarget, colorClass: 'bg-amber-400', stroke: '#fbbf24' },
    ];

    const certificateSegments: Segment[] = [
        { label: '조합원 보유분', value: certificates.memberHeld, colorClass: 'bg-violet-400', stroke: '#a78bfa', interactive: true },
        { label: '환불 권리증', value: certificates.externalHeld, colorClass: 'bg-emerald-400', stroke: '#34d399', interactive: true },
    ];

    const relationSegments: Segment[] = [
        { label: '대리인', value: relations.agents, colorClass: 'bg-emerald-400', stroke: '#34d399' },
        { label: '관계인', value: relations.others, colorClass: 'bg-teal-200', stroke: '#99f6e4' },
    ];

    const sourcePeopleCount = useMemo(() => allSourceDetails.filter((detail) => detail.sourceCount > 0).length, [allSourceDetails]);
    const memberHeldPeopleCount = useMemo(() => memberHeldDetails.filter((detail) => detail.sourceCount > 0).length, [memberHeldDetails]);
    const memberHeldInternalPeopleCount = useMemo(() => memberHeldDetailsInternal.filter((detail) => detail.sourceCount > 0).length, [memberHeldDetailsInternal]);
    const refundPeopleCount = useMemo(() => refundSourceDetails.filter((detail) => detail.sourceCount > 0).length, [refundSourceDetails]);

    const openAnalysis = (mode: 'all' | 'registered_global' | 'registered_internal' | 'refund' | 'duplicates') => {
        setAnalysisMode(mode);
        if (mode === 'duplicates') {
            setAnalysisView('number');
        }
        setAnalysisOpen(true);
    };

    const activeSourceDetails = analysisMode === 'all'
        ? allSourceDetails
        : analysisMode === 'registered_global'
            ? memberHeldDetails
            : analysisMode === 'registered_internal'
                ? memberHeldDetailsInternal
                : refundSourceDetails;

    const activePeopleCount = analysisMode === 'all'
        ? sourcePeopleCount
        : analysisMode === 'registered_global'
            ? memberHeldPeopleCount
            : analysisMode === 'registered_internal'
                ? memberHeldInternalPeopleCount
                : refundPeopleCount;

    const activeNumberDetails = useMemo(() => {
        const grouped = new Map<string, { number: string; owners: { id: string; name: string; rightsFlow: string; phone?: string | null; address?: string | null }[] }>();

        for (const detail of activeSourceDetails) {
            for (const number of detail.sourceNumbers) {
                const key = normalizeDisplayNumber(number);
                const existing = grouped.get(key);
                if (existing) {
                    existing.owners.push({ id: detail.id, name: detail.name, rightsFlow: detail.rightsFlow, phone: detail.phone, address: detail.address });
                    if (number.length > existing.number.length) existing.number = number;
                } else {
                    grouped.set(key, {
                        number,
                        owners: [{ id: detail.id, name: detail.name, rightsFlow: detail.rightsFlow, phone: detail.phone, address: detail.address }],
                    });
                }
            }
        }

        return Array.from(grouped.values()).sort((left, right) => left.number.localeCompare(right.number, 'ko-KR'));
    }, [activeSourceDetails]);

    const normalizedQuery = analysisQuery.trim().toLowerCase();

    const filteredSourceDetails = useMemo(() => {
        if (!normalizedQuery) return activeSourceDetails;
        return activeSourceDetails.filter((detail) => {
            const haystack = [
                detail.name,
                detail.phone || '',
                detail.address || '',
                detail.rightsFlow,
                ...detail.sourceNumbers,
                ...detail.excludedSourceNumbers,
            ].join(' ').toLowerCase();
            return haystack.includes(normalizedQuery);
        });
    }, [activeSourceDetails, normalizedQuery]);

    const filteredNumberDetails = useMemo(() => {
        if (!normalizedQuery) return activeNumberDetails;
        return activeNumberDetails.filter((detail) => {
            const haystack = [
                detail.number,
                ...detail.owners.flatMap((owner) => [owner.name, owner.phone || '', owner.address || '', owner.rightsFlow]),
            ].join(' ').toLowerCase();
            return haystack.includes(normalizedQuery);
        });
    }, [activeNumberDetails, normalizedQuery]);

    const filteredDuplicateDetails = useMemo(() => {
        if (!normalizedQuery) return duplicateSourceDetails;
        return duplicateSourceDetails.filter((detail) => {
            const haystack = [
                detail.number,
                ...detail.holders.flatMap((holder) => [holder.name, holder.phone || '', holder.address || '']),
            ].join(' ').toLowerCase();
            return haystack.includes(normalizedQuery);
        });
    }, [duplicateSourceDetails, normalizedQuery]);

    const filteredResultCount = analysisMode === 'duplicates'
        ? filteredDuplicateDetails.length
        : analysisView === 'number'
            ? filteredNumberDetails.length
            : filteredSourceDetails.length;

    const analysisTitle = analysisMode === 'all'
        ? '전체 원천 권리증'
        : analysisMode === 'registered_global'
            ? '조합원 원천 권리증'
            : analysisMode === 'registered_internal'
                ? '조합원 원천 권리증'
                : analysisMode === 'refund'
                    ? '환불 권리증'
                    : '중복 권리증';

    const exportRows = useMemo<AnalysisExportRow[]>(() => {
        if (analysisMode === 'duplicates') {
            return filteredDuplicateDetails.map((detail) => ({
                구분: '중복 권리증',
                권리증번호: detail.number,
                중복건수: detail.duplicateCount,
                조합원수: detail.registeredCount,
                기타수: detail.refundCount,
                보유자명단: detail.holders.map((holder) => holder.name).join(', '),
                연락처: detail.holders.map((holder) => holder.phone || '').filter(Boolean).join(' / '),
                주소: detail.holders.map((holder) => holder.address || '').filter(Boolean).join(' / '),
            }));
        }

        if (analysisView === 'number') {
            return filteredNumberDetails.map((detail) => ({
                구분: analysisTitle,
                권리증번호: detail.number,
                보유자수: detail.owners.length,
                보유자명단: detail.owners.map((owner) => owner.name).join(', '),
                연락처: detail.owners.map((owner) => owner.phone || '').filter(Boolean).join(' / '),
                주소: detail.owners.map((owner) => owner.address || '').filter(Boolean).join(' / '),
            }));
        }

        return filteredSourceDetails.map((detail) => ({
            구분: analysisTitle,
            이름: detail.name,
            연락처: detail.phone || '',
            주소: detail.address || '',
            권리흐름: detail.rightsFlow,
            원천권리증수: detail.sourceCount,
            원천권리증번호: detail.sourceNumbers.join(', '),
            중복제외권리증번호: detail.excludedSourceNumbers.join(', '),
        }));
    }, [analysisMode, analysisTitle, analysisView, filteredDuplicateDetails, filteredNumberDetails, filteredSourceDetails]);

    const availableExportColumns = useMemo(() => Object.keys(exportRows[0] ?? {}), [exportRows]);
    const resultUnit = analysisMode === 'duplicates' || analysisView === 'number' ? '건' : '명';
    const exportFilename = useMemo(() => {
        const date = new Date().toISOString().slice(0, 10);
        const viewLabel = analysisMode === 'duplicates' ? '번호기준' : analysisView === 'person' ? '사람기준' : '번호기준';
        return `권리증_분석_${analysisTitle.replace(/\s+/g, '_')}_${viewLabel}_${date}.xlsx`;
    }, [analysisMode, analysisTitle, analysisView]);
    const effectiveSelectedExportColumns = useMemo(() => {
        const filtered = selectedExportColumns.filter((column) => availableExportColumns.includes(column));
        return filtered.length > 0 ? filtered : availableExportColumns;
    }, [availableExportColumns, selectedExportColumns]);
    const effectiveSelectedPrintColumns = useMemo(() => {
        const filtered = selectedPrintColumns.filter((column) => availableExportColumns.includes(column));
        return filtered.length > 0 ? filtered : availableExportColumns;
    }, [availableExportColumns, selectedPrintColumns]);
    const effectivePrintSortBy = printSortBy && availableExportColumns.includes(printSortBy)
        ? printSortBy
        : (availableExportColumns[0] ?? '');
    const sortedPrintRows = useMemo(
        () => sortAnalysisRows(exportRows, effectivePrintSortBy, printSortOrder),
        [effectivePrintSortBy, exportRows, printSortOrder]
    );

    const toggleSelectedColumn = (
        column: string,
        setColumns: Dispatch<SetStateAction<string[]>>,
        currentColumns: string[],
    ) => {
        setColumns((prev) => {
            if (prev.includes(column)) {
                if (currentColumns.length === 1) return prev;
                return prev.filter((item) => item !== column);
            }
            return [...prev, column];
        });
    };

    const handleExportExcel = () => {
        exportAnalysisRows(exportRows, effectiveSelectedExportColumns, exportFilename);
        setIsExportConfigOpen(false);
    };

    const handlePrint = () => {
        openAnalysisPrintWindow({
            title: analysisTitle,
            rows: sortedPrintRows,
            selectedColumns: effectiveSelectedPrintColumns,
            orientation: printOrientation,
            pageSize: printPageSize,
            resultLabel: `총 ${sortedPrintRows.length.toLocaleString()}${resultUnit}`,
        });
        setIsPrintConfigOpen(false);
    };

    return (
        <>
            <section className="rounded-2xl border border-white/10 bg-[#0f1725] p-3 lg:p-4">
                <div className="grid gap-3 md:grid-cols-3">
                    <CompactDonutCard
                        icon="apartment"
                        title="전체세대"
                        subtitle={`전체 ${households.total.toLocaleString()}세대 기준`}
                        total={households.total}
                        unit="세대"
                        pillText={`조합원 ${ratio(households.members, households.total)}%`}
                        pillClassName="border-sky-400/20 bg-sky-500/10 text-sky-200"
                        segments={householdSegments}
                    />

                    <CompactDonutCard
                        icon="folder"
                        title="권리증"
                        subtitle="중복 제외 원천 권리증 현황"
                        total={certificates.total}
                        unit="건"
                        pillText={`중복 제외 ${formatCount(certificates.duplicateExcluded, '건')}`}
                        pillClassName="border-violet-400/20 bg-violet-500/10 text-violet-200"
                        segments={certificateSegments}
                        onSegmentClick={(segment) => {
                            if (segment.label === '조합원 보유분') {
                                openAnalysis('registered_global');
                            }
                            if (segment.label === '환불 권리증') {
                                openAnalysis('refund');
                            }
                        }}
                        onPillClick={() => openAnalysis('duplicates')}
                    />

                    <CompactDonutCard
                        icon="groups_2"
                        title="관계자"
                        subtitle="대리인과 관계인 구성 비율"
                        total={relations.total}
                        unit="명"
                        pillText={`관계자 ${formatCount(relations.total, '명')}`}
                        pillClassName="border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                        segments={relationSegments}
                    />
                </div>
            </section>

            <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
                <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-4xl bg-[#111a29] border-white/10 text-white p-0 overflow-hidden">
                    <div className="border-b border-white/10 px-6 py-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                                <DialogTitle className="flex items-center gap-2 text-xl font-black">
                                    <MaterialIcon name="folder" className="text-violet-300" />
                                    권리증 분석
                                </DialogTitle>
                                <p className="mt-2 text-sm text-slate-400">
                                    {analysisMode === 'duplicates'
                                        ? '중복된 원천 권리증번호와 보유 명단을 확인합니다. 통합 관리번호는 제외됩니다.'
                                        : `${analysisTitle} 기준의 활성 원천 권리증번호 목록입니다. 통합 관리번호는 제외됩니다.`}
                                </p>
                            </div>
                            {analysisMode !== 'duplicates' && (
                                <div className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.04] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                    <button
                                        type="button"
                                        onClick={() => setAnalysisView('person')}
                                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                                            analysisView === 'person'
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                                        }`}
                                    >
                                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                                            analysisView === 'person' ? 'bg-slate-900/10 text-slate-700' : 'bg-white/[0.06] text-slate-400'
                                        }`}>
                                            <MaterialIcon name="groups" size="xs" />
                                        </span>
                                        사람 기준
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAnalysisView('number')}
                                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                                            analysisView === 'number'
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                                        }`}
                                    >
                                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                                            analysisView === 'number' ? 'bg-slate-900/10 text-slate-700' : 'bg-white/[0.06] text-slate-400'
                                        }`}>
                                            <MaterialIcon name="tag" size="xs" />
                                        </span>
                                        번호 기준
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsExportConfigOpen(true)}
                                disabled={exportRows.length === 0}
                                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#0f172a] px-4 text-sm font-bold text-slate-100 transition-all hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <MaterialIcon name="download" size="sm" />
                                엑셀 다운로드
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsPrintConfigOpen(true)}
                                disabled={exportRows.length === 0}
                                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#0f172a] px-4 text-sm font-bold text-slate-100 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <MaterialIcon name="print" size="sm" />
                                보고서 인쇄
                            </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => openAnalysis('all')}
                                className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                                    analysisMode === 'all'
                                        ? 'border-violet-400/20 bg-violet-500/10 text-violet-200'
                                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                                }`}
                            >
                                전체 원천권리증 {formatCount(certificates.total, '건')}
                            </button>
                            <button
                                type="button"
                                onClick={() => openAnalysis('registered_global')}
                                className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                                    analysisMode === 'registered_global'
                                        ? 'border-violet-400/20 bg-violet-500/10 text-violet-200'
                                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                                }`}
                            >
                                등기조합원 원천권리증 {formatCount(certificates.memberHeld, '건')}
                            </button>
                            <button
                                type="button"
                                onClick={() => openAnalysis('registered_internal')}
                                className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                                    analysisMode === 'registered_internal'
                                        ? 'border-sky-400/20 bg-sky-500/10 text-sky-200'
                                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                                }`}
                            >
                                116명 내부 중복 제거 {formatCount(certificates.registeredInternalDistinct, '건')}
                            </button>
                            <button
                                type="button"
                                onClick={() => openAnalysis('refund')}
                                className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                                    analysisMode === 'refund'
                                        ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                                }`}
                            >
                                환불 권리증 {formatCount(certificates.externalHeld, '건')}
                            </button>
                            <button
                                type="button"
                                onClick={() => openAnalysis('duplicates')}
                                className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                                    analysisMode === 'duplicates'
                                        ? 'border-amber-400/20 bg-amber-500/10 text-amber-200'
                                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                                }`}
                            >
                                중복 권리증 {formatCount(certificates.duplicateExcluded, '건')}
                            </button>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
                                {analysisMode === 'duplicates'
                                    ? `중복 보유자 ${duplicateSourceDetails.reduce((sum, detail) => sum + detail.holders.length, 0).toLocaleString()}명`
                                    : `보유 인원 ${formatCount(activePeopleCount, '명')}`}
                            </span>
                        </div>
                        <div className="mt-4">
                            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0c1524] px-3 py-2.5">
                                <MaterialIcon name="search" className="text-slate-500" size="sm" />
                                <input
                                    type="text"
                                    value={analysisQuery}
                                    onChange={(event) => setAnalysisQuery(event.target.value)}
                                    placeholder="이름, 권리증번호, 연락처, 주소 검색"
                                    className="w-full bg-transparent text-sm font-medium text-white placeholder:text-slate-500 focus:outline-none"
                                />
                                {analysisQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setAnalysisQuery('')}
                                        className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-bold text-slate-300 transition-colors hover:bg-white/[0.08]"
                                    >
                                        초기화
                                    </button>
                                )}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
                                    검색 결과 {filteredResultCount.toLocaleString()}{analysisMode === 'duplicates' || analysisView === 'number' ? '건' : '명'}
                                </span>
                                {analysisQuery && (
                                    <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-200">
                                        검색어: {analysisQuery}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
                        {analysisMode === 'duplicates' ? (
                            filteredDuplicateDetails.length === 0 ? (
                                <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-sm font-semibold text-slate-400">
                                    검색 조건에 맞는 중복 권리증 데이터가 없습니다.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredDuplicateDetails.map((detail) => (
                                        <div key={detail.id} className="rounded-xl border border-white/8 bg-[#182334] px-4 py-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-mono text-lg font-black text-white">{detail.number}</p>
                                                <span className="rounded border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                                                    중복 {detail.duplicateCount}건
                                                </span>
                                                <span className="rounded border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                                                    조합원 {detail.registeredCount}명
                                                </span>
                                                <span className="rounded border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                                                    기타 {detail.refundCount}명
                                                </span>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {detail.holders.map((holder) => (
                                                    <div
                                                        key={`${detail.id}-${holder.id}`}
                                                        className={`rounded-xl border px-3 py-2 ${
                                                            holder.isRegistered
                                                                ? 'border-violet-400/20 bg-violet-500/10 text-violet-100'
                                                                : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                                                        }`}
                                                    >
                                                        <p className="text-xs font-bold">{holder.name}</p>
                                                        <div className="mt-1 space-y-1 text-[11px] font-medium opacity-80">
                                                            <p>{holder.phone || '연락처 없음'}</p>
                                                            <p className="break-all">{holder.address || '주소 없음'}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : analysisView === 'number' ? (
                            filteredNumberDetails.length === 0 ? (
                                <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-sm font-semibold text-slate-400">
                                    검색 조건에 맞는 원천 권리증 데이터가 없습니다.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredNumberDetails.map((detail) => (
                                        <div key={detail.number} className="rounded-xl border border-white/8 bg-[#182334] px-4 py-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-mono text-lg font-black text-white">{detail.number}</p>
                                                <span className="rounded border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-100">
                                                    보유 {detail.owners.length}명
                                                </span>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {detail.owners.map((owner) => (
                                                    <div key={`${detail.number}-${owner.id}`} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-slate-100">
                                                        <p className="text-xs font-bold">{owner.name}</p>
                                                        <div className="mt-1 space-y-1 text-[11px] font-medium text-slate-300">
                                                            <p>{owner.phone || '연락처 없음'}</p>
                                                            <p className="break-all">{owner.address || '주소 없음'}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : filteredSourceDetails.length === 0 ? (
                            <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-sm font-semibold text-slate-400">
                                검색 조건에 맞는 원천 권리증 데이터가 없습니다.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredSourceDetails.map((detail) => (
                                    <div key={detail.id} className="rounded-xl border border-white/8 bg-[#182334] px-4 py-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-base font-black text-white">{detail.name}</p>
                                                    <span className="rounded border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                                                        원천 {detail.sourceCount}건
                                                    </span>
                                                    {analysisMode !== 'registered_internal' && detail.excludedSourceNumbers.length > 0 && (
                                                        <span className="rounded border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                                                            중복 제외 {detail.excludedSourceNumbers.length}건
                                                        </span>
                                                    )}
                                                    <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-slate-300">
                                                        흐름 {detail.rightsFlow}
                                                    </span>
                                                </div>
                                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                                    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">연락처</p>
                                                        <p className="mt-1 text-sm font-semibold text-slate-100">{detail.phone || '연락처 없음'}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">주소</p>
                                                        <p className="mt-1 text-sm font-semibold text-slate-100 break-all">{detail.address || '주소 없음'}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {detail.sourceNumbers.length > 0 ? detail.sourceNumbers.map((number) => (
                                                        <span key={`${detail.id}-${number}`} className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-100">
                                                            {number}
                                                        </span>
                                                    )) : (
                                                        <span className="text-xs font-semibold text-slate-500">표시 가능한 원천 권리증번호가 없습니다.</span>
                                                    )}
                                                </div>
                                                {analysisMode !== 'registered_internal' && detail.excludedSourceNumbers.length > 0 && (
                                                    <div className="mt-3 border-t border-white/8 pt-3">
                                                        <p className="mb-2 text-[11px] font-bold text-amber-300">중복으로 제외된 권리증번호</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {detail.excludedSourceNumbers.map((number, index) => (
                                                                <span key={`${detail.id}-excluded-${number}-${index}`} className="rounded-md border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-100">
                                                                    {number}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isExportConfigOpen} onOpenChange={setIsExportConfigOpen}>
                <DialogContent className="sm:max-w-[520px] border-white/10 bg-[#0F172A] text-slate-200">
                    <div className="border-b border-white/10 px-1 pb-4">
                        <DialogTitle className="flex items-center gap-2 text-xl font-black text-white">
                            <MaterialIcon name="download" className="text-sky-300" />
                            엑셀 다운로드 설정
                        </DialogTitle>
                        <p className="mt-2 text-sm text-slate-400">
                            현재 권리증 분석 결과에서 내려받을 항목을 선택하세요.
                        </p>
                    </div>

                    <div className="space-y-4 py-2">
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                            <span className="font-bold text-white">{analysisTitle}</span>
                            <span className="mx-2 text-slate-500">|</span>
                            대상 {exportRows.length.toLocaleString()}{resultUnit}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {availableExportColumns.map((column) => {
                                const checked = effectiveSelectedExportColumns.includes(column);
                                const disabled = checked && effectiveSelectedExportColumns.length === 1;

                                return (
                                    <label
                                        key={`export-column-${column}`}
                                        className={cn(
                                            "flex items-center gap-2.5 rounded-xl border p-3 transition-colors",
                                            checked ? "border-sky-500/40 bg-sky-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                                            disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer"
                                        )}
                                    >
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={() => toggleSelectedColumn(column, setSelectedExportColumns, effectiveSelectedExportColumns)}
                                            disabled={disabled}
                                            className="border-white/20 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500"
                                        />
                                        <span className="text-sm font-bold text-slate-200">{column}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-4">
                        <span className="text-sm font-bold text-slate-400">
                            선택 컬럼 <span className="text-white">{effectiveSelectedExportColumns.length}</span>개
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsExportConfigOpen(false)}
                                className="rounded-lg px-4 py-2 text-sm font-bold text-slate-300 transition-colors hover:bg-white/[0.06]"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleExportExcel}
                                disabled={exportRows.length === 0 || effectiveSelectedExportColumns.length === 0}
                                className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <MaterialIcon name="file_download" size="sm" />
                                다운로드
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isPrintConfigOpen} onOpenChange={setIsPrintConfigOpen}>
                <DialogContent className="sm:max-w-[580px] border-white/10 bg-[#0F172A] text-slate-200">
                    <div className="border-b border-white/10 px-1 pb-4">
                        <DialogTitle className="flex items-center gap-2 text-xl font-black text-white">
                            <MaterialIcon name="print" className="text-emerald-300" />
                            보고서 인쇄 설정
                        </DialogTitle>
                        <p className="mt-2 text-sm text-slate-400">
                            현재 권리증 분석 결과를 인쇄하기 전에 레이아웃과 컬럼을 고르세요.
                        </p>
                    </div>

                    <div className="space-y-6 py-2">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">용지 방향</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPrintOrientation('portrait')}
                                        className={cn(
                                            "rounded-xl border px-3 py-3 text-xs font-bold transition-all",
                                            printOrientation === 'portrait'
                                                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                                                : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                                        )}
                                    >
                                        세로
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPrintOrientation('landscape')}
                                        className={cn(
                                            "rounded-xl border px-3 py-3 text-xs font-bold transition-all",
                                            printOrientation === 'landscape'
                                                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                                                : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                                        )}
                                    >
                                        가로
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">용지 크기</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['A4', 'A3', 'Letter'] as const).map((size) => (
                                        <button
                                            key={size}
                                            type="button"
                                            onClick={() => setPrintPageSize(size)}
                                            className={cn(
                                                "rounded-xl border px-3 py-3 text-xs font-bold transition-all",
                                                printPageSize === size
                                                    ? 'border-sky-400/40 bg-sky-500/10 text-sky-200'
                                                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                                            )}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-[1fr_140px]">
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">정렬 기준</Label>
                                <Select value={effectivePrintSortBy} onValueChange={setPrintSortBy}>
                                    <SelectTrigger className="border-white/10 bg-white/[0.03] text-slate-200">
                                        <SelectValue placeholder="정렬 기준 선택" />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-[#1E293B] text-slate-200">
                                        {availableExportColumns.map((column) => (
                                            <SelectItem key={`print-sort-${column}`} value={column}>
                                                {column}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">정렬 순서</Label>
                                <Select value={printSortOrder} onValueChange={(value: 'asc' | 'desc') => setPrintSortOrder(value)}>
                                    <SelectTrigger className="border-white/10 bg-white/[0.03] text-slate-200">
                                        <SelectValue placeholder="오름차순" />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-[#1E293B] text-slate-200">
                                        <SelectItem value="asc">오름차순</SelectItem>
                                        <SelectItem value="desc">내림차순</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">포함할 컬럼</Label>
                            <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                                {availableExportColumns.map((column) => {
                                    const checked = effectiveSelectedPrintColumns.includes(column);
                                    const disabled = checked && effectiveSelectedPrintColumns.length === 1;

                                    return (
                                        <label
                                            key={`print-column-${column}`}
                                            className={cn(
                                                "flex items-center gap-2.5 rounded-xl border p-3 transition-colors",
                                                checked ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-[#0f172a] hover:bg-white/[0.04]",
                                                disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer"
                                            )}
                                        >
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={() => toggleSelectedColumn(column, setSelectedPrintColumns, effectiveSelectedPrintColumns)}
                                                disabled={disabled}
                                                className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                            />
                                            <span className="text-sm font-bold text-slate-200">{column}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-4">
                        <span className="text-sm font-bold text-slate-400">
                            대상 <span className="text-white">{sortedPrintRows.length.toLocaleString()}{resultUnit}</span>
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsPrintConfigOpen(false)}
                                className="rounded-lg px-4 py-2 text-sm font-bold text-slate-300 transition-colors hover:bg-white/[0.06]"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handlePrint}
                                disabled={sortedPrintRows.length === 0 || effectiveSelectedPrintColumns.length === 0}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <MaterialIcon name="print" size="sm" />
                                보고서 생성 및 인쇄
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
