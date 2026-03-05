import { adminDb, FieldValue } from '../_lib/firebase-admin.js';
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

export default async function handler(req, res) {
    if (!assertMethod(req, res, 'POST')) {
        return;
    }

    try {
        const session = await requireSession(req);
        requireRole(session, 'moderator');

        const body = await readBody(req);
        const userId = String(body.userId || '').trim();

        if (!userId) {
            throw Object.assign(new Error('userId is required'), { statusCode: 400 });
        }

        const targetRef = adminDb.collection('users').doc(userId);
        const targetSnap = await targetRef.get();

        if (!targetSnap.exists) {
            throw Object.assign(new Error('Target user not found'), { statusCode: 404 });
        }

        const targetData = targetSnap.data() || {};
        requireManagePermission(session, normalizeRole(targetData.role));

        await targetRef.update({
            deviceHashes: [],
            blocked: false,
            blockedReason: null,
            blockedAt: null,
            devicesClearedAt: FieldValue.serverTimestamp(),
            devicesClearedBy: session.uid,
            updatedAt: FieldValue.serverTimestamp()
        });

        sendJson(res, 200, { ok: true });
    } catch (error) {
        safeError(res, error);
    }
}
