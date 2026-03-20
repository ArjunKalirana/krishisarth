import { store }             from './state/store.js';
import { setToken }          from './api/client.js';
import { telemetryWS }       from './api/websocket.js';
import { listFarms }         from './api/farms.js';
import { renderNavbar }      from './components/navbar.js';
import { renderDashboard }   from './pages/dashboard.js';
import { renderAIDecisions } from './pages/ai-decisions.js';
import { renderControl }     from './pages/control.js';
import { renderAnalytics }   from './pages/analytics.js';
import { renderLogin }       from './pages/login.js';

const BACKEND = 'http://localhost:8000/v1';

async function initApp() {
    console.log('[KrishiSarth] Booting…');

    // ── Silent session restore ───────────────────────────────────────────────
    // On hard-refresh the in-memory access token is gone but refresh token
    // is still in sessionStorage. Restore access token before route guard runs.
    const savedRefresh = sessionStorage.getItem('ks_refresh_token');
    const savedFarmer  = store.getState('currentFarmer');

    if (savedRefresh) {
        try {
            const res = await fetch(`${BACKEND}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: savedRefresh }),
                credentials: 'include',
            });
            if (res.ok) {
                const body = await res.json();
                setToken(body.data.access_token);
                sessionStorage.setItem('ks_refresh_token', body.data.refresh_token);
            } else {
                // Refresh token expired — clear session cleanly
                sessionStorage.clear();
            }
        } catch { /* network down — let route guard handle it */ }
    }

    renderNavbar();

    // ── Route function (must be async) ──────────────────────────────────────
    const route = async () => {
        const hash    = window.location.hash || '#dashboard';
        const appRoot = document.getElementById('app-root');
        const navRoot = document.getElementById('navbar-root');
        const farmer  = store.getState('currentFarmer');

        console.log(`[ROUTER] → ${hash} | farmer: ${farmer?.name ?? 'none'}`);

        // Route guard
        if (!farmer && hash !== '#login' && hash !== '#register') {
            window.location.hash = '#login';
            return;
        }

        // Show/hide navbar
        if (hash === '#login' || hash === '#register') {
            navRoot?.classList.add('hidden');
        } else {
            navRoot?.classList.remove('hidden');
        }

        // Bootstrap farm on first authenticated route
        if (farmer && !store.getState('currentFarm')) {
            try {
                const res = await listFarms();
                // FIX: API returns res.data.farms array, not res.data directly
                const farms = res?.data?.farms ?? [];
                if (farms.length > 0) {
                    store.setState('currentFarm', farms[0]);
                    telemetryWS.connect(farms[0].id);
                }
            } catch (err) {
                console.warn('[ROUTER] Farm bootstrap failed:', err.message);
            }
        }

        appRoot.innerHTML = '';
        switch (hash) {
            case '#login':      appRoot.appendChild(renderLogin());       break;
            case '#dashboard':  appRoot.appendChild(renderDashboard());   break;
            case '#ai':         appRoot.appendChild(renderAIDecisions()); break;
            case '#control':    appRoot.appendChild(renderControl());     break;
            case '#analytics':  appRoot.appendChild(renderAnalytics());   break;
            default:
                appRoot.innerHTML = `<div class="text-center py-20 font-mono text-gray-400">404: PAGE_NOT_FOUND</div>`;
        }

        // Re-init Lucide icons after every DOM swap
        if (window.lucide) window.lucide.createIcons();
    };

    window.addEventListener('hashchange', route);
    await route(); // MUST be awaited — session restore must complete first
}

document.addEventListener('DOMContentLoaded', initApp);
