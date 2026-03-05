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
import { buildSubscription, normalizePacks } from '../_lib/user-helpers.js';

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
        const targetRole = normalizeRole(targetData.role);
        requireManagePermission(session, targetRole);

        if (targetRole !== 'customer') {
            throw Object.assign(new Error('Subscription can only be changed for customers'), { statusCode: 400 });
        }

        const subscription = buildSubscription({
            active: Boolean(body.active),
            tariff: body.tariff || targetData?.subscription?.tariff || 'START',
            durationDays: body.durationDays,
            endAt: body.endAt
        });

        const updateData = {
            subscription,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: session.uid
        };

        if (Array.isArray(body.accessPacks)) {
            updateData.accessPacks = normalizePacks(body.accessPacks);
        }

        await targetRef.update(updateData);

        sendJson(res, 200, { ok: true, subscription, accessPacks: updateData.accessPacks || targetData.accessPacks || [] });
    } catch (error) {
        safeError(res, error);
    }
}
