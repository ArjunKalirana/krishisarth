import { register } from '../api/auth.js';
import { t } from '../utils/i18n.js';

export function renderRegister() {
    const container = document.createElement('div');
    container.className = 'min-h-[70vh] flex items-center justify-center p-4';

    container.innerHTML = `
        <div class="ks-card w-full max-w-md p-8 shadow-2xl">
            <div class="text-center mb-8">
                <div class="text-primary flex justify-center mb-2">
                    <i data-lucide="sprout" class="w-12 h-12"></i>
                </div>
                <h1 class="text-3xl font-black text-gray-900 tracking-tight" data-i18n="reg_title">
                    ${t('reg_title')}
                </h1>
                <p class="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-1" data-i18n="reg_subtitle">
                    ${t('reg_subtitle')}
                </p>
            </div>

            <form id="register-form" class="space-y-4">
                <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1" data-i18n="reg_name">
                        ${t('reg_name')}
                    </label>
                    <input
                        type="text"
                        id="reg-name"
                        required
                        placeholder="Ramesh Patil"
                        class="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none font-medium"
                    >
                </div>

                <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1" data-i18n="reg_email">
                        ${t('reg_email')}
                    </label>
                    <input
                        type="email"
                        id="reg-email"
                        required
                        placeholder="farmer@krishisarth.com"
                        class="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none font-medium"
                    >
                </div>

                <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1" data-i18n="reg_phone">
                        ${t('reg_phone')}
                    </label>
                    <input
                        type="tel"
                        id="reg-phone"
                        placeholder="+91 98765 43210"
                        class="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none font-medium"
                    >
                </div>

                <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1" data-i18n="reg_password">
                        ${t('reg_password')}
                    </label>
                    <input
                        type="password"
                        id="reg-password"
                        required
                        placeholder="Minimum 8 characters"
                        class="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none font-medium"
                    >
                </div>

                <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1" data-i18n="reg_confirm">
                        ${t('reg_confirm')}
                    </label>
                    <input
                        type="password"
                        id="reg-confirm"
                        required
                        placeholder="Re-enter password"
                        class="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none font-medium"
                    >
                </div>

                <div id="reg-error" class="hidden">
                    <p class="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-tight border border-red-100 flex items-center gap-2">
                        <i data-lucide="alert-circle" class="w-4 h-4"></i>
                        <span id="reg-error-msg"></span>
                    </p>
                </div>

                <div id="reg-success" class="hidden">
                    <p class="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-tight border border-green-100 flex items-center gap-2">
                        <i data-lucide="check-circle" class="w-4 h-4"></i>
                        <span data-i18n="reg_success">${t('reg_success')}</span>
                    </p>
                </div>

                <button
                    type="submit"
                    id="reg-submit-btn"
                    class="w-full bg-primary hover:bg-primary-dark text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95 flex items-center justify-center gap-2"
                >
                    <span data-i18n="reg_btn">${t('reg_btn')}</span>
                </button>
            </form>

            <div class="mt-6 pt-6 border-t border-gray-50 text-center">
                <p class="text-xs font-medium text-gray-500">
                    <span data-i18n="reg_login">${t('reg_login')}</span>
                    <a href="#login" class="text-primary font-bold hover:underline"><span data-i18n="reg_login_link">${t('reg_login_link')}</span></a>
                </p>
            </div>
        </div>
    `;

    const form      = container.querySelector('#register-form');
    const submitBtn = container.querySelector('#reg-submit-btn');
    const errorDiv  = container.querySelector('#reg-error');
    const errorMsg  = container.querySelector('#reg-error-msg');
    const successDiv = container.querySelector('#reg-success');

    const showError = (msg) => {
        errorDiv.classList.remove('hidden');
        successDiv.classList.add('hidden');
        errorMsg.textContent = msg;
    };

    const hideError = () => {
        errorDiv.classList.add('hidden');
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        hideError();

        const name     = container.querySelector('#reg-name').value.trim();
        const email    = container.querySelector('#reg-email').value.trim();
        const phone    = container.querySelector('#reg-phone').value.trim();
        const password = container.querySelector('#reg-password').value;
        const confirm  = container.querySelector('#reg-confirm').value;

        // Client-side validation
        if (name.length < 2) {
            showError(t('reg_err_name'));
            return;
        }
        if (password.length < 8) {
            showError(t('reg_err_pass'));
            return;
        }
        if (password !== confirm) {
            showError(t('reg_err_match'));
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>';

        try {
            await register(name, email, password, phone || null);
            successDiv.classList.remove('hidden');
            setTimeout(() => {
                window.location.hash = '#dashboard';
            }, 1000);
        } catch (err) {
            const messages = {
                'EMAIL_ALREADY_EXISTS': t('reg_err_exists'),
                'VALIDATION_ERROR':     t('reg_err_fail'),
                'LOGIN_FAILED':         t('reg_err_fail'),
                'REGISTER_FAILED':      t('reg_err_fail'),
            };
            showError(messages[err.message] || t('reg_err_fail'));
            submitBtn.disabled = false;
            submitBtn.innerHTML = t('reg_btn');
        }
    };

    setTimeout(() => {
        if (window.lucide) window.lucide.createIcons();
    }, 0);

    return container;
}
