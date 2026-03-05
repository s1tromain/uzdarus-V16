import {
    auth,
    db,
    doc,
    updateDoc,
    serverTimestamp,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updatePassword,
    usernameToEmail,
    getUserProfile,
    getPackByPageName,
    hasPackAccess,
    isSubscriptionActive,
    saveLocalUser,
    clearLocalUser,
    getOrCreateDeviceId,
    sha256Hex,
    callApi
} from '../firebase-client.js';

function showNotice(element, text, type = 'error') {
    if (!element) {
        return;
    }

    element.textContent = text;
    element.classList.remove('error', 'success');
    element.classList.add(type, 'show');
}

function clearNotice(element) {
    if (!element) {
        return;
    }

    element.textContent = '';
    element.classList.remove('show', 'error', 'success');
}

function getRedirectTarget(defaultPath = './dashboard.html') {
    const params = new URLSearchParams(window.location.search);
    return params.get('redirect') || defaultPath;
}

async function registerCurrentDevice() {
    const deviceId = getOrCreateDeviceId();
    const deviceIdHash = await sha256Hex(deviceId);
    return callApi('/api/auth/register-device', 'POST', { deviceIdHash });
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function formatDate(dateValue) {
    if (!dateValue) {
        return '-';
    }

    const date = typeof dateValue?.toDate === 'function' ? dateValue.toDate() : new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleDateString('uz-UZ');
}

async function ensureAuthenticated({ requirePasswordReset = false } = {}) {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();

            try {
                if (!user) {
                    window.location.href = './index.html';
                    return;
                }

                const profile = await getUserProfile(user.uid);
                if (!profile) {
                    await signOut(auth);
                    clearLocalUser();
                    window.location.href = './index.html';
                    return;
                }

                saveLocalUser(user, profile);

                if (requirePasswordReset && !profile.forcePasswordChange) {
                    window.location.href = './dashboard.html';
                    return;
                }

                if (!requirePasswordReset && profile.forcePasswordChange) {
                    window.location.href = './change-password.html';
                    return;
                }

                resolve({ user, profile });
            } catch (error) {
                reject(error);
            }
        }, reject);
    });
}

async function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');

    if (!loginForm) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('logout') === '1') {
        await signOut(auth).catch(() => null);
        clearLocalUser();
        params.delete('logout');
        const query = params.toString();
        const cleanUrl = query ? `./index.html?${query}` : './index.html';
        window.history.replaceState({}, '', cleanUrl);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();

        if (!user) {
            return;
        }

        const profile = await getUserProfile(user.uid);
        if (!profile) {
            return;
        }

        saveLocalUser(user, profile);

        if (profile.forcePasswordChange) {
            window.location.href = './change-password.html';
            return;
        }

        const redirect = getRedirectTarget('./dashboard.html');
        window.location.href = redirect;
    });

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearNotice(loginError);

        const formData = new FormData(loginForm);
        const username = String(formData.get('username') || '').trim();
        const password = String(formData.get('password') || '');

        if (!username || !password) {
            showNotice(loginError, 'Login va parolni kiriting.');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = 'Tekshirilmoqda...';

        try {
            const email = usernameToEmail(username);
            const credential = await signInWithEmailAndPassword(auth, email, password);
            const profile = await getUserProfile(credential.user.uid);

            if (!profile) {
                throw new Error('Profil topilmadi. Moderatsiyaga murojaat qiling.');
            }

            saveLocalUser(credential.user, profile);

            if (profile.forcePasswordChange) {
                window.location.href = './change-password.html';
                return;
            }

            const registerResult = await registerCurrentDevice();
            if (registerResult?.blocked) {
                window.location.href = './dashboard.html?status=blocked';
                return;
            }

            const redirect = getRedirectTarget('./dashboard.html');
            window.location.href = redirect;
        } catch (error) {
            showNotice(loginError, error.message || 'Kirish amalga oshmadi.');
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Kirish';
        }
    });
}

async function initChangePasswordPage() {
    const form = document.getElementById('changePasswordForm');
    const errorNotice = document.getElementById('changeError');
    const successNotice = document.getElementById('changeSuccess');
    const button = document.getElementById('changeBtn');

    if (!form) {
        return;
    }

    const { user, profile } = await ensureAuthenticated({ requirePasswordReset: true });

    if (!profile.forcePasswordChange) {
        window.location.href = './dashboard.html';
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearNotice(errorNotice);
        clearNotice(successNotice);

        const formData = new FormData(form);
        const newPassword = String(formData.get('newPassword') || '');
        const confirmPassword = String(formData.get('confirmPassword') || '');

        if (newPassword.length < 8) {
            showNotice(errorNotice, 'Parol kamida 8 ta belgidan iborat bo‘lishi kerak.');
            return;
        }

        if (newPassword !== confirmPassword) {
            showNotice(errorNotice, 'Parollar bir xil emas.');
            return;
        }

        button.disabled = true;
        button.textContent = 'Saqlanmoqda...';

        try {
            await updatePassword(user, newPassword);
            await updateDoc(doc(db, 'users', user.uid), {
                forcePasswordChange: false,
                updatedAt: serverTimestamp(),
                lastPasswordChangeAt: serverTimestamp()
            });

            await registerCurrentDevice();
            showNotice(successNotice, 'Parol muvaffaqiyatli yangilandi.', 'success');
            setTimeout(() => {
                window.location.href = './dashboard.html';
            }, 700);
        } catch (error) {
            showNotice(errorNotice, error.message || 'Parolni yangilashda xatolik yuz berdi.');
        } finally {
            button.disabled = false;
            button.textContent = 'Parolni saqlash';
        }
    });
}

