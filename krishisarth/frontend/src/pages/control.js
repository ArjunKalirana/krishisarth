import { createZoneCard } from '../components/zone-card.js';
import { startIrrigation, stopIrrigation, injectFertigation } from '../api/control.js';
import { t } from '../utils/i18n.js';
import { showToast } from '../components/toast.js';
import { api } from '../api/client.js';
import { store } from '../state/store.js';

/**
 * Connected Control Page
 * Central hub for manual hardware orchestration.
 */
export function renderControl() {
    const container = document.createElement('div');
    container.className = "space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700";

    const header = document.createElement('div');
    header.className = "flex flex-col md:flex-row md:items-end justify-between gap-6";
    header.innerHTML = `
        <div>
            <h1 class="text-3xl font-extrabold text-gray-900" data-i18n="ctrl_title">${t('ctrl_title')}</h1>
            <p class="text-gray-500 font-medium mt-1" data-i18n="ctrl_subtitle">${t('ctrl_subtitle')}</p>
        </div>
        <div class="flex gap-3">
            <button id="start-all-btn" class="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-black text-sm transition-all shadow-md active:scale-95 flex items-center gap-2" data-magnetic>
                <i data-lucide="play-circle" class="w-5 h-5"></i> <span data-i18n="ctrl_start">${t('ctrl_start')}</span> ALL
            </button>
            <button id="stop-all-btn" class="border-2 border-red-600 text-red-600 hover:bg-red-50 px-6 py-3 rounded-xl font-black text-sm transition-all active:scale-95 flex items-center gap-2 uppercase tracking-tight" data-magnetic>
                <i data-lucide="stop-circle" class="w-5 h-5"></i> <span data-i18n="ctrl_stop_all">${t('ctrl_stop_all')}</span>
            </button>
        </div>
    `;
    container.appendChild(header);

    const layout = document.createElement('div');
    layout.className = "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start";

    const zoneGrid = document.createElement('div');
    zoneGrid.className = "lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6 zone-grid-container";
    
    // Load real zones from the API
    _loadZones(zoneGrid);
    
    layout.appendChild(zoneGrid);

    // SIDEBAR: Fertigation
    const sidebar = document.createElement('div');
    sidebar.className = "lg:col-span-4 space-y-8";

    const fertCard = document.createElement('div');
    fertCard.className = "ks-card p-6 border-t-4 border-t-primary";
    let activeNutrient = 'Nitrogen';

    const renderFert = () => {
        fertCard.innerHTML = `
            <h2 class="text-lg font-black text-gray-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                <i data-lucide="test-tube-2" class="w-5 h-5 text-primary"></i> <span data-i18n="ctrl_fertigation">${t('ctrl_fertigation')}</span>
            </h2>

            <div class="flex bg-gray-100 p-1 rounded-xl mb-6">
                ${['Nitrogen', 'Phosphorus', 'Potassium'].map((n) => `
                    <button class="nut-btn flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${n === activeNutrient ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}" data-nut="${n}">
                        ${n}
                    </button>
                `).join('')}
            </div>

            <div class="space-y-6">
                <div class="flex justify-between items-end">
                    <span class="text-xs font-bold text-gray-500 uppercase tracking-widest" data-i18n="ctrl_concentration">${t('ctrl_concentration')}</span>
                    <span class="text-3xl font-black text-primary" id="fert-val">12 <span class="text-xs text-gray-400 ml-1">ml/L</span></span>
                </div>
                <input type="range" min="0" max="30" value="12" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary" id="fert-slider">
                
                <button id="inject-btn" class="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg active:scale-95" data-magnetic>
                    <span data-i18n="ctrl_inject">${t('ctrl_inject')}</span>
                </button>
            </div>
        `;

        // ALL listeners must be attached AFTER innerHTML is set
        fertCard.querySelectorAll('.nut-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                activeNutrient = btn.dataset.nut;
                renderFert();
            });
        });

        const slider = fertCard.querySelector('#fert-slider');
        const valEl = fertCard.querySelector('#fert-val');
        const injectBtn = fertCard.querySelector('#inject-btn');
        
        slider.addEventListener('input', () => {
            valEl.innerHTML = `${slider.value} <span class="text-xs text-gray-400 ml-1">ml/L</span>`;
        });

        injectBtn.onclick = async () => {
            const farm = store.getState('currentFarm');
            let zoneId = null;
            try {
                if (farm?.id) {
                    const dashRes = await api(`/farms/${farm.id}/dashboard`);
                    zoneId = dashRes?.data?.zones?.[0]?.id;
                }
            } catch (e) {}

            if (!zoneId) {
                showToast(t('ctrl_no_zones'), 'error');
                return;
            }

            injectBtn.disabled = true;
            try {
                const res = await injectFertigation(zoneId, activeNutrient, slider.value);
                showToast(`Injection Successful: ${activeNutrient} stabilized`, 'success');
                if (res.warning === 'HIGH_CONCENTRATION') {
                    showToast(t('ctrl_warn_conc'), 'warning');
                }
            } catch (err) {
                if (err.message === 'PUMP_NOT_RUNNING') {
                    if (confirm(t('ctrl_pump_idle'))) {
                        showToast(t('ctrl_scheduled'), 'info');
                    }
                } else {
                    showToast(`Hardware Fault: ${err.message}`, 'error');
                }
            } finally { injectBtn.disabled = false; }
        };

        if (window.lucide) window.lucide.createIcons();
    };

    renderFert();
    sidebar.appendChild(fertCard);
    
    layout.appendChild(sidebar);
    container.appendChild(layout);

    // Wire up Start All and Stop All buttons
    // Wait for zone grid to load first
    setTimeout(() => {
        const startAllBtn = container.querySelector('#start-all-btn');
        const stopAllBtn  = container.querySelector('#stop-all-btn');

        startAllBtn?.addEventListener('click', async () => {
            const farm  = store.getState('currentFarm');
            if (!farm?.id) return;

            // Get all zone toggle buttons and click the ones that are OFF
            const toggles = container.querySelectorAll('.toggle-btn');
            if (toggles.length === 0) {
                showToast('No zones loaded yet', 'warning');
                return;
            }

            startAllBtn.disabled = true;
            let started = 0;
            // Get current zone states
            const zoneStates = store.getState('activeZoneStates') || {};

            // Get zone IDs from the dashboard
            try {
                const dashRes = await api(`/farms/${farm.id}/dashboard`);
                const zones   = dashRes?.data?.zones || [];

                for (const zone of zones) {
                    const state = zoneStates[zone.id];
                    if (!state?.isOn) {
                        try {
                            await startIrrigation(zone.id, 20);
                            const current = store.getState('activeZoneStates') || {};
                            current[zone.id] = { isOn: true, duration: 20 };
                            store.setState('activeZoneStates', { ...current });
                            started++;
                            // Stagger — wait 2 seconds between each zone start
                            await new Promise(r => setTimeout(r, 2000));
                        } catch (err) {
                            console.warn(`Could not start zone ${zone.name}:`, err.message);
                        }
                    }
                }

                showToast(`Started ${started} zones`, 'success');
                // Re-render the zone grid to show updated states
                _loadZones(container.querySelector('.zone-grid-container'));
            } catch (err) {
                showToast('Failed to load zones: ' + err.message, 'error');
            } finally {
                startAllBtn.disabled = false;
            }
        });

        stopAllBtn?.addEventListener('click', async () => {
            if (!confirm(t('ctrl_stop_confirm'))) return;

            stopAllBtn.disabled = true;
            const zoneStates = store.getState('activeZoneStates') || {};
            let stopped = 0;

            for (const [zoneId, state] of Object.entries(zoneStates)) {
                if (state?.isOn) {
                    try {
                        await stopIrrigation(zoneId);
                        zoneStates[zoneId] = { ...state, isOn: false };
                        stopped++;
                    } catch (err) {
                        console.warn(`Could not stop zone ${zoneId}:`, err.message);
                    }
                }
            }

            // Clear all active states
            store.setState('activeZoneStates', {});
            showToast(`Stopped ${stopped} active zones`, 'success');
            // Re-render zone grid
            _loadZones(container.querySelector('.zone-grid-container'));
            stopAllBtn.disabled = false;
        });

        if (window.lucide) window.lucide.createIcons();
        if (window.ksReveal) window.ksReveal();
    }, 1500);

    return container;
}

