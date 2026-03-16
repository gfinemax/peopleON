'use client';

import { Button } from '@/components/ui/button';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { SmsDeliveryMode } from '@/lib/server/smsDelivery';
import type { SmsFeedback } from './bulkSmsWorkspaceTypes';

export {
    BulkSmsComposer,
    BulkSmsHistoryDialog,
    BulkSmsSidebar,
} from './BulkSmsWorkspacePanels';

export function BulkSmsHeader({
    deliveryMode,
    onOpenHistory,
}: {
    deliveryMode: SmsDeliveryMode;
    onOpenHistory: () => void;
}) {
    return (
        <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(135deg,rgba(19,27,41,0.98),rgba(14,20,34,0.98))] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.32)]">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-[-0.04em] text-white">대량 문자 발송</h1>
                    <p className="mt-2 max-w-3xl text-base leading-7 text-slate-300">
                        조합원관리 명단과 분담금 상태를 기반으로 수신자 명부를 만들고 발송 이력을 남깁니다.{` `}
                        {deliveryMode === 'webhook'
                            ? '현재 외부 문자 서비스와 연동된 실발송 모드입니다.'
                            : '현재는 실발송 전 단계로 발송 기록 저장 모드입니다.'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <span
                        className={cn(
                            'inline-flex h-11 items-center rounded-2xl border px-4 text-sm font-bold',
                            deliveryMode === 'webhook'
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                                : 'border-amber-500/20 bg-amber-500/10 text-amber-200',
                        )}
                    >
                        {deliveryMode === 'webhook' ? '실발송 연동' : '기록 저장 모드'}
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-2xl border-white/10 bg-white/[0.03] px-5 text-white hover:bg-white/[0.08]"
                        onClick={onOpenHistory}
                    >
                        <MaterialIcon name="history" size="md" />
                        발송 이력
                    </Button>
                </div>
            </div>
        </section>
    );
}

export function BulkSmsFeedbackBanner({ feedback }: { feedback: SmsFeedback | null }) {
    if (!feedback) return null;

    return (
        <div
            className={cn(
                'rounded-2xl border px-4 py-3 text-sm font-medium',
                feedback.tone === 'success' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
                feedback.tone === 'error' && 'border-rose-500/30 bg-rose-500/10 text-rose-200',
                feedback.tone === 'info' && 'border-sky-500/30 bg-sky-500/10 text-sky-200',
            )}
        >
            {feedback.text}
        </div>
    );
}
