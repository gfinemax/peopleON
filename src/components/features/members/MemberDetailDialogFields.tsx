'use client';

import type { ReactNode } from 'react';

import { MaterialIcon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';

import type { RepresentativeInfo } from './memberDetailDialogUtils';

export function InfoRow({
    icon,
    label,
    value,
    isEditing,
    editElement,
}: {
    icon: string;
    label: string;
    value: string | ReactNode;
    isEditing: boolean;
    editElement: ReactNode;
}) {
    return (
        <div className="grid grid-cols-[80px_1fr] items-center gap-4 border-b border-white/5 py-3 last:border-0">
            <div className="flex items-center gap-2">
                <MaterialIcon name={icon} className="text-gray-500 text-[18px]" />
                <p className="text-gray-400 text-xs font-medium">{label}</p>
            </div>
            {isEditing ? editElement : <div className="text-gray-100 text-sm font-normal break-all text-left">{value}</div>}
        </div>
    );
}

export function RepresentativeRow({
    label,
    data,
    isEditing,
    onChange,
}: {
    label: string;
    data?: RepresentativeInfo | null;
    isEditing: boolean;
    onChange: (val: RepresentativeInfo) => void;
}) {
    if (!data && !isEditing) return null;

    return (
        <div className="bg-[#182a3a]/40 border border-emerald-500/10 rounded-xl p-4">
            <div className="grid grid-cols-[1fr_0.8fr_1.5fr] gap-4 items-end">
                <div className="space-y-1.5 text-left">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase text-left pl-1">{label} 성명</p>
                    {isEditing ? (
                        <Input
                            className="bg-[#1A2633] border-white/10 h-8 text-sm text-white"
                            value={data?.name || ''}
                            onChange={(event) =>
                                onChange({ ...(data || { name: '', relation: '대리인', phone: null }), name: event.target.value })
                            }
                            placeholder="성명"
                        />
                    ) : (
                        <p className="text-sm font-bold text-white flex items-center gap-2 pl-1 mb-1">
                            <MaterialIcon name="person" size="xs" className="text-emerald-400" />
                            {data?.name || '없음'}
                        </p>
                    )}
                </div>
                <div className="space-y-1.5 text-left">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase text-left pl-1">관계</p>
                    {isEditing ? (
                        <Input
                            className="bg-[#1A2633] border-white/10 h-8 text-sm text-white w-full"
                            value={data?.relation || ''}
                            onChange={(event) =>
                                onChange({ ...(data || { name: '', relation: '', phone: null }), relation: event.target.value })
                            }
                            placeholder="관계"
                        />
                    ) : (
                        <div className="pl-1 mb-1">
                            <span className="text-xs font-medium text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">
                                {data?.relation || '-'}
                            </span>
                        </div>
                    )}
                </div>
                <div className="space-y-1.5 text-left">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase text-left pl-1">연락처</p>
                    {isEditing ? (
                        <Input
                            className="bg-[#1A2633] border-white/10 h-8 text-sm text-white"
                            value={data?.phone || ''}
                            onChange={(event) =>
                                onChange({ ...(data || { name: '', relation: '대리인', phone: null }), phone: event.target.value })
                            }
                            placeholder="전화번호"
                        />
                    ) : (
                        <p className="text-sm font-mono text-gray-300 pl-1 mb-1">{data?.phone || '-'}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
