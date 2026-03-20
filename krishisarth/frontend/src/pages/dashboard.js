import { getDashboard } from '../api/farms.js';
import { store } from '../state/store.js';
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

    const cacheKey = `dashboard_cache_${farmId}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
        console.log("DASHBOARD: Loading from localStorage...");
        const data = JSON.parse(cached);
        mainEl.innerHTML = renderHeader(data) + renderGrid(data);
        alertEl.innerHTML = renderBanner('amber', `Showing cached data · ${new Date(data.timestamp).toLocaleTimeString()}`);
    }

    try {
        const response = await getDashboard(farmId);
        
        if (response && response.success) {
            const data = response.data;
            data.timestamp = new Date().toISOString();
            
            // Persist for offline access
            localStorage.setItem(cacheKey, JSON.stringify(data));
            
            // Render fresh data
            alertEl.innerHTML = data.data_source === 'cache' 
                ? renderBanner('amber', "Historical data synced from node archive")
                : ""; // Clear banner if fresh

            mainEl.innerHTML = renderHeader(data) + renderGrid(data);
            
            // Map to store for reactive updates
            const sensorMap = {};
            data.zones.forEach(z => sensorMap[z.id] = { moisture: z.moisture_pct, temp_c: z.temp_c, ec_ds_m: z.ec_ds_m });
            store.setState('sensorData', sensorMap);

        }
    } catch (err) {
        alertEl.innerHTML = renderBanner('red', "CONNECTION LOST: Displaying last known field state");
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
                        <p class="text-xs font-bold text-primary-light uppercase tracking-widest">Water Intelligence</p>
                        <p class="text-xl font-extrabold">${data.summary.litres_saved || 0} Litres Saved Today</p>
                    </div>
                </div>
                <div class="flex items-center gap-6">
                    <div class="text-right">
                        <p class="text-xs font-bold text-white/60 uppercase tracking-widest">System Status</p>
                        <span class="font-black text-sm uppercase">${data.summary.status || 'ACTIVE'}</span>
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
            badgeText: moisture < 20 ? 'DRY' : 'OPTIMAL',
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
        <h2 class="text-2xl font-black text-gray-800 mb-2">Initialize Your Farm</h2>
        <p class="text-gray-400 font-medium mb-8">No agricultural zones detected in your registry.</p>
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
