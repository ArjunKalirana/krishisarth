import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { showToast } from '../components/toast.js';
import { store } from '../state/store.js';

/**
 * KrishiSarth Digital Twin v9.0 — Pipe Visibility Fix
 *
 * Comprehensive fixes for invisible pipes:
 * 1. frustumCulled = false on ALL objects (scaled objects get wrongly culled)
 * 2. DoubleSide on ALL materials (thin pipes need both faces)
 * 3. Lines/LineSegments converted to visible TubeGeometry meshes
 * 4. All transparent materials forced opaque
 * 5. All materials forced visible
 * 6. depthWrite/depthTest normalized
 * 7. Increased scene lighting to ensure dark materials show
 */

const MODEL_PATH = './assets/model.glb';

const ZONE_GRID = [
    { x:   0, z:   0 },
    { x:  60, z:   0 },
    { x: -60, z:   0 },
    { x:   0, z:  60 },
    { x:  60, z:  60 },
    { x: -60, z:  60 },
    { x:   0, z: -60 },
    { x:  60, z: -60 },
    { x: -60, z: -60 },
];

/**
 * Fix ALL renderable objects in a model to maximize visibility.
 * This is the nuclear option — it forces everything to show.
 */
function fixModelVisibility(root) {
    const linesToReplace = [];

    root.traverse((node) => {
        // ── Fix: Frustum culling incorrectly hides scaled objects ──
        node.frustumCulled = false;

        // ── Fix: Force visibility ──
        node.visible = true;

        // ── Fix Meshes ──
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;

            const fixMaterial = (mat) => {
                // Force double-sided (thin pipes need both faces visible)
                mat.side = THREE.DoubleSide;

                // Force visible
                mat.visible = true;

                // If material is fully transparent, make it opaque
                if (mat.opacity < 0.1) mat.opacity = 1.0;
                if (mat.transparent && mat.opacity < 0.5) {
                    mat.opacity = 0.85;
                }

                // Ensure depth works correctly
                mat.depthWrite = true;
                mat.depthTest = true;

                // Boost very dark materials so they're visible against dark bg
                if (mat.color) {
                    const hsl = {};
                    mat.color.getHSL(hsl);
                    if (hsl.l < 0.05) {
                        // Near-black material — lighten slightly
                        mat.color.setHSL(hsl.h, hsl.s, 0.15);
                    }
                }

                // Ensure metalness/roughness are sane
                if (mat.metalness !== undefined && mat.metalness > 0.98) {
                    mat.metalness = 0.8;
                }
                if (mat.roughness !== undefined && mat.roughness < 0.02) {
                    mat.roughness = 0.1;
                }

                mat.needsUpdate = true;
            };

            if (Array.isArray(node.material)) {
                node.material = node.material.map(m => { const c = m.clone(); fixMaterial(c); return c; });
            } else if (node.material) {
                node.material = node.material.clone();
                fixMaterial(node.material);
            }
        }

        // ── Fix Lines → convert to visible tube meshes ──
        // WebGL line rendering is 1px wide and nearly invisible at distance
        if (node.isLine || node.isLineSegments || node.isLineLoop) {
            linesToReplace.push(node);
        }
    });

    // Replace Line objects with thick tube meshes
    linesToReplace.forEach((lineObj) => {
        try {
            const positions = lineObj.geometry?.attributes?.position;
            if (!positions || positions.count < 2) return;

            // Extract points from the line geometry
            const points = [];
            for (let i = 0; i < positions.count; i++) {
                points.push(new THREE.Vector3(
                    positions.getX(i),
                    positions.getY(i),
                    positions.getZ(i)
                ));
            }

            // Determine the color from the line material
            let color = 0x888888;
            if (lineObj.material?.color) {
                color = lineObj.material.color.getHex();
            }

            if (lineObj.isLineSegments) {
                // LineSegments: pairs of points form separate segments
                for (let i = 0; i < points.length - 1; i += 2) {
                    const dir = new THREE.Vector3().subVectors(points[i + 1], points[i]);
                    const len = dir.length();
                    if (len < 0.001) continue;

                    const tubeGeo = new THREE.CylinderGeometry(0.02, 0.02, len, 6);
                    const tubeMat = new THREE.MeshStandardMaterial({
                        color, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide
                    });
                    const tube = new THREE.Mesh(tubeGeo, tubeMat);

                    // Position at midpoint
                    const mid = new THREE.Vector3().addVectors(points[i], points[i + 1]).multiplyScalar(0.5);
                    tube.position.copy(mid);

                    // Align cylinder to segment direction
                    const axis = new THREE.Vector3(0, 1, 0);
                    const quat = new THREE.Quaternion().setFromUnitVectors(axis, dir.normalize());
                    tube.setRotationFromQuaternion(quat);

                    tube.frustumCulled = false;
                    tube.castShadow = true;

                    if (lineObj.parent) {
                        lineObj.parent.add(tube);
                    }
                }
            } else {
                // Line / LineLoop: connected strip of points
                if (points.length >= 2) {
                    const curve = new THREE.CatmullRomCurve3(points, lineObj.isLineLoop);
                    const tubeGeo = new THREE.TubeGeometry(curve, Math.max(points.length * 4, 20), 0.02, 6, lineObj.isLineLoop);
                    const tubeMat = new THREE.MeshStandardMaterial({
                        color, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide
                    });
                    const tube = new THREE.Mesh(tubeGeo, tubeMat);
                    tube.frustumCulled = false;
                    tube.castShadow = true;

                    if (lineObj.parent) {
                        lineObj.parent.add(tube);
                    }
                }
            }

            // Hide the original line (don't remove — preserve hierarchy)
            lineObj.visible = false;
        } catch (e) {
            console.warn('[DigitalTwin] Could not convert line to tube:', e);
        }
    });
}

