import { t }     from '../utils/i18n.js';
import { store } from '../state/store.js';
import { api }   from '../api/client.js';
import { showToast } from '../components/toast.js';

/**
 * ELITE SMART FARM DIGITAL TWIN
 * A high-fidelity, simulation-driven 3D agricultural environment.
 */

export function renderFarm3D() {
    const container = document.createElement('div');
    container.className = 'w-full h-full relative bg-[#0f172a] overflow-hidden';

    // Premium UI Overlays
    container.innerHTML = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
            
            #farm3d-canvas-container {
                width: 100%;
                height: calc(100vh - 80px);
                position: relative;
            }

            .glass-panel {
                background: rgba(15, 23, 42, 0.75);
                backdrop-filter: blur(16px) saturate(180%);
                -webkit-backdrop-filter: blur(16px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                color: white;
                font-family: 'Outfit', sans-serif;
            }

            .stat-badge {
                background: rgba(255, 255, 255, 0.05);
                padding: 4px 10px;
                border-radius: 8px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .action-btn {
                background: linear-gradient(135deg, #10b981, #059669);
                border: none;
                color: white;
                padding: 10px 16px;
                border-radius: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
            }

            .action-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3);
            }

            .action-btn:active {
                transform: scale(0.96);
            }

            .action-btn.secondary {
                background: rgba(255, 255, 255, 0.1);
                box-shadow: none;
            }

            #zone-side-panel {
                position: absolute;
                top: 20px;
                right: 20px;
                width: 320px;
                padding: 24px;
                transform: translateX(400px);
                transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                z-index: 100;
            }

            #zone-side-panel.active {
                transform: translateX(0);
            }

            .progress-bar {
                width: 100%;
                height: 6px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 3px;
                overflow: hidden;
            }

            .progress-fill {
                height: 100%;
                transition: width 0.3s ease;
            }

            #farm-status-bar {
                position: absolute;
                bottom: 20px;
                left: 20px;
                padding: 12px 24px;
                display: flex;
                gap: 24px;
                z-index: 50;
            }

            .weather-toggle {
                position: absolute;
                top: 20px;
                left: 20px;
                display: flex;
                gap: 8px;
                z-index: 50;
            }

            .weather-btn {
                width: 44px;
                height: 44px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: rgba(255, 255, 255, 0.6);
                transition: all 0.2s;
                font-size: 20px;
            }

            .weather-btn.active {
                background: #3b82f6;
                color: white;
                border: 1px solid #60a5fa;
                box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
            }

            #instruction-tag {
                position: absolute;
                top: 80px;
                left: 20px;
                color: rgba(255,255,255,0.4);
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
        </style>

        <div id="farm3d-canvas-container">
            <!-- Three.js Canvas will be here -->
            
            <div class="weather-toggle">
                <div id="btn-sun" class="weather-btn active" title="Sunny">☀️</div>
                <div id="btn-rain" class="weather-btn" title="Rain">🌧️</div>
            </div>

            <div id="instruction-tag">🖱️ Drag to orbit • 🔍 Scroll to zoom • 🛖 Click zone</div>

            <div id="farm-status-bar" class="glass-panel">
                <div class="flex flex-col">
                    <span class="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Global Health</span>
                    <span id="global-health" class="text-xl font-extrabold text-[#10b981]">98%</span>
                </div>
                <div class="flex flex-col">
                    <span class="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Simulation</span>
                    <span id="sim-status" class="text-xl font-extrabold text-white">active</span>
                </div>
                <div class="flex flex-col">
                    <span class="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Time</span>
                    <span id="sim-time" class="text-xl font-extrabold text-white">00:00:00</span>
                </div>
            </div>

            <div id="zone-side-panel" class="glass-panel">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h2 id="panel-zone-name" class="text-2xl font-extrabold">Zone A</h2>
                        <span id="panel-crop-type" class="stat-badge">Wheat</span>
                    </div>
                    <button id="close-panel" class="text-gray-400 hover:text-white transition-colors text-2xl">&times;</button>
                </div>

                <div class="space-y-6">
                    <div class="space-y-2">
                        <div class="flex justify-between text-sm font-bold">
                            <span>Growth</span>
                            <span id="val-growth" class="text-emerald-400">0%</span>
                        </div>
                        <div class="progress-bar">
                            <div id="bar-growth" class="progress-fill bg-emerald-400" style="width: 0%"></div>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <div class="flex justify-between text-sm font-bold">
                            <span>Moisture</span>
                            <span id="val-water" class="text-blue-400">0%</span>
                        </div>
                        <div class="progress-bar">
                            <div id="bar-water" class="progress-fill bg-blue-400" style="width: 0%"></div>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <div class="flex justify-between text-sm font-bold">
                            <span>Overall Health</span>
                            <span id="val-health" class="text-yellow-400">0%</span>
                        </div>
                        <div class="progress-bar">
                            <div id="bar-health" class="progress-fill bg-yellow-400" style="width: 0%"></div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3 pt-4">
                        <button id="btn-irrigate" class="action-btn">💦 Irrigate</button>
                        <button id="btn-change-crop" class="action-btn secondary">🌾 Change Crop</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        _initEliteTwin(container);
    }, 100);

    return container;
}

