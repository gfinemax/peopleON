'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SortableHeader } from './SortableHeader';
import { MemberDetailDialog } from './MemberDetailDialog';
import { cn } from '@/lib/utils';
import { MaterialIcon } from '@/components/ui/icon';
import { toggleFavoriteMember } from '@/app/actions/members';

type RoleType = 'member' | 'certificate_holder' | 'related_party' | 'refund_applicant';

interface Member {
    id: string;
    member_id: string | null;
    party_id?: string | null;
    name: string;
    member_number: string | null;
    phone: string | null;
    tier: string | null;
    status: string | null;
    is_registered: boolean;
    unit_group: string | null;
    is_favorite?: boolean;
    relationships?: { name: string; relation: string; phone?: string }[] | null;
    role_types?: RoleType[];
    source_type?: 'member' | 'party_only';
    ui_role?: 'member' | 'landowner' | 'general' | 'investor' | 'party' | 'other';
    settlement_status?: 'draft' | 'review' | 'approved' | 'paid' | 'rejected' | null;
    settlement_expected?: number;
    settlement_paid?: number;
    settlement_remaining?: number;
}

interface MembersTableProps {
    members: Member[];
    tableKey: string;
    startIndex: number;
}

const roleStyle: Record<RoleType, string> = {
    member: 'bg-sky-500/10 text-sky-200 border-sky-400/20',
    certificate_holder: 'bg-indigo-500/10 text-indigo-200 border-indigo-400/20',
    related_party: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
    refund_applicant: 'bg-rose-500/10 text-rose-200 border-rose-400/20',
};

const roleLabel: Record<RoleType, string> = {
    member: '조합원',
    certificate_holder: '권리증',
    related_party: '관계인',
    refund_applicant: '환불신청',
};

const formatAmount = (value?: number) => `₩${Math.round(value || 0).toLocaleString('ko-KR')}`;

