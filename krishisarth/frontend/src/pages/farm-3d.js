import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { showToast } from '../components/toast.js';
import { store } from '../state/store.js';

/**
 * KrishiSarth Digital Twin v10.0
 *
 * Key changes:
 * - Auto-scale: measure model bounding box, then scale to fill zone area
 * - No ground plane/platform hiding model parts
 * - Model lifted above y=0 so nothing clips below ground
 * - All materials forced visible + double-sided
 * - Lines converted to thick tubes
 */

const MODEL_PATH = './assets/model.glb';
const ZONE_SIZE = 60; // each zone occupies a 60x60 unit area

const ZONE_GRID = [
    { x:   0, z:   0 },
    { x:  70, z:   0 },
    { x: -70, z:   0 },
    { x:   0, z:  70 },
    { x:  70, z:  70 },
    { x: -70, z:  70 },
    { x:   0, z: -70 },
    { x:  70, z: -70 },
    { x: -70, z: -70 },
];

function fixModel(root) {
    const linesToConvert = [];

    root.traverse((node) => {
        node.frustumCulled = false;
        node.visible = true;

        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;

            const fix = (mat) => {
                mat.side = THREE.DoubleSide;
                mat.visible = true;
                mat.depthWrite = true;
                mat.depthTest = true;
                if (mat.opacity < 0.1) mat.opacity = 1.0;
                if (mat.transparent && mat.opacity < 0.5) mat.opacity = 0.85;
                if (mat.color) {
                    const hsl = {};
                    mat.color.getHSL(hsl);
                    if (hsl.l < 0.05) mat.color.setHSL(hsl.h, hsl.s, 0.15);
                }
                if (mat.metalness !== undefined && mat.metalness > 0.95) mat.metalness = 0.8;
                if (mat.roughness !== undefined && mat.roughness < 0.05) mat.roughness = 0.1;
                mat.needsUpdate = true;
            };

            if (Array.isArray(node.material)) {
                node.material = node.material.map(m => { const c = m.clone(); fix(c); return c; });
            } else if (node.material) {
                node.material = node.material.clone();
                fix(node.material);
            }
        }

        if (node.isLine || node.isLineSegments || node.isLineLoop) {
            linesToConvert.push(node);
        }
    });

    // Convert lines to tube meshes
    linesToConvert.forEach((lineObj) => {
        try {
            const pos = lineObj.geometry?.attributes?.position;
            if (!pos || pos.count < 2) return;

            const points = [];
            for (let i = 0; i < pos.count; i++) {
                points.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
            }

            let color = 0x888888;
            if (lineObj.material?.color) color = lineObj.material.color.getHex();

            const tubeMat = new THREE.MeshStandardMaterial({
                color, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide
            });

            if (lineObj.isLineSegments) {
                for (let i = 0; i < points.length - 1; i += 2) {
                    const dir = new THREE.Vector3().subVectors(points[i + 1], points[i]);
                    const len = dir.length();
                    if (len < 0.0001) continue;
                    const geo = new THREE.CylinderGeometry(0.015, 0.015, len, 6);
                    const tube = new THREE.Mesh(geo, tubeMat.clone());
                    const mid = new THREE.Vector3().addVectors(points[i], points[i + 1]).multiplyScalar(0.5);
                    tube.position.copy(mid);
                    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
                    tube.frustumCulled = false;
                    tube.castShadow = true;
                    if (lineObj.parent) lineObj.parent.add(tube);
                }
            } else if (points.length >= 2) {
                const curve = new THREE.CatmullRomCurve3(points, lineObj.isLineLoop);
                const geo = new THREE.TubeGeometry(curve, Math.max(points.length * 4, 20), 0.015, 6, lineObj.isLineLoop);
                const tube = new THREE.Mesh(geo, tubeMat);
                tube.frustumCulled = false;
                tube.castShadow = true;
                if (lineObj.parent) lineObj.parent.add(tube);
            }

            lineObj.visible = false;
        } catch (e) {
            console.warn('[DT] Line convert fail:', e);
        }
    });
}

