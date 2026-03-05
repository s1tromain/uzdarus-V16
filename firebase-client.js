import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updatePassword
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
    serverTimestamp,
    query,
    where,
    limit,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: 'AIzaSyB_0gyDPwaZpMIzhP7ukpi-KTWPPAlhfTs',
    authDomain: 'uzdarus-b97aa.firebaseapp.com',
    projectId: 'uzdarus-b97aa',
    storageBucket: 'uzdarus-b97aa.firebasestorage.app',
    messagingSenderId: '356182863532',
    appId: '1:356182863532:web:326d8e09465d86f0077909',
    measurementId: 'G-MG220RDLRP'
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const USER_LOCAL_KEY = 'currentUser';
const DEVICE_ID_KEY = 'uzdarus_device_id';

const packToCourses = {
    A1A2: ['a1-course.html', 'a1-vocabulary.html', 'a2-course.html', 'a2-vocabulary.html'],
    B1B2: ['b1-course.html', 'b1-vocabulary.html', 'b2-course.html', 'b2-vocabulary.html']
};

function normalizeUsername(rawValue) {
    return String(rawValue || '').trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
}

export function usernameToEmail(username) {
    const clean = normalizeUsername(username);
    if (!clean) {
        throw new Error('Login kiritilmagan');
    }

    return `${clean}@uzdarus.local`;
}

export function emailToUsername(email) {
    if (!email || !email.includes('@uzdarus.local')) {
        return '';
    }

    return email.replace('@uzdarus.local', '');
}

export async function getUserProfile(uid) {
    const profileRef = doc(db, 'users', uid);
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) {
        return null;
    }

    return {
        uid,
        ...profileSnap.data()
    };
}

export function normalizeDate(value) {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return value;
    }

    if (value instanceof Timestamp) {
        return value.toDate();
    }

    if (typeof value?.toDate === 'function') {
        return value.toDate();
    }

    if (typeof value === 'string' || typeof value === 'number') {
        const dateValue = new Date(value);
        return Number.isNaN(dateValue.getTime()) ? null : dateValue;
    }

    return null;
}

export function isSubscriptionActive(profile) {
    if (!profile?.subscription?.active) {
        return false;
    }

    const endDate = normalizeDate(profile.subscription.endAt);
    if (!endDate) {
        return false;
    }

    return endDate.getTime() >= Date.now();
}

export function hasPackAccess(profile, requiredPack) {
    if (!requiredPack) {
        return true;
    }

    const packs = Array.isArray(profile?.accessPacks) ? profile.accessPacks : [];
    return packs.includes(requiredPack);
}

export function getPackByPageName(pageName) {
    const normalized = String(pageName || '').toLowerCase();
    const cleanPath = normalized.split('?')[0].split('#')[0];
    const fileName = cleanPath.split('/').pop();

    if (packToCourses.A1A2.includes(fileName)) {
        return 'A1A2';
    }

    if (packToCourses.B1B2.includes(fileName)) {
        return 'B1B2';
    }

    return null;
}

export function saveLocalUser(authUser, profile) {
    const payload = {
        id: authUser.uid,
        uid: authUser.uid,
        email: authUser.email || profile?.email || '',
        name: profile?.displayName || authUser.displayName || profile?.username || 'Foydalanuvchi',
        username: profile?.username || emailToUsername(authUser.email),
        role: profile?.role || 'customer',
        accessPacks: Array.isArray(profile?.accessPacks) ? profile.accessPacks : []
    };

    localStorage.setItem(USER_LOCAL_KEY, JSON.stringify(payload));
    return payload;
}

export function clearLocalUser() {
    localStorage.removeItem(USER_LOCAL_KEY);
}

export function getLocalUser() {
    try {
        const raw = localStorage.getItem(USER_LOCAL_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

export function getOrCreateDeviceId() {
    let existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
        return existing;
    }

    if (crypto?.randomUUID) {
        existing = crypto.randomUUID();
    } else {
        existing = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    localStorage.setItem(DEVICE_ID_KEY, existing);
    return existing;
}

export async function sha256Hex(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(input));
    const digest = await crypto.subtle.digest('SHA-256', data);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function getBearerToken() {
    const current = auth.currentUser;
    if (!current) {
        throw new Error('Avval tizimga kiring');
    }

    return current.getIdToken();
}

export async function callApi(path, method = 'POST', body = {}) {
    const token = await getBearerToken();

    const response = await fetch(path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: method === 'GET' ? undefined : JSON.stringify(body)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(result?.error || 'API xatosi');
    }

    return result;
}

export async function findUserByUsername(username) {
    const normalized = normalizeUsername(username);
    const usersRef = collection(db, 'users');
    const usernameQuery = query(usersRef, where('username', '==', normalized), limit(1));
    const snapshot = await getDocs(usernameQuery);
    if (snapshot.empty) {
        return null;
    }

    const userDoc = snapshot.docs[0];
    return {
        uid: userDoc.id,
        ...userDoc.data()
    };
}

export {
    app,
    auth,
    db,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
    serverTimestamp,
    query,
    where,
    limit,
    Timestamp,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updatePassword
};
