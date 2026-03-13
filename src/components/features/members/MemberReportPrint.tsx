'use client';

import { UnifiedPerson } from '@/services/memberAggregation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

interface MemberReportPrintProps {
    data: UnifiedPerson[];
    isPrinting: boolean;
    onPrintComplete: () => void;
}

type PrintOrientation = 'portrait' | 'landscape';
type PrintPageSize = 'A4' | 'A3' | 'Letter';

interface PrintConfig {
    orientation: PrintOrientation;
    pageSize: PrintPageSize;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    columns: {
        id: string;
        label: string;
        enabled: boolean;
        width?: string;
    }[];
}

export function MemberReportPrint({ data, isPrinting, onPrintComplete }: MemberReportPrintProps) {
    const [showConfig, setShowConfig] = useState(false);
    const [config, setConfig] = useState<PrintConfig>({
        orientation: 'portrait',
        pageSize: 'A4',
        sortBy: 'no',
        sortOrder: 'asc',
        columns: [
            { id: 'no', label: 'No.', enabled: true, width: '40px' },
            { id: 'name', label: '성명', enabled: true, width: '80px' },
            { id: 'phone', label: '연락처', enabled: true, width: '120px' },
            { id: 'tier', label: '구분/차수', enabled: true },
            { id: 'unit', label: '동호수', enabled: true, width: '80px' },
            { id: 'cert_status', label: '권리현황', enabled: true, width: '100px' },
            { id: 'cert', label: '권리증번호', enabled: true, width: '30%' },
            { id: 'status', label: '상태', enabled: true, width: '60px' },
        ]
    });

    const [realPrinting, setRealPrinting] = useState(false);

    useEffect(() => {
        if (isPrinting) {
            setShowConfig(true);
        } else {
            setShowConfig(false);
            setRealPrinting(false);
        }
    }, [isPrinting]);

    const handleStartPrint = () => {
        setShowConfig(false);
        setRealPrinting(true);
        // 렌더링 시간을 위해 약간의 지연 후 실행
        setTimeout(() => {
            window.print();
        }, 500);
    };

    useEffect(() => {
        const handleAfterPrint = () => {
            if (realPrinting) {
                onPrintComplete();
                setRealPrinting(false);
            }
        };
        window.addEventListener('afterprint', handleAfterPrint);
        return () => window.removeEventListener('afterprint', handleAfterPrint);
    }, [realPrinting, onPrintComplete]);

    if (!isPrinting) return null;

    const toggleColumn = (id: string) => {
        setConfig(prev => ({
            ...prev,
            columns: prev.columns.map(col => col.id === id ? { ...col, enabled: !col.enabled } : col)
        }));
    };

    const today = new Date();
    const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    const activeColumns = config.columns.filter(c => c.enabled);

    // 정렬 로직 적용
    const sortedData = [...data].sort((a, b) => {
        let valA: any = a[config.sortBy as keyof UnifiedPerson] || '';
        let valB: any = b[config.sortBy as keyof UnifiedPerson] || '';

        // 특별히 배열로 되어있는 항목 등 처리
        if (config.sortBy === 'no') {
            valA = a.id;
            valB = b.id;
        } else if (config.sortBy === 'tier') {
            valA = Array.isArray(a.tiers) && a.tiers.length > 0 ? a.tiers[0] : (a.tier || '');
            valB = Array.isArray(b.tiers) && b.tiers.length > 0 ? b.tiers[0] : (b.tier || '');
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
            return config.sortOrder === 'asc' 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        }
        
        return config.sortOrder === 'asc' 
            ? (valA > valB ? 1 : -1) 
            : (valA < valB ? 1 : -1);
    });

    return (
        <>
            {/* 설정 다이얼로그 */}
            <Dialog open={showConfig} onOpenChange={(open) => !open && onPrintComplete()}>
                <DialogContent className="sm:max-w-[500px] bg-[#0F172A] border-white/10 text-slate-200">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white text-xl">
                            <MaterialIcon name="print" />
                            인쇄 보고서 설정
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-6 space-y-6">
                        {/* 방향 및 용지 설정 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <Label className="text-gray-400 text-xs font-bold uppercase tracking-wider">용지 방향</Label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setConfig(prev => ({ ...prev, orientation: 'portrait' }))}
                                        className={cn(
                                            "flex-1 py-3 px-2 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-2",
                                            config.orientation === 'portrait' ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                                        )}
                                    >
                                        <MaterialIcon name="portrait" />
                                        세로 (Portrait)
                                    </button>
                                    <button
                                        onClick={() => setConfig(prev => ({ ...prev, orientation: 'landscape' }))}
                                        className={cn(
                                            "flex-1 py-3 px-2 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-2",
                                            config.orientation === 'landscape' ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                                        )}
                                    >
                                        <MaterialIcon name="landscape" />
                                        가로 (Landscape)
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <Label className="text-gray-400 text-xs font-bold uppercase tracking-wider">용지 크기 & 정렬 기준</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['A4', 'A3', 'Letter'].map((size) => (
                                        <button
                                            key={size}
                                            onClick={() => setConfig(prev => ({ ...prev, pageSize: size as PrintPageSize }))}
                                            className={cn(
                                                "py-2 px-1 rounded-md border text-xs font-bold transition-all",
                                                config.pageSize === size ? "bg-blue-500/20 border-blue-500 text-blue-300" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                                            )}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <Select 
                                        value={config.sortBy} 
                                        onValueChange={(val) => setConfig(prev => ({ ...prev, sortBy: val }))}
                                    >
                                        <SelectTrigger className="w-full bg-white/5 border-white/10 text-slate-200">
                                            <SelectValue placeholder="정렬 기준" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#1E293B] border-white/10 text-slate-200">
                                            <SelectItem value="no">작성순 (기본)</SelectItem>
                                            <SelectItem value="name">성명순 (가나다)</SelectItem>
                                            <SelectItem value="unit_group">동호수순</SelectItem>
                                            <SelectItem value="tier">구분/차수순</SelectItem>
                                            <SelectItem value="status">상태순</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select 
                                        value={config.sortOrder} 
                                        onValueChange={(val: 'asc'|'desc') => setConfig(prev => ({ ...prev, sortOrder: val }))}
                                    >
                                        <SelectTrigger className="w-24 bg-white/5 border-white/10 text-slate-200">
                                            <SelectValue placeholder="오름차순" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#1E293B] border-white/10 text-slate-200">
                                            <SelectItem value="asc">오름차순</SelectItem>
                                            <SelectItem value="desc">내림차순</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* 컬럼 선택 */}
                        <div className="space-y-3">
                            <Label className="text-gray-400 text-xs font-bold uppercase tracking-wider">포함할 항목 (컬럼)</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                                {config.columns.map((col) => (
                                    <div key={col.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`col-${col.id}`}
                                            checked={col.enabled}
                                            onCheckedChange={() => toggleColumn(col.id)}
                                            className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                        />
                                        <Label htmlFor={`col-${col.id}`} className="text-sm font-medium cursor-pointer text-slate-300">
                                            {col.label}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => onPrintComplete()} className="text-gray-400 hover:bg-white/5">취소</Button>
                        <Button onClick={handleStartPrint} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2">
                            <MaterialIcon name="print" size="sm" />
                            보고서 생성 및 인쇄
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 실제 인쇄 화면 (realPrinting일 때만 나타남) */}
            {realPrinting && typeof document !== 'undefined' && createPortal(
                <div id="print-container" className="absolute top-0 left-0 w-full min-h-screen z-[99999] bg-white text-black p-10 font-sans print:static print:p-0 print:m-0">
                    <style>{`
                        @media print {
                            @page {
                                size: ${config.pageSize} ${config.orientation};
                                margin: 15mm 12mm 12mm 12mm;
                            }
                            body > *:not(#print-container) {
                                display: none !important;
                            }
                            body {
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                                background: white !important;
                                padding: 0 !important;
                                margin: 0 !important;
                                height: auto !important;
                                overflow: visible !important;
                            }
                            html {
                                height: auto !important;
                                overflow: visible !important;
                            }
                            * {
                                color: black !important;
                            }
                        }
                    `}</style>

                    <div className="flex items-end justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">인물 명단 상세 보고서</h1>
                            <p className="mt-1 text-[12px] text-slate-500 flex items-center gap-2">
                                <span className="font-bold">출력일자:</span> {formattedDate}
                                <span className="mx-2 text-slate-300">|</span>
                                <span className="font-bold">대방동지역주택</span>
                            </p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                            <div className="bg-slate-100 px-3 py-1 rounded border border-slate-200 text-xs font-black text-slate-800">
                                총 {data.length.toLocaleString()} 명
                            </div>
                        </div>
                    </div>

                    <table className="w-full border-collapse border-b border-slate-300">
                        <thead>
                            <tr className="bg-slate-50 border-y-2 border-slate-800">
                                {activeColumns.map(col => (
                                    <th key={col.id} className="px-2 py-1.5 font-black text-slate-800 border-x border-slate-100 text-left text-[11px] uppercase" style={{ width: col.width }}>
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {sortedData.map((person, index) => {
                                const certs = Array.isArray(person.certificate_numbers) && person.certificate_numbers.length > 0
                                    ? person.certificate_numbers.join(', ')
                                    : '-';
                                const tier = Array.isArray(person.tiers) && person.tiers.length > 0
                                    ? person.tiers.join(', ')
                                    : (person.tier || '-');

                                return (
                                    <tr key={person.id} className="break-inside-avoid align-top">
                                        {activeColumns.map(col => (
                                            <td key={col.id} className="px-2 py-[5px] text-[10.5px] border-x border-slate-50 text-slate-700 leading-tight font-medium">
                                                {col.id === 'no' && index + 1}
                                                {col.id === 'name' && <span className="font-bold text-slate-900">{person.name}</span>}
                                                {col.id === 'phone' && <span className="font-mono">{person.phone || '-'}</span>}
                                                {col.id === 'tier' && <span>{tier}</span>}
                                                {col.id === 'unit' && <span className="font-bold">{person.unit_group || '-'}</span>}
                                                {col.id === 'cert_status' && (
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-bold text-[10px]">{person.raw_certificate_count}장 / {person.managed_certificate_count}건</span>
                                                    </div>
                                                )}
                                                {col.id === 'cert' && (
                                                    <div className="flex flex-col gap-[2px] text-[10px] font-mono break-all leading-[1.1]">
                                                        {certs.split(', ').map((certPart, partIdx) => (
                                                            <span key={`cert-part-${partIdx}`}>{certPart}</span>
                                                        ))}
                                                    </div>
                                                )}
                                                {col.id === 'status' && (
                                                    <span className={cn(
                                                        "text-[9px] font-bold px-1 py-0.5 rounded border leading-none",
                                                        person.status === '정상' ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-600"
                                                    )}>
                                                        {person.status || '-'}
                                                    </span>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>,
                document.body
            )}
        </>
    );
}
