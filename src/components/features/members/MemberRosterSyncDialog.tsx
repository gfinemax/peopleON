'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MaterialIcon } from '@/components/ui/icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { findRosterColumn, type RosterSyncRow } from '@/lib/members/memberRosterSync';

type RawRow = Record<string, unknown>;
type Preview = {
    ready: boolean;
    errors: string[];
    matched: Array<{ rowNumber: number; name: string; beforeUnitGroup: string | null; unitGroup: string }>;
    refundCandidates: Array<{ id: string; display_name: string; status: string | null }>;
};

const NAME_HEADERS = ['성명', '이름', '조합원명', '회원명'];
const UNIT_HEADERS = ['평형', '배정평형', '신청평형', '타입', '주택형'];

export function MemberRosterSyncDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const router = useRouter();
    const [fileName, setFileName] = React.useState('');
    const [rawRows, setRawRows] = React.useState<RawRow[]>([]);
    const [headers, setHeaders] = React.useState<string[]>([]);
    const [nameColumn, setNameColumn] = React.useState('');
    const [unitColumn, setUnitColumn] = React.useState('');
    const [preview, setPreview] = React.useState<Preview | null>(null);
    const [loading, setLoading] = React.useState(false);

    const reset = React.useCallback(() => {
        setFileName(''); setRawRows([]); setHeaders([]); setNameColumn(''); setUnitColumn(''); setPreview(null);
    }, []);

    const rows = React.useMemo<RosterSyncRow[]>(() => {
        if (!nameColumn || !unitColumn) return [];
        return rawRows.map((row, index) => ({
            rowNumber: index + 2,
            name: String(row[nameColumn] ?? '').trim(),
            unitGroup: String(row[unitColumn] ?? '').trim(),
        })).filter((row) => row.name);
    }, [nameColumn, rawRows, unitColumn]);

    const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setPreview(null);
        setFileName(file.name);
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const parsed = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' });
        const discoveredHeaders = [...new Set(parsed.flatMap((row) => Object.keys(row)))];
        setRawRows(parsed);
        setHeaders(discoveredHeaders);
        setNameColumn(findRosterColumn(discoveredHeaders, NAME_HEADERS));
        setUnitColumn(findRosterColumn(discoveredHeaders, UNIT_HEADERS));
    };

    const requestPreview = async (apply = false) => {
        setLoading(true);
        try {
            const response = await fetch('/api/members/roster-sync', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows, apply, fileName }),
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || '명부 확인에 실패했어.');
            if (result.applied) {
                alert(`등기조합원 ${result.registeredCount}명, 환불조합원 ${result.refundCount}명과 86명의 평형을 반영했어. 납부 데이터는 변경하지 않았어.`);
                reset(); onOpenChange(false); router.refresh(); return;
            }
            setPreview(result);
        } catch (error) {
            alert(error instanceof Error ? error.message : '명부 확인에 실패했어.');
        } finally {
            setLoading(false);
        }
    };

    const mappingReady = Boolean(nameColumn && unitColumn && rows.length);

    return <Dialog open={open} onOpenChange={(next) => { if (!next && !loading) reset(); onOpenChange(next); }}>
        <DialogContent className="flex max-h-[92vh] flex-col border-slate-800 bg-slate-900 text-slate-100 sm:max-w-[960px]">
            <DialogHeader><DialogTitle>등기조합원 명부 반영</DialogTitle><DialogDescription className="text-slate-400">현재 등기 116명 중 86명은 등기조합원으로 유지하고 나머지 30명은 환불조합원으로 전환해. 예비조합원 20명은 변경하지 않아.</DialogDescription></DialogHeader>
            <div className="flex-1 space-y-4 overflow-hidden py-2">
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-700 bg-slate-800/40 p-4"><MaterialIcon name="upload_file" size="md" className="text-sky-400"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{fileName || '조합원명부 엑셀 파일을 선택해'}</p><p className="text-xs text-slate-500">원본 파일은 저장하지 않고 브라우저에서 읽어 비교 데이터만 전송해.</p></div><input id="roster-sync-file" type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden"/><Button asChild variant="secondary" size="sm"><label htmlFor="roster-sync-file" className="cursor-pointer">파일 선택</label></Button></div>
                {headers.length > 0 ? <div className="grid grid-cols-2 gap-3">{[
                    ['이름 열', nameColumn, setNameColumn], ['평형 열', unitColumn, setUnitColumn],
                ].map(([label, selected, setter]) => <label key={String(label)} className="space-y-1 text-xs font-bold text-slate-400"><span>{String(label)}</span><select value={String(selected)} onChange={(event) => { (setter as React.Dispatch<React.SetStateAction<string>>)(event.target.value); setPreview(null); }} className="h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-white"><option value="">열을 선택해</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div> : null}
                {mappingReady ? <div className="flex items-center justify-between rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm"><span>유효 행 <b className="text-sky-300">{rows.length}명</b></span><Button onClick={() => requestPreview(false)} disabled={loading} size="sm" className="bg-sky-600 hover:bg-sky-500">{loading ? '확인 중...' : '86명 비교하기'}</Button></div> : null}
                {preview ? <div className="space-y-3 overflow-hidden">
                    <div className={`grid grid-cols-3 gap-3 rounded-lg border p-3 ${preview.ready ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}><Summary label="등기조합원" value={`${preview.matched.length}명`}/><Summary label="환불조합원" value={`${preview.refundCandidates.length}명`}/><Summary label="검증" value={preview.ready ? '반영 가능' : '확인 필요'}/></div>
                    {preview.errors.length ? <div className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-xs leading-6 text-rose-200">{preview.errors.map((error) => <p key={error}>• {error}</p>)}</div> : null}
                    <ScrollArea className="h-[300px] rounded border border-slate-700"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-800 text-slate-400"><tr><th className="px-3 py-2">이름</th><th className="px-3 py-2">평형 변경</th></tr></thead><tbody>{preview.matched.map((row) => <tr key={row.rowNumber} className="border-t border-slate-800"><td className="px-3 py-2 font-bold text-white">{row.name}</td><td className="px-3 py-2">{row.beforeUnitGroup || '-'} → <b className="text-sky-300">{row.unitGroup}</b></td></tr>)}</tbody></table></ScrollArea>
                </div> : null}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>취소</Button><Button onClick={() => requestPreview(true)} disabled={loading || !preview?.ready} className="bg-emerald-600 hover:bg-emerald-500">{loading ? '반영 중...' : '86명·30명 최종 반영'}</Button></DialogFooter>
        </DialogContent>
    </Dialog>;
}

function Summary({ label, value }: { label: string; value: string }) {
    return <div className="text-center"><p className="text-[11px] font-bold text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p></div>;
}
