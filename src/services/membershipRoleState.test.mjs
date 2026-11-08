import assert from 'node:assert/strict';
import test from 'node:test';
import {
    hasRegistrationHistory,
    isRegisteredMembershipRole,
    isRegisteredRoleCode,
} from './membershipRoleState.ts';

test('비활성 상태여도 등기 이력이 있으면 등기조합원으로 계산한다', () => {
    const roles = [
        { role_code: '등기조합원', role_status: 'inactive', is_registered: true },
        { role_status: 'active', is_registered: false },
    ];

    assert.equal(hasRegistrationHistory(roles), true);
});

test('is_registered 이력이 있는 역할만 등기로 계산한다', () => {
    assert.equal(isRegisteredMembershipRole({ role_code: '등기조합원', role_status: 'active', is_registered: true }), true);
    assert.equal(isRegisteredMembershipRole({ role_code: '등기조합원', role_status: 'inactive', is_registered: true }), true);
    assert.equal(isRegisteredMembershipRole({ role_code: '등기조합원', role_status: 'active', is_registered: false }), false);
    assert.equal(isRegisteredMembershipRole({ role_code: '등기조합원', role_status: 'inactive', is_registered: false }), false);
});

test('탈퇴예정자의 등기 이력도 등기조합원으로 계산한다', () => {
    assert.equal(isRegisteredRoleCode('탈퇴예정'), true);
    assert.equal(isRegisteredMembershipRole({ role_code: '탈퇴예정', role_status: 'active', is_registered: true }), true);
    assert.equal(hasRegistrationHistory([
        { role_code: '탈퇴예정', role_status: 'active', is_registered: true },
    ]), true);
});

test('실제 탈퇴 후에도 등기 이력은 등기조합원 집계에 유지한다', () => {
    assert.equal(hasRegistrationHistory([
        { role_code: '탈퇴예정', role_status: 'inactive', is_registered: true },
        { role_code: '등기조합원', role_status: 'inactive', is_registered: true },
    ]), true);
});

test('64명 활성 등기와 21명 비활성 등기 이력을 모두 포함하면 85명이다', () => {
    const roles = [
        ...Array.from({ length: 64 }, (_, index) => ({
            entity_id: `active-${index}`,
            role_code: '등기조합원',
            role_status: 'active',
            is_registered: true,
        })),
        ...Array.from({ length: 21 }, (_, index) => ({
            entity_id: `inactive-${index}`,
            role_code: '등기조합원',
            role_status: 'inactive',
            is_registered: true,
        })),
    ];

    const registeredEntityIds = new Set(
        roles.filter(isRegisteredMembershipRole).map((role) => role.entity_id),
    );
    assert.equal(registeredEntityIds.size, 85);
});
