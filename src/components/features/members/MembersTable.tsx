'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SortableHeader } from './SortableHeader';
import { MemberDetailDialog } from './MemberDetailDialog';
import { InlineCellDropdown, DropdownOption } from './InlineCellDropdown';
import { cn } from '@/lib/utils';

import { MaterialIcon } from '@/components/ui/icon';
import { toggleFavoriteMember } from '@/app/actions/members';

type RoleType = 'member' | 'certificate_holder' | 'related_party' | 'refund_applicant' | 'agent';

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
    relationships?: { id?: string; name: string; relation: string; phone?: string }[] | null;
    role_types?: RoleType[];
    tiers?: string[]; // Multiple tiers
    source_type?: 'member' | 'party_only';
    ui_role?: 'member' | 'landowner' | 'general' | 'investor' | 'agent' | 'party' | 'other';
    settlement_status?: 'draft' | 'review' | 'approved' | 'paid' | 'rejected' | null;
    settlement_expected?: number;
    settlement_paid?: number;
    settlement_remaining?: number;
    is_duplicate_name?: boolean;
    entity_ids?: string[];
    acts_as_agent_for?: { id?: string; name: string; relation: string; type: string }[] | null;
    real_owner?: { id: string; name: string } | null;
    nominees?: { id: string; name: string }[] | null;
}

interface MembersTableProps {
    members: Member[];
    tableKey: string;
    startIndex: number;
}

const roleLabel: Record<RoleType, string> = {
    member: '조합원',
    certificate_holder: '권리증',
    related_party: '관계인',
    refund_applicant: '환불신청',
    agent: '대리인',
};
const roleStyle: Record<RoleType, string> = {
    member: 'bg-sky-500/10 text-sky-200 border-sky-400/20',
    certificate_holder: 'bg-indigo-500/10 text-indigo-200 border-indigo-400/20',
    related_party: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
    agent: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/20',
    refund_applicant: 'bg-rose-500/10 text-rose-200 border-rose-400/20',
};

const formatAmount = (value?: number) => `₩${Math.round(value || 0).toLocaleString('ko-KR')}`;

