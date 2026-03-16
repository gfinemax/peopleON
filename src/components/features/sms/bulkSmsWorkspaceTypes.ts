export type SmsRecipient = {
    id: string;
    entityId: string;
    name: string;
    phone: string | null;
    fullPhone?: string | null;
    tier: string | null;
    status: string | null;
    isRegistered: boolean;
    unitGroup: string | null;
    totalDue: number;
    totalPaid: number;
    unpaidAmount: number;
    paymentStatus: 'none' | 'paid' | 'unpaid';
    hasReachablePhone: boolean;
};

export type SmsHistoryItem = {
    id: string;
    entityId: string;
    memberName: string;
    phone: string | null;
    summary: string;
    staffName: string;
    createdAt: string;
};

export type SmsFilterState = {
    query: string;
    tier: string;
    status: string;
    paymentStatus: string;
};

export type SmsFeedback = {
    tone: 'success' | 'error' | 'info';
    text: string;
};
