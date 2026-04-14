import { createZoneCard } from '../components/zone-card.js';
import { startIrrigation, stopIrrigation, injectFertigation } from '../api/control.js';
import { t } from '../utils/i18n.js';
import { showToast } from '../components/toast.js';
import { api } from '../api/client.js';
import { store } from '../state/store.js';

/**
 * Control Page (Elite Edition)
 * Central hub for manual hardware orchestration and fertigation.
 */
export function renderControl() {
    const container = document.createElement('div');
    container.className = "space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700";

    const header = document.createElement('div');
    header.className = "flex flex-col lg:flex-row lg:items-center justify-between gap-12 mb-8 stagger-in";
    header.innerHTML = `
        <div class="space-y-3">
            <h1 class="text-5xl font-black tracking-tighter text-white font-display">
                NODE <span class="text-emerald-500">ORCHESTRTION</span>
            </h1>
            <p class="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">
                Direct Manual Override Hub
            </p>
        </div>
        <div class="flex flex-wrap gap-4">
            <button id="start-all-btn" class="btn-emerald px-8 py-4 text-[10px] uppercase font-black tracking-widest bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                <i data-lucide="play-circle" class="w-5 h-5"></i>
                <span>ACTIVATE FULL GRID</span>
            </button>
            <button id="stop-all-btn" class="btn-elite px-8 py-4 text-[10px] uppercase font-black tracking-widest bg-red-500/10 text-red-500 border-red-500/20">
                <i data-lucide="stop-circle" class="w-5 h-5"></i>
                <span>SECURE ALL VALVES</span>
            </button>
        </div>
    `;
    container.appendChild(header);

    const layout = document.createElement('div');
    layout.className = "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start";

    // Main Operational Area
    const zoneGrid = document.createElement('div');
    zoneGrid.className = "lg:col-span-8 ks-grid md:ks-grid-2 gap-6";
    _loadZones(zoneGrid);
    layout.appendChild(zoneGrid);

    // AI/Fertigation Sidebar
    const sidebar = document.createElement('div');
    sidebar.className = "lg:col-span-4 space-y-8";

    const fertCard = document.createElement('div');
    fertCard.className = "ks-card glass-panel p-8 border-l-4 border-l-emerald-500 shadow-emerald-500/5";
    let activeNutrient = 'Nitrogen';

    const renderFert = () => {
        fertCard.innerHTML = `
            <div class="flex items-center justify-between mb-8">
                <div>
                    <h2 class="text-lg font-black text-white font-display flex items-center gap-3">
                        <i data-lucide="test-tube-2" class="w-5 h-5 text-emerald-400"></i>
                        <span>Fertigation Control</span>
                    </h2>
                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Chemical Injection Engine</p>
                </div>
                <div class="badge-elite badge-success text-[10px]">PUMPS READY</div>
            </div>

            <div class="flex bg-slate-900/50 p-1.5 rounded-2xl mb-8 border border-white/5">
                ${['Nitrogen', 'Phosphorus', 'Potassium'].map((n) => `
                    <button class="nut-btn flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${n === activeNutrient ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}" data-nut="${n}">
                        ${n}
                    </button>
                `).join('')}
            </div>

            <div class="space-y-8">
                <div class="space-y-4">
                    <div class="flex justify-between items-end">
                        <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Concentration Level</span>
                        <div class="flex items-baseline gap-2">
                             <span class="text-4xl font-black text-white font-display" id="fert-val">12</span>
                             <span class="text-xs text-slate-500 font-mono font-bold uppercase">ml/L</span>
                        </div>
                    </div>
                    
                    <div class="relative py-4">
                        <input type="range" min="0" max="30" value="12" 
                               class="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 group" id="fert-slider">
                        <div class="flex justify-between mt-4">
                            <span class="text-[9px] text-slate-600 font-bold">0 ML</span>
                            <span class="text-[9px] text-slate-600 font-bold">30 ML</span>
                        </div>
                    </div>
                </div>
                
                <button id="inject-btn" class="btn-elite w-full py-4 text-sm flex items-center justify-center gap-3">
                    <i data-lucide="zap" class="w-5 h-5"></i>
                    <span>EXECUTE INJECTION</span>
                </button>
                
                <p class="text-[10px] text-slate-500 font-medium italic text-center">
                    Note: Injection requires at least one active irrigation pump.
                </p>
            </div>
        `;

        fertCard.querySelectorAll('.nut-btn').forEach(btn => {
            btn.onclick = () => { activeNutrient = btn.dataset.nut; renderFert(); };
        });

        const slider = fertCard.querySelector('#fert-slider');
        const valEl = fertCard.querySelector('#fert-val');
        const injectBtn = fertCard.querySelector('#inject-btn');
        
        slider.oninput = () => { valEl.textContent = slider.value; };

        injectBtn.onclick = async () => {
            const farm = store.getState('currentFarm');
            let zoneId = null;
            try {
                if (farm?.id) {
                    const dashRes = await api(`/farms/${farm.id}/dashboard`);
                    zoneId = dashRes?.data?.zones?.[0]?.id;
                }
            } catch (e) {}

            if (!zoneId) return showToast('No active zones found for injection', 'error');

            injectBtn.disabled = true;
            try {
                await injectFertigation(zoneId, activeNutrient, slider.value);
                showToast(`Injection Sequence Finalized: ${activeNutrient} stabilized`, 'success');
            } catch (err) {
                showToast(`Injection Fault: ${err.message}`, 'error');
            } finally { injectBtn.disabled = false; }
        };

        if (window.lucide) window.lucide.createIcons();
    };

    renderFert();
    sidebar.appendChild(fertCard);
    
    layout.appendChild(sidebar);
    container.appendChild(layout);

    // Initialization delay for smooth loading
    setTimeout(() => {
        const startAllBtn = container.querySelector('#start-all-btn');
        const stopAllBtn  = container.querySelector('#stop-all-btn');

        startAllBtn?.addEventListener('click', async () => {
            startAllBtn.disabled = true;
            startAllBtn.innerHTML = `<div class="w-5 h-5 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div> Starting...`;
            const cards = container.querySelectorAll('[data-zone-id]');
            await Promise.all([...cards].map(c => startIrrigation(c.dataset.zoneId, 20).catch(() => {})));
            showToast('All actuators initialized 💧', 'success');
            startAllBtn.disabled = false;
            startAllBtn.innerHTML = `<i data-lucide="play-circle" class="w-5 h-5"></i> INITIALIZE ALL`;
            if (window.lucide) window.lucide.createIcons();
        });

        stopAllBtn?.addEventListener('click', async () => {
            stopAllBtn.disabled = true;
            stopAllBtn.innerHTML = `<div class="w-5 h-5 border-3 border-red-500/20 border-t-red-500 rounded-full animate-spin"></div> Stopping...`;
            const cards = container.querySelectorAll('[data-zone-id]');
            await Promise.all([...cards].map(c => stopIrrigation(c.dataset.zoneId).catch(() => {})));
            showToast('All sequences terminated 🛑', 'success');
            stopAllBtn.disabled = false;
            stopAllBtn.innerHTML = `<i data-lucide="stop-circle" class="w-5 h-5"></i> TERMINATE ALL`;
            if (window.lucide) window.lucide.createIcons();
        });
        
        // Voice Integration
        initVoiceCommands(container);
    }, 1000);

    return container;
}

