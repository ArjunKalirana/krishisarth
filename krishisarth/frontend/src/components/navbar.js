import { store } from '../state/store.js';

let _navbarMounted = false;

/**
 * Navbar Component
 * Renders the primary navigation system with mobile responsiveness.
 */
export function renderNavbar() {
    const root = document.getElementById('navbar-root');
    if (!root) return;

    const activePage = store.getState('activePage');
    const farmer = store.getState('currentFarmer');
    const unreadCount = store.getState('unreadAlertCount');

    const template = `
        <nav class="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 shadow-sm">
            <div class="container mx-auto flex items-center justify-between">
                <!-- Logo -->
                <a href="#dashboard" class="flex items-center gap-2">
                    <div class="text-primary">
                        <i data-lucide="droplets" class="w-8 h-8"></i>
                    </div>
                    <span class="text-xl font-bold tracking-tight text-gray-900">
                        Krishi<span class="text-primary">Sarth</span>
                    </span>
                    <div class="pulse-dot ml-1" title="Live System Connection"></div>
                </a>

                <!-- Desktop Navigation -->
                <div class="hidden md:flex items-center gap-8">
                    <a href="#dashboard" class="nav-link ${activePage === '#dashboard' ? 'active' : ''}">Dashboard</a>
                    <a href="#ai" class="nav-link ${activePage === '#ai' ? 'active' : ''}">AI Decisions</a>
                    <a href="#control" class="nav-link ${activePage === '#control' ? 'active' : ''}">Control Panel</a>
                    <a href="#analytics" class="nav-link ${activePage === '#analytics' ? 'active' : ''}">Analytics</a>
                </div>

                <!-- Farmer Actions -->
                <div class="flex items-center gap-4">
                    <div class="relative cursor-pointer">
                        <i data-lucide="bell" class="w-6 h-6 text-gray-500 hover:text-primary transition-colors"></i>
                        ${unreadCount > 0 ? `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full border-2 border-white">${unreadCount}</span>` : ''}
                    </div>
                    <div class="flex items-center gap-2 pl-4 border-l border-gray-200">
                        <div class="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                            ${farmer ? farmer.name.split(' ').map(n => n[0]).join('') : 'F'}
                        </div>
                        <span class="hidden lg:block font-semibold text-sm text-gray-700">${farmer ? farmer.name : 'Farmer'}</span>
                    </div>
                    
                    <!-- Mobile Menu Button -->
                    <button id="mobile-menu-btn" class="md:hidden text-gray-600 hover:text-primary">
                        <i data-lucide="menu" class="w-7 h-7"></i>
                    </button>
                </div>
            </div>
        </nav>

        <style>
            .nav-link {
                font-weight: 600;
                font-size: 0.925rem;
                color: #6B7280; /* text-gray-500 */
                transition: all 0.2s ease;
                position: relative;
                padding: 4px 0;
            }
            .nav-link:hover {
                color: var(--color-primary);
            }
            .nav-link.active {
                color: var(--color-primary);
            }
            .nav-link.active::after {
                content: '';
                position: absolute;
                bottom: -2px;
                left: 0;
                right: 0;
                height: 3px;
                background-color: var(--color-primary);
                border-radius: 99px;
            }
        </style>
    `;

    root.innerHTML = template;
    
    // Initialize Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Hash change listener for re-render (Internal Navigation)
    if (!_navbarMounted) {
        window.addEventListener('hashchange', () => {
            const newHash = window.location.hash || '#dashboard';
            store.setState('activePage', newHash);
            renderNavbar();
        });
        _navbarMounted = true;
    }
}