// ── ELITE TWIN ENGINE ────────────────────────────────────────────────────────

let _scene, _renderer, _camera, _controls, _raycaster;
let _zones = [];
let _clock = new THREE.Clock();
let _simTime = 0;
let _weather = 'sunny'; // 'sunny' or 'rain'
let _selectedZoneId = null;
let _animId;

async function _initEliteTwin(container) {
    // 1. Load Scripts
    await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    await _loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    await _loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');

    if (!window.THREE) return;
    const THREE = window.THREE;

    const canvasContainer = container.querySelector('#farm3d-canvas-container');
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    // 2. Scene setup
    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0x0f172a);
    _scene.fog = new THREE.FogExp2(0x0f172a, 0.015);

    _camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    _camera.position.set(35, 40, 50);

    _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    _renderer.setSize(width, height);
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.shadowMap.enabled = true;
    _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    _renderer.outputEncoding = THREE.sRGBEncoding;
    canvasContainer.appendChild(_renderer.domElement);

    _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
    _controls.enableDamping = true;
    _controls.dampingFactor = 0.05;
    _controls.maxPolarAngle = Math.PI / 2.1;
    _controls.minDistance = 20;
    _controls.maxDistance = 120;

    _raycaster = new THREE.Raycaster();

    // 3. Lighting (Premium setup)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    _scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x0f172a, 0.5);
    _scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff1e0, 1.2);
    sunLight.position.set(20, 40, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    _scene.add(sunLight);

    // 4. Ground Environment
    const groundGeo = new THREE.CircleGeometry(100, 64);
    const groundMat = new THREE.MeshStandardMaterial({ 
        color: 0x1e293b,
        roughness: 0.8,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    _scene.add(ground);

    // 5. Initialize Simulation Data
    _zones = [
        { id: 'A', name: 'Zone A', type: 'greenhouse', crop: 'Tomato', growth: 0.45, water: 0.6, health: 0.95, mesh: null, plants: [] },
        { id: 'B', name: 'Zone B', type: 'bed', crop: 'Wheat', growth: 0.72, water: 0.4, health: 0.88, mesh: null, plants: [] },
        { id: 'C', name: 'Zone C', type: 'bed', crop: 'Lettuce', growth: 0.2, water: 0.8, health: 0.99, mesh: null, plants: [] },
        { id: 'D', name: 'Zone D', type: 'bed', crop: 'Berry', growth: 0.88, water: 0.3, health: 0.65, mesh: null, plants: [] },
    ];

    // 6. Build Environment Meshes
    _buildModularFarm();

    // 7. Interaction Listeners
    window.addEventListener('resize', () => {
        const w = canvasContainer.clientWidth;
        const h = canvasContainer.clientHeight;
        _camera.aspect = w / h;
        _camera.updateProjectionMatrix();
        _renderer.setSize(w, h);
    });

    _renderer.domElement.addEventListener('click', _handleCanvasClick);

    // UI Listeners
    container.querySelector('#btn-sun').onclick = () => _setWeather('sunny');
    container.querySelector('#btn-rain').onclick = () => _setWeather('rain');
    container.querySelector('#close-panel').onclick = () => _hidePanel();
    container.querySelector('#btn-irrigate').onclick = () => _irrigateSelected();
    container.querySelector('#btn-change-crop').onclick = () => _changeCropSelected();

    // Animation loop
    const animate = () => {
        _animId = requestAnimationFrame(animate);
        const delta = _clock.getDelta();
        
        _controls.update();

        // Wind Sway & Growth
        _zones.forEach((zone, idx) => {
            const wind = Math.sin(Date.now() * 0.002 + idx) * 0.02;
            zone.plants.forEach(plant => {
                plant.rotation.z = wind;
                plant.rotation.x = wind * 0.5;

                // Scale based on growth (lerp)
                const targetScale = 0.5 + zone.growth * 1.5;
                plant.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.05);
                
                // Color shift based on health
                if (plant.material && plant.material.color) {
                    const healthyColor = new THREE.Color(0x2d5a27);
                    const dryColor = new THREE.Color(0x9a8e5a);
                    plant.material.color.lerp(zone.health > 0.5 ? healthyColor : dryColor, 0.01);
                }
            });

            // Soil color based on water
            if (zone.soilMesh) {
                const drySoil = new THREE.Color(0x4b3621);
                const wetSoil = new THREE.Color(0x1a1110);
                zone.soilMesh.material.color.lerp(zone.water > 0.5 ? wetSoil : drySoil, 0.05);
            }
        });

        // Particles for Rain
        if (_weather === 'rain') {
            _animateRain(delta);
        }

        _renderer.render(_scene, _camera);
    };
    animate();

    // Simulation Loop (1 second)
    const simInterval = setInterval(() => {
        _runSimulationStep();
        _updateUI();
    }, 1000);

    // Cleanup
    window.addEventListener('hashchange', () => {
        cancelAnimationFrame(_animId);
        clearInterval(simInterval);
        _renderer.dispose();
    }, { once: true });
}

function _buildModularFarm() {
    const THREE = window.THREE;
    const bedGeometry = new THREE.BoxGeometry(15, 0.8, 15);
    const bedMaterial = new THREE.MeshStandardMaterial({ color: 0x334155 });

    _zones.forEach((zone, i) => {
        const x = (i % 2 === 0) ? -10 : 10;
        const z = (i < 2) ? -10 : 10;

        // 1. Bed Structure
        const bed = new THREE.Mesh(bedGeometry, bedMaterial);
        bed.position.set(x, 0.4, z);
        bed.castShadow = true;
        bed.receiveShadow = true;
        bed.userData = { zoneId: zone.id };
        _scene.add(bed);
        zone.mesh = bed;

        // 2. Soil
        const soilGeo = new THREE.PlaneGeometry(14.5, 14.5);
        const soilMat = new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 1 });
        const soil = new THREE.Mesh(soilGeo, soilMat);
        soil.rotation.x = -Math.PI / 2;
        soil.position.set(x, 0.81, z);
        soil.receiveShadow = true;
        _scene.add(soil);
        zone.soilMesh = soil;

        // 3. Zone A Specific: Greenhouse
        if (zone.type === 'greenhouse') {
            const ghGroup = new THREE.Group();
            
            // Curved Transparency
            const glassGeo = new THREE.CylinderGeometry(8, 8, 15, 32, 1, true, 0, Math.PI);
            const glassMat = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                metalness: 0,
                roughness: 0.1,
                transmission: 0.9,
                transparent: true,
                opacity: 0.3,
                thickness: 0.5,
                side: THREE.DoubleSide
            });
            const glass = new THREE.Mesh(glassGeo, glassMat);
            glass.rotation.z = Math.PI / 2;
            glass.position.set(0, 0, 0);
            ghGroup.add(glass);

            // Frame
            const frameGeo = new THREE.TorusGeometry(8, 0.1, 16, 100, Math.PI);
            const frameMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
            for(let j=0; j<4; j++) {
                const f = new THREE.Mesh(frameGeo, frameMat);
                f.rotation.y = Math.PI / 2;
                f.position.x = -7.5 + j*5;
                ghGroup.add(f);
            }

            ghGroup.position.set(x, 8.8, z);
            _scene.add(ghGroup);
        }

        // 4. Populate Plants (Procedural/Elite Layout)
        _populatePlants(zone, x, z);
    });
}

