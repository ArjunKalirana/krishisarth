import { getDashboard } from '../api/farms.js';
import { store } from '../state/store.js';
import { t } from '../utils/i18n.js';
import { createSensorCard } from '../components/sensor-card.js';
import { createTankRing } from '../components/tank-ring.js';
import { countUp } from '../utils/dom.js';
import { showToast } from '../components/toast.js';
import { api } from '../api/client.js';

/**
 * Farmer's Control Center Dashboard
 * Mission-critical telemetry with high-fidelity UI.
 */
export function renderDashboard() {
    const container = document.createElement('div');
    container.className = "space-y-10 animate-in fade-in duration-700 pb-24 lg:pb-12";

    const farmId = store.getState('currentFarm')?.id;
    const farmer = store.getState('currentFarmer');

    // 1. Alert Ticker / Banner
    const topBar = document.createElement('div');
    topBar.id = "dashboard-alerts";
    container.appendChild(topBar);

    // 2. Main Layout Grid
    const mainContent = document.createElement('div');
    mainContent.id = "dashboard-main";
    mainContent.className = "grid grid-cols-1 lg:grid-cols-12 gap-10";
    mainContent.innerHTML = renderSkeleton();
    container.appendChild(mainContent);

    // 3. Load Data
    loadDashboardData(farmId, mainContent, topBar);

    // 4. Subscriptions
    store.subscribe('sensorData', () => {
        syncDashboardFromState(mainContent);
    });

    return container;
}

async function loadDashboardData(farmId, mainEl, alertEl) {
    if (!farmId) {
        mainEl.innerHTML = `<div class="lg:col-span-12">${renderEmptyState()}</div>`;
        attachListeners(null, mainEl);
        return;
    }

    try {
        const response = await getDashboard(farmId);
        if (response && response.success) {
            const data = response.data;
            store.setState('currentFarmDashboard', data);
            
            // Render the Full Control Center
            renderControlCenter(data, mainEl);
            
            const sensorMap = {};
            data.zones.forEach(z => sensorMap[z.id] = { moisture: z.moisture_pct, temp_c: z.temp_c, ec_ds_m: z.ec_ds_m });
            store.setState('sensorData', sensorMap);
        } else {
            alertEl.innerHTML = renderBanner('red', 'Connection to Field Core Lost');
        }
    } catch (err) {
        alertEl.innerHTML = renderBanner('red', 'Heartbeat Failure: Neural Segment Unreachable');
    }
}

