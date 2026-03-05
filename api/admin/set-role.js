import { adminAuth, adminDb, FieldValue } from '../_lib/firebase-admin.js';
import {
    assertMethod,
    readBody,
    requireSession,
    requireRole,
    requireManagePermission,
    sendJson,
    safeError
} from '../_lib/request.js';
import { normalizeRole } from '../_lib/roles.js';
import { buildSubscription } from '../_lib/user-helpers.js';

export default async function handler(req, res) {
    if (!assertMethod(req, res, 'POST')) {
        return;
    }

    try {
        const session = await requireSession(req);
        requireRole(session, 'admin');

        const body = await readBody(req);
        const userId = String(body.userId || '').trim();
        const newRole = normalizeRole(body.role);

        if (!userId) {
            throw Object.assign(new Error('userId is required'), { statusCode: 400 });
        }

        if (userId === session.uid) {
            throw Object.assign(new Error('You cannot change your own role'), { statusCode: 400 });
        }

        const targetRef = adminDb.collection('users').doc(userId);
        const targetSnap = await targetRef.get();

        if (!targetSnap.exists) {
            throw Object.assign(new Error('Target user not found'), { statusCode: 404 });
        }

        const targetData = targetSnap.data() || {};
        const targetRole = normalizeRole(targetData.role);

        requireManagePermission(session, targetRole);
        requireManagePermission(session, newRole);

        const updateData = {
            role: newRole,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: session.uid
        };

        if (newRole !== 'customer') {
            updateData.accessPacks = [];
            updateData.subscription = buildSubscription({ active: false, tariff: null });
        }

        await adminAuth.setCustomUserClaims(userId, { role: newRole });
        await targetRef.update(updateData);

        sendJson(res, 200, { ok: true, role: newRole });
    } catch (error) {
        safeError(res, error);
    }
}