function initVoiceCommands(container) {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.log('[Voice] Web Speech API not supported');
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; // Indian English
    recognition.continuous = false;
    recognition.interimResults = false;
    
    let isListening = false;
    
    // Add voice button to header
    const voiceBtn = document.createElement('button');
    voiceBtn.id = 'voice-cmd-btn';
    voiceBtn.className = 'btn-elite flex items-center gap-2 px-8 py-4 bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] font-black uppercase tracking-widest';
    voiceBtn.innerHTML = `<i data-lucide="mic" class="w-5 h-5"></i><span>VOICE PILOT</span>`;
    
    const btnRow = container.querySelector('.flex.flex-wrap.gap-4');
    if (btnRow) btnRow.appendChild(voiceBtn);
    
    if (window.lucide) window.lucide.createIcons();
    
    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        console.log('[Voice] Heard:', transcript);
        
        showToast(`🎤 "${transcript}"`, 'info');
        
        // Parse commands
        // "start zone A" / "irrigate zone B" / "turn on zone C"
        const startMatch = transcript.match(/(?:start|irrigate|on|begin)\s+zone\s+([a-z]|\d+)/i);
        // "stop zone A" / "turn off zone B"  
        const stopMatch  = transcript.match(/(?:stop|off|end|halt)\s+zone\s+([a-z]|\d+)/i);
        // "start all" / "irrigate all"
        const allStart   = transcript.match(/(?:start|irrigate|on)\s+all/i);
        // "stop all"
        const allStop    = transcript.match(/(?:stop|off|halt)\s+all/i);
        // "duration 20 minutes zone A"
        const durMatch   = transcript.match(/duration\s+(\d+)/i);
        
        const farm = store.getState('currentFarm');
        if (!farm?.id) { showToast('No farm loaded', 'error'); return; }
        
        try {
            const dashRes = await api(`/farms/${farm.id}/dashboard`);
            const zones = dashRes?.data?.zones || [];
            
            if (allStart) {
                const actZones = zones.filter(z => z.control_mode === 'act');
                if (actZones.length === 0) {
                    showToast('⚠️ No zones in Act Mode. Switch zones to Act Mode first.', 'warning');
                    return;
                }
                for (const z of actZones) {
                    await api(`/zones/${z.id}/irrigate`, {method:'POST', body: JSON.stringify({duration_min: 20, source: 'voice'})}).catch(()=>{});
                }
                showToast(`💧 Started irrigation on ${actZones.length} zones`, 'success');
                return;
            }
            
            if (allStop) {
                for (const z of zones) {
                    await api(`/zones/${z.id}/stop`, {method:'POST'}).catch(()=>{});
                }
                showToast('🛑 All zones stopped', 'success');
                return;
            }
            
            const zoneLabel = startMatch?.[1] || stopMatch?.[1];
            if (zoneLabel) {
                const targetZone = zones.find(z => 
                    z.name.toLowerCase().includes(zoneLabel.toLowerCase()) ||
                    z.name.toLowerCase().endsWith(` ${zoneLabel.toLowerCase()}`)
                );
                
                if (!targetZone) {
                    showToast(`Zone "${zoneLabel}" not found`, 'error');
                    return;
                }
                
                if (startMatch) {
                    if (targetZone.control_mode !== 'act') {
                        showToast(`Zone ${targetZone.name} is in View Mode — cannot command`, 'warning');
                        return;
                    }
                    const dur = durMatch ? parseInt(durMatch[1]) : 20;
                    await api(`/zones/${targetZone.id}/irrigate`, {method:'POST', body: JSON.stringify({duration_min: dur, source: 'voice'})});
                    showToast(`💧 Started ${targetZone.name} for ${dur} min`, 'success');
                }
                if (stopMatch) {
                    await api(`/zones/${targetZone.id}/stop`, {method:'POST'});
                    showToast(`🛑 Stopped ${targetZone.name}`, 'success');
                }
            }
        } catch(e) {
            showToast('Voice command failed: ' + e.message, 'error');
        }
    };
    
    recognition.onerror = (e) => {
        isListening = false;
        voiceBtn.innerHTML = `<i data-lucide="mic" class="w-5 h-5"></i><span>VOICE</span>`;
        voiceBtn.className = voiceBtn.className.replace('bg-red-500/20 text-red-400 border-red-500/20', 'bg-purple-500/10 text-purple-400 border-purple-500/20');
        if (window.lucide) window.lucide.createIcons();
        if (e.error !== 'no-speech') showToast(`Voice error: ${e.error}`, 'error');
    };
    
    recognition.onend = () => {
        isListening = false;
        voiceBtn.innerHTML = `<i data-lucide="mic" class="w-5 h-5"></i><span>VOICE</span>`;
        if (window.lucide) window.lucide.createIcons();
    };
    
    voiceBtn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
            return;
        }
        isListening = true;
        voiceBtn.innerHTML = `<i data-lucide="mic-off" class="w-5 h-5 animate-pulse"></i><span>LISTENING...</span>`;
        if (window.lucide) window.lucide.createIcons();
        recognition.start();
        showToast('🎤 Listening... Say "Start Zone A" or "Stop All"', 'info');
    });
}

