import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';

export const dynamic = 'force-dynamic';

export default async function SmsPage() {
    const supabase = await createClient();

    // Fetch member count for stats
    const { count: memberCount } = await supabase.from('members').select('*', { count: 'exact', head: true });

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <Header title="대량 문자 발송" />

            <main className="flex-1 overflow-y-auto bg-background">
                <div className="p-6 lg:p-10 space-y-6 max-w-[1200px] mx-auto">
                    {/* Page Header */}
                    <div className="flex flex-wrap justify-between items-end gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground tracking-tight">
                                대량 문자 발송
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                조합원 그룹에게 안내 문자를 발송하고 이력을 관리합니다.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button className="flex items-center gap-2 rounded-lg h-10 px-4 bg-card border border-border text-foreground text-sm font-medium shadow-sm hover:bg-accent transition-colors">
                                <MaterialIcon name="history" size="md" />
                                발송 이력
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Panel: Recipient Selection */}
                        <div className="lg:col-span-1 space-y-6">
                            {/* Quick Stats */}
                            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                                <h3 className="text-xs font-bold text-muted-foreground/40 mb-4 uppercase tracking-wider">발송 대상</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-muted-foreground/40 uppercase tracking-wide">전체 조합원</span>
                                        <span className="text-lg font-bold text-foreground">{memberCount || 0}명</span>
                                    </div>
                                    <div className="h-px bg-border" />
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-muted-foreground/40 uppercase tracking-wide">선택된 대상</span>
                                        <span className="text-lg font-bold text-primary">0명</span>
                                    </div>
                                </div>
                            </div>

                            {/* Filter Options */}
                            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                                <h3 className="text-[13px] font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                                    <MaterialIcon name="filter_list" size="sm" className="text-muted-foreground/20" />
                                    수신자 필터
                                </h3>

                                {/* Tier Filter */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground/30 uppercase tracking-wider">
                                        차수 (Tier)
                                    </label>
                                    <select className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                                        <option>전체 차수</option>
                                        <option>1차 조합원</option>
                                        <option>2차 조합원</option>
                                        <option>지주 조합원</option>
                                    </select>
                                </div>

                                {/* Status Filter */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground/30 uppercase tracking-wider">
                                        상태 (Status)
                                    </label>
                                    <select className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                                        <option>전체 상태</option>
                                        <option>정상</option>
                                        <option>미납</option>
                                        <option>소송 진행중</option>
                                    </select>
                                </div>

                                {/* Payment Status Filter */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground/30 uppercase tracking-wider">
                                        납부 상태
                                    </label>
                                    <select className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                                        <option>전체</option>
                                        <option>미납자만</option>
                                        <option>완납자만</option>
                                    </select>
                                </div>

                                <button className="w-full h-10 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-accent transition-colors flex items-center justify-center gap-2">
                                    <MaterialIcon name="search" size="md" />
                                    대상 조회
                                </button>
                            </div>
                        </div>

                        {/* Right Panel: Message Composition */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Template Selection */}
                            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                                <h3 className="text-[13px] font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                                    <MaterialIcon name="description" size="sm" className="text-muted-foreground/20" />
                                    메시지 템플릿
                                </h3>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {[
                                        { name: '납부 안내', icon: 'payments' },
                                        { name: '회의 소집', icon: 'groups' },
                                        { name: '일정 공지', icon: 'calendar_month' },
                                        { name: '긴급 공지', icon: 'warning' },
                                        { name: '축하 메시지', icon: 'celebration' },
                                        { name: '직접 작성', icon: 'edit' },
                                    ].map((template) => (
                                        <button
                                            key={template.name}
                                            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors group"
                                        >
                                            <MaterialIcon
                                                name={template.icon}
                                                size="lg"
                                                className="text-muted-foreground group-hover:text-primary transition-colors"
                                            />
                                            <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors tracking-tight">
                                                {template.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Message Content */}
                            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[13px] font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                                        <MaterialIcon name="sms" size="sm" className="text-muted-foreground/20" />
                                        메시지 내용
                                    </h3>
                                    <span className="text-[11px] font-bold text-muted-foreground/30 tracking-tight">0 / 90자 (SMS)</span>
                                </div>

                                <textarea
                                    className="w-full h-40 p-4 rounded-lg bg-background border border-border text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                                    placeholder="문자 내용을 입력하세요...&#10;&#10;사용 가능한 변수:&#10;{이름} - 수신자 이름&#10;{동호수} - 동호수&#10;{미납액} - 미납 금액"
                                />

                                {/* Variable Chips */}
                                <div className="flex flex-wrap gap-2">
                                    <span className="text-[11px] font-bold text-muted-foreground/20 uppercase tracking-wider mr-2">변수 삽입:</span>
                                    {['{이름}', '{동호수}', '{미납액}', '{납부기한}'].map((variable) => (
                                        <button
                                            key={variable}
                                            className="px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 transition-all border border-primary/20 badge-glow-primary"
                                        >
                                            {variable}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                                <h3 className="text-[13px] font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                                    <MaterialIcon name="preview" size="sm" className="text-muted-foreground/20" />
                                    미리보기
                                </h3>

                                <div className="bg-muted rounded-lg p-4">
                                    <div className="bg-card rounded-lg p-4 shadow-sm max-w-[280px] mx-auto border border-border">
                                        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                <MaterialIcon name="apartment" size="sm" className="text-primary" />
                                            </div>
                                            <span className="text-sm font-medium text-foreground">People On</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground italic">
                                            메시지 내용이 여기에 표시됩니다...
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <MaterialIcon name="schedule" size="md" />
                                    <span className="text-sm">예약 발송:</span>
                                    <input
                                        type="datetime-local"
                                        className="h-9 px-3 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button className="h-10 px-5 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-accent transition-colors">
                                        임시 저장
                                    </button>
                                    <button className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-bold shadow-md hover:bg-[#0f6bd0] transition-colors flex items-center gap-2">
                                        <MaterialIcon name="send" size="md" />
                                        발송하기
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
