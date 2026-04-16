import { showToast } from '../components/toast.js';

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

    const renderUI = () => {
        const qualityColor = state.quality === 'High' ? '#4edea3' : state.quality === 'Medium' ? '#f59e0b' : '#ff7b72';
        const qualityBg = state.quality === 'Low' ? 'rgba(255, 123, 114, 0.1)' : 'rgba(78, 222, 163, 0.05)';
        const qualityBorder = state.quality === 'Low' ? '#ff7b72' : 'rgba(255, 255, 255, 0.05)';

        container.innerHTML = `
            <div class="max-w-6xl mx-auto">
                <header class="mb-12">
                    <h1 class="text-4xl lg:text-5xl font-black text-white tracking-tighter mb-2 font-manrope">SOIL ANALYSIS</h1>
                    <p class="text-[#64748b] text-[10px] uppercase tracking-[0.3em]">Precision Quality Assessment • Neon Harvest v1.0</p>
                </header>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <!-- Input Section -->
                    <div class="lg:col-span-7 bg-[#201f1f] p-8 rounded-3xl border border-white/5 backdrop-blur-3xl shadow-2xl">
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

                        <div class="mt-14 p-6 bg-[#4edea3]/5 rounded-2xl border border-[#4edea3]/10 border-dashed">
                            <p class="text-[10px] text-[#4edea3]/80 leading-relaxed uppercase font-black text-center italic tracking-wider">
                                Automated heuristic engine calibrated for ${state.pH < 7 ? 'Acidic' : 'Alkaline'} profile.
                            </p>
                        </div>
                    </div>

                    <!-- Output Section -->
                    <div class="lg:col-span-5 space-y-6">
                        <div id="quality-card" style="background: ${qualityBg}; border: 1px solid ${qualityBorder};" class="p-12 rounded-[48px] transition-all duration-700 backdrop-blur-3xl shadow-xl">
                            <div class="flex flex-col mb-14">
                                <span class="text-[10px] font-black uppercase tracking-[0.4em] text-[#64748b]">Real-Time Quality Index</span>
                                <div id="quality-label" style="color: ${qualityColor};" class="text-7xl font-black tracking-tighter mt-4 font-manrope animate-in fade-in slide-in-from-left-4 duration-1000">${state.quality}</div>
                            </div>

                            <div class="space-y-4">
                                ${state.issues.length > 0 ? state.issues.map(issue => `
                                    <div class="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-[#e5e2e1]/80 bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <span class="w-1.5 h-1.5 rounded-full bg-[#ff7b72] shadow-[0_0_8px_rgba(255,123,114,0.5)]"></span>
                                        ${issue}
                                    </div>
                                `).join('') : `
                                    <div class="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-[#4edea3] bg-[#4edea3]/10 p-5 rounded-2xl border border-[#4edea3]/20">
                                        <span class="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse"></span>
                                        Optimum Nutrient Equilibrium
                                    </div>
                                `}
                            </div>
                        </div>

                        <div class="p-8 bg-[#1a1919] border border-white/5 rounded-3xl">
                            <div class="flex items-center gap-3 mb-6">
                                <div class="w-1 h-3 bg-[#4edea3]"></div>
                                <h3 class="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Agronomist Intel</h3>
                            </div>
                            <p class="text-xs font-medium leading-loose text-slate-400">
                                ${state.quality === 'High' ? 'Peak soil vitality confirmed. Proceed with standard irrigation schedule. NPK saturation is within high-fidelity ranges for commercial yield.' :
                                  state.quality === 'Medium' ? 'Moderate deficiencies identified in the NPK matrix. We recommend a localized nutrient boost within 24 hours to prevent crop stress.' :
                                  'CRITICAL SYSTEM ALERT: Severe element imbalance detected. Immediate remediation protocol required. Soil fertility is currently insufficient for sustainable growth.'}
                            </p>
                            <button class="w-full mt-12 py-5 bg-[#4edea3] text-[#131313] font-black uppercase tracking-widest text-[10px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[#4edea3]/20">
                                ${state.quality === 'Low' ? 'DEPLOY REMEDIATION' : 'EXPORT ANALYSIS'}
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
    };

    updateAnalysis();
    return container;
}
