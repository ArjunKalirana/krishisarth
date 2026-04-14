import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { showToast } from '../components/toast.js';
import { store } from '../state/store.js';
import { api } from '../api/client.js';

/**
 * KrishiSarth Digital Twin v6.0 — Multi-Zone Instanced GLB Renderer
 *
 * CRITICAL FIX: Previous versions used `container.innerHTML += ...` which
 * serializes then re-parses the DOM, destroying the WebGL canvas element.
 * The renderer kept a reference to the OLD canvas → black screen.
 *
 * This version uses insertAdjacentHTML / createElement exclusively to
 * inject HUD overlays WITHOUT touching the renderer's canvas.
 *
 * Each farm zone gets its own clone of the GLB model, arranged in a grid.
 */

// ── Zone positions (grid layout for up to 9 zones) ──────────────────
const ZONE_GRID = [
    { x:   0, z:   0 },   // zone 1 — center
    { x:  25, z:   0 },   // zone 2
    { x: -25, z:   0 },   // zone 3
    { x:   0, z:  25 },   // zone 4
    { x:  25, z:  25 },   // zone 5
    { x: -25, z:  25 },   // zone 6
    { x:   0, z: -25 },   // zone 7
    { x:  25, z: -25 },   // zone 8
    { x: -25, z: -25 },   // zone 9
];

// The absolute path to the model — must match Vercel's static asset serving
const MODEL_PATH = './assets/model.glb';

