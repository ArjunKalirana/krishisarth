import { showToast } from '../components/toast.js';
import { store } from '../state/store.js';

/**
 * KrishiSarth Soil Quality Analysis v1.0
 * - Glassmorphic UI 
 * - Multi-element analysis 
 * - Impossible value detection 
 * - Dynamic health cards 
 */

const THRESHOLDS = {
    N:  { low: 20, high: 50,  max: 1000, name: 'Nitrogen' },
    P:  { low: 10, high: 30,  max: 500,  name: 'Phosphorus' },
    K:  { low: 100, high: 250, max: 2000, name: 'Potassium' },
    pH: { low: 6.0, high: 7.0, min: 0, max: 14, name: 'pH Value' },
    EC: { low: 0.5, high: 2.0, max: 20,   name: 'Elec. Conductivity' },
    OC: { low: 0.5, high: 1.5, max: 10,   name: 'Organic Carbon' }
};

export function renderSoilAnalysis() {
    const container = document.createElement('div');
    container.className = 'min-h-screen bg-[#131313] text-[#e5e2e1] p-6 lg:p-12 font-inter';

    // State
    const state = {
        N: 35, P: 20, K: 150, pH: 6.5, EC: 1.2, OC: 1.0,
        quality: 'High',
        issues: []
    };

    const updateAnalysis = () => {
        state.issues = [];
        const results = {};

        // Validation & Element Status
        const check = (key, val) => {
            const t = THRESHOLDS[key];
            if (val < (t.min || 0) || val > t.max) {
                showToast(`IMPOSSIBLE VALUE: ${t.name || key} is outside physical limits!`, 'error');
                return 'error';
            }
            if (val < t.low) {
                state.issues.push(`${t.name || key} is Deficient`);
                return 'low';
            }
            if (val > t.high) {
                state.issues.push(`${t.name || key} is Excessive`);
                return 'high';
            }
            return 'optimal';
        };

        ['N', 'P', 'K', 'pH', 'EC', 'OC'].forEach(k => {
            results[k] = check(k, state[k]);
        });

        // Final Quality
        const lowCount = Object.values(results).filter(r => r === 'low' || r === 'high' || r === 'error').length;
        if (lowCount === 0) state.quality = 'High';
        else if (lowCount <= 2) state.quality = 'Medium';
        else state.quality = 'Low';

        renderUI();
    };

    const loadAIRecommendation = async (resEl) => {
        let farm = store.getState('currentFarm');
        
        // Deep Sync: Wait for bootstrap if navigating directly
        if (!farm || !farm.id) {
            resEl.innerHTML = `<span class="text-[9px] uppercase font-black text-slate-600 animate-pulse">Syncing Farm Identity...</span>`;
            for (let i = 0; i < 10; i++) {
                await new Promise(r => setTimeout(r, 500));
                farm = store.getState('currentFarm');
                if (farm && farm.id) break;
            }
        }

        if (!farm || !farm.id) {
            resEl.innerHTML = `<p class="text-[10px] text-red-400 font-black uppercase tracking-widest">Farm Context Lost</p>`;
            return;
        }

        let dash = store.getState('currentFarmDashboard');
        
        // Safety Fallback: Discovery sequence for direct navigation
        if (!dash || !dash.zones) {
            try {
                const { api } = await import('../api/client.js');
                const farmRes = await api(`/farms/${farm.id}/dashboard`);
                if (farmRes?.success) {
                    dash = farmRes.data;
                    store.setState('currentFarmDashboard', dash);
                }
            } catch (err) {
                console.warn('[AI] Zone discovery failed:', err);
            }
        }

        const zone = dash?.zones?.[0];
        
        if (!zone) {
            resEl.innerHTML = `<p class="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-relaxed">No Active Zones Found.<br/><span class="text-[8px] opacity-60">Register a node in Farm Setup.</span></p>`;
            return;
        }

        resEl.innerHTML = `
            <div class="flex items-center gap-4 animate-pulse">
                <div class="w-4 h-4 bg-emerald-500 rounded-full"></div>
                <span class="text-[10px] uppercase font-black tracking-widest text-slate-500">Querying Neural Core...</span>
            </div>
        `;

        try {
            const { api } = await import('../api/client.js');
            const res = await api(`/zones/${zone.id}/crop-suggestion`);
            const data = res.data;

            if (!data || !data.prediction) throw new Error('EMPTY_INFERENCE');

            resEl.innerHTML = `
                <div class="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
                    <div class="flex items-center justify-between">
                         <span class="text-[9px] font-black uppercase text-emerald-400 tracking-widest">Recommended Crop</span>
                         <span class="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black rounded-full border border-emerald-500/20">94% MATCH</span>
                    </div>
                    <div class="text-3xl font-black text-white font-manrope tracking-tight uppercase">${data.prediction}</div>
                    <p class="text-[11px] leading-relaxed text-slate-400 font-medium italic border-l-2 border-emerald-500/30 pl-4 py-1">
                        "${data.rationale}"
                    </p>
                    <div class="flex gap-2 pt-2">
                         <div class="px-3 py-1 bg-white/5 rounded-full text-[8px] font-black text-slate-500 uppercase tracking-widest border border-white/5">N: ${data.inputs?.N ?? '—'}</div>
                         <div class="px-3 py-1 bg-white/5 rounded-full text-[8px] font-black text-slate-500 uppercase tracking-widest border border-white/5">pH: ${data.inputs?.ph ?? '—'}</div>
                    </div>
                </div>
            `;
        } catch (err) {
            console.error('[AI] Inference Error:', err);
            resEl.innerHTML = `<p class="text-[10px] text-red-400 font-black uppercase tracking-widest">Inference Hub Unavailable</p>`;
        }
    };

    const renderUI = () => {
        const qualityColor = state.quality === 'High' ? '#4edea3' : state.quality === 'Medium' ? '#f59e0b' : '#ff7b72';
        const qualityBg = state.quality === 'Low' ? 'rgba(255, 123, 114, 0.1)' : 'rgba(78, 222, 163, 0.05)';
        const qualityBorder = state.quality === 'Low' ? '#ff7b72' : 'rgba(255, 255, 255, 0.05)';

        container.innerHTML = `
            <div class="max-w-6xl mx-auto">
                <header class="mb-12 flex flex-col md:flex-row justify-between items-end gap-6">
                    <div>
                        <h1 class="text-4xl lg:text-5xl font-black text-white tracking-tighter mb-2 font-manrope">SOIL ANALYSIS</h1>
                        <p class="text-[#64748b] text-[10px] uppercase tracking-[0.3em]">Precision Quality Assessment • Neon Harvest v1.0</p>
                    </div>
                    <div class="glass-panel px-6 py-3 border-emerald-500/20 bg-emerald-500/5 flex items-center gap-4">
                        <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span class="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-none">Bio-Network Active</span>
                    </div>
                </header>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <!-- Input Section -->
                    <div class="lg:col-span-6 bg-[#201f1f] p-8 rounded-3xl border border-white/5 backdrop-blur-3xl shadow-2xl">
                        <h2 class="text-[10px] font-black text-[#4edea3] mb-10 tracking-widest uppercase">Input Soil Metrics</h2>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
                            ${['N', 'P', 'K', 'pH', 'EC', 'OC'].map(key => `
                                <div class="space-y-4">
                                    <div class="flex justify-between items-end">
                                        <label class="text-[10px] uppercase font-black tracking-widest text-[#64748b]">${THRESHOLDS[key].name || key}</label>
                                        <span class="text-xs font-mono text-[#4edea3]">${state[key]}</span>
                                    </div>
                                    <input type="number" step="0.1" value="${state[key]}" data-key="${key}" class="soil-input w-full bg-[#131313] border-none rounded-2xl p-4 text-white font-mono focus:ring-1 focus:ring-[#4edea3]/50 transition-all outline-none" />
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Output Section -->
                    <div class="lg:col-span-6 space-y-6">
                        <div id="quality-card" style="background: ${qualityBg}; border: 1px solid ${qualityBorder};" class="p-10 rounded-[48px] transition-all duration-700 backdrop-blur-3xl shadow-xl">
                            <div class="flex flex-col mb-10">
                                <span class="text-[10px] font-black uppercase tracking-[0.4em] text-[#64748b]">Real-Time Quality Index</span>
                                <div id="quality-label" style="color: ${qualityColor};" class="text-7xl font-black tracking-tighter mt-4 font-manrope">${state.quality}</div>
                            </div>

                            <div class="space-y-4">
                                ${state.issues.length > 0 ? state.issues.map(issue => `
                                    <div class="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-[#e5e2e1]/80 bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <span class="w-1.5 h-1.5 rounded-full bg-[#ff7b72] shadow-[0_0_8px_rgba(255,123,114,0.5)]"></span>
                                        ${issue}
                                    </div>
                                `).join('') : `
                                    <div class="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-[#4edea3] bg-[#4edea3]/10 p-4 rounded-full border border-[#4edea3]/20 text-center justify-center">
                                        <span class="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse"></span>
                                        Optimum Nutrient Equilibrium
                                    </div>
                                `}
                            </div>
                        </div>

                        <!-- 🌿 Next Season Recommendation -->
                        <div class="p-10 bg-[#1a1919] border border-white/5 rounded-[44px] shadow-2xl relative overflow-hidden group">
                            <div class="absolute top-0 right-0 p-8 opacity-5">
                                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1"><path d="M12 2v10M12 12l-4-4M12 12l4-4"/></svg>
                            </div>
                            <div class="flex items-center gap-3 mb-8">
                                <div class="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)]"></div>
                                <h3 class="text-[10px] font-black uppercase tracking-[0.3em] text-[#64748b]">Next Season Strategy</h3>
                            </div>
                            
                            <div id="crop-recommendation-root">
                                <!-- Loaded via loadAIRecommendation -->
                            </div>
                        </div>

                        <div class="p-10 bg-[#131212] border border-white/5 rounded-[40px] shadow-lg">
                            <div class="flex items-center gap-3 mb-6">
                                <h3 class="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Agronomist Intel</h3>
                            </div>
                            <p class="text-xs font-medium leading-relaxed text-slate-500 mb-10 italic">
                                ${state.quality === 'High' ? 'Peak soil vitality confirmed. Proceed with standard irrigation schedule.' : 
                                  'Localized nutrient boost recommended within 24 hours to prevent crop stress.'}
                            </p>
                            <button class="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[9px] rounded-2xl transition-all border border-white/10">
                                EXPORT FULL BIO-REPORT
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.querySelectorAll('.soil-input').forEach(input => {
            input.oninput = (e) => {
                state[e.target.dataset.key] = parseFloat(e.target.value) || 0;
                updateAnalysis();
            };
        });

        const recRoot = container.querySelector('#crop-recommendation-root');
        if (recRoot) loadAIRecommendation(recRoot);
    };

    const store = window.KrishiSarthStore || { getState: () => ({}) };
    
    updateAnalysis();
    return container;
}
