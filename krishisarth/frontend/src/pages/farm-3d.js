import React from 'react';
import { createRoot } from 'react-dom/client';
import DigitalTwin from './DigitalTwin.js';

/**
 * KrishiSarth Elite Digital Twin (v4.0 - Bridge)
 * This is the Vanilla JS bridge that mounts the React Three Fiber component.
 */
export function renderFarm3D() {
    const container = document.createElement('div');
    container.className = 'w-full h-full';
    container.id = 'farm3d-mount-root';

    // We use a micro-task to ensure the root is in the DOM before mounting
    setTimeout(() => {
        try {
            const rootElement = document.getElementById('farm3d-mount-root');
            if (rootElement) {
                const root = createRoot(rootElement);
                root.render(React.createElement(DigitalTwin));
            }
        } catch (err) {
            console.error('[DigitalTwin] Mount Failure:', err);
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-screen bg-[#0a0f12]">
                    <div class="text-red-500 font-mono text-xs uppercase tracking-widest mb-4">React_Runtime_Error</div>
                    <div class="text-slate-500 text-[10px] max-w-sm text-center">${err.message}</div>
                </div>
            `;
        }
    }, 0);

    return container;
}