function createPackCard({ title, description, href, enabled }) {
    const card = document.createElement('article');
    card.className = 'pack-card';

    const action = enabled
        ? `<a class="btn" href="${href}">Kursni ochish</a>`
        : '<button class="btn btn-secondary" type="button" disabled>Ruxsat yo‘q</button>';

    card.innerHTML = `
        <h3>${title}</h3>
        <p>${description}</p>
        ${action}
    `;

    return card;
}

async function initDashboardPage() {
    const profileName = document.getElementById('profileName');
    const profileMeta = document.getElementById('profileMeta');
    const subscriptionBadge = document.getElementById('subscriptionBadge');
    const dashboardError = document.getElementById('dashboardError');
    const dashboardInfo = document.getElementById('dashboardInfo');
    const blockBanner = document.getElementById('dashboardBlock');
    const packGrid = document.getElementById('packGrid');
    const logoutBtn = document.getElementById('logoutBtn');

    const { user, profile } = await ensureAuthenticated();

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await signOut(auth);
            clearLocalUser();
            window.location.href = './index.html';
        });
    }

    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');

    if (status === 'blocked') {
        showNotice(dashboardError, 'Akkaunt vaqtincha bloklangan, moderatsiyaga murojaat qiling.');
    }

    if (status === 'expired') {
        showNotice(dashboardError, 'Obuna muddati tugagan. Moderatsiyaga murojaat qiling.');
    }

    if (status === 'no-access') {
        showNotice(dashboardError, 'Sizda bu kursga ruxsat yo‘q.');
    }

    const activeSubscription = isSubscriptionActive(profile);
    const packs = asArray(profile.accessPacks);

    profileName.textContent = profile.displayName || profile.username || 'Foydalanuvchi';
    profileMeta.textContent = `@${profile.username || ''} • ${profile.role || 'customer'} • ${profile.subscription?.tariff || 'Tarif yo‘q'} (${formatDate(profile.subscription?.endAt)} gacha)`;

    if (profile.blocked) {
        subscriptionBadge.textContent = 'Bloklangan';
        subscriptionBadge.className = 'status-pill status-inactive';
        if (blockBanner) {
            blockBanner.style.display = 'block';
            blockBanner.textContent = 'Akkaunt vaqtincha bloklangan, moderatsiyaga murojaat qiling.';
        }
    } else if (activeSubscription) {
        subscriptionBadge.textContent = 'Obuna faol';
        subscriptionBadge.className = 'status-pill status-active';
    } else {
        subscriptionBadge.textContent = 'Obuna faol emas';
        subscriptionBadge.className = 'status-pill status-inactive';
    }

    if (!profile.blocked) {
        try {
            const registerResult = await registerCurrentDevice();
            if (registerResult?.blocked) {
                if (blockBanner) {
                    blockBanner.style.display = 'block';
                    blockBanner.textContent = 'Akkaunt vaqtincha bloklangan, moderatsiyaga murojaat qiling.';
                }
            }
        } catch (error) {
            showNotice(dashboardError, error.message || 'Qurilma tekshiruvida xatolik yuz berdi.');
        }
    }

    const cards = [
        {
            title: 'Pack 1: A1–A2',
            description: 'Boshlang‘ich va asosiy bosqichlar',
            href: '../paid-courses/a1-course.html',
            enabled: activeSubscription && !profile.blocked && packs.includes('A1A2')
        },
        {
            title: 'Pack 2: B1–B2',
            description: 'O‘rta va yuqori-o‘rta bosqichlar',
            href: '../paid-courses/b1-course.html',
            enabled: activeSubscription && !profile.blocked && packs.includes('B1B2')
        }
    ];

    packGrid.innerHTML = '';
    cards.forEach((card) => packGrid.appendChild(createPackCard(card)));

    saveLocalUser(user, profile);

    showNotice(dashboardInfo, 'Kabinet muvaffaqiyatli yuklandi.', 'success');
}

const page = document.body.dataset.page;

if (page === 'login') {
    initLoginPage();
}

if (page === 'change-password') {
    initChangePasswordPage().catch((error) => {
        const notice = document.getElementById('changeError');
        showNotice(notice, error.message || 'Sahifani yuklashda xatolik.');
    });
}

if (page === 'dashboard') {
    initDashboardPage().catch((error) => {
        const notice = document.getElementById('dashboardError');
        showNotice(notice, error.message || 'Dashboard yuklanmadi.');
    });
}
