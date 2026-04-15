import { store } from '../state/store.js';
import { t, getLanguage, setLanguage, getAvailableLanguages } from '../utils/i18n.js';
import { clearToken } from '../api/client.js';
import { toggleAlertsFeed, renderAlertsFeed } from './alerts-feed.js';

let _navbarMounted = false;

/**
 * Navbar Component (Elite Edition)
 * A premium, glassmorphic HUD for KrishiSarth.
 * Mobile: Slide-down HUD drawer with high-fidelity buttons.
 * Desktop: Minimalist horizontal navigation.
 */
export function renderNavbar() {
    const root = document.getElementById('navbar-root');
    if (!root) return;

    const activePage = store.getState('activePage');
    const farmer = store.getState('currentFarmer');
    const unreadCount = store.getState('unreadAlertCount');

    const template = `
        <nav class="glass-panel bg-slate-900/95 backdrop-blur-2xl mx-4 mt-4 px-6 border border-white/10 relative z-50 flex items-center justify-between shadow-[0_10px_40px_rgba(0,0,0,0.5)]" style="height: 64px;">
            <!-- Brand & Status -->
            <div class="flex items-center gap-6">
                <a href="#dashboard" class="flex items-center gap-3 group" style="text-decoration:none;">
                    <div class="relative">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" class="group-hover:scale-110 transition-transform">
                            <path d="M12 2C6 2 3 8 3 12c0 5 4 9 9 9s9-4 9-9C21 7 17 2 12 2z" fill="#10b981" opacity="0.1"/>
                            <path d="M12 2C8 5 6 9 8 14c1.5 3 4 5 4 5V2z" fill="#10b981"/>
                            <path d="M12 2C16 5 18 9 16 14c-1.5 3-4 5-4 5V2z" fill="#059669" opacity="0.6"/>
                        </svg>
                        <div id="ws-status-dot" class="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-slate-900 bg-amber-500" title="Connecting..."></div>
                    </div>
                    <span class="text-xl font-black tracking-tighter text-white font-display hidden sm:block">
                        Krishi<span class="text-emerald-500">Sarth</span>
                    </span>
                </a>

                <!-- Desktop Navigation -->
                <div class="hidden lg:flex items-center gap-2">
                    ${[
                        { hash: '#dashboard', icon: 'layout-dashboard', label: t('nav_dashboard') },
                        { hash: '#farm3d',    icon: 'box',              label: 'Digital Twin' },
                        { hash: '#ai',        icon: 'brain',            label: t('nav_ai') },
                        { hash: '#control',   icon: 'sliders',          label: t('nav_control') },
                        { hash: '#analytics', icon: 'bar-chart-2',      label: t('nav_analytics') },
                        { hash: '#support',   icon: 'headphones',       label: 'Support' },
                    ].map(link => {
                        const isActive = activePage === link.hash;
                        return `
                            <a href="${link.hash}" 
                               class="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                   isActive 
                                   ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                   : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent'
                               }">
                                <i data-lucide="${link.icon}" class="w-4 h-4"></i>
                                ${link.label}
                            </a>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Global Actions -->
            <div class="flex items-center gap-4">
                <div class="hidden md:flex items-center bg-slate-900/50 rounded-xl p-1 border border-white/5">
                    ${getAvailableLanguages().map(l => `
                        <button class="lang-btn px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${getLanguage() === l.code ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}" data-lang="${l.code}">
                            ${l.label}
                        </button>
                    `).join('')}
                </div>

                <div id="nav-bell-btn" class="relative cursor-pointer p-2.5 hover:bg-white/5 rounded-xl transition-all group">
                    <i data-lucide="bell" class="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors"></i>
                    <span id="nav-bell-badge" class="${unreadCount > 0 ? '' : 'hidden '}absolute top-2 right-2 flex h-2 w-2">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                </div>

                <div class="relative pl-4 border-l border-slate-700/50 flex items-center gap-3">
                    <div id="profile-menu-btn" class="flex items-center gap-3 cursor-pointer group">
                        <div class="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 font-extrabold text-sm border border-emerald-500/20 group-hover:scale-105 transition-all">
                            ${farmer ? farmer.name.split(' ').map(n => n[0]).join('') : 'F'}
                        </div>
                        <i data-lucide="chevron-down" class="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors hidden sm:block"></i>
                    </div>

                    <!-- Profile Dropdown -->
                    <div id="profile-dropdown" class="absolute right-0 top-full mt-4 w-56 glass-panel p-2 hidden animate-in slide-in-from-top-2 duration-200">
                        <div class="px-4 py-3 mb-2 border-b border-white/5">
                            <p class="text-xs font-black text-white font-display mb-0.5">${farmer?.name || 'Operator'}</p>
                            <p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">${farmer?.email || 'authenticated_node'}</p>
                        </div>
                        <button id="logout-btn" class="w-full text-left px-4 py-3 text-[11px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 rounded-xl flex items-center gap-3 transition-colors">
                            <i data-lucide="log-out" class="w-4 h-4"></i>
                            Terminate Session
                        </button>
                    </div>
                    
                    <!-- Mobile Hamburger -->
                    <button id="mobile-menu-btn" class="lg:hidden p-2.5 glass-panel border-white/5 text-slate-400 hover:text-white transition-all">
                        <i data-lucide="menu" class="w-5 h-5" id="mobile-menu-icon"></i>
                    </button>
                </div>
            </div>

            <!-- Mobile Drawer HUD -->
            <div id="mobile-drawer" class="lg:hidden absolute top-[calc(100%+12px)] left-0 w-full overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" style="max-height: 0; opacity: 0;">
                <div class="glass-panel bg-slate-900/95 backdrop-blur-2xl border-white/10 p-4 space-y-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                    ${[
                        { hash: '#dashboard', icon: 'layout-dashboard', label: t('nav_dashboard') },
                        { hash: '#farm3d',    icon: 'box',              label: 'Digital Twin' },
                        { hash: '#ai',        icon: 'brain',            label: t('nav_ai') },
                        { hash: '#control',   icon: 'sliders',          label: t('nav_control') },
                        { hash: '#analytics', icon: 'bar-chart-2',      label: t('nav_analytics') },
                        { hash: '#support',   icon: 'headphones',       label: 'Support' },
                    ].map(link => {
                        const isActive = activePage === link.hash;
                        return `
                        <a href="${link.hash}" class="flex items-center gap-4 p-4 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all ${isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:bg-white/5'}">
                            <i data-lucide="${link.icon}" class="w-5 h-5"></i>
                            ${link.label}
                        </a>
                        `;
                    }).join('')}
                    
                    <div class="pt-4 mt-4 border-t border-white/5">
                        <button id="mobile-logout-btn" class="w-full flex items-center gap-4 p-4 rounded-xl text-xs font-black uppercase tracking-[0.15em] text-red-500 hover:bg-red-500/5 transition-all">
                            <i data-lucide="log-out" class="w-5 h-5"></i>
                            Terminate Access
                        </button>
                    </div>
                </div>
            </div>

            <!-- Mobile Fixed Bottom Nav -->
            <nav class="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0f0d]/95 backdrop-blur-xl border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                <div class="flex items-center justify-around px-2 py-4">
                    ${[
                        { hash: '#dashboard', icon: 'layout-dashboard', label: 'Home' },
                        { hash: '#ai',        icon: 'brain',            label: 'AI' },
                        { hash: '#control',   icon: 'sliders',          label: 'Control' },
                        { hash: '#analytics', icon: 'bar-chart-2',      label: 'Stats' },
                        { hash: '#support',   icon: 'headphones',       label: 'Help' },
                    ].map(link => {
                        const isActive = activePage === link.hash;
                        return `
                            <a href="${link.hash}" class="flex flex-col items-center gap-1.5 transition-all duration-300">
                                <div class="relative">
                                    <i data-lucide="${link.icon}" class="w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-slate-500'} transition-colors"></i>
                                    ${isActive ? '<div class="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>' : ''}
                                </div>
                                <span class="text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-emerald-400' : 'text-slate-500'} transition-colors">
                                    ${link.label}
                                </span>
                            </a>
                        `;
                    }).join('')}
                </div>
            </nav>
        </nav>
    `;

    root.innerHTML = template;

    // Logic Wiring
    const profileBtn      = root.querySelector('#profile-menu-btn');
    const profileDropdown = root.querySelector('#profile-dropdown');
    const logoutBtn       = root.querySelector('#logout-btn');

    if (profileBtn && profileDropdown) {
        profileBtn.onclick = (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('hidden');
        };
        document.addEventListener('click', () => profileDropdown.classList.add('hidden'));
    }

    if (logoutBtn) logoutBtn.onclick = _doLogout;

    renderAlertsFeed();
    const bellBtn = root.querySelector('#nav-bell-btn');
    if (bellBtn) bellBtn.onclick = toggleAlertsFeed;

    const mobileLogoutBtn = root.querySelector('#mobile-logout-btn');
    if (mobileLogoutBtn) mobileLogoutBtn.onclick = _doLogout;

    // Mobile Hamburger Logic
    const mobileMenuBtn = root.querySelector('#mobile-menu-btn');
    const mobileDrawer  = root.querySelector('#mobile-drawer');
    const mobileIcon    = root.querySelector('#mobile-menu-icon');

    let drawerOpen = false;

    if (mobileMenuBtn && mobileDrawer) {
        mobileMenuBtn.onclick = (e) => {
            e.stopPropagation();
            drawerOpen = !drawerOpen;
            mobileDrawer.style.maxHeight = drawerOpen ? '500px' : '0';
            mobileDrawer.style.opacity   = drawerOpen ? '1' : '0';
            if (mobileIcon && window.lucide) {
                mobileIcon.setAttribute('data-lucide', drawerOpen ? 'x' : 'menu');
                window.lucide.createIcons();
            }
        };
        root.querySelectorAll('#mobile-drawer a').forEach(link => {
            link.onclick = () => {
                drawerOpen = false;
                mobileDrawer.style.maxHeight = '0';
                mobileDrawer.style.opacity = '0';
            };
        });
    }

    // Language Switcher
    root.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => setLanguage(btn.dataset.lang);
    });

    if (window.lucide) window.lucide.createIcons();

    if (!_navbarMounted) {
        window.addEventListener('hashchange', () => {
            store.setState('activePage', window.location.hash || '#dashboard');
            renderNavbar();
        });
        
        document.addEventListener('ws-status', (e) => {
            const dot = document.getElementById('ws-status-dot');
            if (!dot) return;
            const status = e.detail;
            dot.className = "absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-slate-900 " + 
                (status === 'connected' ? 'bg-emerald-500' : (status === 'connecting' ? 'bg-amber-500' : 'bg-red-500'));
        });

        _navbarMounted = true;
    }
}

function _doLogout() {
    clearToken();
    store.setState('currentFarmer', null);
    store.setState('currentFarm', null);
    window.location.hash = '#login';
}
