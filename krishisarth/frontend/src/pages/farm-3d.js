import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { showToast } from '../components/toast.js';
import { store } from '../state/store.js';

/**
 * KrishiSarth Digital Twin v7.0 — Single Model with Component Labels
 *
 * The GLB model is ONE integrated farm system containing all zones,
 * pipes, valves, pumps, etc. We load it once (no cloning) and overlay
 * 3D label sprites to identify each component.
 *
 * FIX: Previous version cloned the model per zone which broke pipes
 * and other connected geometry. This version uses the model as-is.
 */

const MODEL_PATH = './assets/model.glb';

// ── Component labels to overlay on the 3D model ─────────────────────
// Positions are relative to model center — will be tuned after loading.
const COMPONENT_LABELS = [
    { name: 'Greenhouse',         sub: 'Polyhouse Zone',    pos: [-12, 8, -8],   color: '#10b981' },
    { name: 'Water Tank',         sub: 'Main Reservoir',    pos: [12, 8, -10],   color: '#3b82f6' },
    { name: 'Leafy Greens Zone',  sub: 'Zone B',            pos: [4, 4, -5],     color: '#10b981' },
    { name: 'Root Vegetables',    sub: 'Zone C',            pos: [0, 4, 0],      color: '#f59e0b' },
    { name: 'Herbs Zone',         sub: 'Zone D',            pos: [-6, 4, 2],     color: '#10b981' },
    { name: 'RC385 Pump',         sub: 'Main Pump',         pos: [12, 5, 0],     color: '#ef4444' },
    { name: 'Fertilizer Mixer',   sub: 'Nutrient Injector', pos: [10, 5, 3],     color: '#a855f7' },
    { name: 'Valve B',            sub: 'Leafy Greens',      pos: [6, 3, 4],      color: '#f97316' },
    { name: 'Valve D',            sub: 'Herbs',             pos: [0, 3, 6],      color: '#f97316' },
    { name: 'Valve Greenhouse',   sub: 'Polyhouse',         pos: [-12, 3, 6],    color: '#f97316' },
    { name: 'Moisture Sensor',    sub: 'IoT Node',          pos: [2, 6, -8],     color: '#06b6d4' },
    { name: 'ESP32 Controller',   sub: 'MCU Hub',           pos: [0, 3, 10],     color: '#64748b' },
];

