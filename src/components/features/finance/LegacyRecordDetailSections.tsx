'use client';

import { DialogTitle } from '@/components/ui/dialog';
import { MaterialIcon } from '@/components/ui/icon';
import { LegacyRecord, LegacyRecordDetailTab } from '@/components/features/finance/legacyRecordDetailTypes';
import { cn, formatSafeDateTime } from '@/lib/utils';

interface LegacyRecordDetailHeaderProps {
    record: LegacyRecord | null;
    certificateCount: number;
    onClose: () => void;
    onPointerDown: (event: React.PointerEvent) => void;
}

interface LegacyRecordDetailTabsProps {
    activeTab: LegacyRecordDetailTab;
    onChange: (tab: LegacyRecordDetailTab) => void;
}

interface LegacyRecordDetailBodyProps {
    loading: boolean;
    record: LegacyRecord | null;
    activeTab: LegacyRecordDetailTab;
    certificateNumbers: string[];
}

const TABS: Array<{ id: LegacyRecordDetailTab; label: string; icon: string }> = [
    { id: 'info', label: '기본 정보', icon: 'description' },
    { id: 'raw', label: '원본 데이터', icon: 'data_object' },
];

export function formatLegacyRecordRawData(data: Record<string, unknown>) {
    return Object.entries(data).map(([key, value]) => ({
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-'),
    }));
}

export function LegacyRecordDetailHeader({
    record,
    certificateCount,
    onClose,
    onPointerDown,
}: LegacyRecordDetailHeaderProps) {
    return (
        <div
            className="shrink-0 px-6 pt-6 pb-5 flex items-start justify-between bg-[#0F151B] relative z-20 cursor-move select-none"
            onPointerDown={onPointerDown}
        >
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <DialogTitle className="text-white text-2xl font-bold leading-tight tracking-tight drop-shadow-md">
                        {record?.original_name || 'Loading...'}
                    </DialogTitle>
                    {record && (
                        <span
                            className={cn(
                                'inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-sm',
                                record.is_refunded
                                    ? 'bg-red-500/20 border-red-500/30 text-red-300'
                                    : 'bg-green-500/20 border-green-500/30 text-green-300',
                            )}
                        >
                            {record.is_refunded ? '환불됨' : '보유중'}
                        </span>
                    )}
                </div>
                <p className="text-gray-400 text-sm font-normal">
                    출처 파일: <span className="text-gray-300 font-mono">{record?.source_file}</span>
                </p>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex flex-col items-end mr-2">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">보유 권리증</span>
                    <span className="text-xl font-black text-blue-400 font-mono tracking-tight">{certificateCount}개</span>
                </div>
                <button
                    onClick={onClose}
                    className="group p-2 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center"
                >
                    <MaterialIcon name="close" className="text-gray-400 group-hover:text-white transition-colors" size="sm" />
                </button>
            </div>
        </div>
    );
}

export function LegacyRecordDetailTabs({ activeTab, onChange }: LegacyRecordDetailTabsProps) {
    return (
        <div className="flex items-end px-4 relative z-10">
            {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={cn(
                            'relative group flex items-center justify-center min-w-[110px] pb-3 px-6 outline-none transition-all',
                            isActive ? 'pt-3.5 z-20' : 'pt-4 text-gray-500 hover:text-gray-300 z-10',
                        )}
                    >
                        {isActive ? (
                            <>
                                <div
                                    className="absolute bottom-0 -left-4 w-4 h-4 z-10 pointer-events-none"
                                    style={{ background: 'radial-gradient(circle at top left, transparent 16px, #1A2633 16.5px)' }}
                                />
                                <div className="absolute inset-0 bg-[#1A2633] rounded-t-xl z-0 shadow-[-1px_-1px_0_rgba(255,255,255,0.05)]" />
                                <div
                                    className={cn(
                                        'absolute top-0 left-2 right-2 h-[2px] bg-gradient-to-r opacity-70 z-20',
                                        tab.id === 'info'
                                            ? 'from-blue-400/0 via-blue-400 to-blue-400/0'
                                            : 'from-orange-400/0 via-orange-400 to-orange-400/0',
                                    )}
                                />
                                <div
                                    className="absolute bottom-0 -right-4 w-4 h-4 z-10 pointer-events-none"
                                    style={{ background: 'radial-gradient(circle at top right, transparent 16px, #1A2633 16.5px)' }}
                                />
                                <div className="relative z-20 flex items-center gap-2">
                                    <MaterialIcon
                                        name={tab.icon}
                                        className={cn(
                                            'text-[18px] drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]',
                                            tab.id === 'info' ? 'text-blue-400' : 'text-orange-400',
                                        )}
                                    />
                                    <p className="text-white text-sm font-bold tracking-wide">{tab.label}</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="absolute inset-x-2 top-2 bottom-0 rounded-t-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative z-10 flex items-center gap-2">
                                    <MaterialIcon name={tab.icon} className="text-[18px]" />
                                    <p className="text-xs font-semibold">{tab.label}</p>
                                </div>
                            </>
                        )}
                    </button>
                );
            })}
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#1A2633] z-0" />
        </div>
    );
}

