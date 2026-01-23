import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { InteractionLog } from '@/components/features/timeline/TimelineItem';

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
        .select('*')
        .eq('id', id)
        .single();

    if (memberError || !member) {
        return <div className="p-20 text-center font-bold text-muted-foreground">존재하지 않는 조합원입니다.</div>;
    }

    // Fetch Interaction Logs
    const { data: logsData } = await supabase
        .from('interaction_logs')
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
                        <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] mb-2">
                            <span>홈</span> / <span>조합원 관리</span> / <span className="text-foreground">조합원 상세</span>
                        </div>

                        {/* 2. Main Profile Card */}
                        <div className="flex flex-col rounded-3xl border border-border/50 bg-card p-10 relative overflow-hidden shadow-sm group">
                            <div className="absolute top-0 right-0 p-4">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-[10px] font-black text-success border border-success/20 uppercase tracking-widest">
                                    <span className="size-1.5 rounded-full bg-success animate-pulse" />
                                    {member.status} (Active)
                                </span>
                            </div>

                            <div className="flex flex-col items-center text-center mt-4">
                                <div className="relative mb-6">
                                    <div className="size-32 rounded-3xl overflow-hidden border-4 border-border/30 shadow-2xl transition-transform group-hover:scale-105 duration-500">
                                        <img
                                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`}
                                            alt={member.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 bg-primary text-white size-8 rounded-xl flex items-center justify-center shadow-lg border-2 border-card">
                                        <MaterialIcon name="verified" size="sm" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-black text-foreground tracking-tight">
                                    {member.name}
                                    <span className="text-sm font-bold text-muted-foreground ml-2 block sm:inline">
                                        ({member.name_en || 'Kim Chul-soo'})
                                    </span>
                                </h2>
                                <p className="text-xs font-black text-muted-foreground/60 uppercase tracking-[0.3em] mt-2">
                                    {member.tier} 조합원 | {new Date(member.created_at).toLocaleDateString()} 가입
                                </p>
                            </div>

                            <div className="mt-10 space-y-5">
                                <ProfileInfoItem icon="home" label="동호수" value={member.unit_group || "101동 1204호"} />
                                <ProfileInfoItem icon="call" label="연락처" value={member.phone || "010-1234-5678"} isMono />
                                <ProfileInfoItem icon="mail" label="이메일" value={member.email || "kimcs@email.com"} />
                                <ProfileInfoItem icon="location_on" label="주소" value={member.address_legal || "서울시 강남구 테헤란로 123"} />
                            </div>

                            <div className="mt-10 pt-10 border-t border-border/30">
                                <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-6 px-1">세대 구성원</h3>
                                <div className="flex items-center gap-4 rounded-2xl bg-muted/10 p-4 border border-border/20 group/member hover:bg-muted/20 transition-all">
                                    <div className="size-11 rounded-xl overflow-hidden shadow-sm">
                                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=family" alt="member" className="w-full h-full" />
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-sm font-black text-foreground">이영희 (배우자)</p>
                                        <p className="text-[10px] font-bold text-muted-foreground/60 mt-0.5">공동명의 (50%)</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Financial Summary Card */}
                        <div className="flex flex-col rounded-3xl border border-border/50 bg-card p-8 shadow-sm">
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
                    <div className="flex-1 flex flex-col gap-8 min-w-0">
                        {/* 1. Tab Navigation & Top Actions */}
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                                <h2 className="text-3xl font-extrabold tracking-tight text-foreground">활동 및 상세 정보</h2>
                                <p className="text-muted-foreground font-medium text-sm">
                                    최근 활동: <span className="text-foreground font-bold">{logs[0]?.created_at ? new Date(logs[0].created_at).toLocaleDateString() : '2023-10-25'} (전화 상담)</span>
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-[11px] font-black text-foreground hover:bg-muted/10 transition-all uppercase tracking-widest shadow-sm">
                                    <MaterialIcon name="edit_square" size="sm" />
                                    프로필 수정
                                </button>
                                <button className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-[11px] font-black text-foreground hover:bg-muted/10 transition-all uppercase tracking-widest shadow-sm">
                                    <MaterialIcon name="picture_as_pdf" size="sm" />
                                    PDF 내보내기
                                </button>
                                <button className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-5 py-2.5 text-[11px] font-black text-destructive hover:bg-destructive/20 transition-all uppercase tracking-widest">
                                    <MaterialIcon name="block" size="sm" />
                                    비활성화
                                </button>
                            </div>
                        </div>

                        {/* 2. Custom Tabs */}
                        <div className="flex gap-1 border-b border-border/30 pb-px">
                            <TabItem label="활동 이력 (Activity)" active />
                            <TabItem label="재정 현황 (Financials)" />
                            <TabItem label="관련 문서 (Documents)" />
                        </div>

                        {/* 3. New Activity Log Input */}
                        <div className="flex flex-col rounded-3xl border border-border/50 bg-card/40 overflow-hidden shadow-sm">
                            <div className="p-6 bg-muted/5 flex items-center justify-between border-b border-border/30">
                                <div className="flex items-center gap-3">
                                    <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                        <MaterialIcon name="edit_note" size="sm" />
                                    </div>
                                    <h3 className="text-sm font-black text-foreground">새로운 활동 기록</h3>
                                </div>
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-card border border-border/50 px-2 py-1 rounded-md">오늘, 10월 26일</span>
                            </div>
                            <div className="p-8 space-y-8">
                                <div className="relative group">
                                    <textarea
                                        placeholder="상담 내용이나 메모를 입력하세요..."
                                        className="w-full h-32 bg-card/60 rounded-2xl border border-border p-6 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none placeholder:text-muted-foreground/40 font-medium"
                                    />
                                    <button className="absolute bottom-6 right-6 text-muted-foreground hover:text-primary transition-colors">
                                        <MaterialIcon name="mic" size="md" />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-3">
                                        <ActivityTypeBtn icon="call" label="전화" active />
                                        <ActivityTypeBtn icon="group" label="방문" />
                                        <ActivityTypeBtn icon="sms" label="문자" />
                                    </div>
                                    <button className="flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-black text-white shadow-lg shadow-primary/30 hover:bg-primary-hover transition-all">
                                        저장 <MaterialIcon name="send" size="sm" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 4. Activity Timeline */}
                        <div className="flex flex-col gap-6 pl-4">
                            <TimelineEntry
                                type="call"
                                color="blue"
                                title="관리비 문의 (Maintenance Fee)"
                                manager="박지성 매니저"
                                time="2023-10-24 14:30"
                                content="9월 관리비 내역 중 난방비 과다 청구에 대한 문의가 있었습니다. 계량기 점검 일정을 10월 27일 오후 2시로 예약하였습니다."
                            />
                            <TimelineEntry
                                type="group"
                                color="purple"
                                title="세대 내부 수리 건 (Renovation)"
                                manager="김민수 팀장"
                                time="2023-10-15 10:00"
                                content="욕실 누수 관련 방문 점검 완료. 윗집(1304호) 배관 문제로 확인되어 윗집 소유주와 통화 후 공사 일정 조율하기로 함."
                                attachment="현장사진_01.jpg"
                            />
                            <TimelineEntry
                                type="sms"
                                color="green"
                                title="미납 안내 발송 (Payment Reminder)"
                                manager="시스템 자동발송"
                                time="2023-10-01 09:00"
                                content="[People On] 9월 관리비 미납 안내입니다. 10월 10일까지 납부 부탁드립니다."
                            />
                            <div className="relative pt-4 text-center">
                                <div className="absolute top-0 left-[21px] bottom-0 w-px bg-border/30 -z-10" />
                                <div className="inline-flex flex-col items-center gap-1 group cursor-pointer">
                                    <div className="size-11 rounded-2xl bg-card border border-border/50 flex items-center justify-center text-muted-foreground/40 group-hover:text-white transition-colors">
                                        <MaterialIcon name="history" size="sm" />
                                    </div>
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-2">이전 기록 3건 더 보기...</span>
                                </div>
                            </div>
                        </div>
                    </div>
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
                <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">{label}</p>
                <p className={cn("text-sm font-bold text-foreground transition-colors group-hover/item:text-primary", isMono && "font-mono")}>{value}</p>
            </div>
        </div>
    );
}

function TabItem({ label, active = false }: any) {
    return (
        <button className={cn(
            "px-6 py-4 text-sm font-black transition-all relative",
            active
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground/60 hover:text-foreground"
        )}>
            {label}
        </button>
    );
}

function ActivityTypeBtn({ icon, label, active = false }: any) {
    return (
        <button className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl border font-black text-xs transition-all shadow-sm",
            active
                ? "bg-primary/10 border-primary text-primary shadow-sm"
                : "border-border bg-card text-muted-foreground hover:bg-muted/10 hover:text-foreground"
        )}>
            <MaterialIcon name={icon} size="sm" />
            {label}
        </button>
    );
}

function TimelineEntry({ type, title, manager, time, content, attachment, color }: any) {
    const iconColors: any = {
        blue: "text-blue-400 bg-blue-400/10",
        purple: "text-purple-400 bg-purple-400/10",
        green: "text-success bg-success/10"
    };

    return (
        <div className="relative flex gap-8 group/entry">
            {/* Vertical Line */}
            <div className="absolute top-12 bottom-0 left-[21px] w-px bg-border/30 -z-10" />

            <div className="flex flex-col items-center flex-shrink-0 pt-1">
                <div className={cn("size-11 rounded-2xl border border-border/50 flex items-center justify-center shadow-lg transition-transform group-hover/entry:scale-110 duration-300", iconColors[color])}>
                    <MaterialIcon name={type} size="sm" />
                </div>
            </div>

            <div className="flex-1 flex flex-col rounded-3xl border border-border/50 bg-card/20 p-8 shadow-sm group-hover/entry:bg-card/30 transition-all border-l-4 border-l-transparent group-hover/entry:border-l-primary/40">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <h4 className="text-base font-black text-foreground">{title}</h4>
                        <span className="text-[10px] font-black text-muted-foreground/40 bg-muted/10 px-2 py-0.5 rounded uppercase tracking-widest">{manager}</span>
                    </div>
                    <span className="text-[11px] font-bold text-muted-foreground/30 font-mono tracking-widest tracking-tight">{time}</span>
                </div>
                <p className="text-sm font-medium text-muted-foreground/80 leading-relaxed max-w-2xl">{content}</p>
                {attachment && (
                    <div className="mt-6 flex items-center gap-3 bg-card border border-border/50 rounded-xl p-3 w-fit group/attach cursor-pointer hover:border-primary/50 transition-all">
                        <div className="size-10 bg-destructive/10 text-destructive rounded-lg flex items-center justify-center">
                            <MaterialIcon name="image" size="sm" />
                        </div>
                        <span className="text-[11px] font-black text-muted-foreground group-hover/attach:text-foreground">{attachment}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
