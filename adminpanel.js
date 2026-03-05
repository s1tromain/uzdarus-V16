import {
    auth,
    onAuthStateChanged,
    signOut,
    getUserProfile,
    clearLocalUser,
    callApi
} from './firebase-client.js';

const state = {
    user: null,
    profile: null,
    role: 'customer',
    users: []
};

const globalError = document.getElementById('globalError');
const globalSuccess = document.getElementById('globalSuccess');
const adminMeta = document.getElementById('adminMeta');
const customersBody = document.getElementById('customersBody');
const staffBody = document.getElementById('staffBody');
const tabsNav = document.getElementById('tabsNav');
const adminTabBtn = document.getElementById('adminTabBtn');
const staffRoleSelect = document.getElementById('staffRoleSelect');
const statTotalUsers = document.getElementById('statTotalUsers');
const statActiveSubs = document.getElementById('statActiveSubs');
const statBlocked = document.getElementById('statBlocked');
const statDevices = document.getElementById('statDevices');

function showNotice(element, text, type = 'error') {
    if (!element) {
        return;
    }

    element.textContent = text;
    element.classList.remove('error', 'success');
    element.classList.add('show', type);
}

function clearNotice(element) {
    if (!element) {
        return;
    }

    element.textContent = '';
    element.classList.remove('show', 'error', 'success');
}

function showError(text) {
    clearNotice(globalSuccess);
    showNotice(globalError, text, 'error');
}

function showSuccess(text) {
    clearNotice(globalError);
    showNotice(globalSuccess, text, 'success');
}

function formatDate(rawDate) {
    if (!rawDate) {
        return '-';
    }

    const date = typeof rawDate?.toDate === 'function' ? rawDate.toDate() : new Date(rawDate);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleDateString('uz-UZ');
}

function roleAllowed(role) {
    return ['moderator', 'admin', 'developer'].includes(role);
}

function collectPacks(form) {
    const values = [];
    form.querySelectorAll('input[name="packs"]:checked').forEach((node) => values.push(node.value));
    return values;
}

function renderCustomers() {
    const rows = state.users.filter((user) => user.role === 'customer');

    if (!rows.length) {
        customersBody.innerHTML = '<tr><td colspan="7">Customerlar topilmadi</td></tr>';
        return;
    }

    customersBody.innerHTML = rows
        .map((user) => {
            const subPill = user.subscription?.active
                ? `<span class="pill ok">${user.subscription.tariff || 'ACTIVE'} (${formatDate(user.subscription.endAt)})</span>`
                : '<span class="pill warn">No subscription</span>';

            const blockedPill = user.blocked
                ? '<span class="pill bad">Blocked</span>'
                : '<span class="pill ok">Active</span>';

            return `
                <tr>
                    <td>${user.username || '-'}</td>
                    <td>${user.displayName || '-'}</td>
                    <td>${(user.accessPacks || []).join(', ') || '-'}</td>
                    <td>${subPill}</td>
                    <td>${user.deviceCount || 0}/3</td>
                    <td>${blockedPill}</td>
                    <td>
                        <div class="actions-row">
                            <button class="btn btn-ghost" data-action="reset" data-uid="${user.uid}" type="button">Reset parol</button>
                            <button class="btn btn-ghost" data-action="subscription" data-uid="${user.uid}" type="button">Obuna</button>
                            <button class="btn btn-ghost" data-action="clear-devices" data-uid="${user.uid}" type="button">Clear devices</button>
                            <button class="btn btn-ghost" data-action="unblock" data-uid="${user.uid}" type="button">Unblock</button>
                            ${state.role === 'developer' ? `<button class="btn btn-ghost" data-action="delete" data-uid="${user.uid}" type="button">Delete</button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        })
        .join('');
}

