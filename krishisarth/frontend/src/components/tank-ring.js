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
    container.className = "relative flex items-center justify-center";
    
    container.innerHTML = `
        <svg class="w-32 h-32 transform -rotate-90">
            <!-- Background Circle -->
            <circle
                class="text-gray-100"
                stroke-width="8"
                stroke="currentColor"
                fill="transparent"
                r="${radius}"
                cx="64"
                cy="64"
            />
            <!-- Progress Circle -->
            <circle
                class="text-primary-light transition-all duration-1000 ease-out"
                stroke-width="8"
                stroke-dasharray="${circumference} ${circumference}"
                stroke-dashoffset="${offset}"
                stroke-linecap="round"
                stroke="currentColor"
                fill="transparent"
                r="${radius}"
                cx="64"
                cy="64"
            />
        </svg>
        <div class="absolute flex flex-col items-center">
            <span class="text-2xl font-black text-gray-800">${percentage}%</span>
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter" data-i18n="tank_reservoir">${t('tank_reservoir') || 'RESERVOIR'}</span>
        </div>
    `;
    
    return container;
}
