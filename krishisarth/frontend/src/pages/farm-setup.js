import { api } from '../api/client.js';
import { store } from '../state/store.js';
import { showToast } from '../components/toast.js';

const CROPS = [
    {id:'tomato', label:'Tomato', emoji:'🍅', water:'High', season:'Rabi+Kharif'},
    {id:'grape', label:'Grape', emoji:'🍇', water:'Medium', season:'Perennial'},
    {id:'onion', label:'Onion', emoji:'🧅', water:'Medium', season:'Rabi'},
    {id:'pomegranate', label:'Pomegranate', emoji:'🍎', water:'Low', season:'Perennial'},
    {id:'chilli', label:'Chilli', emoji:'🌶️', water:'Medium', season:'Kharif'},
    {id:'wheat', label:'Wheat', emoji:'🌾', water:'Low', season:'Rabi'},
    {id:'sugarcane', label:'Sugarcane', emoji:'🎋', water:'Very High', season:'Perennial'},
    {id:'cotton', label:'Cotton', emoji:'🌿', water:'Medium', season:'Kharif'},
    {id:'soybean', label:'Soybean', emoji:'🫘', water:'Low', season:'Kharif'},
    {id:'maize', label:'Maize', emoji:'🌽', water:'Medium', season:'Kharif'},
    {id:'banana', label:'Banana', emoji:'🍌', water:'High', season:'Perennial'},
    {id:'rice', label:'Rice', emoji:'🍚', water:'Very High', season:'Kharif'},
];

