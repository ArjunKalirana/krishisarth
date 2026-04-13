import { register } from '../api/auth.js';
import { t } from '../utils/i18n.js';

/**
 * Registration Page (Elite Edition)
 */
export function renderRegister() {
    const container = document.createElement('div');
    container.className = "min-h-[85vh] flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-700";

    container.innerHTML = `
        <div class="glass-panel w-full max-w-lg p-10 relative overflow-hidden">
            <!-- Background Glows -->
            <div class="absolute -top-32 -left-32 w-64 h-64 bg-emerald-500/10 blur-[120px] rounded-full"></div>
            <div class="absolute -bottom-32 -right-32 w-64 h-64 bg-blue-500/10 blur-[120px] rounded-full"></div>

            <!-- Header -->
            <div class="text-center mb-10 relative z-10">
                <div class="flex justify-center mb-6">
                    <div class="relative">
                        <div class="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 -rotate-12 transition-transform hover:rotate-0">
                            <i data-lucide="sprout" class="w-8 h-8 text-emerald-400 rotate-12"></i>
                        </div>
                        <div class="absolute -inset-2 blur-2xl bg-emerald-500/20 rounded-full animate-pulse"></div>
                    </div>
                </div>
                <h1 class="text-4xl font-black text-white tracking-tight font-display mb-2">
                    Digital <span class="text-emerald-500">Onboarding</span>
                </h1>
                <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]" data-i18n="reg_subtitle">
                    Initialize New Operator Node
                </p>
            </div>

            <form id="register-form" class="space-y-6 relative z-10">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1" data-i18n="reg_name">Operator Name</label>
                        <input type="text" id="reg-name" required placeholder="Ramesh Patil" 
                               class="w-full px-5 py-3.5 rounded-xl bg-slate-900/50 border border-slate-700/50 text-white font-bold focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1" data-i18n="reg_email">Comm Channel (Email)</label>
                        <input type="email" id="reg-email" required placeholder="farmer@digital-eden.ai" 
                               class="w-full px-5 py-3.5 rounded-xl bg-slate-900/50 border border-slate-700/50 text-white font-bold focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all">
                    </div>
                </div>

                <div class="space-y-2">
                    <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1" data-i18n="reg_phone">Telemetry Link (Phone - Optional)</label>
                    <input type="tel" id="reg-phone" placeholder="+91 98765 43210" 
                           class="w-full px-5 py-3.5 rounded-xl bg-slate-900/50 border border-slate-700/50 text-white font-bold focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all">
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1" data-i18n="reg_password">Access Key (Password)</label>
                        <input type="password" id="reg-password" required placeholder="••••••••" 
                               class="w-full px-5 py-3.5 rounded-xl bg-slate-900/50 border border-slate-700/50 text-white font-bold focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1" data-i18n="reg_confirm">Verify Key</label>
                        <input type="password" id="reg-confirm" required placeholder="••••••••" 
                               class="w-full px-5 py-3.5 rounded-xl bg-slate-900/50 border border-slate-700/50 text-white font-bold focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all">
                    </div>
                </div>

                <div id="reg-error" class="hidden">
                    <p class="bg-red-500/10 text-red-400 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 flex items-center gap-3">
                        <i data-lucide="shield-alert" class="w-4 h-4"></i>
                        <span id="reg-error-msg"></span>
                    </p>
                </div>

                <div id="reg-success" class="hidden">
                    <p class="bg-emerald-500/10 text-emerald-400 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 flex items-center gap-3">
                        <i data-lucide="check-circle" class="w-4 h-4"></i>
                        <span data-i18n="reg_success">Onboarding Complete. Initializing Link...</span>
                    </p>
                </div>

                <button type="submit" id="reg-submit-btn" class="btn-elite w-full py-4 text-sm flex items-center justify-center gap-3">
                    <i data-lucide="rocket" class="w-4 h-4"></i>
                    <span data-i18n="reg_btn">Register Digital Twin Operator</span>
                </button>
            </form>

            <!-- Footer -->
            <div class="mt-10 pt-8 border-t border-slate-800/50 text-center relative z-10">
                <p class="text-xs font-medium text-slate-400">
                    <span data-i18n="reg_login">Already an operator?</span>
                    <a href="#login" class="text-emerald-400 font-bold hover:text-emerald-300 transition-colors underline underline-offset-4 decoration-emerald-500/30 ml-1">
                        Access Neural Control
                    </a>
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

    form.onsubmit = async (e) => {
        e.preventDefault();
        errorDiv.classList.add('hidden');

        const name     = container.querySelector('#reg-name').value.trim();
        const email    = container.querySelector('#reg-email').value.trim();
        const phone    = container.querySelector('#reg-phone').value.trim();
        const password = container.querySelector('#reg-password').value;
        const confirm  = container.querySelector('#reg-confirm').value;

        if (name.length < 2) return showError('Invalid Designation: Name too short');
        if (password.length < 8) return showError('Security Risk: Key must be 8+ characters');
        if (password !== confirm) return showError('Parity Error: Keys do not match');

        submitBtn.disabled = true;
        const originalHtml = submitBtn.innerHTML;
        submitBtn.innerHTML = '<div class="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>';

        try {
            await register(name, email, password, phone || null);
            successDiv.classList.remove('hidden');
            setTimeout(() => { window.location.hash = '#dashboard'; }, 1000);
        } catch (err) {
            showError(err.message === 'EMAIL_ALREADY_EXISTS' ? 'Node Error: Identity already registered' : 'Registration Fault: Protocol failed');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        }
    };

    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 0);
    return container;
}
