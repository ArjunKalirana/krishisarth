import { store } from '../state/store.js';
import { t, getLanguage, setLanguage, getAvailableLanguages } from '../utils/i18n.js';
import { clearToken } from '../api/client.js';
import { toggleAlertsFeed, renderAlertsFeed } from './alerts-feed.js';

let _navbarMounted = false;

/**
 * KrishiSarth Hybrid Navigation
 * Desktop: Classic Horizontal HUD (Restored for centering)
 * Mobile: Bottom Nav + Left sliding drawer
 */
export function renderNavbar() {
    renderTopNavbar();
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

/**
 * Desktop-specific Horizontal Header
 */
function renderTopNavbar() {
    const root = document.getElementById('navbar-root');
    if (!root) return;

    const activePage = store.getState('activePage');
    const farmer = store.getState('currentFarmer');
    const unreadCount = store.getState('unreadAlertCount');

    const navItems = [
        { hash: '#dashboard', icon: 'layout-dashboard', label: t('nav_dashboard') },
        { hash: '#farm3d',    icon: 'box',              label: 'Digital Twin' },
        { hash: '#ai',        icon: 'brain',            label: t('nav_ai') },
        { hash: '#soil-analysis', icon: 'test-tube',         label: 'Soil' },
        { hash: '#control',   icon: 'sliders',          label: t('nav_control') },
        { hash: '#analytics', icon: 'bar-chart-2',      label: t('nav_analytics') },
    ];

    root.innerHTML = `
        <nav class="hidden lg:flex fixed top-0 left-0 w-full h-16 glass-panel border-b border-white/5 z-50 items-center justify-between px-8 bg-slate-900/50 backdrop-blur-xl">
            <!-- Brand -->
            <a href="#dashboard" class="flex items-center gap-3 group" style="text-decoration:none;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6 2 3 8 3 12c0 5 4 9 9 9s9-4 9-9C21 7 17 2 12 2z" fill="#10b981" opacity="0.1"/>
                    <path d="M12 2C8 5 6 9 8 14c1.5 3 4 5 4 5V2z" fill="#10b981"/>
                    <path d="M12 2C16 5 18 9 16 14c-1.5 3-4 5-4 5V2z" fill="#059669" opacity="0.6"/>
                </svg>
                <span class="text-xl font-black tracking-tighter text-white font-display">
                    Krishi<span class="text-emerald-500">Sarth</span>
                </span>
            </a>

            <!-- Nav Links -->
            <div class="flex items-center gap-2">
                ${navItems.map(item => {
                    const isActive = activePage === item.hash;
                    return `
                        <a href="${item.hash}" class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-500 hover:text-white'
                        }">
                            <i data-lucide="${item.icon}" class="w-4 h-4 inline-block mr-2"></i>
                            ${item.label}
                        </a>
                    `;
                }).join('')}
            </div>

            <!-- Profile & Actions -->
            <div class="flex items-center gap-6 pl-6 border-l border-white/5">
                <div id="nav-bell-btn-desktop" class="relative cursor-pointer group">
                    <i data-lucide="bell" class="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors"></i>
                    ${unreadCount > 0 ? `<span class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>` : ''}
                </div>

                <div class="relative">
                    <div id="profile-btn-desktop" class="flex items-center gap-3 cursor-pointer group">
                        <div class="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400 font-black text-xs border border-emerald-500/20">
                            ${farmer ? farmer.name[0] : 'F'}
                        </div>
                        <i data-lucide="chevron-down" class="w-4 h-4 text-slate-500 group-hover:text-white transition-colors"></i>
                    </div>
                    
                    <div id="dropdown-desktop" class="absolute right-0 top-full mt-4 w-48 glass-panel p-2 hidden">
                        <button id="logout-btn-desktop" class="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/5 rounded-lg flex items-center gap-3">
                            <i data-lucide="log-out" class="w-4 h-4"></i> Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    `;

    // Top Nav Logic
    const profileBtn = root.querySelector('#profile-btn-desktop');
    const dropdown = root.querySelector('#dropdown-desktop');
    const logoutBtn = root.querySelector('#logout-btn-desktop');
    const bellBtn = root.querySelector('#nav-bell-btn-desktop');

    if (profileBtn && dropdown) {
        profileBtn.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('hidden'); };
        document.addEventListener('click', () => dropdown.classList.add('hidden'));
    }
    if (logoutBtn) logoutBtn.onclick = _doLogout;
    if (bellBtn) bellBtn.onclick = toggleAlertsFeed;

    if (window.lucide) window.lucide.createIcons();
}

