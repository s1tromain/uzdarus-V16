export const ROLE_LEVEL = {
    customer: 0,
    moderator: 1,
    admin: 2,
    developer: 3
};

export function normalizeRole(role) {
    const value = String(role || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(ROLE_LEVEL, value) ? value : 'customer';
}

export function isRoleAtLeast(role, minimumRole) {
    const roleValue = ROLE_LEVEL[normalizeRole(role)];
    const minimumValue = ROLE_LEVEL[normalizeRole(minimumRole)];
    return roleValue >= minimumValue;
}

export function canManageRole(actorRole, targetRole) {
    const actor = normalizeRole(actorRole);
    const target = normalizeRole(targetRole);

    if (actor === 'developer') {
        return true;
    }

    if (actor === 'admin') {
        return target === 'moderator' || target === 'customer';
    }

    if (actor === 'moderator') {
        return target === 'customer';
    }

    return false;
}
