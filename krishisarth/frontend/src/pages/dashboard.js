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
    
    const sparklineSvg = `<svg class="w-full h-8" preserveAspectRatio="none" viewBox="0 0 100 20">
        <polyline points="0,15 15,10 30,12 45,5 60,8 75,2 100,6" fill="none" stroke="var(--emerald-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
    </svg>`;

    return `
        <div class="relative mb-12 stagger-in">
            <!-- Fluid Header -->
            <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
                <div class="space-y-1">
                    <h1 class="text-4xl md:text-5xl tracking-tight text-white font-display font-black">
                        <span class="text-slate-500 font-medium">${t('greeting_' + timeOfDay) || 'Good ' + timeOfDay},</span> ${farmerName}.
                    </h1>
                    <div class="flex items-center gap-2 text-slate-400 font-medium text-xs md:text-sm">
                        <span class="w-2 h-2 rounded-full ${isCritical ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-emerald-500 shadow-[0_0_10px_#10b981]'} animate-pulse"></span>
                        <span data-i18n="farm_is">SYSTEM STATE:</span> 
                        <span class="${statusClass} font-black uppercase tracking-widest">${t('sys_status_' + sysStatus) || sysStatus}</span>
                        <span class="mx-2 text-slate-700">|</span>
                        <span class="font-mono text-[10px] uppercase opacity-60">Last Sync: ${minsAgo}m ago</span>
                    </div>
                </div>
                
                <div class="flex items-center gap-3 w-full lg:w-auto">
                    <button id="add-zone-btn" class="flex-1 lg:flex-none btn-emerald flex items-center justify-center gap-2">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        <span>Register Plot</span>
                    </button>
                    <button id="dash-refresh-btn" class="p-3 glass-hud hover:bg-slate-700/50 transition-all border-white/5 rounded-xl group" title="Refresh Live Data">
                        <i data-lucide="refresh-cw" class="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors"></i>
                    </button>
                </div>
            </div>

            <!-- Premium Hero Banner -->
            <div class="relative w-full h-[450px] rounded-[3rem] overflow-hidden mb-12 glass-hud border-emerald-500/10 shadow-[0_40px_100px_rgba(0,0,0,0.6)] animate-in zoom-in duration-1000">
                <img src="./assets/images/hero.png" class="absolute inset-0 w-full h-full object-cover transition-transform duration-[30s] linear animate-slow-zoom opacity-60" alt="Smart Farm Hero">
                <div class="absolute inset-0 bg-gradient-to-t from-[#0a0f0d] via-[#0a0f0d]/60 to-transparent"></div>
                
                <div class="absolute inset-0 p-10 md:p-16 flex flex-col justify-end">
                    <div class="flex flex-col md:flex-row justify-between items-end gap-10">
                        <div class="max-w-3xl">
                            <div class="flex items-center gap-4 mb-8">
                                <div class="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                    <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]"></div>
                                    <span class="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Neural Synchronicity Active</span>
                                </div>
                                <span class="text-white/30 text-[10px] font-black uppercase tracking-[0.2em] font-mono">Node_Link: 0x8F2C</span>
                            </div>
                            <h3 class="text-6xl md:text-8xl font-black text-white font-display tracking-tighter leading-[0.85] mb-6">
                                THE <span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">NEURAL</span> <br/>HARVEST
                            </h3>
                            <p class="text-slate-400 text-sm md:text-xl font-medium opacity-80 leading-relaxed max-w-xl">
                                Our real-time simulation engine is processing agricultural telemetry with <span class="text-emerald-400 font-bold">99.2% fidelity</span>.
                            </p>
                        </div>
                        
                        <div class="hidden lg:flex flex-col items-end space-y-8 glass-hud p-10 rounded-[2.5rem] border-white/5 bg-black/40 backdrop-blur-3xl">
                             <div class="flex items-center gap-8">
                                 <div class="text-right">
                                     <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Model Confidence</p>
                                     <p class="text-5xl font-black text-white font-display tracking-tighter">99.2%</p>
                                 </div>
                                 <div class="w-20 h-20 rounded-full border-2 border-emerald-500/10 flex items-center justify-center relative">
                                     <div class="absolute inset-0 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin duration-[4s]"></div>
                                     <i data-lucide="brain-circuit" class="w-10 h-10 text-emerald-400"></i>
                                 </div>
                             </div>
                             <div class="w-64 h-2 bg-white/5 rounded-full overflow-hidden">
                                 <div class="h-full bg-emerald-500 w-[99%] shadow-[0_0_20px_#10b981]"></div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Dashboard Stats Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <!-- Water metric -->
                <div class="elite-card p-6 flex flex-col justify-between min-h-[160px]">
                    <div class="flex justify-between items-start mb-4">
                        <div class="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <i data-lucide="droplets" class="w-5 h-5 text-emerald-400"></i>
                        </div>
                        <div class="text-emerald-500/30 w-16">${sparklineSvg}</div>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Water Optimization</p>
                        <div class="text-3xl font-black text-white font-display flex items-baseline gap-2">
                            <span data-countup="${data.summary?.litres_saved || 2450}">0</span>
                            <span class="text-xs text-emerald-500/60 uppercase font-mono">L saved</span>
                        </div>
                    </div>
                </div>

                <!-- Active Zones -->
                <div class="elite-card p-6 flex flex-col justify-between min-h-[160px]">
                    <div class="flex justify-between items-start mb-4">
                        <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <i data-lucide="sprout" class="w-5 h-5 text-blue-400"></i>
                        </div>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Managed Plots</p>
                        <div class="text-3xl font-black text-white font-display">
                            <span data-countup="${data.zones.length}">0</span>
                        </div>
                        <p class="text-[9px] font-black text-blue-400/60 mt-2 uppercase tracking-widest">Growth phase sync ok</p>
                    </div>
                </div>

                <!-- AI Efficiency -->
                <div class="elite-card p-6 flex flex-col justify-between min-h-[160px]">
                    <div class="flex justify-between items-start mb-4">
                        <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <i data-lucide="cpu" class="w-5 h-5 text-purple-400"></i>
                        </div>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Prediction Core</p>
                        <div class="text-3xl font-black text-white font-display">
                            88.4%
                        </div>
                        <p class="text-[9px] font-black text-purple-400/60 mt-2 uppercase tracking-widest">Efficiency index</p>
                    </div>
                </div>

                <!-- Uptime -->
                <div class="elite-card p-6 flex flex-col justify-between min-h-[160px]">
                    <div class="flex justify-between items-start mb-4">
                        <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <i data-lucide="zap" class="w-5 h-5 text-amber-400"></i>
                        </div>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Hardware Health</p>
                        <div class="text-3xl font-black text-white font-display">
                            100%
                        </div>
                        <p class="text-[9px] font-black text-amber-400/60 mt-2 uppercase tracking-widest">All sensors responding</p>
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
            <div class="flex flex-col items-center justify-center py-20 glass-panel border-white/5 relative overflow-hidden min-h-[500px]">
                <!-- Background Image Layer -->
                <img src="./assets/images/digital_twin.png" class="absolute inset-0 w-full h-full object-cover opacity-[0.15] mix-blend-overlay pointer-events-none" alt="">
                <div class="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0f12]/50 to-[#0a0f12] pointer-events-none"></div>
                
                <div class="relative z-10 text-center px-6 max-w-2xl stagger-in" style="animation-delay: 200ms">
                    <h2 class="text-5xl md:text-7xl font-black text-white mb-6 font-display tracking-tighter leading-none">
                        ARCHITECT YOUR <br/> <span class="text-emerald-500">DIGITAL EDEN</span>
                    </h2>
                    <p class="text-slate-400 mb-12 text-lg font-medium leading-relaxed opacity-70">
                        Our real-time simulation engine is ready to synchronize with your physical infrastructure. Begin your automated harvest cycle.
                    </p>
                    
                    <button id="rescue-demo-btn" 
                            class="btn-emerald px-12 py-5 flex items-center gap-4 mx-auto text-lg shadow-[0_20px_50px_rgba(16,185,129,0.3)]">
                        <i data-lucide="zap" class="w-6 h-6"></i>
                        <span>INITIALIZE QUANTUM TWIN</span>
                    </button>
                </div>
            </div>

            <!-- Responsive Crop Selector -->
            <div class="elite-card p-10 stagger-in" style="animation-delay: 400ms">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
                    <div>
                        <h3 class="text-3xl font-black text-white font-display mb-2 tracking-tight">
                            🌱 REGISTER PLOT
                        </h3>
                        <p class="text-[10px] text-emerald-500/60 font-black uppercase tracking-[0.3em]">
                            SELECT BOTANICAL PROFILE TO BEGIN CALIBRATION
                        </p>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 mb-16" id="crop-grid">
                    ${crops.map(c => `
                        <button class="crop-btn flex flex-col items-center gap-4 p-6 rounded-[2rem] glass-hud border-transparent hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
                                data-crop="${c.id}" data-label="${c.label}">
                            <div class="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-3xl group-hover:scale-110 group-hover:bg-emerald-500/10 transition-all duration-500">
                                ${c.emoji}
                            </div>
                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-emerald-400 transition-colors">${c.label}</span>
                        </button>
                    `).join('')}
                </div>

                <!-- Adaptive Registration Form -->
                <div id="zone-form" class="hidden animate-in zoom-in-95 duration-700">
                    <div class="glass-hud rounded-[3rem] p-10 border-emerald-500/10 relative overflow-hidden bg-emerald-500/[0.02]">
                        <div class="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                             <i data-lucide="layout" class="w-48 h-48 text-emerald-500"></i>
                        </div>

                        <div class="flex items-center gap-6 mb-12 relative z-10">
                            <div class="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                                <span id="selected-emoji" class="text-5xl">🌱</span>
                            </div>
                            <div>
                                <p class="text-3xl font-black text-white font-display uppercase tracking-tight" id="selected-label">Select a crop</p>
                                <p class="text-sm text-slate-500 font-medium opacity-60">Configure plot telemetry parameters for neural calibration.</p>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 relative z-10">
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Plot Designation</label>
                                <input id="zone-name-input" type="text" placeholder="e.g. North Sector 7"
                                       class="w-full px-6 py-4 rounded-2xl bg-black/40 border border-white/5 text-white font-bold focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all">
                            </div>
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Coverage (sq.m)</label>
                                <input id="zone-area-input" type="number" placeholder="5000" value="5000"
                                       class="w-full px-6 py-4 rounded-2xl bg-black/40 border border-white/5 text-white font-bold focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all">
                            </div>
                        </div>

                        <div class="mb-12 relative z-10">
                            <label class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2 block mb-6">Active Biological Phase</label>
                            <div class="flex flex-wrap gap-4" id="stage-selector">
                                ${['Seedling', 'Vegetative', 'Flowering', 'Fruiting', 'Harvesting'].map(s => `
                                    <button class="stage-btn px-6 py-3 rounded-2xl text-[11px] font-black border border-white/5 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all uppercase tracking-[0.15em] bg-white/[0.02]"
                                            data-stage="${s.toLowerCase()}">${s}</button>
                                `).join('')}
                            </div>
                        </div>

                        <button id="create-zone-btn" class="btn-emerald w-full justify-center py-5 text-base flex items-center gap-4 shadow-[0_20px_40px_rgba(16,185,129,0.2)]">
                            <i data-lucide="plus-circle" class="w-6 h-6"></i>
                            <span>ACTIVATE DIGITAL PLOT</span>
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
    const budget = 5000;
    const used = 2840; 
    const pct = Math.min(100, Math.round((used / budget) * 100));
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (pct / 100) * circumference;
    let arcColor = '#10b981'; 
    if (pct >= 85) arcColor = '#ef4444';

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayIdx = (new Date().getDay() + 6) % 7; 
    const mockedData = [350, 420, 290, 510, 480, 200, 590]; 
    const maxVal = 700;
    
    let barsHtml = '';
    const svgW = 400;
    const svgH = 120;
    const barW = 32;
    
    mockedData.forEach((val, i) => {
        const h = (val / maxVal) * svgH;
        const x = i * (barW + 20) + 10;
        const y = svgH - h;
        const isToday = i === todayIdx;
        
        barsHtml += `
            <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="8" 
                  fill="${isToday ? '#10b981' : 'rgba(255,255,255,0.05)'}" 
                  class="transition-all duration-1000" />
            <text x="${x + barW/2}" y="${svgH + 20}" fill="${isToday ? '#10b981' : '#64748b'}" 
                  font-size="10" font-weight="900" text-anchor="middle" class="font-mono">${days[i]}</text>
        `;
    });

    return `
        <div class="mt-12 mb-8 stagger-in">
            <h2 class="text-2xl font-black text-white mb-6 font-display tracking-tight uppercase">
                <span class="text-emerald-500">Hydro</span> Intelligence
            </h2>
            <div class="elite-card p-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                
                <div class="lg:col-span-4 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-white/5 pb-10 lg:pb-0">
                    <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Weekly Flux (L/m²)</p>
                    <div class="relative w-48 h-48 flex items-center justify-center">
                        <svg class="transform -rotate-90 w-48 h-48">
                            <circle cx="96" cy="96" r="80" stroke="rgba(255,255,255,0.03)" stroke-width="12" fill="none" />
                            <circle cx="96" cy="96" r="80" stroke="${arcColor}" stroke-width="12" fill="none" 
                                    stroke-dasharray="502.4" stroke-dashoffset="${502.4 - (pct/100)*502.4}" 
                                    stroke-linecap="round" class="transition-all duration-1000 shadow-[0_0_20px_#10b981]" />
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center pt-2">
                            <span class="text-4xl font-black text-white font-display">${used}L</span>
                            <span class="text-[10px] font-black text-emerald-500/60 mt-1 uppercase tracking-widest">Utilized</span>
                        </div>
                    </div>
                </div>

                <div class="lg:col-span-8">
                    <div class="flex justify-between items-center mb-8">
                        <div>
                            <p class="text-xl font-bold text-white font-display">Daily Telemetry</p>
                            <p class="text-xs text-slate-500 font-medium opacity-60">Comparative water consumption per node sector.</p>
                        </div>
                        <div class="bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                            <span class="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Efficiency: +12%</span>
                        </div>
                    </div>
                    
                    <div class="flex justify-center lg:justify-start">
                        <svg width="100%" height="160" viewBox="0 0 400 160" class="max-w-md">
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
        <div class="mt-12 mb-8 stagger-in">
            <h2 class="text-2xl font-black text-white mb-6 font-display tracking-tight uppercase">
                <span class="text-emerald-500">Biological</span> Timeline
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    `;

    zones.forEach(zone => {
        const stageString = (zone.crop_stage || 'vegetative').toLowerCase();
        let currentIndex = 2; 
        if (stageString.includes('sow')) currentIndex = 0;
        else if (stageString.includes('germ')) currentIndex = 1;
        else if (stageString.includes('flower')) currentIndex = 3;
        else if (stageString.includes('harvest')) currentIndex = 4;

        html += `
            <div class="elite-card p-6 relative overflow-hidden group">
                <div class="absolute -right-10 -top-10 text-8xl opacity-5 group-hover:rotate-12 transition-transform duration-700">${stages[currentIndex].emoji}</div>
                <h3 class="font-black text-white text-[10px] mb-6 uppercase tracking-[0.3em] font-display">${zone.name}</h3>
                
                <div class="flex items-center gap-4 mb-8">
                    <div class="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-4xl shadow-inner">
                        ${stages[currentIndex].emoji}
                    </div>
                    <div>
                        <p class="font-black text-emerald-400 text-xl tracking-tight leading-none mb-1 uppercase" data-i18n="${stages[currentIndex].key}">${t(stages[currentIndex].key)}</p>
                        <p class="text-[9px] font-black text-slate-500 font-mono tracking-widest uppercase opacity-60">Phase Calibration Active</p>
                    </div>
                </div>

                <div class="flex items-center w-full justify-between relative mb-8 px-2">
                    <div class="absolute left-2 right-2 h-1 bg-white/5 top-[11px] rounded-full"></div>
                    <div class="absolute left-2 h-1 bg-emerald-500 top-[11px] rounded-full transition-all duration-1000 shadow-[0_0_10px_#10b981]" style="width: calc(${(currentIndex/4)*100}% - 4px)"></div>
                    
                    ${stages.map((stage, idx) => {
                        const isPast = idx < currentIndex;
                        const isCurrent = idx === currentIndex;
                        let dotClasses = 'w-6 h-6 rounded-full border-2 flex items-center justify-center bg-[#0a0f0d] text-[10px] relative z-10 transition-all duration-500 ';
                        if (isCurrent) {
                            dotClasses += 'border-emerald-500 bg-emerald-500 text-white shadow-[0_0_15px_#10b981] scale-125';
                        } else if (isPast) {
                            dotClasses += 'border-emerald-500 text-emerald-500';
                        } else {
                            dotClasses += 'border-white/10 text-slate-700';
                        }
                        
                        return `
                            <div class="relative flex flex-col items-center">
                                <div class="${dotClasses}">
                                    ${isPast ? '✓' : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div class="pt-4 border-t border-white/5 flex justify-between items-center">
                    <span class="text-[9px] font-black text-slate-600 uppercase tracking-widest">Node Sync Status</span>
                    <span class="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded uppercase tracking-widest">Optimal Range</span>
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
