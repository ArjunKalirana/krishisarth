import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { showToast } from '../components/toast.js';
import { store } from '../state/store.js';
import { startIrrigation, stopIrrigation, injectFertigation, setZoneMode } from '../api/control.js';

/**
 * KrishiSarth Digital Twin v12.0 — Real-Time Hardware Integration
 * - Retains base GLB models
 * - Dynamic moisture-based coloring (calculated on meshes)
 * - Animated 3D Floating Sprites (💧 and 🧪)
 * - ML Predictions & NPK integrated into 3D Panel
 * - Real-time WebSocket synchronization
 */

const MODEL_PATH = './assets/model.glb';
const ZONE_SIZE = 60;

const ZONE_GRID = [
    { x: 0, z: 0 }, { x: 70, z: 0 }, { x: -70, z: 0 }, { x: 0, z: 70 },
    { x: 70, z: 70 }, { x: -70, z: 70 }, { x: 0, z: -70 }, { x: 70, z: -70 }, { x: -70, z: -70 },
];

function fixModel(root) {
    root.traverse((node) => {
        node.frustumCulled = false;
        node.visible = true;
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            // Ensure material is reactive to emissive/color changes
            const fix = (mat) => {
                mat.side = THREE.DoubleSide;
                mat.transparent = true;
                mat.opacity = mat.opacity || 1.0;
                mat.needsUpdate = true;
            };
            if (Array.isArray(node.material)) node.material.forEach(fix);
            else if (node.material) fix(node.material);
        }
    });
}

function deepCloneModel(source) {
    const clone = source.clone(true);
    clone.traverse((node) => {
        if (node.geometry) node.geometry = node.geometry.clone();
        if (node.material) {
            node.material = Array.isArray(node.material) ? node.material.map(m => m.clone()) : node.material.clone();
        }
    });
    return clone;
}

