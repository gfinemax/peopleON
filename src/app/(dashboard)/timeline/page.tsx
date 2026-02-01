import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';

export default function TimelinePage() {
    // Sample timeline data (would come from interaction_logs in real implementation)
    const activities = [
        {
            id: '1',
            type: 'sms',
            title: '납부 안내 문자 발송',
            description: '미납 회원 24명에게 안내 메시지 발송 완료',
            time: '10분 전',
            icon: 'sms',
            iconBg: 'bg-blue-50 dark:bg-blue-900/30',
            iconColor: 'text-blue-600 dark:text-blue-400',
        },
        {
            id: '2',
            type: 'payment',
            title: '수납 확인: 김철수',
            description: '3차 분담금 15,000,000원 입금 확인',
            time: '1시간 전',
            icon: 'attach_money',
            iconBg: 'bg-green-50 dark:bg-green-900/30',
            iconColor: 'text-green-600 dark:text-green-400',
        },
        {
            id: '3',
            type: 'member',
            title: '신규 회원 등록',
            description: "신규 지주 조합원 '이미자' 등록 완료",
            time: '3시간 전',
            icon: 'person_add',
            iconBg: 'bg-purple-50 dark:bg-purple-900/30',
            iconColor: 'text-purple-600 dark:text-purple-400',
        },
        {
            id: '4',
            type: 'call',
            title: '전화 상담: 홍길동',
            description: '납부 일정 조율 및 분할 납부 협의',
            time: '5시간 전',
            icon: 'phone_in_talk',
            iconBg: 'bg-cyan-50 dark:bg-cyan-900/30',
            iconColor: 'text-cyan-600 dark:text-cyan-400',
        },
        {
            id: '5',
            type: 'document',
            title: '규약 변경 승인',
            description: '관리자 승인 대기중',
            time: '어제',
            icon: 'edit_document',
            iconBg: 'bg-orange-50 dark:bg-orange-900/30',
            iconColor: 'text-orange-600 dark:text-orange-400',
        },
        {
            id: '6',
            type: 'meeting',
            title: '현장 미팅: 박서연',
            description: '인테리어 공사 관련 현장 확인',
            time: '2일 전',
            icon: 'location_on',
            iconBg: 'bg-pink-50 dark:bg-pink-900/30',
            iconColor: 'text-pink-600 dark:text-pink-400',
        },
    ];

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <Header
                title="활동 타임라인"
                iconName="history"
                leftContent={
                    <div className="flex items-center gap-2">
                        <MaterialIcon name="history" className="text-[19px] text-muted-foreground" />
                        <span className="text-[19px] font-bold tracking-tight text-foreground">활동 타임라인</span>
                    </div>
                }
            />

            <main className="flex-1 overflow-y-auto bg-background">
                <div className="p-4 w-full max-w-md mx-auto flex flex-col gap-6">
                    {/* Page Header Removed as per user request */}
                    <div>
                        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">

                            {/* Filter Tabs */}
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {[
                                    { label: '전체', value: 'all', active: true },
                                    { label: '통화', value: 'call', icon: 'phone' },
                                    { label: '방문', value: 'meeting', icon: 'location_on' },
                                    { label: '문자', value: 'sms', icon: 'sms' },
                                    { label: '수납', value: 'payment', icon: 'payments' },
                                    { label: '문서', value: 'document', icon: 'description' },
                                ].map((tab) => (
                                    <button
                                        key={tab.value}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors border ${tab.active
                                            ? 'bg-primary text-white border-primary'
                                            : 'bg-background border-border text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        {tab.icon && <MaterialIcon name={tab.icon} size="xs" className="text-[14px]" />}
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="relative flex flex-col gap-6 pl-2">
                            {/* Vertical Line - Centered (left-5 = 20px, half of size-10) */}
                            <div className="absolute left-5 top-2 bottom-4 w-0.5 bg-border -z-10" />

                            {activities.map((activity, idx) => (
                                <div key={activity.id} className="relative pl-14 group">
                                    <div className={`absolute left-0 top-0 size-10 rounded-full ${activity.iconBg} border border-border flex items-center justify-center z-10 bg-background`}>
                                        <MaterialIcon name={activity.icon} size="md" className={activity.iconColor} />
                                    </div>

                                    <div className="flex flex-col gap-1 py-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-[15px] font-bold text-foreground leading-none">
                                                {activity.title}
                                            </h4>
                                            <span className="text-[11px] font-bold text-muted-foreground/50 font-mono tracking-tight">
                                                {activity.time}
                                            </span>
                                        </div>
                                        <p className="text-[13px] text-muted-foreground line-clamp-2">
                                            {activity.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Load More */}
                        <div className="border-t border-border p-4">
                            <button className="w-full py-3 text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2">
                                <MaterialIcon name="expand_more" size="md" />
                                더 보기
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
