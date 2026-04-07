import { getDashboard } from '../api/farms.js';
import { store } from '../state/store.js';
import { t } from '../utils/i18n.js';
import { createSensorCard } from '../components/sensor-card.js';
import { createTankRing } from '../components/tank-ring.js';

/**
 * Dynamic Dashboard Page
 * Real-time farm intelligence with offline-first caching.
 */
export function renderDashboard() {
    const container = document.createElement('div');
    container.className = "space-y-6 animate-in fade-in duration-500";

    const farmId = store.getState('currentFarm')?.id;

    // 1. Initial Scaffold (Banners & Hero)
    const topBar = document.createElement('div');
    topBar.id = "dashboard-alerts";
    container.appendChild(topBar);

    const mainContent = document.createElement('div');
    mainContent.id = "dashboard-main";
    mainContent.innerHTML = renderSkeleton();
    container.appendChild(mainContent);

    // 2. Load Data (Cache then Network)
    loadDashboardData(farmId, mainContent, topBar);

    // 3. Reactive Subscription for sub-second updates
    store.subscribe('sensorData', () => {
        // Partial re-render optimization could go here, 
        // for now we re-sync the active dashboard view
        syncDashboardFromState(mainContent);
    });

    return container;
}

/**
 * Fetches dashboard data with staleness handling and localStorage persistence.
 */
async function loadDashboardData(farmId, mainEl, alertEl) {
    if (!farmId) {
        mainEl.innerHTML = renderEmptyState();
        return;
    }

    const cacheKey = `ks_dash_cache:${farmId}`;
    const tsKey = `ks_dash_cache_ts:${farmId}`;

    const attachListeners = (data) => {
        const refreshBtn = mainEl.querySelector('#dash-refresh-btn');
        if (refreshBtn) {
            refreshBtn.onclick = async () => {
                refreshBtn.querySelector('i').classList.add('animate-spin');
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(tsKey);
                await loadDashboardData(farmId, mainEl, alertEl);
            };
        }
        if (window.lucide) window.lucide.createIcons();
    };

    const renderFromCache = (isError) => {
        const cached = localStorage.getItem(cacheKey);
        const tsStr = localStorage.getItem(tsKey);
        if (cached && tsStr) {
            const data = JSON.parse(cached);
            const ts = parseInt(tsStr, 10);
            const ageMins = Math.floor((Date.now() - ts) / 60000);
            
            mainEl.innerHTML = renderHeader(data) + renderGrid(data);
            attachListeners(data);
            
            if (isError) {
                if (ageMins < 5) {
                    alertEl.innerHTML = renderBanner('amber', `⚠ Offline mode — showing data from ${ageMins} minutes ago`);
                } else {
                    alertEl.innerHTML = renderBanner('amber', `Data may be outdated`);
                }
            } else {
                alertEl.innerHTML = "";
            }
            return true;
        }
        return false;
    };

    renderFromCache(false);

    try {
        const response = await getDashboard(farmId);
        
        if (response && response.success) {
            const data = response.data;
            localStorage.setItem(cacheKey, JSON.stringify(data));
            localStorage.setItem(tsKey, Date.now().toString());
            
            alertEl.innerHTML = ""; 
            store.setState('currentFarmDashboard', data);
            
            mainEl.innerHTML = renderHeader(data) + renderGrid(data);
            attachListeners(data);
            
            const sensorMap = {};
            data.zones.forEach(z => sensorMap[z.id] = { moisture: z.moisture_pct, temp_c: z.temp_c, ec_ds_m: z.ec_ds_m });
            store.setState('sensorData', sensorMap);
        } else {
            if (!renderFromCache(true)) {
                alertEl.innerHTML = renderBanner('red', t('dash_conn_lost'));
            }
        }
    } catch (err) {
        if (!renderFromCache(true)) {
            alertEl.innerHTML = renderBanner('red', t('dash_conn_lost'));
        }
    }
}

function renderBanner(color, msg) {
    const bg = color === 'red' ? 'bg-red-500' : 'bg-amber-500';
    return `<div class="${bg} text-white px-4 py-2 rounded-xl mb-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-in slide-in-from-top-2">
        <i data-lucide="info" class="w-4 h-4"></i> ${msg}
    </div>`;
}

function renderHeader(data) {
    return `
        <div class="bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-1 shadow-lg mb-8">
            <div class="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-white">
                <div class="flex items-center gap-3">
                    <div class="bg-white/20 p-2 rounded-lg">
                        <i data-lucide="droplets" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-primary-light uppercase tracking-widest">${t('dash_title')}</p>
                        <p class="text-xl font-extrabold">${data.summary.litres_saved || 0} ${t('dash_saved')}</p>
                    </div>
                </div>
                <div class="flex items-center gap-6">
                    <div class="flex items-center gap-3 text-right">
                        <button id="dash-refresh-btn" class="p-2 rounded border border-white/20 hover:bg-white/10 transition-colors" title="Refresh Live Data">
                            <i data-lucide="refresh-cw" class="w-4 h-4 text-white"></i>
                        </button>
                        <div>
                            <p class="text-xs font-bold text-white/60 uppercase tracking-widest">${t('dash_status')}</p>
                            <span class="font-black text-sm uppercase">${data.summary.status || 'ACTIVE'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderGrid(data) {
    const grid = document.createElement('div');
    grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6";
    
    // Simplification for brevity in template
    data.zones.forEach(z => {
        const moisture = z.moisture_pct || 0;
        const card = createSensorCard({
            title: z.name,
            icon: "sprout",
            value: moisture,
            unit: "%",
            badgeType: moisture < 20 ? 'dry' : 'ok',
            badgeText: moisture < 20 ? t('dash_dry') : t('dash_optimal'),
            children: `<p class="text-[9px] font-bold text-gray-400 mt-2">LAST UPDATED: ${new Date().toLocaleTimeString()}</p>`
        });
        grid.appendChild(card);
    });

    return grid.outerHTML;
}

function renderSkeleton() {
    return `<div class="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
        ${[1,2,3,4].map(() => `<div class="h-48 bg-gray-200 rounded-2xl"></div>`).join('')}
    </div>`;
}

function renderEmptyState() {
    return `<div class="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
        <h2 class="text-2xl font-black text-gray-800 mb-2">${t('dash_no_farm')}</h2>
        <p class="text-gray-400 font-medium mb-8">${t('dash_no_zones')}</p>
        <button class="bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-xl font-black text-sm transition-all shadow-lg active:scale-95">
            + CREATE FIRST ZONE
        </button>
    </div>`;
}

function syncDashboardFromState(mainEl) {
    // This would ideally do fine-grained DOM updates, 
    // but for the MVP it ensures UI stays in sync with store.sensorData
    const data = store.getState('currentFarmDashboard'); 
    if (data) mainEl.innerHTML = renderHeader(data) + renderGrid(data);
}
