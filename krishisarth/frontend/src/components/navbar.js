import { store } from '../state/store.js';
import { t, getLanguage, setLanguage, getAvailableLanguages } from '../utils/i18n.js';
import { clearToken } from '../api/client.js';
import { toggleAlertsFeed, renderAlertsFeed } from './alerts-feed.js';

let _navbarMounted = false;

/**
 * KrishiSarth Control Center Navigation
 * Desktop: Persistent Left Sidebar HUD
 * Mobile: Left sliding drawer + Fixed Bottom Nav hybrid
 */
export function renderNavbar() {
    renderSidebar();
    renderBottomNav();
    
    if (!_navbarMounted) {
        window.addEventListener('hashchange', () => {
            store.setState('activePage', window.location.hash || '#dashboard');
            renderNavbar();
        });
        
        document.addEventListener('ws-status', (e) => {
            const dots = document.querySelectorAll('.ws-status-dot');
            const status = e.detail;
            dots.forEach(dot => {
                dot.className = "ws-status-dot w-2.5 h-2.5 rounded-full border-2 border-slate-900 " + 
                    (status === 'connected' ? 'bg-emerald-500' : (status === 'connecting' ? 'bg-amber-500' : 'bg-red-500'));
            });
        });
        _navbarMounted = true;
    }
}

function renderSidebar() {
    const root = document.getElementById('navbar-root');
    if (!root) return;

    const activePage = store.getState('activePage') || '#dashboard';
    const farmer = store.getState('currentFarmer');
    const unreadCount = store.getState('unreadAlertCount');

    const navItems = [
        { hash: '#dashboard', icon: 'layout-dashboard', label: t('nav_dashboard') },
        { hash: '#farm3d',    icon: 'box',              label: 'Digital Twin' },
        { hash: '#ai',        icon: 'brain',            label: t('nav_ai') },
        { hash: '#soil-analysis', icon: 'test-tube',         label: 'Soil Analysis' },
        { hash: '#control',   icon: 'sliders',          label: t('nav_control') },
        { hash: '#analytics', icon: 'bar-chart-2',      label: t('nav_analytics') },
        { hash: '#support',   icon: 'headphones',       label: 'Support' },
    ];

    root.innerHTML = `
        <aside id="main-sidebar" class="side-sidebar flex flex-col p-6 glass-hud">
            <!-- Brand -->
            <div class="mb-12 px-2">
                <a href="#dashboard" class="flex items-center gap-3 group" style="text-decoration:none;">
                    <div class="relative">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" class="group-hover:scale-110 transition-transform">
                            <path d="M12 2C6 2 3 8 3 12c0 5 4 9 9 9s9-4 9-9C21 7 17 2 12 2z" fill="#10b981" opacity="0.1"/>
                            <path d="M12 2C8 5 6 9 8 14c1.5 3 4 5 4 5V2z" fill="#10b981"/>
                            <path d="M12 2C16 5 18 9 16 14c-1.5 3-4 5-4 5V2z" fill="#059669" opacity="0.6"/>
                        </svg>
                        <div class="ws-status-dot absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-slate-900 bg-amber-500"></div>
                    </div>
                    <span class="text-2xl font-black tracking-tighter text-white font-display">
                        Krishi<span class="text-emerald-500">Sarth</span>
                    </span>
                </a>
            </div>

            <!-- Navigation Links -->
            <nav class="flex-1 space-y-2">
                ${navItems.map(item => {
                    const isActive = activePage === item.hash;
                    return `
                        <a href="${item.hash}" class="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.14em] transition-all group ${
                            isActive 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]' 
                            : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent'
                        }">
                            <i data-lucide="${item.icon}" class="w-5 h-5 group-hover:scale-110 transition-transform"></i>
                            ${item.label}
                        </a>
                    `;
                }).join('')}
            </nav>

            <!-- Bottom Actions: Alerts & Profile -->
            <div class="mt-auto space-y-6 pt-6 border-t border-white/5">
                <!-- Notifications -->
                <button id="nav-bell-btn" class="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 rounded-2xl transition-all group">
                    <div class="flex items-center gap-4">
                        <div class="relative">
                            <i data-lucide="bell" class="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors"></i>
                            ${unreadCount > 0 ? `
                                <span class="absolute -top-1 -right-1 flex h-2 w-2">
                                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                            ` : ''}
                        </div>
                        <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">${t('nav_alerts') || 'System Alerts'}</span>
                    </div>
                </button>

                <!-- Profile HUD -->
                <div class="relative">
                    <div id="profile-menu-btn" class="flex items-center gap-4 p-2 pl-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer group">
                        <div class="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 font-black text-sm border border-emerald-500/20 group-hover:scale-105 transition-all">
                            ${farmer ? farmer.name.split(' ').map(n => n[0]).join('') : 'F'}
                        </div>
                        <div class="flex-1 min-w-0 pr-2">
                            <p class="text-[10px] font-black text-white truncate uppercase tracking-tighter">${farmer?.name || 'Operator'}</p>
                            <p class="text-[8px] font-bold text-slate-500 uppercase tracking-widest opacity-60">ID: 0x${farmer?.id?.slice(0,4) || '8F2C'}</p>
                        </div>
                    </div>

                    <!-- Profile Dropdown (Side Alignment) -->
                    <div id="profile-dropdown" class="absolute left-full bottom-0 ml-4 w-56 glass-panel p-2 hidden animate-in slide-in-from-left-2 duration-200">
                        <div class="px-4 py-3 mb-2 border-b border-white/5">
                            <p class="text-xs font-black text-white font-display mb-0.5">${farmer?.email || 'authenticated_node'}</p>
                        </div>
                        <button id="logout-btn" class="w-full text-left px-4 py-3 text-[11px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 rounded-xl flex items-center gap-3 transition-colors">
                            <i data-lucide="log-out" class="w-4 h-4"></i>
                            Terminate Access
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    `;

    // Sidebar Wiring
    const profileBtn = root.querySelector('#profile-menu-btn');
    const profileDropdown = root.querySelector('#profile-dropdown');
    const logoutBtn = root.querySelector('#logout-btn');
    const bellBtn = root.querySelector('#nav-bell-btn');

    if (profileBtn && profileDropdown) {
        profileBtn.onclick = (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('hidden');
        };
        document.addEventListener('click', () => profileDropdown?.classList.add('hidden'));
    }
    if (logoutBtn) logoutBtn.onclick = _doLogout;
    if (bellBtn) bellBtn.onclick = toggleAlertsFeed;

    renderAlertsFeed();
    if (window.lucide) window.lucide.createIcons();
}

