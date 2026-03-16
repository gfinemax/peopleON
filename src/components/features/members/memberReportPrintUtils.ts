import { UnifiedPerson } from '@/services/memberAggregation';

import { PrintConfig } from '@/components/features/members/memberReportPrintTypes';

export const DEFAULT_PRINT_CONFIG: PrintConfig = {
    orientation: 'portrait',
    pageSize: 'A4',
    sortBy: 'no',
    sortOrder: 'asc',
    columns: [
        { id: 'no', label: 'No.', enabled: true, width: '40px' },
        { id: 'name', label: '성명', enabled: true, width: '80px' },
        { id: 'phone', label: '연락처', enabled: true, width: '120px' },
        { id: 'tier', label: '구분/차수', enabled: true },
        { id: 'unit', label: '동호수', enabled: true, width: '80px' },
        { id: 'cert_status', label: '권리현황', enabled: true, width: '100px' },
        { id: 'cert', label: '권리증번호', enabled: true, width: '30%' },
        { id: 'status', label: '상태', enabled: true, width: '60px' },
    ],
};

export function getMemberReportPrintDate() {
    const today = new Date();
    return `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
}

export function getSortedPrintData(data: UnifiedPerson[], config: PrintConfig) {
    return [...data].sort((leftPerson, rightPerson) => {
        let leftValue: unknown = leftPerson[config.sortBy as keyof UnifiedPerson];
        let rightValue: unknown = rightPerson[config.sortBy as keyof UnifiedPerson];

        if (config.sortBy === 'no') {
            leftValue = leftPerson.id;
            rightValue = rightPerson.id;
        } else if (config.sortBy === 'tier') {
            leftValue = Array.isArray(leftPerson.tiers) && leftPerson.tiers.length > 0
                ? leftPerson.tiers[0]
                : (leftPerson.tier || '');
            rightValue = Array.isArray(rightPerson.tiers) && rightPerson.tiers.length > 0
                ? rightPerson.tiers[0]
                : (rightPerson.tier || '');
        }

        const comparableLeft: string | number =
            typeof leftValue === 'string' || typeof leftValue === 'number' ? leftValue : '';
        const comparableRight: string | number =
            typeof rightValue === 'string' || typeof rightValue === 'number' ? rightValue : '';

        if (typeof comparableLeft === 'string' && typeof comparableRight === 'string') {
            return config.sortOrder === 'asc'
                ? comparableLeft.localeCompare(comparableRight)
                : comparableRight.localeCompare(comparableLeft);
        }

        return config.sortOrder === 'asc'
            ? (comparableLeft > comparableRight ? 1 : -1)
            : (comparableLeft < comparableRight ? 1 : -1);
    });
}
