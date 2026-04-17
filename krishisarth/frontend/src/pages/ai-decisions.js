import { getDecisions, runDecision } from '../api/ai.js';
import { store } from '../state/store.js';
import { t } from '../utils/i18n.js';
import { api } from '../api/client.js';
import { formatDate, roundTo } from '../utils/format.js';

/**
 * AI Decisions Page (Elite Edition)
 * Visualizes the reasoning chain and triggers neural audits.
 */
export function renderAIDecisions() {
    const container = document.createElement('div');
    container.className = "space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700";

    // 1. Fluid Header
    const header = document.createElement('div');
    header.className = "flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-4";
    header.innerHTML = `
        <div class="space-y-1">
            <h1 class="ks-text-fluid-lg tracking-tight text-white font-display">
                Neural <span class="text-emerald-500">Intelligence</span>
            </h1>
            <p class="text-slate-400 font-medium text-sm">
                Real-time inference logs and decision-chain telemetry.
            </p>
        </div>
        <button id="run-ai-btn" class="btn-elite flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-4">
            <i data-lucide="zap" class="w-5 h-5 text-yellow-400"></i>
            <span>RUN NEURAL AUDIT</span>
        </button>
    `;
    container.appendChild(header);

    // 2. Operational Core
    const mainGrid = document.createElement('div');
    mainGrid.className = "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start";
    container.appendChild(mainGrid);

    _loadAI(mainGrid, container.querySelector('#run-ai-btn'));

    // 3. Performance Analytics
    const twinPerSection = document.createElement('div');
    twinPerSection.id = "twin-performance-section";
    twinPerSection.className = "mt-16 w-full"; 
    container.appendChild(twinPerSection);
    
    _loadTwinPerformance(twinPerSection);

    return container;
}

