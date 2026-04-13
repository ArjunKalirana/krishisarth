/**
 * SensorCard Component (Elite Edition)
 * A high-fidelity, glassmorphic container for farm intelligence.
 */
export function createSensorCard({ title, icon, value, unit, badgeType, badgeText, children = "" }) {
    const card = document.createElement('div');
    card.className = "elite-card glass-panel group p-6 flex flex-col h-full transition-all cursor-pointer";
    
    // Determine thematic color
    const isWater = icon.includes('drop') || title.toLowerCase().includes('moisture');
    const isAlert = badgeType === 'dry' || badgeType === 'critical';
    
    const accentClass = isAlert ? 'text-red-400' : (isWater ? 'text-emerald-400' : 'text-blue-400');
    const bgAccentClass = isAlert ? 'bg-red-500/10' : (isWater ? 'bg-emerald-500/10' : 'bg-blue-500/10');
    const borderAccentClass = isAlert ? 'border-red-500/20' : (isWater ? 'border-emerald-500/20' : 'border-blue-500/20');

    card.innerHTML = `
        <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-4">
                <div class="p-2.5 ${bgAccentClass} rounded-2xl border ${borderAccentClass} relative">
                    <i data-lucide="${icon}" class="w-5 h-5 ${accentClass} relative z-10"></i>
                    <div class="absolute inset-0 rounded-2xl ${accentClass === 'text-emerald-400' ? 'bg-emerald-500/20' : 'bg-blue-500/20'} animate-pulse blur-xl"></div>
                </div>
                <div class="space-y-0.5">
                    <h3 class="font-black text-white text-[10px] uppercase tracking-[0.2em] font-display">${title}</h3>
                    <div class="flex items-center gap-1.5">
                        <span class="w-1.5 h-1.5 rounded-full ${accentClass === 'text-red-400' ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse"></span>
                        <span class="text-[8px] font-black text-slate-500 uppercase tracking-widest">Live Telemetry</span>
                    </div>
                </div>
            </div>
            ${badgeType ? `<span class="badge-elite ${isAlert ? 'badge-danger' : 'badge-success'} p-1.5 rounded-lg border ${borderAccentClass}">${badgeText}</span>` : ''}
        </div>
        
        <div class="flex items-baseline gap-2 mb-6">
            <span class="sensor-val text-5xl font-black tracking-tighter text-white font-display">${value}</span>
            <span class="text-slate-500 font-bold text-sm uppercase font-mono">${unit}</span>
        </div>
        
        <div class="mt-auto">
            <div class="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-4">
                <div class="h-full ${accentClass === 'text-red-400' ? 'bg-red-500' : 'bg-emerald-500'} opacity-30 w-full animate-pulse"></div>
            </div>
            ${children}
        </div>
    `;
    
    // Telemetry Animation logic
    const valEl = card.querySelector('.sensor-val');
    if (valEl) {
        const to = parseFloat(value) || 0;
        valEl.textContent = '0.0';
        animateTelemetry(valEl, 0, to, unit === '%' ? 1 : 2);
    }

    return card;
}

function animateTelemetry(el, from, to, decimals = 1) {
    const diff = to - from;
    const duration = 800;
    const start = performance.now();
    const frame = (now) => {
        const p = Math.min((now-start)/duration, 1);
        const ease = 1 - Math.pow(1-p, 4); // Quartic ease out
        el.textContent = (from + diff*ease).toFixed(decimals);
        if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
}
