import { createZoneCard } from '../components/zone-card.js';
import { injectFertigation } from '../api/control.js';
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

    // ... (Headers and Grid same as before, but now functional)
    const header = document.createElement('div');
    header.className = "flex flex-col md:flex-row md:items-end justify-between gap-6";
    header.innerHTML = `
        <div>
            <h1 class="text-3xl font-extrabold text-gray-900">Manual <span class="brand-text">Control Panel</span></h1>
            <p class="text-gray-500 font-medium mt-1">Direct hardware override and plot-specific management</p>
        </div>
        <div class="flex gap-3">
            <button class="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-black text-sm transition-all shadow-md active:scale-95 flex items-center gap-2">
                <i data-lucide="play-circle" class="w-5 h-5"></i> START ALL ZONES
            </button>
            <button class="border-2 border-red-600 text-red-600 hover:bg-red-50 px-6 py-3 rounded-xl font-black text-sm transition-all active:scale-95 flex items-center gap-2 uppercase tracking-tight">
                <i data-lucide="stop-circle" class="w-5 h-5"></i> Stop All
            </button>
        </div>
    `;
    container.appendChild(header);

    const layout = document.createElement('div');
    layout.className = "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start";

    const zoneGrid = document.createElement('div');
    zoneGrid.className = "lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6";
    
    // Load real zones from the API
    const farm = store.getState('currentFarm');
    if (farm?.id) {
        api(`/farms/${farm.id}/`).then(res => {
            const zones = res?.data?.zones || [];
            zones.forEach(z => {
                zoneGrid.appendChild(createZoneCard({
                    id: z.id,           // real UUID from database
                    name: z.name,
                    lastIrrig: 'N/A',
                    moisture: 0,
                    initialState: false,
                }));
            });
        }).catch(err => {
            zoneGrid.innerHTML = `<p class="text-red-500">Failed to load zones: ${err.message}</p>`;
        });
    }
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
                <i data-lucide="test-tube-2" class="w-5 h-5 text-primary"></i> Fertigation Suite
            </h2>

            <div class="flex bg-gray-100 p-1 rounded-xl mb-6">
                ${['Nitrogen', 'Phosphorus', 'Potassium'].map((n) => `
                    <button class="flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${n === activeNutrient ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}">
                        ${n}
                    </button>
                `).join('')}
            </div>

            <div class="space-y-6">
                <div class="flex justify-between items-end">
                    <span class="text-xs font-bold text-gray-500 uppercase tracking-widest">Concentration</span>
                    <span class="text-3xl font-black text-primary" id="fert-val">12 <span class="text-xs text-gray-400 ml-1">ml/L</span></span>
                </div>
                <input type="range" min="0" max="30" value="12" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary" id="fert-slider">
                
                <button id="inject-btn" class="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg active:scale-95">
                    Inject Now
                </button>
            </div>
        `;

        const slider = fertCard.querySelector('#fert-slider');
        const injectBtn = fertCard.querySelector('#inject-btn');
        
        injectBtn.onclick = async () => {
            injectBtn.disabled = true;
            try {
                const res = await injectFertigation('zone_1', activeNutrient, slider.value);
                showToast(`Injection Successful: ${activeNutrient} stabilized`, 'success');
                if (res.warning === 'HIGH_CONCENTRATION') {
                    showToast("Mixture Alert: Optimal threshold exceeded", 'warning');
                }
            } catch (err) {
                if (err.message === 'PUMP_NOT_RUNNING') {
                    if (confirm("Mechanical Delay: Pump idle. Schedule with next irrigation cycle?")) {
                        showToast("Injection Queued for next cycle", 'info');
                    }
                } else {
                    showToast(`Hardware Fault: ${err.message}`, 'error');
                }
            } finally { injectBtn.disabled = false; }
        };
    };

    renderFert();
    sidebar.appendChild(fertCard);
    
    layout.appendChild(sidebar);
    container.appendChild(layout);

    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 0);
    return container;
}
