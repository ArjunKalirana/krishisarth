import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { showToast } from '../components/toast.js';
import { store } from '../state/store.js';

/**
 * KrishiSarth Digital Twin v8.0 — Multi-Zone with Deep Clone Fix
 *
 * FIX: Standard clone() breaks Lines/LineSegments (pipes).
 * This version manually deep-clones geometry + materials for
 * ALL renderable types (Mesh, Line, LineSegments, Points).
 */

const MODEL_PATH = './assets/model.glb';

// Grid positions for up to 9 zones
const ZONE_GRID = [
    { x:   0, z:   0 },
    { x:  50, z:   0 },
    { x: -50, z:   0 },
    { x:   0, z:  50 },
    { x:  50, z:  50 },
    { x: -50, z:  50 },
    { x:   0, z: -50 },
    { x:  50, z: -50 },
    { x: -50, z: -50 },
];

/** Deep-clone a scene graph preserving ALL renderable types (Mesh, Line, etc.) */
function deepCloneModel(source) {
    const clone = source.clone(true);

    clone.traverse((node) => {
        // Clone geometry for Mesh, Line, LineSegments, Points — everything renderable
        if (node.geometry) {
            node.geometry = node.geometry.clone();
        }
        // Clone materials so changes don't bleed
        if (node.material) {
            if (Array.isArray(node.material)) {
                node.material = node.material.map(m => m.clone());
            } else {
                node.material = node.material.clone();
            }
        }
    });

    return clone;
}

