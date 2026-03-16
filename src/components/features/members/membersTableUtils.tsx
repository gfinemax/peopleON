export type RoleType = 'member' | 'certificate_holder' | 'related_party' | 'refund_applicant' | 'agent';

export type MembersTableMember = {
    id: string;
    member_id: string | null;
    party_id?: string | null;
    name: string;
    member_number?: string | null;
    certificate_display?: string | null;
    phone: string | null;
    tier: string | null;
    status: string | null;
    display_status?: string | null;
    is_registered: boolean;
    unit_group: string | null;
    is_favorite?: boolean;
    relationships?: { id?: string; name: string; relation: string; phone?: string }[] | null;
    role_types?: RoleType[];
    tiers?: string[];
    source_type?: 'member' | 'party_only';
    ui_role?: 'member' | 'landowner' | 'general' | 'investor' | 'agent' | 'party' | 'other';
    settlement_status?: 'draft' | 'review' | 'approved' | 'paid' | 'rejected' | null;
    settlement_expected?: number;
    settlement_paid?: number;
    settlement_remaining?: number;
    is_settlement_eligible?: boolean;
    is_duplicate_name?: boolean;
    entity_ids?: string[];
    acts_as_agent_for?: { id?: string; name: string; relation: string; type: string }[] | null;
    real_owner?: { id: string; name: string } | null;
    nominees?: { id: string; name: string }[] | null;
    _matchedLog?: boolean;
    recent_activity_summary?: string | null;
    recent_activity_title?: string | null;
    recent_activity_time?: string | null;
    raw_certificate_count: number;
    managed_certificate_count: number;
    has_merged_certificates: boolean;
};

export type DetailTab = 'info' | 'timeline' | 'payment' | 'admin';

type CertificateDisplayItem = {
    value: string;
    isManaged: boolean;
};

const formatAmount = (value?: number) => `₩${Math.round(value || 0).toLocaleString('ko-KR')}`;

const settlementStatusLabel: Record<NonNullable<MembersTableMember['settlement_status']>, string> = {
    draft: '작성중',
    review: '검토중',
    approved: '승인',
    paid: '지급완료',
    rejected: '반려',
};

export const roleLabel: Record<RoleType, string> = {
    member: '조합원',
    certificate_holder: '권리증보유',
    related_party: '관계인',
    refund_applicant: '환불신청',
    agent: '대리인',
};

export const roleStyle: Record<RoleType, string> = {
    member: 'bg-sky-500/10 text-sky-200 border-sky-400/20',
    certificate_holder: 'bg-indigo-500/10 text-indigo-200 border-indigo-400/20',
    related_party: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
    agent: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/20',
    refund_applicant: 'bg-rose-500/10 text-rose-200 border-rose-400/20',
};

export const parseCertificateDisplay = (value?: string | null): CertificateDisplayItem[] =>
    (value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => item !== '-')
        .map((item) => ({
            value: item.replace(/\s*\[통합\]\s*$/u, ''),
            isManaged: item.includes('[통합]'),
        }));

export const getRightsFlowText = (member: MembersTableMember) => {
    const raw = member.raw_certificate_count;
    const managed = member.managed_certificate_count;

    if ((raw === 0 && managed === 0) || (raw === 1 && managed === 1)) {
        return '유지';
    }

    if (raw > managed) {
        return `통합됨 (${raw}→${managed})`;
    }

    return `${raw}원천 → ${managed}관리`;
};

