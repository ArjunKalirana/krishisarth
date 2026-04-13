import { login } from '../api/auth.js';
import { t } from '../utils/i18n.js';

/**
 * Login Page (Elite Edition)
 * A premium 'Command Center' entrance for KrishiSarth.
 */
export function renderLogin() {
    const container = document.createElement('div');
    container.className = "min-h-[80vh] flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-700";

    container.innerHTML = `
        <div class="glass-panel w-full max-w-md p-10 relative overflow-hidden">
            <!-- Background Accent -->
            <div class="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-[100px] rounded-full"></div>
            <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 blur-[100px] rounded-full"></div>

            <!-- Header -->
            <div class="text-center mb-10 relative z-10">
                <div class="flex justify-center mb-6">
                    <div class="relative">
                        <div class="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 rotate-12 transition-transform hover:rotate-0">
                            <i data-lucide="droplets" class="w-8 h-8 text-emerald-400 -rotate-12"></i>
                        </div>
                        <div class="absolute -inset-2 blur-2xl bg-emerald-500/20 rounded-full animate-pulse"></div>
                    </div>
                </div>
                <h1 class="text-4xl font-black text-white tracking-tight font-display mb-2">
                    Krishi<span class="text-emerald-500">Sarth</span>
                </h1>
                <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]" data-i18n="login_title">
                    Digital Twin Control Access
                </p>
            </div>

            <!-- Auth Form -->
            <form id="login-form" class="space-y-6 relative z-10">
                <div class="space-y-2">
                    <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1" data-i18n="login_email">Neural Identity (Email)</label>
                    <input type="email" id="email" required placeholder="farmer@digital-eden.ai" 
                           class="w-full px-5 py-4 rounded-xl bg-slate-900/50 border border-slate-700/50 text-white font-bold focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all">
                </div>
                
                <div class="space-y-2">
                    <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1" data-i18n="login_password">Access Key (Password)</label>
                    <input type="password" id="password" required placeholder="••••••••" 
                           class="w-full px-5 py-4 rounded-xl bg-slate-900/50 border border-slate-700/50 text-white font-bold focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all">
                </div>

                <div id="error-display" class="hidden">
                    <p class="bg-red-500/10 text-red-400 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 flex items-center gap-3">
                        <i data-lucide="shield-alert" class="w-4 h-4"></i>
                        <span id="error-message"></span>
                    </p>
                </div>

                <button type="submit" id="submit-btn" class="btn-elite w-full py-4 text-sm flex items-center justify-center gap-3">
                    <i data-lucide="lock" class="w-4 h-4"></i>
                    <span data-i18n="login_btn">Initialize Access</span>
                </button>
            </form>

            <!-- Secondary Actions -->
            <div class="mt-10 pt-8 border-t border-slate-800/50 text-center relative z-10">
                <p class="text-xs font-semibold text-slate-500 mb-4 italic">
                    Secure Neural Link | v2.4.0
                </p>
                <p class="text-xs font-medium text-slate-400">
                    <span data-i18n="login_register">New operator?</span>
                    <a href="#register" class="text-emerald-400 font-bold hover:text-emerald-300 transition-colors underline underline-offset-4 decoration-emerald-500/30 ml-1">
                        Request Credentials
                    </a>
                </p>
            </div>
        </div>
    `;

    // Logic implementation
    const form = container.querySelector('#login-form');
    const submitBtn = container.querySelector('#submit-btn');
    const errorDisplay = container.querySelector('#error-display');
    const errorMessage = container.querySelector('#error-message');

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        errorDisplay.classList.add('hidden');
        submitBtn.disabled = true;
        const originalHtml = submitBtn.innerHTML;
        submitBtn.innerHTML = '<div class="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>';

        const email = container.querySelector('#email').value;
        const password = container.querySelector('#password').value;

        try {
            await login(email, password);
            window.location.hash = "#dashboard";
        } catch (err) {
            errorDisplay.classList.remove('hidden');
            errorMessage.textContent = err.message === 'INVALID_CREDENTIALS' 
                ? 'Authentication Failed: Invalid ID/Key' 
                : 'Connection Fault: Neural Link unstable';
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        }
    };

    // Re-run icons
    setTimeout(() => {
        if (window.lucide) window.lucide.createIcons();
    }, 0);

    return container;
}