export function renderFarm3D() {
    // ─── Container ──────────────────────────────────────────────
    const container = document.createElement('div');
    container.id = 'farm3d-root';
    container.style.cssText = 'position:relative;width:100%;height:100vh;background:#0a0f12;overflow:hidden;';

    // ─── Canvas ─────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    // ─── HUD (separate div — never touches canvas) ──────────────
    const hud = document.createElement('div');
    hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:10;';
    hud.innerHTML = `
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

        <!-- Mode Toggle -->
        <div style="position:absolute;top:24px;left:24px;z-index:50;pointer-events:auto;">
            <div style="background:rgba(10,15,20,0.8);backdrop-filter:blur(20px);padding:8px;display:flex;flex-direction:column;gap:8px;border:1px solid rgba(255,255,255,0.05);border-radius:16px;">
                <button id="twin-mode-view" title="View Mode" style="width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(16,185,129,0.2);background:rgba(16,185,129,0.1);color:#10b981;cursor:pointer;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button id="twin-mode-act" title="Act Mode" style="width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:#64748b;cursor:pointer;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </button>
            </div>
        </div>

        <!-- Zone Info Panel -->
        <div id="twin-zone-info" style="position:absolute;bottom:24px;left:24px;z-index:50;pointer-events:auto;display:none;">
            <div style="background:rgba(10,15,20,0.9);backdrop-filter:blur(20px);padding:20px 28px;border:1px solid rgba(255,255,255,0.05);border-radius:20px;min-width:240px;">
                <div id="twin-zone-name" style="font-family:'Manrope',sans-serif;font-size:18px;font-weight:800;color:#fff;"></div>
                <div id="twin-zone-crop" style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#10b981;text-transform:uppercase;letter-spacing:0.2em;margin-top:4px;"></div>
                <div style="display:flex;gap:24px;margin-top:16px;">
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
    `;
    container.appendChild(hud);

    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
    `;
    container.appendChild(style);

    // ─── State ──────────────────────────────────────────────────
    let mode = 'view';
    let selectedZoneIdx = -1;
    const zoneModels = [];
    const allInteractives = [];

    // ─── Three.js ───────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.setClearColor(0x0a0f12);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0f12, 0.002);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
    camera.position.set(80, 70, 80);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.set(0, 0, 0);
    controls.minDistance = 20;
    controls.maxDistance = 400;

    // ─── Lighting ───────────────────────────────────────────────
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.7));
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(40, 60, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x8eb4d4, 0.4);
    fill.position.set(-20, 15, -10);
    scene.add(fill);

    // Ground
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(600, 600),
        new THREE.MeshStandardMaterial({ color: 0x1a2520, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid
    const grid = new THREE.GridHelper(300, 60, 0x10b981, 0x0a1510);
    grid.material.opacity = 0.12;
    grid.material.transparent = true;
    scene.add(grid);

    // ─── Raycaster ──────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    // ─── Get zone data ──────────────────────────────────────────
    function getZones() {
        const dashData = store.getState('currentFarmDashboard');
        if (dashData?.zones?.length > 0) return dashData.zones;
        return [
            { id: 'z1', name: 'Zone Alpha', crop_type: 'Tomato', moisture_pct: 65, temp_c: 28, ec_ds_m: 1.2 },
            { id: 'z2', name: 'Zone Beta',  crop_type: 'Wheat',  moisture_pct: 42, temp_c: 31, ec_ds_m: 0.8 },
            { id: 'z3', name: 'Zone Gamma', crop_type: 'Rice',   moisture_pct: 78, temp_c: 26, ec_ds_m: 1.5 },
            { id: 'z4', name: 'Zone Delta', crop_type: 'Cotton', moisture_pct: 35, temp_c: 33, ec_ds_m: 0.6 },
        ];
    }

    // ─── Zone label sprite ──────────────────────────────────────
    function createLabel(text, subtext) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 160;
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'rgba(10,15,18,0.85)';
        ctx.beginPath(); ctx.roundRect(0, 0, 512, 160, 20); ctx.fill();
        ctx.strokeStyle = 'rgba(16,185,129,0.3)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(0, 0, 512, 160, 20); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(text, 256, 65);
        ctx.fillStyle = '#10b981'; ctx.font = '600 28px sans-serif';
        ctx.fillText(subtext, 256, 115);
        const tex = new THREE.CanvasTexture(c);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(14, 4.4, 1);
        return sprite;
    }

    // ─── Load model ─────────────────────────────────────────────
    const loader = new GLTFLoader();
    console.log('[DigitalTwin] Loading:', MODEL_PATH);

    loader.load(
        MODEL_PATH,
        (gltf) => {
            console.log('[DigitalTwin] Model loaded OK');
            const zones = getZones();
            const sourceModel = gltf.scene;

            zones.forEach((zone, i) => {
                const pos = ZONE_GRID[i] || { x: i * 50, z: 0 };

                // Use deepCloneModel for zones 1+ (zone 0 uses the original)
                const model = i === 0 ? sourceModel : deepCloneModel(sourceModel);
                model.scale.setScalar(25);

                const group = new THREE.Group();
                group.position.set(pos.x, 0, pos.z);

                // Platform
                const platform = new THREE.Mesh(
                    new THREE.CylinderGeometry(22, 22, 0.3, 48),
                    new THREE.MeshStandardMaterial({
                        color: new THREE.Color().setHSL(0.38 + (i * 0.05), 0.4, 0.1),
                        roughness: 0.85, transparent: true, opacity: 0.5
                    })
                );
                platform.position.y = -0.15;
                platform.receiveShadow = true;
                group.add(platform);

                // Model
                model.position.set(0, 0, 0);
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        child.userData.zoneIndex = i;
                        allInteractives.push(child);
                    }
                });
                group.add(model);

                // Label
                const label = createLabel(zone.name, zone.crop_type || 'Crop');
                label.position.set(0, 30, 0);
                group.add(label);

                scene.add(group);
                zoneModels.push({ group, zone, label });
            });

            // Auto-frame camera
            if (zones.length > 1) {
                const d = Math.max(zones.length * 18, 80);
                camera.position.set(d * 0.7, d * 0.55, d * 0.7);
                controls.target.set(0, 5, 0);
            }

            // Hide loading
            const el = hud.querySelector('#twin-loading');
            if (el) {
                el.style.transition = 'opacity 0.8s';
                el.style.opacity = '0';
                setTimeout(() => el.style.display = 'none', 800);
            }
            showToast(`Digital Twin Active — ${zones.length} zone(s)`, 'success');
        },
        (progress) => {
            if (progress.total > 0) {
                const pct = Math.round((progress.loaded / progress.total) * 100);
                const p = hud.querySelector('#twin-loading-pct');
                const b = hud.querySelector('#twin-loading-bar');
                if (p) p.textContent = `${pct}%`;
                if (b) b.style.width = `${pct}%`;
            }
        },
        (err) => {
            console.error('[DigitalTwin] LOAD ERROR:', err);
            const el = hud.querySelector('#twin-loading');
            if (el) el.innerHTML = `
                <div style="background:rgba(10,15,20,0.9);padding:48px;border-radius:24px;border:1px solid rgba(239,68,68,0.2);text-align:center;">
                    <div style="font-size:20px;font-weight:800;color:#ef4444;margin-bottom:8px;">MODEL LOAD FAILED</div>
                    <div style="font-size:11px;color:#64748b;margin-bottom:24px;">${err.message}</div>
                    <button onclick="location.reload()" style="padding:12px 32px;background:#ef4444;color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer;">RETRY</button>
                </div>`;
        }
    );

    // ─── Render Loop ────────────────────────────────────────────
    const clock = new THREE.Clock();
    let animId = null;

    function animate() {
        animId = requestAnimationFrame(animate);
        const elapsed = clock.getElapsedTime();
        controls.update();

        // Hover glow
        for (const mesh of allInteractives) {
            if (!mesh.material?.emissive) continue;
            if (mesh.userData.zoneIndex === selectedZoneIdx) {
                mesh.material.emissive.setHex(0x10b981);
                mesh.material.emissiveIntensity = 0.3 + Math.sin(elapsed * 4) * 0.15;
            } else {
                mesh.material.emissive.setHex(0x000000);
                mesh.material.emissiveIntensity = 0;
            }
        }

        // Label bob
        zoneModels.forEach((zm, i) => {
            if (zm.label) zm.label.position.y = 30 + Math.sin(elapsed * 1.2 + i) * 0.4;
        });

        renderer.render(scene, camera);
    }

    // ─── Resize ─────────────────────────────────────────────────
    function onResize() {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    // ─── Interaction ────────────────────────────────────────────
    function onClick(e) {
        if (mode !== 'act') return;
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(allInteractives, false);
        const info = hud.querySelector('#twin-zone-info');

        if (hits.length > 0) {
            const zi = hits[0].object.userData.zoneIndex;
            selectedZoneIdx = zi;
            const zm = zoneModels[zi];
            if (zm && info) {
                info.style.display = 'block';
                hud.querySelector('#twin-zone-name').textContent = zm.zone.name;
                hud.querySelector('#twin-zone-crop').textContent = zm.zone.crop_type || '';
                hud.querySelector('#twin-zone-moisture').textContent = `${zm.zone.moisture_pct ?? '--'}%`;
                hud.querySelector('#twin-zone-temp').textContent = `${zm.zone.temp_c ?? '--'}°C`;
                hud.querySelector('#twin-zone-ec').textContent = `${zm.zone.ec_ds_m ?? '--'}`;
            }
        } else {
            selectedZoneIdx = -1;
            if (info) info.style.display = 'none';
        }
    }

    function onPointerMove(e) {
        if (mode !== 'act') return;
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(allInteractives, false);
        canvas.style.cursor = hits.length ? 'pointer' : 'grab';
    }

    // ─── Mode Toggle ────────────────────────────────────────────
    function setMode(m) {
        mode = m;
        const v = hud.querySelector('#twin-mode-view');
        const a = hud.querySelector('#twin-mode-act');
        if (v) { v.style.background = m === 'view' ? 'rgba(16,185,129,0.1)' : 'transparent'; v.style.color = m === 'view' ? '#10b981' : '#64748b'; v.style.border = m === 'view' ? '1px solid rgba(16,185,129,0.2)' : 'none'; }
        if (a) { a.style.background = m === 'act' ? 'rgba(16,185,129,0.1)' : 'transparent'; a.style.color = m === 'act' ? '#10b981' : '#64748b'; a.style.border = m === 'act' ? '1px solid rgba(16,185,129,0.2)' : 'none'; }
        if (m === 'view') { selectedZoneIdx = -1; const info = hud.querySelector('#twin-zone-info'); if (info) info.style.display = 'none'; }
    }

    // ─── Boot ───────────────────────────────────────────────────
    setTimeout(() => {
        onResize();
        animate();
        window.addEventListener('resize', onResize);
        canvas.addEventListener('click', onClick);
        canvas.addEventListener('pointermove', onPointerMove);
        hud.querySelector('#twin-mode-view')?.addEventListener('click', () => setMode('view'));
        hud.querySelector('#twin-mode-act')?.addEventListener('click', () => setMode('act'));
    }, 50);

    // ─── Cleanup ────────────────────────────────────────────────
    const observer = new MutationObserver(() => {
        if (!document.body.contains(container)) {
            if (animId) cancelAnimationFrame(animId);
            window.removeEventListener('resize', onResize);
            renderer.dispose(); controls.dispose(); observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return container;
}
