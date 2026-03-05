import { assertMethod, requireSession, sendJson, safeError } from '../_lib/request.js';
import { toPublicUser } from '../_lib/user-helpers.js';

export default async function handler(req, res) {
    if (!assertMethod(req, res, 'GET')) {
        return;
    }

    try {
        const session = await requireSession(req);
        const user = toPublicUser(session.uid, session.profile);
        sendJson(res, 200, { ok: true, user, role: session.role });
    } catch (error) {
        safeError(res, error);
    }
}
