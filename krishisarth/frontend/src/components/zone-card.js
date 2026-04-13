import { store } from '../state/store.js';
import { t }     from '../utils/i18n.js';
import { startIrrigation, stopIrrigation } from '../api/control.js';
import { showToast } from './toast.js';

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
    card.className = "group";

    const savedStates = store.getState('activeZoneStates') || {};
    let isOn          = savedStates[id]?.isOn ?? initialState;
    let activeDuration = savedStates[id]?.duration ?? 20;

    const cropEmoji = CROP_ICONS[cropType?.toLowerCase()] || CROP_ICONS.default;

    // Semantic colors derived from Slate 
    const moistureColor = moisture < 25 ? '#f87171' : moisture < 45 ? '#fbbf24' : moisture > 70 ? '#60a5fa' : '#34d399';
    const moistureLabel = moisture < 25 ? 'Critical' : moisture < 45 ? 'Dry' : moisture > 70 ? 'Wet' : 'Optimal';
    const moistureBadge = moisture < 25 ? 'badge-danger' : moisture < 45 ? 'badge-warning' : moisture > 70 ? 'badge-info' : 'badge-success';

    const saveState = () => {
        const states = store.getState('activeZoneStates') || {};
        states[id] = { isOn, duration: activeDuration };
        store.setState('activeZoneStates', states);
    };

    const updateUI = () => {
        const circumference = 2 * Math.PI * 28;
        const offset = circumference - (moisture / 100) * circumference;

        card.innerHTML = `
            <div class="ks-card glass-panel p-6 flex flex-col gap-6 h-full relative overflow-hidden transition-all duration-300 hover:border-emerald-500/30">
                
                <!-- ID Watermark -->
                <div class="absolute -right-2 -bottom-2 text-7xl opacity-[0.03] pointer-events-none select-none font-black italic">
                    ${id.slice(0,2).toUpperCase()}
                </div>

                <!-- Header -->
                <div class="flex items-start justify-between relative z-10">
                    <div class="flex-1 min-w-0 pr-2">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-10 h-10 bg-slate-800/50 rounded-xl flex items-center justify-center border border-white/5 text-xl">
                                ${cropEmoji}
                            </div>
                            <div>
                                <h3 class="font-black text-white text-md leading-tight truncate font-display">
                                    ${name}
                                </h3>
                                <p class="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-0.5">
                                    ID: ${id.slice(0,8)}
                                </p>
                            </div>
                        </div>
                    </div>
                    <span class="badge-elite ${moistureBadge}">${moistureLabel}</span>
                </div>

                <!-- Telemetry Hub -->
                <div class="flex items-center gap-6 relative z-10">
                    <div class="relative w-20 h-20 shrink-0">
                        <svg class="transform -rotate-90 w-20 h-20">
                            <circle cx="40" cy="40" r="32" stroke="rgba(255,255,255,0.03)" stroke-width="8" fill="none"/>
                            <circle cx="40" cy="40" r="32" 
                                stroke="${moistureColor}" stroke-width="8" fill="none"
                                stroke-dasharray="${(2 * Math.PI * 32).toFixed(1)}"
                                stroke-dashoffset="${((2 * Math.PI * 32) * (1 - moisture/100)).toFixed(1)}"
                                stroke-linecap="round"
                                class="transition-all duration-1000 ease-out opacity-80"/>
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <span class="moisture-val text-lg font-black text-white font-display" 
                                  data-target="${moisture}">0%</span>
                        </div>
                    </div>
                    <div class="flex-1 space-y-3">
                        <div class="flex justify-between items-center px-1">
                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hydration</span>
                            <span class="text-[10px] font-black text-white px-2 py-0.5 bg-white/5 rounded-md border border-white/5">${moisture}%</span>
                        </div>
                        <div class="h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                            <div class="h-full rounded-full transition-all duration-1000"
                                 style="width: ${moisture}%; background: ${moistureColor}; filter: drop-shadow(0 0 8px ${moistureColor}44);"></div>
                        </div>
                        <p class="text-[9px] font-medium text-slate-500 uppercase tracking-widest">Last sync: <span class="text-slate-300">Just now</span></p>
                    </div>
                </div>

                <!-- Manual Orchestration -->
                <div class="space-y-4 pt-4 border-t border-white/5 relative z-10">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Actuator State</p>
                            <span class="text-[11px] font-black uppercase tracking-[0.15em] flex items-center gap-2"
                                  style="color: ${isOn ? '#34d399' : '#64748b'}">
                                ${isOn ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>ACTIVE' : '<span class="w-1.5 h-1.5 rounded-full bg-slate-600"></span>STANDBY'}
                            </span>
                        </div>
                        
                        <!-- Elite Toggle -->
                        <button class="toggle-btn w-14 h-7 rounded-full relative transition-all duration-300 focus:outline-none"
                                style="background: ${isOn ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${isOn ? '#10b981' : 'rgba(255,255,255,0.1)'};"
                                id="toggle-${id}">
                            <div class="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-transform duration-300"
                                 style="transform: ${isOn ? 'translateX(28px)' : 'translateX(0)'}; background: ${isOn ? '#10b981' : '#cbd5e1'}"></div>
                        </button>
                    </div>

                    <div class="space-y-2">
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Cycle Timer</p>
                        <div class="grid grid-cols-3 gap-2">
                            ${[10, 20, 30].map(dur => `
                                <button class="dur-btn flex-1 py-2.5 rounded-xl font-black text-[10px] transition-all border border-white/5 uppercase tracking-widest ${activeDuration === dur ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 border-emerald-500/30' : 'bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10'}"
                                        data-dur="${dur}">
                                    ${dur}m
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        const toggle = card.querySelector(`#toggle-${id}`);
        if (toggle) {
            toggle.onclick = async (e) => {
                e.stopPropagation();
                toggle.disabled = true;
                try {
                    if (!isOn) {
                        await startIrrigation(id, activeDuration);
                        isOn = true;
                        saveState();
                        showToast(`${name}: Irrigation sequence active 💧`, 'success');
                    } else {
                        const res = await stopIrrigation(id);
                        isOn = false;
                        saveState();
                        const used = res?.data?.water_used_l ?? 0;
                        showToast(`Sequence terminated. ${used}L conserved.`, 'success');
                    }
                } catch (err) {
                    showToast(`Hardware Conflict: ${err.message}`, 'error');
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

        const valEl = card.querySelector('.moisture-val');
        if (valEl) animateMoistureChange(valEl, 0, moisture);
    };

    updateUI();
    return card;
}

function animateMoistureChange(el, from, to) {
    const diff = to - from;
    const duration = 1000;
    const start = performance.now();
    const frame = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 4);
        el.textContent = (from + diff * ease).toFixed(1) + '%';
        if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
}
