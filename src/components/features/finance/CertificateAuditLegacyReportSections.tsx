import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/icon';
import {
    LEGACY_MEMBER_SEGMENT_LABEL_MAP,
    type LegacyMemberSegment,
} from '@/lib/legacy/memberSegments';

type MergedDuplicateRow = {
    number: string;
    registeredCount: number;
    legacyCount: number;
    totalCount: number;
};

type RegisteredMissingRightRow = {
    id: string;
    original_name: string;
    source_file: string;
};

type LegacyExclusiveUniqueRow = {
    number: string;
    ownerName: string;
    ownerSegmentLabel: string;
    contact: string;
    sourceFile: string;
};

type SegmentSummaryRow = {
    segment: LegacyMemberSegment;
    ownerCount: number;
    certificateCount: number;
};

type RefundedPriorityRow = {
    id: string;
    original_name: string;
    certificate_count: number;
    contact: string;
};

type QueryLinkBuilder = (next: { page?: number; status?: LegacyMemberSegment | 'all' }) => string;

export function CertificateAuditStatisticsSection({
    mergedDuplicateRows,
    registeredMissingRightsRows,
}: {
    mergedDuplicateRows: MergedDuplicateRow[];
    registeredMissingRightsRows: RegisteredMissingRightRow[];
}) {
    return (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <h3 className="text-sm font-extrabold text-foreground">권리증 통합 검수 통계</h3>
                <span className="text-[10px] font-bold uppercase text-muted-foreground">A:등기조합원 asset_rights 권리증 / B:비등기 Legacy 권리증번호</span>
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                <div className="overflow-hidden rounded-lg border border-border/60">
                    <div className="border-b border-border/60 bg-muted/20 px-3 py-2">
                        <p className="text-xs font-bold text-foreground">중복 교집합 Top</p>
                    </div>
                    <div className="max-h-52 overflow-auto">
                        {mergedDuplicateRows.length > 0 ? (
                            <table className="w-full text-xs">
                                <thead className="bg-muted/10 text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-bold">번호</th>
                                        <th className="px-3 py-2 text-right font-bold">총빈도</th>
                                        <th className="px-3 py-2 text-right font-bold">A</th>
                                        <th className="px-3 py-2 text-right font-bold">B</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {mergedDuplicateRows.slice(0, 12).map((row) => (
                                        <tr key={row.number}>
                                            <td className="px-3 py-2 font-mono text-foreground">{row.number}</td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-red-400">{row.totalCount}</td>
                                            <td className="px-3 py-2 text-right font-mono text-emerald-400">{row.registeredCount}</td>
                                            <td className="px-3 py-2 text-right font-mono text-blue-400">{row.legacyCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="p-4 text-center text-xs text-muted-foreground">중복 번호가 없습니다.</p>
                        )}
                    </div>
                </div>
                <div className="overflow-hidden rounded-lg border border-border/60">
                    <div className="border-b border-border/60 bg-muted/20 px-3 py-2">
                        <p className="text-xs font-bold text-foreground">등기 권리증 미연결</p>
                    </div>
                    <div className="max-h-52 overflow-auto">
                        {registeredMissingRightsRows.length > 0 ? (
                            <table className="w-full text-xs">
                                <thead className="bg-muted/10 text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-bold">이름</th>
                                        <th className="px-3 py-2 text-left font-bold">출처</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {registeredMissingRightsRows.slice(0, 12).map((row) => (
                                        <tr key={row.id}>
                                            <td className="px-3 py-2 text-foreground">{row.original_name}</td>
                                            <td className="px-3 py-2 font-mono text-red-400">{row.source_file}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="p-4 text-center text-xs text-muted-foreground">미연결 회원이 없습니다.</p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

export function CertificateAuditLegacyExclusiveSection({
    legacyExclusiveExportHref,
    legacyExclusiveUniqueRows,
}: {
    legacyExclusiveExportHref: string;
    legacyExclusiveUniqueRows: LegacyExclusiveUniqueRow[];
}) {
    return (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div>
                    <h3 className="text-sm font-extrabold text-foreground">중복없는 Legacy - 등기제외 리스트</h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                        B(비등기 Legacy) 중 1회만 나온 번호에서 A(등기 권리증)와 겹치는 번호를 제외한 목록
                    </p>
                </div>
                <a
                    href={legacyExclusiveExportHref}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-card/80 hover:text-foreground"
                >
                    <MaterialIcon name="download" size="sm" />
                    엑셀 출력
                </a>
            </div>
            <div className="max-h-72 overflow-auto">
                {legacyExclusiveUniqueRows.length > 0 ? (
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 border-b border-border/60 bg-[#161B22] text-muted-foreground">
                            <tr>
                                <th className="px-4 py-2 text-left font-bold">권리증번호</th>
                                <th className="px-4 py-2 text-left font-bold">소유자(legacy)</th>
                                <th className="px-4 py-2 text-left font-bold">상태</th>
                                <th className="px-4 py-2 text-left font-bold">연락처</th>
                                <th className="px-4 py-2 text-left font-bold">출처</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {legacyExclusiveUniqueRows.map((row) => (
                                <tr key={row.number}>
                                    <td className="px-4 py-2 font-mono text-blue-300">{row.number}</td>
                                    <td className="px-4 py-2 font-bold text-foreground">{row.ownerName}</td>
                                    <td className="px-4 py-2 text-muted-foreground">{row.ownerSegmentLabel}</td>
                                    <td className="px-4 py-2 font-mono text-muted-foreground">{row.contact}</td>
                                    <td className="px-4 py-2 text-muted-foreground">{row.sourceFile}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="p-4 text-center text-xs text-muted-foreground">표시할 번호가 없습니다.</p>
                )}
            </div>
        </section>
    );
}

export function CertificateAuditSegmentOverviewSection({
    segmentSummary,
    refundedPriorityRows,
    duplicateNumbers,
    getQueryLink,
}: {
    segmentSummary: SegmentSummaryRow[];
    refundedPriorityRows: RefundedPriorityRow[];
    duplicateNumbers: Array<[string, number]>;
    getQueryLink: QueryLinkBuilder;
}) {
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <section className="overflow-hidden rounded-xl border border-border bg-card lg:col-span-8">
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                    <h3 className="text-sm font-extrabold text-foreground">조합원 상태별 권리증번호 집계</h3>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">검색 기준</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/20 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-bold">상태</th>
                                <th className="px-4 py-2 text-right text-xs font-bold">인원</th>
                                <th className="px-4 py-2 text-right text-xs font-bold">권리증번호 수</th>
                                <th className="px-4 py-2 text-right text-xs font-bold">보기</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {segmentSummary.map((row) => (
                                <tr key={row.segment} className="hover:bg-muted/10">
                                    <td className="px-4 py-2 font-bold text-foreground">{LEGACY_MEMBER_SEGMENT_LABEL_MAP[row.segment]}</td>
                                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">{row.ownerCount.toLocaleString()}</td>
                                    <td className="px-4 py-2 text-right font-mono font-bold text-blue-400">{row.certificateCount.toLocaleString()}개</td>
                                    <td className="px-4 py-2 text-right">
                                        <Link href={getQueryLink({ status: row.segment, page: 1 })} className="text-xs font-bold text-primary hover:underline">
                                            상세
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="flex flex-col gap-4 lg:col-span-4">
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="border-b border-border/60 px-4 py-3">
                        <h3 className="text-sm font-extrabold text-foreground">환불자 권리증 보유 Top</h3>
                    </div>
                    <div className="flex flex-col gap-2 p-3">
                        {refundedPriorityRows.length > 0 ? (
                            refundedPriorityRows.map((row) => (
                                <div key={row.id} className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-foreground">{row.original_name}</p>
                                        <span className="text-xs font-mono font-bold text-red-400">{row.certificate_count}개</span>
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">연락처: {row.contact}</p>
                                </div>
                            ))
                        ) : (
                            <p className="py-4 text-center text-xs text-muted-foreground">환불자 권리증 데이터가 없습니다.</p>
                        )}
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="border-b border-border/60 px-4 py-3">
                        <h3 className="text-sm font-extrabold text-foreground">중복 권리증번호 경고</h3>
                    </div>
                    <div className="flex max-h-56 flex-col gap-2 overflow-auto p-3">
                        {duplicateNumbers.length > 0 ? (
                            duplicateNumbers.slice(0, 8).map(([number, count]) => (
                                <div key={number} className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                                    <span className="text-xs font-mono font-bold text-amber-300">{number}</span>
                                    <span className="text-[11px] font-bold text-amber-400">{count}건 중복</span>
                                </div>
                            ))
                        ) : (
                            <p className="py-4 text-center text-xs text-muted-foreground">중복 번호가 없습니다.</p>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
