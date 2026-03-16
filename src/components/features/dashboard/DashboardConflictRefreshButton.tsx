'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { refreshDashboardCertificateConflicts } from '@/app/actions/dashboard';
import { MaterialIcon } from '@/components/ui/icon';

export function DashboardConflictRefreshButton() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<string | null>(null);

    const handleRefresh = () => {
        setMessage(null);

        startTransition(async () => {
            const result = await refreshDashboardCertificateConflicts();
            if (!result.success) {
                setMessage(result.error || '다시 확인에 실패했습니다.');
                return;
            }

            setMessage('최신 권리증 오류 상태로 다시 확인했습니다.');
            router.refresh();
        });
    };

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={handleRefresh}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-200 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                title="권리증 충돌 상태를 다시 계산합니다."
            >
                <MaterialIcon
                    name={isPending ? 'sync' : 'refresh'}
                    size="sm"
                    className={isPending ? 'animate-spin' : ''}
                />
                오류 다시 확인
            </button>
            {message ? (
                <span className="hidden text-[10px] font-bold text-muted-foreground lg:inline">
                    {message}
                </span>
            ) : null}
        </div>
    );
}
