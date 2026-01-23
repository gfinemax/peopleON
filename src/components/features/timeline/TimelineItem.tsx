import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Phone, Users, MessageSquare, FileText, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface InteractionLog {
    id: string;
    type: 'CALL' | 'MEET' | 'SMS' | 'DOC';
    direction: 'Inbound' | 'Outbound';
    summary: string;
    staff_name: string;
    created_at: string;
}

const iconMap = {
    CALL: Phone,
    MEET: Users,
    SMS: MessageSquare,
    DOC: FileText,
};

const typeLabelMap = {
    CALL: '전화',
    MEET: '대면상담',
    SMS: '문자',
    DOC: '문서',
};

export function TimelineItem({ log }: { log: InteractionLog }) {
    const Icon = iconMap[log.type] || MessageSquare;
    const isInbound = log.direction === 'Inbound';

    return (
        <div className="flex gap-4 pb-8 relative last:pb-0">
            {/* Connector Line */}
            <div className="absolute left-[19px] top-10 bottom-0 w-px bg-slate-200 last:hidden" />

            {/* Icon */}
            <div className={cn(
                "relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2",
                isInbound ? "bg-white border-blue-100 text-blue-600" : "bg-slate-50 border-slate-200 text-slate-500"
            )}>
                <Icon className="w-5 h-5" />
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full border shadow-sm p-0.5">
                    {isInbound ? <ArrowDownLeft className="w-3 h-3 text-blue-500" /> : <ArrowUpRight className="w-3 h-3 text-slate-400" />}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{typeLabelMap[log.type]}</span>
                        <Badge variant="outline" className="text-xs font-normal text-slate-500">
                            {log.staff_name}
                        </Badge>
                    </div>
                    <time className="text-xs text-slate-400">
                        {format(new Date(log.created_at), 'PPP p', { locale: ko })}
                    </time>
                </div>

                <div className="bg-white p-4 rounded-lg border shadow-sm text-sm text-slate-700 whitespace-pre-wrap">
                    {log.summary}
                </div>
            </div>
        </div>
    );
}