export function renderFarm3D() {
    // ─── Container ──────────────────────────────────────────────
    const container = document.createElement('div');
    container.id = 'farm3d-root';
    container.style.cssText = 'position:relative;width:100%;height:100vh;background:#0a0f12;overflow:hidden;';

    // ─── Build the HUD overlay FIRST (as raw HTML) ──────────────
    // We add these as a separate div layer so they never interfere with the canvas.
    const hud = document.createElement('div');
    hud.id = 'farm3d-hud';
    hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:10;';
    hud.innerHTML = `
        <!-- Loading Indicator -->
        <div id="twin-loading" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;background:#0a0f12;z-index:40;">
            <div style="position:relative;width:96px;height:96px;">
                <div style="position:absolute;inset:0;border:4px solid rgba(16,185,129,0.1);border-top-color:#10b981;border-radius:50%;animation:spin 1s linear infinite;"></div>
                <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.5" stroke-linecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                </div>
            </div>
            <div style="text-align:center;">
                <div style="color:#10b981;font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.5em;animation:pulse 2s ease-in-out infinite;">
                    Loading 3D Model... <span id="twin-loading-pct">0%</span>
                </div>
                <div style="width:200px;height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;margin-top:12px;">
                    <div id="twin-loading-bar" style="height:100%;width:0%;background:#10b981;box-shadow:0 0 10px #10b981;transition:width 0.3s;"></div>
                </div>
            </div>
        </div>

        <!-- Mode Toggle (pointer-events auto so buttons work) -->
        <div style="position:absolute;top:24px;left:24px;display:flex;flex-direction:column;gap:16px;z-index:50;pointer-events:auto;">
            <div style="background:rgba(10,15,20,0.8);backdrop-filter:blur(20px);padding:8px;display:flex;flex-direction:column;gap:8px;border:1px solid rgba(255,255,255,0.05);border-radius:16px;">
                <button id="twin-mode-view" title="View Mode" style="width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(16,185,129,0.2);background:rgba(16,185,129,0.1);color:#10b981;cursor:pointer;transition:all 0.3s;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button id="twin-mode-act" title="Act Mode" style="width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:#64748b;cursor:pointer;transition:all 0.3s;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </button>
            </div>
        </div>

        <!-- Zone Info (bottom-left) -->
        <div id="twin-zone-info" style="position:absolute;bottom:24px;left:24px;z-index:50;pointer-events:auto;display:none;">
            <div style="background:rgba(10,15,20,0.85);backdrop-filter:blur(20px);padding:24px 32px;border:1px solid rgba(255,255,255,0.05);border-radius:24px;min-width:280px;">
                <div id="twin-zone-name" style="font-family:'Manrope',sans-serif;font-size:20px;font-weight:800;color:#fff;margin-bottom:4px;"></div>
                <div id="twin-zone-crop" style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#10b981;text-transform:uppercase;letter-spacing:0.2em;margin-bottom:16px;"></div>
                <div style="display:flex;gap:24px;">
                    <div>
                        <div style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Moisture</div>
                        <div id="twin-zone-moisture" style="font-family:'Manrope',sans-serif;font-size:24px;font-weight:800;color:#fff;">--%</div>
                    </div>
                    <div>
                        <div style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Temp</div>
                        <div id="twin-zone-temp" style="font-family:'Manrope',sans-serif;font-size:24px;font-weight:800;color:#fff;">--°C</div>
                    </div>
                    <div>
                        <div style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">EC</div>
                        <div id="twin-zone-ec" style="font-family:'Manrope',sans-serif;font-size:24px;font-weight:800;color:#fff;">--</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Side Panel -->
        <div id="twin-panel" style="position:absolute;top:24px;right:24px;width:100%;max-width:400px;padding:32px;z-index:100;border:1px solid rgba(255,255,255,0.05);border-radius:24px;transition:transform 0.7s cubic-bezier(0.16,1,0.3,1);background:rgba(10,15,20,0.8);backdrop-filter:blur(20px);transform:translateX(460px);pointer-events:auto;">
        </div>
    `;
    container.appendChild(hud);

    // ─── Inline CSS for animations ──────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
    `;
    container.appendChild(style);

    // ─── State ──────────────────────────────────────────────────
    let mode = 'view';
    let selectedZoneIdx = -1;
    const zoneModels = [];     // { group, zone, label } per zone
    const interactives = [];   // all meshes for raycasting

    // ─── Three.js Core ──────────────────────────────────────────
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.setClearColor(0x0a0f12);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0f12, 0.004);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
    camera.position.set(50, 50, 50);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.target.set(0, 0, 0);
    controls.minDistance = 15;
    controls.maxDistance = 200;

    // ─── Lighting ───────────────────────────────────────────────
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.6));
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(30, 40, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 150;
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x8eb4d4, 0.4);
    fill.position.set(-20, 15, -10);
    scene.add(fill);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(500, 500);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x1a2520,
        roughness: 0.95,
        metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper for visual reference
    const grid = new THREE.GridHelper(200, 40, 0x10b981, 0x0a1510);
    grid.material.opacity = 0.15;
    grid.material.transparent = true;
    scene.add(grid);

    // ─── Raycaster ──────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    // ─── Get zone data ──────────────────────────────────────────
    function getZones() {
        // Try from dashboard cache first, then from store
        const dashData = store.getState('currentFarmDashboard');
        if (dashData && dashData.zones && dashData.zones.length > 0) {
            return dashData.zones;
        }
        // Fallback: generate placeholder zones
        return [
            { id: 'zone-1', name: 'Zone Alpha', crop_type: 'Tomato', moisture_pct: 65, temp_c: 28, ec_ds_m: 1.2 },
            { id: 'zone-2', name: 'Zone Beta', crop_type: 'Wheat', moisture_pct: 42, temp_c: 31, ec_ds_m: 0.8 },
            { id: 'zone-3', name: 'Zone Gamma', crop_type: 'Rice', moisture_pct: 78, temp_c: 26, ec_ds_m: 1.5 },
            { id: 'zone-4', name: 'Zone Delta', crop_type: 'Cotton', moisture_pct: 35, temp_c: 33, ec_ds_m: 0.6 },
        ];
    }

    // ─── Create a floating label sprite ─────────────────────────
    function createLabel(text, subtext) {
        const canvas2d = document.createElement('canvas');
        canvas2d.width = 512;
        canvas2d.height = 160;
        const ctx = canvas2d.getContext('2d');

        // Background
        ctx.fillStyle = 'rgba(10, 15, 18, 0.85)';
        ctx.beginPath();
        ctx.roundRect(0, 0, 512, 160, 20);
        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(0, 0, 512, 160, 20);
        ctx.stroke();

        // Main text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 42px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, 256, 65);

        // Sub text
        ctx.fillStyle = '#10b981';
        ctx.font = '600 28px sans-serif';
        ctx.fillText(subtext, 256, 115);

        const texture = new THREE.CanvasTexture(canvas2d);
        texture.needsUpdate = true;

        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(12, 3.75, 1);
        return sprite;
    }

    // ─── Create zone platform (ground marker) ───────────────────
    function createPlatform(zoneIndex, zoneCount) {
        const platformGeo = new THREE.CylinderGeometry(10, 10, 0.3, 32);
        const hue = (zoneIndex / Math.max(zoneCount, 1)) * 0.3; // green range
        const platformMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.38 + hue * 0.1, 0.5, 0.12),
            roughness: 0.8,
            metalness: 0.1,
            transparent: true,
            opacity: 0.6,
        });
        const platform = new THREE.Mesh(platformGeo, platformMat);
        platform.receiveShadow = true;
        return platform;
    }

    // ─── Load and place models ──────────────────────────────────
    const loader = new GLTFLoader();

    console.log('[DigitalTwin] Loading model from:', MODEL_PATH);

    loader.load(
        MODEL_PATH,
        (gltf) => {
            console.log('[DigitalTwin] Model loaded successfully!');
            const zones = getZones();
            const sourceModel = gltf.scene;

            zones.forEach((zone, i) => {
                const pos = ZONE_GRID[i] || { x: i * 25, z: 0 };

                // Clone the model for each zone
                const modelClone = sourceModel.clone(true);
                modelClone.scale.setScalar(25);

                // Create a group to hold model + label + platform
                const group = new THREE.Group();
                group.position.set(pos.x, 0, pos.z);

                // Platform
                const platform = createPlatform(i, zones.length);
                platform.position.y = -0.15;
                group.add(platform);

                // Model
                modelClone.position.set(0, 0, 0);
                modelClone.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (child.material) {
                            child.material = child.material.clone();
                        }
                        child.userData.zoneIndex = i;
                        child.userData.zoneName = zone.name;
                        interactives.push(child);
                    }
                });
                group.add(modelClone);

                // Floating label
                const label = createLabel(zone.name, zone.crop_type || 'Unknown Crop');
                label.position.set(0, 50, 0);
                group.add(label);

                scene.add(group);
                zoneModels.push({ group, zone, label });
            });

            // Auto-adjust camera to see all zones
            if (zones.length > 1) {
                const dist = Math.max(zones.length * 12, 60);
                camera.position.set(dist * 0.7, dist * 0.6, dist * 0.7);
                controls.target.set(0, 0, 0);
            }

            // Hide loading
            const loadingEl = hud.querySelector('#twin-loading');
            if (loadingEl) {
                loadingEl.style.transition = 'opacity 0.8s ease-out';
                loadingEl.style.opacity = '0';
                setTimeout(() => { loadingEl.style.display = 'none'; }, 800);
            }

            showToast(`Digital Twin Active — ${zones.length} zone(s) loaded`, 'success');
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
                        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#64748b;margin-bottom:24px;word-break:break-all;">
                            Path: ${MODEL_PATH}<br/>Error: ${err.message || 'Unknown'}
                        </div>
                        <button onclick="window.location.reload()" style="padding:12px 32px;background:#ef4444;color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">
                            RETRY
                        </button>
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

        // Hover/selection highlights
        for (const mesh of interactives) {
            if (!mesh.material || !mesh.material.emissive) continue;
            const zi = mesh.userData.zoneIndex;
            if (zi === selectedZoneIdx) {
                mesh.material.emissive.setHex(0x10b981);
                mesh.material.emissiveIntensity = 0.4 + Math.sin(elapsed * 4) * 0.2;
            } else {
                mesh.material.emissive.setHex(0x000000);
                mesh.material.emissiveIntensity = 0;
            }
        }

        // Gentle model bobbing
        zoneModels.forEach((zm, i) => {
            if (zm.label) {
                zm.label.position.y = 50 + Math.sin(elapsed * 1.5 + i) * 0.3;
            }
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

    // ─── Pointer Events ─────────────────────────────────────────
    function onPointerMove(e) {
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (mode === 'act') {
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(interactives, false);
            canvas.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
        }
    }

    function onClick(e) {
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(interactives, false);

        if (hits.length > 0) {
            const zi = hits[0].object.userData.zoneIndex;
            selectedZoneIdx = zi;
            const zm = zoneModels[zi];
            if (zm) {
                const infoPanel = hud.querySelector('#twin-zone-info');
                const zone = zm.zone;
                if (infoPanel) {
                    infoPanel.style.display = 'block';
                    hud.querySelector('#twin-zone-name').textContent = zone.name;
                    hud.querySelector('#twin-zone-crop').textContent = zone.crop_type || 'Unknown';
                    hud.querySelector('#twin-zone-moisture').textContent = `${zone.moisture_pct || '--'}%`;
                    hud.querySelector('#twin-zone-temp').textContent = `${zone.temp_c || '--'}°C`;
                    hud.querySelector('#twin-zone-ec').textContent = `${zone.ec_ds_m || '--'}`;
                }
            }
        } else {
            selectedZoneIdx = -1;
            const infoPanel = hud.querySelector('#twin-zone-info');
            if (infoPanel) infoPanel.style.display = 'none';
        }
    }

    // ─── Mode Buttons ───────────────────────────────────────────
    function setMode(newMode) {
        mode = newMode;
        const viewBtn = hud.querySelector('#twin-mode-view');
        const actBtn = hud.querySelector('#twin-mode-act');
        if (viewBtn) {
            viewBtn.style.background = mode === 'view' ? 'rgba(16,185,129,0.1)' : 'transparent';
            viewBtn.style.color = mode === 'view' ? '#10b981' : '#64748b';
            viewBtn.style.border = mode === 'view' ? '1px solid rgba(16,185,129,0.2)' : 'none';
        }
        if (actBtn) {
            actBtn.style.background = mode === 'act' ? 'rgba(16,185,129,0.1)' : 'transparent';
            actBtn.style.color = mode === 'act' ? '#10b981' : '#64748b';
            actBtn.style.border = mode === 'act' ? '1px solid rgba(16,185,129,0.2)' : 'none';
        }
        if (mode === 'view') {
            selectedZoneIdx = -1;
            const infoPanel = hud.querySelector('#twin-zone-info');
            if (infoPanel) infoPanel.style.display = 'none';
        }
    }

    // ─── Boot ───────────────────────────────────────────────────
    setTimeout(() => {
        onResize();
        animate();

        window.addEventListener('resize', onResize);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('click', onClick);

        const viewBtn = hud.querySelector('#twin-mode-view');
        const actBtn = hud.querySelector('#twin-mode-act');
        viewBtn?.addEventListener('click', () => setMode('view'));
        actBtn?.addEventListener('click', () => setMode('act'));
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
