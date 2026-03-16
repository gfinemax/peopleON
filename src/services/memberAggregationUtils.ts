import {
    resolveCertificateRight,
} from '@/lib/certificates/rightNumbers';
import type { UnifiedPerson, CertificateMeta } from './memberAggregationTypes';
import type { AggregatedRightRecord } from './memberAggregationData';

export const normalizeText = (value?: string | null) =>
    (value || '').replace(/\s+/g, '').toLowerCase();
export const normalizePhone = (value?: string | null) => (value || '').replace(/\D/g, '');

const normalizeCertificateNumber = (value: string) =>
    value.replace(/(^|[^0-9])0+(?=\d)/g, '$1').replace(/[\s]/g, '').toLowerCase();

export const splitCertificateDisplay = (value?: string | null) =>
    (value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => item !== '-');

const isLikelyPersonName = (value?: string | null) => {
    const candidate = (value || '').trim().replace(/\s+/g, '');
    if (!candidate || candidate.length < 2 || candidate.length > 10) return false;
    if (/\d/.test(candidate)) return false;
    if (!/^[가-힣A-Za-z]+$/.test(candidate)) return false;

    const blocked = new Set([
        '미입력', '정상', '탈퇴', '조합원', '권리증', '대리인', '관계인', '남편', '아내', '배우자',
        '형수', '시동생', '부', '모', '자녀', '기타', '메모', '연락처', '전화번호',
    ]);
    return !blocked.has(candidate);
};

export const inferNameByPhoneFromNotes = (people: UnifiedPerson[]) => {
    const namesByPhone = new Map<string, Set<string>>();
    const addCandidate = (rawPhone: string, rawName: string) => {
        const digits = normalizePhone(rawPhone);
        const name = (rawName || '').trim().replace(/\s+/g, '');
        if (digits.length < 9 || !isLikelyPersonName(name)) return;

        const existing = namesByPhone.get(digits) || new Set<string>();
        existing.add(name);
        namesByPhone.set(digits, existing);
    };

    const patterns: RegExp[] = [
        /(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})\s*\(([^()\n]{2,20})\)/g,
        /([^()\n]{2,20})\s*\((\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})\)/g,
    ];

    for (const person of people) {
        const notes = person.notes || '';
        if (!notes) continue;

        for (const pattern of patterns) {
            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(notes)) !== null) {
                if (pattern === patterns[0]) addCandidate(match[1], match[2]);
                else addCandidate(match[2], match[1]);
            }
        }
    }

    const resolved = new Map<string, string>();
    for (const [digits, names] of namesByPhone.entries()) {
        if (names.size === 1) {
            resolved.set(digits, Array.from(names)[0]);
        }
    }
    return resolved;
};

export const normalizeTierLabel = (rawTier?: string | null, isRegistered = false) => {
    const tierText = normalizeText(rawTier);
    if (tierText === '1차') return '등기조합원';
    if (tierText === '2차') return '2차';
    if (tierText === '일반' || tierText === '일반분양' || tierText === '3차') return '일반분양';
    if (tierText === '지주조합원') return '지주조합원';
    if (tierText === '지주') return '지주';
    if (tierText === '대리인' || tierText === '대리') return '대리인';
    if (tierText === '예비' || tierText === '예비조합원') return '예비조합원';
    if (tierText === '권리증보유자') return '권리증보유자';
    if (tierText === '관계인') return '관계인';
    if (!tierText && isRegistered) return '등기조합원';
    return rawTier?.trim() || null;
};

export const getUiRoleFromTier = (
    tier: string | null,
): 'member' | 'landowner' | 'general' | 'investor' | 'agent' | 'party' | 'other' => {
    const t = normalizeText(tier);
    if (!t) return 'other';
    if (['등기조합원', '1차', '2차', '예비조합원', '예비', '지주조합원', '일반조합원', '임시원장'].includes(t)) return 'member';
    if (['지주'].includes(t)) return 'landowner';
    if (['일반분양', '일반', '3차'].includes(t)) return 'general';
    if (['권리증보유자', '권리증', '권리증환불', '비조합원권리증'].includes(t)) return 'investor';
    if (['대리인', '대리'].includes(t)) return 'agent';
    if (['관계인'].includes(t)) return 'party';
    return 'other';
};

export const parseCertificateMeta = (value: unknown): CertificateMeta => {
    try {
        if (!value) return {};
        if (typeof value === 'object') return value as CertificateMeta;
        if (typeof value === 'string' && value.trim().startsWith('{')) {
            return JSON.parse(value) as CertificateMeta;
        }
    } catch {
        return {};
    }
    return {};
};

