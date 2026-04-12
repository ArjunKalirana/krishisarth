import { getDecisions, runDecision } from '../api/ai.js';
import { store } from '../state/store.js';
import { t } from '../utils/i18n.js';
import { api } from '../api/client.js';
import { formatDate, roundTo } from '../utils/format.js';

/**
 * Dynamic AI Decisions Page
 * Visualizes the reasoning chain and triggers audits.
 */
export function renderAIDecisions() {
    const container = document.createElement('div');
    container.className = "space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700";

    // 1. Page Header with Trigger
    const header = document.createElement('div');
    header.className = "flex flex-col md:flex-row md:items-end justify-between gap-6";
    header.innerHTML = `
        <div>
            <h1 class="text-3xl font-extrabold text-gray-900" data-i18n="ai_title">${t('ai_title')}</h1>
            <p class="text-gray-500 font-medium mt-1" data-i18n="ai_subtitle">${t('ai_subtitle')}</p>
        </div>
        <button id="run-ai-btn" class="bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-xl font-black text-sm transition-all shadow-xl active:scale-95 flex items-center gap-3">
            <i data-lucide="zap" class="w-5 h-5 text-yellow-400"></i> <span data-i18n="ai_run_btn">${t('ai_run_btn')}</span>
        </button>
    `;
    container.appendChild(header);

    // 2. Content Grid
    const mainGrid = document.createElement('div');
    mainGrid.className = "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start";
    container.appendChild(mainGrid);

    // Initial Load
    _loadAI(mainGrid, container.querySelector('#run-ai-btn'));

    // 3. Digital Twin Performance Section
    const twinPerSection = document.createElement('div');
    twinPerSection.id = "twin-performance-section";
    twinPerSection.className = "mt-12 w-full"; // Added w-full for correct spanning
    container.appendChild(twinPerSection);
    
    // Load Twin Data
    _loadTwinPerformance(twinPerSection);

    return container;
}