async function _loadAI(gridEl, runBtn) {
    const farm = store.getState('currentFarm');

    if (!farm?.id) {
        gridEl.innerHTML = `<div class="lg:col-span-12 flex flex-col items-center justify-center py-40 gap-6 glass-panel">
            <div class="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
            <p class="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Initializing Inference Core...</p>
        </div>`;
        
        setTimeout(() => {
            const retryFarm = store.getState('currentFarm');
            if (retryFarm?.id) _loadAI(gridEl, runBtn);
            else gridEl.innerHTML = `<div class="lg:col-span-12 glass-panel p-20 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">Awaiting Farm Registration...</div>`;
        }, 1000);
        return;
    }

    gridEl.innerHTML = `<div class="lg:col-span-12 flex flex-col items-center justify-center py-40 gap-6 glass-panel">
        <div class="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        <p class="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Fetching Live Telemetry...</p>
    </div>`;

    let zones = [];
    try {
        const dashRes = await api(`/farms/${farm.id}/dashboard`);
        zones = dashRes?.data?.zones || [];
    } catch {
        try {
            const farmRes = await api(`/farms/${farm.id}/`);
            zones = farmRes?.data?.zones || farmRes?.data || [];
        } catch (err) { console.error('[AI] Load Error', err); }
    }

    if (zones.length === 0) {
        gridEl.innerHTML = `<div class="lg:col-span-12 glass-panel p-20 text-center border-dashed border-slate-700/50">
            <i data-lucide="brain-circuit" class="w-16 h-16 mx-auto mb-6 text-slate-700 animate-pulse"></i>
            <h3 class="text-xl font-black text-white font-display mb-2">No Active Zones</h3>
            <p class="text-slate-500 text-xs font-medium max-w-xs mx-auto">Neural monitoring requires at least one registered plot.</p>
        </div>`;
        return;
    }

    const firstZone = zones[0];

    let decisions = [];
    try {
        const res = await api(`/zones/${firstZone.id}/ai-decisions/?limit=5`);
        decisions = res?.data || [];
    } catch { decisions = []; }

    gridEl.innerHTML = `
        <!-- High-Tech Terminal -->
        <div class="lg:col-span-5 glass-panel overflow-hidden flex flex-col shadow-2xl border-emerald-500/10 bg-slate-950/80">
            <div class="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-white/5">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span class="font-black text-slate-500 uppercase tracking-[0.3em] text-[10px] font-mono">
                        Live_Telemetry_Stream.log
                    </span>
                </div>
                <div class="flex gap-1.5 opacity-40">
                    <div class="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                    <div class="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                    <div class="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                </div>
            </div>
            <div class="p-8 space-y-4 font-mono">
                <p class="font-bold mb-6 text-emerald-400/50 text-[10px]">
                    >> SYSTEM_STATE: <span class="text-emerald-500">STABLE</span> · CORE: v2.4.0_ALPHA
                </p>
                ${[
                    ['SOIL_MOISTURE',  `${(firstZone.moisture_pct || 0).toFixed(1)}%`],
                    ['AMBIENT_TEMP',   firstZone.temp_c ? `${firstZone.temp_c.toFixed(1)}°C` : '— °C'],
                    ['EC_POTENTIAL',   firstZone.ec_ds_m ? `${firstZone.ec_ds_m.toFixed(2)} dS/m` : '— dS/m'],
                    ['ACTUATOR_STS',   firstZone.pump_running ? 'RUNNING' : 'STANDBY'],
                    ['TARGET_ZONE',    firstZone.name.toUpperCase()],
                    ['TOTAL_NODES',    `${zones.length} ACTIVE`]
                ].map(([k, v]) => `
                    <div class="flex justify-between items-center text-[12px] group py-1 border-b border-white/5 last:border-0">
                        <span class="text-slate-500 font-bold group-hover:text-emerald-500 transition-colors">> ${k}</span>
                        <span class="text-white font-black">${v}</span>
                    </div>
                `).join('')}
                <div class="mt-8 pt-4 border-t border-white/5 text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">
                    Synchronized with Hardware Controller 0x${firstZone.id.slice(0,8)}
                </div>
            </div>
        </div>

        <!-- Decisions Feed -->
        <div class="lg:col-span-7 flex flex-col gap-6">
            <div class="space-y-6" id="decisions-panel">
                ${decisions.length > 0
                    ? decisions.map(d => _decisionCard(d)).join('')
                    : `<div class="glass-panel p-20 text-center border-dashed border-slate-700/50">
                        <i data-lucide="brain" class="w-12 h-12 mx-auto mb-4 text-slate-800"></i>
                        <p class="font-black text-slate-500 uppercase tracking-widest text-[10px]">
                            Neural history empty
                        </p>
                        <p class="text-slate-600 text-[10px] mt-4 font-medium italic">
                            Trigger a manual audit to initialize inference logic.
                        </p>
                      </div>`
                }
            </div>

            <!-- Communication Channels HUD -->
            <div class="glass-panel p-8 bg-slate-900/20 mt-4 border-emerald-500/5">
                <div class="flex items-center justify-between mb-8">
                    <div>
                        <h3 class="text-xs font-black uppercase text-white tracking-[0.2em] font-display flex items-center gap-3">
                            <i data-lucide="satellite" class="w-4 h-4 text-emerald-400"></i>
                            Communication Links
                        </h3>
                        <p class="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">Autonomous Notification Matrix</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    ${[
                        { id: 'whatsapp', label: 'WhatsApp', icon: 'message-circle', active: true },
                        { id: 'sms', label: 'SMS/GSM', icon: 'smartphone', active: true },
                        { id: 'email', label: 'Cloud Node', icon: 'mail', active: false },
                        { id: 'push', label: 'HUD Push', icon: 'bell', active: true }
                    ].map(ch => `
                        <div class="flex items-center justify-between p-4 rounded-2xl glass-panel ${ch.active ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-900/40 border-slate-800 opacity-50'} shadow-sm transition-all hover:scale-[1.02]">
                            <div class="flex items-center gap-4">
                                <div class="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
                                    <i data-lucide="${ch.icon}" class="w-4 h-4 ${ch.active ? 'text-emerald-400' : 'text-slate-600'}"></i>
                                </div>
                                <span class="text-[10px] font-black uppercase tracking-widest ${ch.active ? 'text-white' : 'text-slate-600'}">${ch.label}</span>
                            </div>
                            <div class="w-8 h-4 bg-slate-800 rounded-full relative p-0.5">
                                <div class="absolute top-0.5 ${ch.active ? 'right-0.5 bg-emerald-500' : 'left-0.5 bg-slate-600'} w-3 h-3 rounded-full shadow-sm transition-all"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    runBtn.onclick = async () => {
        runBtn.disabled = true;
        const originalHtml = runBtn.innerHTML;
        runBtn.innerHTML = `<div class="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin"></div> <span>CALCULATING...</span>`;
        try {
            const res = await api(`/zones/${firstZone.id}/ai-decisions/run/`, { method: 'POST' });
            const panel = gridEl.querySelector('#decisions-panel');
            if (panel && res?.data) {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = _decisionCard(res.data);
                panel.prepend(wrapper.firstElementChild);
                const empty = panel.querySelector('.text-slate-500');
                if (empty?.closest('.glass-panel')) empty.closest('.glass-panel').remove();
                if (window.lucide) window.lucide.createIcons();
                
                const type = res.data.type || res.data.decision_type || 'analysis';
                if (type === 'irrigate' || type === 'alert') showWhatsAppNotification(firstZone.name, res.data.water_volume_l || 14);
            }
        } catch (err) {
            showToast('Neural Audit Fault: Protocol rejected', 'error');
        } finally {
            runBtn.disabled = false;
            runBtn.innerHTML = originalHtml;
        }
    };
}

