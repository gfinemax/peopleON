import { InteractionLog, TimelineItem } from './TimelineItem';
import { ScrollArea } from '@/components/ui/scroll-area';

export function TimelineList({ logs }: { logs: InteractionLog[] }) {
    if (!logs || logs.length === 0) {
        return (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                <p>등록된 상담 이력이 없습니다.</p>
                <p className="text-sm">새로운 로그를 작성해보세요.</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-[600px] pr-4">
            <div className="pt-2">
                {logs.map((log) => (
                    <TimelineItem key={log.id} log={log} />
                ))}
            </div>
        </ScrollArea>
    );
}