export function deriveCertificateAggregation(combinedRights: AggregatedRightRecord[]) {
    let rawCount = 0;
    let managedCount = 0;
    let hasMerged = false;
    const activeManagedRights: AggregatedRightRecord[] = [];

    combinedRights.forEach((right) => {
        if (right.right_type !== 'certificate' || !right.is_active) return;

        const meta = parseCertificateMeta(right.note);

        if (!meta.node_type || meta.node_type === 'raw') rawCount++;

        if (!meta.parent_right_id) {
            managedCount++;
            activeManagedRights.push(right);
        }

        if (meta.parent_right_id || (meta.integration_type && meta.integration_type !== 'none')) {
            hasMerged = true;
        }
    });

    if (rawCount === 0 && combinedRights.some((right) => right.right_type === 'certificate' && right.is_active)) {
        const certs = combinedRights.filter((right) => right.right_type === 'certificate' && right.is_active);
        rawCount = certs.length;
        managedCount = certs.length;
    }

    const displayItems: string[] = [];
    const allActiveCerts = combinedRights.filter((right) => right.right_type === 'certificate' && right.is_active);

    allActiveCerts.forEach((right) => {
        const resolved = resolveCertificateRight(right);
        let text = resolved.confirmedNumber || resolved.rawValue || '-';
        const meta = parseCertificateMeta(right.note);

        if (meta.node_type === 'derivative') {
            text += ' [통합]';
        } else if (!meta.parent_right_id && resolved.status !== 'confirmed') {
            const statusLabelMap: Record<string, string> = {
                declared_owned: '보유',
                pending: '확인예정',
                missing: '없음',
                invalid: '오류',
                review_required: '검수필요',
            };
            text = statusLabelMap[resolved.status] || text;
        }

        displayItems.push(text);
    });

    return {
        rawCount,
        managedCount,
        hasMerged,
        activeManagedRights,
        allActiveCerts,
        displayItems,
    };
}

export const classifyAgentRelation = (relStr: string) => {
    const rel = relStr || '';
    const isSeller = rel.includes('판매') || rel.includes('매수') || rel.includes('소유');
    const isFamilyOrGift =
        rel.match(/증여|부|모|자녀|처|남편|부인|아내|배우자|사위|며느리|형|누나|오빠|언니|제|매|동생|가족|친인척|삼촌|고모|이모|조카|손주|손녀|손자|모친|부친|장인|장모|시부|시모/) ||
        rel.trim() === '자' ||
        rel.includes('대리');
    return isFamilyOrGift && !isSeller;
};

export const mergeCertificateNumbers = (left: string[] | undefined, right: string[] | undefined) => {
    const mergedCertificateNumbers = new Map<string, string>();
    for (const number of [...(left || []), ...(right || [])]) {
        const key = normalizeCertificateNumber(number);
        const previous = mergedCertificateNumbers.get(key);
        if (!previous || number.length > previous.length) mergedCertificateNumbers.set(key, number);
    }
    return Array.from(mergedCertificateNumbers.values());
};

export const mergeCertificateTokens = (left: string[] | undefined, right: string[] | undefined) =>
    Array.from(new Set([...(left || []), ...(right || [])].filter(Boolean)));

export const mergeCertificateDisplay = (left?: string | null, right?: string | null) =>
    Array.from(new Set([...splitCertificateDisplay(left), ...splitCertificateDisplay(right)])).join(', ');

export const mergeRelationships = (
    left: { id?: string; name: string; relation: string; phone?: string }[] | null | undefined,
    right: { id?: string; name: string; relation: string; phone?: string }[] | null | undefined,
) => {
    const merged = new Map<string, { id?: string; name: string; relation: string; phone?: string }>();
    for (const relation of [...(left || []), ...(right || [])]) {
        const key = `${relation.id || relation.name}|${relation.relation}`;
        if (!merged.has(key)) merged.set(key, relation);
    }
    return Array.from(merged.values());
};

export const finalizeCertificateFields = (person: UnifiedPerson) => {
    const uniqueNumbers = mergeCertificateNumbers([], person.certificate_numbers);
    person.certificate_numbers = uniqueNumbers;
    const fallbackDisplay =
        uniqueNumbers.length > 1
            ? uniqueNumbers.join(', ')
            : uniqueNumbers.length === 1
              ? uniqueNumbers[0]
              : '-';
    const existingDisplayItems = splitCertificateDisplay(person.certificate_display);

    person.certificate_display =
        existingDisplayItems.length > 0 ? existingDisplayItems.join(', ') : fallbackDisplay;
    person.certificate_search_tokens = mergeCertificateTokens(
        mergeCertificateTokens(person.certificate_search_tokens, uniqueNumbers),
        splitCertificateDisplay(person.certificate_display).map((value) =>
            value.replace(/\s*\[통합\]\s*$/u, ''),
        ),
    );
};
