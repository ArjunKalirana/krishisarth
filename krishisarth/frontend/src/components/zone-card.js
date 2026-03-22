import { store } from '../state/store.js';
import { t }     from '../utils/i18n.js';
import { startIrrigation, stopIrrigation } from '../api/control.js';
import { showToast } from './toast.js';

export function createZoneCard({ id, name, lastIrrig, moisture, initialState = false }) {
    const card = document.createElement('div');

    // Read saved state from store — survives page navigation
    const savedStates = store.getState('activeZoneStates') || {};
    let isOn          = savedStates[id]?.isOn ?? initialState;
    let activeDuration = savedStates[id]?.duration ?? 20;

    // Save state to store
    const saveState = () => {
        const current = store.getState('activeZoneStates') || {};
        current[id] = { isOn, duration: activeDuration };
        store.setState('activeZoneStates', { ...current });
    };

    const updateUI = () => {
        card.className = `ks-card p-6 transition-all duration-500 border-l-4 ${
            isOn
                ? 'border-l-primary-light'
                : 'border-l-gray-200'
        }`;
        card.style.background = isOn ? 'rgba(26,122,74,0.05)' : 'white';

        card.innerHTML = `
            <div class="flex items-start justify-between mb-6">
                <div>
                    <h3 class="font-black text-gray-800 uppercase tracking-tight text-lg">
                         ${name}
                    </h3>
                    <p class="font-bold text-gray-400 uppercase tracking-widest mt-0.5"
                       style="font-size:10px;">
                        ${t('ctrl_last_irrig')}: ${lastIrrig}
                    </p>
                </div>
                <div class="flex flex-col items-end gap-2">
                    <span class="badge ${
                        moisture < 30 ? 'badge-dry' :
                        moisture < 70 ? 'badge-ok'  : 'badge-wet'
                    }">
                        ${moisture}% ${t('zone_moisture')}
                    </span>
                    <div class="flex items-center gap-2">
                        <span class="font-black uppercase tracking-tighter"
                              style="font-size:9px; color:${isOn ? 'var(--color-primary)' : '#9ca3af'}">
                            ${isOn ? t('dash_irrigating') + '...' : t('ctrl_status_idle')}
                        </span>
                        <button class="toggle-btn w-12 h-6 rounded-full relative transition-colors"
                                style="background:${isOn ? 'var(--color-primary)' : '#d1d5db'};"
                                id="toggle-${id}">
                            <div class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full 
                                        transition-transform"
                                 style="transform:${isOn ? 'translateX(24px)' : 'translateX(0)'}">
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            <div class="space-y-4">
                <p class="font-black text-gray-400 uppercase tracking-widest"
                   style="font-size:10px;">${t('ctrl_duration')}</p>
                <div class="flex gap-2">
                    ${[10, 20, 30].map(dur => `
                        <button class="dur-btn flex-1 py-2 rounded-lg font-black 
                                       transition-all border-2"
                                style="font-size:12px;
                                       background:${activeDuration === dur ? 'var(--color-primary)' : '#f9fafb'};
                                       color:${activeDuration === dur ? 'white' : '#6b7280'};
                                       border-color:${activeDuration === dur ? 'var(--color-primary)' : '#f3f4f6'};"
                                data-dur="${dur}">
                            ${dur}${t('zone_min')}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        // Attach toggle listener
        const toggle = card.querySelector(`#toggle-${id}`);
        toggle.onclick = async (e) => {
            e.stopPropagation();
            toggle.disabled = true;

            try {
                if (!isOn) {
                    await startIrrigation(id, activeDuration);
                    isOn = true;
                    saveState();
                    showToast(`${name}: ${t('toast_irrigating')}`, 'success');
                } else {
                    const res = await stopIrrigation(id);
                    isOn = false;
                    saveState();
                    const used = res?.data?.water_used_l ?? 0;
                    showToast(`${t('toast_stopped')}. ${used}${t('toast_used')}`, 'success');
                }
            } catch (err) {
                const codes = {
                    'PUMP_ALREADY_RUNNING': t('toast_pump_running'),
                    'TANK_LEVEL_CRITICAL':  t('toast_tank_low'),
                    'DEVICE_OFFLINE':       t('toast_device_offline'),
                };
                showToast(codes[err.message] || t('toast_cmd_fail'), 'error');
            } finally {
                toggle.disabled = false;
                updateUI();
            }
        };

        // Attach duration button listeners
        card.querySelectorAll('.dur-btn').forEach(btn => {
            btn.onclick = () => {
                activeDuration = parseInt(btn.dataset.dur);
                saveState();
                updateUI();
            };
        });
    };

    updateUI();
    return card;
}