async function _loadAI(gridEl, runBtn) {
    const farm = store.getState('currentFarm');

    if (!farm?.id) {
        // Farm not loaded yet — wait 800ms and retry once
        gridEl.innerHTML = `<div class="lg:col-span-12 flex justify-center py-20">
            <div class="w-10 h-10 border-4 border-primary/20 border-t-primary 
                        rounded-full animate-spin"></div>
        </div>`;
        setTimeout(() => {
            const retryFarm = store.getState('currentFarm');
            if (retryFarm?.id) {
                _loadAI(gridEl, runBtn);
            } else {
                gridEl.innerHTML = `<div class="lg:col-span-12 ks-card p-10 
                    text-center text-gray-400 font-bold">
                    ${t('ai_no_farm')}
                </div>`;
            }
        }, 1000);
        return;
    }

    gridEl.innerHTML = `<div class="lg:col-span-12 flex justify-center py-20">
        <div class="w-10 h-10 border-4 border-primary/20 border-t-primary 
                    rounded-full animate-spin"></div>
    </div>`;

    // Get zones — try dashboard endpoint first (has sensor data), 
    // fall back to farm detail endpoint
    let zones = [];
    try {
        const dashRes = await api(`/farms/${farm.id}/dashboard`);
        zones = dashRes?.data?.zones || [];
        console.log('[AI] Zones from dashboard:', zones.length);
    } catch {
        try {
            const farmRes = await api(`/farms/${farm.id}/`);
            // Handle both response shapes
            zones = farmRes?.data?.zones || farmRes?.data || [];
            if (!Array.isArray(zones)) zones = [];
            console.log('[AI] Zones from farm endpoint:', zones.length);
        } catch (err) {
            console.error('[AI] Failed to load zones:', err.message);
        }
    }

    // Fallback: if dashboard returned 0 zones, hit the farm zones endpoint directly
    if (zones.length === 0) {
        // One more retry after 2s — simulation might still be initializing
        await new Promise(r => setTimeout(r, 2000));
        try {
            const retryRes = await api(`/farms/${farm.id}/dashboard`);
            zones = retryRes?.data?.zones || [];
        } catch {}
    }

    if (zones.length === 0) {
        gridEl.innerHTML = `<div class="lg:col-span-12 ks-card p-10 text-center">
            <p class="text-gray-400 font-bold text-sm">No zones found for this farm.</p>
            <p class="text-gray-300 text-xs mt-2">
                Visit <code class="bg-gray-800 px-1 rounded">/v1/demo/history</code> 
                to seed demo data, then refresh.
            </p>
        </div>`;
        return;
    }

    const firstZone = zones[0];

    // Load existing AI decisions for the first zone
    let decisions = [];
    try {
        const res = await api(`/zones/${firstZone.id}/ai-decisions/?limit=5`);
        decisions = res?.data || [];
    } catch {
        decisions = [];
    }

    // Build the terminal + decisions layout
    gridEl.innerHTML = `
        <!-- Terminal panel -->
        <div class="lg:col-span-5 ks-card overflow-hidden flex flex-col shadow-2xl" 
             style="background:#0d1a12; border-color:rgba(26,122,74,0.2);">
            <div style="background:rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.1);"
                 class="px-4 py-3 flex items-center justify-between">
                <span class="font-bold text-white/30 uppercase tracking-widest"
                      style="font-size:10px; font-family:var(--font-mono, monospace);" data-i18n="ai_terminal_title">
                    ${t('ai_terminal_title')}
                </span>
                <div class="flex gap-1.5">
                    <div class="w-2 h-2 rounded-full bg-red-500/60"></div>
                    <div class="w-2 h-2 rounded-full bg-yellow-500/60"></div>
                    <div class="w-2 h-2 rounded-full bg-green-500/60 animate-pulse"></div>
                </div>
            </div>
            <div class="p-6 space-y-3" style="font-family:var(--font-mono, monospace);">
                <p class="font-bold mb-4" style="color:rgba(74,222,128,0.5); font-size:10px;">
                    > <span data-i18n="ai_system_ready">${t('ai_system_ready')}</span>: INFERENCE_CORE_v4.2
                </p>
                ${[
                    ['SOIL_MOISTURE',  `${(firstZone.moisture_pct || 0).toFixed(1)}%`],
                    ['AMBIENT_TEMP',   firstZone.temp_c ? `${firstZone.temp_c.toFixed(1)}°C` : '— °C'],
                    ['EC_LEVEL',       firstZone.ec_ds_m ? `${firstZone.ec_ds_m.toFixed(2)} dS/m` : '— dS/m'],
                    ['MOISTURE_STATUS',firstZone.moisture_status?.toUpperCase() || '—'],
                    ['ACTIVE_ZONE',    firstZone.name],
                    ['FARM',           farm.name],
                    ['TOTAL_ZONES',    `${zones.length} <span data-i18n="ai_zones_label">${t('ai_zones_label')}</span>`],
                ].map(([k, v]) => `
                    <div class="flex justify-between items-center" style="font-size:12px;">
                        <span style="color:rgba(255,255,255,0.4); font-weight:700;">> ${k}</span>
                        <span style="color:white; font-weight:800;">${v}</span>
                    </div>
                `).join('')}
                <div class="mt-6 pt-4" 
                     style="border-top:1px solid rgba(255,255,255,0.05);
                            font-size:9px; color:rgba(46,204,113,0.4);
                            font-weight:800; text-transform:uppercase; letter-spacing:0.05em;">
                    <span data-i18n="ai_kernel">${t('ai_kernel')}</span> stable_alpha_inference · ${zones.length} <span data-i18n="ai_zones_label">${t('ai_zones_label')}</span>
                </div>
            </div>
        </div>

        <!-- Decisions panel -->
        <div class="lg:col-span-7 flex flex-col gap-6">
            <div class="space-y-5" id="decisions-panel">
                ${decisions.length > 0
                    ? decisions.map(d => _decisionCard(d)).join('')
                    : `<div class="ks-card p-10 text-center">
                        <i data-lucide="brain" class="w-12 h-12 mx-auto mb-4" 
                           style="color:rgba(26,122,74,0.3);"></i>
                        <p class="font-bold text-gray-400 uppercase tracking-widest text-sm" data-i18n="ai_no_decisions">
                            ${t('ai_no_decisions')}
                        </p>
                        <p class="text-gray-300 text-xs mt-2">
                            Click RUN AI AUDIT NOW to generate the first decision
                        </p>
                      </div>`
                }
            </div>

            <!-- Notification Channels -->
            <div class="ks-card p-6 mt-4 opacity-80 hover:opacity-100 transition-opacity flex flex-col gap-4 bg-gray-50/50">
                <h3 class="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2 mb-2"><i data-lucide="satellite" class="w-4 h-4"></i> <span data-i18n="channels_title">${t('channels_title')}</span></h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${[
                        { id: 'whatsapp', label: 'channel_whatsapp', icon: 'message-circle', active: true },
                        { id: 'sms', label: 'channel_sms', icon: 'smartphone', active: true },
                        { id: 'email', label: 'channel_email', icon: 'mail', active: false },
                        { id: 'push', label: 'channel_push', icon: 'bell', active: false }
                    ].map(ch => `
                        <div class="flex items-center justify-between p-3 rounded-xl border ${ch.active ? 'bg-white border-green-500 shadow-sm' : 'bg-gray-100/50 border-gray-200'} cursor-pointer transition-all hover:bg-white" onclick="this.classList.toggle('border-green-500'); this.classList.toggle('bg-white'); this.classList.toggle('shadow-sm'); this.classList.toggle('bg-gray-100/50'); this.classList.toggle('border-gray-200'); const btn = this.querySelector('.switch-handle'); if(btn) { btn.classList.toggle('translate-x-3'); btn.parentElement.classList.toggle('bg-green-500'); btn.parentElement.classList.toggle('bg-gray-300'); }">
                            <div class="flex items-center gap-3">
                                <i data-lucide="${ch.icon}" class="w-4 h-4 ${ch.active ? 'text-green-600' : 'text-gray-400'}"></i>
                                <span class="text-xs font-bold ${ch.active ? 'text-gray-800' : 'text-gray-500'}" data-i18n="${ch.label}">${t(ch.label)}</span>
                            </div>
                            <div class="w-8 h-5 rounded-full relative transition-colors ${ch.active ? 'bg-green-500' : 'bg-gray-300'}">
                                <div class="switch-handle absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${ch.active ? 'translate-x-3' : ''} shadow-sm"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Wire up the Run AI button
    runBtn.onclick = async () => {
        runBtn.disabled = true;
        runBtn.innerHTML = `<div class="w-5 h-5 border-2 border-white/30 
            border-t-white rounded-full animate-spin"></div> <span data-i18n="ai_calculating">${t('ai_calculating')}</span>`;
        try {
            const res = await api(
                `/zones/${firstZone.id}/ai-decisions/run/`, 
                { method: 'POST' }
            );
            const panel = gridEl.querySelector('#decisions-panel');
            if (panel && res?.data) {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = _decisionCard(res.data);
                panel.prepend(wrapper.firstElementChild);
                // Remove the empty state card if it exists
                const emptyCard = panel.querySelector('.text-gray-400');
                if (emptyCard?.closest('.ks-card')) {
                    emptyCard.closest('.ks-card').remove();
                }
                if (window.lucide) window.lucide.createIcons();
                
                const finalType = res.data.type || res.data.decision_type || 'analysis';
                if (finalType === 'irrigate' || finalType === 'alert') {
                    showWhatsAppNotification(firstZone.name, res.data.water_volume_l || 14);
                }
            }
        } catch (err) {
            if (err.message?.includes('listener')) return; // browser extension noise
            const panel = gridEl.querySelector('#decisions-panel');
            if (panel) {
                panel.insertAdjacentHTML('afterbegin', `
                    <div class="ks-card p-4 mb-2" 
                         style="background:#fffbeb; border-color:#fde68a; color:#92400e;">
                        <p class="font-bold text-sm" data-i18n="ai_unavailable">${t('ai_unavailable')}</p>
                    </div>`);
            }
        } finally {
            runBtn.disabled = false;
            runBtn.innerHTML = `<i data-lucide="zap" class="w-5 h-5" 
                style="color:#facc15;"></i> <span data-i18n="ai_run_btn">${t('ai_run_btn')}</span>`;
            if (window.lucide) window.lucide.createIcons();
        }
    };
}