export const getSettlementSummary = (member: MembersTableMember) => {
    if (!member.is_settlement_eligible) {
        return {
            label: '해당없음',
            detail: null,
            className: 'border-white/[0.08] bg-white/[0.03] text-slate-300',
            textClassName: 'text-slate-300',
        };
    }

    if (!member.party_id) {
        return {
            label: '대상 연결 필요',
            detail: null,
            className: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
            textClassName: 'text-amber-200',
        };
    }

    if (!member.settlement_status) {
        return {
            label: '정산대상',
            detail: null,
            className: 'border-sky-400/20 bg-sky-500/10 text-sky-200',
            textClassName: 'text-sky-200',
        };
    }

    if (member.settlement_remaining && member.settlement_remaining > 0) {
        return {
            label: '잔여 있음',
            detail: formatAmount(member.settlement_remaining),
            className: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
            textClassName: 'text-amber-200',
        };
    }

    if (member.settlement_status === 'paid') {
        return {
            label: '지급완료',
            detail: member.settlement_expected && member.settlement_expected > 0 ? formatAmount(member.settlement_expected) : null,
            className: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
            textClassName: 'text-emerald-200',
        };
    }

    return {
        label: '정산 진행중',
        detail: settlementStatusLabel[member.settlement_status] || null,
        className: 'border-violet-400/20 bg-violet-500/10 text-violet-200',
        textClassName: 'text-violet-200',
    };
};

export const getStatusBadge = (status: string | null) => {
    switch (status) {
        case '정상':
            return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 border border-emerald-400/20">정상</span>;
        case '환불':
            return <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200 border border-cyan-400/20">환불</span>;
        case '제명':
            return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-200 border border-amber-400/20">제명</span>;
        case '탈퇴':
            return <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-1 text-xs text-rose-200 border border-rose-400/20">탈퇴</span>;
        case '차명':
            return <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2 py-1 text-xs text-sky-200 border border-sky-400/40 font-bold ring-1 ring-sky-500/20">명의대여</span>;
        default:
            return <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground border border-border">{status || '미지정'}</span>;
    }
};

export const getRepresentativeDisplay = (
    relationships: MembersTableMember['relationships'],
    openMemberDetail: (memberId: string, initialTab?: DetailTab) => void,
) => {
    if (!relationships || relationships.length === 0) return <span className="text-slate-600">-</span>;

    return (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
            {relationships.map((rel, idx) => (
                <div key={idx} className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 rounded-md px-2 py-1">
                    {rel.id ? (
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                openMemberDetail(rel.id!, 'info');
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

export const getMemberPhoneSummary = (phone: string | null) => {
    if (!phone) return '-';
    return phone.includes(',') ? `${phone.split(',')[0]} 외 ${phone.split(',').length - 1}건` : phone;
};

export const getRoleDisplayLabel = (member: MembersTableMember, role: RoleType) => {
    const primaryTier = (member.tiers || []).find((tier) =>
        (role === 'member' && (tier.includes('차') || tier.includes('조합원') || tier === '지주' || tier === '일반분양')) ||
        (role === 'certificate_holder' && tier.includes('권리증')) ||
        (role === 'related_party' && tier === '관계인') ||
        (role === 'agent' && tier === '대리인')
    ) || member.tier;

    if (role === 'member' && primaryTier) {
        if (primaryTier === '등기조합원') return '조합원(등기)';
        if (primaryTier === '지주조합원') return '조합원(지주)';
        if (primaryTier === '2차') return '조합원(2차)';
        if (primaryTier === '일반분양') return '조합원(일반분양)';
        if (primaryTier === '예비조합원') return '조합원(예비)';
        if (primaryTier === '지주') return '원지주';
    }

    if (role === 'certificate_holder') {
        return '권리증보유';
    }

    return roleLabel[role];
};

export const getRolePriority = (member: MembersTableMember, role: RoleType) => {
    const primaryTier = (member.tiers || []).find((tier) =>
        (role === 'member' && (tier.includes('차') || tier.includes('조합원') || tier === '지주' || tier === '일반분양')) ||
        (role === 'certificate_holder' && tier.includes('권리증')) ||
        (role === 'related_party' && tier === '관계인') ||
        (role === 'agent' && tier === '대리인')
    ) || member.tier;

    const priorityMap: Record<string, number> = {
        '등기조합원': 1,
        '지주조합원': 2,
        '2차': 3,
        '일반분양': 4,
        '예비조합원': 5,
        '권리증보유자': 6,
        '지주': 7,
        '대리인': 8,
        '관계인': 9,
    };

    if (role === 'certificate_holder') return 6;
    if (role === 'agent') return 8;
    if (role === 'related_party') return 9;
    if (role === 'member' && primaryTier) return priorityMap[primaryTier] || 10;
    return 99;
};
