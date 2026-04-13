import { getDashboard } from '../api/farms.js';
import { store } from '../state/store.js';
import { t } from '../utils/i18n.js';
import { createSensorCard } from '../components/sensor-card.js';
import { createTankRing } from '../components/tank-ring.js';
import { countUp } from '../utils/dom.js';
import { showToast } from '../components/toast.js';
import { api } from '../api/client.js';

/**
 * Dynamic Dashboard Page
 * Real-time farm intelligence with offline-first caching.
 */
export function renderDashboard() {
    const container = document.createElement('div');
    container.className = "ks-responsive-container space-y-8 animate-in fade-in duration-700 pb-20";

    // MUST be declared first — everything below depends on these
    const farmId = store.getState('currentFarm')?.id;
    const farmer = store.getState('currentFarmer');

    // Demo Banner (only for demo@gmail.com)
    if (farmer?.email === 'demo@gmail.com') {
        const demoBanner = document.createElement('div');
        demoBanner.className = "flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel px-6 py-4 mb-4 border-l-4 border-l-emerald-500";
        demoBanner.innerHTML = `
            <div class="flex items-center gap-4">
                <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.5)]"></span>
                <p class="text-sm font-bold text-emerald-400 font-display uppercase tracking-widest">
                    Live Simulation Active
                </p>
            </div>
            <div class="flex gap-3 w-full sm:w-auto">
                <button id="demo-crisis-btn" class="flex-1 sm:flex-none bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border border-red-500/20 transition-all active:scale-95">
                    Trigger Crisis
                </button>
                <button id="demo-reset-btn" class="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border border-slate-700 transition-all active:scale-95">
                    Reset Twin
                </button>
            </div>
        `;
        container.appendChild(demoBanner);

        // Wire buttons AFTER appending to DOM
        setTimeout(() => {
            demoBanner.querySelector('#demo-crisis-btn')?.addEventListener('click', async () => {
                try {
                    await api('/demo/crisis?zone_name=Wheat+Block', { method: 'POST' });
                    showToast('Crisis injected in Wheat Block! Watch the AI alerts fire.', 'error');
                } catch { showToast('Could not trigger crisis', 'error'); }
            });
            demoBanner.querySelector('#demo-reset-btn')?.addEventListener('click', async () => {
                try {
                    await api('/demo/reset', { method: 'POST' });
                    showToast('Simulation reset to healthy values ✅', 'success');
                } catch { showToast('Could not reset simulation', 'error'); }
            });
        }, 0);
    }

    const topBar = document.createElement('div');
    topBar.id = "dashboard-alerts";
    container.appendChild(topBar);

    const mainContent = document.createElement('div');
    mainContent.id = "dashboard-main";
    mainContent.innerHTML = renderSkeleton();
    container.appendChild(mainContent);

    // 1.5. Demo Status Check (No-auth endpoint)
    if (farmer?.email === 'demo@gmail.com') {
        api('/demo/status').then(res => {
            if (res && res.seeded && !res.simulation_running) {
                showToast('Simulation is currently stopped on the server.', 'warning');
            }
        }).catch(() => {});
    }

    // 2. Load Data (Cache then Network)
    loadDashboardData(farmId, mainContent, topBar);

    // 3. Reactive Subscription for sub-second updates
    store.subscribe('sensorData', () => {
        // Partial re-render optimization could go here, 
        // for now we re-sync the active dashboard view
        syncDashboardFromState(mainContent);
    });

    setTimeout(() => { if (window.ksReveal) window.ksReveal(); }, 100);

    return container;
}

/**
 * Fetches dashboard data with staleness handling and localStorage persistence.
 */