export function renderFarmSetup(onComplete) {
    const container = document.createElement('div');
    container.className = 'min-h-screen bg-[#0a0f0d] flex items-center justify-center p-6';
    
    let step = 1;
    let farmData = { totalAreaSqm: 0, zones: [] };
    let createdZones = [];
    
    const render = () => {
        container.innerHTML = '';
        
        const card = document.createElement('div');
        card.className = 'w-full max-w-2xl bg-[#0f1a13] rounded-3xl border border-white/5 shadow-2xl overflow-hidden';
        
        // Progress bar
        const progress = document.createElement('div');
        progress.className = 'h-1 bg-white/5';
        progress.innerHTML = `<div class="h-full bg-emerald-500 transition-all duration-700" style="width:${(step/3)*100}%"></div>`;
        card.appendChild(progress);
        
        const body = document.createElement('div');
        body.className = 'p-8';
        
        if (step === 1) {
            body.innerHTML = `
                <div class="mb-8">
                    <p class="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Step 1 of 3</p>
                    <h2 class="text-3xl font-black text-white" style="font-family:var(--font-display)">
                        📐 Define Your Farm
                    </h2>
                    <p class="text-slate-400 mt-2 text-sm">Enter total area — we'll calculate optimal sensor zones automatically</p>
                </div>
                
                <div class="space-y-6">
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Farm Name</label>
                        <input id="farm-name" type="text" placeholder="e.g. Patil's Nashik Farm" value="${store.getState('currentFarm')?.name || ''}"
                               class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors">
                    </div>
                    
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Total Farm Area</label>
                        <div class="flex gap-3">
                            <input id="area-input" type="number" placeholder="e.g. 10000" min="100" max="500000"
                                   class="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors">
                            <select id="area-unit" class="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500">
                                <option value="sqm">sq meters</option>
                                <option value="acre">Acres</option>
                                <option value="ha">Hectares</option>
                                <option value="guntha">Guntha</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Live Zone Preview -->
                    <div id="zone-preview" class="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 hidden">
                        <p class="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3">Zone Preview</p>
                        <div id="zone-preview-content"></div>
                    </div>
                    
                    <button id="step1-next" class="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-2xl transition-all text-sm uppercase tracking-wider">
                        Calculate Optimal Zones →
                    </button>
                </div>
            `;
            
            // Live preview as user types
            const areaInput = body.querySelector('#area-input');
            const unitSel   = body.querySelector('#area-unit');
            const preview   = body.querySelector('#zone-preview');
            const previewContent = body.querySelector('#zone-preview-content');
            
            const toSqm = (val, unit) => {
                const v = parseFloat(val) || 0;
                if (unit === 'acre')  return v * 4046.86;
                if (unit === 'ha')    return v * 10000;
                if (unit === 'guntha') return v * 101.17;
                return v;
            };
            
            const updatePreview = () => {
                const sqm = toSqm(areaInput.value, unitSel.value);
                if (sqm < 100) { preview.classList.add('hidden'); return; }
                const numZones = Math.max(1, Math.ceil(sqm / 2000));
                const zoneArea = Math.round(sqm / numZones);
                preview.classList.remove('hidden');
                previewContent.innerHTML = `
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div><p class="text-2xl font-black text-white">${numZones}</p><p class="text-[10px] text-slate-400 uppercase">Zones</p></div>
                        <div><p class="text-2xl font-black text-white">${numZones}</p><p class="text-[10px] text-slate-400 uppercase">Sensors</p></div>
                        <div><p class="text-2xl font-black text-white">${zoneArea}</p><p class="text-[10px] text-slate-400 uppercase">sqm/zone</p></div>
                    </div>
                    <div class="flex flex-wrap gap-2 mt-4">
                        ${Array.from({length:numZones}, (_,i) => `<span class="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black rounded-lg border border-emerald-500/20">Zone ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i] || (i+1)}</span>`).join('')}
                    </div>
                `;
            };
            
            areaInput.addEventListener('input', updatePreview);
            unitSel.addEventListener('change', updatePreview);
            
            body.querySelector('#step1-next').onclick = async () => {
                const sqm = toSqm(areaInput.value, unitSel.value);
                if (sqm < 100) { showToast('Enter a valid farm area (min 100 sqm)', 'error'); return; }
                
                farmData.totalAreaSqm = sqm;
                const farm = store.getState('currentFarm');
                if (!farm?.id) { showToast('No farm selected', 'error'); return; }
                
                const btn = body.querySelector('#step1-next');
                btn.textContent = 'Creating zones...';
                btn.disabled = true;
                
                try {
                    const res = await api(`/farms/${farm.id}/auto-zones`, {
                        method: 'POST',
                        body: JSON.stringify({ total_area_sqm: sqm, replace_existing: true })
                    });
                    if (res?.success) {
                        createdZones = res.data.zones;
                        farmData.zones = createdZones.map(z => ({...z, crop_type: '', soil_data: null}));
                        step = 2;
                        render();
                    }
                } catch(e) {
                    showToast('Zone creation failed: ' + e.message, 'error');
                    btn.textContent = 'Calculate Optimal Zones →';
                    btn.disabled = false;
                }
            };
        }
        
        else if (step === 2) {
            const currentZoneIdx = farmData.zones.findIndex(z => !z.crop_type);
            const zone = farmData.zones[currentZoneIdx] || farmData.zones[0];
            const zoneProgress = Math.round((farmData.zones.filter(z=>z.crop_type).length / farmData.zones.length) * 100);
            
            body.innerHTML = `
                <div class="mb-6">
                    <p class="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Step 2 of 3 — ${zoneProgress}% configured</p>
                    <h2 class="text-2xl font-black text-white" style="font-family:var(--font-display)">
                        🌱 Configure ${zone?.name || 'Zone'}
                    </h2>
                    <p class="text-slate-400 mt-1 text-sm">Select the crop or scan soil report for smart suggestions</p>
                </div>
                
                <!-- Zone pills -->
                <div class="flex flex-wrap gap-2 mb-6">
                    ${farmData.zones.map((z, i) => `
                        <span class="px-3 py-1 rounded-lg text-[10px] font-black border ${z.crop_type ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-slate-400 border-white/10'}">${z.name} ${z.crop_type ? '✓' : ''}</span>
                    `).join('')}
                </div>
                
                <!-- Crop grid -->
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6" id="crop-picker">
                    ${CROPS.map(c => `
                        <button class="crop-pick flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-transparent hover:border-emerald-500 hover:bg-emerald-500/5 transition-all group"
                                data-crop="${c.id}" data-label="${c.label}">
                            <span class="text-2xl group-hover:scale-125 transition-transform">${c.emoji}</span>
                            <span class="text-[10px] font-black text-slate-400 uppercase">${c.label}</span>
                            <span class="text-[8px] text-slate-600">${c.water} water</span>
                        </button>
                    `).join('')}
                </div>
                
                <div class="flex gap-3">
                    <button id="scan-soil-btn" class="flex-1 py-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl font-black text-xs uppercase hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2">
                        <i data-lucide="scan" class="w-4 h-4"></i> Scan Soil Report
                    </button>
                    <button id="skip-zone-btn" class="px-4 py-3 bg-white/5 text-slate-400 border border-white/10 rounded-xl font-black text-xs uppercase hover:bg-white/10 transition-all">
                        Skip
                    </button>
                </div>
                
                <!-- Hidden file input for soil scan -->
                <input type="file" id="soil-file-input" accept="image/*" class="hidden">
            `;
            
            if (window.lucide) window.lucide.createIcons();
            
            const setCrop = async (cropId, zoneId) => {
                try {
                    await api(`/farms/${store.getState('currentFarm')?.id}/zones/${zoneId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({crop_type: cropId})
                    }).catch(() => {});
                } catch {}
                
                const zIdx = farmData.zones.findIndex(z => z.id === zoneId);
                if (zIdx >= 0) farmData.zones[zIdx].crop_type = cropId;
                
                // Check if all zones configured
                const remaining = farmData.zones.filter(z => !z.crop_type);
                if (remaining.length === 0) {
                    step = 3;
                } 
                render();
            };
            
            body.querySelectorAll('.crop-pick').forEach(btn => {
                btn.onclick = () => setCrop(btn.dataset.crop, zone.id);
            });
            
            body.querySelector('#skip-zone-btn').onclick = () => {
                setCrop('unassigned', zone.id);
            };
            
            body.querySelector('#scan-soil-btn').onclick = () => {
                body.querySelector('#soil-file-input').click();
            };
            
            body.querySelector('#soil-file-input').onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                showToast('🔍 Scanning soil report...', 'info');
                
                const formData = new FormData();
                formData.append('file', file);
                
                try {
                    const res = await fetch(
                        `${window.__KS_API_URL__}/zones/${zone.id}/soil-scan`,
                        {
                            method: 'POST',
                            headers: {Authorization: `Bearer ${localStorage.getItem('ks_token')}`},
                            body: formData
                        }
                    );
                    const data = await res.json();
                    if (data.success) {
                        showToast(`✅ Soil analyzed! Suggested: ${data.data.top_suggestion}`, 'success');
                        // Pre-select the suggested crop
                        const suggested = body.querySelector(`[data-crop="${data.data.top_suggestion}"]`);
                        if (suggested) {
                            suggested.classList.add('border-emerald-500', 'bg-emerald-500/10');
                        }
                    }
                } catch(err) {
                    showToast('Soil scan failed', 'error');
                }
            };
        }
        
        else if (step === 3) {
            body.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-6xl mb-4">🎉</div>
                    <h2 class="text-3xl font-black text-white mb-3" style="font-family:var(--font-display)">Farm Ready!</h2>
                    <p class="text-slate-400 mb-8">Your farm is configured with ${farmData.zones.length} zones and AI monitoring activated.</p>
                    
                    <div class="grid grid-cols-2 gap-4 mb-8">
                        ${farmData.zones.map(z => {
                            const crop = CROPS.find(c => c.id === z.crop_type);
                            return `<div class="bg-white/5 rounded-xl p-4 text-left border border-white/10">
                                <span class="text-2xl">${crop?.emoji || '🌱'}</span>
                                <p class="font-black text-white text-sm mt-1">${z.name}</p>
                                <p class="text-[10px] text-slate-400 uppercase">${crop?.label || 'Unassigned'}</p>
                            </div>`;
                        }).join('')}
                    </div>
                    
                    <button id="finish-setup" class="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-2xl transition-all text-sm uppercase tracking-wider">
                        Launch Dashboard 🚀
                    </button>
                </div>
            `;
            
            body.querySelector('#finish-setup').onclick = () => {
                if (onComplete) onComplete();
                else window.location.hash = '#dashboard';
            };
        }
        
        card.appendChild(body);
        container.appendChild(card);
    };
    
    render();
    return container;
}
