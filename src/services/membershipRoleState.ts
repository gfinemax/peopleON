export type RegistrationRoleState = {
    role_status?: string | null;
    is_registered?: boolean | null;
};

export const isActiveRegistrationRole = (role: RegistrationRoleState) =>
    role.role_status === 'active' && role.is_registered === true;

export const hasActiveRegistrationRole = (roles: RegistrationRoleState[]) =>
    roles.some(isActiveRegistrationRole);