function _decisionCard(d) {
    const conf = Math.round((d.confidence || 0) * 100);
    const type = d.type || d.decision_type || 'analysis';
    const snapshot = d.snapshot || d.input_snapshot || {};
    
    // Elite Semantic Theming
    const themes = {
        irrigate: { color: '#10b981', label: 'ACTION: IRRIGATE', bg: 'rgba(16,185,129,0.05)', border: 'rgba(16,185,129,0.2)' },
        skip:     { color: '#64748b', label: 'STATE: OPTIMAL', bg: 'rgba(100,116,139,0.05)', border: 'rgba(100,116,139,0.2)' },
        alert:    { color: '#f43f5e', label: 'CRITICAL: ANOMALY', bg: 'rgba(244,63,94,0.05)', border: 'rgba(244,63,94,0.2)' }
    };
    const theme = themes[type] || themes.skip;

    return `
        <div class="ks-card glass-panel p-8 relative overflow-hidden transition-all duration-500 border-l-4" style="border-left-color: ${theme.color}; background: ${theme.bg};">
            <div class="flex items-start justify-between mb-6">
                <div>
                    <h2 class="text-xl font-black text-white font-display tracking-tight">${theme.label}</h2>
                    <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">
                        ${d.created_at ? new Date(d.created_at).toLocaleString() : 'JUST NOW'}
                    </p>
                </div>
                <div class="flex items-center gap-4">
                    <div class="px-4 py-2 rounded-xl glass-panel bg-white/5 border-white/5 flex items-center gap-3">
                        <span class="text-xs font-black text-white font-display">${conf}%</span>
                        <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest hidden sm:block">TRUST</span>
                    </div>
                </div>
            </div>
            
            <p class="text-slate-200 leading-relaxed text-sm mb-8 font-medium">
                <span class="text-emerald-500 font-black uppercase text-[10px] tracking-widest block mb-2">Sarth's Reasoning — </span>
                "${d.reasoning || 'Neural inference stable. No action required.'}"
            </p>

            ${snapshot.N !== undefined ? `
                <div class="flex items-center gap-6 mb-8 p-4 bg-black/20 rounded-2xl border border-white/5">
                    <div class="flex flex-col">
                        <span class="text-[8px] font-black text-slate-500 uppercase tracking-widest">NPK Balance</span>
                        <span class="text-xs font-bold text-emerald-400">${snapshot.N}-${snapshot.P}-${snapshot.K}</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[8px] font-black text-slate-500 uppercase tracking-widest">ML Fertility</span>
                        <span class="text-xs font-bold text-slate-200">${snapshot.fertility_label || 'Analysis Pending'}</span>
                    </div>
                    <div class="flex flex-col border-l border-white/10 pl-6">
                        <span class="text-[8px] font-black text-slate-500 uppercase tracking-widest">Snapshot Moisture</span>
                        <span class="text-xs font-bold text-blue-400 font-mono">${(snapshot.moisture_pct || 0).toFixed(1)}%</span>
                    </div>
                </div>
            ` : ''}
            
            <!-- Logic Chain Metadata -->
            <div class="flex flex-wrap gap-3">
                <span class="badge-elite badge-success text-[9px] uppercase tracking-widest">Model: Llama3-70B via Groq</span>
                <span class="badge-elite badge-info text-[9px] uppercase tracking-widest">Source: MongoDB Live Shard</span>
                <span class="badge-elite ${conf > 80 ? 'badge-success' : 'badge-warning'} text-[9px] uppercase tracking-widest font-black">${conf > 80 ? 'AUTO_EXECUTE' : 'PENDING_HUB_AUDIT'}</span>
            </div>
        </div>
    `;
}