export function MembersTable({ members, tableKey, startIndex }: MembersTableProps) {
    const router = useRouter();
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [creatingCaseById, setCreatingCaseById] = useState<Record<string, boolean>>({});

    const handleRowClick = (member: Member) => {
        if (!member.member_id) return;
        setSelectedMemberId(member.member_id);
        setDialogOpen(true);
    };

    const handleToggleFavorite = async (e: React.MouseEvent, member: Member) => {
        e.stopPropagation();
        if (!member.member_id) return;

        const success = await toggleFavoriteMember(member.member_id, !member.is_favorite);
        if (success) router.refresh();
    };

    const handleCreateSettlementCase = async (e: React.MouseEvent, member: Member) => {
        e.stopPropagation();
        if (!member.party_id) return;

        setCreatingCaseById((prev) => ({ ...prev, [member.id]: true }));
        try {
            const response = await fetch('/api/settlement/cases', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    partyId: member.party_id,
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.success === false) {
                alert(`정산 케이스 생성 실패: ${payload?.error || response.statusText}`);
                return;
            }

            router.refresh();
        } catch {
            alert('정산 케이스 생성 중 네트워크 오류가 발생했습니다.');
        } finally {
            setCreatingCaseById((prev) => ({ ...prev, [member.id]: false }));
        }
    };

    const getStatusBadge = (status: string | null) => {
        switch (status) {
            case '정상':
                return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 border border-emerald-400/20">정상</span>;
            case '소송중':
                return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-200 border border-amber-400/20">소송</span>;
            case '비조합원':
                return <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-1 text-xs text-slate-300 border border-slate-400/20">비조합원</span>;
            case '탈퇴예정':
                return <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-1 text-xs text-rose-200 border border-rose-400/20">탈퇴</span>;
            default:
                return <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground border border-border">{status || '미지정'}</span>;
        }
    };

    const getRepresentativeDisplay = (relationships?: { name: string; relation: string }[] | null) => {
        if (!relationships || relationships.length === 0) return '-';
        const rel = relationships[0];
        return rel.relation ? `${rel.name} (${rel.relation})` : rel.name;
    };

    return (
        <>
            <div className="hidden md:block w-full h-full overflow-auto scrollbar-thin scrollbar-thumb-border/30">
                <table className="w-full text-center bg-card mt-0 text-sm whitespace-nowrap" key={tableKey}>
                    <thead className="sticky top-0 z-10 bg-[#161B22] text-gray-400 font-medium border-b border-white/[0.08]">
                        <tr>
                            <th className="px-4 py-3 w-[50px] text-center"><MaterialIcon name="star" size="sm" className="text-gray-500" /></th>
                            <th className="px-4 py-3 w-[50px] text-center">No.</th>
                            <th className="px-4 py-3"><SortableHeader label="멤버구분" field="tier" className="justify-center" /></th>
                            <th className="px-4 py-3"><SortableHeader label="성명" field="name" className="justify-center" /></th>
                            <th className="px-4 py-3"><SortableHeader label="번호" field="member_number" className="justify-center" /></th>
                            <th className="px-4 py-3">역할</th>
                            <th className="px-4 py-3">대리인</th>
                            <th className="px-4 py-3"><SortableHeader label="상태" field="status" className="justify-center" /></th>
                            <th className="px-4 py-3"><SortableHeader label="연락처" field="phone" className="justify-center" /></th>
                            <th className="px-4 py-3"><SortableHeader label="정산예정" field="settlement_expected" className="justify-center" /></th>
                            <th className="px-4 py-3">지급</th>
                            <th className="px-4 py-3"><SortableHeader label="잔여" field="settlement_remaining" className="justify-center" /></th>
                            <th className="px-4 py-3">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.08]">
                        {members.map((member, index) => (
                            <tr
                                key={member.id}
                                className={cn(
                                    'group transition-colors h-[52px]',
                                    member.member_id ? 'cursor-pointer hover:bg-white/[0.02]' : 'cursor-default bg-white/[0.01]'
                                )}
                                onClick={() => handleRowClick(member)}
                            >
                                <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                    {member.member_id ? (
                                        <button
                                            onClick={(e) => handleToggleFavorite(e, member)}
                                            className="hover:bg-white/10 p-1.5 rounded-full transition-colors"
                                        >
                                            <MaterialIcon
                                                name={member.is_favorite ? 'star' : 'star_border'}
                                                size="sm"
                                                className={member.is_favorite ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}
                                                filled={member.is_favorite}
                                            />
                                        </button>
                                    ) : (
                                        <MaterialIcon name="do_not_disturb_on" size="sm" className="text-slate-600" />
                                    )}
                                </td>
                                <td className="px-4 py-2 text-center text-gray-500 font-mono text-xs">{startIndex + index + 1}</td>
                                <td className="px-4 py-2 text-gray-300">{member.tier || '-'}</td>
                                <td className="px-4 py-2 text-white font-bold">{member.name}</td>
                                <td className="px-4 py-2 font-medium text-gray-200">{member.member_number || '-'}</td>
                                <td className="px-4 py-2">
                                    <div className="flex items-center justify-center gap-1 flex-wrap max-w-[180px] mx-auto">
                                        {(member.role_types || []).map((role) => (
                                            <span key={`${member.id}-${role}`} className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold', roleStyle[role])}>
                                                {roleLabel[role]}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-gray-400">{getRepresentativeDisplay(member.relationships)}</td>
                                <td className="px-4 py-2 flex justify-center items-center h-[52px]">{getStatusBadge(member.status)}</td>
                                <td className="px-4 py-2 text-gray-400 font-mono tracking-tight">{member.phone || '-'}</td>
                                <td className="px-4 py-2 text-slate-200 font-mono">{formatAmount(member.settlement_expected)}</td>
                                <td className="px-4 py-2 text-emerald-300 font-mono">{formatAmount(member.settlement_paid)}</td>
                                <td className="px-4 py-2 text-amber-200 font-mono">{formatAmount(member.settlement_remaining)}</td>
                                <td className="px-4 py-2">
                                    <div className="flex items-center justify-center gap-1">
                                        {member.party_id && !member.settlement_status ? (
                                            <button
                                                onClick={(e) => handleCreateSettlementCase(e, member)}
                                                className="rounded border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[10px] font-bold text-sky-200 hover:bg-sky-500/20"
                                                disabled={Boolean(creatingCaseById[member.id])}
                                            >
                                                {creatingCaseById[member.id] ? '생성중...' : '케이스 생성'}
                                            </button>
                                        ) : member.settlement_status ? (
                                            <span className="rounded border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                                                케이스 있음
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-500">-</span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="block md:hidden w-full max-h-[68vh] overflow-y-auto overflow-x-hidden px-0 py-2 space-y-3 pb-24 scrollbar-hide">
                {members.map((member, index) => (
                    <div
                        key={member.id}
                        onClick={() => handleRowClick(member)}
                        className={cn(
                            'flex flex-col gap-2 p-3 mx-3 rounded-xl border border-white/[0.08] bg-[#161B22]/50 transition-all shadow-sm relative overflow-hidden pr-4',
                            member.member_id ? 'hover:bg-[#161B22] active:scale-[0.98]' : 'opacity-90'
                        )}
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex gap-3 items-center">
                                <span className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary font-bold text-[13px] ring-1 ring-primary/20">
                                    {startIndex + index + 1}
                                </span>
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[15px] font-bold text-white">{member.name}</span>
                                        <span className="text-[11px] text-muted-foreground/60 font-mono">{member.member_number || '-'}</span>
                                    </div>
                                    <div className="text-[12px] text-muted-foreground">{member.tier || '차수미정'} / {member.unit_group || '동호수미정'}</div>
                                </div>
                            </div>
                            {member.member_id ? (
                                <button
                                    onClick={(e) => handleToggleFavorite(e, member)}
                                    className="p-2 text-gray-500 hover:text-yellow-400 active:scale-95 transition-all"
                                >
                                    <MaterialIcon
                                        name={member.is_favorite ? 'star' : 'star_border'}
                                        size="md"
                                        className={member.is_favorite ? 'text-yellow-400' : 'text-gray-600'}
                                        filled={member.is_favorite}
                                    />
                                </button>
                            ) : (
                                <span className="text-[10px] text-slate-500 border border-slate-700 rounded px-2 py-1">비연결</span>
                            )}
                        </div>

                        <div className="flex gap-1.5 flex-wrap">
                            {(member.role_types || []).map((role) => (
                                <span key={`${member.id}-m-${role}`} className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold', roleStyle[role])}>
                                    {roleLabel[role]}
                                </span>
                            ))}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-md border border-white/[0.06] bg-[#0d1523] p-2">
                                <p className="text-[10px] text-slate-400">정산예정</p>
                                <p className="text-xs font-mono text-slate-200">{formatAmount(member.settlement_expected)}</p>
                            </div>
                            <div className="rounded-md border border-white/[0.06] bg-[#0d1523] p-2">
                                <p className="text-[10px] text-slate-400">지급</p>
                                <p className="text-xs font-mono text-emerald-300">{formatAmount(member.settlement_paid)}</p>
                            </div>
                            <div className="rounded-md border border-white/[0.06] bg-[#0d1523] p-2">
                                <p className="text-[10px] text-slate-400">잔여</p>
                                <p className="text-xs font-mono text-amber-200">{formatAmount(member.settlement_remaining)}</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-[12px]">
                            <span className="font-mono text-slate-400">{member.phone || '전화번호 없음'}</span>
                            {getStatusBadge(member.status)}
                        </div>

                        <div className="flex justify-end">
                            {member.party_id && !member.settlement_status ? (
                                <button
                                    onClick={(e) => handleCreateSettlementCase(e, member)}
                                    className="rounded border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-200"
                                    disabled={Boolean(creatingCaseById[member.id])}
                                >
                                    {creatingCaseById[member.id] ? '생성중...' : '정산 케이스 생성'}
                                </button>
                            ) : member.settlement_status ? (
                                <span className="rounded border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                                    케이스 있음
                                </span>
                            ) : (
                                <span className="text-[10px] text-slate-500">정산 대상 아님</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <MemberDetailDialog
                memberId={selectedMemberId}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSaved={() => router.refresh()}
            />
        </>
    );
}
