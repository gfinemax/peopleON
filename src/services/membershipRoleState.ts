export type RegistrationRoleState = {
    role_code?: string | null;
    role_status?: string | null;
    is_registered?: boolean | null;
};

export const isRegisteredRoleCode = (roleCode?: string | null) =>
    ['1차', '등기조합원', '탈퇴예정'].includes((roleCode || '').trim());

// A canonical registered-member role remains registration history even when
// that row becomes inactive after a category/status transition.
export const isRegisteredMembershipRole = (role: RegistrationRoleState) =>
    role.is_registered === true && ['1차', '등기조합원'].includes((role.role_code || '').trim());

export const hasRegistrationHistory = (roles: RegistrationRoleState[]) =>
    roles.some(isRegisteredMembershipRole);
