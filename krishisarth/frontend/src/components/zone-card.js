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

    const cropEmoji = CROP_ICONS[cropType?.toLowerCase()] || CROP_ICONS.default;

    const moistureColor = moisture < 25 ? '#f87171' : moisture < 45 ? '#fbbf24' : moisture > 70 ? '#60a5fa' : '#34d399';
    const moistureLabel = moisture < 25 ? 'Critical' : moisture < 45 ? 'Dry' : moisture > 70 ? 'Wet' : 'Optimal';
    const moistureBadge = moisture < 25 ? 'badge-danger' : moisture < 45 ? 'badge-warning' : moisture > 70 ? 'badge-info' : 'badge-success';

    const saveState = () => {
        const states = store.getState('activeZoneStates') || {};
        states[id] = { isOn, duration: activeDuration };
        store.setState('activeZoneStates', states);
    };

    const updateUI = () => {
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
                                    ${isActMode ? 'Operational Mode' : 'Visualizer Phase'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button class="mode-toggle-btn px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border
                                   ${isActMode ? 'bg-white/5 text-slate-500 border-white/10 hover:text-white' 
                                               : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'}"
                            data-zone-id="${id}">
                        ${isActMode ? 'LOCK' : 'ENABLE'}
                    </button>
                </div>

                <div class="flex items-center gap-8">
                    <div class="relative w-24 h-24 shrink-0">
                        <svg class="transform -rotate-90 w-24 h-24">
                            <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.03)" stroke-width="8" fill="none"/>
                            <circle cx="48" cy="48" r="40" 
                                stroke="${moistureColor}" stroke-width="8" fill="none"
                                stroke-dasharray="251.2"
                                stroke-dashoffset="${251.2 * (1 - moisture/100)}"
                                stroke-linecap="round"
                                class="transition-all duration-1000 ease-out shadow-[0_0_15px_${moistureColor}44]"/>
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <span class="active-moisture text-xl font-black text-white font-display">${moisture}%</span>
                        </div>
                    </div>
                    <div class="flex-1 space-y-4">
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hydration Index</span>
                            <span class="${moistureBadge} text-[9px] px-2 py-0.5 rounded-md border border-white/5">${moistureLabel}</span>
                        </div>
                        <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div class="h-full rounded-full transition-all duration-1000"
                                 style="width: ${moisture}%; background: ${moistureColor}"></div>
                        </div>
                    </div>
                </div>

                <div class="space-y-6 pt-6 border-t border-white/5 relative z-10 mt-auto">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Actuator State</p>
                            <span class="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2"
                                  style="color: ${isOn ? '#10b981' : '#64748b'}">
                                ${isOn ? 'TRANSMITTING' : 'STANDBY'}
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
        if (window.lucide) window.lucide.createIcons();
    };

    updateUI();
    return card;
}
