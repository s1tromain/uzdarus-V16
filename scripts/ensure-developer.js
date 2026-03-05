import {
    adminAuth,
    adminDb,
    FieldValue,
    Timestamp
} from '../api/_lib/firebase-admin.js';
import { randomInt } from 'node:crypto';
import { usernameToEmail } from '../api/_lib/user-helpers.js';

const DEVELOPER_USERNAME = 'developer';
const DEVELOPER_DISPLAY_NAME = 'Platform Owner';
const DEVELOPER_ROLE = 'developer';

function generateTemporaryPassword(length = 16) {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%^&*()-_=+[]{}?';
    const all = upper + lower + digits + symbols;

    const pick = (charset) => charset[randomInt(0, charset.length)];
    const passwordChars = [pick(upper), pick(lower), pick(digits), pick(symbols)];

    while (passwordChars.length < Math.max(12, length)) {
        passwordChars.push(pick(all));
    }

    for (let index = passwordChars.length - 1; index > 0; index -= 1) {
        const swapIndex = randomInt(0, index + 1);
        [passwordChars[index], passwordChars[swapIndex]] = [passwordChars[swapIndex], passwordChars[index]];
    }

    return passwordChars.join('');
}

async function findDeveloperByRole() {
    const snapshot = await adminDb
        .collection('users')
        .where('role', '==', DEVELOPER_ROLE)
        .limit(1)
        .get();

    if (snapshot.empty) {
        return null;
    }

    const docSnap = snapshot.docs[0];
    return {
        uid: docSnap.id,
        data: docSnap.data() || {}
    };
}

async function ensureDeveloper() {
    const email = usernameToEmail(DEVELOPER_USERNAME);
    const temporaryPassword = generateTemporaryPassword(18);

    let action = 'created';
    let uid = null;

    const existingDeveloper = await findDeveloperByRole();

    if (existingDeveloper) {
        uid = existingDeveloper.uid;
        action = 'reset-existing-developer';
    } else {
        try {
            const existingAuth = await adminAuth.getUserByEmail(email);
            uid = existingAuth.uid;
            action = 'promoted-existing-email-user';
        } catch (error) {
            if (error.code !== 'auth/user-not-found') {
                throw error;
            }

            const createdAuth = await adminAuth.createUser({
                email,
                displayName: DEVELOPER_DISPLAY_NAME,
                password: temporaryPassword,
                emailVerified: true,
                disabled: false
            });

            uid = createdAuth.uid;
            action = 'created-new-developer';
        }
    }

    await adminAuth.updateUser(uid, {
        email,
        displayName: DEVELOPER_DISPLAY_NAME,
        password: temporaryPassword,
        disabled: false
    });

    await adminAuth.setCustomUserClaims(uid, {
        role: DEVELOPER_ROLE
    });

    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();

    const basePayload = {
        username: DEVELOPER_USERNAME,
        displayName: DEVELOPER_DISPLAY_NAME,
        email,
        role: DEVELOPER_ROLE,
        blocked: false,
        blockedReason: null,
        forcePasswordChange: true,
        accessPacks: ['A1A2', 'B1B2'],
        subscription: {
            active: true,
            tariff: 'PLATFORM_OWNER',
            startAt: Timestamp.now(),
            endAt: null,
            updatedAt: Timestamp.now()
        },
        updatedAt: FieldValue.serverTimestamp()
    };

    if (!userSnap.exists) {
        await userRef.set({
            ...basePayload,
            deviceHashes: [],
            createdAt: FieldValue.serverTimestamp()
        });
    } else {
        await userRef.set(basePayload, { merge: true });
    }

    return {
        action,
        login: DEVELOPER_USERNAME,
        temporaryPassword,
        uid
    };
}

async function main() {
    try {
        const result = await ensureDeveloper();

        console.log('Developer account status:', result.action);
        console.log(`Developer login: ${result.login}`);
        console.log(`Temporary password: ${result.temporaryPassword}`);
        console.log('Password is shown once. Store it safely and change on first login via /my.cabinet.');
    } catch (error) {
        if (error?.code === 'auth/configuration-not-found') {
            console.error('Failed to ensure developer account: Firebase Authentication is not configured for this project.');
            console.error('Open Firebase Console -> Authentication -> Get started, then enable Email/Password sign-in provider.');
            console.error('After that, run: npm run ensure:developer');
        } else {
            console.error('Failed to ensure developer account:', error.message || error);
        }
        process.exitCode = 1;
    }
}

main();
