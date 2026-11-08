export type RegistrationRoleState = {
    role_code?: string | null;
    role_status?: string | null;
    is_registered?: boolean | null;
};

export const isRegisteredRoleCode = (roleCode?: string | null) =>
    ['1차', '등기조합원', '탈퇴예정'].includes((roleCode || '').trim());

// A registered-member role remains registration history even when that row
// becomes inactive after a category/status transition. Pending withdrawal is
// still part of the registered roster, while refund/withdrawn roles are not.
export const isRegisteredMembershipRole = (role: RegistrationRoleState) =>
    role.is_registered === true && isRegisteredRoleCode(role.role_code);

export const hasRegistrationHistory = (roles: RegistrationRoleState[]) =>
    roles.some(isRegisteredMembershipRole);
