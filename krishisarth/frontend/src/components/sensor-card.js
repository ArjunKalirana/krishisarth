/**
 * SensorCard Component (Elite Edition)
 * A high-fidelity, glassmorphic container for farm intelligence.
 */
export function createSensorCard({ title, icon, value, unit, badgeType, badgeText, children = "" }) {
    const card = document.createElement('div');
    card.className = "ks-card glass-panel group p-6 flex flex-col h-full transition-all hover:scale-[1.02] cursor-pointer";
    
    // Determine thematic color
    const isWater = icon.includes('drop') || title.toLowerCase().includes('moisture');
    const accentClass = isWater ? 'text-emerald-400' : 'text-blue-400';
    const bgAccentClass = isWater ? 'bg-emerald-500/10' : 'bg-blue-500/10';

    card.innerHTML = `
        <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-4">
                <div class="p-2.5 ${bgAccentClass} rounded-xl border border-white/5">
                    <i data-lucide="${icon}" class="w-5 h-5 ${accentClass}"></i>
                </div>
                <h3 class="font-extrabold text-white text-[10px] uppercase tracking-[0.2em] font-display">${title}</h3>
            </div>
            ${badgeType ? `<span class="badge-elite badge-${badgeType === 'dry' ? 'danger' : 'success'}">${badgeText}</span>` : ''}
        </div>
        
        <div class="flex items-baseline gap-2 mb-6">
            <span class="sensor-val text-4xl font-black tracking-tighter text-white font-display">${value}</span>
            <span class="text-slate-500 font-bold text-sm uppercase font-mono">${unit}</span>
        </div>
        
        <div class="mt-auto">
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