export function renderFarm3D() {
    // ─── Container ──────────────────────────────────────────────
    const container = document.createElement('div');
    container.id = 'farm3d-root';
    container.style.cssText = 'position:relative;width:100%;height:100vh;background:#0a0f12;overflow:hidden;';

    // ─── Canvas (created explicitly — never use innerHTML on container) ─
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    // ─── HUD overlay (separate div, never touches the canvas) ───
    const hud = document.createElement('div');
    hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:10;';
    hud.innerHTML = `
        <!-- Loading -->
        <div id="twin-loading" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;background:#0a0f12;z-index:40;">
            <div style="position:relative;width:96px;height:96px;">
                <div style="position:absolute;inset:0;border:4px solid rgba(16,185,129,0.1);border-top-color:#10b981;border-radius:50%;animation:spin 1s linear infinite;"></div>
                <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                </div>
            </div>
            <div style="text-align:center;">
                <div style="color:#10b981;font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.5em;animation:pulse 2s ease-in-out infinite;">
                    Loading 3D Model... <span id="twin-loading-pct">0%</span>
                </div>
                <div style="width:200px;height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;margin-top:12px;">
                    <div id="twin-loading-bar" style="height:100%;width:0%;background:#10b981;transition:width 0.3s;"></div>
                </div>
            </div>
        </div>

        <!-- Toggle Labels Button -->
        <div style="position:absolute;top:24px;left:24px;z-index:50;pointer-events:auto;display:flex;flex-direction:column;gap:8px;">
            <div style="background:rgba(10,15,20,0.8);backdrop-filter:blur(20px);padding:8px;display:flex;flex-direction:column;gap:8px;border:1px solid rgba(255,255,255,0.05);border-radius:16px;">
                <button id="twin-toggle-labels" title="Toggle Labels" style="width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(16,185,129,0.2);background:rgba(16,185,129,0.1);color:#10b981;cursor:pointer;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/><circle cx="6" cy="6" r="0.5" fill="currentColor"/></svg>
                </button>
                <button id="twin-reset-cam" title="Reset Camera" style="width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:#64748b;cursor:pointer;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                </button>
            </div>
        </div>

        <!-- Component Info (shown on click) -->
        <div id="twin-info" style="position:absolute;bottom:24px;left:24px;z-index:50;pointer-events:auto;display:none;">
            <div style="background:rgba(10,15,20,0.9);backdrop-filter:blur(20px);padding:20px 28px;border:1px solid rgba(255,255,255,0.05);border-radius:20px;min-width:240px;">
                <div id="twin-info-name" style="font-family:'Manrope',sans-serif;font-size:18px;font-weight:800;color:#fff;"></div>
                <div id="twin-info-sub" style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#10b981;text-transform:uppercase;letter-spacing:0.2em;margin-top:4px;"></div>
            </div>
        </div>

        <!-- Legend -->
        <div style="position:absolute;bottom:24px;right:24px;z-index:50;pointer-events:auto;">
            <div style="background:rgba(10,15,20,0.85);backdrop-filter:blur(20px);padding:16px 20px;border:1px solid rgba(255,255,255,0.05);border-radius:16px;font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.15em;color:#64748b;">
                <div style="margin-bottom:8px;color:#fff;font-weight:800;font-size:10px;">LEGEND</div>
                <div style="display:flex;flex-direction:column;gap:6px;">
                    <div style="display:flex;align-items:center;gap:8px;"><div style="width:10px;height:10px;border-radius:50%;background:#10b981;"></div> Grow Zones</div>
                    <div style="display:flex;align-items:center;gap:8px;"><div style="width:10px;height:10px;border-radius:50%;background:#3b82f6;"></div> Water System</div>
                    <div style="display:flex;align-items:center;gap:8px;"><div style="width:10px;height:10px;border-radius:50%;background:#f97316;"></div> Valves</div>
                    <div style="display:flex;align-items:center;gap:8px;"><div style="width:10px;height:10px;border-radius:50%;background:#ef4444;"></div> Pump</div>
                    <div style="display:flex;align-items:center;gap:8px;"><div style="width:10px;height:10px;border-radius:50%;background:#a855f7;"></div> Mixer</div>
                    <div style="display:flex;align-items:center;gap:8px;"><div style="width:10px;height:10px;border-radius:50%;background:#06b6d4;"></div> Sensors</div>
                </div>
            </div>
        </div>
    `;
    container.appendChild(hud);

    // ─── Inline styles ──────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
    `;
    container.appendChild(style);

    // ─── State ──────────────────────────────────────────────────
    let labelsVisible = true;
    const labelSprites = [];

    // ─── Three.js Core ──────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.setClearColor(0x0a0f12);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0f12, 0.003);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
    camera.position.set(60, 50, 60);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.set(0, 5, 0);
    controls.minDistance = 20;
    controls.maxDistance = 300;

    // ─── Lighting ───────────────────────────────────────────────
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.7));
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(40, 60, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    scene.add(sun);

    scene.add(new THREE.DirectionalLight(0x8eb4d4, 0.5).translateX(-20).translateY(15));

    // Ground
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(500, 500),
        new THREE.MeshStandardMaterial({ color: 0x1a2520, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid
    const grid = new THREE.GridHelper(200, 40, 0x10b981, 0x0a1510);
    grid.material.opacity = 0.12;
    grid.material.transparent = true;
    scene.add(grid);

    // ─── Create label sprite ────────────────────────────────────
    function createLabel(name, sub, color) {
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 140;
        const ctx = c.getContext('2d');

        // Background
        ctx.fillStyle = 'rgba(10, 15, 18, 0.88)';
        ctx.beginPath();
        ctx.roundRect(0, 0, 512, 140, 16);
        ctx.fill();

        // Left color bar
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(0, 0, 6, 140, [16, 0, 0, 16]);
        ctx.fill();

        // Name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(name, 24, 58);

        // Sub
        ctx.fillStyle = color;
        ctx.font = '600 22px sans-serif';
        ctx.fillText(sub, 24, 100);

        const texture = new THREE.CanvasTexture(c);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(10, 2.75, 1);

        // Add a thin line from label down to the component
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, -3, 0),
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.4 });
        const line = new THREE.Line(lineGeo, lineMat);
        sprite.add(line);

        return sprite;
    }

    // ─── Load Model ─────────────────────────────────────────────
    const loader = new GLTFLoader();
    console.log('[DigitalTwin] Loading:', MODEL_PATH);

    loader.load(
        MODEL_PATH,
        (gltf) => {
            console.log('[DigitalTwin] Model loaded!');
            const model = gltf.scene;

            // Scale the model to fill the view — single instance, no cloning
            model.scale.setScalar(25);
            model.position.set(0, 0, 0);

            // Log mesh names for future fine-tuning
            console.log('[DigitalTwin] Model hierarchy:');
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    console.log('  Mesh:', child.name, 'Parent:', child.parent?.name);
                }
            });

            scene.add(model);

            // ── Add component labels ────────────────────────────
            // After the model is added, compute its bounding box to
            // position labels relative to the actual model size
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            console.log('[DigitalTwin] Model bounds — center:', center, 'size:', size);

            // Position labels relative to model center
            COMPONENT_LABELS.forEach((comp) => {
                const sprite = createLabel(comp.name, comp.sub, comp.color);

                // Scale label positions based on actual model size
                const sx = size.x / 30;
                const sy = size.y / 15;
                const sz = size.z / 30;

                sprite.position.set(
                    center.x + comp.pos[0] * sx,
                    center.y + comp.pos[1] * sy + 2,
                    center.z + comp.pos[2] * sz
                );

                scene.add(sprite);
                labelSprites.push(sprite);
            });

            // Auto-frame the camera to see the whole model
            const maxDim = Math.max(size.x, size.y, size.z);
            const dist = maxDim * 1.2;
            camera.position.set(
                center.x + dist * 0.6,
                center.y + dist * 0.5,
                center.z + dist * 0.6
            );
            controls.target.copy(center);
            controls.update();

            // Hide loading
            const loadingEl = hud.querySelector('#twin-loading');
            if (loadingEl) {
                loadingEl.style.transition = 'opacity 0.8s ease-out';
                loadingEl.style.opacity = '0';
                setTimeout(() => { loadingEl.style.display = 'none'; }, 800);
            }

            showToast('Digital Twin Synchronized', 'success');
        },
        (progress) => {
            if (progress.total > 0) {
                const pct = Math.round((progress.loaded / progress.total) * 100);
                const pctEl = hud.querySelector('#twin-loading-pct');
                const barEl = hud.querySelector('#twin-loading-bar');
                if (pctEl) pctEl.textContent = `${pct}%`;
                if (barEl) barEl.style.width = `${pct}%`;
            }
        },
        (err) => {
            console.error('[DigitalTwin] LOAD ERROR:', err);
            const loadingEl = hud.querySelector('#twin-loading');
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <div style="background:rgba(10,15,20,0.9);padding:48px;border-radius:24px;border:1px solid rgba(239,68,68,0.2);text-align:center;max-width:400px;">
                        <div style="font-family:'Manrope',sans-serif;font-size:24px;font-weight:800;color:#ef4444;margin-bottom:8px;">MODEL LOAD FAILED</div>
                        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#64748b;margin-bottom:24px;">
                            Path: ${MODEL_PATH}<br/>Error: ${err.message || 'Unknown'}
                        </div>
                        <button onclick="window.location.reload()" style="padding:12px 32px;background:#ef4444;color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer;">RETRY</button>
                    </div>`;
            }
        }
    );

    // ─── Render Loop ────────────────────────────────────────────
    const clock = new THREE.Clock();
    let animId = null;

    function animate() {
        animId = requestAnimationFrame(animate);
        const elapsed = clock.getElapsedTime();
        controls.update();

        // Gentle label bobbing
        labelSprites.forEach((s, i) => {
            s.position.y += Math.sin(elapsed * 1.2 + i * 0.7) * 0.003;
        });

        renderer.render(scene, camera);
    }

    // ─── Resize ─────────────────────────────────────────────────
    function onResize() {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    // ─── Raycaster for label clicks ─────────────────────────────
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function onClick(e) {
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(labelSprites, false);

        const infoPanel = hud.querySelector('#twin-info');
        if (hits.length > 0) {
            const idx = labelSprites.indexOf(hits[0].object);
            if (idx >= 0 && COMPONENT_LABELS[idx]) {
                const comp = COMPONENT_LABELS[idx];
                infoPanel.style.display = 'block';
                hud.querySelector('#twin-info-name').textContent = comp.name;
                hud.querySelector('#twin-info-sub').textContent = comp.sub;
            }
        } else {
            if (infoPanel) infoPanel.style.display = 'none';
        }
    }

    // ─── Boot ───────────────────────────────────────────────────
    setTimeout(() => {
        onResize();
        animate();

        window.addEventListener('resize', onResize);
        canvas.addEventListener('click', onClick);

        // Toggle labels button
        hud.querySelector('#twin-toggle-labels')?.addEventListener('click', () => {
            labelsVisible = !labelsVisible;
            labelSprites.forEach(s => { s.visible = labelsVisible; });
            const btn = hud.querySelector('#twin-toggle-labels');
            if (btn) {
                btn.style.background = labelsVisible ? 'rgba(16,185,129,0.1)' : 'transparent';
                btn.style.color = labelsVisible ? '#10b981' : '#64748b';
            }
        });

        // Reset camera button
        hud.querySelector('#twin-reset-cam')?.addEventListener('click', () => {
            camera.position.set(60, 50, 60);
            controls.target.set(0, 5, 0);
            controls.update();
        });
    }, 50);

    // ─── Cleanup ────────────────────────────────────────────────
    const observer = new MutationObserver(() => {
        if (!document.body.contains(container)) {
            if (animId) cancelAnimationFrame(animId);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
            controls.dispose();
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return container;
}
