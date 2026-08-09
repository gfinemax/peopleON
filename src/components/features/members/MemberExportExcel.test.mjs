import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    formatExportCategory,
    formatExportRelationships,
    formatExportStatus,
} from './MemberExportExcel.ts';

describe('member export formatting', () => {
    it('formats category like the members table role badges', () => {
        assert.equal(
            formatExportCategory({
                id: '1',
                name: '강광자',
                phone: null,
                certificate_numbers: ['2006-1-212'],
                tier: '등기조합원',
                tiers: ['등기조합원', '권리증보유자'],
                unit_group: null,
                status: '정상',
                role_types: ['member', 'certificate_holder'],
                raw_certificate_count: 1,
                managed_certificate_count: 1,
            }),
            '조합원(등기), 가입신청필증 보유',
        );
    });

    it('exports relationship names and relation labels', () => {
        assert.equal(
            formatExportRelationships({
                id: '1',
                name: '강광자',
                phone: null,
                tier: '등기조합원',
                unit_group: null,
                status: '정상',
                relationships: [{ name: '신승희', relation: '자녀' }],
                raw_certificate_count: 1,
                managed_certificate_count: 1,
            }),
            '신승희자녀',
        );
    });

    it('exports normal status as registered label', () => {
        assert.equal(formatExportStatus('정상'), '등기');
        assert.equal(formatExportStatus('탈퇴'), '탈퇴');
        assert.equal(formatExportStatus(null), '');
    });

    it('prefers table display status for export status', () => {
        assert.equal(formatExportStatus('정상', '환불'), '환불');
        assert.equal(formatExportStatus('정상', '대리인'), '대리인');
        assert.equal(formatExportStatus('정상', '정상'), '등기');
    });
});