function renderBottomNav() {
    const root = document.getElementById('bottom-nav-root');
    if (!root) return;

    const activePage = store.getState('activePage') || '#dashboard';

    const items = [
        { hash: '#dashboard', icon: 'layout-dashboard', label: 'Home' },
        { hash: '#farm3d',    icon: 'box',              label: 'Twin' },
        { hash: '#ai',        icon: 'zap',             label: 'AI' },
        { hash: '#control',   icon: 'sliders',          label: 'Control' },
        { hash: null,         icon: 'menu',             label: 'More', isMenu: true },
    ];

    root.innerHTML = `
        <nav class="bottom-navigation">
            <div class="w-full flex items-center justify-around px-2">
                ${items.map(item => {
                    const isActive = activePage === item.hash;
                    return `
                        <button class="nav-item-btn flex flex-col items-center justify-center gap-1.5 p-2 transition-all" 
                                data-hash="${item.hash}" data-menu="${item.isMenu || false}">
                            <div class="relative">
                                <i data-lucide="${item.icon}" class="w-6 h-6 ${isActive ? 'text-emerald-400' : 'text-slate-500'} transition-colors"></i>
                                ${isActive ? '<div class="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>' : ''}
                            </div>
                            <span class="text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-emerald-400' : 'text-slate-500'}">
                                ${item.label}
                            </span>
                        </button>
                    `;
                }).join('')}
            </div>
        </nav>
    `;

    // Bottom Nav Wiring
    root.querySelectorAll('.nav-item-btn').forEach(btn => {
        btn.onclick = () => {
            const hash = btn.dataset.hash;
            const isMenu = btn.dataset.menu === 'true';
            if (isMenu) {
                const sidebar = document.getElementById('main-sidebar');
                sidebar?.classList.toggle('open');
            } else if (hash) {
                window.location.hash = hash;
                document.getElementById('main-sidebar')?.classList.remove('open');
            }
        };
    });

    if (window.lucide) window.lucide.createIcons();
}

function _doLogout() {
    clearToken();
    store.setState('currentFarmer', null);
    store.setState('currentFarm', null);
    window.location.hash = '#login';
}
