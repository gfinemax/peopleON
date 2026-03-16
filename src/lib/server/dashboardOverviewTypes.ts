import type { UnifiedPerson } from '@/services/memberAggregation';

export type DashboardRetentionStats = {
    registeredActive: number;
    unregisteredActive: number;
    registeredWithdrawn: number;
    unregisteredWithdrawn: number;
    totalHistorical: number;
};

export type DashboardStats = {
    totalMembers: number;
    totalAmount: number;
    collectedAmount: number;
    paymentRate: number;
    registeredMembersCount: number;
    registeredMembersRate: number;
    recentRegisteredCount: number;
    certificateHolderCount: number;
    relatedPartyCount: number;
    totalExpectedRefund: number;
    totalPaidRefund: number;
    totalRemainingRefund: number;
    retention: DashboardRetentionStats;
};

export type DashboardEvent = {
    id: string;
    title: string;
    time: string;
    desc: string;
    type: 'payment' | 'member' | 'issue';
};

export type DashboardPaymentBreakdown = {
    step1: { due: number; paid: number; rate: number };
    step2: { due: number; paid: number; rate: number };
    step3: { due: number; paid: number; rate: number };
    general: { due: number; paid: number; rate: number };
};

export type DashboardFinancialStats = {
    contributionDue: number;
    contributionPaid: number;
    contributionRate: number;
    investmentTotal: number;
    additionalBurden: number;
    byType: Record<string, { label: string; due: number; paid: number; rate: number }>;
    byUnitType: Record<string, { due: number; paid: number; count: number }>;
    byAccount: Record<string, { total: number; type: string }>;
    hasData: boolean;
};

export type DashboardFavoriteMember = {
    id: string;
    name: string;
    member_number: string | null;
    tier: string | null;
    status: string | null;
};

export type DashboardActionItem = {
    id: string;
    name: string;
    member_number: string;
    tier: string;
    phone: string;
    status: string;
    href: string;
};

export type DashboardOverviewData = {
    stats: DashboardStats;
    events: DashboardEvent[];
    paymentBreakdown: DashboardPaymentBreakdown;
    financialStats: DashboardFinancialStats;
    favoriteList: DashboardFavoriteMember[];
    actionList: DashboardActionItem[];
};

export type DashboardPaymentRow = {
    amount_due: number | null;
    amount_paid: number | null;
    step: number | null;
};

export type DashboardMemberPaymentRow = {
    payment_type: string;
    amount_due: number | string | null;
    amount_paid: number | string | null;
    is_contribution: boolean | null;
    unit_type_id: string | null;
    deposit_account_id: string | null;
};

export type DashboardUnitTypeRow = {
    id: string;
    name: string;
};

export type DashboardDepositAccountRow = {
    id: string;
    account_name: string;
    account_type: string | null;
};

export type DashboardRecentPaymentRow = {
    id: string;
    paid_date: string | null;
    step_name?: string | null;
    step?: number | null;
    amount_paid?: number | null;
    account_entities?: { display_name?: string | null }[] | { display_name?: string | null } | null;
};

export type DashboardNewMemberRow = {
    id: string;
    display_name: string | null;
    created_at: string | null;
    unit_group: string | null;
};

export type DashboardFavoriteEntityRow = {
    id: string;
    display_name: string | null;
    member_number: string | null;
    tier: string | null;
    status: string | null;
};

export const EMPTY_RETENTION: DashboardRetentionStats = {
    registeredActive: 0,
    unregisteredActive: 0,
    registeredWithdrawn: 0,
    unregisteredWithdrawn: 0,
    totalHistorical: 0,
};

export const EMPTY_PAYMENT_BREAKDOWN: DashboardPaymentBreakdown = {
    step1: { due: 0, paid: 0, rate: 0 },
    step2: { due: 0, paid: 0, rate: 0 },
    step3: { due: 0, paid: 0, rate: 0 },
    general: { due: 0, paid: 0, rate: 0 },
};

export const EMPTY_FINANCIAL_STATS: DashboardFinancialStats = {
    contributionDue: 0,
    contributionPaid: 0,
    contributionRate: 0,
    investmentTotal: 0,
    additionalBurden: 0,
    byType: {},
    byUnitType: {},
    byAccount: {},
    hasData: false,
};

export const EMPTY_STATS: DashboardStats = {
    totalMembers: 0,
    totalAmount: 0,
    collectedAmount: 0,
    paymentRate: 0,
    registeredMembersCount: 0,
    registeredMembersRate: 0,
    recentRegisteredCount: 0,
    certificateHolderCount: 0,
    relatedPartyCount: 0,
    totalExpectedRefund: 0,
    totalPaidRefund: 0,
    totalRemainingRefund: 0,
    retention: EMPTY_RETENTION,
};

export function createEmptyDashboardOverviewData(): DashboardOverviewData {
    return {
        stats: EMPTY_STATS,
        events: [],
        paymentBreakdown: EMPTY_PAYMENT_BREAKDOWN,
        financialStats: EMPTY_FINANCIAL_STATS,
        favoriteList: [],
        actionList: [],
    };
}

export type DashboardOverviewUnifiedPerson = UnifiedPerson;
