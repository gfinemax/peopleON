'use client';

import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import {
    getManagedCertificateValues,
    getSourceCertificateValues,
    MemberRoleBadges,
    MembersTableSectionsProps,
} from './MembersTableSectionHelpers';
import { getMemberPhoneSummary, getRightsFlowText, getSettlementSummary, getStatusBadge } from './membersTableUtils';

export function MembersMobileList({
    members,
    startIndex,
    onOpenMemberDetail,
    onRowClick,
    onToggleFavorite,
}: Pick<MembersTableSectionsProps, 'members' | 'startIndex' | 'onOpenMemberDetail' | 'onRowClick' | 'onToggleFavorite'>) {
    return (
        <div className="block max-h-[68vh] w-full space-y-3 overflow-y-auto overflow-x-hidden px-0 py-2 pb-24 scrollbar-hide md:hidden">
            {members.map((member, index) => {
                const sourceValues = getSourceCertificateValues(member);
                const managedValues = getManagedCertificateValues(member);
                const settlementSummary = getSettlementSummary(member);

                return (
                    <div
                        key={member.id}
                        onClick={() => onRowClick(member)}
                        className={cn(
                            'relative mx-3 flex flex-col gap-2 overflow-hidden rounded-xl border border-white/[0.08] bg-[#161B22]/50 p-3 pr-4 shadow-sm transition-all',
                            member.member_id ? 'hover:bg-[#161B22] active:scale-[0.98]' : 'opacity-90',
                        )}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-[13px] font-bold text-primary ring-1 ring-primary/20">
                                    {startIndex + index + 1}
                                </span>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[15px] font-bold text-white">{member.name}</span>
                                        {member.status === '차명' && (
                                            <span className="rounded border border-sky-500/20 bg-sky-500/10 px-1 text-[9px] font-black text-sky-400">명의</span>
                                        )}
                                    </div>
                                    {sourceValues.length === 0 ? (
                                        <span className="font-mono text-[11px] text-muted-foreground/60">-</span>
                                    ) : (
                                        <div className="mt-0.5 flex flex-col items-start gap-0.5">
                                            {sourceValues.map((value, valueIndex) => (
                                                <button
                                                    key={`${member.id}-mobile-source-${valueIndex}`}
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        if (member.member_id) onOpenMemberDetail(member.member_id, 'admin');
                                                    }}
                                                    className="break-all text-left font-mono text-[11px] text-muted-foreground/60 transition-colors hover:text-blue-300 disabled:cursor-default disabled:hover:text-inherit"
                                                    disabled={!member.member_id}
                                                    title={value}
                                                >
                                                    {value}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {member.status === '차명' && member.real_owner && (
                                        <div className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-sky-400">
                                            <MaterialIcon name="link" size="xs" className="opacity-50" />
                                            실소유자: {member.real_owner.name}
                                        </div>
                                    )}
                                    {member.acts_as_agent_for && member.acts_as_agent_for.length > 0 && (
                                        <div className="mt-0.5 text-[10px] font-medium text-amber-500">
                                            {member.acts_as_agent_for[0].name}님의 {member.acts_as_agent_for[0].relation}
                                        </div>
                                    )}
                                    {member.recent_activity_summary && member.member_id && (
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onOpenMemberDetail(member.member_id!, 'timeline');
                                            }}
                                            className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full border border-violet-400/15 bg-violet-500/10 px-2 py-1 text-[10px] font-medium text-violet-200 transition-colors hover:bg-violet-500/15 hover:text-white"
                                            title={`${member.recent_activity_title || '최근 활동'} · ${member.recent_activity_summary}`}
                                        >
                                            <MaterialIcon name="history" size="xs" className="text-violet-300" />
                                            <span className="truncate">
                                                {member.recent_activity_time} · {member.recent_activity_summary}
                                            </span>
                                        </button>
                                    )}
                                    <div className="mt-0.5 text-[12px] text-muted-foreground">{member.unit_group || '동호수미정'}</div>
                                </div>
                            </div>
                            {member.member_id ? (
                                <button
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        void onToggleFavorite(member);
                                    }}
                                    className="p-2 text-gray-500 transition-all hover:text-yellow-400 active:scale-95"
                                >
                                    <MaterialIcon
                                        name={member.is_favorite ? 'star' : 'star_border'}
                                        size="md"
                                        className={member.is_favorite ? 'text-yellow-400' : 'text-gray-600'}
                                        filled={member.is_favorite}
                                    />
                                </button>
                            ) : (
                                <span className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-500">비연결</span>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            <MemberRoleBadges member={member} />
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="rounded-md border border-white/[0.06] bg-[#0d1523] p-2">
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        if (member.member_id) onOpenMemberDetail(member.member_id, 'admin');
                                    }}
                                    className="w-full text-center transition-colors hover:text-blue-300 disabled:cursor-default disabled:hover:text-inherit"
                                    disabled={!member.member_id}
                                >
                                    <p className="text-[10px] text-slate-400">권리 흐름</p>
                                    <p className="text-xs font-mono text-slate-200">{getRightsFlowText(member)}</p>
                                </button>
                                {managedValues.map((value, valueIndex) => (
                                    <button
                                        key={`${member.id}-mobile-flow-managed-${valueIndex}`}
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            if (member.member_id) onOpenMemberDetail(member.member_id, 'admin');
                                        }}
                                        className="mt-1 inline-flex items-center gap-1 break-all text-left font-mono text-[11px] text-purple-300 transition-colors hover:text-purple-200 disabled:cursor-default disabled:hover:text-inherit"
                                        disabled={!member.member_id}
                                        title={value}
                                    >
                                        <span className="rounded border border-purple-500/20 bg-purple-500/10 px-1 py-0.5 text-[9px] font-black leading-none">
                                            통합번호
                                        </span>
                                        <span>{value}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="rounded-md border border-white/[0.06] bg-[#0d1523] p-2">
                                <p className="text-[10px] text-slate-400">정산 요약</p>
                                <p className={cn('mt-1 text-xs font-semibold', settlementSummary.textClassName)}>
                                    {settlementSummary.label}
                                </p>
                                {settlementSummary.detail && <p className="mt-1 text-xs font-mono text-slate-300">{settlementSummary.detail}</p>}
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-[12px]">
                            <span className="font-mono text-slate-400">
                                {member.phone ? getMemberPhoneSummary(member.phone) : '전화번호 없음'}
                            </span>
                            {getStatusBadge(member.display_status || member.status)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
