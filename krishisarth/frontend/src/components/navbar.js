import { store } from '../state/store.js';
import { t, getLanguage, setLanguage, getAvailableLanguages } from '../utils/i18n.js';
import { clearToken } from '../api/client.js';

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
        <nav class="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 shadow-sm relative z-50">
            <div class="container mx-auto flex items-center justify-between">
                <!-- Logo -->
                <a href="#dashboard" class="flex items-center gap-2">
                    <div class="text-primary">
                        <i data-lucide="droplets" class="w-8 h-8"></i>
                    </div>
                    <span class="text-xl font-bold tracking-tight text-gray-900">
                        Krishi<span class="text-primary">Sarth</span>
                    </span>
                    <div id="ws-status-dot" class="pulse-dot ml-1 bg-amber-500" title="Connecting..."></div>
                </a>

                <!-- Desktop Navigation -->
                <div class="hidden md:flex items-center gap-8">
                    <a href="#dashboard" class="nav-link ${activePage === '#dashboard' ? 'active' : ''}" data-page="#dashboard">${t('nav_dashboard')}</a>
                    <a href="#ai"        class="nav-link ${activePage === '#ai'        ? 'active' : ''}" data-page="#ai">${t('nav_ai')}</a>
                    <a href="#control"   class="nav-link ${activePage === '#control'   ? 'active' : ''}" data-page="#control">${t('nav_control')}</a>
                    <a href="#analytics" class="nav-link ${activePage === '#analytics' ? 'active' : ''}" data-page="#analytics">${t('nav_analytics')}</a>
                    <a href="#farm3d"    class="nav-link ${activePage === '#farm3d'    ? 'active' : ''}" data-page="#farm3d">${t('nav_farm3d')}</a>
                </div>

                <!-- Right side actions -->
                <div class="flex items-center gap-3">
                    <!-- Language Switcher -->
                    <div class="flex items-center gap-1 bg-gray-100 rounded-lg p-1" id="lang-switcher">
                        ${getAvailableLanguages().map(l => `
                            <button
                                class="lang-btn px-2 py-1 rounded-md text-[10px] font-black transition-all
                                    ${getLanguage() === l.code
                                        ? 'bg-white text-primary shadow-sm'
                                        : 'text-gray-400 hover:text-gray-600'}"
                                data-lang="${l.code}"
                                title="${l.name}"
                            >${l.label}</button>
                        `).join('')}
                    </div>

                    <!-- Bell -->
                    <div class="relative cursor-pointer">
                        <i data-lucide="bell" class="w-6 h-6 text-gray-500 hover:text-primary transition-colors"></i>
                        ${unreadCount > 0 ? `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full border-2 border-white">${unreadCount}</span>` : ''}
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
                        ${t('nav_dashboard')}
                    </a>
                    <a href="#ai" class="mobile-nav-link ${activePage === '#ai' ? 'mobile-nav-active' : ''}">
                        <i data-lucide="brain" class="w-5 h-5"></i>
                        ${t('nav_ai')}
                    </a>
                    <a href="#control" class="mobile-nav-link ${activePage === '#control' ? 'mobile-nav-active' : ''}">
                        <i data-lucide="sliders-horizontal" class="w-5 h-5"></i>
                        ${t('nav_control')}
                    </a>
                    <a href="#analytics" class="mobile-nav-link ${activePage === '#analytics' ? 'mobile-nav-active' : ''}">
                        <i data-lucide="bar-chart-2" class="w-5 h-5"></i>
                        ${t('nav_analytics')}
                    </a>
                    <a href="#farm3d" class="mobile-nav-link ${activePage === '#farm3d' ? 'mobile-nav-active' : ''}">
                        <i data-lucide="box" class="w-5 h-5"></i>
                        ${t('nav_farm3d')}
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
            /* Desktop nav links */
            .nav-link {
                font-weight: 600;
                font-size: 0.925rem;
                color: #6B7280;
                transition: all 0.2s ease;
                position: relative;
                padding: 4px 0;
            }
            .nav-link:hover { color: var(--color-primary); }
            .nav-link.active { color: var(--color-primary); }
            .nav-link.active::after {
                content: '';
                position: absolute;
                bottom: -2px; left: 0; right: 0;
                height: 3px;
                background-color: var(--color-primary);
                border-radius: 99px;
            }

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
            _navbarMounted = false;
            renderNavbar();
            window.dispatchEvent(new HashChangeEvent('hashchange'));
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

        _navbarMounted = true;
    }
}

function _doLogout() {
    clearToken();
    store.setState('currentFarmer', null);
    store.setState('currentFarm', null);
    window.location.hash = '#login';
}
