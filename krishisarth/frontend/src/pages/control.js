import { createZoneCard } from '../components/zone-card.js';
import { startIrrigation, stopIrrigation, injectFertigation } from '../api/control.js';
import { t } from '../utils/i18n.js';
import { showToast } from '../components/toast.js';
import { api } from '../api/client.js';
import { store } from '../state/store.js';

/**
 * Control Page (Elite Edition)
 * Central hub for manual hardware orchestration and fertigation.
 */
export function renderControl() {
    const container = document.createElement('div');
    container.className = "space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700";

    const header = document.createElement('div');
    header.className = "flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-4";
    header.innerHTML = `
        <div class="space-y-1">
            <h1 class="ks-text-fluid-lg tracking-tight text-white font-display">
                Hardware <span class="text-emerald-500">Orchestration</span>
            </h1>
            <p class="text-slate-400 font-medium text-sm">
                Direct manual overrides for connected irrigation actuators.
            </p>
        </div>
        <div class="flex flex-wrap gap-4">
            <button id="start-all-btn" class="btn-elite flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                <i data-lucide="play-circle" class="w-5 h-5"></i>
                <span>INITIALIZE ALL</span>
            </button>
            <button id="stop-all-btn" class="btn-elite flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-red-500/10 text-red-500 border-red-500/20">
                <i data-lucide="stop-circle" class="w-5 h-5"></i>
                <span>TERMINATE ALL</span>
            </button>
        </div>
    `;
    container.appendChild(header);

    const layout = document.createElement('div');
    layout.className = "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start";

    // Main Operational Area
    const zoneGrid = document.createElement('div');
    zoneGrid.className = "lg:col-span-8 ks-grid md:ks-grid-2 gap-6";
    _loadZones(zoneGrid);
    layout.appendChild(zoneGrid);

    // AI/Fertigation Sidebar
    const sidebar = document.createElement('div');
    sidebar.className = "lg:col-span-4 space-y-8";

    const fertCard = document.createElement('div');
    fertCard.className = "ks-card glass-panel p-8 border-l-4 border-l-emerald-500 shadow-emerald-500/5";
    let activeNutrient = 'Nitrogen';

    const renderFert = () => {
        fertCard.innerHTML = `
            <div class="flex items-center justify-between mb-8">
                <div>
                    <h2 class="text-lg font-black text-white font-display flex items-center gap-3">
                        <i data-lucide="test-tube-2" class="w-5 h-5 text-emerald-400"></i>
                        <span>Fertigation Control</span>
                    </h2>
                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Chemical Injection Engine</p>
                </div>
                <div class="badge-elite badge-success text-[10px]">PUMPS READY</div>
            </div>

            <div class="flex bg-slate-900/50 p-1.5 rounded-2xl mb-8 border border-white/5">
                ${['Nitrogen', 'Phosphorus', 'Potassium'].map((n) => `
                    <button class="nut-btn flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${n === activeNutrient ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}" data-nut="${n}">
                        ${n}
                    </button>
                `).join('')}
            </div>

            <div class="space-y-8">
                <div class="space-y-4">
                    <div class="flex justify-between items-end">
                        <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Concentration Level</span>
                        <div class="flex items-baseline gap-2">
                             <span class="text-4xl font-black text-white font-display" id="fert-val">12</span>
                             <span class="text-xs text-slate-500 font-mono font-bold uppercase">ml/L</span>
                        </div>
                    </div>
                    
                    <div class="relative py-4">
                        <input type="range" min="0" max="30" value="12" 
                               class="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 group" id="fert-slider">
                        <div class="flex justify-between mt-4">
                            <span class="text-[9px] text-slate-600 font-bold">0 ML</span>
                            <span class="text-[9px] text-slate-600 font-bold">30 ML</span>
                        </div>
                    </div>
                </div>
                
                <button id="inject-btn" class="btn-elite w-full py-4 text-sm flex items-center justify-center gap-3">
                    <i data-lucide="zap" class="w-5 h-5"></i>
                    <span>EXECUTE INJECTION</span>
                </button>
                
                <p class="text-[10px] text-slate-500 font-medium italic text-center">
                    Note: Injection requires at least one active irrigation pump.
                </p>
            </div>
        `;

        fertCard.querySelectorAll('.nut-btn').forEach(btn => {
            btn.onclick = () => { activeNutrient = btn.dataset.nut; renderFert(); };
        });

        const slider = fertCard.querySelector('#fert-slider');
        const valEl = fertCard.querySelector('#fert-val');
        const injectBtn = fertCard.querySelector('#inject-btn');
        
        slider.oninput = () => { valEl.textContent = slider.value; };

        injectBtn.onclick = async () => {
            const farm = store.getState('currentFarm');
            let zoneId = null;
            try {
                if (farm?.id) {
                    const dashRes = await api(`/farms/${farm.id}/dashboard`);
                    zoneId = dashRes?.data?.zones?.[0]?.id;
                }
            } catch (e) {}

            if (!zoneId) return showToast('No active zones found for injection', 'error');

            injectBtn.disabled = true;
            try {
                await injectFertigation(zoneId, activeNutrient, slider.value);
                showToast(`Injection Sequence Finalized: ${activeNutrient} stabilized`, 'success');
            } catch (err) {
                showToast(`Injection Fault: ${err.message}`, 'error');
            } finally { injectBtn.disabled = false; }
        };

        if (window.lucide) window.lucide.createIcons();
    };

    renderFert();
    sidebar.appendChild(fertCard);
    
    layout.appendChild(sidebar);
    container.appendChild(layout);

    // Initialization delay for smooth loading
    setTimeout(() => {
        const startAllBtn = container.querySelector('#start-all-btn');
        const stopAllBtn  = container.querySelector('#stop-all-btn');

        startAllBtn?.addEventListener('click', async () => {
            startAllBtn.disabled = true;
            startAllBtn.innerHTML = `<div class="w-5 h-5 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div> Starting...`;
            const cards = container.querySelectorAll('[data-zone-id]');
            await Promise.all([...cards].map(c => startIrrigation(c.dataset.zoneId, 20).catch(() => {})));
            showToast('All actuators initialized 💧', 'success');
            startAllBtn.disabled = false;
            startAllBtn.innerHTML = `<i data-lucide="play-circle" class="w-5 h-5"></i> INITIALIZE ALL`;
            if (window.lucide) window.lucide.createIcons();
        });

        stopAllBtn?.addEventListener('click', async () => {
            stopAllBtn.disabled = true;
            stopAllBtn.innerHTML = `<div class="w-5 h-5 border-3 border-red-500/20 border-t-red-500 rounded-full animate-spin"></div> Stopping...`;
            const cards = container.querySelectorAll('[data-zone-id]');
            await Promise.all([...cards].map(c => stopIrrigation(c.dataset.zoneId).catch(() => {})));
            showToast('All sequences terminated 🛑', 'success');
            stopAllBtn.disabled = false;
            stopAllBtn.innerHTML = `<i data-lucide="stop-circle" class="w-5 h-5"></i> TERMINATE ALL`;
            if (window.lucide) window.lucide.createIcons();
        });
    }, 1000);

    return container;
}