export function MembersTable({ members, tableKey, startIndex }: MembersTableProps) {
    const router = useRouter();
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [creatingCaseById, setCreatingCaseById] = useState<Record<string, boolean>>({});

    const handleInlineUpdate = async (id: string, field: 'tier' | 'status' | 'role', value: any, entityIds?: string[]) => {
        const res = await fetch('/api/members/inline-update', {
            method: 'POST',
            body: JSON.stringify({ id, field, value, entity_ids: entityIds }),
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to update');
        }
        router.refresh();
    };

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
            case '제명':
                return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-200 border border-amber-400/20">제명</span>;
            case '비조합원':
                return <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-1 text-xs text-slate-300 border border-slate-400/20">비조합원</span>;
            case '탈퇴':
                return <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-1 text-xs text-rose-200 border border-rose-400/20">탈퇴</span>;
            case '소송':
                return <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-1 text-xs text-purple-200 border border-purple-400/20">소송</span>;
            case '차명':
                return <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2 py-1 text-xs text-sky-200 border border-sky-400/40 font-bold ring-1 ring-sky-500/20">차명</span>;
            default:
                return <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground border border-border">{status || '미지정'}</span>;
        }
    };

    const getRepresentativeDisplay = (relationships?: { id?: string; name: string; relation: string }[] | null) => {
        if (!relationships || relationships.length === 0) return <span className="text-slate-600">-</span>;

        return (
            <div className="flex flex-wrap items-center justify-center gap-1.5">
                {relationships.map((rel, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 rounded-md px-2 py-1">
                        {rel.id ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMemberId(rel.id!);
                                    setDialogOpen(true);
                                }}
                                className="text-[13px] font-bold text-slate-100 hover:text-blue-400 hover:underline transition-colors"
                            >
                                {rel.name}
                            </button>
                        ) : (
                            <span className="text-[13px] font-bold text-slate-100">{rel.name}</span>
                        )}
                        {rel.relation && (
                            <span className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-300 text-[10px] font-bold border border-blue-400/20 leading-none">
                                {rel.relation}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const formatCertificateNumber = (num: string | null, member: Member) => {
        if (!num) return '-';
        // In the future, if we have multiple certs in an array, we'd handle it here.
        // For now, if num contains commas or is known to be multiple:
        return num;
    };

    return (
        <>
            <div className="hidden md:block w-full h-full overflow-auto scrollbar-thin scrollbar-thumb-border/30">
                <table className="w-full text-center bg-card mt-0 text-sm whitespace-nowrap" key={tableKey}>
                    <thead className="sticky top-0 z-10 bg-[#161B22] text-gray-400 font-medium border-b border-white/[0.08]">
                        <tr>
                            <th className="px-2 py-2 w-[50px] text-center"><MaterialIcon name="star" size="sm" className="text-gray-500" /></th>
                            <th className="px-2 py-2 w-[40px] text-center">No.</th>
                            <th className="px-2 py-2"><SortableHeader label="성명" field="name" className="justify-center" /></th>
                            <th className="px-2 py-2"><SortableHeader label="권리증번호" field="member_number" className="justify-center" /></th>
                            <th className="px-2 py-2">구분</th>
                            <th className="px-2 py-2">관계</th>
                            <th className="px-2 py-2"><SortableHeader label="상태" field="status" className="justify-center" /></th>
                            <th className="px-2 py-2"><SortableHeader label="연락처" field="phone" className="justify-center" /></th>
                            <th className="px-2 py-2"><SortableHeader label="정산예정" field="settlement_expected" className="justify-center" /></th>
                            <th className="px-2 py-2">지급</th>
                            <th className="px-2 py-2"><SortableHeader label="잔여" field="settlement_remaining" className="justify-center" /></th>
                            <th className="px-2 py-2">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.08]">
                        {members.map((member, index) => (
                            <tr
                                key={member.id}
                                className={cn(
                                    'group transition-colors h-[46px]',
                                    member.member_id ? 'cursor-pointer hover:bg-white/[0.02]' : 'cursor-default bg-white/[0.01]'
                                )}
                                onClick={() => handleRowClick(member)}
                            >
                                <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
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
                                <td className="px-2 py-1.5 text-center text-gray-500 font-mono text-xs">{startIndex + index + 1}</td>
                                <td className="px-2 py-1.5 text-white font-bold" suppressHydrationWarning>
                                    <div className="flex flex-col items-center">
                                        <div className="flex items-center gap-1.5">
                                            <span>{member.name}</span>
                                            {member.status === '차명' && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[10px] font-black border border-sky-500/20 leading-none">
                                                    명의
                                                </span>
                                            )}
                                        </div>
                                        {member.status === '차명' && member.real_owner && (
                                            <span className="text-[11px] text-sky-400/90 font-bold mt-0.5 flex items-center gap-1">
                                                <MaterialIcon name="link" size="xs" className="text-sky-500/50" />
                                                실소유자: {member.real_owner.name}
                                            </span>
                                        )}
                                        {member.acts_as_agent_for && member.acts_as_agent_for.length > 0 ? (
                                            <span
                                                className="text-[10px] text-amber-500 font-normal mt-0.5 border border-amber-500/20 bg-amber-500/5 px-1 rounded"
                                                title={`이 인물은 ${member.acts_as_agent_for.map(af => `${af.name}${af.type ? ` (${af.type})` : ''} 님`).join(', ')}의 ${member.acts_as_agent_for[0].relation}으로 등록되어 있습니다.`}
                                            >
                                                {member.acts_as_agent_for[0].name}{member.acts_as_agent_for[0].type ? ` (${member.acts_as_agent_for[0].type})` : ''}의 {member.acts_as_agent_for[0].relation}
                                            </span>
                                        ) : member.relationships && member.relationships.length > 0 && (
                                            <span className="text-[10px] text-slate-500 font-normal mt-0.5 uppercase tracking-tighter">
                                                ({member.relationships[0].relation}: {member.relationships[0].name})
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-2 py-1.5 font-medium text-gray-200">{member.member_number || '-'}</td>
                                <td className="px-2 py-1.5">
                                    <InlineCellDropdown
                                        options={[
                                            { label: '조합원(등기)', value: '등기조합원' },
                                            { label: '조합원(지주)', value: '지주조합원' },
                                            { label: '조합원(2차)', value: '2차' },
                                            { label: '일반분양(3차)', value: '일반분양' },
                                            { label: '예비조합원', value: '예비조합원' },
                                            { label: '권리증보유자', value: '권리증보유자' },
                                            { label: '대리인', value: '대리인' },
                                            { label: '관계인', value: '관계인' }
                                        ]}
                                        currentValue={member.tiers || (member.tier ? [member.tier] : [])}
                                        multiple={true}
                                        onSelect={(val) => {
                                            const currentTiers = member.tiers || (member.tier ? [member.tier] : []);
                                            const isSelected = currentTiers.includes(val);
                                            return handleInlineUpdate(member.id, 'role', {
                                                action: isSelected ? 'remove' : 'add',
                                                role_code: val
                                            }, member.entity_ids || [member.id]);
                                        }}
                                        disabled={!member.id}
                                    >
                                        <div className="flex flex-wrap items-center justify-center gap-1 min-h-[32px]">
                                            {(member.role_types || []).length > 0 ? (
                                                (member.role_types || []).map((role) => {
                                                    const primaryTier = (member.tiers || []).find(t =>
                                                        (role === 'member' && (t.includes('차') || t.includes('조합원'))) ||
                                                        (role === 'certificate_holder' && t.includes('권리증'))
                                                    ) || member.tier;

                                                    const displayLabel = (role === 'member' && primaryTier && !primaryTier.includes('대리') && !primaryTier.includes('관계'))
                                                        ? `${roleLabel[role]}(${primaryTier})`
                                                        : roleLabel[role];

                                                    return (
                                                        <span key={`${member.id}-d-${role}`} className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors', roleStyle[role])}>
                                                            {displayLabel}
                                                        </span>
                                                    );
                                                })
                                            ) : (
                                                <span className="text-slate-600">-</span>
                                            )}
                                        </div>
                                    </InlineCellDropdown>
                                </td>
                                <td className="px-2 py-1.5 text-gray-400">{getRepresentativeDisplay(member.relationships)}</td>
                                <td className="px-2 py-1.5 flex justify-center items-center h-[46px]">
                                    <InlineCellDropdown
                                        options={[
                                            { label: '정상', value: '정상', colorClass: 'text-emerald-400' },
                                            { label: '명의대여(차명)', value: '차명', colorClass: 'text-sky-400' },
                                            { label: '소송', value: '소송', colorClass: 'text-purple-400' },
                                            { label: '제명', value: '제명', colorClass: 'text-amber-400' },
                                            { label: '탈퇴', value: '탈퇴', colorClass: 'text-rose-400' },
                                            { label: '비조합원', value: '비조합원', colorClass: 'text-slate-400' },
                                            { label: '미정', value: '미정' }
                                        ]}
                                        currentValue={member.status}
                                        onSelect={(val) => handleInlineUpdate(member.id, 'status', val)}
                                        disabled={!member.id}
                                    >
                                        {getStatusBadge(member.status)}
                                    </InlineCellDropdown>
                                </td>
                                <td className="px-2 py-1.5 text-gray-400 font-mono tracking-tight">
                                    {member.phone ? (
                                        member.phone.includes(',') ? (
                                            <span title={member.phone}>
                                                {member.phone.split(',')[0]} 외 {member.phone.split(',').length - 1}건
                                            </span>
                                        ) : (
                                            member.phone
                                        )
                                    ) : (
                                        '-'
                                    )}
                                </td>
                                <td className="px-2 py-1.5 text-slate-200 font-mono">{formatAmount(member.settlement_expected)}</td>
                                <td className="px-2 py-1.5 text-emerald-300 font-mono">{formatAmount(member.settlement_paid)}</td>
                                <td className="px-2 py-1.5 text-amber-200 font-mono">{formatAmount(member.settlement_remaining)}</td>
                                <td className="px-2 py-1.5">
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
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[15px] font-bold text-white">{member.name}</span>
                                        {member.status === '차명' && (
                                            <span className="text-[9px] font-black bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1 rounded">명의</span>
                                        )}
                                        <span className="text-[11px] text-muted-foreground/60 font-mono">{member.member_number || '-'}</span>
                                    </div>
                                    {member.status === '차명' && member.real_owner && (
                                        <div className="text-[10px] text-sky-400 font-bold mt-0.5 flex items-center gap-1">
                                            <MaterialIcon name="link" size="xs" className="opacity-50" />
                                            실소유자: {member.real_owner.name}
                                        </div>
                                    )}
                                    {member.acts_as_agent_for && member.acts_as_agent_for.length > 0 && (
                                        <div className="text-[10px] text-amber-500 font-medium mt-0.5">
                                            {member.acts_as_agent_for[0].name}님의 {member.acts_as_agent_for[0].relation}
                                        </div>
                                    )}
                                    <div className="text-[12px] text-muted-foreground mt-0.5">{member.unit_group || '동호수미정'}</div>
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
                            {(member.role_types || []).map((role) => {
                                const primaryTier = (member.tiers || []).find(t =>
                                    (role === 'member' && (t.includes('차') || t.includes('조합원'))) ||
                                    (role === 'certificate_holder' && t.includes('권리증'))
                                ) || member.tier;

                                const displayLabel = (role === 'member' && primaryTier && !primaryTier.includes('대리') && !primaryTier.includes('관계'))
                                    ? `${roleLabel[role]}(${primaryTier})`
                                    : roleLabel[role];

                                return (
                                    <span key={`${member.id}-m-${role}`} className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold', roleStyle[role])}>
                                        {displayLabel}
                                    </span>
                                );
                            })}
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
                            <span className="font-mono text-slate-400">
                                {member.phone ? (
                                    member.phone.includes(',') ? `${member.phone.split(',')[0]} 외 ${member.phone.split(',').length - 1}건` : member.phone
                                ) : '전화번호 없음'}
                            </span>
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
                memberIds={members.find(m => m.id === selectedMemberId)?.entity_ids || (selectedMemberId ? [selectedMemberId] : null)}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSaved={() => router.refresh()}
            />
        </>
    );
}
