"use client";

import { MembersCertificateAnalysisCard } from './MembersCertificateAnalysisCard';
import { CompactDonutCard } from './MembersKpiStripPrimitives';
import {
    formatCount,
    ratio,
    type CertificateBlock,
    type RelationBlock,
    type SummaryBlock,
} from './membersKpiStripUtils';
import type {
    DuplicateSourceDetail,
    MemberHeldDetail,
} from '@/lib/members/sourceCertificateSummary';

interface MembersKpiStripProps {
    households: SummaryBlock;
    certificates: CertificateBlock;
    allSourceDetails: MemberHeldDetail[];
    memberHeldDetails: MemberHeldDetail[];
    memberHeldDetailsInternal: MemberHeldDetail[];
    refundSourceDetails: MemberHeldDetail[];
    duplicateSourceDetails: DuplicateSourceDetail[];
    relations: RelationBlock;
}

export function MembersKpiStrip({
    households,
    certificates,
    allSourceDetails,
    memberHeldDetails,
    memberHeldDetailsInternal,
    refundSourceDetails,
    duplicateSourceDetails,
    relations,
}: MembersKpiStripProps) {
    const householdSegments = [
        { label: '조합원', value: households.members, colorClass: 'bg-sky-400', stroke: '#38bdf8' },
        { label: '추가모집 예정', value: households.recruitmentTarget, colorClass: 'bg-amber-400', stroke: '#fbbf24' },
    ];

    const relationSegments = [
        { label: '대리인', value: relations.agents, colorClass: 'bg-emerald-400', stroke: '#34d399' },
        { label: '관계인', value: relations.others, colorClass: 'bg-teal-200', stroke: '#99f6e4' },
    ];

    return (
        <section className="rounded-2xl border border-white/10 bg-[#0f1725] p-3 lg:p-4">
            <div className="grid gap-3 md:grid-cols-3">
                <CompactDonutCard
                    icon="apartment"
                    title="전체세대"
                    subtitle={`전체 ${households.total.toLocaleString()}세대 기준`}
                    total={households.total}
                    unit="세대"
                    pillText={`조합원 ${ratio(households.members, households.total)}%`}
                    pillClassName="border-sky-400/20 bg-sky-500/10 text-sky-200"
                    segments={householdSegments}
                />

                <MembersCertificateAnalysisCard
                    certificates={certificates}
                    allSourceDetails={allSourceDetails}
                    memberHeldDetails={memberHeldDetails}
                    memberHeldDetailsInternal={memberHeldDetailsInternal}
                    refundSourceDetails={refundSourceDetails}
                    duplicateSourceDetails={duplicateSourceDetails}
                />

                <CompactDonutCard
                    icon="groups_2"
                    title="관계자"
                    subtitle="대리인과 관계인 구성 비율"
                    total={relations.total}
                    unit="명"
                    pillText={`관계자 ${formatCount(relations.total, '명')}`}
                    pillClassName="border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                    segments={relationSegments}
                />
            </div>
        </section>
    );
}