async function _loadTwinPerformance(container) {
    const farm = store.getState('currentFarm');
    if (!farm?.id) return;
    
    try {
        const res = await api(`/farms/${farm.id}/twin/status`);
        const status = res?.data;
        const history = JSON.parse(localStorage.getItem('ks_twin_history') || '[]').reverse().slice(0, 10);

        container.innerHTML = `
            <div class="space-y-10">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div class="space-y-1">
                        <h2 class="text-3xl font-black text-white font-display tracking-tight">Machine <span class="text-emerald-500">Intelligence</span> Profile</h2>
                        <p class="text-slate-400 font-medium text-sm">Simulated vs Actual calibration telemetry.</p>
                    </div>
                    <button id="recalibrate-btn" class="btn-elite py-3 px-8 text-xs">RE-CALIBRATE TWIN</button>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- High-Focus Metric -->
                    <div class="ks-card glass-panel p-10 flex flex-col items-center justify-center text-center gap-4 bg-emerald-500/5 border-emerald-500/20">
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Mean Absolute Error</p>
                        <div class="text-7xl font-black text-white font-display font-mono" style="filter: drop-shadow(0 0 15px rgba(16,185,129,0.3));">
                            ${status.mae_score.toFixed(3)}
                        </div>
                        <div class="flex items-center gap-3">
                             <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                             <span class="text-[10px] font-black text-emerald-400 uppercase tracking-widest">${status.trust_level} TRUST STATE</span>
                        </div>
                    </div>

                    <!-- Visual Telemetry -->
                    <div class="ks-card glass-panel p-10 lg:col-span-2 flex flex-col justify-between">
                        <div class="flex justify-between items-center mb-10">
                            <div>
                                <h4 class="text-lg font-black text-white font-display">Neural Drift Analysis</h4>
                                <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Convergence over last 10 shards</p>
                            </div>
                            <div class="text-right">
                                <p class="text-2xl font-black text-white font-display">${status.total_simulations_run}</p>
                                <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Inferences</p>
                            </div>
                        </div>
                        
                        <div class="relative h-24 w-full">
                            <svg width="100%" height="100%" viewBox="0 0 500 100" preserveAspectRatio="none">
                                <path d="M0,80 Q50,70 100,75 T200,60 T300,65 T400,50 T500,55" fill="none" stroke="rgba(16,185,129,0.1)" stroke-width="8" stroke-linecap="round" />
                                <path d="M0,80 Q50,70 100,75 T200,60 T300,65 T400,50 T500,55" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" style="filter: drop-shadow(0 0 8px #10b981);" />
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- Simulation Shard Ledger -->
                <div class="ks-card glass-panel overflow-hidden">
                    <div class="px-8 py-6 bg-white/5 border-b border-white/5 flex justify-between items-center">
                        <h3 class="font-black text-white font-display text-lg tracking-tight">Intelligence Log</h3>
                        <span class="badge-elite badge-success text-[9px]">LATEST SHARDS</span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead class="bg-white/5 border-b border-white/5">
                                <tr class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                    <th class="px-8 py-5">Node Designation</th>
                                    <th class="px-8 py-5">Temporal Index</th>
                                    <th class="px-8 py-5">Predicted %</th>
                                    <th class="px-8 py-5">Observed %</th>
                                    <th class="px-8 py-5">Variance</th>
                                    <th class="px-8 py-5">Efficiency</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-white/5">
                                ${history.length === 0 ? `<tr><td colspan="6" class="px-8 py-20 text-center text-slate-500 font-black uppercase tracking-widest text-[10px]">Vault empty. Simulation required.</td></tr>` : ''}
                                ${history.map(row => `
                                    <tr class="hover:bg-white/5 transition-colors group">
                                        <td class="px-8 py-5 font-black text-white text-xs tracking-widest">${row.zone_name.toUpperCase()}</td>
                                        <td class="px-8 py-5 text-slate-500 font-mono text-[11px]">${new Date(row.timestamp).toLocaleTimeString()}</td>
                                        <td class="px-8 py-5 font-black text-white font-mono">${row.predicted_moisture.toFixed(1)}%</td>
                                        <td class="px-8 py-5 font-black text-slate-300 font-mono">${row.actual_moisture ? row.actual_moisture.toFixed(1) + '%' : '—'}</td>
                                        <td class="px-8 py-5 font-black ${Math.abs(row.predicted_moisture - (row.actual_moisture || 0)) < 10 ? 'text-emerald-500' : 'text-red-500'} font-mono">
                                            ${row.actual_moisture ? Math.abs(row.predicted_moisture - row.actual_moisture).toFixed(2) : 'PENDING'}
                                        </td>
                                        <td class="px-8 py-5">
                                            <div class="flex items-center gap-3">
                                                <div class="flex-1 h-1.5 bg-slate-900 rounded-full border border-white/5 max-w-[60px]">
                                                    <div class="h-full bg-emerald-500 rounded-full" style="width: ${row.efficiency_score * 100}%"></div>
                                                </div>
                                                <span class="text-[10px] font-black text-slate-500 font-mono">${(row.efficiency_score * 100).toFixed(0)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        container.querySelector('#recalibrate-btn').onclick = async (e) => {
            const btn = e.target;
            btn.innerHTML = 'CALIBRATING...';
            btn.disabled = true;
            try {
                await api(`/farms/${farm.id}/twin/calibrate`, { method: 'POST' });
                showToast('Calibration Sequence Finalized', 'success');
                setTimeout(() => _loadTwinPerformance(container), 1000);
            } catch {
                showToast('Calibration Failed', 'error');
                btn.disabled = false;
                btn.innerHTML = 'RE-CALIBRATE TWIN';
            }
        };
    } catch(e) { console.error("Twin Load Fail", e); }
}

function showWhatsAppNotification(zoneName, volume) {
    let mock = document.getElementById('whatsapp-mock-notification');
    if (mock) mock.remove();

    mock = document.createElement('div');
    mock.id = 'whatsapp-mock-notification';
    mock.className = "fixed top-0 right-4 w-[360px] max-w-[calc(100vw-32px)] z-[9999] shadow-2xl rounded-3xl overflow-hidden font-sans transition-all duration-700 translate-y-[-120%]";
    mock.style.backgroundColor = "rgba(10, 20, 15, 0.95)";
    mock.style.backdropFilter = "blur(20px)";
    mock.style.border = "1px solid rgba(16, 185, 129, 0.2)";

    mock.innerHTML = `
        <div class="bg-emerald-500/10 px-5 py-4 flex items-center gap-4 border-b border-emerald-500/10">
            <div class="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                <i data-lucide="message-circle" class="w-5 h-5 text-white"></i>
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="text-xs font-black text-white uppercase tracking-[0.1em] font-display">Neural Alert Protocol</h4>
                <p class="text-[9px] text-emerald-500 font-black uppercase tracking-widest mt-0.5">Live via Neural-Link</p>
            </div>
        </div>
        <div class="p-6">
            <div class="bg-slate-900/60 rounded-2xl p-5 border border-white/5 shadow-inner">
                <p class="text-sm text-slate-200 font-medium leading-relaxed">
                    Artificial Intelligence identifies irrigation necessity for <span class="text-emerald-400 font-black">${zoneName}</span>. 
                    Recommended volume: <span class="text-emerald-400 font-black">${volume}L</span>.
                </p>
                <div class="grid grid-cols-2 gap-3 mt-6">
                    <button class="bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20">IRRIGATE</button>
                    <button class="bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl transition-all">STANDBY</button>
                </div>
            </div>
            <div class="mt-4 flex justify-end">
                <span class="text-[8px] text-slate-600 font-black font-mono">ENCRYPTED_PACKET_v2</span>
            </div>
        </div>
    `;

    document.body.appendChild(mock);
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => { mock.style.transform = "translateY(24px)"; }, 100);
    setTimeout(() => {
        if(mock) {
            mock.style.transform = "translateY(-120%)";
            setTimeout(() => mock.remove(), 700);
        }
    }, 6000);
}
