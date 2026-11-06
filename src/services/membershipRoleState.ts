export type RegistrationRoleState = {
    role_code?: string | null;
    role_status?: string | null;
    is_registered?: boolean | null;
};

export const isRegisteredRoleCode = (roleCode?: string | null) =>
    ['1차', '등기조합원', '탈퇴예정'].includes((roleCode || '').trim());

export const isActiveRegistrationRole = (role: RegistrationRoleState) =>
    role.role_status === 'active' && (role.is_registered === true || isRegisteredRoleCode(role.role_code));

export const hasActiveRegistrationRole = (roles: RegistrationRoleState[]) =>
    roles.some(isActiveRegistrationRole);
