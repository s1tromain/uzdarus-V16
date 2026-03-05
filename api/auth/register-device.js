import { adminDb, FieldValue } from '../_lib/firebase-admin.js';
import { assertMethod, readBody, requireSession, sendJson, safeError } from '../_lib/request.js';

const MAX_DEVICES = 3;

export default async function handler(req, res) {
    if (!assertMethod(req, res, 'POST')) {
        return;
    }

    try {
        const session = await requireSession(req);
        const body = await readBody(req);
        const deviceIdHash = String(body.deviceIdHash || '').trim().toLowerCase();

        if (!/^[a-f0-9]{64}$/.test(deviceIdHash)) {
            throw Object.assign(new Error('Invalid device hash'), { statusCode: 400 });
        }

        const profileRef = adminDb.collection('users').doc(session.uid);

        const result = await adminDb.runTransaction(async (transaction) => {
            const profileSnap = await transaction.get(profileRef);

            if (!profileSnap.exists) {
                throw Object.assign(new Error('User profile not found'), { statusCode: 404 });
            }

            const profile = profileSnap.data() || {};
            const existingHashes = Array.isArray(profile.deviceHashes) ? profile.deviceHashes : [];

            if (profile.blocked) {
                return {
                    blocked: true,
                    reason: profile.blockedReason || 'ACCOUNT_BLOCKED',
                    deviceCount: existingHashes.length,
                    maxDevices: MAX_DEVICES
                };
            }

            if (existingHashes.includes(deviceIdHash)) {
                transaction.update(profileRef, {
                    lastDeviceSeenAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                });

                return {
                    blocked: false,
                    knownDevice: true,
                    deviceCount: existingHashes.length,
                    maxDevices: MAX_DEVICES
                };
            }

            if (existingHashes.length >= MAX_DEVICES) {
                transaction.update(profileRef, {
                    blocked: true,
                    blockedReason: 'DEVICE_LIMIT_EXCEEDED',
                    blockedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                });

                return {
                    blocked: true,
                    reason: 'DEVICE_LIMIT_EXCEEDED',
                    deviceCount: existingHashes.length,
                    maxDevices: MAX_DEVICES
                };
            }

            const nextHashes = [...existingHashes, deviceIdHash];

            transaction.update(profileRef, {
                deviceHashes: nextHashes,
                lastDeviceSeenAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });

            return {
                blocked: false,
                knownDevice: false,
                deviceCount: nextHashes.length,
                maxDevices: MAX_DEVICES
            };
        });

        sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
        safeError(res, error);
    }
}
