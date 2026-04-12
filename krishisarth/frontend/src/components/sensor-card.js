/**
 * SensorCard Component
 * A reusable container for individual farm metrics.
 */
export function createSensorCard({ title, icon, value, unit, badgeType, badgeText, children = "" }) {
    const card = document.createElement('div');
    card.className = "zone-card ks-card p-6 flex flex-col h-full";
    
    card.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-primary/10 rounded-lg text-primary">
                    <i data-lucide="${icon}" class="w-5 h-5"></i>
                </div>
                <h3 class="font-bold text-gray-700 text-sm uppercase tracking-wider">${title}</h3>
            </div>
            ${badgeType ? `<span class="badge badge-${badgeType}">${badgeText}</span>` : ''}
        </div>
        
        <div class="flex items-baseline gap-1 mb-4">
            <span class="sensor-val text-4xl font-extrabold tracking-tight text-gray-900">${value}</span>
            <span class="text-gray-400 font-semibold text-lg">${unit}</span>
        </div>
        
        <div class="mt-auto">
            ${children}
        </div>
    `;
    
    // Re-trigger icon rendering if needed after insertion
    const valEl = card.querySelector('.sensor-val');
    if (valEl && unit === '%') {
        const to = parseFloat(value) || 0;
        valEl.textContent = '0.0';
        animateMoistureChange(valEl, 0, to);
    }

    return card;
}

function animateMoistureChange(el, from, to) {
    const diff = to - from;
    const duration = 600;
    const start = performance.now();
    const frame = (now) => {
        const p = Math.min((now-start)/duration, 1);
        const ease = 1 - Math.pow(1-p, 3);
        el.textContent = (from + diff*ease).toFixed(1);
        if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
}
