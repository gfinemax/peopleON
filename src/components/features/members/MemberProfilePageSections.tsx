import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

interface MemberProfileSummary {
    display_name: string;
    member_number: string | null;
    phone: string | null;
    email: string | null;
    address_legal: string | null;
    memo: string | null;
}

interface MemberRelationshipSummary {
    name: string;
    relation: string;
    phone: string | null;
}

interface SettlementSummaryItem {
    label: string;
    value: string;
    emphasis?: boolean;
    muted?: boolean;
}

interface MemberDetailSidebarProps {
    member: MemberProfileSummary;
    memberTier: string;
    memberStatus: string;
    recentActivityLabel: string;
    representative: MemberRelationshipSummary | null;
    settlementStatusLabel?: string;
    settlementAvailable: boolean;
    settlementRows: SettlementSummaryItem[];
    payoutRate: number;
    paidPaymentLabel: string;
    remainingAmountLabel: string;
    settlementCreatedAtLabel?: string;
}

export function MemberDetailSidebar({
    member,
    memberTier,
    memberStatus,
    recentActivityLabel,
    representative,
    settlementStatusLabel,
    settlementAvailable,
    settlementRows,
    payoutRate,
    paidPaymentLabel,
    remainingAmountLabel,
    settlementCreatedAtLabel,
}: MemberDetailSidebarProps) {
    return (
        <div className="w-full lg:w-80 flex flex-col gap-6 flex-shrink-0">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground mb-1">활동 및 상세 정보</h2>
            <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground/40 uppercase tracking-wide mb-2 transition-opacity hover:opacity-100 opacity-60">
                <span>
                    최근 활동: <span className="text-foreground">{recentActivityLabel}</span>
                </span>
            </div>

            <div className="flex flex-col rounded-lg border border-border/50 bg-card p-10 relative shadow-sm group">
                <div className="absolute top-0 right-0 p-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-[11px] font-bold text-success border border-success/30 uppercase tracking-wider badge-glow-success">
                        <span className="size-1.5 rounded-full bg-success" />
                        {memberStatus} (Active)
                    </span>
                </div>

                <div className="flex flex-col items-center text-center mt-4">
                    <div className="relative mb-6">
                        <div className="size-32 rounded-full overflow-hidden border-4 border-border/30 shadow-2xl transition-transform group-hover:scale-105 duration-500">
                            <img
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.display_name}`}
                                alt={member.display_name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-primary text-white size-8 rounded-full flex items-center justify-center shadow-lg border-4 border-card">
                            <MaterialIcon name="verified" size="sm" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">{member.display_name}</h2>
                    <p className="text-sm font-medium text-muted-foreground/60 mt-1">{memberTier} 조합원 | 가입일 2009년 7월 13일</p>
                </div>

                <div className="mt-10 space-y-5">
                    <ProfileInfoItem icon="badge" label="조합원번호" value={member.member_number ?? '-'} />
                    <ProfileInfoItem icon="call" label="연락처" value={member.phone || '010-1234-5678'} isMono />
                    <ProfileInfoItem icon="mail" label="이메일" value={member.email || 'user@example.com'} isMono />
                    <ProfileInfoItem icon="location_on" label="주소" value={member.address_legal || '서울시 강남구 테헤란로 123'} />
                </div>

                <div className="mt-10 pt-10 border-t border-border/30">
                    <h3 className="text-xs font-bold text-muted-foreground/40 uppercase tracking-wider mb-6 px-1">세대 구성원</h3>
                    {representative ? (
                        <div className="flex items-center gap-4 rounded-xl bg-[#0F1115] px-5 py-6 border border-border/10 group/member hover:border-primary/30 transition-all">
                            <div className="size-12 rounded-full overflow-hidden border border-white/10 shadow-inner">
                                <img
                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${representative.name}`}
                                    alt="member"
                                    className="w-full h-full bg-white/5"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <p className="text-sm font-bold text-foreground tracking-tight">
                                    {representative.name}{' '}
                                    <span className="text-muted-foreground font-normal">
                                        ({representative.relation || '관계 미지정'})
                                    </span>
                                </p>
                                <div className="flex items-center gap-2">
                                    {representative.phone && (
                                        <p className="text-xs font-bold text-muted-foreground/80 font-mono tracking-tight flex items-center gap-1.5">
                                            <MaterialIcon name="call" size="xs" className="opacity-50" />
                                            {representative.phone}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center p-4 rounded-lg bg-muted/5 border border-dashed border-border/30 text-xs text-muted-foreground">
                            등록된 세대 구성원이 없습니다.
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-6 border-t border-border/30">
                    <h3 className="text-xs font-bold text-muted-foreground/40 uppercase tracking-wider mb-4 px-1">특이사항</h3>
                    <div className="p-4 rounded-lg bg-card/50 border border-border/40 text-xs font-medium text-muted-foreground leading-relaxed shadow-sm">
                        {member.memo || 'VIP 조합원입니다. 특별 관리가 필요합니다.'}
                    </div>
                </div>
            </div>

            <div className="flex flex-col rounded-lg border border-border/50 bg-card p-8 shadow-sm">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-sm font-black text-foreground">정산 요약</h3>
                        <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                            {settlementAvailable ? '정산 데이터' : '정산 프로필 미연결'}
                        </p>
                    </div>
                    {settlementStatusLabel && (
                        <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary uppercase tracking-wider">
                            {settlementStatusLabel}
                        </span>
                    )}
                </div>

                {!settlementAvailable ? (
                    <div className="rounded-lg border border-dashed border-border/40 bg-muted/5 p-4 text-xs font-medium text-muted-foreground">
                        생성된 정산 케이스가 없습니다.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {settlementRows.map((row) => (
                            <SettlementSummaryRow key={row.label} {...row} />
                        ))}

                        <div className="pt-3 border-t border-border/30 space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-bold">
                                <span className="text-muted-foreground uppercase tracking-wider">지급 진행률</span>
                                <span className="text-foreground font-mono">{payoutRate.toFixed(0)}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted/20 overflow-hidden">
                                <div
                                    className="h-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.3)] transition-all"
                                    style={{ width: `${payoutRate}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-semibold">
                                <span className="text-muted-foreground">지급완료 {paidPaymentLabel}</span>
                                <span className="text-muted-foreground">잔여 {remainingAmountLabel}</span>
                            </div>
                        </div>

                        {settlementCreatedAtLabel && (
                            <div className="pt-3 border-t border-border/30 text-[11px] text-muted-foreground font-semibold">
                                최근 케이스 생성일: {settlementCreatedAtLabel}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function SettlementSummaryRow({
    label,
    value,
    emphasis = false,
    muted = false,
}: SettlementSummaryItem) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">{label}</span>
            <span
                className={cn(
                    'text-sm font-black tracking-wide font-mono text-foreground',
                    emphasis && 'text-xl',
                    muted && 'text-muted-foreground'
                )}
            >
                {value}
            </span>
        </div>
    );
}

function ProfileInfoItem({
    icon,
    label,
    value,
    isMono = false,
}: {
    icon: string;
    label: string;
    value: string;
    isMono?: boolean;
}) {
    return (
        <div className="flex items-center gap-4 group/item">
            <div className="text-muted-foreground/40 group-hover/item:text-primary transition-colors">
                <MaterialIcon name={icon} size="sm" />
            </div>
            <div className="flex flex-col">
                <p className="text-[11px] font-bold text-muted-foreground/30 uppercase tracking-wider">{label}</p>
                <p className={cn('text-sm font-bold text-foreground transition-colors group-hover/item:text-primary', isMono && 'font-mono')}>
                    {value}
                </p>
            </div>
        </div>
    );
}