function _populatePlants(zone, centerX, centerZ) {
    const THREE = window.THREE;
    const count = zone.type === 'greenhouse' ? 32 : 48;
    
    // Plant Geometry Cluster
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.1, 1, 6);
    const leafGeo = new THREE.SphereGeometry(0.3, 8, 8);
    
    for (let i = 0; i < count; i++) {
        const pGroup = new THREE.Group();
        
        // Jittered Placement
        const jX = (Math.random() - 0.5) * 12;
        const jZ = (Math.random() - 0.5) * 12;

        const mat = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });
        
        const stem = new THREE.Mesh(stemGeo, mat);
        stem.position.y = 0.5;
        pGroup.add(stem);

        const leaf1 = new THREE.Mesh(leafGeo, mat);
        leaf1.position.set(0.2, 0.8, 0);
        leaf1.scale.set(1.5, 0.5, 1);
        pGroup.add(leaf1);

        const leaf2 = new THREE.Mesh(leafGeo, mat);
        leaf2.position.set(-0.2, 0.6, 0.1);
        leaf2.scale.set(1.5, 0.5, 1);
        pGroup.add(leaf2);

        pGroup.position.set(centerX + jX, 0.81, centerZ + jZ);
        pGroup.rotation.y = Math.random() * Math.PI;
        pGroup.scale.set(0.1, 0.1, 0.1); // Start small for growth animation
        pGroup.castShadow = true;
        
        _scene.add(pGroup);
        zone.plants.push(pGroup);
        // Tag materials for color shifting
        pGroup.material = mat; 
    }
}

