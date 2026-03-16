'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { DuplicateSourceDetail, MemberHeldDetail } from '@/lib/members/sourceCertificateSummary';
import type {
    AnalysisExportRow,
    AnalysisMode,
    AnalysisNumberDetail,
    AnalysisView,
    CertificateBlock,
} from './membersKpiStripUtils';
import {
    MembersCertificateAnalysisBody,
    MembersCertificateAnalysisHeader,
} from './MembersCertificateAnalysisSections';
export { MembersCertificateExportDialog } from './MembersCertificateExportDialog';
export { MembersCertificatePrintDialog } from './MembersCertificatePrintDialog';

export function MembersCertificateAnalysisDialog({
    activePeopleCount,
    analysisMode,
    analysisOpen,
    analysisQuery,
    analysisTitle,
    analysisView,
    certificates,
    duplicateSourceDetails,
    exportRows,
    filteredDuplicateDetails,
    filteredNumberDetails,
    filteredResultCount,
    filteredSourceDetails,
    onAnalysisOpenChange,
    onOpenAnalysis,
    onSetAnalysisQuery,
    onSetAnalysisView,
    onSetExportConfigOpen,
    onSetPrintConfigOpen,
    resultUnit,
}: {
    activePeopleCount: number;
    analysisMode: AnalysisMode;
    analysisOpen: boolean;
    analysisQuery: string;
    analysisTitle: string;
    analysisView: AnalysisView;
    certificates: CertificateBlock;
    duplicateSourceDetails: DuplicateSourceDetail[];
    exportRows: AnalysisExportRow[];
    filteredDuplicateDetails: DuplicateSourceDetail[];
    filteredNumberDetails: AnalysisNumberDetail[];
    filteredResultCount: number;
    filteredSourceDetails: MemberHeldDetail[];
    onAnalysisOpenChange: (open: boolean) => void;
    onOpenAnalysis: (mode: AnalysisMode) => void;
    onSetAnalysisQuery: (value: string) => void;
    onSetAnalysisView: (view: AnalysisView) => void;
    onSetExportConfigOpen: (open: boolean) => void;
    onSetPrintConfigOpen: (open: boolean) => void;
    resultUnit: string;
}) {
    return (
        <Dialog open={analysisOpen} onOpenChange={onAnalysisOpenChange}>
            <DialogContent className="max-w-[calc(100%-2rem)] overflow-hidden border-white/10 bg-[#111a29] p-0 text-white sm:max-w-4xl">
                <MembersCertificateAnalysisHeader
                    activePeopleCount={activePeopleCount}
                    analysisMode={analysisMode}
                    analysisQuery={analysisQuery}
                    analysisTitle={analysisTitle}
                    analysisView={analysisView}
                    certificates={certificates}
                    duplicateSourceDetails={duplicateSourceDetails}
                    exportRows={exportRows}
                    filteredResultCount={filteredResultCount}
                    onOpenAnalysis={onOpenAnalysis}
                    onSetAnalysisQuery={onSetAnalysisQuery}
                    onSetAnalysisView={onSetAnalysisView}
                    onSetExportConfigOpen={onSetExportConfigOpen}
                    onSetPrintConfigOpen={onSetPrintConfigOpen}
                    resultUnit={resultUnit}
                />
                <MembersCertificateAnalysisBody
                    analysisMode={analysisMode}
                    analysisView={analysisView}
                    filteredDuplicateDetails={filteredDuplicateDetails}
                    filteredNumberDetails={filteredNumberDetails}
                    filteredSourceDetails={filteredSourceDetails}
                />
            </DialogContent>
        </Dialog>
    );
}
