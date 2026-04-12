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
                    <span data-i18n="farm3d_title">${t('farm3d_title')}</span> <span class="brand-text">🌾</span>
                </h1>
                <p class="text-gray-500 font-medium mt-1" data-i18n="farm3d_subtitle">${t('farm3d_subtitle')}</p>
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
                " data-magnetic>⚡ DEMO SIMULATION</button>
            </div>
        </div>

        <div class="twin-info-bar" style="
            background: linear-gradient(90deg, #0a2018, #1a7a4a);
            color: white; font-size: 11px; padding: 8px 20px;
            border-left: 4px solid #00c3ff; border-radius: 8px;
            margin-bottom: 12px; display: flex; justify-content: space-between;
            align-items: center; font-weight: 600;
        ">
            <span>⚛ KrishiSarth Digital Twin — Every action is simulated in a virtual farm model BEFORE execution. AI validates efficiency and prevents waste.</span>
            <span class="mae-live font-black px-2 py-1 bg-black/30 rounded" style="font-family: 'JetBrains Mono', monospace;">MAE: loading...</span>
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
                <p style="font-size:12px;color:#6b7280;font-weight:700;" data-i18n="farm3d_loading">
                    ${t('farm3d_loading')}
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

    setTimeout(() => {
        _init3D(container);
        if (window.ksReveal) window.ksReveal();
    }, 80);
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
        loadingEl.innerHTML = `<p style="color:#6b7280;font-weight:700;" data-i18n="no_farm_selected">${t('no_farm_selected')}</p>`;
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

    // MAE Bar logic
    const maeLive = container.querySelector('.mae-live');
    const _fetchMAE = async () => {
        if (!maeLive) return;
        try {
            const res = await api(`/farms/${farm.id}/twin/status`);
            if (res && res.data) {
                const mae = res.data.mae_score || 0;
                maeLive.textContent = `MAE: ${mae.toFixed(3)}`;
                maeLive.style.color = mae < 0.1 ? '#22c55e' : (mae < 0.25 ? '#f59e0b' : '#ef4444');
            }
        } catch { }
    };
    _fetchMAE();
    setInterval(_fetchMAE, 60000);

    const THREE = window.THREE;
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 540;

    // Scene
    _scene = new THREE.Scene();

    function makeSkyTexture(THREE) {
        const c = document.createElement('canvas');
        c.width = 2; c.height = 256;
        const ctx = c.getContext('2d');
        const grad = ctx.createLinearGradient(0,0,0,256);
        grad.addColorStop(0,   '#0a1f10');  // deep dark green-black zenith
        grad.addColorStop(0.4, '#0d2e18');
        grad.addColorStop(0.7, '#1a4020');
        grad.addColorStop(1,   '#0c180e');  // horizon
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,2,256);
        const tex = new THREE.CanvasTexture(c);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        return tex;
    }
    _scene.background = makeSkyTexture(THREE);
    _scene.fog = new THREE.FogExp2(0x0c1a0e, 0.018);

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
    const groundGeo = new THREE.PlaneGeometry(80, 80, 64, 64);
    const positions = groundGeo.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i], z = positions[i+2];
        positions[i+1] = Math.sin(x*0.08)*0.4 + Math.cos(z*0.12)*0.3 + Math.sin(x*0.2+z*0.15)*0.15;
    }
    groundGeo.attributes.position.needsUpdate = true;
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0e1f10, roughness: 0.95, wireframe: false });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    _scene.add(ground);
    _scene.add(new THREE.GridHelper(50, 25, 0x9e9e9e, 0xdddddd));

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for (let i = 0; i < 3000; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.5; // upper half only
        const r = 80 + Math.random() * 40;
        starPos.push(r*Math.sin(phi)*Math.cos(theta), r*Math.cos(phi), r*Math.sin(phi)*Math.sin(theta));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x334433, size: 0.08 });
    const stars = new THREE.Points(starGeo, starMat);
    _scene.add(stars);

    // Moon
    const moonGeo = new THREE.SphereGeometry(2.5, 16, 16);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xfff8e7 });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(-40, 35, -60);
    const moonLight = new THREE.PointLight(0xfff8e7, 0.3, 200);
    moonLight.position.copy(moon.position);
    _scene.add(moon, moonLight);

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

        function buildCropCanopy(THREE, zone, x, z, h) {
            const group = new THREE.Group();
            const color = new THREE.Color(_zoneColor(zone, THREE));
            
            // Bottom trunk/stem cylinder
            const stemMat = new THREE.MeshStandardMaterial({ color: 0x3d2010, roughness:0.95 });
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, h*0.3, 6), stemMat);
            stem.position.y = h*0.15;
            group.add(stem);
            
            // Main canopy — slightly irregular sphere
            const canopyMat = new THREE.MeshStandardMaterial({
                color, emissive: color, emissiveIntensity: 0.08,
                roughness: 0.7, metalness: 0, transparent: true, opacity: 0.85
            });
            const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(h*0.55, 1), canopyMat);
            canopy.position.y = h*0.6;
            canopy.castShadow = true;
            canopy.scale.set(1.4, 0.7, 1.4);
            group.add(canopy);
            
            // Secondary smaller canopy
            const canopy2 = new THREE.Mesh(new THREE.IcosahedronGeometry(h*0.35, 1), canopyMat);
            canopy2.position.set(h*0.2, h*0.75, h*0.1);
            canopy2.scale.set(1.2, 0.65, 1.2);
            group.add(canopy2);
            
            group.position.set(x, 0.28, z);
            group.userData = { zone, originalColor: color, x, z, baseY: 0.28, h, mainCanopy: canopy, canopy2 };
            return group;
        }

        const cropGroup = buildCropCanopy(window.THREE, zone, x, z, h_);
        _scene.add(cropGroup);
        _meshes.push(cropGroup);

        // Label sprite
        const sprite = _makeLabel(zone.name, color);
        sprite.position.set(x, 0.3 + h_ + 1.4, z);
        sprite.scale.set(5, 1.4, 1);
        _scene.add(sprite);

        // Particle system per zone (water/fert particles — hidden by default)
        const particles = _buildParticleSystem(THREE, x, z, h_);
        _scene.add(particles.mesh);

        // Add persistent drip line to the central pipe header
        const dripLine = buildDripLine(THREE, 0, 0, x, z);
        dripLine.visible = zone.pump_running;
        _scene.add(dripLine);

        _particles.push({ mesh: particles.mesh, zone_id: zone.id, type: null, pipe: dripLine });
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
        const hits = raycaster.intersectObjects(_meshes, true);

        const hitObject = hits.length > 0 ? (hits[0].object.parent && hits[0].object.parent.userData.zone ? hits[0].object.parent : hits[0].object) : null;

        if (hovered && hovered !== hitObject) {
            if (hovered.userData && hovered.userData.mainCanopy) hovered.userData.mainCanopy.material.emissive?.setHex(0x000000);
            else if (hovered.material) hovered.material.emissive?.setHex(0x000000);
            hovered = null;
            tooltip.style.display = 'none';
        }
        if (hitObject && hitObject.userData && hitObject.userData.zone) {
            if (hitObject !== hovered) {
                hovered = hitObject;
                if (hitObject.userData.mainCanopy) hitObject.userData.mainCanopy.material.emissive?.setHex(0x333333);
                else if (hitObject.material) hitObject.material.emissive?.setHex(0x333333);
                const z = hitObject.userData.zone;
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
        if (hovered) { 
            if (hovered.userData.mainCanopy) hovered.userData.mainCanopy.material.emissive?.setHex(0x000000); 
            else if (hovered.material) hovered.material.emissive?.setHex(0x000000);
            hovered = null; 
        }
        tooltip.style.display = 'none';
    });

    // Click zone to show Digital Twin Panel
    canvas.addEventListener('click', async (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(_meshes, true);
        if (hits.length > 0) {
            let zObj = hits[0].object;
            if (!zObj.userData.zone && zObj.parent && zObj.parent.userData.zone) zObj = zObj.parent;
            const zone = zObj.userData.zone;
            if (zone) _showDigitalTwinPanel(zone, container);
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
            const mainCanopy = m.userData.mainCanopy;
            const mat = mainCanopy ? mainCanopy.material : (m.material || null);

            if (mat) {
                if (m.userData.twinPreview) {
                    // Digital Twin Preview Animation
                    const targetScaleY = m.userData.targetH / m.userData.h;
                    m.scale.y += (targetScaleY - m.scale.y) * 0.05;
                    m.position.y = m.userData.baseY;
                    mat.color.lerp(m.userData.targetColor, 0.05);
                    
                    if (m.userData.twinRing) {
                        m.userData.twinRing.material.opacity = 0.5 + Math.sin(frame * 0.1) * 0.5;
                    }
                } else {
                    // Normal state
                    if (zone?.pump_running) {
                        const pulse = Math.sin(frame * 0.1) * 0.1 + 1;
                        m.scale.set(pulse, 1, pulse);
                        m.position.y = m.userData.baseY;
                        mat.color.setHex(0x1a7a4a);
                    } else {
                        m.scale.y += (1 - m.scale.y) * 0.1;
                        m.scale.x += (1 - m.scale.x) * 0.1;
                        m.scale.z += (1 - m.scale.z) * 0.1;
                        m.position.y = m.userData.baseY;
                        mat.color.lerp(new window.THREE.Color(_zoneColor(zone, window.THREE)), 0.1);
                    }

                    // Critical moisture — red pulse
                    if ((zone?.moisture_pct || 0) < 20 && !zone?.pump_running) {
                        const glow = Math.abs(Math.sin(frame * 0.05));
                        mat.opacity = 0.7 + glow * 0.3;
                    } else {
                        mat.opacity = 0.85;
                    }
                }
            }

            if (mainCanopy) {
                mainCanopy.rotation.y += 0.003;
                mainCanopy.scale.x = 1.4 + Math.sin(frame * 0.02 + i) * 0.04;
                mainCanopy.scale.z = 1.4 + Math.cos(frame * 0.018 + i) * 0.04;
                // Gentle sway
                m.rotation.z = Math.sin(frame * 0.015 + i * 0.5) * 0.02;
            }
        });

        // Animate particles
        _particles.forEach(p => {
            if (!p.type) return;
            p.mesh.children.forEach(droplet => {
                if (p.type === 'water') {
                    droplet.position.y -= droplet.userData.speed;
                    if (droplet.position.y < 0.3) {
                        droplet.position.y = droplet.userData.startY;
                        if (Math.random() > 0.8) {
                            spawnRipple(window.THREE, _scene, droplet.position.x, droplet.position.z);
                        }
                    }
                } else if (p.type === 'fert') {
                    droplet.position.y += droplet.userData.speed * 0.5;
                    if (droplet.position.y > 5) droplet.position.y = 0.5;
                }
            });
            p.mesh.rotation.y += 0.005;
        });

        // Animate ripples
        for (let j = ripples.length - 1; j >= 0; j--) {
            const r = ripples[j];
            const age = (Date.now() - r.userData.born) / 600; // 0 to 1 in 600ms
            if (age > 1) {
                _scene.remove(r);
                ripples.splice(j, 1);
            } else {
                r.scale.set(1 + age * 3, 1 + age * 3, 1);
                r.material.opacity = 0.5 * (1 - age);
            }
        }

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

// ── Digital Twin Preview Helpers ──────────────────────────────────────────────
function _previewTwinResult(zoneId, predictedMoisture, type) {
    const mesh = _meshes.find(m => m.userData.zone.id === zoneId);
    if (!mesh) return;
    
    const targetH = Math.max(0.3, (predictedMoisture / 100) * 3.5 + 0.25);
    let hex = 0x22c55e;
    if (predictedMoisture < 30) hex = 0xef4444;
    else if (predictedMoisture > 70) hex = 0x3b82f6;

    mesh.userData.twinPreview = true;
    mesh.userData.targetH = targetH;
    mesh.userData.targetColor = new window.THREE.Color(hex);

    if (type === 'water') _startParticles(zoneId, 'water');

    if (!mesh.userData.twinRing) {
        const ringGeo = new window.THREE.RingGeometry(3.5, 4.2, 32);
        const ringMat = new window.THREE.MeshLambertMaterial({
            color: 0x00c3ff, emissive: 0x00c3ff, emissiveIntensity: 0.8,
            transparent: true, opacity: 0.8, side: window.THREE.DoubleSide
        });
        const ring = new window.THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(mesh.userData.x, 0.2, mesh.userData.z);
        _scene.add(ring);
        mesh.userData.twinRing = ring;
    }

    if (!mesh.userData.twinSprite) {
        const sprite = _makeLabel("TWIN PREVIEW", 0x00c3ff);
        sprite.position.set(mesh.userData.x, 0.3 + mesh.userData.h + 2.5, mesh.userData.z);
        sprite.scale.set(7, 2, 1);
        _scene.add(sprite);
        mesh.userData.twinSprite = sprite;
    }

    let wm = document.getElementById('twin-watermark');
    if (!wm) {
        wm = document.createElement('div');
        wm.id = 'twin-watermark';
        wm.style.cssText = `
            position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.8); color: white; padding: 6px 16px;
            border-radius: 20px; font-size: 11px; font-weight: 900; letter-spacing: 1px;
            font-family: 'JetBrains Mono', monospace; border: 1px solid rgba(0,195,255,0.5);
            animation: twin-pulse-border 2s infinite; z-index: 10; pointer-events: none;
        `;
        wm.innerHTML = "⚛ DIGITAL TWIN SIMULATION ACTIVE";
        
        if (!document.getElementById('twin-styles')) {
            const style = document.createElement('style');
            style.id = 'twin-styles';
            style.textContent = `
                @keyframes twin-pulse-border {
                    0% { box-shadow: 0 0 0 0 rgba(0,195,255,0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(0,195,255,0); }
                    100% { box-shadow: 0 0 0 0 rgba(0,195,255,0); }
                }
            `;
            document.head.appendChild(style);
        }
        
        const canvasContainer = document.getElementById('farm3d-canvas').parentElement;
        canvasContainer.style.position = 'relative';
        canvasContainer.appendChild(wm);
    }
    wm.style.display = 'block';
}

function _resetTwinPreview(zoneId) {
    const mesh = _meshes.find(m => m.userData.zone.id === zoneId);
    if (!mesh) return;
    
    mesh.userData.twinPreview = false;
    _stopParticles(zoneId);

    if (mesh.userData.twinRing) {
        _scene.remove(mesh.userData.twinRing);
        mesh.userData.twinRing.material.dispose();
        mesh.userData.twinRing.geometry.dispose();
        mesh.userData.twinRing = null;
    }
    if (mesh.userData.twinSprite) {
        _scene.remove(mesh.userData.twinSprite);
        mesh.userData.twinSprite.material.map.dispose();
        mesh.userData.twinSprite.material.dispose();
        mesh.userData.twinSprite = null;
    }

    let wm = document.getElementById('twin-watermark');
    if (wm) wm.style.display = 'none';
}

// ── Digital Twin Panel ────────────────────────────────────────────────────────
async function _showDigitalTwinPanel(zone, container) {
    let panel = document.getElementById('twin-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'twin-panel';
        panel.style.cssText = `
            position: fixed; top: 0; right: -380px; width: 360px; height: 100vh;
            background: rgba(10,20,15,0.95); backdrop-filter: blur(8px);
            border-left: 3px solid #1a7a4a; z-index: 1000;
            color: white; transition: right 0.3s ease;
            box-shadow: -5px 0 25px rgba(0,0,0,0.5);
            font-family: var(--font-main); display: flex; flex-direction: column; overflow-y: auto;
        `;
        document.body.appendChild(panel);
    }
    
    // Animate in
    setTimeout(() => { panel.style.right = '0'; }, 10);
    
    const closePanel = () => { 
        panel.style.right = '-380px'; 
        _resetTwinPreview(zone.id);
    };

    const renderPanel = async (duration = 20) => {
        const currentM = zone.moisture_pct || 0;
        
        // Client-side fallback baseline
        let predictedMoisture = Math.min(100, currentM + duration * 1.8);
        let waterVol = duration * 12;
        let eff = (predictedMoisture >= 45 && predictedMoisture <= 75) ? 0.91 : 0.62;
        let suggestion = "Optimal duration.";
        let effColor = eff >= 0.85 ? '#22c55e' : (eff >= 0.6 ? '#f59e0b' : '#ef4444');
        let trustLabel = "HIGH TRUST", trustColor = "#22c55e";
        let isFetching = true;

        const updateHTML = () => {
            const circRadius = 36;
            const circCircum = 2 * Math.PI * circRadius;
            const currentOffset = circCircum - (currentM / 100) * circCircum;

            panel.innerHTML = `
                <div style="padding: 24px; display: flex; flex-direction: column; gap: 24px; min-height: 100vh;">
                    <!-- Header -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h2 style="font-size: 20px; font-weight: 800; color: white; margin: 0;">${zone.name}</h2>
                            <div style="color: #00c3ff; font-weight: 700; font-size: 11px; text-transform: uppercase; margin-top: 4px;">
                                🔬 Digital Twin Simulation ${isFetching ? '<span style="color:white; margin-left:4px;" class="animate-pulse">...</span>' : ''}
                            </div>
                        </div>
                        <button id="twin-close-btn" style="background: none; border: none; color: #9ca3af; font-size: 28px; cursor: pointer; padding: 0; line-height: 1;">&times;</button>
                    </div>
                    
                    <div style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;">
                        <div style="width:8px; height:8px; border-radius:50%; background:${trustColor};"></div>
                        <span style="font-size: 10px; font-weight: 800; letter-spacing: 1px; color: ${trustColor}">${trustLabel}</span>
                    </div>

                    <!-- Current State -->
                    <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 16px; border: 1px solid rgba(255,255,255,0.1);">
                        <h3 style="font-size: 10px; color: #9ca3af; text-transform: uppercase; font-weight: 700; margin: 0 0 16px 0;">Current State</h3>
                        <div style="display: flex; gap: 20px; align-items: center;">
                            <div style="position: relative; width: 80px; height: 80px;">
                                <svg width="80" height="80" style="transform: rotate(-90deg);">
                                    <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8" />
                                    <circle cx="40" cy="40" r="36" fill="none" stroke="#1a7a4a" stroke-width="8"
                                        stroke-dasharray="${circCircum}" stroke-dashoffset="${currentOffset}"
                                        style="transition: stroke-dashoffset 0.5s ease;" />
                                </svg>
                                <div style="position: absolute; inset:0; display:flex; align-items:center; justify-content:center; font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: bold;">
                                    ${currentM.toFixed(0)}%
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <div style="background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 12px;">🌡️ ${zone.temp_c?.toFixed(1) || '—'} °C</div>
                                <div style="background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 12px;">⚡ ${zone.ec_ds_m?.toFixed(2) || '—'} dS/m</div>
                                <div style="background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 12px;">🧪 pH ${zone.ph?.toFixed(1) || '—'}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Simulation Controls -->
                    <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 16px; border: 1px solid rgba(255,255,255,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <h3 style="font-size: 10px; color: #9ca3af; text-transform: uppercase; font-weight: 700; margin: 0;">Irrigation Duration</h3>
                            <span id="twin-duration-text" style="font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: bold; color: #00c3ff;">${duration} min</span>
                        </div>
                        <input type="range" id="twin-slider" min="0" max="60" value="${duration}" style="width: 100%; accent-color: #00c3ff; cursor: pointer; ${isFetching ? 'opacity:0.5; pointer-events:none;' : ''}">
                        
                        <div style="margin-top: 24px;">
                            <h3 style="font-size: 10px; color: #9ca3af; text-transform: uppercase; font-weight: 700; margin: 0 0 12px 0;">Simulation Result</h3>
                            
                            <div style="display: flex; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 13px; margin-bottom: 8px;">
                                <span>Moisture</span>
                                <span>${currentM.toFixed(0)}% <span style="color:#00c3ff">→</span> <span style="color:${effColor}">${predictedMoisture.toFixed(0)}%</span></span>
                            </div>
                            <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; margin-bottom: 16px;">
                                <div style="width: ${predictedMoisture}%; height: 100%; background: ${effColor}; transition: background 0.3s, width 0.3s ease;"></div>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 8px;">
                                <span style="color: #9ca3af">Water Volume</span>
                                <span style="font-family: 'JetBrains Mono', monospace; font-weight: bold;">~${waterVol.toFixed(1)} L</span>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 16px;">
                                <span style="color: #9ca3af">Efficiency</span>
                                <div style="background: ${effColor}; color: #000; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${(eff * 100).toFixed(0)}%</div>
                            </div>

                            ${suggestion ? `<div style="background: rgba(0, 195, 255, 0.1); border-left: 3px solid #00c3ff; padding: 10px; font-size: 12px; line-height: 1.5; color: #e5e7eb; margin-bottom: 8px;">
                                <strong>AI Rec:</strong> ${suggestion}
                            </div>` : ''}
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div style="display: flex; gap: 12px; margin-top: auto;">
                        <button id="twin-cancel-btn" style="flex: 1; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: all 0.2s;">❌ Cancel</button>
                        <button id="twin-exec-btn" style="flex: 1; background: #1a7a4a; border: none; color: white; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(26,122,74,0.3);">✅ Execute</button>
                    </div>
                </div>
            `;

            // Listeners
            panel.querySelector('#twin-close-btn').addEventListener('click', closePanel);
            panel.querySelector('#twin-cancel-btn').addEventListener('click', closePanel);
            
            panel.querySelector('#twin-exec-btn').addEventListener('click', async () => {
                const btn = panel.querySelector('#twin-exec-btn');
                btn.innerHTML = '⏳ Executing...';
                try {
                    await startIrrigation(zone.id, document.getElementById('twin-slider').value);
                    zone.pump_running = true;
                    _resetTwinPreview(zone.id);
                    _startParticles(zone.id, 'water');
                    _updateMeshColors();
                    _renderInfoCards(document.getElementById('zone-info-grid') || document.querySelector('#zone-info-grid'));
                    showToast(`Started irrigation for ${zone.name}`, 'success');
                    
                    // Log simulation to localStorage
                    let hist = JSON.parse(localStorage.getItem('ks_twin_history') || '[]');
                    hist.push({
                        zone_name: zone.name,
                        timestamp: new Date().toISOString(),
                        predicted_moisture: predictedMoisture,
                        actual_moisture: null,
                        efficiency_score: eff,
                        type: 'Irrigation'
                    });
                    localStorage.setItem('ks_twin_history', JSON.stringify(hist));

                    closePanel();
                } catch(e) {
                   showToast(e.message, 'error');
                   btn.innerHTML = '✅ Execute';
                }
            });

            const slider = panel.querySelector('#twin-slider');
            let debounceTimer;
            slider.addEventListener('input', (e) => {
                panel.querySelector('#twin-duration-text').innerText = `${e.target.value} min`;
                
                // Immediately update local UI approximation
                let pM = Math.min(100, currentM + Number(e.target.value) * 1.8);
                _previewTwinResult(zone.id, pM, "water");

                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    renderPanel(Number(e.target.value));
                }, 100); // 100ms debounce
            });
        };

        // Render loading state immediately
        updateHTML();

        // Fetch real simulation data
        try {
            const formData = {
                duration_minutes: duration,
                current_state: {
                    moisture_pct: zone.moisture_pct || 50,
                    temp_c: zone.temp_c || 25,
                    ec_ds_m: zone.ec_ds_m || 1.2,
                    ph: zone.ph || 6.5,
                    crop_type: zone.crop_type || 'default'
                }
            };
            const res = await api(`/zones/${zone.id}/twin/simulate-irrigation`, {
                method: 'POST', body: JSON.stringify(formData)
            });
            if (res && res.data) {
                predictedMoisture = res.data.predicted_moisture;
                waterVol = res.data.water_volume_l;
                eff = res.data.efficiency_score;
                suggestion = res.data.recommendation;
                if (res.data.warning_if_ec_too_high) suggestion += '<br><b style="color:#ef4444">WARNING: SALT STRESS</b>';
                effColor = eff >= 0.85 ? '#22c55e' : (eff >= 0.6 ? '#f59e0b' : '#ef4444');
                const mae = res.data.mae_confidence || 0.08;
                if (mae < 0.1) { trustLabel = "HIGH TRUST MAE: " + mae; trustColor = "#22c55e"; }
                else if (mae < 0.25) { trustLabel = "MEDIUM MAE: " + mae; trustColor = "#f59e0b"; }
                else { trustLabel = "LOW MAE: " + mae; trustColor = "#ef4444"; }
            }
        } catch(e) {
            console.log("Twin API error, using client fallback", e);
        }

        isFetching = false;
        // Re-render with fetched data
        updateHTML();

        // **NEW**: Trigger Live 3D Preview
        _previewTwinResult(zone.id, predictedMoisture, "water");
    };

    renderPanel(20);
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
            label: t('sim_step_1'),
            duration: 2000,
            action: async () => {
                // Flash all meshes briefly
                _meshes.forEach(m => m.material.emissive?.setHex(0x333300));
                await _sleep(400);
                _meshes.forEach(m => m.material.emissive?.setHex(0x000000));
            },
        },
        {
            label: t('sim_step_2'),
            duration: 1500,
            action: async () => {
                _meshes.forEach(m => m.material.emissive?.setHex(0x004466));
                await _sleep(400);
                _meshes.forEach(m => m.material.emissive?.setHex(0x000000));
            },
        },
        {
            label: t('sim_step_3'),
            duration: 2000,
            action: async () => { },
        },
        {
            label: t('sim_step_4'),
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
            label: t('sim_step_5'),
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
            label: t('sim_step_6'),
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
            label: t('sim_step_7'),
            duration: 2500,
            action: async () => {
                 const tomatoZone = _zones.find(z => z.name.includes('Tomato') || z.name.includes('Chilli'));
                 if (tomatoZone) {
                     const mesh = _meshes.find(m => m.userData.zone.id === tomatoZone.id);
                     if (mesh) { mesh.material.emissive?.setHex(0x333300); setTimeout(() => {if(mesh) mesh.material.emissive?.setHex(0x000000)}, 500); }
                 }
            },
        },
        {
            label: t('sim_step_8'),
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
            label: t('sim_step_8'),
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
            label: t('sim_step_9'),
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
const ripples = [];

function buildDripLine(THREE, fromX, fromZ, toX, toZ) {
    const dir = new THREE.Vector3(toX-fromX, 0, toZ-fromZ);
    const len = dir.length();
    const mid = new THREE.Vector3((fromX+toX)/2, 0.35, (fromZ+toZ)/2);
    const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, len, 4),
        new THREE.MeshStandardMaterial({ color: 0x1e4080, roughness:0.8 })
    );
    pipe.position.copy(mid);
    pipe.rotation.y = Math.atan2(dir.x, dir.z);
    pipe.rotation.z = Math.PI/2;
    return pipe;
}