function _decisionCard(d) {
    const conf   = Math.round((d.confidence || 0) * 100);
    const isHigh = (d.confidence || 0) >= 0.8;
    const type   = d.type || d.decision_type || 'analysis';

    const borderColors = {
        irrigate: '#3b82f6',
        skip:     '#1a7a4a',
        alert:    '#ef4444',
    };
    const bgColors = {
        irrigate: '#eff6ff',
        skip:     '#f0fdf4',
        alert:    '#fef2f2',
    };
    const border = borderColors[type] || '#9ca3af';
    const bg     = bgColors[type]     || '#f9fafb';

    const dateStr = d.created_at
        ? new Date(d.created_at).toLocaleString()
        : '';
        
    // 1. Simulate input factor weights
    const mWeight = type === 'irrigate' ? 0.82 : 0.55;
    const tWeight = type === 'alert' ? 0.70 : 0.45;
    const ecWeight = 0.34;
    const stageWeight = 0.61;
    const tankWeight = 0.42;
    
    const barsHtml = [
        { label: 'factor_moisture', lw: mWeight },
        { label: 'factor_temp', lw: tWeight },
        { label: 'factor_ec', lw: ecWeight },
        { label: 'factor_stage', lw: stageWeight },
        { label: 'factor_tank', lw: tankWeight }
    ].map(f => {
        const pct = Math.round(f.lw * 100);
        return `<div class="flex items-center gap-3 text-xs mb-1.5"><span class="w-24 text-gray-500 font-bold" data-i18n="${f.label}">${t(f.label)}</span>
            <div class="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" style="width: ${pct}%; background-color: ${border};"></div>
            </div>
            <span class="w-12 text-right font-mono text-gray-400 font-bold">${pct}%</span>
        </div>`;
    }).join('');

    // 2. Decision chain
    const mapDec = type === 'irrigate' ? 'decision_irrigate' : (type === 'skip' ? 'decision_skip' : 'decision_review');
    const chainItems = [
        `① <span data-i18n="factor_moisture">${t('factor_moisture')}</span> → <span class="font-bold font-mono" style="color:${type==='irrigate'?'#ef4444':'#22c55e'}" data-i18n="${type==='irrigate'?'decision_below_threshold':'decision_optimal'}">${t(type==='irrigate'?'decision_below_threshold':'decision_optimal')}</span>`,
        `② <span data-i18n="factor_temp">${t('factor_temp')}</span> → <span class="font-bold" style="color:#f59e0b" data-i18n="decision_high_urgency">${t('decision_high_urgency')}</span>`,
        `③ <span data-i18n="factor_tank">${t('factor_tank')}</span> → <span class="font-bold text-gray-600" data-i18n="decision_sufficient">${t('decision_sufficient')}</span>`,
        `④ <span data-i18n="factor_stage">${t('factor_stage')}</span> → <span class="font-bold text-gray-600" data-i18n="decision_critical_stage">${t('decision_critical_stage')}</span>`,
        `⑤ <span class="font-black uppercase tracking-widest text-white px-2 py-0.5 rounded" style="background:${border};font-size:10px;" data-i18n="${mapDec}">${t(mapDec)}</span>`
    ];
    
    // 3. Confidence meter
    const needleLeft = Math.max(5, Math.min(95, conf));

    return `
        <div class="ks-card p-6 transition-all duration-300" 
             style="border-left:4px solid ${border}; background:${bg};">
            <div class="flex items-start justify-between mb-4 gap-3 cursor-pointer" onclick="const det = this.parentElement.querySelector('details'); if(det) { det.open = !det.open; const i = this.querySelector('i'); if(i) { i.style.transform = det.open ? 'rotate(180deg)' : 'rotate(0deg)'; } }">
                <div>
                    <h2 class="font-black text-gray-800 uppercase tracking-tight text-base">
                        ${type.toUpperCase()}
                    </h2>
                    <p class="font-bold text-gray-400 uppercase tracking-widest mt-0.5"
                       style="font-size:10px;">
                        ${dateStr}
                    </p>
                </div>
                <div class="flex items-center gap-3">
                    <span class="font-black px-4 py-1.5 rounded-full shrink-0"
                          style="background:rgba(26,122,74,0.1); color:#1a7a4a;
                                 font-size:10px; border:1px solid rgba(26,122,74,0.2);">
                        ${conf}% <span data-i18n="ai_confidence">${t('ai_confidence')}</span>
                    </span>
                    <i data-lucide="chevron-down" class="w-5 h-5 text-gray-400 transform transition-transform details-arrow"></i>
                </div>
            </div>
            
            <p class="text-gray-600 leading-relaxed mb-4" style="font-size:13px;">
                ${d.reasoning || `<span data-i18n="ai_no_reasoning">${t('ai_no_reasoning')}</span>`}
            </p>
            
            <span class="badge ${isHigh ? 'badge-ok' : 'badge-warning'}">
                <span data-i18n="${isHigh ? 'ai_auto' : 'ai_review'}">${isHigh ? t('ai_auto') : t('ai_review')}</span>
            </span>

            <details class="mt-5 pt-5 border-t border-gray-200/50 group/details">
                <summary class="hidden text-[0px]"></summary>
                <div class="flex flex-col gap-6 animate-in slide-in-from-top-4 duration-300 pb-2 cursor-default" onclick="event.stopPropagation()">
                    <h3 class="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2 mt-2"><i data-lucide="bar-chart" class="w-4 h-4"></i> <span data-i18n="decision_factors">${t('decision_factors')}</span></h3>
                    <div class="bg-white/60 rounded-xl p-4 border border-white mt-1 shadow-sm">
                        ${barsHtml}
                    </div>

                    <h3 class="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2"><i data-lucide="git-merge" class="w-4 h-4"></i> <span data-i18n="decision_chain">${t('decision_chain')}</span></h3>
                    <div class="flex flex-col gap-2 pl-2 border-l-2 border-gray-200 ml-2 mt-1">
                        ${chainItems.map(item => `<div class="text-xs text-gray-600 relative before:absolute before:-left-[13px] before:top-1.5 before:w-2 before:h-2 before:bg-gray-300 before:rounded-full">${item}</div>`).join('')}
                    </div>

                    <h3 class="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2"><i data-lucide="target" class="w-4 h-4"></i> <span data-i18n="decision_confidence_meter">${t('decision_confidence_meter')}</span></h3>
                    <div class="bg-white/60 rounded-xl p-4 border border-white mt-1 shadow-sm">
                        <div class="h-2 w-full rounded-full flex overflow-hidden mb-2 relative bg-gray-100">
                            <div class="h-full bg-red-400 opacity-40" style="width: 60%"></div>
                            <div class="h-full bg-amber-400 opacity-40" style="width: 20%"></div>
                            <div class="h-full bg-green-400 opacity-40" style="width: 20%"></div>
                            <!-- Needle -->
                            <div class="absolute top-0 bottom-0 w-1.5 bg-gray-900 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.5)] transition-all duration-1000 -translate-x-1/2 z-10" style="left: ${needleLeft}%;"></div>
                        </div>
                        <div class="flex justify-between text-[8px] font-black text-gray-400 uppercase tracking-widest mt-2">
                            <span data-i18n="decision_informational">${t('decision_informational')}</span>
                            <span data-i18n="decision_pending_review">${t('decision_pending_review')}</span>
                            <span data-i18n="decision_auto_execute">${t('decision_auto_execute')}</span>
                        </div>
                    </div>
                </div>
            </details>
        </div>
    `;
}

