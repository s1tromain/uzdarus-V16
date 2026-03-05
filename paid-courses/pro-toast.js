(() => {
    const TOAST_ID = 'uzdarus-pro-toast';
    const AUTO_HIDE_MS = 5000;

    function removeToast(toastEl) {
        if (!toastEl || !toastEl.parentNode) {
            return;
        }

        toastEl.classList.remove('is-visible');
        toastEl.classList.add('is-hiding');

        window.setTimeout(() => {
            if (toastEl.parentNode) {
                toastEl.parentNode.removeChild(toastEl);
            }
        }, 340);
    }

    function buildToast() {
        if (document.getElementById(TOAST_ID)) {
            return;
        }

        const toastEl = document.createElement('div');
        toastEl.id = TOAST_ID;
        toastEl.className = 'pro-toast';
        toastEl.setAttribute('role', 'status');
        toastEl.setAttribute('aria-live', 'polite');

        toastEl.innerHTML = `
            <div class="pro-toast-content">
                <p class="pro-toast-title">🎉 Tabriklaymiz! Siz UZDARUS PRO versiyasidasiz. Barcha mavzular ochiq.</p>
                <p class="pro-toast-subtitle">Omad! Kursni davom ettiring.</p>
            </div>
            <button class="pro-toast-close" type="button" aria-label="Yopish">×</button>
        `;

        const closeBtn = toastEl.querySelector('.pro-toast-close');
        closeBtn.addEventListener('click', () => removeToast(toastEl));

        document.body.appendChild(toastEl);

        window.requestAnimationFrame(() => {
            toastEl.classList.add('is-visible');
        });

        window.setTimeout(() => {
            removeToast(toastEl);
        }, AUTO_HIDE_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildToast, { once: true });
    } else {
        buildToast();
    }
})();
