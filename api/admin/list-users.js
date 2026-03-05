import { adminDb } from '../_lib/firebase-admin.js';
import { assertMethod, requireSession, requireRole, sendJson, safeError } from '../_lib/request.js';
import { normalizeRole } from '../_lib/roles.js';
import { toPublicUser } from '../_lib/user-helpers.js';

function canViewTarget(actorRole, targetRole) {
    const actor = normalizeRole(actorRole);
    const target = normalizeRole(targetRole);

    if (actor === 'developer') {
        return true;
    }

    if (actor === 'admin') {
        return target !== 'developer';
    }

    if (actor === 'moderator') {
        return target === 'customer';
    }

    return false;
}

export default async function handler(req, res) {
    if (!assertMethod(req, res, 'GET')) {
        return;
    }

    try {
        const session = await requireSession(req);
        requireRole(session, 'moderator');

        const snapshot = await adminDb.collection('users').get();
        const users = snapshot.docs
            .map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }))
            .filter((user) => canViewTarget(session.role, user.role))
            .map((user) => toPublicUser(user.uid, user));

        sendJson(res, 200, { ok: true, users });
    } catch (error) {
        safeError(res, error);
    }
}