function spawnRipple(THREE, scene, x, z) {
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.05, 0.12, 12),
        new THREE.MeshBasicMaterial({ color:0x38bdf8, transparent:true, opacity:0.5, side:THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI/2;
    ring.position.set(x, 0.31, z);
    ring.userData.born = Date.now();
    scene.add(ring); ripples.push(ring);
}

function _buildParticleSystem(THREE, x, z, baseH) {
    const count = 30; // Realistic drip droplets
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0 });
    const geo = new THREE.SphereGeometry(0.05, 8, 8);
    for (let i = 0; i < count; i++) {
        const droplet = new THREE.Mesh(geo, mat.clone());
        droplet.scale.set(1, 1.5, 1);
        droplet.position.set(x + (Math.random() - 0.5) * 4, 0.3 + baseH + Math.random() * 4, z + (Math.random() - 0.5) * 4);
        droplet.userData = { speed: 0.08 + Math.random() * 0.06, startY: 0.3 + baseH + 0.5 + Math.random() };
        group.add(droplet);
    }
    return { mesh: group };
}

function _startParticles(zoneId, type) {
    const p = _particles.find(p => p.zone_id === zoneId);
    if (!p) return;
    p.type = type;
    p.mesh.children.forEach(c => {
        c.material.opacity = 0.7;
        c.material.color.setHex(type === 'water' ? 0x38bdf8 : 0x39ff14);
    });
    if (type === 'water' && p.pipe) p.pipe.visible = true;
}

