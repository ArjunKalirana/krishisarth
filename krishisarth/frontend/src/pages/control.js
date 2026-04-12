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
            <button id="start-all-btn" class="bg-primary hover:bg-primary-dark text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-[0_8px_30px_rgb(26,122,74,0.3)] active:scale-95 flex items-center gap-2" data-magnetic>
                <i data-lucide="play-circle" class="w-5 h-5"></i> <span data-i18n="ctrl_start">${t('ctrl_start')}</span> ALL
            </button>
            <button id="stop-all-btn" class="bg-red-50 border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2" data-magnetic>
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

    // Attach Start/Stop ALL listeners after zones load
    const attachBulkListeners = () => {
        const startAllBtn = container.querySelector('#start-all-btn');
        const stopAllBtn  = container.querySelector('#stop-all-btn');
        
        startAllBtn?.addEventListener('click', async () => {
            const farm = store.getState('currentFarm');
            if (!farm?.id) return;
            
            startAllBtn.disabled = true;
            startAllBtn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Starting...`;
            
            const cards = container.querySelectorAll('[data-zone-id]');
            if (cards.length === 0) {
                showToast('No zones loaded yet', 'warning');
            } else {
                const promises = [...cards].map(card => {
                    const zid = card.dataset.zoneId;
                    return startIrrigation(zid, 30).catch(() => {});
                });
                await Promise.all(promises);
                showToast('All zones started ✅', 'success');
            }
            
            startAllBtn.disabled = false;
            startAllBtn.innerHTML = `<i data-lucide="play-circle" class="w-5 h-5"></i> Start ALL`;
            if (window.lucide) window.lucide.createIcons();
        });

        stopAllBtn?.addEventListener('click', async () => {
            stopAllBtn.disabled = true;
            stopAllBtn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Stopping...`;
            const cards = container.querySelectorAll('[data-zone-id]');
            const promises = [...cards].map(card => {
                const zid = card.dataset.zoneId;
                return stopIrrigation(zid).catch(() => {});
            });
            await Promise.all(promises);
            showToast('All zones stopped 🛑', 'success');
            stopAllBtn.disabled = false;
            stopAllBtn.innerHTML = `<i data-lucide="stop-circle" class="w-5 h-5"></i> Stop ALL`;
            if (window.lucide) window.lucide.createIcons();
        });
    };

    // Call after _loadZones completes (use a small delay to ensure DOM is ready)
    setTimeout(attachBulkListeners, 1500);

    return container;
}
async function _loadZones(gridEl) {
    const farm = store.getState('currentFarm');
    if (!farm?.id) {
        setTimeout(() => _loadZones(gridEl), 800);
        return;
    }

    gridEl.innerHTML = `<div class="md:col-span-2 flex justify-center py-20">
        <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    </div>`;

    try {
        console.log('[Control] Loading zones for farm:', farm.id);

        // Primary: dashboard (has moisture data)
        let zones = [];
        try {
            const dashRes = await api(`/farms/${farm.id}/dashboard`);
            zones = dashRes?.data?.zones || [];
            console.log('[Control] Zones from dashboard:', zones.length);
        } catch (e) {
            console.warn('[Control] Dashboard failed, trying farm endpoint');
        }

        // Fallback: if dashboard returned 0 zones, hit the farm zones endpoint directly
        if (zones.length === 0) {
            try {
                const farmRes = await api(`/farms/${farm.id}/`);
                const raw = farmRes?.data?.zones || farmRes?.data || [];
                zones = Array.isArray(raw) ? raw : [];
                console.log('[Control] Zones from farm endpoint:', zones.length);
            } catch (e) {
                console.error('[Control] Both endpoints failed:', e.message);
            }
        }

        if (zones.length === 0) {
            gridEl.innerHTML = `
                <div class="md:col-span-2 ks-card p-10 text-center">
                    <i data-lucide="map-pin-off" class="w-12 h-12 mx-auto mb-4 text-gray-300"></i>
                    <p class="font-bold text-gray-400 font-mono text-[10px] uppercase tracking-widest mt-4">
                        Visit <code class="bg-gray-100 px-1 rounded">/v1/demo/history</code> 
                        to seed demo data, then refresh.
                    </p>
                </div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        gridEl.innerHTML = '';
        zones.forEach(z => {
            gridEl.appendChild(createZoneCard({
                id:           z.id,
                name:         z.name,
                lastIrrig:    'N/A',
                moisture:     z.moisture_pct || 0,
                initialState: z.pump_running || false,
            }));
        });

        if (window.lucide) window.lucide.createIcons();
    } catch (err) {
        console.error('[Control] _loadZones failed:', err.message);
        gridEl.innerHTML = `<div class="md:col-span-2 ks-card p-6 text-center text-red-500 text-sm font-bold">Failed to load zones. Refresh the page.</div>`;
    }
}

