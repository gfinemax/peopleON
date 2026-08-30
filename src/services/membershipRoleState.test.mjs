import assert from 'node:assert/strict';
import test from 'node:test';
import {
    hasActiveRegistrationRole,
    isActiveRegistrationRole,
} from './membershipRoleState.ts';

test('inactive 등기 역할은 현재 등기조합원으로 계산하지 않는다', () => {
    const roles = [
        { role_status: 'inactive', is_registered: true },
        { role_status: 'active', is_registered: false },
    ];

    assert.equal(hasActiveRegistrationRole(roles), false);
});

test('active이면서 is_registered인 역할만 현재 등기로 계산한다', () => {
    assert.equal(isActiveRegistrationRole({ role_status: 'active', is_registered: true }), true);
    assert.equal(isActiveRegistrationRole({ role_status: 'inactive', is_registered: true }), false);
});
