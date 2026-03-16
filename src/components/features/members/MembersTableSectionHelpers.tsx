'use client';

import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import {
    getRoleDisplayLabel,
    getRolePriority,
    parseCertificateDisplay,
    roleStyle,
    type DetailTab,
    type MembersTableMember as Member,
} from './membersTableUtils';

export type InlineUpdateField = 'tier' | 'status' | 'role';

export type MembersTableSectionsProps = {
    members: Member[];
    tableKey: string;
    startIndex: number;
    onInlineUpdate: (id: string, field: InlineUpdateField, value: unknown, entityIds?: string[]) => Promise<void>;
    onOpenMemberDetail: (memberId: string, initialTab?: DetailTab) => void;
    onRowClick: (member: Member) => void;
    onToggleFavorite: (member: Member) => Promise<void>;
};

export const roleOptions = [
    { label: '조합원(등기)', value: '등기조합원' },
    { label: '조합원(지주)', value: '지주조합원' },
    { label: '조합원(2차)', value: '2차' },
    { label: '조합원(일반분양)', value: '일반분양' },
    { label: '조합원(예비)', value: '예비조합원' },
    { label: '권리증보유', value: '권리증보유자' },
    { label: '원지주', value: '지주' },
    { label: '대리인', value: '대리인' },
    { label: '관계인', value: '관계인' },
];

export const statusOptions = [
    { label: '정상', value: '정상', colorClass: 'text-emerald-400' },
    { label: '환불', value: '환불', colorClass: 'text-cyan-300' },
    { label: '명의대여', value: '차명', colorClass: 'text-sky-400' },
    { label: '제명', value: '제명', colorClass: 'text-amber-400' },
    { label: '탈퇴', value: '탈퇴', colorClass: 'text-rose-400' },
];

export const getSourceCertificateValues = (member: Member) =>
    parseCertificateDisplay(member.certificate_display)
        .filter((item) => !item.isManaged)
        .map((item) => item.value);

export const getManagedCertificateValues = (member: Member) =>
    parseCertificateDisplay(member.certificate_display)
        .filter((item) => item.isManaged)
        .map((item) => item.value);

export function MemberRoleBadges({ member }: { member: Member }) {
    if ((member.role_types || []).length === 0) {
        return <span className="text-slate-600">-</span>;
    }

    return (
        <>
            {(member.role_types || [])
                .map((role) => ({ role, priority: getRolePriority(member, role) }))
                .sort((a, b) => a.priority - b.priority)
                .map(({ role }) => (
                    <span
                        key={`${member.id}-role-${role}`}
                        className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors',
                            roleStyle[role],
                        )}
                    >
                        {getRoleDisplayLabel(member, role)}
                    </span>
                ))}
        </>
    );
}

export function MemberNameCell({
    member,
    onOpenMemberDetail,
}: {
    member: Member;
    onOpenMemberDetail: MembersTableSectionsProps['onOpenMemberDetail'];
}) {
    return (
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
                <span>{member.name}</span>
                {member.status === '차명' && (
                    <span className="inline-flex items-center rounded border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-black leading-none text-sky-400">
                        명의
                    </span>
                )}
            </div>
            {member.status === '차명' && member.real_owner && (
                <span className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-sky-400/90">
                    <MaterialIcon name="link" size="xs" className="text-sky-500/50" />
                    실소유자: {member.real_owner.name}
                </span>
            )}
            {member.acts_as_agent_for && member.acts_as_agent_for.length > 0 ? (
                <span
                    className="mt-0.5 rounded border border-amber-500/20 bg-amber-500/5 px-1 text-[10px] font-normal text-amber-500"
                    title={`이 인물은 ${member.acts_as_agent_for.map((agent) => `${agent.name}${agent.type ? ` (${agent.type})` : ''} 님`).join(', ')}의 ${member.acts_as_agent_for[0].relation}으로 등록되어 있습니다.`}
                >
                    {member.acts_as_agent_for[0].name}
                    {member.acts_as_agent_for[0].type ? ` (${member.acts_as_agent_for[0].type})` : ''}의{' '}
                    {member.acts_as_agent_for[0].relation}
                </span>
            ) : member.relationships && member.relationships.length > 0 ? (
                <span className="mt-0.5 text-[10px] font-normal uppercase tracking-tighter text-slate-500">
                    ({member.relationships[0].relation}: {member.relationships[0].name})
                </span>
            ) : null}
            {member.recent_activity_summary && member.member_id && (
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onOpenMemberDetail(member.member_id!, 'timeline');
                    }}
                    className="mt-1 inline-flex max-w-[240px] items-center gap-1 rounded-full border border-violet-400/15 bg-violet-500/10 px-2 py-1 text-[10px] font-medium text-violet-200 transition-colors hover:bg-violet-500/15 hover:text-white"
                    title={`${member.recent_activity_title || '최근 활동'} · ${member.recent_activity_summary}`}
                >
                    <MaterialIcon name="history" size="xs" className="text-violet-300" />
                    <span className="truncate">
                        {member.recent_activity_time} · {member.recent_activity_summary}
                    </span>
                </button>
            )}
        </div>
    );
}