/**
 * Mobile-specific Drawer
 */
function renderSidebar() {
    // We render this but the CSS (translateX-100%) hides it by default
    // It's only shown on mobile via BottomNav 'More' button class toggle
    const root = document.getElementById('navbar-root');
    const farmer = store.getState('currentFarmer');
    
    const sidebarHtml = `
        <aside id="main-sidebar" class="side-sidebar flex flex-col p-6 glass-hud">
            <div class="mb-10 px-2 flex items-center justify-between">
                <span class="text-xl font-black tracking-tighter text-white font-display">Command <span class="text-emerald-500">Node</span></span>
                <button onclick="document.getElementById('main-sidebar').classList.remove('open')" class="p-2 text-slate-500"><i data-lucide="x" class="w-6 h-6"></i></button>
            </div>

            <nav class="flex-1 space-y-1">
                ${[
                    { hash: '#dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
                    { hash: '#farm3d',    icon: 'box',              label: 'Digital Twin' },
                    { hash: '#ai',        icon: 'brain',            label: 'AI Intelligence' },
                    { hash: '#soil-analysis', icon: 'test-tube',         label: 'Soil Lab' },
                    { hash: '#control',   icon: 'sliders',          label: 'Hardware' },
                    { hash: '#analytics', icon: 'bar-chart-2',      label: 'Performance' },
                    { hash: '#support',   icon: 'headphones',       label: 'Support' },
                ].map(item => `
                    <a href="${item.hash}" class="flex items-center gap-4 px-4 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/5">
                        <i data-lucide="${item.icon}" class="w-5 h-5"></i>
                        ${item.label}
                    </a>
                `).join('')}
            </nav>

            <div class="mt-auto pt-6 border-t border-white/5 space-y-4">
                <div class="flex items-center gap-4 p-4 rounded-2xl bg-white/5">
                    <div class="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 font-black">${farmer ? farmer.name[0] : 'F'}</div>
                    <div class="flex-1 overflow-hidden">
                        <p class="text-[10px] font-black text-white truncate uppercase">${farmer?.name || 'Operator'}</p>
                        <p class="text-[8px] font-bold text-slate-500 truncate uppercase mt-0.5">${farmer?.email || ''}</p>
                    </div>
                </div>
                <button onclick="window.location.hash='#login'" class="w-full py-4 rounded-2xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3">
                    <i data-lucide="log-out" class="w-4 h-4"></i> Sign Out
                </button>
            </div>
        </aside>
    `;

    root.insertAdjacentHTML('beforeend', sidebarHtml);
    if (window.lucide) window.lucide.createIcons();
}

/**
 * Mobile Bottom Navigation
 */
function renderBottomNav() {
    const root = document.getElementById('bottom-nav-root');
    if (!root) return;

    const activePage = store.getState('activePage') || '#dashboard';

    const items = [
        { hash: '#dashboard', icon: 'layout-dashboard', label: 'Home' },
        { hash: '#farm3d',    icon: 'box',              label: 'Twin' },
        { hash: '#ai',        icon: 'zap',              label: 'AI' },
        { hash: '#control',   icon: 'sliders',          label: 'Control' },
        { hash: null,         icon: 'menu',             label: 'More', isMenu: true },
    ];

    root.innerHTML = `
        <nav class="bottom-navigation flex lg:hidden">
            <div class="w-full flex items-center justify-around px-2">
                ${items.map(item => {
                    const isActive = activePage === item.hash;
                    return `
                        <button class="nav-item-btn flex flex-col items-center justify-center gap-1.5 p-2 transition-all" 
                                data-hash="${item.hash}" data-menu="${item.isMenu || false}">
                            <div class="relative">
                                <i data-lucide="${item.icon}" class="w-6 h-6 ${isActive ? 'text-emerald-400' : 'text-slate-500'} transition-colors"></i>
                                ${isActive ? '<div class="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>' : ''}
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

    root.querySelectorAll('.nav-item-btn').forEach(btn => {
        btn.onclick = () => {
            const hash = btn.dataset.hash;
            const isMenu = btn.dataset.menu === 'true';
            if (isMenu) {
                document.getElementById('main-sidebar').classList.toggle('open');
            } else if (hash) {
                window.location.hash = hash;
                document.getElementById('main-sidebar').classList.remove('open');
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