/** Utility to create floating symbols in 3D space */
function createStatusSprite(symbol) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = '80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(10, 10, 1);
    return sprite;
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
                    Initializing Digital Twin... <span id="twin-loading-pct">0%</span>
                </div>
            </div>
        </div>

        <!-- Mode Toggle -->
        <div style="position:absolute;top:24px;left:24px;z-index:50;pointer-events:auto;">
            <div style="background:rgba(10,15,20,0.85);backdrop-filter:blur(20px);padding:8px;display:flex;flex-direction:column;gap:8px;border:1px solid rgba(255,255,255,0.05);border-radius:16px;">
                <button id="twin-mode-view" title="View Mode" style="width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(16,185,129,0.2);background:rgba(16,185,129,0.1);color:#10b981;cursor:pointer;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button id="twin-mode-act" title="Act Mode — Open Control Panels" style="width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:#64748b;cursor:pointer;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </button>
            </div>
            <div id="twin-mode-label" style="margin-top:8px;background:rgba(10,15,20,0.85);backdrop-filter:blur(20px);padding:8px 12px;border:1px solid rgba(255,255,255,0.05);border-radius:12px;font-family:'JetBrains Mono',monospace;font-size:9px;color:#10b981;text-transform:uppercase;letter-spacing:0.2em;text-align:center;">
                VIEW MODE
            </div>
        </div>

        <div id="twin-panel" style="position:absolute;top:24px;right:24px;width:100%;max-width:380px;z-index:100;border:1px solid rgba(255,255,255,0.05);border-radius:24px;background:rgba(10,15,20,0.95);backdrop-filter:blur(24px);transform:translateX(440px);transition:transform 0.5s cubic-bezier(0.16,1,0.3,1);pointer-events:auto;overflow:hidden;">
        </div>
    `;
    container.appendChild(hud);

    const style = document.createElement('style');
    style.textContent = `@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}`;
    container.appendChild(style);

    let mode = 'view', selectedZoneIdx = -1;
    const zoneModels = [], allInteractives = [];
    const zoneStates = {}; // Live telemetry mapping

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, logarithmicDepthBuffer: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.4;
        renderer.setClearColor(0x0a0f12);
    } catch (err) {
        console.error('[Digital Twin] WebGL Context Failed:', err);
        container.innerHTML = `
            <div style="width:100%;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0f12;color:#fff;padding:40px;text-align:center;font-family:'Inter',sans-serif;">
                <div style="width:80px;height:80px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:24px;display:flex;align-items:center;justify-content:center;margin-bottom:32px;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h2 style="font-size:24px;font-weight:900;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.1em;">3D Engine Unavailable</h2>
                <p style="color:#64748b;max-width:400px;line-height:1.6;font-size:13px;margin-bottom:32px;">
                    The Digital Twin requires hardware acceleration to render the volumetric farm model. 
                    Please enable WebGL in your browser settings or use a supported device.
                </p>
                <div style="display:flex;gap:16px;">
                    <a href="#dashboard" style="padding:16px 32px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;color:#fff;text-decoration:none;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;">Return to Dashboard</a>
                    <button onclick="location.reload()" style="padding:16px 32px;background:#10b981;border:none;border-radius:16px;color:#fff;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;cursor:pointer;">Retry Load</button>
                </div>
            </div>
        `;
        return container;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0f12, 0.001);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10000);
    camera.position.set(100, 80, 100);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.1;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(50, 100, 50);
    sun.castShadow = true;
    scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -5; ground.receiveShadow = true;
    scene.add(ground);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function getZones() {
        const d = store.getState('currentFarmDashboard');
        const s = store.getState('sensorData') || {};
        const zones = d?.zones || [];
        return zones.map(z => ({
            ...z,
            ...s[z.id]
        }));
    }

    function createLabel(text, subtext) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 160;
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'rgba(10,15,18,0.9)';
        ctx.beginPath(); ctx.roundRect(0, 0, 512, 160, 20); ctx.fill();
        ctx.strokeStyle = '#10b981'; ctx.lineWidth = 4; ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(text, 256, 65);
        ctx.fillStyle = '#10b981'; ctx.font = '600 28px sans-serif';
        ctx.fillText(subtext, 256, 115);
        const tex = new THREE.CanvasTexture(c);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(18, 5.6, 1);
        return sprite;
    }

    // ─── Real-Time Sync Logic ──────────────────────────────────
    document.addEventListener('hardware-update', (e) => {
        const zm = zoneModels.find(m => m.zone.id === e.detail.zone_id);
        if (zm) {
            const idx = zoneModels.indexOf(zm);
            zoneStates[idx] = {
                ...zoneStates[idx],
                ...e.detail
            };
            if (selectedZoneIdx === idx) showPanel(idx);
        }
    });

    async function showPanel(zoneIdx) {
        const panel = hud.querySelector('#twin-panel');
        if (!panel) return;
        const zm = zoneModels[zoneIdx];
        if (!zm) return;
        const st = zoneStates[zoneIdx] || {};
        const zone = { ...zm.zone, ...st };

        const irrigating = st.pump_status === 'on' || st.irrigating;
        const fertigating = st.fertigation_status === 'active' || st.fertigating;

        // Fetch ML Suggestion if not already cached or if we want to refresh
        let mlData = st.ml_crop_data || null;
        
        panel.innerHTML = `
            <div style="padding:28px;">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:24px;">
                    <div>
                        <div style="font-family:'Manrope',sans-serif;font-size:24px;font-weight:900;color:#fff;">${zone.name}</div>
                        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#10b981;text-transform:uppercase;letter-spacing:0.2em;margin-top:4px;">${zone.crop_type || 'Active Plot'} • LIVE TELEMETRY</div>
                    </div>
                    <button id="panel-close" style="padding:10px;border-radius:12px;background:rgba(255,255,255,0.05);border:none;color:#64748b;cursor:pointer;">✕</button>
                </div>

                <div style="grid: 1fr / 1fr 1fr; display:grid; gap:12px; margin-bottom:20px;">
                    <div style="padding:16px;background:rgba(255,255,255,0.03);border-radius:16px;text-align:center;">
                        <span style="display:block;font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;margin-bottom:6px;">Moisture</span>
                        <span style="font-size:24px;font-weight:900;color:${zone.moisture_pct < 30 ? '#f87171' : '#fff'};">${Math.round(zone.moisture_pct || 0)}%</span>
                    </div>
                    <div style="padding:16px;background:rgba(255,255,255,0.03);border-radius:16px;text-align:center;">
                        <span style="display:block;font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;margin-bottom:6px;">ML Soil</span>
                        <span style="font-size:14px;font-weight:900;color:#10b981;">${st.ml_fertility?.label || 'Fertile'}</span>
                    </div>
                </div>

                <div id="ml-suggestion-box" style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.1);padding:20px;border-radius:16px;margin-bottom:20px;">
                    <div style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;">ML Crop Suggestion</div>
                    <div id="ml-suggestion-content" style="font-size:18px;font-weight:900;color:#fff;">
                        ${mlData ? `
                            <div style="margin-bottom:8px;">🌿 ${mlData.prediction}</div>
                            <div style="font-size:10px;font-weight:500;color:#94a3b8;font-style:italic;line-height:1.4;">"${mlData.rationale}"</div>
                        ` : `
                            <div style="display:flex;align-items:center;gap:10px;opacity:0.5;animation:pulse 1.5s infinite;">
                                <div style="width:12px;height:12px;border:2px solid #10b981;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
                                <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;">Querying Neural Hub...</span>
                            </div>
                        `}
                    </div>
                </div>

                <div style="margin-bottom:24px;">
                   <div style="display:flex;justify-content:space-between;font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;margin-bottom:10px;">
                        <span>Nutrient Shard (NPK)</span>
                        <span style="color:#ffffff;">${st.N || 0}-${st.P || 0}-${st.K || 0}</span>
                   </div>
                   <div style="display:flex;gap:4px;height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;">
                        <div style="width:${Math.min((st.N||0)/1.5, 100)}%;background:#3b82f6;"></div>
                        <div style="width:${Math.min((st.P||0)/0.8, 100)}%;background:#a855f7;"></div>
                        <div style="width:${Math.min((st.K||0)/2.5, 100)}%;background:#f59e0b;"></div>
                   </div>
                </div>

                <div style="display:flex;flex-direction:column;gap:10px;">
                    ${mode === 'act' ? `
                        <button id="btn-irrigate" style="width:100%;padding:16px;border-radius:14px;border:none;cursor:pointer;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.3s;
                            background:${irrigating ? 'rgba(59,130,246,0.15)' : 'linear-gradient(135deg,#3b82f6,#2563eb)'};
                            color:${irrigating ? '#60a5fa' : '#fff'};">
                            💧 ${irrigating ? 'PUMP ACTIVE' : 'START WATERING'}
                        </button>
                        <button id="btn-stop" style="width:100%;padding:16px;border-radius:14px;border:none;cursor:pointer;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;
                            background:${(irrigating || fertigating) ? '#ef4444' : 'rgba(255,255,255,0.05)'};
                            color:${(irrigating || fertigating) ? '#fff' : '#64748b'};">
                            🛑 STOP OPERATION
                        </button>
                    ` : `
                        <div style="padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:14px;text-align:center;">
                            <span style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="display:inline;margin-right:4px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> 
                                Switch to ACT MODE to control
                            </span>
                        </div>
                    `}
                </div>
            </div>
        `;

        panel.style.transform = 'translateX(0)';
        panel.querySelector('#panel-close').onclick = () => hidePanel();
        
        const irrBtn = panel.querySelector('#btn-irrigate');
        if (irrBtn) {
            irrBtn.onclick = async () => {
                try { 
                    await startIrrigation(zone.id, 15);
                    zoneStates[zoneIdx].irrigating = true;
                    showPanel(zoneIdx);
                    showToast(`Actuator Authorized: Starting irrigation on ${zone.name}`, 'success');
                } catch(e) { showToast(e.message, 'error'); }
            };
        }

        const stopBtn = panel.querySelector('#btn-stop');
        if (stopBtn) {
            stopBtn.onclick = async () => {
                try { 
                    await stopIrrigation(zone.id);
                    zoneStates[zoneIdx].irrigating = false;
                    zoneStates[zoneIdx].fertigating = false;
                    showPanel(zoneIdx);
                    showToast(`Sequence Secured: Flow terminated on ${zone.name}`, 'info');
                } catch(e) { showToast(e.message, 'error'); }
            };
        }

        // Trigger ML Fetch if missing
        if (!mlData) {
            try {
                const { api } = await import('../api/client.js');
                const res = await api(`/zones/${zone.id}/crop-suggestion`, { timeout: 120000 });
                if (res?.success) {
                    zoneStates[zoneIdx].ml_crop_data = res.data;
                    const content = panel.querySelector('#ml-suggestion-content');
                    if (content) {
                        content.innerHTML = `
                            <div style="margin-bottom:8px;">🌿 ${res.data.prediction}</div>
                            <div style="font-size:10px;font-weight:500;color:#94a3b8;font-style:italic;line-height:1.4;">"${res.data.rationale}"</div>
                        `;
                    }
                }
            } catch (err) {
                const content = panel.querySelector('#ml-suggestion-content');
                if (content) content.innerHTML = `<span style="font-size:10px;color:#f87171;text-transform:uppercase;">Neural Core Offline</span>`;
            }
        }
    }

    function hidePanel() {
        const panel = hud.querySelector('#twin-panel');
        if (panel) panel.style.transform = 'translateX(440px)';
        selectedZoneIdx = -1;
    }

    // ─── Load Models ───────────────────────────────────────────
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(MODEL_PATH, (gltf) => {
        const zones = getZones();
        const mainModel = gltf.scene;
        fixModel(mainModel);
        
        const center = new THREE.Box3().setFromObject(mainModel).getCenter(new THREE.Vector3());

        zones.forEach((z, i) => {
            const group = new THREE.Group();
            const pos = ZONE_GRID[i] || { x: i * 80, z: 0 };
            group.position.set(pos.x, 0, pos.z);

            const m = i === 0 ? mainModel : deepCloneModel(mainModel);
            m.position.sub(center);
            m.scale.setScalar(40); // Auto-scale to visible size
            group.add(m);

            const label = createLabel(z.name, z.crop_type || 'Crop Pending');
            label.position.set(0, 45, 0);
            group.add(label);

            const droplet = createStatusSprite('💧');
            droplet.position.set(-8, 55, 5);
            droplet.visible = false;
            group.add(droplet);

            const vial = createStatusSprite('🧪');
            vial.position.set(8, 55, 5);
            vial.visible = false;
            group.add(vial);

            m.traverse(node => { 
                if (node.isMesh) { 
                    node.userData.zoneIdx = i; 
                    allInteractives.push(node); 
                }
            });

            zoneStates[i] = { ...z, irrigating: false, fertigating: false };
            zoneModels.push({ group, zone: z, droplet, vial, model: m });
            scene.add(group);
        });

        hud.querySelector('#twin-loading').style.display = 'none';
        onResize();
    }, (p) => {
        const pct = Math.round((p.loaded / p.total) * 100);
        hud.querySelector('#twin-loading-pct').textContent = `${pct}%`;
    });

    // ─── Render Loop ────────────────────────────────────────────
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        controls.update();

        zoneModels.forEach((zm, i) => {
            const st = zoneStates[i];
            const moisture = st.moisture_pct || 0;
            
            // 1. Color mapping based on moisture
            // Blue for wet (>70), Green for optimal (40-70), Orange for dry (<30)
            const color = new THREE.Color();
            if (moisture > 75) color.setHex(0x3b82f6);
            else if (moisture > 40) color.setHex(0x10b981);
            else color.setHex(0xf59e0b);

            zm.model.traverse(node => {
                if (node.isMesh && node.material) {
                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                    materials.forEach(m => {
                        m.emissive = color;
                        // Blink if selected or irrigating
                        const blink = (st.pump_status === 'on' || i === selectedZoneIdx);
                        m.emissiveIntensity = blink ? (0.2 + Math.sin(t * 5) * 0.1) : 0.05;
                    });
                }
            });

            // 2. Animate icons
            zm.droplet.visible = (st.pump_status === 'on' || st.irrigating);
            zm.vial.visible = (st.fertigation_status === 'active' || st.fertigating);
            if (zm.droplet.visible) zm.droplet.position.y = 55 + Math.sin(t * 4) * 2;
            if (zm.vial.visible) zm.vial.position.y = 55 + Math.cos(t * 4) * 2;
        });

        renderer.render(scene, camera);
    }
    animate();

    function onResize() {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener('resize', onResize);

    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(allInteractives);
        if (hits.length > 0) {
            const idx = hits[0].object.userData.zoneIdx;
            selectedZoneIdx = idx;
            showPanel(idx);
        } else if (mode === 'act') {
            hidePanel();
        }
    });

    hud.querySelector('#twin-mode-view').onclick = () => { mode = 'view'; hidePanel(); updateModes(); };
    hud.querySelector('#twin-mode-act').onclick = () => { mode = 'act'; updateModes(); };

    function updateModes() {
        const v = hud.querySelector('#twin-mode-view'), a = hud.querySelector('#twin-mode-act');
        v.style.background = mode === 'view' ? 'rgba(16,185,129,0.1)' : 'transparent';
        a.style.background = mode === 'act' ? 'rgba(16,185,129,0.1)' : 'transparent';
        hud.querySelector('#twin-mode-label').textContent = mode === 'view' ? 'VIEW MODE' : 'ACT MODE — Click zones';
    }

    return container;
}
