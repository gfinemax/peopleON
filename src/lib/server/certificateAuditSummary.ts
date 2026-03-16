import type {
    PersonCertificateRollupRow,
    PersonCertificateSummaryRow,
} from '@/lib/server/personCertificateSummary';
import type {
    CertificateRegistrySourceRow,
    FinanceCertificateRow,
} from '@/lib/server/certificateAuditTypes';

type PersonSummaryRollup = PersonCertificateRollupRow;

const DEFAULT_REGISTERED_PERSON_ROLLUP: PersonSummaryRollup = {
    owner_group: 'registered',
    owner_count: 0,
    owner_with_certificate_count: 0,
    provisional_certificate_count: 0,
    effective_certificate_count: 0,
    conflict_certificate_count: 0,
    manual_locked_count: 0,
    pending_review_count: 0,
};

const DEFAULT_OTHERS_PERSON_ROLLUP: PersonSummaryRollup = {
    owner_group: 'others',
    owner_count: 0,
    owner_with_certificate_count: 0,
    provisional_certificate_count: 0,
    effective_certificate_count: 0,
    conflict_certificate_count: 0,
    manual_locked_count: 0,
    pending_review_count: 0,
};

function parseNoteMeta(note: unknown) {
    if (note && typeof note === 'object' && !Array.isArray(note)) {
        return note as Record<string, unknown>;
    }

    if (typeof note === 'string' && note.trim().startsWith('{')) {
        try {
            return JSON.parse(note) as Record<string, unknown>;
        } catch {
            return {};
        }
    }

    return {};
}

export function parseFinanceCertificateRows(rows: CertificateRegistrySourceRow[]) {
    return rows.map((row) => {
        const parsedMeta = parseNoteMeta(row.note);

        return {
            id: row.id,
            entity_id: row.entity_id,
            status: row.certificate_status,
            meta: parsedMeta,
            account_entities: row.account_entities || null,
            right_type: 'certificate' as const,
            right_number: row.certificate_number_normalized || row.certificate_number_raw,
            right_number_raw: row.certificate_number_raw,
            right_number_status: row.certificate_status,
            right_number_note: typeof row.note === 'string' ? row.note : JSON.stringify(parsedMeta),
        } satisfies FinanceCertificateRow;
    });
}

export function buildPersonSummaryAuditData(
    personSummaryRollups: PersonCertificateRollupRow[],
    personSummaryRows: PersonCertificateSummaryRow[],
) {
    const personSummaryRollupMap = new Map(personSummaryRollups.map((row) => [row.owner_group, row]));
    const registeredPersonRollup = personSummaryRollupMap.get('registered') || DEFAULT_REGISTERED_PERSON_ROLLUP;
    const othersPersonRollup = personSummaryRollupMap.get('others') || DEFAULT_OTHERS_PERSON_ROLLUP;
    const totalManualLockedCount = personSummaryRollups.reduce((sum, row) => sum + row.manual_locked_count, 0);
    const totalPendingReviewCount = personSummaryRollups.reduce((sum, row) => sum + row.pending_review_count, 0);

    const registeredSummaryReviewRows = personSummaryRows
        .filter((row) =>
            row.owner_group === 'registered' &&
            (
                row.review_status !== 'manual_locked' ||
                row.conflict_certificate_count > 0 ||
                row.effective_certificate_count === 0
            ),
        )
        .sort((a, b) =>
            (b.conflict_certificate_count - a.conflict_certificate_count) ||
            (b.effective_certificate_count - a.effective_certificate_count) ||
            (a.display_name || '').localeCompare(b.display_name || '', 'ko'),
        );

    return {
        registeredPersonRollup,
        othersPersonRollup,
        totalManualLockedCount,
        totalPendingReviewCount,
        registeredSummaryReviewRows,
    };
}
