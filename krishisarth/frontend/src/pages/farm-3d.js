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

    let root = null;

    // Use a slight delay to ensure the container is attached to the body
    setTimeout(() => {
        const rootElement = document.getElementById('farm3d-mount-root');
        if (rootElement) {
            root = createRoot(rootElement);
            root.render(React.createElement(DigitalTwin));
        }
    }, 0);

    // Patch the element to handle its own destruction when removed from DOM
    // The main router in app.js clears innerHTML, so we listen for that
    const observer = new MutationObserver((mutations) => {
        if (!document.body.contains(container)) {
            if (root) {
                root.unmount();
                root = null;
            }
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return container;
}
