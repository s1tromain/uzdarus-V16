import { Timestamp } from './firebase-admin.js';

const VALID_PACKS = new Set(['A1A2', 'B1B2']);

export function normalizeUsername(rawValue) {
    return String(rawValue || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '.')
        .replace(/[^a-z0-9._-]/g, '');
}

export function usernameToEmail(username) {
    const clean = normalizeUsername(username);
    if (!clean) {
        throw Object.assign(new Error('Username is required'), { statusCode: 400 });
    }

    return `${clean}@uzdarus.local`;
}

export function normalizePacks(rawPacks) {
    if (!Array.isArray(rawPacks)) {
        return [];
    }

    return rawPacks.filter((pack) => VALID_PACKS.has(pack));
}

function resolveEndDate({ active, durationDays, endAt }) {
    if (!active) {
        return null;
    }

    if (endAt) {
        const parsed = new Date(endAt);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }

    const days = Number(durationDays);
    if (!Number.isNaN(days) && days > 0) {
        const result = new Date();
        result.setDate(result.getDate() + days);
        return result;
    }

    return null;
}

export function buildSubscription(input = {}) {
    const active = Boolean(input.active);
    const endDate = resolveEndDate(input);

    return {
        active: active && Boolean(endDate),
        tariff: input.tariff || null,
        startAt: active ? Timestamp.now() : null,
        endAt: endDate ? Timestamp.fromDate(endDate) : null,
        updatedAt: Timestamp.now()
    };
}

export function toPublicUser(userId, data = {}) {
    const subscription = data.subscription || {};

    return {
        uid: userId,
        username: data.username || '',
        displayName: data.displayName || '',
        email: data.email || '',
        role: data.role || 'customer',
        blocked: Boolean(data.blocked),
        forcePasswordChange: Boolean(data.forcePasswordChange),
        accessPacks: Array.isArray(data.accessPacks) ? data.accessPacks : [],
        deviceCount: Array.isArray(data.deviceHashes) ? data.deviceHashes.length : 0,
        subscription: {
            active: Boolean(subscription.active),
            tariff: subscription.tariff || null,
            endAt: subscription.endAt || null
        },
        updatedAt: data.updatedAt || null
    };
}
