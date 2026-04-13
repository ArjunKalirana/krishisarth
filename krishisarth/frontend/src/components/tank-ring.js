/**
 * TankRing Component
 * Renders a circular SVG progress ring for water levels.
 */
import { t } from '../utils/i18n.js';
export function createTankRing(percentage) {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    
    const container = document.createElement('div');
    container.className = "relative flex items-center justify-center p-4 glass-panel rounded-full border-white/5 shadow-2xl";
    
    container.innerHTML = `
        <svg class="w-40 h-40 transform -rotate-90">
            <!-- Background Circle -->
            <circle
                class="text-white/5"
                stroke-width="12"
                stroke="currentColor"
                fill="transparent"
                r="${radius}"
                cx="80"
                cy="80"
            />
            <!-- Progress Circle -->
            <circle
                class="text-emerald-500 transition-all duration-1000 ease-out"
                stroke-width="12"
                stroke-dasharray="${circumference} ${circumference}"
                stroke-dashoffset="${offset}"
                stroke-linecap="round"
                stroke="currentColor"
                fill="transparent"
                r="${radius}"
                cx="80"
                cy="80"
                style="filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))"
            />
        </svg>
        <div class="absolute flex flex-col items-center">
            <span class="text-4xl font-black text-white font-display">${percentage}%</span>
            <span class="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-1" data-i18n="tank_reservoir">${t('tank_reservoir') || 'RESERVOIR'}</span>
        </div>
    `;
    
    return container;
}
