import { store } from '../state/store.js';
import { t }     from '../utils/i18n.js';
import { startIrrigation, stopIrrigation } from '../api/control.js';
import { showToast } from './toast.js';

// Crop emoji map for visual richness
const CROP_ICONS = {
    tomato: '🍅', grape: '🍇', onion: '🧅', pomegranate: '🍎',
    chilli: '🌶️', wheat: '🌾', rice: '🌾', cotton: '🌿',
    sugarcane: '🎋', soybean: '🫘', default: '🌱'
};

export function createZoneCard({ id, name, lastIrrig, moisture, initialState = false, cropType = '' }) {
    const card = document.createElement('div');
    card.dataset.zoneId = id;

    const savedStates = store.getState('activeZoneStates') || {};
    let isOn          = savedStates[id]?.isOn ?? initialState;
    let activeDuration = savedStates[id]?.duration ?? 20;

    const cropEmoji = CROP_ICONS[cropType?.toLowerCase()] || CROP_ICONS.default;

    const moistureColor = moisture < 25 ? '#dc2626' : moisture < 45 ? '#d97706' : moisture > 70 ? '#2563eb' : '#16a34a';
    const moistureLabel = moisture < 25 ? 'Critical' : moisture < 45 ? 'Dry' : moisture > 70 ? 'Wet' : 'Optimal';
    const moistureBadge = moisture < 25 ? 'badge-critical' : moisture < 45 ? 'badge-warning' : moisture > 70 ? 'badge-wet' : 'badge-ok';

    const saveState = () => {
        const states = store.getState('activeZoneStates') || {};
        states[id] = { isOn, duration: activeDuration };
        store.setState('activeZoneStates', states);
    };

    const updateUI = () => {
        const GREEN = '#1a7a4a';
        const pct = Math.min(100, Math.max(0, moisture));
        const circumference = 2 * Math.PI * 28;
        const offset = circumference - (pct / 100) * circumference;

        card.innerHTML = `
            <div class="ks-card p-5 flex flex-col gap-4 h-full relative overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow duration-300"
                 style="border-top: 3px solid ${moistureColor};">
                
                <!-- Background crop emoji watermark -->
                <div class="absolute -right-3 -top-3 text-5xl opacity-[0.07] pointer-events-none select-none">
                    ${cropEmoji}
                </div>

                <!-- Header -->
                <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0 pr-2">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-lg">${cropEmoji}</span>
                            <h3 class="font-extrabold text-gray-900 text-sm leading-tight truncate"
                                style="font-family: var(--font-display);">
                                ${name}
                            </h3>
                        </div>
                        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            Last: ${lastIrrig}
                        </p>
                    </div>
                    <span class="badge ${moistureBadge} shrink-0 text-[10px]">${moistureLabel}</span>
                </div>

                <!-- Moisture Ring + Value -->
                <div class="flex items-center gap-4">
                    <div class="relative w-16 h-16 shrink-0">
                        <svg class="transform -rotate-90 w-16 h-16">
                            <circle cx="32" cy="32" r="28" stroke="#f3f4f6" stroke-width="6" fill="none"/>
                            <circle cx="32" cy="32" r="28" 
                                stroke="${moistureColor}" stroke-width="6" fill="none"
                                stroke-dasharray="${circumference.toFixed(1)}"
                                stroke-dashoffset="${offset.toFixed(1)}"
                                stroke-linecap="round"
                                style="transition: stroke-dashoffset 0.8s ease-out;"/>
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <span class="moisture-val text-sm font-black leading-none" 
                                  style="color:${moistureColor}; font-family: var(--font-mono);"
                                  data-target="${moisture}">0%</span>
                        </div>
                    </div>
                    <div class="flex-1">
                        <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Soil Moisture</p>
                        <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div class="h-full rounded-full transition-all duration-700"
                                 style="width: ${pct}%; background: ${moistureColor};"></div>
                        </div>
                        <div class="flex justify-between mt-1">
                            <span class="text-[9px] text-gray-300 font-mono">0%</span>
                            <span class="text-[9px] text-gray-300 font-mono">100%</span>
                        </div>
                    </div>
                </div>

                <!-- Toggle Row -->
                <div class="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span class="text-[10px] font-black uppercase tracking-widest"
                          style="color: ${isOn ? '#1a7a4a' : '#9ca3af'}">
                        ${isOn ? '💧 Irrigating...' : '⏸ Idle'}
                    </span>
                    <button class="toggle-btn w-12 h-6 rounded-full relative transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1"
                            style="background: ${isOn ? '#1a7a4a' : '#d1d5db'};"
                            id="toggle-${id}" aria-label="Toggle irrigation">
                        <div class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200"
                             style="transform: ${isOn ? 'translateX(24px)' : 'translateX(0)'};"></div>
                    </button>
                </div>

                <!-- Duration Buttons -->
                <div>
                    <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Duration</p>
                    <div class="flex gap-2">
                        ${[10, 20, 30].map(dur => `
                            <button class="dur-btn flex-1 py-2 rounded-xl font-black text-xs transition-all border-2 focus:outline-none"
                                    style="
                                        background: ${activeDuration === dur ? '#1a7a4a' : '#f9fafb'};
                                        color: ${activeDuration === dur ? '#ffffff' : '#6b7280'};
                                        border-color: ${activeDuration === dur ? '#1a7a4a' : '#f3f4f6'};
                                    "
                                    data-dur="${dur}">
                                ${dur}m
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Attach toggle
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
                        showToast(`${name}: Irrigation started 💧`, 'success');
                    } else {
                        const res = await stopIrrigation(id);
                        isOn = false;
                        saveState();
                        const used = res?.data?.water_used_l ?? 0;
                        showToast(`Stopped. ${used}L used.`, 'success');
                    }
                } catch (err) {
                    const codes = {
                        'PUMP_ALREADY_RUNNING': 'Pump already running',
                        'TANK_LEVEL_CRITICAL':  'Tank level critical!',
                        'DEVICE_OFFLINE':       'Device offline',
                    };
                    showToast(codes[err.message] || 'Command failed', 'error');
                } finally {
                    toggle.disabled = false;
                    updateUI();
                }
            };
        }

        // Attach duration buttons
        card.querySelectorAll('.dur-btn').forEach(btn => {
            btn.onclick = () => {
                activeDuration = parseInt(btn.dataset.dur);
                saveState();
                updateUI();
            };
        });

        // Animate moisture count-up
        const valEl = card.querySelector('.moisture-val');
        if (valEl) animateMoistureChange(valEl, 0, moisture);
    };

    updateUI();
    return card;
}

function animateMoistureChange(el, from, to) {
    const diff = to - from;
    const duration = 800;
    const start = performance.now();
    const frame = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = (from + diff * ease).toFixed(1) + '%';
        if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
}
