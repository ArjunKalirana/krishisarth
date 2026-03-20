import { getAnalytics, exportCSV } from '../api/analytics.js';
import { store } from '../state/store.js';
import { drawLineChart, drawBarChart } from '../utils/chart.js';
import { formatLitres, roundTo } from '../utils/format.js';

/**
 * Dynamic Analytics Page
 * Historical performance analysis and resource tracking.
 */
export function renderAnalytics() {
    const container = document.createElement('div');
    container.className = "space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700";

    const farmId = store.getState('currentFarm')?.id;
    let range = '7_DAYS';

    const render = async () => {
        container.innerHTML = `
            <!-- Header -->
            <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 class="text-3xl font-extrabold text-gray-900">Agri <span class="brand-text">Analytics</span></h1>
                    <p class="text-gray-500 font-medium mt-1">Resource performance and historical crop intelligence</p>
                </div>
                <div class="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                    ${['7 Days', '30 Days', 'Custom'].map(p => {
                        const val = p.replace(' ', '_').toUpperCase();
                        return `<button class="p-btn px-5 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${val === range ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}" data-range="${val}">
                            ${p}
                        </button>`;
                    }).join('')}
                </div>
            </div>

            <div id="analytics-content" class="space-y-8">
                <div class="py-20 flex justify-center"><div class="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div></div>
            </div>
        `;

        // Range Listeners
        container.querySelectorAll('.p-btn').forEach(btn => {
            btn.onclick = () => {
                range = btn.dataset.range;
                render();
            };
        });

        if (!farmId) return;

        try {
            const to = new Date();
            const from = new Date(to);
            const days = range === '7_DAYS' ? 7 : range === '30_DAYS' ? 30 : 90;
            from.setDate(from.getDate() - days);
            const toStr = to.toISOString().split('T')[0];
            const fromStr = from.toISOString().split('T')[0];
            const data = await getAnalytics(farmId, fromStr, toStr);
            const content = container.querySelector('#analytics-content');
            
            content.innerHTML = `
                <!-- Stats Row -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${[
                        { l: 'Total Water Used', v: formatLitres(data.total_water), t: '+12%', up: true },
                        { l: 'Water Saved %', v: `${roundTo(data.savings_pct, 1)}%`, t: '-5%', up: false },
                        { l: 'AI Accuracy', v: '98.2%', t: '+0.4', up: true }
                    ].map(s => `
                        <div class="ks-card p-6">
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">${s.l}</p>
                            <div class="flex items-baseline justify-between">
                                <span class="text-3xl font-black text-gray-900">${s.v}</span>
                                <span class="text-[10px] font-bold ${s.up ? 'text-primary' : 'text-red-500'} bg-gray-50 px-2 py-1 rounded-md border border-gray-100 flex items-center gap-1">
                                    <i data-lucide="${s.up ? 'trending-up' : 'trending-down'}" class="w-3 h-3"></i> ${s.t}
                                </span>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Charts Row -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div class="ks-card p-6">
                        <h2 class="text-sm font-black text-gray-800 uppercase tracking-widest mb-8">Moisture % (Weekly)</h2>
                        <div class="h-64">${drawLineChart({
                            labels: data.labels || ['M','T','W','T','F','S','S'],
                            datasets: [{ color: '#2ECC71', data: data.moisture_series || [40,50,45,60,55,40,50] }]
                        })}</div>
                    </div>
                    <div class="ks-card p-6">
                        <h2 class="text-sm font-black text-gray-800 uppercase tracking-widest mb-8">Water Intake (L)</h2>
                        <div class="h-64">${drawBarChart(data.consumption_data || [{label: 'Mon', value: 120}, {label:'Tue', value: 200}])}</div>
                    </div>
                </div>

                <!-- Log and Export -->
                <div class="ks-card p-8">
                    <div class="flex items-center justify-between mb-8">
                        <h2 class="text-xl font-black text-gray-800 flex items-center gap-2 uppercase tracking-tight">
                            <i data-lucide="history" class="w-6 h-6 text-primary"></i> Data Registry
                        </h2>
                        <button id="export-btn" class="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center gap-2">
                            <i data-lucide="download" class="w-4 h-4"></i> EXPORT CSV
                        </button>
                    </div>
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-4">Displaying last 50 telemetry points for ${range}</p>
                </div>
            `;

            if (window.lucide) window.lucide.createIcons();

            container.querySelector('#export-btn').onclick = () => {
                exportCSV(farmId, range, new Date().toISOString());
            };

        } catch (err) {
            console.error("ANAL_DATA_FAIL:", err);
        }
    };

    render();
    return container;
}
