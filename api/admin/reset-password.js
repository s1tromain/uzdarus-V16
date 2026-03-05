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

export default async function handler(req, res) {
    if (!assertMethod(req, res, 'POST')) {
        return;
    }

    try {
        const session = await requireSession(req);
        requireRole(session, 'moderator');

        const body = await readBody(req);
        const userId = String(body.userId || '').trim();
        const temporaryPassword = String(body.temporaryPassword || body.password || '');

        if (!userId) {
            throw Object.assign(new Error('userId is required'), { statusCode: 400 });
        }

        if (temporaryPassword.length < 8) {
            throw Object.assign(new Error('Temporary password must be at least 8 characters'), { statusCode: 400 });
        }

        const targetRef = adminDb.collection('users').doc(userId);
        const targetSnap = await targetRef.get();

        if (!targetSnap.exists) {
            throw Object.assign(new Error('Target user not found'), { statusCode: 404 });
        }

        const targetData = targetSnap.data() || {};
        const targetRole = normalizeRole(targetData.role);

        requireManagePermission(session, targetRole);

        await adminAuth.updateUser(userId, { password: temporaryPassword, disabled: false });
        await targetRef.update({
            forcePasswordChange: true,
            updatedAt: FieldValue.serverTimestamp(),
            lastPasswordResetAt: FieldValue.serverTimestamp(),
            lastPasswordResetBy: session.uid
        });

        sendJson(res, 200, { ok: true });
    } catch (error) {
        safeError(res, error);
    }
}
