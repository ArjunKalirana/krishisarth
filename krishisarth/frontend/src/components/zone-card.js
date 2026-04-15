import { store } from '../state/store.js';
import { startIrrigation, stopIrrigation } from '../api/control.js';
import { showToast } from './toast.js';
import { api } from '../api/client.js';

// Crop emoji map (Elite Palette)
const CROP_ICONS = {
    tomato: '🍅', grape: '🍇', onion: '🧅', pomegranate: '🍎',
    chilli: '🌶️', wheat: '🌾', rice: '🌾', cotton: '🌿',
    sugarcane: '🎋', soybean: '🫘', default: '🌱'
};

/**
 * ZoneCard Component (Elite Edition)
 * A high-fidelity control unit for real-time irrigation orchestration.
 */
export function createZoneCard({ id, name, lastIrrig, moisture, initialState = false, cropType = '' }) {
    const card = document.createElement('div');
    card.dataset.zoneId = id;
    card.className = "group stagger-in";

    const savedStates = store.getState('activeZoneStates') || {};
    let isOn          = savedStates[id]?.isOn ?? initialState;
    let activeDuration = savedStates[id]?.duration ?? 20;
    let isActMode      = false; 
    let moistureVal    = moisture || 0;
    
    // Live Hardware/ML Data
    let nVal = 0, pVal = 0, kVal = 0;
    let mlCrop = 'Thinking...';
    let mlFertLabel = 'Scanning...';
    let fertStatus = 'idle';

    const cropEmoji = CROP_ICONS[cropType?.toLowerCase()] || CROP_ICONS.default;

    const saveState = () => {
        const states = store.getState('activeZoneStates') || {};
        states[id] = { isOn, duration: activeDuration };
        store.setState('activeZoneStates', states);
    };

    const openProfileModal = () => {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-xl z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-300';
        
        const modal = document.createElement('div');
        modal.className = 'w-full max-w-xl bg-[#0a120e] rounded-3xl border border-white/10 shadow-3xl overflow-hidden animate-in zoom-in-95 duration-300';
        
        modal.innerHTML = `
            <div class="p-8 border-b border-white/5 flex justify-between items-center">
                <div>
                    <h2 class="text-2xl font-black text-white font-display">Soil Profile: ${name}</h2>
                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Configure high-precision ML inputs</p>
                </div>
                <button id="close-profile" class="text-slate-500 hover:text-white transition-colors">✕</button>
            </div>
            
            <form id="profile-form" class="p-8 grid grid-cols-2 gap-6">
                <div class="space-y-2">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Soil pH</label>
                    <input name="ph" type="number" step="0.1" value="6.5" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 outline-none">
                </div>
                <div class="space-y-2">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Elec. Conductivity (EC)</label>
                    <input name="ec" type="number" step="0.1" value="0.5" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 outline-none">
                </div>
                 <div class="space-y-2">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Organic Carbon (OC)</label>
                    <input name="oc" type="number" step="0.01" value="0.6" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 outline-none">
                </div>
                 <div class="space-y-2">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Sulfur (s) - ppm</label>
                    <input name="s" type="number" step="1" value="10" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 outline-none">
                </div>
                <div class="col-span-2 grid grid-cols-4 gap-4">
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-slate-500 uppercase">mn</label>
                        <input name="mn" type="number" step="0.1" value="2.0" class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-slate-500 uppercase">b</label>
                        <input name="b" type="number" step="0.1" value="0.5" class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-slate-500 uppercase">cu</label>
                        <input name="cu" type="number" step="0.1" value="0.2" class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-slate-500 uppercase">Mn</label>
                        <input name="Mn" type="number" step="0.1" value="2.0" class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs">
                    </div>
                </div>
                
                <div class="col-span-2 pt-4 border-t border-white/5">
                    <button type="submit" class="w-full py-4 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20">
                        Update Growth Logic
                    </button>
                </div>
            </form>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        modal.querySelector('#close-profile').onclick = () => overlay.remove();
        
        modal.querySelector('#profile-form').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            // Convert to floats
            for (let key in data) data[key] = parseFloat(data[key]);
            
            try {
                await api(`/zones/${id}/profile`, {
                    method: 'PATCH',
                    body: JSON.stringify(data)
                });
                showToast(`✅ Profile Synced: ML models recalibrated for ${name}`, 'success');
                overlay.remove();
            } catch (err) {
                showToast(err.message, 'error');
            }
        };
    };

    const updateUI = () => {
        const moistureColor = moistureVal < 25 ? '#f87171' : moistureVal < 45 ? '#fbbf24' : moistureVal > 70 ? '#60a5fa' : '#34d399';
        const moistureLabel = moistureVal < 25 ? 'Critical' : moistureVal < 45 ? 'Dry' : moistureVal > 70 ? 'Wet' : 'Optimal';
        const moistureBadge = moistureVal < 25 ? 'badge-danger' : moistureVal < 45 ? 'badge-warning' : moistureVal > 70 ? 'badge-info' : 'badge-success';

        card.innerHTML = `
            <div class="elite-card p-8 flex flex-col gap-8 h-full relative overflow-hidden transition-all duration-500 hover:border-emerald-500/40 bg-white/[0.01]">
                
                <div class="flex items-center justify-between pb-6 border-b border-white/5">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-2xl border border-white/5">
                            ${cropEmoji}
                        </div>
                        <div>
                            <h3 class="font-black text-white text-lg tracking-tight font-display">${name}</h3>
                            <div class="flex items-center gap-2">
                                <div class="w-1.5 h-1.5 rounded-full ${isActMode ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]' : 'bg-slate-600'}"></div>
                                <span class="text-[9px] font-black uppercase tracking-[0.2em] ${isActMode ? 'text-emerald-400' : 'text-slate-500'}">
                                    ${isActMode ? '⚡ ACT MODE' : '👁 VIEW MODE'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button class="profile-btn w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all" title="Soil Profile Settings">
                            <i data-lucide="settings-2" class="w-4 h-4"></i>
                        </button>
                        <button class="mode-toggle-btn px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border
                                       ${isActMode ? 'bg-white/5 text-slate-500 border-white/10 hover:text-white' 
                                                   : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'}"
                                data-zone-id="${id}">
                            ${isActMode ? 'VIEW' : 'ACT'}
                        </button>
                    </div>
                </div>

                <div class="flex items-center gap-8">
                    <div class="relative w-24 h-24 shrink-0">
                        <svg class="transform -rotate-90 w-24 h-24">
                            <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.03)" stroke-width="8" fill="none"/>
                            <circle cx="48" cy="48" r="40" 
                                stroke="${moistureColor}" stroke-width="8" fill="none"
                                stroke-dasharray="251.2"
                                stroke-dashoffset="${251.2 * (1 - moistureVal/100)}"
                                stroke-linecap="round"
                                class="transition-all duration-1000 ease-out shadow-[0_0_15px_${moistureColor}44]"/>
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <span class="active-moisture text-xl font-black text-white font-display">${Math.round(moistureVal)}%</span>
                        </div>
                    </div>
                    <div class="flex-1 space-y-4">
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hydration Index</span>
                            <span class="${moistureBadge} text-[9px] px-2 py-0.5 rounded-md border border-white/5">${moistureLabel}</span>
                        </div>
                        <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div class="h-full rounded-full transition-all duration-1000"
                                 style="width: ${moistureVal}%; background: ${moistureColor}"></div>
                        </div>
                    </div>
                </div>

                <div class="space-y-4 pt-4 border-t border-white/5">
                    <div class="flex justify-between items-center text-[10px] font-black uppercase text-slate-500 tracking-widest">
                        <span>Nutrient Profile (NPK)</span>
                        <span class="${fertStatus === 'active' ? 'text-emerald-400 animate-pulse' : ''}">${fertStatus === 'active' ? '💉 FERTIGATING' : '⏸ IDLE'}</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                        <div class="flex flex-col gap-1">
                            <span class="text-[8px] font-black uppercase text-slate-400">N ${nVal.toFixed(1)}</span>
                            <div class="h-1 bg-white/5 rounded-full"><div class="h-full bg-blue-500 transition-all duration-1000" style="width: ${Math.min((nVal/50)*100, 100)}%"></div></div>
                        </div>
                        <div class="flex flex-col gap-1">
                            <span class="text-[8px] font-black uppercase text-slate-400">P ${pVal.toFixed(1)}</span>
                            <div class="h-1 bg-white/5 rounded-full"><div class="h-full bg-purple-500 transition-all duration-1000" style="width: ${Math.min((pVal/50)*100, 100)}%"></div></div>
                        </div>
                        <div class="flex flex-col gap-1">
                            <span class="text-[8px] font-black uppercase text-slate-400">K ${kVal.toFixed(1)}</span>
                            <div class="h-1 bg-white/5 rounded-full"><div class="h-full bg-amber-500 transition-all duration-1000" style="width: ${Math.min((kVal/50)*100, 100)}%"></div></div>
                        </div>
                    </div>
                </div>
                
                <div class="flex items-center justify-between pb-2">
                    <div class="flex flex-col">
                        <span class="text-[8px] font-black uppercase text-slate-500 tracking-wider">ML Best Crop</span>
                        <span class="text-xs font-black capitalize text-emerald-400">${mlCrop}</span>
                    </div>
                    <div class="flex flex-col text-right">
                        <span class="text-[8px] font-black uppercase text-slate-500 tracking-wider">AI Soil Rating</span>
                        <span class="text-xs font-black uppercase text-emerald-400">${mlFertLabel}</span>
                    </div>
                </div>

                <div class="space-y-6 pt-6 border-t border-white/5 relative z-10 mt-auto">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Actuator State</p>
                            <span class="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2"
                                  style="color: ${isOn ? '#10b981' : '#64748b'}">
                                ${isOn ? '🟢 RUNNING' : '🔴 STOPPED'}
                            </span>
                        </div>
                        
                        <button class="toggle-btn w-16 h-8 rounded-full relative transition-all duration-500"
                                style="background: ${isOn ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${isOn ? '#10b981' : 'rgba(255,255,255,0.1)'};"
                                id="toggle-${id}">
                            <div class="absolute top-1 left-1 w-5.5 h-5.5 rounded-full transition-transform duration-500 shadow-2xl"
                                 style="transform: ${isOn ? 'translateX(32px)' : 'translateX(0)'}; background: ${isOn ? '#10b981' : '#475569'}"></div>
                        </button>
                    </div>

                    <div class="grid grid-cols-3 gap-3">
                        ${[10, 20, 30].map(dur => `
                            <button class="dur-btn flex-1 py-3 rounded-2xl font-black text-[10px] transition-all border border-white/5 uppercase tracking-widest ${activeDuration === dur ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-white/[0.02] text-slate-500 hover:text-slate-300'}"
                                    data-dur="${dur}">
                                ${dur} Min
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();
        
        const profileBtn = card.querySelector('.profile-btn');
        profileBtn.onclick = openProfileModal;

        const modeBtn = card.querySelector('.mode-toggle-btn');
        modeBtn?.addEventListener('click', async () => {
            const newMode = isActMode ? 'view' : 'act';
            modeBtn.disabled = true;
            try {
                await api(`/zones/${id}/mode`, {
                    method: 'PATCH',
                    body: JSON.stringify({mode: newMode})
                });
                isActMode = !isActMode;
                updateUI();
                showToast(isActMode ? `⚡ Actuator Primed: Manual control authorized` : `👁 View Sync: Remote override disabled`, isActMode ? 'success' : 'info');
            } catch(e) {
                showToast('Sync failure: ' + e.message, 'error');
            } finally {
                modeBtn.disabled = false;
            }
        });

        const toggle = card.querySelector(`#toggle-${id}`);
        if (!isActMode) {
            if (toggle) {
                toggle.onclick = () => {
                   showToast('⚠️ SAFETY LOCK: Switch to ACT MODE to authorize manual valve override.', 'warning');
                };
                toggle.style.opacity = '0.3';
                toggle.style.cursor = 'not-allowed';
            }
            card.querySelectorAll('.dur-btn').forEach(btn => {
                btn.onclick = () => {
                   showToast('⚠️ Control interface restricted in visualizer mode.', 'info');
                };
                btn.style.opacity = '0.3';
                btn.style.cursor = 'not-allowed';
            });
        } else {
            if (toggle) {
                toggle.onclick = async (e) => {
                    e.stopPropagation();
                    toggle.disabled = true;
                    try {
                        if (!isOn) {
                            await startIrrigation(id, activeDuration);
                            isOn = true;
                            saveState();
                            showToast(`VALVE ACTIVATED: Initiating ${activeDuration}min cycle`, 'success');
                        } else {
                            await stopIrrigation(id);
                            isOn = false;
                            saveState();
                            showToast(`VALVE SECURED: Flow terminated`, 'success');
                        }
                    } catch (err) {
                        showToast(`Hardware Fault: ${err.message}`, 'error');
                    } finally {
                        toggle.disabled = false;
                        updateUI();
                    }
                };
            }

            card.querySelectorAll('.dur-btn').forEach(btn => {
                btn.onclick = () => {
                    activeDuration = parseInt(btn.dataset.dur);
                    saveState();
                    updateUI();
                };
            });
        }
    };

    // Listen to real-time ML & Hardware WS emits
    document.addEventListener('hardware-update', (e) => {
        if (e.detail.zone_id === id) {
            // Update gauges
            moistureVal = e.detail.moisture_pct;
            nVal = e.detail.N || 0;
            pVal = e.detail.P || 0;
            kVal = e.detail.K || 0;
            
            mlCrop = e.detail.ml_crop || mlCrop;
            mlFertLabel = e.detail.ml_fertility?.label || mlFertLabel;
            
            // Auto Update Pump stats from hardware hook
            if (e.detail.pump_status === 'on') isOn = true;
            if (e.detail.pump_status === 'off') isOn = false;
            fertStatus = e.detail.fertigation_status || 'idle';
            
            // Show any auto actions fed
            if (e.detail.actions_triggered && e.detail.actions_triggered.length > 0 && !isActMode) {
                e.detail.actions_triggered.forEach(a => {
                   if (a.action.includes("irrigation")) showToast(`⚙️ Auto: Starting irrigation`, 'info');
                   if (a.action.includes("fertigation")) showToast(`⚙️ Auto: Queued ${a.nutrient} fertigation`, 'info');
                });
            }

            saveState();
            updateUI();
        }
    });

    updateUI();
    return card;
}
