'use client';

import { useMemo, useState } from 'react';
import { CompactDonutCard } from './MembersKpiStripPrimitives';
import {
    MembersCertificateAnalysisDialog,
    MembersCertificateExportDialog,
    MembersCertificatePrintDialog,
} from './MembersCertificateAnalysisDialogs';
import {
    type AnalysisExportRow,
    type AnalysisMode,
    type AnalysisNumberDetail,
    type AnalysisView,
    type CertificateBlock,
    exportAnalysisRows,
    normalizeDisplayNumber,
    openAnalysisPrintWindow,
    sortAnalysisRows,
} from './membersKpiStripUtils';
import type { DuplicateSourceDetail, MemberHeldDetail } from '@/lib/members/sourceCertificateSummary';

interface MembersCertificateAnalysisCardProps {
    certificates: CertificateBlock;
    allSourceDetails: MemberHeldDetail[];
    memberHeldDetails: MemberHeldDetail[];
    memberHeldDetailsInternal: MemberHeldDetail[];
    refundSourceDetails: MemberHeldDetail[];
    duplicateSourceDetails: DuplicateSourceDetail[];
}

export function MembersCertificateAnalysisCard({
    certificates,
    allSourceDetails,
    memberHeldDetails,
    memberHeldDetailsInternal,
    refundSourceDetails,
    duplicateSourceDetails,
}: MembersCertificateAnalysisCardProps) {
    const [analysisOpen, setAnalysisOpen] = useState(false);
    const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('registered_global');
    const [analysisView, setAnalysisView] = useState<AnalysisView>('person');
    const [analysisQuery, setAnalysisQuery] = useState('');
    const [isExportConfigOpen, setIsExportConfigOpen] = useState(false);
    const [isPrintConfigOpen, setIsPrintConfigOpen] = useState(false);
    const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>([]);
    const [selectedPrintColumns, setSelectedPrintColumns] = useState<string[]>([]);
    const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
    const [printPageSize, setPrintPageSize] = useState<'A4' | 'A3' | 'Letter'>('A4');
    const [printSortBy, setPrintSortBy] = useState('');
    const [printSortOrder, setPrintSortOrder] = useState<'asc' | 'desc'>('asc');

    const certificateSegments = [
        { label: '조합원 보유분', value: certificates.memberHeld, colorClass: 'bg-violet-400', stroke: '#a78bfa', interactive: true },
        { label: '환불 권리증', value: certificates.externalHeld, colorClass: 'bg-emerald-400', stroke: '#34d399', interactive: true },
    ];

    const sourcePeopleCount = useMemo(() => allSourceDetails.filter((detail) => detail.sourceCount > 0).length, [allSourceDetails]);
    const memberHeldPeopleCount = useMemo(() => memberHeldDetails.filter((detail) => detail.sourceCount > 0).length, [memberHeldDetails]);
    const memberHeldInternalPeopleCount = useMemo(() => memberHeldDetailsInternal.filter((detail) => detail.sourceCount > 0).length, [memberHeldDetailsInternal]);
    const refundPeopleCount = useMemo(() => refundSourceDetails.filter((detail) => detail.sourceCount > 0).length, [refundSourceDetails]);

    const openAnalysis = (mode: AnalysisMode) => {
        setAnalysisMode(mode);
        if (mode === 'duplicates') setAnalysisView('number');
        setAnalysisOpen(true);
    };

    const activeSourceDetails =
        analysisMode === 'all'
            ? allSourceDetails
            : analysisMode === 'registered_global'
              ? memberHeldDetails
              : analysisMode === 'registered_internal'
                ? memberHeldDetailsInternal
                : refundSourceDetails;

    const activePeopleCount =
        analysisMode === 'all'
            ? sourcePeopleCount
            : analysisMode === 'registered_global'
              ? memberHeldPeopleCount
              : analysisMode === 'registered_internal'
                ? memberHeldInternalPeopleCount
                : refundPeopleCount;

    const activeNumberDetails = useMemo<AnalysisNumberDetail[]>(() => {
        const grouped = new Map<string, AnalysisNumberDetail>();

        for (const detail of activeSourceDetails) {
            for (const number of detail.sourceNumbers) {
                const key = normalizeDisplayNumber(number);
                const existing = grouped.get(key);

                if (existing) {
                    existing.owners.push({
                        id: detail.id,
                        name: detail.name,
                        rightsFlow: detail.rightsFlow,
                        phone: detail.phone,
                        address: detail.address,
                    });
                    if (number.length > existing.number.length) existing.number = number;
                    continue;
                }

                grouped.set(key, {
                    number,
                    owners: [
                        {
                            id: detail.id,
                            name: detail.name,
                            rightsFlow: detail.rightsFlow,
                            phone: detail.phone,
                            address: detail.address,
                        },
                    ],
                });
            }
        }

        return Array.from(grouped.values()).sort((left, right) => left.number.localeCompare(right.number, 'ko-KR'));
    }, [activeSourceDetails]);

    const normalizedQuery = analysisQuery.trim().toLowerCase();

    const filteredSourceDetails = useMemo(() => {
        if (!normalizedQuery) return activeSourceDetails;
        return activeSourceDetails.filter((detail) =>
            [detail.name, detail.phone || '', detail.address || '', detail.rightsFlow, ...detail.sourceNumbers, ...detail.excludedSourceNumbers]
                .join(' ')
                .toLowerCase()
                .includes(normalizedQuery),
        );
    }, [activeSourceDetails, normalizedQuery]);

    const filteredNumberDetails = useMemo(() => {
        if (!normalizedQuery) return activeNumberDetails;
        return activeNumberDetails.filter((detail) =>
            [detail.number, ...detail.owners.flatMap((owner) => [owner.name, owner.phone || '', owner.address || '', owner.rightsFlow])]
                .join(' ')
                .toLowerCase()
                .includes(normalizedQuery),
        );
    }, [activeNumberDetails, normalizedQuery]);

    const filteredDuplicateDetails = useMemo(() => {
        if (!normalizedQuery) return duplicateSourceDetails;
        return duplicateSourceDetails.filter((detail) =>
            [detail.number, ...detail.holders.flatMap((holder) => [holder.name, holder.phone || '', holder.address || ''])]
                .join(' ')
                .toLowerCase()
                .includes(normalizedQuery),
        );
    }, [duplicateSourceDetails, normalizedQuery]);

    const filteredResultCount = analysisMode === 'duplicates' ? filteredDuplicateDetails.length : analysisView === 'number' ? filteredNumberDetails.length : filteredSourceDetails.length;
    const analysisTitle = analysisMode === 'all' ? '전체 원천 권리증' : analysisMode === 'registered_global' ? '조합원 원천 권리증' : analysisMode === 'registered_internal' ? '조합원 원천 권리증' : analysisMode === 'refund' ? '환불 권리증' : '중복 권리증';

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
    const availablePrintColumns = useMemo(() => ['번호', ...availableExportColumns], [availableExportColumns]);
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
        const filtered = selectedPrintColumns.filter((column) => availablePrintColumns.includes(column));
        return filtered.length > 0 ? filtered : availablePrintColumns;
    }, [availablePrintColumns, selectedPrintColumns]);
    const effectivePrintSortBy = printSortBy && (printSortBy === '번호' || availableExportColumns.includes(printSortBy)) ? printSortBy : (availableExportColumns[0] ?? '');
    const sortedPrintRows = useMemo(
        () => (effectivePrintSortBy === '번호' ? exportRows : sortAnalysisRows(exportRows, effectivePrintSortBy, printSortOrder)),
        [effectivePrintSortBy, exportRows, printSortOrder],
    );

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
            <CompactDonutCard
                icon="folder"
                title="권리증"
                subtitle="중복 제외 원천 권리증 현황"
                total={certificates.total}
                unit="건"
                pillText={`중복 제외 ${certificates.duplicateExcluded.toLocaleString()}건`}
                pillClassName="border-violet-400/20 bg-violet-500/10 text-violet-200"
                segments={certificateSegments}
                onSegmentClick={(segment) => {
                    if (segment.label === '조합원 보유분') openAnalysis('registered_global');
                    if (segment.label === '환불 권리증') openAnalysis('refund');
                }}
                onPillClick={() => openAnalysis('duplicates')}
            />

            <MembersCertificateAnalysisDialog
                activePeopleCount={activePeopleCount}
                analysisMode={analysisMode}
                analysisOpen={analysisOpen}
                analysisQuery={analysisQuery}
                analysisTitle={analysisTitle}
                analysisView={analysisView}
                certificates={certificates}
                duplicateSourceDetails={duplicateSourceDetails}
                exportRows={exportRows}
                filteredDuplicateDetails={filteredDuplicateDetails}
                filteredNumberDetails={filteredNumberDetails}
                filteredResultCount={filteredResultCount}
                filteredSourceDetails={filteredSourceDetails}
                onAnalysisOpenChange={setAnalysisOpen}
                onOpenAnalysis={openAnalysis}
                onSetAnalysisQuery={setAnalysisQuery}
                onSetAnalysisView={setAnalysisView}
                onSetExportConfigOpen={setIsExportConfigOpen}
                onSetPrintConfigOpen={setIsPrintConfigOpen}
                resultUnit={resultUnit}
            />

            <MembersCertificateExportDialog
                analysisTitle={analysisTitle}
                availableExportColumns={availableExportColumns}
                effectiveSelectedExportColumns={effectiveSelectedExportColumns}
                exportRows={exportRows}
                isOpen={isExportConfigOpen}
                onExport={handleExportExcel}
                onOpenChange={setIsExportConfigOpen}
                resultUnit={resultUnit}
                setSelectedExportColumns={setSelectedExportColumns}
            />

            <MembersCertificatePrintDialog
                availablePrintColumns={availablePrintColumns}
                effectivePrintSortBy={effectivePrintSortBy}
                effectiveSelectedPrintColumns={effectiveSelectedPrintColumns}
                isOpen={isPrintConfigOpen}
                onOpenChange={setIsPrintConfigOpen}
                onPrint={handlePrint}
                printOrientation={printOrientation}
                printPageSize={printPageSize}
                printSortOrder={printSortOrder}
                resultUnit={resultUnit}
                setPrintOrientation={setPrintOrientation}
                setPrintPageSize={setPrintPageSize}
                setPrintSortBy={setPrintSortBy}
                setPrintSortOrder={setPrintSortOrder}
                setSelectedPrintColumns={setSelectedPrintColumns}
                sortedPrintRows={sortedPrintRows}
            />
        </>
    );
}
