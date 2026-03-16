'use client';

import { PointerEvent as ReactPointerEvent, useEffect, useState } from 'react';

import {
    LegacyRecordDetailBody,
    LegacyRecordDetailHeader,
    LegacyRecordDetailTabs,
} from '@/components/features/finance/LegacyRecordDetailSections';
import { LegacyRecord, LegacyRecordDetailTab } from '@/components/features/finance/legacyRecordDetailTypes';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { extractCertificateNumbers } from '@/lib/legacy/certificateNumbers';
import { createClient } from '@/lib/supabase/client';

interface LegacyRecordDetailDialogProps {
    recordId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function LegacyRecordDetailDialog({
    recordId,
    open,
    onOpenChange,
}: LegacyRecordDetailDialogProps) {
    const [record, setRecord] = useState<LegacyRecord | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<LegacyRecordDetailTab>('info');
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handlePointerMove = (event: globalThis.PointerEvent) => {
            if (!isDragging) return;
            setPosition({
                x: event.clientX - dragStart.x,
                y: event.clientY - dragStart.y,
            });
        };

        const handlePointerUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        }

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [dragStart, isDragging]);

    const handlePointerDown = (event: ReactPointerEvent) => {
        if ((event.target as HTMLElement).closest('button, input, textarea, a')) return;
        setIsDragging(true);
        setDragStart({
            x: event.clientX - position.x,
            y: event.clientY - position.y,
        });
    };

    async function fetchRecord(id: string) {
        setLoading(true);
        const supabase = createClient();

        const { data, error } = await supabase
            .from('asset_rights')
            .select('*')
            .eq('id', id)
            .single();

        if (!error && data) {
            const meta = (data.meta || {}) as Record<string, unknown>;
            setRecord({
                id: data.id,
                original_name: typeof meta.cert_name === 'string' ? meta.cert_name : '-',
                rights_count: 1,
                source_file: typeof meta.source === 'string' ? meta.source : '-',
                amount_paid: data.principal_amount || 0,
                contract_date: data.issued_at || '-',
                raw_data: meta,
                member_id: data.entity_id,
                is_refunded: data.status === 'refunded',
                created_at: data.created_at,
                certificates: data.right_number,
            });
        }

        setLoading(false);
    }

    useEffect(() => {
        if (!open || !recordId) return;
        setPosition({ x: 0, y: 0 });
        setActiveTab('info');
        fetchRecord(recordId);
    }, [open, recordId]);

    if (!record && !loading) return null;

    const certificateNumbers = record
        ? extractCertificateNumbers(record.raw_data, record.certificates)
        : [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="w-full h-full max-w-none max-h-none h-screen sm:h-auto sm:max-h-[85vh] sm:max-w-2xl p-0 border-0 sm:border sm:border-white/[0.1] bg-[#0F151B] rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl sm:top-[12vh] sm:translate-y-0"
                style={{
                    marginLeft: position.x,
                    marginTop: position.y,
                }}
            >
                <LegacyRecordDetailHeader
                    record={record}
                    certificateCount={certificateNumbers.length}
                    onClose={() => onOpenChange(false)}
                    onPointerDown={handlePointerDown}
                />

                <div className="flex-1 flex flex-col min-h-0 relative px-0 pb-0 bg-[#0F151B]">
                    <LegacyRecordDetailTabs activeTab={activeTab} onChange={setActiveTab} />
                    <div className="flex-1 bg-[#1A2633] relative z-0 overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-white/10">
                            <LegacyRecordDetailBody
                                loading={loading}
                                record={record}
                                activeTab={activeTab}
                                certificateNumbers={certificateNumbers}
                            />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