function _handleCanvasClick(e) {
    const rect = _renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    _raycaster.setFromCamera({ x, y }, _camera);
    const intersects = _raycaster.intersectObjects(_zones.map(z => z.mesh));

    if (intersects.length > 0) {
        const hit = intersects[0].object;
        const zoneId = hit.userData.zoneId;
        _selectZone(zoneId);
    } else {
        _hidePanel();
    }
}

function _selectZone(id) {
    _selectedZoneId = id;
    const zone = _zones.find(z => z.id === id);
    if (!zone) return;

    const panel = document.getElementById('zone-side-panel');
    panel.classList.add('active');

    document.getElementById('panel-zone-name').textContent = zone.name;
    document.getElementById('panel-crop-type').textContent = zone.crop;
    
    _updateUI();
    
    // Highlight Mesh
    _zones.forEach(z => {
        z.mesh.material.emissive.setHex(z.id === id ? 0x1e3a8a : 0x000000);
    });
}

function _hidePanel() {
    _selectedZoneId = null;
    document.getElementById('zone-side-panel').classList.remove('active');
    _zones.forEach(z => z.mesh.material.emissive.setHex(0x000000));
}

function _setWeather(type) {
    _weather = type;
    document.getElementById('btn-sun').classList.toggle('active', type === 'sunny');
    document.getElementById('btn-rain').classList.toggle('active', type === 'rain');
    
    // Light changes
    const targetIntensity = type === 'rain' ? 0.4 : 1.2;
    const targetColor = type === 'rain' ? new THREE.Color(0x94a3b8) : new THREE.Color(0xfff1e0);
    
    // Find sun light in scene
    _scene.children.forEach(l => {
        if (l.type === 'DirectionalLight') {
            l.intensity = targetIntensity;
            l.color.copy(targetColor);
        }
    });

    if (type === 'rain') {
        _createRainSystem();
        showToast('System Weather Updated: Precipitation active', 'info');
    } else {
        _removeRainSystem();
    }
}

