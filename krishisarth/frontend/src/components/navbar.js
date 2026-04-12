import { store } from '../state/store.js';
import { t, getLanguage, setLanguage, getAvailableLanguages } from '../utils/i18n.js';
import { clearToken } from '../api/client.js';
import { toggleAlertsFeed, renderAlertsFeed } from './alerts-feed.js';

let _navbarMounted = false;

/**
 * Navbar Component
 * Renders the primary navigation system with full mobile responsiveness.
 * Mobile: hamburger button opens a slide-down drawer with all nav links.
 * Desktop: horizontal nav links shown inline (md: breakpoint and above).
 */
export function renderNavbar() {
    const root = document.getElementById('navbar-root');
    if (!root) return;

    const activePage = store.getState('activePage');
    const farmer = store.getState('currentFarmer');
    const unreadCount = store.getState('unreadAlertCount');

    const template = `
        <nav class="px-4 shadow-sm relative z-50 flex items-center w-full" style="background: rgba(255,255,255,0.82); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(26,122,74,0.08); height: 60px;">
            <div class="container mx-auto flex items-center justify-between w-full">
                <!-- Logo -->
                <a href="#dashboard" class="flex items-center gap-2" style="text-decoration:none;">
                    <div class="ks-logo flex items-center gap-2">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2C6 2 3 8 3 12c0 5 4 9 9 9s9-4 9-9C21 7 17 2 12 2z" fill="#1a7a4a" opacity="0.2"/>
                            <path d="M12 2C8 5 6 9 8 14c1.5 3 4 5 4 5V2z" fill="#1a7a4a"/>
                            <path d="M12 2C16 5 18 9 16 14c-1.5 3-4 5-4 5V2z" fill="#0d6b3a" opacity="0.7"/>
                        </svg>
                        <span style="font-family:'Syne',sans-serif;font-weight:800;font-size:17px;letter-spacing:-0.03em;color:#0d1a12;">
                            Krishi<span style="color:#1a7a4a">Sarth</span>
                        </span>
                    </div>
                    <div id="ws-status-dot" class="live-dot ml-1 bg-amber-500" title="Connecting..."></div>
                </a>

                <!-- Desktop Navigation -->
                <div class="hidden md:flex items-center gap-8">
                    <a href="#dashboard" class="nav-link ${activePage === '#dashboard' ? 'active' : ''}" data-page="#dashboard" data-i18n="nav_dashboard">${t('nav_dashboard')}</a>
                    <a href="#ai"        class="nav-link ${activePage === '#ai'        ? 'active' : ''}" data-page="#ai" data-i18n="nav_ai">${t('nav_ai')}</a>
                    <a href="#control"   class="nav-link ${activePage === '#control'   ? 'active' : ''}" data-page="#control" data-i18n="nav_control">${t('nav_control')}</a>
                    <a href="#analytics" class="nav-link ${activePage === '#analytics' ? 'active' : ''}" data-page="#analytics" data-i18n="nav_analytics">${t('nav_analytics')}</a>
                    <a href="#farm3d"    class="nav-link ${activePage === '#farm3d'    ? 'active' : ''}" data-page="#farm3d" data-i18n="nav_farm3d">${t('nav_farm3d')}</a>
                </div>

                <!-- Right side actions -->
                <div class="flex items-center gap-3">
                    <!-- Language Switcher -->
                    <!-- Language Switcher -->
                    <div class="lang-switcher" id="lang-switcher">
                      ${getAvailableLanguages().map(l => `
                        <button
                          class="lang-btn ${getLanguage() === l.code ? 'lang-active' : ''}"
                          data-lang="${l.code}"
                          title="Switch to ${l.name}"
                          aria-label="${l.name}"
                        >
                          ${l.label}
                        </button>
                      `).join('')}
                    </div>

                    <!-- Bell -->
                    <div id="nav-bell-btn" class="relative cursor-pointer group">
                        <i data-lucide="bell" class="w-6 h-6 text-gray-500 group-hover:text-primary transition-colors"></i>
                        <span id="nav-bell-badge" class="${unreadCount > 0 ? '' : 'hidden '}absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full border-2 border-white min-w-[18px] text-center">${unreadCount}</span>
                    </div>

                    <!-- Profile (desktop) -->
                    <div class="relative pl-3 border-l border-gray-200">
                        <div id="profile-menu-btn" class="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                            <div class="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                                ${farmer ? farmer.name.split(' ').map(n => n[0]).join('') : 'F'}
                            </div>
                            <span class="hidden lg:block font-semibold text-sm text-gray-700">${farmer ? farmer.name : 'Farmer'}</span>
                            <i data-lucide="chevron-down" class="w-4 h-4 text-gray-400"></i>
                        </div>
                        <!-- Profile Dropdown -->
                        <div id="profile-dropdown" class="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 hidden z-50">
                            <button id="logout-btn" class="w-full text-left px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors">
                                <i data-lucide="log-out" class="w-4 h-4"></i>
                                Logout
                            </button>
                        </div>
                    </div>

                    <!-- Mobile Hamburger Button (visible only on mobile) -->
                    <button
                        id="mobile-menu-btn"
                        class="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 hover:text-primary hover:bg-gray-100 transition-all"
                        aria-label="Open navigation menu"
                        aria-expanded="false"
                    >
                        <i data-lucide="menu" class="w-6 h-6" id="mobile-menu-icon"></i>
                    </button>
                </div>
            </div>

            <!-- Mobile Drawer (hidden by default, slides down on open) -->
            <div
                id="mobile-drawer"
                class="md:hidden overflow-hidden transition-all duration-300 ease-in-out"
                style="max-height: 0; opacity: 0;"
            >
                <div class="container mx-auto pt-2 pb-4 flex flex-col gap-1 border-t border-gray-100 mt-3">
                    <a href="#dashboard" class="mobile-nav-link ${activePage === '#dashboard' ? 'mobile-nav-active' : ''}">
                        <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
                        <span data-i18n="nav_dashboard">${t('nav_dashboard')}</span>
                    </a>
                    <a href="#ai" class="mobile-nav-link ${activePage === '#ai' ? 'mobile-nav-active' : ''}">
                        <i data-lucide="brain" class="w-5 h-5"></i>
                        <span data-i18n="nav_ai">${t('nav_ai')}</span>
                    </a>
                    <a href="#control" class="mobile-nav-link ${activePage === '#control' ? 'mobile-nav-active' : ''}">
                        <i data-lucide="sliders-horizontal" class="w-5 h-5"></i>
                        <span data-i18n="nav_control">${t('nav_control')}</span>
                    </a>
                    <a href="#analytics" class="mobile-nav-link ${activePage === '#analytics' ? 'mobile-nav-active' : ''}">
                        <i data-lucide="bar-chart-2" class="w-5 h-5"></i>
                        <span data-i18n="nav_analytics">${t('nav_analytics')}</span>
                    </a>
                    <a href="#farm3d" class="mobile-nav-link ${activePage === '#farm3d' ? 'mobile-nav-active' : ''}">
                        <i data-lucide="box" class="w-5 h-5"></i>
                        <span data-i18n="nav_farm3d">${t('nav_farm3d')}</span>
                    </a>

                    <!-- Logout in mobile drawer -->
                    <div class="mt-3 pt-3 border-t border-gray-100">
                        <button id="mobile-logout-btn" class="mobile-nav-link w-full text-left text-red-500">
                            <i data-lucide="log-out" class="w-5 h-5"></i>
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <style>
            .live-dot {
                width: 8px;
                height: 8px;
                background: #22c55e;
                border-radius: 50%;
                display: inline-block;
                animation: livePulse 2s ease-in-out infinite;
            }
            @keyframes livePulse {
                0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
                50%      { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
            }

            /* Desktop nav links */
            .nav-link {
                font-family: 'DM Sans', sans-serif;
                font-size: 13px;
                font-weight: 600;
                color: #5a7266;
                text-decoration: none;
                position: relative;
                padding-bottom: 2px;
                transition: color 0.2s;
            }
            .nav-link::after {
                content: '';
                position: absolute;
                bottom: -2px; left: 0; right: 0;
                height: 2px;
                background: #1a7a4a;
                transform: scaleX(0);
                transform-origin: left;
                transition: transform 0.25s cubic-bezier(0.23,1,0.32,1);
                border-radius: 1px;
            }
            .nav-link:hover { color: #1a7a4a; }
            .nav-link:hover::after,
            .nav-link.active::after { transform: scaleX(1); }
            .nav-link.active { color: #1a7a4a; font-weight: 700; }

            /* Mobile drawer nav links */
            .mobile-nav-link {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                border-radius: 10px;
                font-weight: 600;
                font-size: 0.95rem;
                color: #4B5563;
                transition: all 0.15s ease;
                text-decoration: none;
            }
            .mobile-nav-link:hover {
                background-color: #f0f7f3;
                color: var(--color-primary);
            }
            .mobile-nav-active {
                background-color: #f0f7f3;
                color: var(--color-primary) !important;
            }
        </style>
    `;

    root.innerHTML = template;

    // ── Profile Dropdown ────────────────────────────────────────────────────
    const profileBtn      = root.querySelector('#profile-menu-btn');
    const profileDropdown = root.querySelector('#profile-dropdown');
    const logoutBtn       = root.querySelector('#logout-btn');

    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
                profileDropdown.classList.add('hidden');
            }
        });
    }

    // ── Logout (desktop dropdown) ────────────────────────────────────────────
    if (logoutBtn) {
        logoutBtn.addEventListener('click', _doLogout);
    }

    // ── Pre-mount alerts feed in background ──────────────────────────────────
    renderAlertsFeed();
    const bellBtn = root.querySelector('#nav-bell-btn');
    if (bellBtn) {
        bellBtn.addEventListener('click', () => { toggleAlertsFeed(); });
    }

    // ── Mobile logout ────────────────────────────────────────────────────────
    const mobileLogoutBtn = root.querySelector('#mobile-logout-btn');
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', _doLogout);
    }

    // ── Mobile Hamburger ─────────────────────────────────────────────────────
    const mobileMenuBtn = root.querySelector('#mobile-menu-btn');
    const mobileDrawer  = root.querySelector('#mobile-drawer');
    const mobileIcon    = root.querySelector('#mobile-menu-icon');

    let drawerOpen = false;

    function openDrawer() {
        drawerOpen = true;
        mobileDrawer.style.maxHeight = mobileDrawer.scrollHeight + 'px';
        mobileDrawer.style.opacity   = '1';
        // Swap icon to X
        if (mobileIcon && window.lucide) {
            mobileIcon.setAttribute('data-lucide', 'x');
            window.lucide.createIcons();
        }
        mobileMenuBtn?.setAttribute('aria-expanded', 'true');
    }

    function closeDrawer() {
        drawerOpen = false;
        mobileDrawer.style.maxHeight = '0';
        mobileDrawer.style.opacity   = '0';
        // Swap icon back to menu
        if (mobileIcon && window.lucide) {
            mobileIcon.setAttribute('data-lucide', 'menu');
            window.lucide.createIcons();
        }
        mobileMenuBtn?.setAttribute('aria-expanded', 'false');
    }

    if (mobileMenuBtn && mobileDrawer) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            drawerOpen ? closeDrawer() : openDrawer();
        });

        // Close drawer when a mobile nav link is tapped
        root.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', closeDrawer);
        });

        // Close drawer when tapping outside the navbar
        document.addEventListener('click', (e) => {
            if (drawerOpen && !root.contains(e.target)) {
                closeDrawer();
            }
        });
    }

    // ── Language Switcher ────────────────────────────────────────────────────
    root.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setLanguage(btn.dataset.lang);
        });
    });

    // ── Lucide Icons ─────────────────────────────────────────────────────────
    if (window.lucide) window.lucide.createIcons();

    // ── Hash change re-render ────────────────────────────────────────────────
    if (!_navbarMounted) {
        window.addEventListener('hashchange', () => {
            store.setState('activePage', window.location.hash || '#dashboard');
            renderNavbar();
        });
        
        document.addEventListener('ws-status', (e) => {
            const dot = document.getElementById('ws-status-dot');
            if (!dot) return;
            const status = e.detail;
            dot.classList.remove('bg-amber-500', 'bg-primary-light', 'bg-red-500');
            if (status === 'connected') {
                dot.classList.add('bg-primary-light');
                dot.title = "Live: Synchronized";
            } else if (status === 'connecting') {
                dot.classList.add('bg-amber-500');
                dot.title = "Offline: Connecting...";
            } else {
                dot.classList.add('bg-red-500');
                dot.title = "Offline: Disconnected";
            }
        });

        // ── Subscription for unread count ────────────────────────────────────────
        store.subscribe('unreadAlertCount', () => {
            const count = store.getState('unreadAlertCount');
            const badge = document.getElementById('nav-bell-badge');
            if (badge) {
                badge.textContent = count;
                if (count > 0) badge.classList.remove('hidden');
                else badge.classList.add('hidden');
            }
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