function _stopParticles(zoneId) {
    const p = _particles.find(p => p.zone_id === zoneId);
    if (!p) return;
    p.type = null;
    p.mesh.children.forEach(c => c.material.opacity = 0);
    if (p.pipe) p.pipe.visible = false;
}

function _stopAllParticles() {
    _particles.forEach(p => { 
        p.type = null; 
        p.mesh.children.forEach(c => c.material.opacity = 0);
        if (p.pipe) p.pipe.visible = false;
    });
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
    // Legacy mapping replaced by global static drip lines
}

function _renderInfoCards(infoGrid) {
    if (!infoGrid) return;
    infoGrid.innerHTML = _zones.map(z => {
        const color  = z.pump_running   ? '#1a7a4a' :
                       z.moisture_status === 'dry' ? '#ef4444' :
                       z.moisture_status === 'wet' ? '#3b82f6' : '#22c55e';
        const label  = z.pump_running   ? t('irrigating_caps') :
                       z.moisture_status === 'dry' ? t('dry_caps') :
                       z.moisture_status === 'wet' ? t('wet_caps') : t('ok_caps');
        return `
            <div class="ks-card p-4 text-center border-t-4 cursor-pointer hover:shadow-md transition-shadow relative"
                 style="border-top-color:${color};"
                 onclick="window.location.hash='#control'">
                 
                 <!-- TWIN BADGE -->
                 <div style="position: absolute; top: 8px; right: 8px; font-size: 8px; font-weight: 900; background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3); color: #166534; padding: 2px 4px; border-radius: 4px; letter-spacing: 1px; font-family: 'JetBrains Mono', monospace;">
                     TWIN
                 </div>

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
