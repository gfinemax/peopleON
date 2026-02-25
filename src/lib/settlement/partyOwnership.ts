export type PartyProfileLite = {
    id: string;
    display_name: string;
    member_id: string | null;
};

export type MemberLite = {
    id: string;
    name: string | null;
};

export type PartyRoleLite = {
    party_id: string;
    role_type: string;
    role_status: string;
};

export type RightCertificateLite = {
    holder_party_id: string;
    status: string;
};

export type SettlementOwnerType = 'member_linked' | 'certificate_holder' | 'unlinked';

export type SettlementPartyOwnership = {
    party_id: string;
    owner_name: string;
    owner_type: SettlementOwnerType;
    member_id: string | null;
    display_name: string;
};

function normalizeText(value: string | null | undefined) {
    return (value || '').trim().toLowerCase();
}

function isActiveCertificateStatus(status: string | null | undefined) {
    const normalized = normalizeText(status);
    return normalized === 'active' || normalized === 'merged';
}

export function ownerTypeLabel(ownerType: SettlementOwnerType) {
    if (ownerType === 'member_linked') return '회원 연결';
    if (ownerType === 'certificate_holder') return '권리증 소유자';
    return '미연결 인물';
}

export function buildSettlementPartyOwnershipMap({
    parties,
    members,
    partyRoles,
    rightCertificates,
}: {
    parties: PartyProfileLite[];
    members: MemberLite[];
    partyRoles: PartyRoleLite[];
    rightCertificates: RightCertificateLite[];
}) {
    const ownershipMap = new Map<string, SettlementPartyOwnership>();

    const memberNameMap = new Map(
        members.map((member) => [member.id, (member.name || '').trim()]),
    );

    const roleCertificateHolderIds = new Set(
        partyRoles
            .filter(
                (role) =>
                    normalizeText(role.role_type) === 'certificate_holder' &&
                    normalizeText(role.role_status) === 'active',
            )
            .map((role) => role.party_id),
    );

    const certCertificateHolderIds = new Set(
        rightCertificates
            .filter((certificate) => isActiveCertificateStatus(certificate.status))
            .map((certificate) => certificate.holder_party_id),
    );

    for (const party of parties) {
        const displayName = (party.display_name || '').trim() || '-';
        const memberId = party.member_id;
        const memberName = memberId ? (memberNameMap.get(memberId) || '').trim() : '';
        const hasCertificateHolderLink =
            roleCertificateHolderIds.has(party.id) || certCertificateHolderIds.has(party.id);

        let ownerType: SettlementOwnerType = 'unlinked';
        let ownerName = displayName;

        if (memberId && memberName) {
            ownerType = 'member_linked';
            ownerName = memberName;
        } else if (memberId) {
            ownerType = 'member_linked';
            ownerName = displayName;
        } else if (hasCertificateHolderLink) {
            ownerType = 'certificate_holder';
            ownerName = displayName;
        }

        ownershipMap.set(party.id, {
            party_id: party.id,
            owner_name: ownerName,
            owner_type: ownerType,
            member_id: memberId,
            display_name: displayName,
        });
    }

    return ownershipMap;
}
