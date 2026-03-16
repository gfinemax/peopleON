import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import { fetchActivityFeedEntriesSnapshot } from '@/lib/server/activityFeed';
import { ActivityTimelineExplorer } from '@/components/features/timeline/ActivityTimelineExplorer';

export const dynamic = 'force-dynamic';

export default async function TimelinePage() {
    const activities = await fetchActivityFeedEntriesSnapshot({ limit: 180 });

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
            <Header
                title="활동 타임라인"
                iconName="history"
                leftContent={(
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <MaterialIcon name="timeline" size="md" className="text-muted-foreground mr-[-2px]" />
                        <span className="text-[19px] font-bold text-foreground">전체 활동 {activities.length.toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">· 운영 모니터링</span>
                    </div>
                )}
            />
            <ActivityTimelineExplorer activities={activities} />
        </div>
    );
}