let _rainSystem = null;
function _createRainSystem() {
    const THREE = window.THREE;
    const rainCount = 1000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount * 3; i+=3) {
        positions[i] = (Math.random() - 0.5) * 100;
        positions[i+1] = Math.random() * 60;
        positions[i+2] = (Math.random() - 0.5) * 100;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.1, transparent: true, opacity: 0.5 });
    _rainSystem = new THREE.Points(geometry, material);
    _scene.add(_rainSystem);
}

function _removeRainSystem() {
    if (_rainSystem) {
        _scene.remove(_rainSystem);
        _rainSystem.geometry.dispose();
        _rainSystem.material.dispose();
        _rainSystem = null;
    }
}

function _animateRain(delta) {
    if (!_rainSystem) return;
    const positions = _rainSystem.geometry.attributes.position.array;
    for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= 40 * delta;
        if (positions[i] < 0) positions[i] = 60;
    }
    _rainSystem.geometry.attributes.position.needsUpdate = true;
}

function _runSimulationStep() {
    _simTime += 1;
    _zones.forEach(z => {
        // Water Logic
        if (_weather === 'rain') {
            z.water = Math.min(1, z.water + 0.02);
        } else {
            z.water = Math.max(0, z.water - 0.005);
        }

        // Growth Logic
        const growthFactor = (z.water > 0.3 && z.water < 0.8) ? 0.002 : 0.0005;
        z.growth = Math.min(1, z.growth + growthFactor);

        // Health Logic
        if (z.water < 0.15 || z.water > 0.9) {
            z.health = Math.max(0, z.health - 0.01);
        } else {
            z.health = Math.min(1, z.health + 0.005);
        }
    });
}

function _irrigateSelected() {
    if (!_selectedZoneId) return;
    const zone = _zones.find(z => z.id === _selectedZoneId);
    if (!zone) return;

    zone.water = Math.min(1, zone.water + 0.2);
    showToast(`Irrigation active in ${zone.name}`, 'success');
}

function _changeCropSelected() {
    if (!_selectedZoneId) return;
    const zone = _zones.find(z => z.id === _selectedZoneId);
    if (!zone) return;

    const crops = ['Tomato', 'Wheat', 'Lettuce', 'Berry', 'Kale'];
    const currentIdx = crops.indexOf(zone.crop);
    zone.crop = crops[(currentIdx + 1) % crops.length];
    
    document.getElementById('panel-crop-type').textContent = zone.crop;
    showToast(`${zone.name} switched to ${zone.crop}`, 'info');

    // Visual Refresh
    zone.plants.forEach(p => _scene.remove(p));
    zone.plants = [];
    
    const x = (zone.id === 'A' || zone.id === 'C') ? -10 : 10;
    const z = (zone.id === 'A' || zone.id === 'B') ? -10 : 10;
    _populatePlants(zone, x, z);
}

function _updateUI() {
    // Global Header
    const avgHealth = Math.round(_zones.reduce((s, z) => s + z.health, 0) / _zones.length * 100);
    document.getElementById('global-health').textContent = `${avgHealth}%`;
    
    const h = Math.floor(_simTime / 3600).toString().padStart(2, '0');
    const m = Math.floor((_simTime % 3600) / 60).toString().padStart(2, '0');
    const s = (_simTime % 60).toString().padStart(2, '0');
    document.getElementById('sim-time').textContent = `${h}:${m}:${s}`;

    // Panel
    if (_selectedZoneId) {
        const z = _zones.find(zone => zone.id === _selectedZoneId);
        document.getElementById('val-growth').textContent = `${Math.round(z.growth * 100)}%`;
        document.getElementById('val-water').textContent = `${Math.round(z.water * 100)}%`;
        document.getElementById('val-health').textContent = `${Math.round(z.health * 100)}%`;
        
        document.getElementById('bar-growth').style.width = `${z.growth * 100}%`;
        document.getElementById('bar-water').style.width = `${z.water * 100}%`;
        document.getElementById('bar-health').style.width = `${z.health * 100}%`;
    }
}

async function _loadScript(url) {
    if (document.querySelector(`script[src="${url}"]`)) return;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
