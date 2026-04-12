import { login } from '../api/auth.js';
import { t } from '../utils/i18n.js';

/**
 * Login Page
 * Farmer authentication and entry point.
 */
export function renderLogin() {
    const container = document.createElement('div');
    container.className = "min-h-[70vh] flex items-center justify-center p-4 animate-in fade-in duration-500";

    container.innerHTML = `
        <div class="ks-card w-full max-w-md p-8 shadow-2xl">
            <!-- Header -->
            <div class="text-center mb-8">
                <div class="text-primary flex justify-center mb-2">
                    <i data-lucide="droplets" class="w-12 h-12"></i>
                </div>
                <h1 class="text-3xl font-black text-gray-900 tracking-tight">Krishi<span class="text-primary">Sarth</span></h1>
                <p class="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-1" data-i18n="login_title">${t('login_title')}</p>
            </div>

            <!-- Form -->
            <form id="login-form" class="space-y-5">
                <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1" data-i18n="login_email">${t('login_email')}</label>
                    <input type="email" id="email" required placeholder="farmer@krishisarth.com" 
                           class="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none font-medium">
                </div>
                
                <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1" data-i18n="login_password">${t('login_password')}</label>
                    <input type="password" id="password" required placeholder="••••••••" 
                           class="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none font-medium">
                </div>

                <div id="error-display" class="hidden animate-in slide-in-from-top-1">
                    <p class="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-tight border border-red-100 flex items-center gap-2">
                        <i data-lucide="alert-circle" class="w-4 h-4"></i>
                        <span id="error-message"></span>
                    </p>
                </div>

                <button type="submit" id="submit-btn" class="w-full bg-primary hover:bg-primary-dark text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 flex items-center justify-center gap-2">
                    <span data-i18n="login_btn">${t('login_btn')}</span>
                </button>
            </form>

            <!-- Footer -->
            <div class="mt-8 pt-6 border-t border-gray-50 text-center">
                <p class="text-xs font-medium text-gray-500">
                    <span data-i18n="login_register">${t('login_register')}</span>
                    <a href="#register" class="text-primary font-bold hover:underline"><span data-i18n="login_register_link">${t('login_register_link')}</span></a>
                </p>
            </div>
        </div>
    `;

    // Interactive Logic
    const form = container.querySelector('#login-form');
    const submitBtn = container.querySelector('#submit-btn');
    const errorDisplay = container.querySelector('#error-display');
    const errorMessage = container.querySelector('#error-message');

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        // Reset Error
        errorDisplay.classList.add('hidden');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>';

        const email = container.querySelector('#email').value;
        const password = container.querySelector('#password').value;

        try {
            await login(email, password);
            window.location.hash = "#dashboard";
        } catch (err) {
            errorDisplay.classList.remove('hidden');
            errorMessage.textContent = err.message === 'INVALID_CREDENTIALS' 
                ? t('login_error_creds') 
                : t('login_error_conn');
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = t('login_btn');
        }
    };

    // Initialize Icons
    setTimeout(() => {
        if (window.lucide) window.lucide.createIcons();
    }, 0);

    return container;
}
