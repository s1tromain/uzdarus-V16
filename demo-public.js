(function enableDemoPublicMode() {
    const USER_KEY = 'currentUser';
    const DEMO_USER = {
        id: 'demo-local-user',
        uid: 'demo-local-user',
        username: 'demo.guest',
        name: 'Demo foydalanuvchi',
        email: 'demo@uzdarus.local',
        role: 'guest',
        isDemoGuest: true
    };

    function parseJson(value) {
        try {
            return value ? JSON.parse(value) : null;
        } catch (error) {
            return null;
        }
    }

    function ensureDemoUser() {
        const raw = localStorage.getItem(USER_KEY);
        const parsed = parseJson(raw);

        if (!parsed) {
            localStorage.setItem(USER_KEY, JSON.stringify(DEMO_USER));
            return DEMO_USER;
        }

        if (!parsed.id) {
            const merged = { ...DEMO_USER, ...parsed, id: DEMO_USER.id, uid: DEMO_USER.uid, role: 'guest', isDemoGuest: true };
            localStorage.setItem(USER_KEY, JSON.stringify(merged));
            return merged;
        }

        return parsed;
    }

    function lockRemoteSyncToLocalOnly() {
        const noopResult = async () => ({ localOnly: true });
        const emptyList = async () => [];
        const emptyValue = async () => null;

        window.firebaseReady = true;
        window.saveUserProgress = noopResult;
        window.getUserProgress = emptyValue;
        window.saveQuizResult = noopResult;
        window.getUserQuizResults = emptyList;
        window.logActivity = noopResult;
        window.saveProgressFunc = null;
    }

    ensureDemoUser();
    lockRemoteSyncToLocalOnly();

    const intervalId = setInterval(() => {
        ensureDemoUser();
        lockRemoteSyncToLocalOnly();
    }, 750);

    window.addEventListener('beforeunload', () => {
        clearInterval(intervalId);
    });
})();
