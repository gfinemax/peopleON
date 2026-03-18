'use client';

import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { InlineCellDropdown } from './InlineCellDropdown';
import { SortableHeader } from './SortableHeader';
import {
    getManagedCertificateValues,
    getSourceCertificateValues,
    MemberNameCell,
    MemberRoleBadges,
    MembersTableSectionsProps,
    roleOptions,
    statusOptions,
} from './MembersTableSectionHelpers';
import {
    getMemberPhoneSummary,
    getRepresentativeDisplay,
    getRightsFlowText,
    getSettlementSummary,
    getStatusBadge,
} from './membersTableUtils';

export function MembersDesktopTable(props: MembersTableSectionsProps) {
    const { members, tableKey, startIndex, onInlineUpdate, onOpenMemberDetail, onRowClick, onToggleFavorite } = props;

    return (
        <div className="hidden h-full w-full overflow-auto scrollbar-thin scrollbar-thumb-border/30 md:block">
            <table className="mt-0 w-full whitespace-nowrap bg-card text-center text-sm" key={tableKey}>
                <thead className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#161B22] font-medium text-gray-400">
                    <tr>
                        <th className="w-[50px] px-2 py-2 text-center">
                            <MaterialIcon name="star" size="sm" className="text-gray-500" />
                        </th>
                        <th className="w-[40px] px-2 py-2 text-center">No.</th>
                        <th className="px-2 py-2">구분</th>
                        <th className="px-2 py-2">
                            <SortableHeader label="성명" field="name" className="justify-center" />
                        </th>
                        <th className="px-2 py-2">
                            <SortableHeader label="권리증번호" field="member_number" className="justify-center" />
                        </th>
                        <th className="px-2 py-2">권리 흐름</th>
                        <th className="px-2 py-2">관계</th>
                        <th className="px-2 py-2">
                            <SortableHeader label="상태" field="status" className="justify-center" />
                        </th>
                        <th className="px-2 py-2">
                            <SortableHeader label="연락처" field="phone" className="justify-center" />
                        </th>
                        <th className="px-2 py-2">정산 요약</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.08]">
                    {members.map((member, index) => {
                        const sourceValues = getSourceCertificateValues(member);
                        const managedValues = getManagedCertificateValues(member);
                        const settlementSummary = getSettlementSummary(member);

                        return (
                            <tr
                                key={member.id}
                                className={cn(
                                    'group h-[46px] transition-colors',
                                    member.member_id ? 'cursor-pointer hover:bg-white/[0.02]' : 'cursor-default bg-white/[0.01]',
                                )}
                                onClick={() => onRowClick(member)}
                            >
                                <td className="px-2 py-1.5 text-center" onClick={(event) => event.stopPropagation()}>
                                    {member.member_id ? (
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                void onToggleFavorite(member);
                                            }}
                                            className="rounded-full p-1.5 transition-colors hover:bg-white/10"
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
                                <td className="px-2 py-1.5 text-center font-mono text-xs text-gray-500">{startIndex + index + 1}</td>
                                <td className="px-2 py-1.5">
                                    <InlineCellDropdown
                                        options={roleOptions}
                                        currentValue={member.tiers || (member.tier ? [member.tier] : [])}
                                        multiple={true}
                                        onSelect={(value) => {
                                            const currentTiers = member.tiers || (member.tier ? [member.tier] : []);
                                            const isSelected = currentTiers.includes(value);
                                            return onInlineUpdate(
                                                member.id,
                                                'role',
                                                { action: isSelected ? 'remove' : 'add', role_code: value },
                                                member.entity_ids || [member.id],
                                            );
                                        }}
                                        disabled={!member.id}
                                    >
                                        <div className="flex min-h-[32px] flex-wrap items-center justify-center gap-1">
                                            <MemberRoleBadges member={member} />
                                        </div>
                                    </InlineCellDropdown>
                                </td>
                                <td className="px-2 py-1.5 font-bold text-white" suppressHydrationWarning>
                                    <MemberNameCell member={member} onOpenMemberDetail={onOpenMemberDetail} />
                                </td>
                                <td
                                    className="px-2 py-1.5 font-medium text-gray-200"
                                    onClick={(event) => event.stopPropagation()}
                                    suppressHydrationWarning
                                >
                                    {sourceValues.length === 0 ? (
                                        <span className="text-slate-600">-</span>
                                    ) : (
                                        <div className="flex flex-col gap-1">
                                            {sourceValues.map((value, valueIndex) => (
                                                <button
                                                    key={`${member.id}-source-cert-${valueIndex}`}
                                                    type="button"
                                                    onClick={() => member.member_id && onOpenMemberDetail(member.member_id, 'admin')}
                                                    className="flex items-center gap-1.5 break-all text-left font-mono transition-colors hover:text-blue-300 disabled:cursor-default disabled:hover:text-inherit"
                                                    disabled={!member.member_id}
                                                    title={value}
                                                >
                                                    <span className="text-slate-200">{value}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td className="px-2 py-1.5 align-middle" onClick={(event) => event.stopPropagation()}>
                                    <div className="flex flex-col items-center justify-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => member.member_id && onOpenMemberDetail(member.member_id, 'admin')}
                                            className="min-w-[92px] rounded-md border border-white/10 bg-white/[0.05] px-2 py-0.5 text-center text-[13px] font-bold text-slate-200 transition-colors hover:border-blue-400/30 hover:text-blue-300 disabled:cursor-default disabled:hover:border-white/10 disabled:hover:text-slate-200"
                                            title={`원천 ${member.raw_certificate_count}장, 현재 관리 ${member.managed_certificate_count}건`}
                                            disabled={!member.member_id}
                                        >
                                            {getRightsFlowText(member)}
                                        </button>
                                        {managedValues.map((value, valueIndex) => (
                                            <button
                                                key={`${member.id}-flow-managed-${valueIndex}`}
                                                type="button"
                                                onClick={() => member.member_id && onOpenMemberDetail(member.member_id, 'admin')}
                                                className="flex items-center gap-1.5 break-all text-left font-mono transition-colors hover:text-blue-300 disabled:cursor-default disabled:hover:text-inherit"
                                                disabled={!member.member_id}
                                                title={value}
                                            >
                                                <span className="rounded border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-black leading-none text-purple-300">
                                                    통합번호
                                                </span>
                                                <span className="text-purple-300">{value}</span>
                                            </button>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-2 py-1.5 text-gray-400">
                                    {getRepresentativeDisplay(member.relationships, onOpenMemberDetail)}
                                </td>
                                <td className="flex h-[46px] items-center justify-center px-2 py-1.5">
                                    <InlineCellDropdown
                                        options={statusOptions}
                                        currentValue={member.display_status || member.status}
                                        onSelect={(value) => onInlineUpdate(member.id, 'status', value, member.entity_ids || [member.id])}
                                        disabled={!member.id}
                                    >
                                        {getStatusBadge(member.display_status || member.status)}
                                    </InlineCellDropdown>
                                </td>
                                <td className="px-2 py-1.5 font-mono tracking-tight text-gray-400">
                                    {member.phone ? (
                                        member.phone.includes(',') ? <span title={member.phone}>{getMemberPhoneSummary(member.phone)}</span> : member.phone
                                    ) : (
                                        '-'
                                    )}
                                </td>
                                <td className="px-2 py-1.5">
                                    <div className="flex flex-col items-center justify-center gap-1">
                                        <span className={cn('rounded border px-2 py-1 text-[10px] font-semibold', settlementSummary.className)}>
                                            {settlementSummary.label}
                                        </span>
                                        {settlementSummary.detail && <span className="text-[11px] font-mono text-slate-300">{settlementSummary.detail}</span>}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