async function loadDashboardData(farmId, mainEl, alertEl) {
    if (!farmId) {
        mainEl.innerHTML = renderEmptyState();
        // MUST attach listeners for the rescue/initialize button
        attachListeners(null, mainEl);
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    const cacheKey = `ks_dash_cache:${farmId}`;
    const tsKey = `ks_dash_cache_ts:${farmId}`;

    const attachListeners = (data, mainElement = mainEl) => {
        const refreshBtn = mainElement.querySelector('#dash-refresh-btn');
        if (refreshBtn) {
            refreshBtn.onclick = async () => {
                const icon = refreshBtn.querySelector('i');
                if (icon) icon.classList.add('animate-spin');
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(tsKey);
                await loadDashboardData(farmId, mainElement, alertEl);
                if (icon) icon.classList.remove('animate-spin');
            };
        }

        // Global Rescue Button (Header)
        const rescueBtnHeader = mainElement.querySelector('#rescue-demo-header-btn');
        if (rescueBtnHeader) {
            rescueBtnHeader.onclick = async () => {
                rescueBtnHeader.disabled = true;
                rescueBtnHeader.innerHTML = '<i class="w-4 h-4 animate-spin"></i> Resetting Twin...';
                
                try {
                    // FORCE CLEAR EVERYTHING MENTALLY
                    console.log('[RESCUE] Nuking local state...');
                    
                    // CRITICAL: Clear stored farm so app.js re-fetches the new farm ID
                    store.setState('currentFarm', null);
                    sessionStorage.removeItem('ks_current_farm');
                    
                    // Also clear dashboard cache so we don't show stale data
                    for (let k of Object.keys(localStorage)) {
                        if (k.startsWith('ks_dash_cache') || k.startsWith('ks_dash_cache_ts')) {
                            localStorage.removeItem(k);
                        }
                    }
                    
                    await api('/demo/history', { method: 'POST' });
                    showToast('✅ Demo farm ready! Refreshing...', 'success');
                    
                    setTimeout(() => window.location.reload(), 1500);
                } catch (e) {
                    showToast('Reset failed: ' + e.message, 'error');
                    rescueBtnHeader.disabled = false;
                    rescueBtnHeader.innerHTML = '<i data-lucide="zap" class="w-4 h-4"></i> Fix Demo Data';
                    if (window.lucide) window.lucide.createIcons();
                }
            };
        }

        // Global Add Zone Button
        const addBtn = mainElement.querySelector('#add-zone-btn');
        const modal = document.getElementById('zone-modal');
        if (addBtn && modal) {
            addBtn.onclick = () => {
                modal.classList.remove('hidden');
                if (window.lucide) window.lucide.createIcons();
            };
            modal.querySelector('.close-modal').onclick = () => modal.classList.add('hidden');
            
            let selectedCrop = 'tomato';
            modal.querySelectorAll('.modal-crop-btn').forEach(btn => {
                btn.onclick = () => {
                    modal.querySelectorAll('.modal-crop-btn').forEach(b => b.classList.remove('border-ks-optimal', 'bg-green-50'));
                    btn.classList.add('border-ks-optimal', 'bg-green-50');
                    selectedCrop = btn.dataset.crop;
                };
            });

            modal.querySelector('#modal-save-btn').onclick = async () => {
                const nameInput = modal.querySelector('#modal-zone-name');
                const name = nameInput.value.trim() || `New ${selectedCrop} Plot`;
                
                try {
                    const farm = store.getState('currentFarm');
                    if (!farm) throw new Error('No active farm');
                    
                    modal.querySelector('#modal-save-btn').disabled = true;
                    await api(`/farms/${farm.id}/zones`, {
                        method: 'POST',
                        body: JSON.stringify({ name, crop_type: selectedCrop, area_sqm: 1000 })
                    });
                    
                    showToast(`Plot "${name}" registered! Syncing twin...`, 'success');
                    modal.classList.add('hidden');
                    setTimeout(() => window.location.reload(), 1500);
                } catch (e) {
                    showToast(e.message, 'error');
                } finally {
                    modal.querySelector('#modal-save-btn').disabled = false;
                }
            };
        }
        
        // Demo Actions (Event Delegation)
        const crisisBtn = document.querySelector('#demo-crisis-btn');
        if (crisisBtn) {
            crisisBtn.onclick = async () => {
                try {
                    await api(`/demo/crisis?zone_name=${encodeURIComponent('Wheat Block')}`, { method: 'POST' });
                    showToast('Crisis injected in Wheat Block!', 'warning');
                } catch (e) { showToast('Action failed', 'error'); }
            };
        }
        const resetBtn = document.querySelector('#demo-reset-btn');
        if (resetBtn) {
            resetBtn.onclick = async () => {
                try {
                    await api('/demo/reset', { method: 'POST' });
                    // Clear cache so fresh simulation data shows on next render
                    const farmId = store.getState('currentFarm')?.id;
                    if (farmId) {
                        localStorage.removeItem(`ks_dash_cache:${farmId}`);
                        localStorage.removeItem(`ks_dash_cache_ts:${farmId}`);
                    }
                    showToast('Simulation reset ✅ Refreshing data...', 'success');
                    setTimeout(() => window.location.reload(), 1000);
                } catch (e) { showToast('Action failed', 'error'); }
            };
        }

        // Rescue Button
        const rescueBtn = mainElement.querySelector('#rescue-demo-btn');
        if (rescueBtn) {
            rescueBtn.onclick = async () => {
                rescueBtn.disabled = true;
                rescueBtn.innerHTML = '<span>⏳</span><span>Initializing...</span>';
                try {
                    await api('/demo/history', { method: 'POST' });
                    showToast('✅ Demo farm ready! Refreshing...', 'success');
                    
                    // CRITICAL: Clear stored farm so app.js re-fetches the new farm ID
                    store.setState('currentFarm', null);
                    sessionStorage.removeItem('ks_current_farm');
                    
                    // Also clear dashboard cache so we don't show stale data
                    for (let k of Object.keys(localStorage)) {
                        if (k.startsWith('ks_dash_cache') || k.startsWith('ks_dash_cache_ts')) {
                            localStorage.removeItem(k);
                        }
                    }
                    
                    setTimeout(() => window.location.reload(), 1500);
                } catch (e) {
                    showToast('Initialization failed: ' + e.message, 'error');
                    rescueBtn.disabled = false;
                    rescueBtn.innerHTML = '<span>⚡</span><span>Try Again</span>';
                }
            };
        }

        // Crop selector
        let selectedCrop = '';
        let selectedStage = 'vegetative';
        const cropBtns = mainElement.querySelectorAll('.crop-btn');
        const zoneForm = mainElement.querySelector('#zone-form');
        const stageSelector = mainElement.querySelector('#stage-selector');

        cropBtns.forEach(btn => {
            btn.onclick = () => {
                cropBtns.forEach(b => b.classList.remove('border-green-400', 'bg-green-50', 'scale-105'));
                btn.classList.add('border-green-400', 'bg-green-50', 'scale-105');
                selectedCrop = btn.dataset.crop;
                const label = btn.dataset.label;
                const emoji = btn.querySelector('span:first-child').textContent;
                if (zoneForm) {
                    zoneForm.classList.remove('hidden');
                    mainElement.querySelector('#selected-emoji').textContent = emoji;
                    mainElement.querySelector('#selected-label').textContent = label + ' Zone';
                    mainElement.querySelector('#zone-name-input').placeholder = `e.g. ${label} Field A`;
                }
            };
        });

        stageSelector?.querySelectorAll('.stage-btn').forEach(btn => {
            btn.onclick = () => {
                stageSelector.querySelectorAll('.stage-btn').forEach(b => {
                    b.classList.remove('border-green-400', 'bg-green-50', 'text-green-700');
                });
                btn.classList.add('border-green-400', 'bg-green-50', 'text-green-700');
                selectedStage = btn.dataset.stage;
            };
        });

        const createZoneBtn = mainElement.querySelector('#create-zone-btn');
        if (createZoneBtn) {
            createZoneBtn.onclick = async () => {
                if (!selectedCrop) { showToast('Please select a crop first', 'error'); return; }
                const farm = store.getState('currentFarm');
                if (!farm?.id) { showToast('No farm found', 'error'); return; }

                const zoneName = mainElement.querySelector('#zone-name-input')?.value?.trim() 
                              || `${selectedCrop.charAt(0).toUpperCase() + selectedCrop.slice(1)} Zone`;
                const areaSqm = parseInt(mainElement.querySelector('#zone-area-input')?.value) || 5000;

                createZoneBtn.disabled = true;
                createZoneBtn.innerHTML = `<span>⏳</span><span>Creating...</span>`;

                try {
                    const res = await api(`/farms/${farm.id}/zones`, {
                        method: 'POST',
                        body: JSON.stringify({
                            name: zoneName,
                            crop_type: selectedCrop,
                            crop_stage: selectedStage,
                            area_sqm: areaSqm,
                        })
                    });
                    if (res?.success) {
                        showToast(`✅ ${zoneName} created! Reloading...`, 'success');
                        setTimeout(() => window.location.reload(), 1500);
                    } else {
                        showToast('Zone creation failed', 'error');
                    }
                } catch(e) {
                    showToast('Zone creation failed: ' + e.message, 'error');
                } finally {
                    createZoneBtn.disabled = false;
                    createZoneBtn.innerHTML = `<span>➕</span><span>Create Zone</span>`;
                }
            };
        }
        
        mainEl.querySelectorAll('[data-countup]').forEach(el => {
            const target = parseInt(el.getAttribute('data-countup'), 10);
            if (!isNaN(target)) countUp(el, target);
        });

        if (window.lucide) window.lucide.createIcons();
        initWeatherCard();
    };

    const renderFromCache = (isError) => {
        const cached = localStorage.getItem(cacheKey);
        const tsStr = localStorage.getItem(tsKey);
        if (cached && tsStr) {
            const data = JSON.parse(cached);
            const ts = parseInt(tsStr, 10);
            const ageMins = Math.floor((Date.now() - ts) / 60000);
            
            mainEl.innerHTML = renderHeader(data) + renderWeatherCardSkeleton() + renderGrid(data) + renderWaterBudget() + renderCropTimeline(data.zones);
            attachListeners(data, mainEl);
            
            if (isError) {
                if (ageMins < 5) {
                    alertEl.innerHTML = renderBanner('amber', `⚠ Offline mode — showing data from ${ageMins} minutes ago`);
                } else {
                    alertEl.innerHTML = renderBanner('amber', `Data may be outdated`);
                }
            } else {
                alertEl.innerHTML = "";
            }
            attachListeners(data, mainEl);
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
            
            // Clean render — ensure skeleton is fully replaced
            mainEl.innerHTML = renderHeader(data) + renderWeatherCardSkeleton() + renderGrid(data) + renderWaterBudget() + renderCropTimeline(data.zones);
            
            attachListeners(data, mainEl);
            initWeatherCard();
            
            if (window.lucide) window.lucide.createIcons();
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
    const farmerName = store.getState('currentFarmer')?.name || t('fallback_farmer') || 'Farmer';
    const hour = new Date().getHours();
    let timeOfDay = 'evening';
    if (hour < 12) timeOfDay = 'morning';
    else if (hour < 18) timeOfDay = 'afternoon';

    const zones = data.zones || [];
    const lastSyncTime = data.last_sync || new Date().toISOString();
    const minsAgo = Math.floor((new Date() - new Date(lastSyncTime)) / 60000);

    let isCritical = false;
    let isWarning = false;
    let activeZoneCount = 0;
    
    zones.forEach(z => {
        if (z.moisture_pct < 15) isCritical = true;
        else if (z.moisture_pct < 25) isWarning = true;
        if (z.moisture_pct < 40) activeZoneCount++; 
    });
    
    const sysStatus = isCritical ? 'critical' : (isWarning ? 'dry' : 'optimal');
    const statusClass = isCritical ? 'text-red-400' : (isWarning ? 'text-amber-400' : 'text-emerald-400');
    const glowClass = isCritical ? 'shadow-red-500/20' : (isWarning ? 'shadow-amber-500/20' : 'shadow-emerald-500/20');
    
    const sparklineSvg = `<svg class="w-full h-8" preserveAspectRatio="none" viewBox="0 0 100 20">
        <polyline points="0,15 15,10 30,12 45,5 60,8 75,2 100,6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
    </svg>`;

    return `
        <div class="relative mb-12">
            <!-- Fluid Header -->
            <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
                <div class="space-y-1">
                    <h1 class="ks-text-fluid-lg tracking-tight text-white font-display">
                        <span class="text-slate-500 font-medium">${t('greeting_' + timeOfDay) || 'Good ' + timeOfDay},</span> ${farmerName}.
                    </h1>
                    <div class="flex items-center gap-2 text-slate-400 font-medium text-xs md:text-sm">
                        <span class="w-2 h-2 rounded-full ${isCritical ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse"></span>
                        <span data-i18n="farm_is">System is</span> 
                        <span class="${statusClass} font-bold uppercase tracking-widest">${t('sys_status_' + sysStatus) || sysStatus}</span>.
                        <span class="mx-2 text-slate-700">|</span>
                        <span>Auto-Sync ${minsAgo}m ago</span>
                    </div>
                </div>
                
                <div class="flex items-center gap-3 w-full lg:w-auto">
                    <button id="add-zone-btn" class="flex-1 lg:flex-none btn-elite flex items-center justify-center gap-2">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        <span>Register Plot</span>
                    </button>
                    <button id="dash-refresh-btn" class="p-3 glass-panel hover:bg-slate-700/50 transition-all border-slate-700/50 group" title="Refresh Live Data">
                        <i data-lucide="refresh-cw" class="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors"></i>
                    </button>
                </div>
            </div>

            <!-- Elite Bento Grid (Responsive) -->
            <div class="ks-grid md:ks-grid-4 lg:ks-grid-4 gap-4">
                
                <!-- Main Metric: Water Saved -->
                <div class="ks-card glass-panel md:col-span-2 lg:col-span-2 p-6 border-l-4 border-l-emerald-500 ${glowClass}">
                    <div class="flex items-start justify-between mb-8">
                        <div class="p-2 bg-emerald-500/10 rounded-lg">
                            <i data-lucide="droplets" class="w-6 h-6 text-emerald-400"></i>
                        </div>
                        <div class="w-24 text-emerald-400">${sparklineSvg}</div>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Water Intelligence (L)</p>
                        <div class="text-5xl font-black text-white font-display tracking-tighter flex items-baseline gap-2">
                            <span data-countup="${data.summary?.litres_saved || 2450}">0</span>
                            <span class="text-sm text-emerald-500/60 uppercase font-mono">SAVED TODAY</span>
                        </div>
                    </div>
                </div>

                <!-- Secondary Metric: Active Zones -->
                <div class="ks-card glass-panel p-6 border-l-4 border-l-blue-500 shadow-blue-500/10">
                    <div class="flex items-start justify-between mb-8">
                        <div class="p-2 bg-blue-500/10 rounded-lg">
                            <i data-lucide="sprout" class="w-6 h-6 text-blue-400"></i>
                        </div>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Active Plots</p>
                        <div class="text-4xl font-black text-white font-display">
                            <span data-countup="${activeZoneCount}">0</span>
                        </div>
                        <p class="text-[9px] font-bold text-blue-400/60 mt-2 uppercase tracking-widest">Growth in progress</p>
                    </div>
                </div>

                <!-- Status Card -->
                <div class="ks-card glass-panel p-6 border-l-4 border-l-emerald-500">
                    <div class="flex items-start justify-between mb-8">
                        <div class="p-2 bg-emerald-500/10 rounded-lg">
                            <i data-lucide="activity" class="w-6 h-6 text-emerald-400"></i>
                        </div>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Simulation State</p>
                        <div class="text-3xl font-black text-white font-display uppercase tracking-tight">
                            Healthy
                        </div>
                        <p class="text-[9px] font-bold text-slate-500 mt-2 uppercase tracking-widest">v2.4.0 Engine</p>
                    </div>
                </div>

                <!-- AI Insights Row -->
                <div class="ks-card glass-panel md:col-span-2 lg:col-span-4 p-5 flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-800/20">
                    <div class="flex items-center gap-5">
                        <div class="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                            <i data-lucide="brain" class="w-6 h-6 text-emerald-400"></i>
                        </div>
                        <div>
                            <h4 class="text-lg font-bold text-white font-display">Neural Intelligence Active</h4>
                            <p class="text-xs text-slate-500 font-medium">Analyzing 14 active parameters for irrigation optimization.</p>
                        </div>
                    </div>
                    <div class="flex gap-2 w-full md:w-auto">
                        <div class="badge-elite badge-success text-[10px]">AI MODEL: STABLE</div>
                        <div class="badge-elite badge-success text-[10px]">ACCURACY: 98.4%</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderGrid(data) {
    const grid = document.createElement('div');
    grid.className = "ks-grid md:ks-grid-2 lg:ks-grid-4 gap-6";
    
    data.zones.forEach(z => {
        const moisture = z.moisture_pct || 0;
        const card = createSensorCard({
            title: z.name,
            icon: "sprout",
            value: moisture,
            unit: "%",
            badgeType: moisture < 20 ? 'dry' : 'ok',
            badgeText: moisture < 20 ? t('dash_dry') : t('dash_optimal'),
            children: `<p class="text-[10px] font-black text-slate-500 mt-4 uppercase tracking-widest border-t border-slate-700/50 pt-3">MODBUS NODE ID: ${z.id.slice(0,8)}</p>`
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
    const crops = [
        { id: 'tomato',       label: 'Tomato',       emoji: '🍅' },
        { id: 'grape',        label: 'Grape',        emoji: '🍇' },
        { id: 'onion',        label: 'Onion',        emoji: '🧅' },
        { id: 'pomegranate',  label: 'Pomegranate',  emoji: '🍎' },
        { id: 'chilli',       label: 'Chilli',       emoji: '🌶️' },
        { id: 'wheat',        label: 'Wheat',        emoji: '🌾' },
        { id: 'cotton',       label: 'Cotton',       emoji: '🌿' },
        { id: 'sugarcane',    label: 'Sugarcane',    emoji: '🎋' },
        { id: 'soybean',      label: 'Soybean',      emoji: '🫘' },
        { id: 'rice',         label: 'Rice',         emoji: '🍚' },
        { id: 'maize',        label: 'Maize',        emoji: '🌽' },
        { id: 'banana',       label: 'Banana',       emoji: '🍌' },
    ];

    return `
        <div class="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <!-- Elite Hero Onboarding -->
            <div class="flex flex-col items-center justify-center py-20 glass-panel border-dashed border-slate-700/50 relative overflow-hidden">
                <div class="absolute inset-0 opacity-[0.05] pointer-events-none" style="background-image: url('data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'80\\' height=\\'80\\'><text y=\\'50\\' font-size=\\'40\\'>🌱</text></svg>');"></div>
                
                <div class="relative mb-8">
                    <div class="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 relative z-10">
                        <span class="text-5xl animate-bounce">🌾</span>
                    </div>
                    <div class="absolute inset-0 blur-3xl bg-emerald-500/20 rounded-full"></div>
                </div>

                <h2 class="text-3xl font-black text-white mb-3 text-center font-display tracking-tight">
                    Architect Your <span class="text-emerald-500">Digital Eden</span>
                </h2>
                <p class="text-slate-400 mb-8 text-center max-w-sm px-6 font-medium leading-relaxed">
                    Synchronize your physical farm with our real-time AI simulation engine.
                </p>
                
                <button id="rescue-demo-btn" 
                        class="btn-elite px-8 py-3.5 flex items-center gap-3">
                    <i data-lucide="zap" class="w-5 h-5"></i>
                    <span>Initialize Elite Twin</span>
                </button>
            </div>

            <!-- Responsive Crop Selector -->
            <div class="ks-card glass-panel p-8">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h3 class="text-xl font-bold text-white font-display mb-1">
                            🌱 Register Digital Plot
                        </h3>
                        <p class="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">
                            Select botanical profile to begin
                        </p>
                    </div>
                </div>
                
                <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3 mb-10" id="crop-grid">
                    ${crops.map(c => `
                        <button class="crop-btn flex flex-col items-center gap-2 p-4 rounded-2xl glass-panel border-transparent hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
                                data-crop="${c.id}" data-label="${c.label}">
                            <span class="text-2xl group-hover:scale-125 transition-transform duration-300 transform-gpu">${c.emoji}</span>
                            <span class="text-[9px] font-black text-slate-500 uppercase tracking-wider group-hover:text-emerald-400 transition-colors">${c.label}</span>
                        </button>
                    `).join('')}
                </div>

                <!-- Adaptive Registration Form -->
                <div id="zone-form" class="hidden animate-in zoom-in-95 duration-500">
                    <div class="bg-slate-800/40 rounded-3xl p-8 border border-white/5 relative overflow-hidden">
                        <div class="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                             <i data-lucide="layout" class="w-32 h-32 text-emerald-500"></i>
                        </div>

                        <div class="flex items-center gap-4 mb-8 relative z-10">
                            <span id="selected-emoji" class="text-5xl drop-shadow-2xl">🌱</span>
                            <div>
                                <p class="text-2xl font-black text-white font-display" id="selected-label">Select a crop</p>
                                <p class="text-xs text-slate-500 font-medium">Configure plot parameters for AI calibration.</p>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 relative z-10">
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Designation</label>
                                <input id="zone-name-input" type="text" placeholder="e.g. North Field A"
                                       class="w-full px-5 py-3.5 rounded-xl bg-slate-900/50 border border-slate-700/50 text-white font-bold focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all">
                            </div>
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Dimension (sq.m)</label>
                                <input id="zone-area-input" type="number" placeholder="5000" value="5000"
                                       class="w-full px-5 py-3.5 rounded-xl bg-slate-900/50 border border-slate-700/50 text-white font-bold focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all">
                            </div>
                        </div>

                        <div class="mb-10 relative z-10">
                            <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 block mb-4">Biological Phase</label>
                            <div class="flex flex-wrap gap-3" id="stage-selector">
                                ${['Seedling', 'Vegetative', 'Flowering', 'Fruiting', 'Harvesting'].map(s => `
                                    <button class="stage-btn px-4 py-2 rounded-xl text-xs font-black border border-slate-700/50 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all uppercase tracking-widest"
                                            data-stage="${s.toLowerCase()}">${s}</button>
                                `).join('')}
                            </div>
                        </div>

                        <button id="create-zone-btn" class="btn-elite w-full justify-center py-4 text-sm flex items-center gap-3">
                            <i data-lucide="plus-circle" class="w-5 h-5"></i>
                            <span>Register Digital Plot</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function syncDashboardFromState(mainEl) {
    // Only re-render if the mainContent is still in the DOM
    if (!document.body.contains(mainEl)) return;

    const data = store.getState('currentFarmDashboard'); 
    if (data) {
        try {
            mainEl.innerHTML = renderHeader(data) + renderWeatherCardSkeleton() + renderGrid(data) + renderWaterBudget() + renderCropTimeline(data.zones);
            initWeatherCard();
            if (window.lucide) window.lucide.createIcons();
        } catch (e) {
            console.warn('[Dashboard] Sync failed:', e.message);
        }
    }
}

function renderWaterBudget() {
    // 1. Circular Progress Gauge Setup
    const budget = 5000;
    const used = 2840; // Simulated for MVP
    const pct = Math.min(100, Math.round((used / budget) * 100));
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (pct / 100) * circumference;
    let arcColor = '#22c55e'; // ks-green
    if (pct >= 60 && pct <= 85) arcColor = '#f59e0b';
    else if (pct > 85) arcColor = '#ef4444';

    // 2. 7-day Bar chart (SVG)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0, Sun=6
    const mockedData = [350, 420, 290, 510, 480, 200, 590]; // 7 items
    const maxVal = 700;
    const dailyTarget = 500;
    
    let barsHtml = '';
    const svgW = 280;
    const svgH = 100;
    const barW = Math.floor(svgW / 7) - 10;
    
    mockedData.forEach((val, i) => {
        const h = (val / maxVal) * svgH;
        let color = '#dcfce7'; 
        let opacity = '0.7';
        if (i === todayIdx) {
            color = '#1a7a4a'; // ks-green
            opacity = '1.0';
        } else if (val > dailyTarget) {
            color = '#f59e0b';
        }
        const x = i * (barW + 10) + 5;
        const y = svgH - h;
        barsHtml += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="4" fill="${color}" opacity="${opacity}" ${i === todayIdx ? 'filter="drop-shadow(0 0 4px rgba(26,122,74,0.4))"' : ''} />
            <text x="${x + barW/2}" y="${svgH + 15}" fill="#9ca3af" font-size="10" font-weight="bold" font-family="'DM Mono', monospace" text-anchor="middle">${days[i]}</text>
        `;
    });
    
    const targetY = svgH - (dailyTarget / maxVal) * svgH;
    barsHtml += `<line x1="0" y1="${targetY}" x2="${svgW}" y2="${targetY}" stroke="#1a7a4a" stroke-dasharray="4" stroke-width="1.5" opacity="0.4" />
        <text x="${svgW - 20}" y="${targetY - 5}" fill="#1a7a4a" font-size="9" font-weight="bold" font-family="'DM Mono', monospace" opacity="0.6">TARGET</text>`;

    return `
        <div class="mt-8 mb-4">
            <h2 class="text-xl font-extrabold text-gray-900 mb-4" data-i18n="budget_title" style="font-family: var(--font-display);">${t('budget_title')}</h2>
            <div class="ks-card p-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-white border border-gray-100 shadow-sm">
                
                <!-- Circular Gauge (span 4) -->
                <div class="md:col-span-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100 pb-6 md:pb-0">
                    <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4"><span data-i18n="budget_weekly_limit">${t('budget_weekly_limit')}</span> ${budget}L</p>
                    <div class="relative w-32 h-32 flex items-center justify-center">
                        <svg class="transform -rotate-90 w-32 h-32">
                            <circle cx="64" cy="64" r="45" stroke="#f3f4f6" stroke-width="12" fill="none" />
                            <circle cx="64" cy="64" r="45" stroke="${arcColor}" stroke-width="12" fill="none" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round" class="transition-all duration-1000 ease-out" />
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center pt-1" style="font-family: var(--font-mono);">
                            <span class="text-2xl font-black text-gray-900 leading-none">${used}L</span>
                            <span class="text-[10px] font-bold text-gray-400 mt-1 uppercase" data-i18n="budget_used_of">${t('budget_used_of')}</span>
                        </div>
                    </div>
                    <p class="text-xs font-bold text-gray-500 mt-4"><span class="text-gray-900">${pct}%</span> <span data-i18n="budget_of_weekly">${t('budget_of_weekly')}</span></p>
                </div>

                <!-- 7-Day Graph (span 8) -->
                <div class="md:col-span-8 flex justify-center">
                    <div class="flex flex-col mb-6 mr-6">
                        <p class="text-sm font-bold text-[var(--ks-green)] flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100/50 inline-flex">
                            <i data-lucide="leaf" class="w-4 h-4"></i> <span data-i18n="budget_saved_vs_manual">${t('budget_saved_vs_manual')}</span> 1,200L <span data-i18n="budget_vs_manual_end">${t('budget_vs_manual_end')}</span>
                        </p>
                        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 ml-1" style="font-family: var(--font-mono);"><span data-i18n="budget_manual_baseline">${t('budget_manual_baseline')}</span> 280L/day × zones</p>
                    </div>
                    
                    <div class="flex justify-center w-[280px]">
                        <svg width="${svgW}" height="${svgH + 20}" viewBox="0 0 ${svgW} ${svgH + 20}" style="overflow:visible;">
                            ${barsHtml}
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderCropTimeline(zones) {
    if (!zones || zones.length === 0) return '';
    
    const stages = [
        { key: 'crop_stage_sowing', emoji: '🟤' },
        { key: 'crop_stage_germination', emoji: '🌱' },
        { key: 'crop_stage_vegetative', emoji: '🌿' },
        { key: 'crop_stage_flowering', emoji: '🌸' },
        { key: 'crop_stage_harvest', emoji: '🌾' }
    ];

    let html = `
        <div class="mt-8 mb-4">
            <h2 class="text-xl font-extrabold text-gray-900 mb-4" data-i18n="timeline_title" style="font-family: var(--font-display);">${t('timeline_title')}</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    `;

    zones.forEach(zone => {
        const stageString = (zone.crop_stage || 'vegetative').toLowerCase();
        let currentIndex = 2; // Default vegetative 
        if (stageString.includes('sow')) currentIndex = 0;
        else if (stageString.includes('germ')) currentIndex = 1;
        else if (stageString.includes('flower')) currentIndex = 3;
        else if (stageString.includes('harvest')) currentIndex = 4;

        // Mock Days values based on mock logic (zone.id hashed)
        let idHash = 10;
        if (zone.id) {
            idHash = 0;
            for (let i = 0; i < zone.id.length; i++) idHash += zone.id.charCodeAt(i);
        }
        const daysIn = idHash % 14 + 1;
        const daysNext = 21 - daysIn;

        html += `
            <div class="ks-card p-5 bg-white border border-gray-100 shadow-sm relative overflow-hidden">
                <div class="absolute -right-6 -top-6 text-6xl opacity-5">${stages[currentIndex].emoji}</div>
                <h3 class="font-bold text-gray-900 text-sm mb-1 uppercase tracking-wider" style="font-family: var(--font-display);">${zone.name}</h3>
                
                <div class="flex items-center gap-2 mt-4 mb-5">
                    <span class="text-3xl">${stages[currentIndex].emoji}</span>
                    <div>
                        <p class="font-black text-[var(--ks-green)] text-lg leading-tight" data-i18n="${stages[currentIndex].key}">${t(stages[currentIndex].key)}</p>
                        <p class="text-xs font-bold text-gray-400 font-mono tracking-tight mt-0.5">${daysIn} <span data-i18n="timeline_days_in">${t('timeline_days_in')}</span></p>
                    </div>
                </div>

                <!-- Timeline dots -->
                <div class="flex items-center w-full justify-between relative mt-6 mb-2 z-10">
                    <div class="absolute left-3 right-3 h-1 bg-gray-100 top-2.5 -z-10 rounded-full"></div>
                    <div class="absolute left-3 h-1 bg-[var(--ks-green)] top-2.5 -z-10 rounded-full transition-all" style="width: ${(currentIndex/4)*100}%"></div>
                    
                    ${stages.map((stage, idx) => {
                        const isPast = idx < currentIndex;
                        const isCurrent = idx === currentIndex;
                        let dotClasses = 'w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white text-[10px] ';
                        if (isCurrent) {
                            dotClasses += 'border-[var(--ks-green)] bg-[var(--ks-green)] text-white shadow-[0_0_0_4px_rgba(26,122,74,0.2)] animate-pulse';
                        } else if (isPast) {
                            dotClasses += 'border-[var(--ks-green)] border-solid text-[var(--ks-green)]';
                        } else {
                            dotClasses += 'border-gray-200 border-dashed text-gray-300';
                        }
                        
                        return `
                            <div class="relative group cursor-help flex flex-col items-center">
                                <div class="${dotClasses}">
                                    ${isPast ? '✓' : ''}
                                </div>
                                <span class="absolute -bottom-6 text-[9px] font-bold uppercase tracking-widest ${isCurrent ? 'text-[var(--ks-green)]' : 'text-gray-400 opacity-0 md:group-hover:opacity-100'} transition-opacity whitespace-nowrap bg-white px-1" data-i18n="${stage.key}">${t(stage.key)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div class="mt-6 pt-3 border-t border-gray-100 flex justify-between items-center bg-gray-50/50 -mx-5 px-5 -mb-5 pb-4">
                    <span class="text-[10px] font-bold text-gray-400 uppercase" data-i18n="timeline_today">${t('timeline_today')}</span>
                    ${currentIndex < 4 ? `<span class="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase tracking-widest">${daysNext} <span data-i18n="timeline_days_next">${t('timeline_days_next')}</span></span>` : `<span class="text-[10px] font-black text-[var(--ks-green)] uppercase">READY</span>`}
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;
    return html;
}

function renderWeatherCardSkeleton() {
    return `<div id="ks-weather-card" class="mb-6 ks-card p-5 bg-[#0f1e14] text-white rounded-3xl relative overflow-hidden transition-all duration-500 min-h-[160px] flex items-center justify-center">
        <div class="animate-pulse flex flex-col items-center gap-2">
            <div class="h-8 w-8 rounded-full bg-white/10"></div>
            <div class="h-4 w-32 bg-white/10 rounded"></div>
        </div>
    </div>`;
}

async function initWeatherCard() {
    const container = document.getElementById('ks-weather-card');
    if (!container) return;
    
    const CACHE_KEY = 'ks_weather_cache';
    const CACHE_TIME = 30 * 60 * 1000;
    
    let weatherData = null;
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.ts < CACHE_TIME) {
                weatherData = parsed.data;
            }
        }
        
        if (!weatherData) {
            weatherData = {
                temp: 31,
                humidity: 68,
                wind: 12,
                condition: 'Clouds',
                probRain: 40,
                forecast: [
                    { dayKey: 'weather_today', tempHi: 32, tempLo: 22, icon: '⛅' },
                    { dayKey: 'weather_tomorrow', tempHi: 29, tempLo: 21, icon: '🌧️', prob: 40 },
                    { dayKey: 'weather_day_after', tempHi: 31, tempLo: 20, icon: '☀️' }
                ]
            };
            try { await new Promise(r => setTimeout(r, 600)); } catch(e) {}
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: weatherData }));
        }
    } catch(e) {}

    if(weatherData) {
        const advHtml = weatherData.probRain > 30 ? `
            <div class="mt-5 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-700">
                <p class="text-xs text-amber-300 font-bold flex items-center gap-2">
                    <i data-lucide="droplets" class="w-4 h-4"></i>
                    <span data-i18n="weather_ai_advisory">${t('weather_ai_advisory')}</span>
                </p>
            </div>
        ` : '';

        container.className = "mb-6 ks-card p-6 bg-[#0f1e14] text-white rounded-3xl relative overflow-hidden shadow-2xl transition-all duration-500 animate-in fade-in";
        container.innerHTML = `
            <div class="absolute -right-10 -top-10 text-9xl opacity-5 pointer-events-none">☁️</div>
            
            <h2 class="text-sm font-black text-green-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <i data-lucide="cloud-sun" class="w-5 h-5"></i>
                <span data-i18n="weather_intelligence">${t('weather_intelligence')}</span>
            </h2>

            <div class="flex flex-col lg:flex-row justify-between gap-8">
                <!-- Left: Current -->
                <div class="flex items-center gap-6">
                    <div class="text-6xl text-white tracking-tight" style="font-family: var(--font-display);">${weatherData.temp}°C</div>
                    <div class="flex flex-col">
                        <span class="text-lg font-bold text-white mb-1" data-i18n="weather_partly_cloudy">${t('weather_partly_cloudy')}</span>
                        <div class="flex items-center gap-3 text-xs text-green-100/70 font-mono">
                            <span class="flex items-center gap-1"><i data-lucide="droplets" class="w-3 h-3"></i> <span data-i18n="weather_humidity">${t('weather_humidity')}</span> ${weatherData.humidity}%</span>
                            <span class="flex items-center gap-1"><i data-lucide="wind" class="w-3 h-3"></i> <span data-i18n="weather_wind">${t('weather_wind')}</span> ${weatherData.wind} km/h NE</span>
                        </div>
                    </div>
                </div>

                <!-- Right: Forecast strip -->
                <div class="flex gap-3 overflow-x-auto pb-2 lg:pb-0 no-scrollbar items-center">
                    ${weatherData.forecast.map(f => `
                        <div class="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center min-w-[80px]">
                            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2" data-i18n="${f.dayKey}">${t(f.dayKey)}</span>
                            <span class="text-2xl mb-1">${f.icon}</span>
                            <span class="text-xs font-bold font-mono"><span class="text-white">${f.tempHi}°</span> <span class="text-gray-500">${f.tempLo}°</span></span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ${advHtml}
        `;
        if (window.lucide) window.lucide.createIcons();
    }
}
