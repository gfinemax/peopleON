export interface DashboardStats {
    totalMembers: number;
    totalAmount: number;
    collectedAmount: number;
    paymentRate: number;
    registeredMembersCount?: number;
    registeredMembersRate?: number;
    recentRegisteredCount?: number;
    certificateHolderCount?: number;
    relatedPartyCount?: number;
    totalExpectedRefund?: number;
    totalPaidRefund?: number;
    totalRemainingRefund?: number;
}

export interface DashboardEvent {
    id: string;
    title: string;
    time: string;
    desc: string;
    type: 'payment' | 'member' | 'issue';
}

export interface PaymentBreakdown {
    step1: { due: number; paid: number; rate: number };
    step2: { due: number; paid: number; rate: number };
    step3: { due: number; paid: number; rate: number };
    general: { due: number; paid: number; rate: number };
}