// ── Digital Twin Performance ──────────────────────────────────────────────────
async function _loadTwinPerformance(container) {
    const farm = store.getState('currentFarm');
    if (!farm?.id) return;
    
    let status = null;
    try {
        const res = await api(`/farms/${farm.id}/twin/status`);
        status = res?.data;
    } catch(e) {
        console.error("Twin API error", e);
        return;
    }

    const history = JSON.parse(localStorage.getItem('ks_twin_history') || '[]').reverse().slice(0, 10);
    
    // Sparkline coordinates
    const sx = 400, sy = 60;
    let points = "";
    if (history.length > 0) {
        points = history.map((h, i) => {
            const x = (i / Math.max(1, history.length - 1)) * sx;
            let err = h.actual_moisture ? Math.abs(h.predicted_moisture - h.actual_moisture) / 100 : status.mae_score;
            // Cap at 0.3 for the visual scale
            const y = sy - (Math.min(err, 0.3) / 0.3) * sy;
            return `${x},${y}`;
        }).join(" ");
    } else {
        points = `0,${sy - (status.mae_score/0.3)*sy} ${sx},${sy - (status.mae_score/0.3)*sy}`;
    }
    const safePath = points.includes("NaN") ? "" : points;

    // Threshold line Y at MAE = 0.1
    const targetY = sy - (0.1 / 0.3) * sy;

    const timeAgo = status.last_calibrated_at ? Math.round((new Date() - new Date(status.last_calibrated_at))/(1000*60*60)) : 0;
    const trustColor = status.trust_level === 'HIGH' ? '#22c55e' : (status.trust_level === 'MEDIUM' ? '#f59e0b' : '#ef4444');
    const trustBg = status.trust_level === 'HIGH' ? '#dcfce7' : (status.trust_level === 'MEDIUM' ? '#fef3c7' : '#fee2e2');

    container.innerHTML = `
        <div class="mt-12">
            <h2 class="text-2xl font-extrabold text-gray-900 mb-6">Digital Twin Performance</h2>
            
            <!-- Overall Status Card -->
            <div class="ks-card p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6" style="border-left: 4px solid #00c3ff;">
                <div class="flex items-center gap-6">
                    <div class="flex flex-col text-center md:text-left">
                        <span class="text-sm font-bold text-gray-400 uppercase tracking-widest">Calibration MAE</span>
                        <div class="text-5xl font-black text-gray-800" style="font-family: 'JetBrains Mono', monospace;">${status.mae_score.toFixed(3)}</div>
                    </div>
                    
                    <div class="w-px h-16 bg-gray-200 hidden md:block"></div>
                    
                    <div class="flex flex-col gap-2">
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded border" style="background: ${trustBg}; border-color: ${trustColor}40; color: ${trustColor};">
                            <div class="w-2 h-2 rounded-full" style="background: ${trustColor};"></div>
                            <span class="font-black text-xs uppercase tracking-widest">${status.trust_level} TRUST</span>
                        </div>
                        <span class="text-xs font-bold text-gray-400">Last calibrated: ${timeAgo} hours ago</span>
                        <span class="text-xs font-bold text-gray-400">Simulations Run: <span class="text-gray-900 font-black">${status.total_simulations_run}</span></span>
                    </div>
                </div>

                <div class="flex flex-col items-center md:items-end gap-2 w-full md:w-1/3">
                    <div class="w-full relative bg-gray-50 rounded p-4 border border-gray-100">
                        <span class="text-[10px] font-bold text-gray-400 uppercase block mb-2">Calibration Accuracy Over Time</span>
                        <svg width="100%" height="60" viewBox="0 0 ${sx} ${sy}" preserveAspectRatio="none">
                            <line x1="0" y1="${targetY}" x2="${sx}" y2="${targetY}" stroke="#ef4444" stroke-dasharray="4" stroke-width="1.5" opacity="0.5" />
                            <polyline points="${safePath}" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </div>
                    <button id="recalibrate-btn" class="mt-2 text-sm font-bold tracking-widest uppercase bg-transparent border-2 border-gray-300 text-gray-700 hover:border-gray-900 hover:text-gray-900 px-6 py-2 rounded-lg transition-colors">
                        Recalibrate Twin
                    </button>
                </div>
            </div>

            <!-- History Table -->
            <div class="ks-card overflow-hidden">
                <div class="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <h3 class="font-bold text-gray-900">Recent Simulations</h3>
                    <span class="text-xs font-bold text-gray-400">Last 10 executions</span>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-gray-50 border-b border-gray-200 text-[10px] uppercase font-black text-gray-400 tracking-widest">
                                <th class="p-4">Zone</th>
                                <th class="p-4">Time</th>
                                <th class="p-4">Type</th>
                                <th class="p-4">Predicted</th>
                                <th class="p-4">Actual</th>
                                <th class="p-4">Error (|Δ|)</th>
                                <th class="p-4">Efficiency</th>
                            </tr>
                        </thead>
                        <tbody class="text-sm font-medium">
                            ${history.length === 0 ? `<tr><td colspan="7" class="p-8 text-center text-gray-400 font-bold">No simulations recorded yet. Use the 3D Twin preview.</td></tr>` : ''}
                            ${history.map(row => {
                                const diff = row.actual_moisture ? Math.abs(row.predicted_moisture - row.actual_moisture) : null;
                                let errStyle = "color: #9ca3af;";
                                if (diff !== null) {
                                    if (diff < 5) errStyle = "color: #22c55e; font-weight: 800;";
                                    else if (diff < 15) errStyle = "color: #f59e0b; font-weight: 800;";
                                    else errStyle = "color: #ef4444; font-weight: 800;";
                                }
                                
                                return `
                                <tr class="border-b last:border-0 border-gray-50 hover:bg-gray-50/50 transition-colors">
                                    <td class="p-4 font-bold text-gray-900 uppercase text-xs tracking-widest">${row.zone_name}</td>
                                    <td class="p-4 text-gray-500 font-mono text-xs">${new Date(row.timestamp).toLocaleTimeString()}</td>
                                    <td class="p-4"><span class="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[10px] font-black uppercase tracking-widest">${row.type}</span></td>
                                    <td class="p-4 font-mono font-bold">${row.predicted_moisture.toFixed(1)}%</td>
                                    <td class="p-4 font-mono">${row.actual_moisture ? row.actual_moisture.toFixed(1) + '%' : '⏳ Pending'}</td>
                                    <td class="p-4 font-mono" style="${errStyle}">${diff !== null ? diff.toFixed(1) : '—'}</td>
                                    <td class="p-4 font-mono text-gray-500">${(row.efficiency_score * 100).toFixed(0)}%</td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    container.querySelector('#recalibrate-btn').addEventListener('click', async (e) => {
        const btn = e.target;
        btn.innerHTML = '<span class="animate-pulse">Calibrating...</span>';
        btn.disabled = true;
        try {
            await api(`/farms/${farm.id}/twin/calibrate`, { method: 'POST' });
            btn.innerHTML = 'Calibration complete ✓';
            setTimeout(() => _loadTwinPerformance(container), 1500); // Reload entire section to show new MAE
        } catch(err) {
            btn.innerHTML = 'Error ' + err.message;
            btn.disabled = false;
        }
    });
}

