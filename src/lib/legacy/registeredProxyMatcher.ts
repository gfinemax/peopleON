export interface RelationshipReference {
    name: string | null;
    phone: string | null;
}

export interface RegisteredMemberProxyReference {
    id: string;
    relationships: RelationshipReference[] | null;
}

interface RegisteredProxyEntry {
    memberIds: Set<string>;
    phones: Set<string>;
}

export type RegisteredProxyIndex = Map<string, RegisteredProxyEntry>;

const SPACE_PATTERN = /\s+/g;
const NON_DIGIT_PATTERN = /\D/g;
const PARENTHESIS_PATTERN = /\(.*?\)/g;

export function normalizePersonName(value: string | null | undefined): string {
    return (value || '')
        .replace(PARENTHESIS_PATTERN, ' ')
        .replace(/[\r\n]+/g, ' ')
        .replace(SPACE_PATTERN, '')
        .trim();
}

export function normalizePhone(value: string | null | undefined): string {
    const digits = (value || '').replace(NON_DIGIT_PATTERN, '');
    return digits.length >= 8 ? digits : '';
}

export function buildRegisteredProxyIndex(
    members: RegisteredMemberProxyReference[] | null | undefined,
): RegisteredProxyIndex {
    const index: RegisteredProxyIndex = new Map();

    for (const member of members || []) {
        for (const relationship of member.relationships || []) {
            const nameKey = normalizePersonName(relationship.name);
            if (!nameKey) continue;

            let entry = index.get(nameKey);
            if (!entry) {
                entry = {
                    memberIds: new Set<string>(),
                    phones: new Set<string>(),
                };
                index.set(nameKey, entry);
            }

            entry.memberIds.add(member.id);

            const normalizedPhone = normalizePhone(relationship.phone);
            if (normalizedPhone) {
                entry.phones.add(normalizedPhone);
            }
        }
    }

    return index;
}

export function isRegisteredProxyMatch(
    originalName: string | null | undefined,
    contact: string | null | undefined,
    proxyIndex: RegisteredProxyIndex,
): boolean {
    const nameKey = normalizePersonName(originalName);
    if (!nameKey) return false;

    const entry = proxyIndex.get(nameKey);
    if (!entry) return false;

    if (entry.memberIds.size === 1) {
        return true;
    }

    const normalizedContact = normalizePhone(contact);
    if (!normalizedContact) return false;

    return entry.phones.has(normalizedContact);
}