async function _loadZones(gridEl) {
    const farm = store.getState('currentFarm');
    if (!farm?.id) {
        setTimeout(() => _loadZones(gridEl), 800);
        return;
    }

    gridEl.innerHTML = `<div class="md:col-span-2 flex flex-col items-center justify-center py-40 gap-6 glass-panel">
        <div class="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        <p class="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Synchronizing Actuators...</p>
    </div>`;

    try {
        const dashRes = await api(`/farms/${farm.id}/dashboard`);
        const zones = dashRes?.data?.zones || [];

        if (zones.length === 0) {
            gridEl.innerHTML = `
                <div class="md:col-span-2 glass-panel p-20 text-center border-dashed border-slate-700/50">
                    <i data-lucide="activity" class="w-16 h-16 mx-auto mb-6 text-slate-700 animate-pulse"></i>
                    <h3 class="text-xl font-black text-white font-display mb-2">No Connected Nodes</h3>
                    <p class="text-slate-500 text-xs font-medium max-w-xs mx-auto mb-8">
                        Register your first plot to initialize hardware telemetry.
                    </p>
                    <a href="#dashboard" class="btn-elite py-3 px-8 text-xs inline-block">GOTO DASHBOARD</a>
                </div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        gridEl.innerHTML = '';
        zones.forEach(z => {
            gridEl.appendChild(createZoneCard({
                id:           z.id,
                name:         z.name,
                lastIrrig:    'N/A',
                moisture:     z.moisture_pct   || 0,
                initialState: z.pump_running   || false,
                cropType:     z.crop_type      || '',
            }));
        });

        if (window.lucide) window.lucide.createIcons();
    } catch (err) {
        gridEl.innerHTML = `<div class="md:col-span-2 glass-panel p-10 text-center text-red-400 text-xs font-black uppercase tracking-widest">Protocol Sync Failure. Reconnect Required.</div>`;
    }
}