async function _loadZones(gridEl) {
    const farm = store.getState('currentFarm');

    if (!farm?.id) {
        // Retry after 1 second — farm bootstrap may still be running
        gridEl.innerHTML = `
            <div class="md:col-span-2 flex justify-center py-10">
                <div class="w-8 h-8 border-4 border-primary/20 border-t-primary 
                            rounded-full animate-spin"></div>
            </div>`;
        setTimeout(() => {
            const retryFarm = store.getState('currentFarm');
            if (retryFarm?.id) {
                _loadZones(gridEl);
            } else {
                gridEl.innerHTML = `
                    <div class="md:col-span-2 ks-card p-10 text-center">
                        <p class="text-gray-400 font-bold" data-i18n="ctrl_no_farm">
                            ${t('ctrl_no_farm')}
                        </p>
                        <p class="text-gray-300 text-xs mt-2">
                            Run: python scripts/seed.py
                        </p>
                    </div>`;
            }
        }, 1000);
        return;
    }

    try {
        console.log('[Control] Loading zones for farm:', farm.id);

        // Try dashboard first — it has sensor data (moisture %)
        let zones = [];
        try {
            const dashRes = await api(`/farms/${farm.id}/dashboard`);
            zones = dashRes?.data?.zones || [];
            console.log('[Control] Zones from dashboard:', zones.length);
        } catch {
            // Fall back to farm detail endpoint
            const farmRes = await api(`/farms/${farm.id}/`);
            const raw = farmRes?.data?.zones || farmRes?.data || [];
            zones = Array.isArray(raw) ? raw : [];
            console.log('[Control] Zones from farm endpoint:', zones.length);
        }

        if (zones.length === 0) {
            gridEl.innerHTML = `
                <div class="md:col-span-2 ks-card p-10 text-center">
                    <i data-lucide="map-pin-off" 
                       class="w-12 h-12 mx-auto mb-4 text-gray-300"></i>
                    <p class="font-bold text-gray-400" data-i18n="ctrl_no_zones">
                        ${t('ctrl_no_zones')}
                    </p>
                </div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        // Clear the spinner
        gridEl.innerHTML = '';

        // Render one card per zone
        zones.forEach(z => {
            gridEl.appendChild(createZoneCard({
                id:           z.id,
                name:         z.name,
                lastIrrig:    'N/A',
                moisture:     z.moisture_pct   || 0,
                initialState: z.pump_running   || false,
            }));
        });

        if (window.lucide) window.lucide.createIcons();
        console.log('[Control] Rendered', zones.length, 'zone cards');

    } catch (err) {
        console.error('[Control] Zone load error:', err.message);
        gridEl.innerHTML = `
            <div class="md:col-span-2 ks-card p-8 text-center"
                 style="background:#fef2f2; border-color:#fecaca;">
                <p class="text-red-500 font-bold">
                    <span data-i18n="ctrl_load_fail">${t('ctrl_load_fail')}</span>: ${err.message}
                </p>
                <button onclick="location.reload()" 
                        class="mt-4 px-4 py-2 bg-red-500 text-white 
                               rounded-lg text-sm font-bold">
                    Retry
                </button>
            </div>`;
    }
}