function renderStaff() {
    const rows = state.users.filter((user) => user.role !== 'customer');

    if (!rows.length) {
        staffBody.innerHTML = '<tr><td colspan="5">Staff foydalanuvchilar topilmadi</td></tr>';
        return;
    }

    const allowRoleChange = state.role === 'admin' || state.role === 'developer';

    staffBody.innerHTML = rows
        .map((user) => {
            const canModify = state.role === 'developer' || user.role === 'moderator';
            const options = ['moderator', 'admin', 'developer']
                .filter((role) => role === user.role || (state.role === 'developer' || role !== 'developer'))
                .map((role) => `<option value="${role}" ${role === user.role ? 'selected' : ''}>${role}</option>`)
                .join('');

            return `
                <tr>
                    <td>${user.username || '-'}</td>
                    <td>${user.displayName || '-'}</td>
                    <td>${user.role}</td>
                    <td>${user.blocked ? '<span class="pill bad">Blocked</span>' : '<span class="pill ok">Active</span>'}</td>
                    <td>
                        <div class="actions-row">
                            ${allowRoleChange && canModify ? `
                                <select data-role-select="${user.uid}">
                                    ${options}
                                </select>
                                <button class="btn btn-ghost" data-action="set-role" data-uid="${user.uid}" type="button">Saqlash</button>
                            ` : ''}
                            ${canModify ? `<button class="btn btn-ghost" data-action="reset" data-uid="${user.uid}" type="button">Reset parol</button>` : ''}
                            ${state.role === 'developer' ? `<button class="btn btn-ghost" data-action="delete" data-uid="${user.uid}" type="button">Delete</button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        })
        .join('');
}

function renderAll() {
    renderCustomers();
    renderStaff();
}

async function loadUsers() {
    const result = await callApi('/api/admin/list-users', 'GET');
    state.users = Array.isArray(result.users) ? result.users : [];
    renderAll();
}

async function loadStats() {
    const result = await callApi('/api/admin/stats', 'GET');
    const stats = result?.stats || {};

    if (statTotalUsers) {
        statTotalUsers.textContent = String(stats.totalUsers || 0);
    }

    if (statActiveSubs) {
        statActiveSubs.textContent = String(stats.activeSubscriptions || 0);
    }

    if (statBlocked) {
        statBlocked.textContent = String(stats.blockedUsers || 0);
    }

    if (statDevices) {
        statDevices.textContent = String(stats.registeredDevices || 0);
    }
}

async function refreshData() {
    await Promise.all([loadUsers(), loadStats()]);
}

function applyRoleUi() {
    if (state.role === 'moderator') {
        adminTabBtn.style.display = 'none';
        document.getElementById('tab-admin').classList.remove('active');
        document.getElementById('tab-customers').classList.add('active');
    }

    if (state.role !== 'developer') {
        Array.from(staffRoleSelect.options).forEach((option) => {
            if (option.value === 'admin') {
                option.style.display = 'none';
            }
        });
    }
}

async function initAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = './my.cabinet/index.html?redirect=adminpanel.html';
            return;
        }

        const profile = await getUserProfile(user.uid);
        if (!profile) {
            await signOut(auth);
            clearLocalUser();
            window.location.href = './my.cabinet/index.html?redirect=adminpanel.html';
            return;
        }

        state.user = user;
        state.profile = profile;
        state.role = profile.role || 'customer';

        if (!roleAllowed(state.role)) {
            showError('Sizda admin panelga ruxsat yo‘q.');
            setTimeout(() => {
                window.location.href = './my.cabinet/dashboard.html';
            }, 900);
            return;
        }

        adminMeta.textContent = `${profile.displayName || profile.username || user.email} • ${state.role}`;
        applyRoleUi();

        try {
            await refreshData();
            showSuccess('Admin panel tayyor.');
        } catch (error) {
            showError(error.message || 'Foydalanuvchilarni yuklashda xatolik.');
        }
    });
}

function initTabs() {
    tabsNav.addEventListener('click', (event) => {
        const button = event.target.closest('[data-tab]');
        if (!button) {
            return;
        }

        const tab = button.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach((node) => node.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((node) => node.classList.remove('active'));

        button.classList.add('active');
        const panel = document.getElementById(`tab-${tab}`);
        if (panel) {
            panel.classList.add('active');
        }
    });
}

function initCreateCustomer() {
    const form = document.getElementById('createCustomerForm');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearNotice(globalError);

        const data = new FormData(form);
        const payload = {
            username: String(data.get('username') || '').trim(),
            displayName: String(data.get('displayName') || '').trim(),
            temporaryPassword: String(data.get('temporaryPassword') || ''),
            role: 'customer',
            tariff: String(data.get('tariff') || 'START'),
            subscriptionDays: Number(data.get('subscriptionDays') || 30),
            subscriptionActive: true,
            accessPacks: collectPacks(form)
        };

        try {
            await callApi('/api/admin/create-user', 'POST', payload);
            showSuccess('Customer yaratildi.');
            form.reset();
            form.querySelector('input[name="packs"][value="A1A2"]').checked = true;
            await refreshData();
        } catch (error) {
            showError(error.message || 'Customer yaratishda xatolik.');
        }
    });
}