export function LegacyRecordDetailBody({
    loading,
    record,
    activeTab,
    certificateNumbers,
}: LegacyRecordDetailBodyProps) {
    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3 opacity-50">
                <MaterialIcon name="refresh" className="animate-spin text-white" />
                <span className="text-xs font-bold text-gray-400">로딩 중...</span>
            </div>
        );
    }

    if (!record) {
        return <div className="text-center py-12 text-gray-500">기록을 불러올 수 없습니다.</div>;
    }

    if (activeTab === 'raw') {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-black/30 rounded-xl border border-white/10 p-4 font-mono text-xs text-gray-300 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <tbody>
                            {formatLegacyRecordRawData(record.raw_data).map(({ key, value }) => (
                                <tr key={key} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                    <td className="py-2 pr-4 font-bold text-orange-400/80 whitespace-nowrap">{key}</td>
                                    <td className="py-2 text-gray-300 break-all">{value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#233040] p-5 rounded-xl border border-white/5 flex flex-col gap-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">기납부 총액</span>
                    <span className="text-2xl font-black text-white font-mono">
                        ₩{(record.amount_paid || 0).toLocaleString()}
                    </span>
                </div>
                <div className="bg-[#233040] p-5 rounded-xl border border-white/5 flex flex-col gap-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">최초 계약일</span>
                    <span className="text-xl font-bold text-white font-mono">
                        {record.contract_date || '미상'}
                    </span>
                </div>
            </div>

            <div className="bg-[#233040] rounded-xl shadow-sm border border-white/5 p-6">
                <h3 className="text-white text-base font-bold mb-5 flex items-center gap-2">
                    <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                    상세 요약
                </h3>
                <div className="flex flex-col gap-0">
                    <InfoRow icon="person" label="원장 명부 이름" value={record.legacy_name || record.original_name} />
                    <InfoRow icon="link" label="조합원 매칭" value={record.member_id ? '매칭 완료 (회원 ID 연동됨)' : '매칭되지 않음 (미가입/탈퇴)'} />
                    <InfoRow icon="confirmation_number" label="권리증 번호 기준 보유 수" value={`${certificateNumbers.length}개`} />
                    <InfoRow icon="database" label="DB 저장 보유 수(rights_count)" value={`${record.rights_count || 0}개`} />
                    <InfoRow icon="schedule" label="데이터 생성일" value={formatSafeDateTime(record.created_at)} />
                </div>
            </div>

            <div className="bg-[#233040] rounded-xl shadow-sm border border-white/5 p-6">
                <h3 className="text-white text-base font-bold mb-5 flex items-center gap-2">
                    <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                    권리증 번호 목록
                </h3>
                {certificateNumbers.length === 0 ? (
                    <p className="text-sm text-gray-400">인식된 권리증 번호가 없습니다.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {certificateNumbers.map((number) => (
                            <span
                                key={number}
                                className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-mono font-bold text-blue-300"
                            >
                                {number}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

interface InfoRowProps {
    icon: string;
    label: string;
    value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
    return (
        <div className="grid grid-cols-[120px_1fr] items-center gap-4 border-b border-white/5 py-3 last:border-0">
            <div className="flex items-center gap-2">
                <MaterialIcon name={icon} className="text-gray-500 text-[16px]" />
                <p className="text-gray-400 text-xs font-medium">{label}</p>
            </div>
            <p className="text-gray-200 text-sm font-normal break-all">{value}</p>
        </div>
    );
}
