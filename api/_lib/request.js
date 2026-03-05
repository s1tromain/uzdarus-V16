import { adminAuth, adminDb } from './firebase-admin.js';
import { normalizeRole, isRoleAtLeast, canManageRole } from './roles.js';

export function sendJson(res, statusCode, payload) {
    res.status(statusCode).json(payload);
}

export function assertMethod(req, res, method) {
    if (req.method !== method) {
        sendJson(res, 405, { error: `Method ${req.method} not allowed` });
        return false;
    }

    return true;
}

export async function readBody(req) {
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }

    if (typeof req.body === 'string' && req.body.length > 0) {
        try {
            return JSON.parse(req.body);
        } catch (error) {
            return {};
        }
    }

    return {};
}

export async function requireSession(req) {
    const authHeader = req.headers.authorization || req.headers.Authorization || '';

    if (!authHeader.toLowerCase().startsWith('bearer ')) {
        throw Object.assign(new Error('Authorization token required'), { statusCode: 401 });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
        throw Object.assign(new Error('Invalid token'), { statusCode: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token, true);
    const profileRef = adminDb.collection('users').doc(decoded.uid);
    const profileSnap = await profileRef.get();

    if (!profileSnap.exists) {
        throw Object.assign(new Error('User profile not found'), { statusCode: 403 });
    }

    const profile = profileSnap.data() || {};
    const role = normalizeRole(profile.role || decoded.role);

    return {
        uid: decoded.uid,
        decoded,
        role,
        profile,
        profileRef
    };
}

export function requireRole(session, minimumRole) {
    if (!isRoleAtLeast(session.role, minimumRole)) {
        throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
}

export function requireManagePermission(session, targetRole) {
    if (!canManageRole(session.role, targetRole)) {
        throw Object.assign(new Error('Role hierarchy violation'), { statusCode: 403 });
    }
}

export function safeError(res, error) {
    const statusCode = error?.statusCode || 500;
    const message = error?.message || 'Unexpected server error';
    sendJson(res, statusCode, { error: message });
}