async function _loadZones(gridEl) {
    const farm = store.getState('currentFarm');
    if (!farm?.id) {
        setTimeout(() => _loadZones(gridEl), 800);
        return;
    }

    gridEl.innerHTML = `<div class="md:col-span-2 flex flex-col items-center justify-center py-40 gap-6 glass-panel">
        <div class="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        <p class="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Synchronizing Actuators...</p>
    </div>`;

    try {
        const dashRes = await api(`/farms/${farm.id}/dashboard`);
        const zones = dashRes?.data?.zones || [];

        if (zones.length === 0) {
            gridEl.innerHTML = `
                <div class="md:col-span-2 glass-panel p-20 text-center border-dashed border-slate-700/50">
                    <i data-lucide="activity" class="w-16 h-16 mx-auto mb-6 text-slate-700 animate-pulse"></i>
                    <h3 class="text-xl font-black text-white font-display mb-2">No Connected Nodes</h3>
                    <p class="text-slate-500 text-xs font-medium max-w-xs mx-auto mb-8">
                        Register your first plot to initialize hardware telemetry.
                    </p>
                    <a href="#dashboard" class="btn-elite py-3 px-8 text-xs inline-block">GOTO DASHBOARD</a>
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
                moisture:     z.moisture_pct   || 0,
                initialState: z.pump_running   || false,
                cropType:     z.crop_type      || '',
            }));
        });

        if (window.lucide) window.lucide.createIcons();
    } catch (err) {
        gridEl.innerHTML = `<div class="md:col-span-2 glass-panel p-10 text-center text-red-400 text-xs font-black uppercase tracking-widest">Protocol Sync Failure. Reconnect Required.</div>`;
    }
}
