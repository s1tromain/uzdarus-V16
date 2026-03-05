import { adminDb } from '../_lib/firebase-admin.js';
import { assertMethod, requireSession, requireRole, sendJson, safeError } from '../_lib/request.js';
import { normalizeRole } from '../_lib/roles.js';

function toDate(value) {
    if (!value) {
        return null;
    }

    if (typeof value?.toDate === 'function') {
        return value.toDate();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default async function handler(req, res) {
    if (!assertMethod(req, res, 'GET')) {
        return;
    }

    try {
        const session = await requireSession(req);
        requireRole(session, 'moderator');

        const snapshot = await adminDb.collection('users').get();
        const docs = snapshot.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }));

        const roleCounts = {
            customer: 0,
            moderator: 0,
            admin: 0,
            developer: 0
        };

        let activeSubscriptions = 0;
        let blockedUsers = 0;
        let registeredDevices = 0;

        const now = Date.now();

        for (const user of docs) {
            const role = normalizeRole(user.role);
            roleCounts[role] = (roleCounts[role] || 0) + 1;

            if (user.blocked) {
                blockedUsers += 1;
            }

            const deviceCount = Array.isArray(user.deviceHashes) ? user.deviceHashes.length : 0;
            registeredDevices += deviceCount;

            if (role === 'customer') {
                const subscription = user.subscription || {};
                const endAt = toDate(subscription.endAt);
                if (subscription.active && endAt && endAt.getTime() >= now) {
                    activeSubscriptions += 1;
                }
            }
        }

        sendJson(res, 200, {
            ok: true,
            stats: {
                totalUsers: docs.length,
                roleCounts,
                activeSubscriptions,
                blockedUsers,
                registeredDevices
            }
        });
    } catch (error) {
        safeError(res, error);
    }
}
