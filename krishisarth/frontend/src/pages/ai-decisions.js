import { getDecisions, runDecision } from '../api/ai.js';
import { store } from '../state/store.js';
import { api } from '../api/client.js';
import { formatDate, roundTo } from '../utils/format.js';

/**
 * Dynamic AI Decisions Page
 * Visualizes the reasoning chain and triggers audits.
 */
export function renderAIDecisions() {
    const container = document.createElement('div');
    container.className = "space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700";

    const farmId = store.getState('currentFarm')?.id;
    const activeZone = store.getState('activeZones')[0] || 'all';

    // 1. Page Header with Trigger
    const header = document.createElement('div');
    header.className = "flex flex-col md:flex-row md:items-end justify-between gap-6";
    header.innerHTML = `
        <div>
            <h1 class="text-3xl font-extrabold text-gray-900">AI <span class="brand-text">Decision Engine</span></h1>
            <p class="text-gray-500 font-medium mt-1">Real-time autonomous recommendations and field logic</p>
        </div>
        <button id="run-ai-btn" class="bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-xl font-black text-sm transition-all shadow-xl active:scale-95 flex items-center gap-3">
            <i data-lucide="zap" class="w-5 h-5 text-yellow-400"></i> RUN AI AUDIT NOW
        </button>
    `;
    container.appendChild(header);

    // 2. Content Grid
    const mainGrid = document.createElement('div');
    mainGrid.className = "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start";
    container.appendChild(mainGrid);

    // Initial Load
    loadAIData(activeZone, mainGrid, container.querySelector('#run-ai-btn'));

    return container;
}

async function loadAIData(zoneId, targetEl, triggerBtn) {
    targetEl.innerHTML = `<div class="lg:col-span-12 py-20 flex justify-center"><div class="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div></div>`;

    try {
        const farm = store.getState('currentFarm');
        let realZoneId = null;
        if (farm?.id) {
            try {
                const farmRes = await api(`/farms/${farm.id}/`);
                const zones = farmRes?.data?.zones || [];
                if (zones.length > 0) realZoneId = zones[0].id;
            } catch { /* no zones */ }
        }

        if (!realZoneId) {
            targetEl.innerHTML = '<div class="ks-card p-10 text-center text-gray-400 font-bold">No zones available. Please create a zone first.</div>';
            return;
        }

        const res = await getDecisions(realZoneId);
        const decisions = res.data || [];
        const latest = decisions[0] || {};
        
        targetEl.innerHTML = `
            <!-- TERMINAL PANEL (Telemetry) -->
            <div class="lg:col-span-5 ks-card bg-[#0d1a12] border-primary/20 overflow-hidden flex flex-col h-full shadow-2xl font-mono text-sm">
                <div class="bg-white/5 border-b border-white/10 px-4 py-3 flex items-center justify-between">
                    <span class="text-[10px] font-bold text-white/30 uppercase tracking-widest">TELEMETRY_SNAP v4.2</span>
                    <div class="flex gap-1.5"><div class="w-2 h-2 rounded-full bg-red-500/50"></div><div class="w-2 h-2 rounded-full bg-green-500/50 animate-pulse"></div></div>
                </div>
                <div class="p-6 space-y-3">
                    <p class="text-green-500/50 mb-4 font-bold text-[10px]">> READ_INGEST_SYNC: OK</p>
                    ${Object.entries(latest.sensor_snapshot || { MOISTURE: 18.2, TEMP: 32, RAIN: 80 }).map(([k,v]) => `
                        <div class="flex justify-between items-center group">
                            <span class="text-white/40 font-bold">> ${k}</span>
                            <span class="text-white font-black tracking-tight">${v}${k === 'TEMP' ? '°C' : '%'}</span>
                        </div>
                    `).join('')}
                    <div class="mt-8 pt-4 border-t border-white/5 text-[9px] text-primary-light/40 uppercase font-black">Kernel: stable_alpha_inference</div>
                </div>
            </div>

            <!-- RECOMMENDATIONS -->
            <div class="lg:col-span-7 space-y-6">
                ${decisions.map(d => renderDecisionCard(d)).join('')}
                ${decisions.length === 0 ? '<div class="ks-card p-10 text-center text-gray-400 font-bold">No historical decisions found for this zone.</div>' : ''}
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();

        // Attach Trigger Listener
        triggerBtn.onclick = async () => {
            triggerBtn.disabled = true;
            triggerBtn.innerHTML = '<i class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></i> CALCULATING...';
            try {
                await runDecision(realZoneId);
                loadAIData(realZoneId, targetEl, triggerBtn);
            } catch (err) {
                console.error("AI_EXEC_FAIL:", err.message);
                if (err.message === '503') alert("AI engine in fallback mode — using scheduled irrigation");
            } finally {
                triggerBtn.disabled = false;
                triggerBtn.innerHTML = '<i data-lucide="zap" class="w-5 h-5 text-yellow-400"></i> RUN AI AUDIT NOW';
                if (window.lucide) window.lucide.createIcons();
            }
        };

    } catch (err) {
        targetEl.innerHTML = `<div class="lg:col-span-12 ks-card p-10 bg-red-50 border-red-100 text-red-600 font-bold uppercase tracking-widest text-center">Engine Communication Offline</div>`;
    }
}

function renderDecisionCard(d) {
    return `
        <div class="ks-card p-6 border-l-4 border-l-primary-light animate-in fade-in slide-in-from-right-4">
            <div class="flex items-center justify-between mb-6">
                <div>
                    <h2 class="text-lg font-black text-gray-800 uppercase tracking-tight">${d.action_title || 'Optimizing Irrigation'}</h2>
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">${formatDate(d.created_at)}</p>
                </div>
                <div class="bg-primary/10 text-primary font-black px-4 py-1.5 rounded-full text-[10px] border border-primary/20 flex items-center gap-2">
                    ${roundTo(d.confidence || 0, 0)}% CONFIDENCE
                </div>
            </div>
            <p class="text-xs text-gray-600 leading-relaxed mb-4">${d.reasoning || 'No details available'}</p>
            <div class="flex items-center gap-3">
                <span class="badge ${d.auto_execute ? 'badge-ok' : 'badge-warning'}">${d.auto_execute ? 'AUTONOMOUS' : 'MANUAL_REVIEW'}</span>
                <span class="text-[10px] font-bold text-gray-400 font-mono">ID: ${d.id.split('-')[0]}</span>
            </div>
        </div>
    `;
}
