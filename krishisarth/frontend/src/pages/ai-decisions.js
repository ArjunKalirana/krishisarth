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
            <h1 class="text-3xl font-extrabold text-gray-900">${t('ai_title')}</h1>
            <p class="text-gray-500 font-medium mt-1">${t('ai_subtitle')}</p>
        </div>
        <button id="run-ai-btn" class="bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-xl font-black text-sm transition-all shadow-xl active:scale-95 flex items-center gap-3">
            <i data-lucide="zap" class="w-5 h-5 text-yellow-400"></i> ${t('ai_run_btn')}
        </button>
    `;
    container.appendChild(header);

    // 2. Content Grid
    const mainGrid = document.createElement('div');
    mainGrid.className = "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start";
    container.appendChild(mainGrid);

    // Initial Load
    _loadAI(mainGrid, container.querySelector('#run-ai-btn'));

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
                    No farm found. Please make sure you have run the seed script.
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

    if (zones.length === 0) {
        gridEl.innerHTML = `<div class="lg:col-span-12 ks-card p-10 text-center">
            <p class="text-gray-400 font-bold text-sm">No zones found for this farm.</p>
            <p class="text-gray-300 text-xs mt-2">Run: python scripts/seed.py</p>
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
                      style="font-size:10px; font-family:var(--font-mono, monospace);">
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
                    > ${t('ai_system_ready')}: INFERENCE_CORE_v4.2
                </p>
                ${[
                    ['SOIL_MOISTURE',  `${(firstZone.moisture_pct || 0).toFixed(1)}%`],
                    ['AMBIENT_TEMP',   firstZone.temp_c ? `${firstZone.temp_c.toFixed(1)}°C` : '— °C'],
                    ['EC_LEVEL',       firstZone.ec_ds_m ? `${firstZone.ec_ds_m.toFixed(2)} dS/m` : '— dS/m'],
                    ['MOISTURE_STATUS',firstZone.moisture_status?.toUpperCase() || '—'],
                    ['ACTIVE_ZONE',    firstZone.name],
                    ['FARM',           farm.name],
                    ['TOTAL_ZONES',    `${zones.length} ${t('ai_zones_label')}`],
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
                    ${t('ai_kernel')} stable_alpha_inference · ${zones.length} ${t('ai_zones_label')}
                </div>
            </div>
        </div>

        <!-- Decisions panel -->
        <div class="lg:col-span-7 space-y-5" id="decisions-panel">
            ${decisions.length > 0
                ? decisions.map(d => _decisionCard(d)).join('')
                : `<div class="ks-card p-10 text-center">
                    <i data-lucide="brain" class="w-12 h-12 mx-auto mb-4" 
                       style="color:rgba(26,122,74,0.3);"></i>
                    <p class="font-bold text-gray-400 uppercase tracking-widest text-sm">
                        ${t('ai_no_decisions')}
                    </p>
                    <p class="text-gray-300 text-xs mt-2">
                        Click RUN AI AUDIT NOW to generate the first decision
                    </p>
                  </div>`
            }
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Wire up the Run AI button
    runBtn.onclick = async () => {
        runBtn.disabled = true;
        runBtn.innerHTML = `<div class="w-5 h-5 border-2 border-white/30 
            border-t-white rounded-full animate-spin"></div> ${t('ai_calculating')}`;
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
            }
        } catch (err) {
            const panel = gridEl.querySelector('#decisions-panel');
            if (panel) {
                panel.insertAdjacentHTML('afterbegin', `
                    <div class="ks-card p-4 mb-2" 
                         style="background:#fffbeb; border-color:#fde68a; color:#92400e;">
                        <p class="font-bold text-sm">${t('ai_unavailable')}</p>
                    </div>`);
            }
        } finally {
            runBtn.disabled = false;
            runBtn.innerHTML = `<i data-lucide="zap" class="w-5 h-5" 
                style="color:#facc15;"></i> ${t('ai_run_btn')}`;
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

    return `
        <div class="ks-card p-6" 
             style="border-left:4px solid ${border}; background:${bg};">
            <div class="flex items-start justify-between mb-4 gap-3">
                <div>
                    <h2 class="font-black text-gray-800 uppercase tracking-tight text-base">
                        ${type.toUpperCase()}
                    </h2>
                    <p class="font-bold text-gray-400 uppercase tracking-widest mt-0.5"
                       style="font-size:10px;">
                        ${dateStr}
                    </p>
                </div>
                <span class="font-black px-4 py-1.5 rounded-full shrink-0"
                      style="background:rgba(26,122,74,0.1); color:#1a7a4a;
                             font-size:10px; border:1px solid rgba(26,122,74,0.2);">
                    ${conf}% ${t('ai_confidence')}
                </span>
            </div>
            <p class="text-gray-600 leading-relaxed mb-4" style="font-size:13px;">
                ${d.reasoning || t('ai_no_reasoning')}
            </p>
            <span class="badge ${isHigh ? 'badge-ok' : 'badge-warning'}">
                ${isHigh ? t('ai_auto') : t('ai_review')}
            </span>
        </div>
    `;
}

