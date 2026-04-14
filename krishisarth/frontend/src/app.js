import { store }             from './state/store.js';
import { setToken, api }    from './api/client.js';
import { telemetryWS }       from './api/websocket.js';
import { listFarms }         from './api/farms.js';
import { renderNavbar }      from './components/navbar.js';
import { renderDashboard }   from './pages/dashboard.js';
import { renderAIDecisions } from './pages/ai-decisions.js';
import { renderControl }     from './pages/control.js';
import { renderAnalytics }   from './pages/analytics.js';
import { renderLogin }       from './pages/login.js';
import { renderRegister }    from './pages/register.js';
import { renderFarm3D }      from './pages/farm-3d.js';
import { renderFarmSetup }   from './pages/farm-setup.js';
import { renderSupport }     from './pages/support.js';
import { initAIAssistant }   from './components/ai-assistant.js';

const BACKEND = window.__KS_API_URL__ || 'http://localhost:8000/v1';

async function initApp() {
    console.log('[KrishiSarth] Booting…');

    // Clear stale dashboard cache from old deployments
    // This runs once per session to ensure fresh data after code changes
    const cacheVersion = '2.1';
    if (localStorage.getItem('ks_cache_version') !== cacheVersion) {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('ks_dash_cache') || key.startsWith('ks_dash_cache_ts'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        localStorage.setItem('ks_cache_version', cacheVersion);
        console.log('[KrishiSarth] Stale cache cleared');
    }

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
    initAIAssistant();

    // ── Route function (must be async) ──────────────────────────────────────
    const route = async () => {
        const hash    = window.location.hash || '#dashboard';
        const appRoot = document.getElementById('app-root');
        const navRoot = document.getElementById('navbar-root');
        const footer  = document.getElementById('app-footer');
        const farmer  = store.getState('currentFarmer');

        // Clean shell for pure SPA experience
        if (appRoot) appRoot.innerHTML = '';

        console.log(`[ROUTER] → ${hash} | farmer: ${farmer?.name ?? 'none'}`);

        // Route guard
        if (!farmer && hash !== '#login' && hash !== '#register') {
            window.location.hash = '#login';
            return;
        }

        // Show/hide navbar & AI Assistant
        const asstRoot = document.getElementById('ks-assistant');
        if (hash === '#login' || hash === '#register') {
            navRoot?.classList.add('hidden');
            if (footer) footer.style.display = 'none';
            if (asstRoot) asstRoot.style.display = 'none';
        } else {
            navRoot?.classList.remove('hidden');
            if (footer) footer.style.display = 'block';
            if (asstRoot) asstRoot.style.display = 'block';
        }

        // Bootstrap/Verify farm on first authenticated route
        let currentFarm = store.getState('currentFarm');
        if (farmer && (!currentFarm || !currentFarm.id)) {
            appRoot.innerHTML = `<div class="flex flex-col items-center justify-center py-40 animate-pulse">
                <div class="w-16 h-16 border-4 border-ks-optimal/20 border-t-ks-optimal rounded-full animate-spin mb-6"></div>
                <p class="text-ks-muted font-black uppercase tracking-widest text-[10px]">Bootstrapping Intelligence...</p>
            </div>`;
            try {
                const res = await listFarms();
                const farms = res?.data?.farms ?? [];
                
                if (farms.length > 0) {
                    // Always pick the farm with the most zones (freshest seeded data).
                    // Ties broken by most recently created (farms are already sorted newest-first).
                    const bestFarm = farms.reduce((best, f) => {
                        const bestZones = best.zone_count ?? best.zones?.length ?? 0;
                        const fZones   = f.zone_count   ?? f.zones?.length   ?? 0;
                        return fZones > bestZones ? f : best;
                    }, farms[0]);
            
                    console.log('[ROUTER] Farm selected:', bestFarm.name, bestFarm.id, '| zones:', bestFarm.zone_count ?? '?');
                    store.setState('currentFarm', bestFarm);
                    
                    if (bestFarm.zone_count === 0) {
                        window.location.hash = '#setup';
                        return;
                    }
                    
                    telemetryWS.connect(bestFarm.id);
                    // RE-RENDER: Now that we have a farm ID, move past the bootstrap phase
                    return route();
                } else {
                    console.log('[ROUTER] No farms found — auto-provisioning default...');
                    // Auto-create a default farm for a seamless experience (especially for "Demo" user)
                    const createRes = await api('/farms/', {
                        method: 'POST',
                        body: JSON.stringify({ 
                            name: `${farmer.name}'s Plot`, 
                            soil_type: 'Loam', 
                            area_ha: 1.0 
                        })
                    });
                    if (createRes?.success) {
                        const newFarm = createRes.data;
                        console.log('[ROUTER] Default farm created:', newFarm.name);
                        store.setState('currentFarm', newFarm);
                        
                        // Auto-create a default zone for the new farm
                        console.log('[ROUTER] Provisioning default zone: Main Plot...');
                        const zoneRes = await api(`/farms/${newFarm.id}/zones`, {
                            method: 'POST',
                            body: JSON.stringify({
                                name: 'Main Plot',
                                crop_type: 'Tomato',
                                area_sqm: 100
                            })
                        });
                        
                        if (zoneRes?.success) {
                            console.log('[ROUTER] Default zone created.');
                        }
                        
                        telemetryWS.connect(newFarm.id);
                        
                        // RE-RENDER: Now that we have a farm, re-run the router to show the dashboard
                        route();
                    }
                }
            } catch (err) {
                console.warn('[ROUTER] Farm bootstrap failed:', err.message);
            }
        }

        try {
            switch (hash) {
                case '#login':      appRoot.appendChild(renderLogin());       break;
                case '#register':   appRoot.appendChild(renderRegister());    break;
                case '#dashboard':  appRoot.appendChild(renderDashboard());   break;
                case '#ai':         appRoot.appendChild(renderAIDecisions()); break;
                case '#control':    appRoot.appendChild(renderControl());     break;
                case '#analytics':  appRoot.appendChild(renderAnalytics());   break;
                case '#farm3d':     appRoot.appendChild(renderFarm3D());      break;
                case '#setup':      appRoot.appendChild(renderFarmSetup(() => { window.location.hash = '#dashboard'; })); break;
                case '#support':    appRoot.appendChild(renderSupport());     break;
                default:
                    appRoot.innerHTML = `<div class="text-center py-20 font-mono text-gray-400">404: PAGE_NOT_FOUND</div>`;
            }
        } catch (err) {
            console.error('[ROUTER] Crash during page render:', err);
            appRoot.innerHTML = `<div class="flex flex-col items-center justify-center py-40">
                <p class="text-red-400 font-black uppercase tracking-widest text-[10px]">Neural Segment Violation</p>
                <p class="text-slate-500 text-xs mt-2">${err.message}</p>
            </div>`;
        }

        // Re-init Lucide icons after every DOM swap
        if (window.lucide) {
            try { window.lucide.createIcons(); } catch { /* ignore lucide noise */ }
        }
    };

    window.addEventListener('hashchange', route);
    try {
        await route(); 
    } catch (err) {
        console.error('[APP] Critical routing failure:', err);
    }
}

document.addEventListener('DOMContentLoaded', initApp);