function renderControlCenter(data, mainEl) {
    const weather = data.weather || {};
    
    mainEl.innerHTML = `
        <!-- LEFT: Primary Intelligence (Weather + Twin) -->
        <div class="lg:col-span-8 space-y-10">
            ${renderWeatherHero(weather)}
            
            <section class="stagger-in" style="animation-delay: 200ms">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h2 class="text-2xl font-black text-white font-display tracking-tight uppercase">Quantum Twin</h2>
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Real-time fidelity: 99.8%</p>
                    </div>
                    <a href="#farm3d" class="btn-emerald px-6 py-2.5 text-[10px] flex items-center gap-2">
                        <i data-lucide="maximize-2" class="w-4 h-4"></i> Enter Simulation
                    </a>
                </div>
                <!-- Elevated Twin Preview -->
                <div class="relative w-full h-[400px] rounded-[2.5rem] overflow-hidden border border-white/5 bg-[#0a0f0d] shadow-[0_20px_60px_rgba(0,0,0,0.6)] group">
                    <img src="./assets/images/digital_twin.png" class="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[10s]" alt="">
                    <div class="absolute inset-0 bg-gradient-to-t from-[#0a0f0d] via-transparent to-transparent"></div>
                    
                    <!-- Quick Stats Overlay -->
                    <div class="absolute bottom-8 left-8 right-8 flex justify-between items-end">
                        <div class="space-y-4">
                            <div class="flex gap-4">
                                <div class="glass-hud px-4 py-2 rounded-xl flex items-center gap-2 border-white/10">
                                    <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span class="text-[9px] font-black text-white uppercase tracking-widest">Active nodes: ${data.zones.length}</span>
                                </div>
                                <div class="glass-hud px-4 py-2 rounded-xl flex items-center gap-2 border-white/10">
                                    <i data-lucide="droplets" class="w-3.5 h-3.5 text-blue-400"></i>
                                    <span class="text-[9px] font-black text-white uppercase tracking-widest">Optimal Range</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Plot Status Grid -->
            <section class="stagger-in" style="animation-delay: 400ms">
                <div class="flex items-center justify-between mb-8">
                    <h2 class="text-2xl font-black text-white font-display tracking-tight uppercase">Field Status</h2>
                    <button id="add-zone-btn" class="p-2 border border-white/5 rounded-xl hover:bg-white/5 transition-all">
                        <i data-lucide="plus" class="w-5 h-5 text-slate-400"></i>
                    </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    ${data.zones.map(zone => renderPlotNode(zone)).join('')}
                </div>
            </section>
        </div>

        <!-- RIGHT: Efficiency & Insights -->
        <div class="lg:col-span-4 space-y-10">
            <!-- Global Efficiency -->
            <div class="elite-card p-8 space-y-8 bg-gradient-to-br from-[#111827] to-[#0b1210]">
                <div>
                    <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Yield Protection</p>
                    <div class="flex items-baseline gap-2">
                        <span class="text-5xl font-black text-white font-display tracking-tighter">94</span>
                        <span class="text-xl font-bold text-emerald-500">%</span>
                    </div>
                </div>
                
                <div class="space-y-6">
                    ${renderMiniMetric('Water Deficit', '0.2L/m²', 'text-blue-400', 15)}
                    ${renderMiniMetric('Resource Waste', '1.4%', 'text-red-400', 8)}
                    ${renderMiniMetric('AI Confidence', '98.2%', 'text-emerald-400', 98)}
                </div>

                <button class="w-full btn-emerald py-4 text-xs font-black tracking-widest">
                    Run Optimization Scan
                </button>
            </div>

            <!-- AI Insight Panel -->
            <div class="glass-hud p-8 rounded-[2rem] border-emerald-500/10 relative overflow-hidden">
                <div class="absolute -right-10 -top-10"><i data-lucide="brain" class="w-32 h-32 text-emerald-500/5"></i></div>
                <h3 class="text-emerald-400 font-display font-black text-sm uppercase tracking-widest mb-6 flex items-center gap-3">
                    <i data-lucide="sparkles" class="w-5 h-5"></i> AI Intelligence
                </h3>
                <p class="text-slate-300 text-sm leading-relaxed mb-6 font-medium">
                    "Based on current <span class="text-emerald-400">humidity spikes</span> and soil moisture in Plot A, I recommend advancing the evening irrigation cycle by 45 minutes to prevent osmotic stress."
                </p>
                <div class="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                    <div class="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-400"></i>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-white uppercase tracking-widest">Auto-Correction</p>
                        <p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Standby (Authorization Req)</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    attachListeners(data, mainEl);
    if (window.lucide) window.lucide.createIcons();
}

function renderWeatherHero(weather) {
    const temp = weather.temp || 28;
    const cond = weather.condition || 'Clear';
    const condId = weather.id || 800;
    
    let themeClass = 'condition-clear';
    let gradient = 'from-[#10b981]/10 via-[#0b1210] to-[#0b1210]';
    let icon = '☀️';

    if (condId >= 200 && condId < 600) { 
        themeClass = 'condition-rain';
        icon = '🌧️';
    } else if (condId >= 600 && condId < 700) {
        themeClass = 'condition-storm';
        icon = '❄️';
    } else if (condId > 800) {
        themeClass = 'condition-cloudy';
        icon = '☁️';
    }

    return `
        <div class="weather-hero ${themeClass} relative w-full p-10 rounded-[3rem] overflow-hidden stagger-in">
            <div class="absolute -right-10 -top-10 text-[12rem] opacity-10 pointer-events-none">${icon}</div>
            
            <div class="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                <div class="space-y-4 text-center md:text-left">
                    <div class="flex items-center gap-3 justify-center md:justify-start">
                        <p class="text-[11px] font-black text-emerald-400 uppercase tracking-[0.3em]">Environmental Awareness</p>
                        ${weather.is_live ? `
                            <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/20">
                                <span class="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span class="text-[7px] font-black text-emerald-400 uppercase tracking-widest">LIVE Intelligence</span>
                            </div>
                        ` : ''}
                    </div>
                    <h1 class="text-8xl md:text-9xl font-black text-white font-display tracking-tighter leading-none">
                        ${temp}<span class="text-emerald-500/50">°</span>
                    </h1>
                    <div class="flex items-center gap-4 justify-center md:justify-start">
                        <span class="text-2xl font-bold text-white">${cond}</span>
                        <span class="text-slate-500">|</span>
                        <span class="text-sm font-medium text-slate-400">Precipitation: ${weather.rain_1h || 0}mm</span>
                    </div>
                </div>

                <div class="flex gap-4">
                    ${renderWeatherPill('Humidity', weather.humidity + '%', 'droplets')}
                    ${renderWeatherPill('Wind', weather.wind + ' km/h', 'wind')}
                </div>
            </div>
        </div>
    `;
}

function renderPlotNode(zone) {
    const crops = {
        tomato: '🍅', grape: '🍇', onion: '🧅', wheat: '🌾', chilli: '🌶️'
    };
    const emoji = crops[zone.crop_type?.toLowerCase()] || '🌱';
    const moisture = zone.moisture_pct || 0;
    const isDry = moisture < 30;

    return `
        <div class="elite-card group hover:border-emerald-500/40 p-6 flex flex-col gap-6">
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                        ${emoji}
                    </div>
                    <div>
                        <h4 class="font-black text-white uppercase tracking-tight">${zone.name}</h4>
                        <p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">${zone.crop_type} • ${zone.crop_stage}</p>
                    </div>
                </div>
                <div class="px-3 py-1 bg-white/5 border border-white/5 rounded-full">
                    <span class="text-[9px] font-black ${isDry ? 'text-red-400' : 'text-emerald-400'} uppercase">Node ${isDry ? 'Dry' : 'OK'}</span>
                </div>
            </div>

            <div class="space-y-4">
                <div class="space-y-2">
                    <div class="flex justify-between items-end">
                        <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Soil Moisture</span>
                        <span class="text-sm font-black text-white font-mono">${moisture}%</span>
                    </div>
                    <div class="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div class="h-full ${isDry ? 'bg-red-500' : 'bg-emerald-500'} transition-all duration-1000" style="width: ${moisture}%"></div>
                    </div>
                </div>

                <!-- Nutrient HUD -->
                <div class="grid grid-cols-3 gap-3 pt-2 border-t border-white/5">
                    <div class="text-center">
                        <p class="text-[8px] font-black text-slate-500 uppercase mb-1">Nitrogen</p>
                        <p class="text-[11px] font-bold text-white">${zone.nutrients?.N || 0}<span class="text-[8px] text-slate-500 ml-0.5">mg</span></p>
                    </div>
                    <div class="text-center">
                        <p class="text-[8px] font-black text-slate-500 uppercase mb-1">Phosphorus</p>
                        <p class="text-[11px] font-bold text-white">${zone.nutrients?.P || 0}<span class="text-[8px] text-slate-500 ml-0.5">mg</span></p>
                    </div>
                    <div class="text-center">
                        <p class="text-[8px] font-black text-slate-500 uppercase mb-1">Potassium</p>
                        <p class="text-[11px] font-bold text-white">${zone.nutrients?.K || 0}<span class="text-[8px] text-slate-500 ml-0.5">mg</span></p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderWeatherPill(label, value, icon) {
    return `
        <div class="glass-hud p-6 rounded-[2.5rem] flex flex-col items-center justify-center min-w-[120px] aspect-square border-white/5">
            <i data-lucide="${icon}" class="w-5 h-5 text-emerald-400 mb-3"></i>
            <span class="text-xl font-black text-white font-mono">${value}</span>
            <span class="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">${label}</span>
        </div>
    `;
}

function renderMiniMetric(label, value, colorClass, percent) {
    return `
        <div class="space-y-2">
            <div class="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span class="text-slate-500">${label}</span>
                <span class="${colorClass}">${value}</span>
            </div>
            <div class="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div class="h-full ${colorClass.replace('text-', 'bg-')} opacity-60" style="width: ${percent}%"></div>
            </div>
        </div>
    `;
}

function renderSkeleton() {
    return `
        <div class="lg:col-span-8 space-y-12">
            <div class="h-[300px] w-full bg-white/5 rounded-[3rem] ks-shimmer"></div>
            <div class="h-[400px] w-full bg-white/5 rounded-[2.5rem] ks-shimmer"></div>
        </div>
        <div class="lg:col-span-4 h-[600px] bg-white/5 rounded-[2.5rem] ks-shimmer"></div>
    `;
}

// ... existing helper functions (renderBanner, renderEmptyState, attachListeners) ...
// Note: I will append those in the next step to keep this clean.
function renderBanner(color, msg) {
    const bg = color === 'red' ? 'bg-red-500' : 'bg-amber-500';
    return `<div class="${bg} text-white px-4 py-2 rounded-xl mb-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-in slide-in-from-top-2">
        <i data-lucide="info" class="w-4 h-4"></i> ${msg}
    </div>`;
}

function renderEmptyState() {
     return `
        <div class="flex flex-col items-center justify-center py-40 glass-panel">
            <h2 class="text-4xl font-black text-white mb-6 font-display tracking-tighter">Initializing Field Intelligence...</h2>
            <button id="rescue-demo-btn" class="btn-emerald px-10 py-4">Provision Default Farm</button>
        </div>
    `;
}

function attachListeners(data, mainEl) {
    const addBtn = mainEl.querySelector('#add-zone-btn');
    if (addBtn) {
        addBtn.onclick = () => {
             showToast('Registering new plot segment...', 'info');
             // In a real app, open the modal logic here
        };
    }
    
    const rescueBtn = mainEl.querySelector('#rescue-demo-btn');
    if (rescueBtn) {
        rescueBtn.onclick = async () => {
            rescueBtn.disabled = true;
            try {
                await api('/demo/history', { method: 'POST' });
                showToast('Hardware provisioned! Syncing...', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } catch (e) {
                showToast('Provisioning failed', 'error');
                rescueBtn.disabled = false;
            }
        };
    }
}

function syncDashboardFromState(mainEl) {
    const data = store.getState('currentFarmDashboard'); 
    if (data) renderControlCenter(data, mainEl);
}
