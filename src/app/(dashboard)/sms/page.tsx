import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import { createClient } from '@/lib/supabase/server';
import { BulkSmsWorkspace } from '@/components/features/sms/BulkSmsWorkspace';
import { getSmsDeliveryMode } from '@/lib/server/smsDelivery';
import { getUnifiedMembersSnapshot } from '@/lib/server/unifiedMembersSnapshot';
import { fetchSmsDashboardData } from '@/lib/server/smsDashboard';

export const dynamic = 'force-dynamic';

export default async function SmsPage() {
    const supabase = await createClient();
    const unifiedPeople = await getUnifiedMembersSnapshot();
    const deliveryMode = getSmsDeliveryMode();
    const { recipients, history, totalPeople, reachableCount, unpaidCount } = await fetchSmsDashboardData(
        supabase,
        unifiedPeople,
    );

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <Header
                title="대량 문자 발송"
                iconName="sms"
                leftContent={(
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <MaterialIcon name="sms" size="md" className="text-primary mr-[-2px]" />
                        <span className="text-[19px] font-bold text-foreground">대량 문자 발송</span>
                        <span className="text-[10px] font-bold text-muted-foreground">· 조합원 명단 연동</span>
                    </div>
                )}
            />

            <main className="flex-1 overflow-y-auto bg-background">
                <BulkSmsWorkspace
                    recipients={recipients}
                    history={history}
                    totalPeople={totalPeople}
                    reachableCount={reachableCount}
                    unpaidCount={unpaidCount}
                    deliveryMode={deliveryMode}
                />
            </main>
        </div>
    );
}