function initCreateStaff() {
    const form = document.getElementById('createStaffForm');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const data = new FormData(form);
        const payload = {
            username: String(data.get('username') || '').trim(),
            displayName: String(data.get('displayName') || '').trim(),
            temporaryPassword: String(data.get('temporaryPassword') || ''),
            role: String(data.get('role') || 'moderator')
        };

        try {
            await callApi('/api/admin/create-user', 'POST', payload);
            showSuccess('Staff foydalanuvchi yaratildi.');
            form.reset();
            await refreshData();
        } catch (error) {
            showError(error.message || 'Staff yaratishda xatolik.');
        }
    });
}

async function resetPasswordFlow(userId) {
    const temporaryPassword = prompt('Yangi vaqtinchalik parol (kamida 8 belgi):');
    if (!temporaryPassword) {
        return;
    }

    await callApi('/api/admin/reset-password', 'POST', { userId, temporaryPassword });
    showSuccess('Parol tiklandi. Foydalanuvchi keyingi login’da almashtiradi.');
}

async function subscriptionFlow(userId) {
    const active = confirm('Obuna faol bo‘lsinmi? (OK = faol, Cancel = o‘chirish)');

    if (!active) {
        await callApi('/api/admin/set-subscription', 'POST', { userId, active: false });
        showSuccess('Obuna o‘chirildi.');
        await refreshData();
        return;
    }

    const durationDays = Number(prompt('Necha kunga aktiv qilinsin?', '30') || 30);
    const tariff = String(prompt('Tarif nomi (START/GOLD/PLATINUM):', 'START') || 'START').toUpperCase();
    const packsInput = String(prompt('Packlar (vergul bilan): A1A2,B1B2', 'A1A2') || '');
    const accessPacks = packsInput
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    await callApi('/api/admin/set-subscription', 'POST', {
        userId,
        active: true,
        durationDays,
        tariff,
        accessPacks
    });

    showSuccess('Obuna yangilandi.');
    await refreshData();
}

function initRowActions() {
    async function handleAction(event) {
        const button = event.target.closest('[data-action]');
        if (!button) {
            return;
        }

        const action = button.dataset.action;
        const userId = button.dataset.uid;

        try {
            if (action === 'reset') {
                await resetPasswordFlow(userId);
            }

            if (action === 'subscription') {
                await subscriptionFlow(userId);
            }

            if (action === 'clear-devices') {
                await callApi('/api/admin/clear-devices', 'POST', { userId });
                showSuccess('Qurilmalar ro‘yxati tozalandi.');
            }

            if (action === 'unblock') {
                await callApi('/api/admin/unblock-user', 'POST', { userId });
                showSuccess('Foydalanuvchi unblock qilindi.');
            }

            if (action === 'set-role') {
                const select = document.querySelector(`select[data-role-select="${userId}"]`);
                if (!select) {
                    return;
                }

                await callApi('/api/admin/set-role', 'POST', {
                    userId,
                    role: select.value
                });
                showSuccess('Role yangilandi.');
            }

            if (action === 'delete') {
                const ok = confirm('Foydalanuvchini butunlay o‘chirishni tasdiqlaysizmi?');
                if (!ok) {
                    return;
                }

                await callApi('/api/admin/delete-user', 'POST', { userId });
                showSuccess('Foydalanuvchi o‘chirildi.');
            }

            await refreshData();
        } catch (error) {
            showError(error.message || 'Amal bajarilmadi.');
        }
    }

    customersBody.addEventListener('click', handleAction);
    staffBody.addEventListener('click', handleAction);
}

function initActions() {
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await signOut(auth);
        clearLocalUser();
        window.location.href = './my.cabinet/index.html';
    });

    document.getElementById('refreshUsersBtn').addEventListener('click', async () => {
        try {
            await refreshData();
            showSuccess('Ro‘yxat yangilandi.');
        } catch (error) {
            showError(error.message || 'Yangilashda xatolik.');
        }
    });
}

initTabs();
initCreateCustomer();
initCreateStaff();
initRowActions();
initActions();
initAuth();
