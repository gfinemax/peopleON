import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { InteractionLog } from '@/components/features/timeline/TimelineItem';
import { LegacyHistoryCard } from '@/components/features/members/LegacyHistoryCard';
import { MemberDetailRightPanel } from '@/components/features/members/MemberDetailRightPanel';

export default async function MemberDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const supabase = await createClient();
    const { id } = await params;

    // Fetch Member
    const { data: member, error: memberError } = await supabase
        .from('members')
        .select(`
            *,
            relationships (
                name,
                relation,
                phone
            )
        `)
        .eq('id', id)
        .single();

    if (memberError || !member) {
        return <div className="p-20 text-center font-bold text-muted-foreground">존재하지 않는 조합원입니다.</div>;
    }

    console.log('Member Data:', JSON.stringify(member, null, 2));

    const representative = member.relationships?.[0];

    // ... existing code ...

    <div className="mt-10 pt-10 border-t border-border/30">
        <h3 className="text-xs font-bold text-muted-foreground/40 uppercase tracking-wider mb-6 px-1">세대 구성원</h3>
        {representative ? (
            <div className="flex items-center gap-4 rounded-lg bg-muted/10 p-4 border border-border/20 group/member hover:bg-muted/20 transition-all">
                <div className="size-11 rounded-lg overflow-hidden shadow-sm">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${representative.name}`} alt="member" className="w-full h-full" />
                </div>
                <div className="flex flex-col">
                    <p className="text-sm font-black text-foreground">
                        {representative.name} <span className="text-muted-foreground font-medium">({representative.relation || '관계 미지정'})</span>
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground/60 mt-0.5">대리인</p>
                </div>
            </div>
        ) : (
            <div className="flex items-center justify-center p-4 rounded-lg bg-muted/5 border border-dashed border-border/30 text-xs text-muted-foreground">
                등록된 세대 구성원이 없습니다.
            </div>
        )}
    </div>
    // Fetch Interaction Logs
    const { data: logsData } = await supabase
        .from('interaction_logs')
        .select('*')
        .eq('member_id', id)
        .order('created_at', { ascending: false });

    // Fetch Legacy Records
    const { data: legacyRecords } = await supabase
        .from('legacy_records')
        .select('*')
        .eq('member_id', id)
        .order('created_at', { ascending: false });

    const logs = (logsData || []) as InteractionLog[];

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden font-sans">
            <Header title="조합원 상세 관리" />

            <main className="flex-1 overflow-y-auto">
                <div className="flex flex-col lg:flex-row gap-8 p-8 lg:p-10 max-w-[1600px] mx-auto w-full h-full">
                    {/* --- Left Sidebar: Profile Card --- */}
                    <div className="w-full lg:w-80 flex flex-col gap-6 flex-shrink-0">
                        {/* 1. Page Breadcrumbs for Mobile/Tablet context */}
                        {/* 1. Page Breadcrumbs for Mobile/Tablet context - REPLACED with Recent Activity */}
                        <h2 className="text-xl font-extrabold tracking-tight text-foreground mb-1">활동 및 상세 정보</h2>
                        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground/40 uppercase tracking-wide mb-2 transition-opacity hover:opacity-100 opacity-60">
                            <span>최근 활동: <span className="text-foreground">{logs[0]?.created_at ? new Date(logs[0].created_at).toLocaleDateString() : '2023-10-25'} (전화 상담)</span></span>
                        </div>

                        {/* 2. Main Profile Card */}
                        <div className="flex flex-col rounded-lg border border-border/50 bg-card p-10 relative shadow-sm group">
                            <div className="absolute top-0 right-0 p-4">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-[11px] font-bold text-success border border-success/30 uppercase tracking-wider badge-glow-success">
                                    <span className="size-1.5 rounded-full bg-success" />
                                    {member.status} (Active)
                                </span>
                            </div>

                            <div className="flex flex-col items-center text-center mt-4">
                                <div className="relative mb-6">
                                    <div className="size-32 rounded-full overflow-hidden border-4 border-border/30 shadow-2xl transition-transform group-hover:scale-105 duration-500">
                                        <img
                                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`}
                                            alt={member.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 bg-primary text-white size-8 rounded-full flex items-center justify-center shadow-lg border-4 border-card">
                                        <MaterialIcon name="verified" size="sm" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                                    {member.name}
                                </h2>
                                <p className="text-sm font-medium text-muted-foreground/60 mt-1">
                                    {member.tier} 조합원 | 가입일 2009년 7월 13일
                                </p>
                            </div>

                            <div className="mt-10 space-y-5">
                                <ProfileInfoItem icon="badge" label="조합원번호" value={member.member_number} />
                                <ProfileInfoItem icon="call" label="연락처" value={member.phone || "010-1234-5678"} isMono />
                                <ProfileInfoItem icon="mail" label="이메일" value={member.email || "user@example.com"} isMono />
                                <ProfileInfoItem icon="location_on" label="주소" value={member.address_legal || "서울시 강남구 테헤란로 123"} />
                            </div>

                            <div className="mt-10 pt-10 border-t border-border/30">
                                <h3 className="text-xs font-bold text-muted-foreground/40 uppercase tracking-wider mb-6 px-1">세대 구성원</h3>
                                {representative ? (
                                    <div className="flex items-center gap-4 rounded-xl bg-[#0F1115] px-5 py-6 border border-border/10 group/member hover:border-primary/30 transition-all">
                                        <div className="size-12 rounded-full overflow-hidden border border-white/10 shadow-inner">
                                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${representative.name}`} alt="member" className="w-full h-full bg-white/5" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <p className="text-sm font-bold text-foreground tracking-tight">
                                                {representative.name} <span className="text-muted-foreground font-normal">({representative.relation || '관계 미지정'})</span>
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
                                    {member.memo || "🔥 VIP 조합원입니다. 특별 관리가 필요합니다."}
                                </div>
                            </div>
                        </div>

                        {/* 3. Financial Summary Card */}
                        <div className="flex flex-col rounded-lg border border-border/50 bg-card p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-sm font-black text-foreground">납부 요약</h3>
                                <button className="text-[10px] font-black text-primary hover:underline underline-offset-4 uppercase tracking-widest">상세보기</button>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">총 납부액</p>
                                    <p className="text-2xl font-black text-foreground tracking-widest font-mono">₩10,000,000</p>
                                    <div className="h-2 w-full rounded-full bg-muted/20 overflow-hidden">
                                        <div className="h-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.3)]" style={{ width: '80%' }} />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t border-border/30">
                                    <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">미납금</span>
                                    <span className="text-lg font-black text-destructive tracking-widest font-mono">₩2,500,000</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- Right Content Area --- */}
                    <MemberDetailRightPanel memberId={id} legacyRecords={legacyRecords || []} />
                </div>
            </main>
        </div>
    );
}

function ProfileInfoItem({ icon, label, value, isMono = false }: any) {
    return (
        <div className="flex items-center gap-4 group/item">
            <div className="text-muted-foreground/40 group-hover/item:text-primary transition-colors">
                <MaterialIcon name={icon} size="sm" />
            </div>
            <div className="flex flex-col">
                <p className="text-[11px] font-bold text-muted-foreground/30 uppercase tracking-wider">{label}</p>
                <p className={cn("text-sm font-bold text-foreground transition-colors group-hover/item:text-primary", isMono && "font-mono")}>{value}</p>
            </div>
        </div>
    );
}

