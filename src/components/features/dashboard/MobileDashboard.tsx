'use client';

import { MaterialIcon } from '@/components/ui/icon';
import {
    MobileDashboardActivityFeed,
    MobileDashboardHeader,
    MobileDashboardMetrics,
} from './MobileDashboardSections';
import type {
    DashboardEvent,
    DashboardStats,
    PaymentBreakdown,
} from './MobileDashboardTypes';

interface MobileDashboardProps {
    stats: DashboardStats;
    events: DashboardEvent[];
    paymentBreakdown?: PaymentBreakdown;
}

export function MobileDashboard({ stats, events, paymentBreakdown }: MobileDashboardProps) {
    return (
        <div className="flex min-h-screen flex-col bg-background pb-24">
            <MobileDashboardHeader />
            <MobileDashboardMetrics stats={stats} paymentBreakdown={paymentBreakdown} />
            <MobileDashboardActivityFeed events={events} />

            <button className="fixed right-4 bottom-24 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 transition-all hover:bg-primary-hover active:scale-90">
                <MaterialIcon name="add" size="lg" />
            </button>
        </div>
    );
}

export type { DashboardEvent, DashboardStats, PaymentBreakdown } from './MobileDashboardTypes';
