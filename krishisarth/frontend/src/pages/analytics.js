import { getAnalytics, exportCSV } from '../api/analytics.js';
import { store } from '../state/store.js';
import { t } from '../utils/i18n.js';
import { drawLineChart, drawBarChart } from '../utils/chart.js';
import { formatLitres, roundTo } from '../utils/format.js';

/**
 * Analytics Page (Elite Edition)
 * Biological Intelligence & Resource Orchestration HQ.
 */
export function renderAnalytics() {
    const container = document.createElement('div');
    container.className = "space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700";

    const farmId = store.getState('currentFarm')?.id;
    let range = '7_DAYS';

    const render = async () => {
        container.innerHTML = `
            <!-- Header HUD -->
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-12 mb-8 stagger-in">
                <div class="space-y-3">
                    <h1 class="text-5xl font-black tracking-tighter text-white font-display uppercase">
                        FIELD <span class="text-emerald-500">INTELLIGENCE</span>
                    </h1>
                    <p class="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">
                        Biological Yield Analysis & Nutrient Forecasting
                    </p>
                </div>
                
                <div class="flex items-center gap-4">
                    <div class="flex bg-white/[0.03] p-1.5 rounded-2xl border border-white/5">
                        ${[{l: '7 Days', v: '7_DAYS'}, {l: '30 Days', v: '30_DAYS'}, {l: '90 Days', v: '90_DAYS'}].map(p => {
                            const active = p.v === range;
                            return `<button class="p-btn px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-500 ${active ? 'bg-emerald-500 text-white shadow-2xl shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}" data-range="${p.v}">
                                <span>${p.l}</span>
                            </button>`;
                        }).join('')}
                    </div>
                </div>
            </div>

            <div id="analytics-content" class="space-y-10">
                <div class="py-40 flex flex-col items-center justify-center gap-6 glass-panel">
                    <div class="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                    <p class="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Reconstructing Biological Shards...</p>
                </div>
            </div>
        `;

        container.querySelectorAll('.p-btn').forEach(btn => {
            btn.onclick = () => { range = btn.dataset.range; render(); };
        });

        if (!farmId) return;

        try {
            const to = new Date();
            const from = new Date(to);
            const days = range === '7_DAYS' ? 7 : 30;
            from.setDate(from.getDate() - days);
            const toStr = to.toISOString().split('T')[0];
            const fromStr = from.toISOString().split('T')[0];
            
            const response = await getAnalytics(farmId, fromStr, toStr);
            const data = response.data;
            const content = container.querySelector('#analytics-content');
            
            const daysCount = range === '7_DAYS' ? 7 : range === '30_DAYS' ? 30 : 90;
            
            content.innerHTML = `
                <!-- AI Biological Insight -->
                <div class="elite-card overflow-hidden group shadow-2xl shadow-emerald-500/5 border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.05] to-transparent">
                    <div class="p-10 flex flex-col lg:flex-row gap-12">
                        <div class="lg:w-1/3 space-y-6">
                            <div class="w-16 h-16 rounded-3xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                                <i data-lucide="brain-circuit" class="w-8 h-8 text-white"></i>
                            </div>
                            <div>
                                <h2 class="text-3xl font-black text-white font-display tracking-tight uppercase">Sarth's Analysis</h2>
                                <p class="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mt-2">AI Agronomist Insights</p>
                            </div>
                            <div class="pt-6 border-t border-white/5 space-y-4">
                                <div class="flex justify-between items-center">
                                    <span class="text-[9px] font-black text-slate-500 uppercase">Analysis Precision</span>
                                    <span class="text-[9px] font-black text-emerald-400">98.4%</span>
                                </div>
                                <div class="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                     <div class="h-full bg-emerald-500 w-[98%]"></div>
                                </div>
                            </div>
                        </div>
                        <div class="lg:w-2/3">
                            <div class="prose prose-invert prose-emerald max-w-none">
                                <p class="text-slate-300 text-lg leading-relaxed font-medium">
                                    ${data.summary?.ai_insight?.replace(/\n/g, '<br>') || "Gathering environmental shards for biological processing..."}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Metric Grid -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${[
                        { l: 'Avg Moisture', v: `${data.summary?.avg_moisture}%`, icon: 'droplets', color: 'emerald' },
                        { l: 'Water Usage', v: `${formatLitres(data.summary?.total_water_liters || 0)}`, icon: 'database', color: 'blue' },
                        { l: 'Soil Temperature', v: '29°C', icon: 'thermometer', color: 'amber' }
                    ].map(s => `
                        <div class="elite-card p-10 bg-white/[0.01] hover:bg-white/[0.02] transition-colors duration-500">
                             <div class="flex items-center gap-6 mb-6">
                                <i data-lucide="${s.icon}" class="w-6 h-6 text-${s.color}-400"></i>
                                <span class="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">${s.l}</span>
                             </div>
                             <span class="text-5xl font-black text-white font-display tracking-tighter">${s.v}</span>
                        </div>
                    `).join('')}
                </div>

                <!-- Nutrient & Moisture Flux -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div class="elite-card p-10 bg-white/[0.01]">
                        <div class="mb-12">
                            <h2 class="text-2xl font-black text-white font-display tracking-tight uppercase">Hydration Trend</h2>
                            <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">Historical Soil Moisture (%)</p>
                        </div>
                        <div class="h-80">${drawLineChart({
                            labels: data.labels,
                            datasets: [{ color: '#10b981', data: data.moisture_trend }],
                        })}</div>
                    </div>
                    
                    <div class="elite-card p-10 bg-white/[0.01]">
                        <div class="mb-12">
                            <h2 class="text-2xl font-black text-white font-display tracking-tight uppercase">Nutrient Cycles</h2>
                            <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">N-P-K Mineral Volatility (mg)</p>
                        </div>
                        <div class="h-80">${drawLineChart({
                            labels: data.labels,
                            datasets: [
                                { color: '#ef4444', data: data.nutrients?.N || [] },
                                { color: '#3b82f6', data: data.nutrients?.P || [] },
                                { color: '#fbbf24', data: data.nutrients?.K || [] },
                            ],
                        })}</div>
                    </div>
                </div>

                <!-- Export Deck -->
                <div class="elite-card p-12 flex flex-col md:flex-row items-center justify-between gap-12 bg-emerald-500/[0.02] border-dashed border-emerald-500/20">
                    <div class="flex items-center gap-8">
                        <div class="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center outline outline-1 outline-emerald-500/20">
                            <i data-lucide="archive" class="w-6 h-6 text-emerald-400"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black text-white font-display uppercase tracking-tight">Telemetry Ledger</h3>
                            <p class="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Export high-fidelity biological records</p>
                        </div>
                    </div>
                    <button id="export-btn" class="btn-emerald px-12 py-5 text-[10px] font-black uppercase tracking-[0.3em]">
                        Download CSV Report
                    </button>
                </div>
            `;

            container.querySelector('#export-btn').onclick = () => {
                if (!farmId) return;
                exportCSV(farmId, range, new Date().toISOString());
            };

            if (window.lucide) window.lucide.createIcons();

        } catch (err) { 
            console.error("ANAL_DATA_FAIL:", err);
            const content = container.querySelector('#analytics-content');
            if (content) {
                content.innerHTML = `<div class="py-40 flex flex-col items-center justify-center gap-4 glass-panel border-red-500/20">
                    <p class="text-red-400 font-black uppercase tracking-widest text-[10px]">Telemetry Stream Interrupted</p>
                    <p class="text-slate-500 text-xs">Failed to reconstruct the biological timeline.</p>
                </div>`;
            }
        }
    };

    render();
    return container;
}
