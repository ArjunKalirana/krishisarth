import { t }     from '../utils/i18n.js';
import { store } from '../state/store.js';
import { api }   from '../api/client.js';
import { startIrrigation, stopIrrigation, injectFertigation } from '../api/control.js';
import { showToast } from '../components/toast.js';

export function renderFarm3D() {
    const container = document.createElement('div');
    container.className = 'space-y-6 animate-in fade-in duration-500';

    container.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-wrap">
            <div>
                <h1 class="text-3xl font-extrabold text-gray-900">
                    ${t('farm3d_title')} <span class="brand-text">🌾</span>
                </h1>
                <p class="text-gray-500 font-medium mt-1">${t('farm3d_subtitle')}</p>
            </div>

            <!-- Legend + Simulate button -->
            <div class="flex gap-4 items-center flex-wrap">
                <div class="flex gap-3 text-xs font-bold flex-wrap">
                    <span class="flex items-center gap-1">
                        <div class="w-3 h-3 rounded-sm" style="background:#ef4444"></div> DRY
                    </span>
                    <span class="flex items-center gap-1">
                        <div class="w-3 h-3 rounded-sm" style="background:#22c55e"></div> OPTIMAL
                    </span>
                    <span class="flex items-center gap-1">
                        <div class="w-3 h-3 rounded-sm" style="background:#3b82f6"></div> WET
                    </span>
                    <span class="flex items-center gap-1">
                        <div class="w-3 h-3 rounded-sm animate-pulse" style="background:#1a7a4a"></div> IRRIGATING
                    </span>
                </div>
                <button id="simulate-btn" style="
                    background: linear-gradient(135deg, #1a7a4a, #2ECC71);
                    color: white; border: none; cursor: pointer;
                    padding: 10px 20px; border-radius: 12px;
                    font-size: 12px; font-weight: 800;
                    letter-spacing: 0.05em; text-transform: uppercase;
                    box-shadow: 0 4px 14px rgba(26,122,74,0.3);
                    transition: transform 0.15s, box-shadow 0.15s;
                ">⚡ DEMO SIMULATION</button>
            </div>
        </div>

        <!-- 3D Canvas -->
        <div class="ks-card overflow-hidden" style="height:540px; position:relative;">
            <canvas id="farm3d-canvas" style="width:100%; height:100%; display:block;"></canvas>

            <!-- Controls overlay -->
            <div style="position:absolute; top:12px; left:50%; transform:translateX(-50%);
                        background:rgba(0,0,0,0.5); color:white; padding:6px 16px;
                        border-radius:99px; font-size:11px; font-weight:700;
                        pointer-events:none; white-space:nowrap;">
                🖱 Drag to rotate &nbsp;•&nbsp; Scroll to zoom &nbsp;•&nbsp; Click zone for details
            </div>

            <!-- Simulation status banner -->
            <div id="sim-banner" style="
                position:absolute; top:12px; right:12px; display:none;
                background:rgba(26,122,74,0.9); color:white;
                padding:8px 16px; border-radius:10px; font-size:11px;
                font-weight:800; text-transform:uppercase; letter-spacing:0.05em;
            "></div>

            <!-- Zone tooltip -->
            <div id="farm3d-tooltip" style="
                position:absolute; display:none;
                background:rgba(0,0,0,0.88); color:white;
                padding:12px 16px; border-radius:12px;
                font-size:12px; font-weight:600; pointer-events:none;
                min-width:180px; line-height:1.9; z-index:10;
            "></div>

            <!-- Loading -->
            <div id="farm3d-loading" style="
                position:absolute; inset:0; display:flex; align-items:center;
                justify-content:center; background:#f0f7f3;
                flex-direction:column; gap:12px; z-index:20;
            ">
                <div style="width:40px;height:40px;border:4px solid #dcfce7;
                            border-top-color:#1a7a4a;border-radius:50%;
                            animation:spin3d 0.8s linear infinite;"></div>
                <p style="font-size:12px;color:#6b7280;font-weight:700;">
                    Building 3D farm...
                </p>
            </div>
        </div>

        <!-- Zone info cards -->
        <div id="zone-info-grid"
             class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        </div>

        <style>
            @keyframes spin3d { to { transform: rotate(360deg); } }
            #simulate-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 20px rgba(26,122,74,0.4);
            }
            #simulate-btn:active { transform: scale(0.97); }
        </style>
    `;

    setTimeout(() => _init3D(container), 80);
    return container;
}

// ── State ─────────────────────────────────────────────────────────────────────
let _scene, _meshes = [], _particles = [], _animId, _renderer, _zones = [];
let _simRunning = false;

// ── Main init ─────────────────────────────────────────────────────────────────
async function _init3D(container) {
    const farm      = store.getState('currentFarm');
    const loadingEl = container.querySelector('#farm3d-loading');
    const infoGrid  = container.querySelector('#zone-info-grid');
    const simBtn    = container.querySelector('#simulate-btn');

    if (!farm?.id) {
        loadingEl.innerHTML = `<p style="color:#6b7280;font-weight:700;">No farm selected</p>`;
        return;
    }

    // Fetch zone data
    try {
        const dashRes = await api(`/farms/${farm.id}/dashboard`);
        _zones = dashRes?.data?.zones || [];
    } catch {
        try {
            const farmRes = await api(`/farms/${farm.id}/`);
            _zones = (farmRes?.data?.zones || []).map(z => ({
                ...z, moisture_pct: 0, moisture_status: 'ok', pump_running: false
            }));
        } catch {
            loadingEl.innerHTML = `<p style="color:#6b7280;font-weight:700;">Failed to load zones</p>`;
            return;
        }
    }

    if (_zones.length === 0) {
        loadingEl.innerHTML = `<p style="color:#6b7280;font-weight:700;">No zones found</p>`;
        return;
    }

    await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    const canvas = container.querySelector('#farm3d-canvas');
    if (!canvas || !window.THREE) return;
    loadingEl.style.display = 'none';

    const THREE = window.THREE;
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 540;

    // Scene
    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0xf0f7f3);
    _scene.fog = new THREE.Fog(0xf0f7f3, 40, 80);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    camera.position.set(0, 20, 26);
    camera.lookAt(0, 0, 0);

    _renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    _renderer.setSize(w, h);
    _renderer.shadowMap.enabled = true;

    // Lighting
    _scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sun = new THREE.DirectionalLight(0xfff8e1, 1.3);
    sun.position.set(12, 22, 10);
    sun.castShadow = true;
    _scene.add(sun);
    _scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a7d44, 0.4));

    // Ground
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(50, 50),
        new THREE.MeshLambertMaterial({ color: 0xb8d4a8 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    _scene.add(ground);
    _scene.add(new THREE.GridHelper(50, 25, 0x9e9e9e, 0xdddddd));

    // Fence posts
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0x7d5a3c });
    for (let i = -20; i <= 20; i += 5) {
        [[-22, i], [22, i], [i, -22], [i, 22]].forEach(([x, z]) => {
            const post = new THREE.Mesh(
                new THREE.CylinderGeometry(0.15, 0.15, 1.2, 6), fenceMat
            );
            post.position.set(x, 0.6, z);
            _scene.add(post);
        });
    }

    // Zone meshes
    _meshes = [];
    _particles = [];
    const cols   = Math.ceil(Math.sqrt(_zones.length));
    const sp     = 8;
    const offset = (cols - 1) * sp / 2;

    _zones.forEach((zone, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x   = col * sp - offset;
        const z   = row * sp - offset;
        const m   = zone.moisture_pct || 0;
        const h_  = Math.max(0.3, (m / 100) * 3.5 + 0.25);

        // Soil base
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(6.5, 0.3, 6.5),
            new THREE.MeshLambertMaterial({ color: 0x6b4c2a })
        );
        base.position.set(x, 0.15, z);
        base.receiveShadow = true;
        _scene.add(base);

        // Crop block
        const color   = _zoneColor(zone, THREE);
        const cropMat = new THREE.MeshLambertMaterial({
            color, transparent: true, opacity: 0.85
        });
        const cropMesh = new THREE.Mesh(new THREE.BoxGeometry(6, h_, 6), cropMat);
        cropMesh.position.set(x, 0.3 + h_ / 2, z);
        cropMesh.castShadow = true;
        cropMesh.userData   = {
            zone, originalColor: color, x, z,
            baseY: 0.3 + h_ / 2, h: h_
        };
        _scene.add(cropMesh);
        _meshes.push(cropMesh);

        // Label sprite
        const sprite = _makeLabel(zone.name, color);
        sprite.position.set(x, 0.3 + h_ + 1.4, z);
        sprite.scale.set(5, 1.4, 1);
        _scene.add(sprite);

        // Particle system per zone (water/fert particles — hidden by default)
        const particles = _buildParticleSystem(THREE, x, z, h_);
        _scene.add(particles.mesh);
        _particles.push({ mesh: particles.mesh, geo: particles.geo, zone_id: zone.id, type: null });

        // Pump pipe indicator
        if (zone.pump_running) {
            _addPumpPipe(THREE, x, z, h_);
        }
    });

    // Render zone info cards
    _renderInfoCards(infoGrid);

    // Mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();
    const tooltip   = container.querySelector('#farm3d-tooltip');
    let hovered     = null;

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(_meshes);

        if (hovered && hovered !== hits[0]?.object) {
            hovered.material.emissive?.setHex(0x000000);
            hovered = null;
            tooltip.style.display = 'none';
        }
        if (hits.length > 0) {
            const mesh = hits[0].object;
            if (mesh !== hovered) {
                hovered = mesh;
                mesh.material.emissive?.setHex(0x333333);
                const z = mesh.userData.zone;
                tooltip.style.display = 'block';
                tooltip.innerHTML = `
                    <b style="font-size:14px;">${z.name}</b><br>
                    💧 Moisture: <b>${(z.moisture_pct || 0).toFixed(1)}%</b><br>
                    📊 Status: <b>${(z.moisture_status || '—').toUpperCase()}</b><br>
                    🌡 Temp: <b>${z.temp_c ? z.temp_c.toFixed(1) + '°C' : '—'}</b><br>
                    ⚡ EC: <b>${z.ec_ds_m ? z.ec_ds_m.toFixed(2) + ' dS/m' : '—'}</b><br>
                    🔧 Pump: <b>${z.pump_running ? '🟢 RUNNING' : '⚫ IDLE'}</b>
                `;
            }
            tooltip.style.left = (e.clientX - canvas.getBoundingClientRect().left + 16) + 'px';
            tooltip.style.top  = (e.clientY - canvas.getBoundingClientRect().top  - 10) + 'px';
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (hovered) { hovered.material.emissive?.setHex(0x000000); hovered = null; }
        tooltip.style.display = 'none';
    });

    // Click zone to irrigate/stop
    canvas.addEventListener('click', async (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(_meshes);
        if (hits.length > 0) {
            const zone = hits[0].object.userData.zone;
            await _toggleZoneIrrigation(zone, container);
        }
    });

    // Orbit controls
    let isDragging = false, prevX = 0, prevY = 0;
    let rotY = 0, rotX = 0.45, radius = 30;
    const updateCamera = () => {
        camera.position.x = radius * Math.sin(rotY) * Math.cos(rotX);
        camera.position.y = radius * Math.sin(rotX) + 5;
        camera.position.z = radius * Math.cos(rotY) * Math.cos(rotX);
        camera.lookAt(0, 2, 0);
    };
    updateCamera();
    canvas.addEventListener('mousedown', (e) => { isDragging = true; prevX = e.clientX; prevY = e.clientY; });
    window.addEventListener('mouseup',   () => { isDragging = false; });
    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        rotY += (e.clientX - prevX) * 0.007;
        rotX  = Math.max(0.1, Math.min(1.3, rotX - (e.clientY - prevY) * 0.004));
        prevX = e.clientX; prevY = e.clientY;
        updateCamera();
    });
    canvas.addEventListener('wheel', (e) => {
        radius = Math.max(10, Math.min(55, radius + e.deltaY * 0.04));
        updateCamera();
        e.preventDefault();
    }, { passive: false });

    // Animation loop
    let frame = 0;
    const animate = () => {
        _animId = requestAnimationFrame(animate);
        frame++;

        // Pulse pumping zones + animate particles
        _meshes.forEach((m, i) => {
            const zone = m.userData.zone;
            if (zone?.pump_running) {
                const pulse = Math.sin(frame * 0.1) * 0.1 + 1;
                m.scale.set(pulse, 1, pulse);
                m.material.color.setHex(0x1a7a4a);
            }

            // Critical moisture — red pulse
            if ((zone?.moisture_pct || 0) < 20 && !zone?.pump_running) {
                const glow = Math.abs(Math.sin(frame * 0.05));
                m.material.opacity = 0.7 + glow * 0.3;
            }
        });

        // Animate particles
        _particles.forEach(p => {
            if (!p.type) return;
            const positions = p.geo.attributes.position.array;
            for (let j = 1; j < positions.length; j += 3) {
                if (p.type === 'water') {
                    positions[j] -= 0.06;   // rain down
                    if (positions[j] < 0.3) positions[j] = p.startY || 5;
                } else if (p.type === 'fert') {
                    positions[j] += 0.04;   // float up
                    if (positions[j] > 5) positions[j] = 0.5;
                }
            }
            p.geo.attributes.position.needsUpdate = true;
            p.mesh.rotation.y += 0.005;
        });

        _renderer.render(_scene, camera);
    };
    animate();

    // Cleanup
    window.addEventListener('hashchange', () => {
        cancelAnimationFrame(_animId);
        _renderer.dispose();
        _meshes = []; _particles = [];
    }, { once: true });

    // Resize
    new ResizeObserver(() => {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix();
        _renderer.setSize(w, h);
    }).observe(canvas);

    // Simulate button
    simBtn?.addEventListener('click', () => _runDemoSimulation(container));

    // Auto-refresh zone states every 15s
    const refreshInterval = setInterval(async () => {
        try {
            const dashRes = await api(`/farms/${farm.id}/dashboard`);
            const newZones = dashRes?.data?.zones || [];
            if (newZones.length > 0) {
                _zones = newZones;
                _updateMeshColors();
                _renderInfoCards(infoGrid);
            }
        } catch { /* non-fatal */ }
    }, 15000);
    window.addEventListener('hashchange', () => clearInterval(refreshInterval), { once: true });
}

// ── Toggle zone irrigation with 3D simulation ─────────────────────────────────
async function _toggleZoneIrrigation(zone, container) {
    const infoGrid  = container.querySelector('#zone-info-grid');
    const simBanner = container.querySelector('#sim-banner');

    if (zone.pump_running) {
        try {
            await stopIrrigation(zone.id);
            zone.pump_running = false;
            _stopParticles(zone.id);
            showToast(`${zone.name}: Irrigation stopped`, 'success');
            _updateMeshColors();
            _renderInfoCards(infoGrid);
        } catch (err) {
            showToast(`Stop failed: ${err.message}`, 'error');
        }
    } else {
        try {
            await startIrrigation(zone.id, 20);
            zone.pump_running = true;
            _startParticles(zone.id, 'water');
            _flashBanner(simBanner, `💧 Irrigating ${zone.name}...`);
            showToast(`${zone.name}: Irrigation started`, 'success');
            _updateMeshColors();
            _renderInfoCards(infoGrid);
        } catch (err) {
            if (err.message === 'PUMP_ALREADY_RUNNING') {
                // Already running — just show the animation
                zone.pump_running = true;
                _startParticles(zone.id, 'water');
                _flashBanner(simBanner, `💧 ${zone.name} already irrigating`);
            } else {
                showToast(`Start failed: ${err.message}`, 'error');
            }
        }
    }
}

// ── Demo simulation sequence ───────────────────────────────────────────────────
async function _runDemoSimulation(container) {
    if (_simRunning) return;
    _simRunning = true;

    const simBanner = container.querySelector('#sim-banner');
    const infoGrid  = container.querySelector('#zone-info-grid');
    const btn       = container.querySelector('#simulate-btn');
    btn.disabled    = true;
    btn.textContent = '⏳ SIMULATING...';

    const steps = [
        {
            label: '🤖 AI Engine analyzing all zones...',
            duration: 2000,
            action: async () => {
                // Flash all meshes briefly
                _meshes.forEach(m => m.material.emissive?.setHex(0x333300));
                await _sleep(400);
                _meshes.forEach(m => m.material.emissive?.setHex(0x000000));
            },
        },
        {
            label: '⚠️ Grape Vineyard CRITICAL — moisture 19%',
            duration: 2500,
            action: async () => {
                const dry = _zones.find(z => z.moisture_pct < 30 || z.name.includes('Grape') || z.name.includes('Wheat'));
                if (dry) {
                    const mesh = _meshes.find(m => m.userData.zone.id === dry.id);
                    if (mesh) { mesh.material.color.setHex(0xff0000); }
                }
            },
        },
        {
            label: '💧 AI decision: IRRIGATE Grape Vineyard',
            duration: 2500,
            action: async () => {
                const dryZone = _zones.find(z => z.moisture_pct < 30 || z.name.includes('Grape'));
                if (dryZone) {
                    dryZone.pump_running = true;
                    _startParticles(dryZone.id, 'water');
                    
                    // Flash mesh blue
                    const mesh = _meshes.find(m => m.userData.zone.id === dryZone.id);
                    if (mesh) { mesh.material.emissive?.setHex(0x004488); }
                    
                    _updateMeshColors();
                    _renderInfoCards(infoGrid);
                }
            },
        },
        {
            label: '🌿 Fertigation: Nitrogen → Tomato zone',
            duration: 2500,
            action: async () => {
                const tomatoZone = _zones.find(z => z.name.includes('Tomato') || z.name.includes('Chilli'));
                if (tomatoZone) {
                    _startParticles(tomatoZone.id, 'fert');
                    
                    // Flash mesh neon green
                    const mesh = _meshes.find(m => m.userData.zone.id === tomatoZone.id);
                    if (mesh) { mesh.material.emissive?.setHex(0x116611); }
                    
                    // Try real API call — ignore error in demo
                    try {
                        await injectFertigation(tomatoZone.id, 'Nitrogen', 12);
                    } catch { /* demo continues regardless */ }
                }
            },
        },
        {
            label: '✅ Pomegranate: AI skips — moisture 72% (WET)',
            duration: 2000,
            action: async () => {
                const wetZone = _zones.find(z => z.moisture_pct > 65 || z.name.includes('Pomegranate'));
                if (wetZone) {
                    const mesh = _meshes.find(m => m.userData.zone.id === wetZone.id);
                    if (mesh) { mesh.material.color.setHex(0x3b82f6); }
                }
            },
        },
        {
            label: '📊 Moisture & EC levels updating in real time...',
            duration: 2500,
            action: async () => {
                // Remove emissive highlights
                _meshes.forEach(m => m.material.emissive?.setHex(0x000000));
                
                // Simulate moisture drastically rising
                const dryZone = _zones.find(z => z.pump_running);
                if (dryZone) {
                    dryZone.moisture_pct = 75; // Big jump!
                    dryZone.moisture_status = 'ok';
                }
                
                // Simulate EC jump due to fertigation
                const tomatoZone = _zones.find(z => z.name.includes('Tomato') || z.name.includes('Chilli'));
                if (tomatoZone) {
                    tomatoZone.ec_ds_m = (tomatoZone.ec_ds_m || 1.2) + 0.8;
                }
                
                _updateMeshColors();
                _renderInfoCards(infoGrid);
            },
        },
        {
            label: '✅ Simulation complete — all zones managed',
            duration: 2000,
            action: async () => {
                _stopAllParticles();
                _zones.forEach(z => { z.pump_running = false; });
                _updateMeshColors();
                _renderInfoCards(infoGrid);
            },
        },
    ];

    for (const step of steps) {
        _flashBanner(simBanner, step.label);
        await step.action();
        await _sleep(step.duration);
    }

    simBanner.style.display = 'none';
    btn.disabled    = false;
    btn.textContent = '⚡ DEMO SIMULATION';
    _simRunning     = false;
    showToast('Demo simulation complete!', 'success');
}

// ── Particle systems ──────────────────────────────────────────────────────────
function _buildParticleSystem(THREE, x, z, baseH) {
    const count    = 250; // Dense attractive particles
    const geo      = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        positions[i * 3]     = x + (Math.random() - 0.5) * 5;
        positions[i * 3 + 1] = 0.3 + baseH + Math.random() * 4;
        positions[i * 3 + 2] = z + (Math.random() - 0.5) * 5;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat  = new THREE.PointsMaterial({ color: 0x00c3ff, size: 0.30, transparent: true, opacity: 0 });
    const mesh = new THREE.Points(geo, mat);
    mesh.userData.startY = 0.3 + baseH + 3;
    return { mesh, geo };
}

function _startParticles(zoneId, type) {
    const p = _particles.find(p => p.zone_id === zoneId);
    if (!p) return;
    p.type = type;
    p.mesh.material.opacity    = 0.95;
    p.mesh.material.color.setHex(type === 'water' ? 0x00c3ff : 0x39ff14);
    p.mesh.material.size       = type === 'water' ? 0.28 : 0.40;
    p.startY = type === 'water' ? p.mesh.userData.startY : 0.5;
}

function _stopParticles(zoneId) {
    const p = _particles.find(p => p.zone_id === zoneId);
    if (!p) return;
    p.type = null;
    p.mesh.material.opacity = 0;
}

function _stopAllParticles() {
    _particles.forEach(p => { p.type = null; p.mesh.material.opacity = 0; });
}

// ── Color + mesh helpers ──────────────────────────────────────────────────────
function _zoneColor(zone, THREE) {
    if (!THREE) THREE = window.THREE;
    if (zone.pump_running)            return 0x1a7a4a;
    if (zone.moisture_status === 'dry')  return 0xef4444;
    if (zone.moisture_status === 'wet')  return 0x3b82f6;
    return 0x22c55e;
}

function _updateMeshColors() {
    _meshes.forEach(m => {
        const zone = m.userData.zone;
        const newZone = _zones.find(z => z.id === zone.id);
        if (newZone) {
            m.userData.zone = newZone;
            m.material.color.setHex(_zoneColor(newZone, window.THREE));
        }
    });
}

function _addPumpPipe(THREE, x, z, h) {
    const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 1.8, 8),
        new THREE.MeshLambertMaterial({ color: 0x0ea5e9 })
    );
    pipe.position.set(x + 3, 0.3 + h + 0.9, z + 3);
    _scene.add(pipe);
}

function _renderInfoCards(infoGrid) {
    if (!infoGrid) return;
    infoGrid.innerHTML = _zones.map(z => {
        const color  = z.pump_running   ? '#1a7a4a' :
                       z.moisture_status === 'dry' ? '#ef4444' :
                       z.moisture_status === 'wet' ? '#3b82f6' : '#22c55e';
        const label  = z.pump_running   ? '💧 IRRIGATING' :
                       z.moisture_status === 'dry' ? '🔴 DRY' :
                       z.moisture_status === 'wet' ? '🔵 WET' : '✅ OK';
        return `
            <div class="ks-card p-4 text-center border-t-4 cursor-pointer hover:shadow-md transition-shadow"
                 style="border-top-color:${color};"
                 onclick="window.location.hash='#control'">
                <p style="font-size:9px;font-weight:800;color:#9ca3af;
                           text-transform:uppercase;letter-spacing:0.06em;"
                   class="truncate">${z.name}</p>
                <p style="font-size:26px;font-weight:900;color:${color};margin:4px 0;">
                    ${(z.moisture_pct || 0).toFixed(0)}%
                </p>
                <p style="font-size:9px;font-weight:800;color:${color};">${label}</p>
            </div>
        `;
    }).join('');
}

function _flashBanner(el, text) {
    if (!el) return;
    el.textContent   = text;
    el.style.display = 'block';
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function _makeLabel(text, color) {
    const c   = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    if (ctx.roundRect) ctx.roundRect(8, 12, 240, 40, 8);
    else ctx.fillRect(8, 12, 240, 40);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font      = 'bold 20px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.length > 15 ? text.slice(0, 15) + '…' : text, 128, 32);
    const tex = new window.THREE.CanvasTexture(c);
    const mat = new window.THREE.SpriteMaterial({ map: tex, transparent: true });
    return new window.THREE.Sprite(mat);
}

function _loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
    });
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
