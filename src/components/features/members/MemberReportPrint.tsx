'use client';

import { useEffect, useState } from 'react';

import { MemberReportPrintContent } from '@/components/features/members/MemberReportPrintContent';
import { MemberReportPrintDialog } from '@/components/features/members/MemberReportPrintDialog';
import { PrintConfig } from '@/components/features/members/memberReportPrintTypes';
import { DEFAULT_PRINT_CONFIG } from '@/components/features/members/memberReportPrintUtils';
import { UnifiedPerson } from '@/services/memberAggregation';

interface MemberReportPrintProps {
    data: UnifiedPerson[];
    isPrinting: boolean;
    onPrintComplete: () => void;
}

export function MemberReportPrint({ data, isPrinting, onPrintComplete }: MemberReportPrintProps) {
    const [showConfig, setShowConfig] = useState(false);
    const [config, setConfig] = useState<PrintConfig>(DEFAULT_PRINT_CONFIG);
    const [realPrinting, setRealPrinting] = useState(false);

    useEffect(() => {
        if (isPrinting) {
            setShowConfig(true);
        } else {
            setShowConfig(false);
            setRealPrinting(false);
        }
    }, [isPrinting]);

    useEffect(() => {
        const handleAfterPrint = () => {
            if (!realPrinting) return;
            onPrintComplete();
            setRealPrinting(false);
        };

        window.addEventListener('afterprint', handleAfterPrint);
        return () => window.removeEventListener('afterprint', handleAfterPrint);
    }, [realPrinting, onPrintComplete]);

    if (!isPrinting) return null;

    const handleStartPrint = () => {
        setShowConfig(false);
        setRealPrinting(true);
        setTimeout(() => window.print(), 500);
    };

    return (
        <>
            <MemberReportPrintDialog
                open={showConfig}
                config={config}
                setConfig={setConfig}
                onClose={onPrintComplete}
                onStartPrint={handleStartPrint}
            />
            {realPrinting && <MemberReportPrintContent data={data} config={config} />}
        </>
    );
}
