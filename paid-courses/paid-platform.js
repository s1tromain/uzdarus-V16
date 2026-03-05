import {
    auth,
    onAuthStateChanged,
    signOut,
    getUserProfile,
    saveLocalUser,
    clearLocalUser,
    getPackByPageName,
    hasPackAccess,
    isSubscriptionActive,
    getOrCreateDeviceId,
    sha256Hex,
    callApi
} from '../firebase-client.js';

const CABINET_LOGIN = '../my.cabinet/index.html';

function showOverlayMessage(text) {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.inset = '0';
    wrapper.style.background = 'rgba(10, 15, 35, 0.88)';
    wrapper.style.backdropFilter = 'blur(2px)';
    wrapper.style.zIndex = '99999';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';

    const card = document.createElement('div');
    card.style.maxWidth = '520px';
    card.style.width = '92%';
    card.style.background = '#101832';
    card.style.border = '1px solid rgba(130, 160, 255, 0.25)';
    card.style.borderRadius = '16px';
    card.style.padding = '22px';
    card.style.color = '#ffffff';
    card.style.textAlign = 'center';
    card.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';

    card.innerHTML = `
        <h3 style="margin:0 0 10px; font-size: 1.2rem;">Kirish cheklangan</h3>
        <p style="margin:0; line-height:1.45; opacity:0.92;">${text}</p>
    `;

    wrapper.appendChild(card);
    document.body.appendChild(wrapper);
}

async function registerDevice() {
    const deviceId = getOrCreateDeviceId();
    const deviceIdHash = await sha256Hex(deviceId);
    return callApi('/api/auth/register-device', 'POST', { deviceIdHash });
}

function redirectToLoginWithReturn() {
    const current = `${window.location.pathname}${window.location.search}`;
    const redirect = encodeURIComponent(current);
    window.location.href = `${CABINET_LOGIN}?redirect=${redirect}`;
}

function redirectToDashboard(status) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    window.location.href = `../my.cabinet/dashboard.html${query}`;
}

async function enforceAccess() {
    const requiredPack = getPackByPageName(window.location.pathname);

    if (!requiredPack) {
        return;
    }

    await new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();

            if (!user) {
                redirectToLoginWithReturn();
                return;
            }

            const profile = await getUserProfile(user.uid);
            if (!profile) {
                await signOut(auth);
                clearLocalUser();
                redirectToLoginWithReturn();
                return;
            }

            saveLocalUser(user, profile);

            if (profile.forcePasswordChange) {
                window.location.href = '../my.cabinet/change-password.html';
                return;
            }

            if (profile.blocked) {
                showOverlayMessage('Akkaunt vaqtincha bloklangan. Moderatsiyaga murojaat qiling.');
                redirectToDashboard('blocked');
                return;
            }

            if (!isSubscriptionActive(profile)) {
                showOverlayMessage('Obuna muddati tugagan yoki faol emas. Moderatsiyaga murojaat qiling.');
                redirectToDashboard('expired');
                return;
            }

            if (!hasPackAccess(profile, requiredPack)) {
                showOverlayMessage('Ushbu bo‘lim sizning pack huquqingizga kirmaydi.');
                redirectToDashboard('no-access');
                return;
            }

            try {
                const deviceResult = await registerDevice();
                if (deviceResult?.blocked) {
                    showOverlayMessage('Qurilmalar limiti oshgan. Akkaunt bloklandi, moderatsiyaga murojaat qiling.');
                    redirectToDashboard('blocked');
                    return;
                }
            } catch (error) {
                showOverlayMessage(error.message || 'Qurilma tekshiruvi amalga oshmadi. Qayta urinib ko‘ring.');
                return;
            }

            resolve();
        });
    });
}

enforceAccess();
