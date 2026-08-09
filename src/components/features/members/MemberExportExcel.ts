import * as XLSX from "xlsx"
import type { MemberExportRow } from "./memberExportTypes"

export interface ExportColumn {
    id: string;
    label: string;
}

const roleLabelMap: Record<string, string> = {
    member: '조합원',
    certificate_holder: '가입신청필증 보유',
    related_party: '관계인',
    refund_applicant: '환불신청',
    agent: '대리인',
};

const rolePriorityMap: Record<string, number> = {
    member: 1,
    certificate_holder: 2,
    refund_applicant: 3,
    agent: 4,
    related_party: 5,
};

function getPrimaryTierLabel(person: MemberExportRow) {
    const tiers = person.tiers || [];
    return tiers.find((tier) =>
        tier.includes('차') ||
        tier.includes('조합원') ||
        tier === '지주' ||
        tier === '일반분양'
    ) || person.tier || '';
}

export function formatExportCategory(person: MemberExportRow) {
    const roles = person.role_types || [];
    if (roles.length === 0) {
        return Array.isArray(person.tiers) && person.tiers.length > 0
            ? person.tiers.join(', ')
            : (person.tier || '');
    }

    const primaryTier = getPrimaryTierLabel(person);
    const labels = roles
        .map((role) => {
            if (role === 'member') {
                if (primaryTier === '등기조합원') return '조합원(등기)';
                if (primaryTier === '지주조합원') return '조합원(지주)';
                if (primaryTier === '2차') return '조합원(2차)';
                if (primaryTier === '일반분양') return '조합원(일반분양)';
                if (primaryTier === '예비조합원') return '조합원(예비)';
                if (primaryTier === '지주') return '원지주';
                return primaryTier || roleLabelMap.member;
            }

            return roleLabelMap[role] || role;
        })
        .sort((left, right) => {
            const leftRole = roles.find((role) => (roleLabelMap[role] || role) === left || left.startsWith(roleLabelMap[role] || role));
            const rightRole = roles.find((role) => (roleLabelMap[role] || role) === right || right.startsWith(roleLabelMap[role] || role));
            return (rolePriorityMap[leftRole || ''] || 99) - (rolePriorityMap[rightRole || ''] || 99);
        });

    return Array.from(new Set(labels)).join(', ');
}

export function formatExportRelationships(person: MemberExportRow) {
    const items: string[] = [];

    for (const relationship of person.relationships || []) {
        const relation = relationship.relation || '';
        items.push(`${relationship.name}${relation}`);
    }

    for (const owner of person.acts_as_agent_for || []) {
        const relation = owner.relation || '';
        const type = owner.type ? ` ${owner.type}` : '';
        items.push(`${owner.name}${relation}${type}`);
    }

    if (person.real_owner) {
        items.push(`${person.real_owner.name}(실소유자)`);
    }

    for (const nominee of person.nominees || []) {
        items.push(`${nominee.name}(명의자)`);
    }

    return Array.from(new Set(items)).join(', ');
}

export function formatExportStatus(status: string | null, displayStatus?: string | null) {
    const effectiveStatus = displayStatus || status;
    if (effectiveStatus === '정상') return '등기';
    return effectiveStatus || '';
}

export function exportToExcel(data: MemberExportRow[], columns: ExportColumn[]) {
    if (!data || data.length === 0 || !columns || columns.length === 0) return

    // Map unified person data to a flat object for Excel based on selected columns
    const rows = data.map(p => {
        const row: Record<string, string | number> = {};
        
        columns.forEach(col => {
            switch (col.id) {
                case 'name':
                    row[col.label] = p.name || '';
                    break;
                case 'phone':
                    row[col.label] = p.phone || '';
                    break;
                case 'certificate_numbers':
                    // 필증번호는 축약 없이 배열 내용 전체를 콤마로 연결
                    row[col.label] = Array.isArray(p.certificate_numbers) && p.certificate_numbers.length > 0 
                        ? p.certificate_numbers.join(', ') 
                        : '';
                    break;
                case 'tier':
                    row[col.label] = formatExportCategory(p);
                    break;
                case 'unit_group':
                    row[col.label] = p.unit_group || '';
                    break;
                case 'relationships':
                    row[col.label] = formatExportRelationships(p);
                    break;
                case 'address':
                    row[col.label] = p.address_legal || '';
                    break;
                case 'status':
                    row[col.label] = formatExportStatus(p.status, p.display_status);
                    break;
                case 'memo':
                    row[col.label] = p.notes || '';
                    break;
                case 'roles':
                    row[col.label] = p.role_types?.join(', ') || '';
                    break;
                default:
                    row[col.label] = '';
            }
        });
        
        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "인원 명단")

    // Generate filename with current date
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
    const filename = `peopleon_members_${date}.xlsx`

    // Trigger download
    XLSX.writeFile(workbook, filename)
}
