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
import { usernameToEmail, normalizeUsername, normalizePacks, buildSubscription } from '../_lib/user-helpers.js';

export default async function handler(req, res) {
    if (!assertMethod(req, res, 'POST')) {
        return;
    }

    let createdUid = null;

    try {
        const session = await requireSession(req);
        requireRole(session, 'moderator');

        const body = await readBody(req);
        const username = normalizeUsername(body.username);
        const displayName = String(body.displayName || '').trim();
        const temporaryPassword = String(body.temporaryPassword || body.password || '');
        const targetRole = normalizeRole(body.role || 'customer');

        requireManagePermission(session, targetRole);

        if (!username) {
            throw Object.assign(new Error('Username is required'), { statusCode: 400 });
        }

        if (temporaryPassword.length < 8) {
            throw Object.assign(new Error('Temporary password must be at least 8 characters'), { statusCode: 400 });
        }

        const email = usernameToEmail(username);

        try {
            await adminAuth.getUserByEmail(email);
            throw Object.assign(new Error('Username already exists'), { statusCode: 409 });
        } catch (error) {
            if (error?.statusCode === 409) {
                throw error;
            }

            if (error?.code !== 'auth/user-not-found') {
                throw error;
            }
        }

        const created = await adminAuth.createUser({
            email,
            password: temporaryPassword,
            displayName: displayName || username,
            emailVerified: true,
            disabled: false
        });

        createdUid = created.uid;
        await adminAuth.setCustomUserClaims(created.uid, { role: targetRole });

        const isCustomer = targetRole === 'customer';
        const packs = isCustomer ? normalizePacks(body.accessPacks) : [];
        const subscription = isCustomer
            ? buildSubscription({
                  active: Boolean(body.subscriptionActive ?? true),
                  tariff: body.tariff || 'START',
                  durationDays: body.subscriptionDays,
                  endAt: body.subscriptionEndAt
              })
            : buildSubscription({ active: false, tariff: null });

        await adminDb.collection('users').doc(created.uid).set({
            username,
            displayName: displayName || username,
            email,
            role: targetRole,
            blocked: false,
            blockedReason: null,
            forcePasswordChange: true,
            accessPacks: packs,
            deviceHashes: [],
            subscription,
            createdBy: session.uid,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        sendJson(res, 200, {
            ok: true,
            user: {
                uid: created.uid,
                username,
                role: targetRole,
                email
            }
        });
    } catch (error) {
        if (createdUid) {
            await adminAuth.deleteUser(createdUid).catch(() => null);
        }
        safeError(res, error);
    }
}