/** Deep-clone with geometry+material for all renderable types */
function deepCloneModel(source) {
    const clone = source.clone(true);
    clone.traverse((node) => {
        if (node.geometry) node.geometry = node.geometry.clone();
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
    const container = document.createElement('div');
    container.id = 'farm3d-root';
    container.style.cssText = 'position:relative;width:100%;height:100vh;background:#0a0f12;overflow:hidden;';

    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    // HUD
    const hud = document.createElement('div');
    hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:10;';
    hud.innerHTML = `
        <div id="twin-loading" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;background:#0a0f12;z-index:40;">
            <div style="position:relative;width:96px;height:96px;">
                <div style="position:absolute;inset:0;border:4px solid rgba(16,185,129,0.1);border-top-color:#10b981;border-radius:50%;animation:spin 1s linear infinite;"></div>
                <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
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

        <div id="twin-zone-info" style="position:absolute;bottom:24px;left:24px;z-index:50;pointer-events:auto;display:none;">
            <div style="background:rgba(10,15,20,0.9);backdrop-filter:blur(20px);padding:20px 28px;border:1px solid rgba(255,255,255,0.05);border-radius:20px;min-width:240px;">
                <div id="twin-zone-name" style="font-family:'Manrope',sans-serif;font-size:18px;font-weight:800;color:#fff;"></div>
                <div id="twin-zone-crop" style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#10b981;text-transform:uppercase;letter-spacing:0.2em;margin-top:4px;"></div>
                <div style="display:flex;gap:24px;margin-top:16px;">
                    <div><div style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Moisture</div><div id="twin-zone-moisture" style="font-family:'Manrope',sans-serif;font-size:24px;font-weight:800;color:#fff;">--%</div></div>
                    <div><div style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Temp</div><div id="twin-zone-temp" style="font-family:'Manrope',sans-serif;font-size:24px;font-weight:800;color:#fff;">--°C</div></div>
                    <div><div style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">EC</div><div id="twin-zone-ec" style="font-family:'Manrope',sans-serif;font-size:24px;font-weight:800;color:#fff;">--</div></div>
                </div>
            </div>
        </div>
    `;
    container.appendChild(hud);

    const style = document.createElement('style');
    style.textContent = `@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}`;
    container.appendChild(style);

    let mode = 'view';
    let selectedZoneIdx = -1;
    const zoneModels = [];
    const allInteractives = [];

    // ─── Renderer ───────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;
    renderer.setClearColor(0x0a0f12);
    // Allow logarithmic depth buffer for objects at vastly different scales
    renderer.logarithmicDepthBuffer = true;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0f12, 0.0015);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 5000);
    camera.position.set(100, 80, 100);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.set(0, 5, 0);
    controls.minDistance = 10;
    controls.maxDistance = 500;

    // ─── Strong Lighting (pipes need light to show) ─────────────
    scene.add(new THREE.HemisphereLight(0xddeeff, 0x444422, 1.0));
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(50, 80, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -150;
    sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150;
    sun.shadow.camera.bottom = -150;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x8eb4d4, 0.6);
    fill.position.set(-30, 20, -20);
    scene.add(fill);

    const back = new THREE.DirectionalLight(0xffe8cc, 0.4);
    back.position.set(-10, 30, 50);
    scene.add(back);

    // Ground
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(800, 800),
        new THREE.MeshStandardMaterial({ color: 0x1a2520, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(400, 80, 0x10b981, 0x0a1510);
    grid.material.opacity = 0.1;
    grid.material.transparent = true;
    scene.add(grid);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function getZones() {
        const d = store.getState('currentFarmDashboard');
        if (d?.zones?.length > 0) return d.zones;
        return [
            { id: 'z1', name: 'Zone Alpha', crop_type: 'Tomato', moisture_pct: 65, temp_c: 28, ec_ds_m: 1.2 },
            { id: 'z2', name: 'Zone Beta',  crop_type: 'Wheat',  moisture_pct: 42, temp_c: 31, ec_ds_m: 0.8 },
            { id: 'z3', name: 'Zone Gamma', crop_type: 'Rice',   moisture_pct: 78, temp_c: 26, ec_ds_m: 1.5 },
            { id: 'z4', name: 'Zone Delta', crop_type: 'Cotton', moisture_pct: 35, temp_c: 33, ec_ds_m: 0.6 },
        ];
    }

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
        sprite.scale.set(16, 5, 1);
        return sprite;
    }

    // ─── Load ───────────────────────────────────────────────────
    const loader = new GLTFLoader();
    console.log('[DigitalTwin] Loading:', MODEL_PATH);

    loader.load(
        MODEL_PATH,
        (gltf) => {
            const zones = getZones();
            const sourceModel = gltf.scene;

            // Log every object type in the model for debugging
            let meshCount = 0, lineCount = 0, otherCount = 0;
            sourceModel.traverse((n) => {
                if (n.isMesh) meshCount++;
                else if (n.isLine || n.isLineSegments || n.isLineLoop) lineCount++;
                else if (n.type !== 'Group' && n.type !== 'Object3D' && n.type !== 'Scene') otherCount++;
            });
            console.log(`[DigitalTwin] Model contents: ${meshCount} meshes, ${lineCount} lines, ${otherCount} other`);

            // Fix the source model first
            fixModelVisibility(sourceModel);

            zones.forEach((zone, i) => {
                const pos = ZONE_GRID[i] || { x: i * 60, z: 0 };
                const model = i === 0 ? sourceModel : deepCloneModel(sourceModel);

                // Fix visibility on clones too
                if (i > 0) fixModelVisibility(model);

                model.scale.setScalar(35);

                const group = new THREE.Group();
                group.position.set(pos.x, 0, pos.z);

                // Platform
                const platform = new THREE.Mesh(
                    new THREE.CylinderGeometry(28, 28, 0.3, 48),
                    new THREE.MeshStandardMaterial({
                        color: new THREE.Color().setHSL(0.38 + i * 0.05, 0.4, 0.1),
                        roughness: 0.85, transparent: true, opacity: 0.4
                    })
                );
                platform.position.y = -0.15;
                platform.receiveShadow = true;
                group.add(platform);

                model.position.set(0, 0, 0);
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.userData.zoneIndex = i;
                        allInteractives.push(child);
                    }
                });
                group.add(model);

                const label = createLabel(zone.name, zone.crop_type || 'Crop');
                label.position.set(0, 40, 0);
                group.add(label);

                scene.add(group);
                zoneModels.push({ group, zone, label });
            });

            // Auto-frame
            const d = Math.max(zones.length * 22, 100);
            camera.position.set(d * 0.75, d * 0.6, d * 0.75);
            controls.target.set(0, 5, 0);

            const el = hud.querySelector('#twin-loading');
            if (el) { el.style.transition = 'opacity 0.8s'; el.style.opacity = '0'; setTimeout(() => el.style.display = 'none', 800); }
            showToast(`Digital Twin — ${zones.length} zones, ${meshCount} meshes, ${lineCount} pipes`, 'success');
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
            console.error('[DigitalTwin] ERROR:', err);
            const el = hud.querySelector('#twin-loading');
            if (el) el.innerHTML = `<div style="background:rgba(10,15,20,0.9);padding:48px;border-radius:24px;border:1px solid rgba(239,68,68,0.2);text-align:center;"><div style="font-size:20px;font-weight:800;color:#ef4444;margin-bottom:8px;">MODEL LOAD FAILED</div><div style="font-size:11px;color:#64748b;margin-bottom:24px;">${err.message}</div><button onclick="location.reload()" style="padding:12px 32px;background:#ef4444;color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer;">RETRY</button></div>`;
        }
    );

    // ─── Render Loop ────────────────────────────────────────────
    const clock = new THREE.Clock();
    let animId = null;

    function animate() {
        animId = requestAnimationFrame(animate);
        const elapsed = clock.getElapsedTime();
        controls.update();

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

        zoneModels.forEach((zm, i) => {
            if (zm.label) zm.label.position.y = 40 + Math.sin(elapsed * 1.2 + i) * 0.4;
        });

        renderer.render(scene, camera);
    }

    function onResize() {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

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
        canvas.style.cursor = raycaster.intersectObjects(allInteractives, false).length ? 'pointer' : 'grab';
    }

    function setMode(m) {
        mode = m;
        const v = hud.querySelector('#twin-mode-view'), a = hud.querySelector('#twin-mode-act');
        if (v) { v.style.background = m === 'view' ? 'rgba(16,185,129,0.1)' : 'transparent'; v.style.color = m === 'view' ? '#10b981' : '#64748b'; v.style.border = m === 'view' ? '1px solid rgba(16,185,129,0.2)' : 'none'; }
        if (a) { a.style.background = m === 'act' ? 'rgba(16,185,129,0.1)' : 'transparent'; a.style.color = m === 'act' ? '#10b981' : '#64748b'; a.style.border = m === 'act' ? '1px solid rgba(16,185,129,0.2)' : 'none'; }
        if (m === 'view') { selectedZoneIdx = -1; const info = hud.querySelector('#twin-zone-info'); if (info) info.style.display = 'none'; }
    }

    setTimeout(() => {
        onResize();
        animate();
        window.addEventListener('resize', onResize);
        canvas.addEventListener('click', onClick);
        canvas.addEventListener('pointermove', onPointerMove);
        hud.querySelector('#twin-mode-view')?.addEventListener('click', () => setMode('view'));
        hud.querySelector('#twin-mode-act')?.addEventListener('click', () => setMode('act'));
    }, 50);

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