function showWhatsAppNotification(zoneName, volume) {
    let mock = document.getElementById('whatsapp-mock-notification');
    if (mock) mock.remove();

    mock = document.createElement('div');
    mock.id = 'whatsapp-mock-notification';
    mock.className = "fixed top-0 right-4 w-[340px] max-w-[calc(100vw-32px)] z-[9999] shadow-2xl rounded-2xl overflow-hidden font-sans transition-all duration-500 translate-y-[-120%]";
    mock.style.backgroundColor = "white";
    mock.style.border = "1px solid rgba(0,0,0,0.05)";

    mock.innerHTML = `
        <div style="background: linear-gradient(135deg, #128C7E, #075E54);" class="px-4 py-3 flex items-center gap-3 text-white">
            <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <i data-lucide="message-circle" class="w-4 h-4 text-white"></i>
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="text-sm font-bold truncate leading-tight" style="font-family: var(--font-display);"><span data-i18n="whatsapp_alert">${t('whatsapp_alert')}</span></h4>
                <p class="text-[10px] text-white/80" data-i18n="whatsapp_now">${t('whatsapp_now')}</p>
            </div>
        </div>
        <div class="p-4 relative" style="background-color: #E5DDD5;">
            <!-- Subtle pattern overlay -->
            <div class="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTIwIDIwaDIwdjIwSDIweiIgZmlsbD0iIzAwMCIvPjwvc3ZnPg==')]"></div>
            
            <div class="bg-white rounded-xl p-3 pb-6 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] border border-gray-100 flex flex-col gap-2 relative max-w-[95%]">
                <!-- Tail for bubble -->
                <div class="absolute -top-1 -left-1 w-3 h-3 bg-white rotate-45 transform border-l border-t border-gray-100 hidden"></div>
                <p class="text-[13px] text-gray-800 leading-snug">
                    <span data-i18n="whatsapp_msg_1">${t('whatsapp_msg_1')}</span>${zoneName} · 19<span data-i18n="whatsapp_msg_2">${t('whatsapp_msg_2')}</span>${volume}<span data-i18n="whatsapp_msg_3">${t('whatsapp_msg_3')}</span>
                </p>
                <div class="flex gap-2 mt-2 border-t border-gray-100/50 pt-2 z-10 relative">
                    <button class="flex-1 bg-[#128C7E] hover:bg-[#075E54] text-white text-xs font-bold py-1.5 rounded transition-colors border border-transparent flex items-center justify-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> <span data-i18n="whatsapp_irrigate">${t('whatsapp_irrigate')}</span></button>
                    <button class="flex-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-bold py-1.5 rounded transition-colors flex items-center justify-center gap-1"><i data-lucide="x" class="w-3 h-3"></i> <span data-i18n="whatsapp_skip">${t('whatsapp_skip')}</span></button>
                </div>
                <span class="text-[9px] text-gray-400 absolute bottom-1.5 right-2" style="font-family: var(--font-mono);">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        </div>
    `;

    document.body.appendChild(mock);
    if (window.lucide) window.lucide.createIcons();

    // Slide in
    setTimeout(() => { mock.style.transform = "translateY(16px)"; }, 100);

    // Auto dismiss
    setTimeout(() => {
        if(mock) {
            mock.style.transform = "translateY(-120%)";
            setTimeout(() => mock.remove(), 500);
        }
    }, 5000);
}