function deepCloneModel(source) {
    const clone = source.clone(true);
    clone.traverse((node) => {
        if (node.geometry) node.geometry = node.geometry.clone();
        if (node.material) {
            node.material = Array.isArray(node.material)
                ? node.material.map(m => m.clone())
                : node.material.clone();
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

    const hud = document.createElement('div');
    hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:10;';
    hud.innerHTML = `
        <div id="twin-loading" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;background:#0a0f12;z-index:40;">
            <div style="position:relative;width:96px;height:96px;">
                <div style="position:absolute;inset:0;border:4px solid rgba(16,185,129,0.1);border-top-color:#10b981;border-radius:50%;animation:spin 1s linear infinite;"></div>
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
                </div>
            </div>
        </div>
    `;
    container.appendChild(hud);

    const style = document.createElement('style');
    style.textContent = `@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}`;
    container.appendChild(style);

    let mode = 'view', selectedZoneIdx = -1;
    const zoneModels = [], allInteractives = [];

    // Renderer with logarithmic depth buffer (must be in constructor)
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        logarithmicDepthBuffer: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;
    renderer.setClearColor(0x0a0f12);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0f12, 0.001);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 10000);
    camera.position.set(120, 100, 120);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.set(0, 5, 0);
    controls.minDistance = 5;
    controls.maxDistance = 800;

    // Strong multi-directional lighting
    scene.add(new THREE.HemisphereLight(0xddeeff, 0x444422, 1.2));
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(60, 100, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 600;
    sun.shadow.camera.left = -200;
    sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 200;
    sun.shadow.camera.bottom = -200;
    scene.add(sun);

    scene.add(new THREE.DirectionalLight(0x8eb4d4, 0.8).translateX(-40).translateY(30).translateZ(-20));
    scene.add(new THREE.DirectionalLight(0xffe8cc, 0.6).translateX(-20).translateY(40).translateZ(60));
    scene.add(new THREE.PointLight(0xffffff, 0.5, 400).translateY(50));

    // VERY low ground — won't clip any model parts
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000),
        new THREE.MeshStandardMaterial({ color: 0x111a16, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(500, 100, 0x10b981, 0x0a1510);
    grid.material.opacity = 0.08;
    grid.material.transparent = true;
    grid.position.y = -4.9;
    scene.add(grid);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function getZones() {
        const d = store.getState('currentFarmDashboard');
        if (d?.zones?.length > 0) return d.zones;
        return [
            { id: 'z1', name: 'Zone Alpha', crop_type: 'Tomato', moisture_pct: 65, temp_c: 28 },
            { id: 'z2', name: 'Zone Beta',  crop_type: 'Wheat',  moisture_pct: 42, temp_c: 31 },
            { id: 'z3', name: 'Zone Gamma', crop_type: 'Rice',   moisture_pct: 78, temp_c: 26 },
            { id: 'z4', name: 'Zone Delta', crop_type: 'Cotton', moisture_pct: 35, temp_c: 33 },
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
        sprite.scale.set(18, 5.6, 1);
        return sprite;
    }

    const loader = new GLTFLoader();
    console.log('[DT] Loading:', MODEL_PATH);

    loader.load(
        MODEL_PATH,
        (gltf) => {
            const zones = getZones();
            const sourceModel = gltf.scene;

            // Measure the RAW model bounding box before any scaling
            const rawBox = new THREE.Box3().setFromObject(sourceModel);
            const rawSize = rawBox.getSize(new THREE.Vector3());
            const rawCenter = rawBox.getCenter(new THREE.Vector3());
            console.log('[DT] Raw model size:', rawSize.x.toFixed(2), rawSize.y.toFixed(2), rawSize.z.toFixed(2));
            console.log('[DT] Raw model center:', rawCenter.x.toFixed(2), rawCenter.y.toFixed(2), rawCenter.z.toFixed(2));

            // Log all object types
            let meshes = 0, lines = 0;
            sourceModel.traverse(n => {
                if (n.isMesh) meshes++;
                if (n.isLine || n.isLineSegments) lines++;
            });
            console.log(`[DT] ${meshes} meshes, ${lines} lines`);

            // AUTO-SCALE: compute scale so the model's largest XZ dimension fills ZONE_SIZE
            const maxXZ = Math.max(rawSize.x, rawSize.z);
            const autoScale = maxXZ > 0 ? ZONE_SIZE / maxXZ : 50;
            console.log('[DT] Auto-scale factor:', autoScale.toFixed(2));

            // Fix source model visibility
            fixModel(sourceModel);

            zones.forEach((zone, i) => {
                const pos = ZONE_GRID[i] || { x: i * 70, z: 0 };
                const model = i === 0 ? sourceModel : deepCloneModel(sourceModel);
                if (i > 0) fixModel(model);

                // Apply auto-scale
                model.scale.setScalar(autoScale);

                // Center the model on its group and lift above ground
                model.position.set(
                    -rawCenter.x * autoScale,
                    -rawCenter.y * autoScale + 2,
                    -rawCenter.z * autoScale
                );

                const group = new THREE.Group();
                group.position.set(pos.x, 0, pos.z);
                group.add(model);

                // Label
                const labelHeight = rawSize.y * autoScale + 10;
                const label = createLabel(zone.name, zone.crop_type || 'Crop');
                label.position.set(0, labelHeight, 0);
                group.add(label);

                model.traverse((child) => {
                    if (child.isMesh) {
                        child.userData.zoneIndex = i;
                        allInteractives.push(child);
                    }
                });

                scene.add(group);
                zoneModels.push({ group, zone, label, labelHeight });
            });

            // Auto-frame camera to see everything
            const sceneBox = new THREE.Box3().setFromObject(scene);
            const sceneSize = sceneBox.getSize(new THREE.Vector3());
            const sceneCenter = sceneBox.getCenter(new THREE.Vector3());
            const maxDim = Math.max(sceneSize.x, sceneSize.z);
            camera.position.set(
                sceneCenter.x + maxDim * 0.6,
                sceneCenter.y + maxDim * 0.5,
                sceneCenter.z + maxDim * 0.6
            );
            controls.target.copy(sceneCenter);
            controls.update();

            const el = hud.querySelector('#twin-loading');
            if (el) { el.style.transition = 'opacity 0.8s'; el.style.opacity = '0'; setTimeout(() => el.style.display = 'none', 800); }
            showToast(`Digital Twin — ${zones.length} zones (scale: ${autoScale.toFixed(1)}x)`, 'success');
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
            console.error('[DT] ERROR:', err);
            const el = hud.querySelector('#twin-loading');
            if (el) el.innerHTML = `<div style="background:rgba(10,15,20,0.9);padding:48px;border-radius:24px;border:1px solid rgba(239,68,68,0.2);text-align:center;"><div style="font-size:20px;font-weight:800;color:#ef4444;margin-bottom:8px;">LOAD FAILED</div><div style="font-size:11px;color:#64748b;margin-bottom:24px;">${err.message}</div><button onclick="location.reload()" style="padding:12px 32px;background:#ef4444;color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer;">RETRY</button></div>`;
        }
    );

    const clock = new THREE.Clock();
    let animId = null;

    function animate() {
        animId = requestAnimationFrame(animate);
        const elapsed = clock.getElapsedTime();
        controls.update();
        for (const m of allInteractives) {
            if (!m.material?.emissive) continue;
            if (m.userData.zoneIndex === selectedZoneIdx) {
                m.material.emissive.setHex(0x10b981);
                m.material.emissiveIntensity = 0.3 + Math.sin(elapsed * 4) * 0.15;
            } else {
                m.material.emissive.setHex(0x000000);
                m.material.emissiveIntensity = 0;
            }
        }
        zoneModels.forEach((zm, i) => {
            if (zm.label) zm.label.position.y = zm.labelHeight + Math.sin(elapsed * 1.2 + i) * 0.5;
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
        if (v) { v.style.background = m === 'view' ? 'rgba(16,185,129,0.1)' : 'transparent'; v.style.color = m === 'view' ? '#10b981' : '#64748b'; }
        if (a) { a.style.background = m === 'act' ? 'rgba(16,185,129,0.1)' : 'transparent'; a.style.color = m === 'act' ? '#10b981' : '#64748b'; }
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
