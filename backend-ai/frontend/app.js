// IDS Studio — Frontend Controller & Three.js 3D Visualizer

let scene, camera, renderer, controls;
let currentFurnitureMeshes = [];
let currentRoomMeshes = [];
let currentDesignData = null;

// Initialize Three.js Stage
function initThree() {
  const container = document.getElementById("canvas-container");
  if (!container) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090d16);
  scene.fog = new THREE.FogExp2(0x090d16, 0.035);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(7, 8, 9);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(2.5, 0, 2);
  controls.maxPolarAngle = Math.PI / 2.05; // Don't go below floor
  controls.update();

  // Subtle studio lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambient);

  const mainLight = new THREE.DirectionalLight(0xfff8ed, 0.85);
  mainLight.position.set(8, 14, 6);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 1024;
  mainLight.shadow.mapSize.height = 1024;
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 25;
  mainLight.shadow.bias = -0.0005;
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.3);
  fillLight.position.set(-6, 8, -6);
  scene.add(fillLight);

  // Subtle ground grid
  const grid = new THREE.GridHelper(24, 24, 0x1e293b, 0x0f172a);
  grid.position.y = -0.01;
  scene.add(grid);

  window.addEventListener("resize", onWindowResize);
  animate();
}

function onWindowResize() {
  const container = document.getElementById("canvas-container");
  if (!container || !renderer || !camera) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

// Render Rooms & Furniture Objects in 3D
function renderScene(sceneData, palette) {
  // Clear previous meshes
  currentFurnitureMeshes.forEach(m => scene.remove(m));
  currentRoomMeshes.forEach(m => scene.remove(m));
  currentFurnitureMeshes = [];
  currentRoomMeshes = [];

  const rooms = sceneData.rooms || [];
  const objects = sceneData.objects || [];

  // Room floor plates
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.7,
    metalness: 0.1,
  });

  rooms.forEach(r => {
    const [rx, ry, rw, rd] = r.rect;
    const geom = new THREE.BoxGeometry(rw, 0.08, rd);
    const mesh = new THREE.Mesh(geom, floorMat);
    mesh.position.set(rx + rw / 2, -0.04, ry + rd / 2);
    mesh.receiveShadow = true;
    scene.add(mesh);
    currentRoomMeshes.push(mesh);

    // Wall edges wireframe
    const edges = new THREE.EdgesGeometry(geom);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 2 }));
    line.position.copy(mesh.position);
    scene.add(line);
    currentRoomMeshes.push(line);
  });

  // Color mapping per furniture category
  const categoryColors = {
    bed: 0x3b82f6,
    sofa: 0x06b6d4,
    coffee_table: 0x8b5cf6,
    media_console: 0x64748b,
    dining_set: 0x10b981,
    wardrobe: 0x475569,
    nightstand: 0x38bdf8,
    desk: 0x0284c7,
    chair: 0x059669,
    sideboard: 0xd97706,
  };

  objects.forEach(o => {
    const w = (o.dimensions && o.dimensions.width) || 1.0;
    const d = (o.dimensions && o.dimensions.depth) || 1.0;
    const h = (o.dimensions && o.dimensions.height) || 0.8;

    const geom = new THREE.BoxGeometry(w, h, d);
    const col = categoryColors[o.category] || 0x38bdf8;
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.35,
      metalness: 0.25,
    });

    const mesh = new THREE.Mesh(geom, mat);
    const px = (o.position && o.position.x) || 0;
    const pz = (o.position && o.position.z) || 0;
    mesh.position.set(px, h / 2, pz);

    const yaw = (o.rotation && o.rotation.yaw) || 0;
    mesh.rotation.y = yaw * (Math.PI / 180);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Edge highlight for a premium CAD look
    const edges = new THREE.EdgesGeometry(geom);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }));
    mesh.add(line);

    scene.add(mesh);
    currentFurnitureMeshes.push(mesh);
  });

  // Focus camera smoothly on center of objects
  if (objects.length > 0) {
    const avgX = objects.reduce((sum, o) => sum + o.position.x, 0) / objects.length;
    const avgZ = objects.reduce((sum, o) => sum + o.position.z, 0) / objects.length;
    if (controls) {
      controls.target.set(avgX, 0, avgZ);
      controls.update();
    }
  }
}

// Fetch and Execute AI Design Generation
async function generateDesign() {
  const btn = document.getElementById("btn-generate");
  const spinner = document.getElementById("btn-spinner");
  const btnText = document.getElementById("btn-text");

  // Read form state
  const activeBhkBtn = document.querySelector(".segment-btn.active");
  const bhk = activeBhkBtn ? activeBhkBtn.getAttribute("data-value") : "3 BHK";

  const activeStyleCard = document.querySelector(".style-card.active");
  const style = activeStyleCard ? activeStyleCard.getAttribute("data-style") : "Luxury";

  const city = document.getElementById("city-select").value;
  const budget = document.getElementById("budget-select").value;
  const wood = document.getElementById("wood-select").value;
  const quality = document.getElementById("quality-select").value;

  const activeChips = Array.from(document.querySelectorAll(".palette-chips .chip.active")).map(el => el.getAttribute("data-color"));
  const colors = activeChips.length > 0 ? activeChips : ["Off White", "Charcoal Grey", "Champagne Gold"];

  // Loading state
  btn.disabled = true;
  spinner.style.display = "block";
  btnText.innerText = "Solving Spatial Layout...";

  try {
    const response = await fetch("/design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bhk,
        style,
        city,
        budget,
        wood,
        quality,
        colors,
        solve: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    currentDesignData = data;

    // Update UI Stats
    document.getElementById("quote-price").innerText = "₹" + Number(data.price).toLocaleString("en-IN");
    const delta = data.price_with_recommendations - data.price;
    document.getElementById("quote-price-rec").innerText = delta > 0
      ? `+ ₹${Number(delta).toLocaleString("en-IN")} with recommended basket`
      : "Complete matching package";

    document.getElementById("feasibility-badge").innerHTML = data.feasible
      ? '<span class="badge-dot"></span> Feasible · 0 Collisions'
      : `<span class="badge-dot" style="background:#ef4444"></span> ${data.violations.length} Violations`;

    document.getElementById("objects-count-badge").innerText = `${data.scene.objects.length} Objects Placed`;
    document.getElementById("tier-badge").innerText = `${data.tier} Tier`;

    // Render 3D Scene
    renderScene(data.scene, data.palette);

    // Update Recommendations Row
    renderRecommendations(data.recommendations);
  } catch (err) {
    console.error("Design generation failed:", err);
    alert("Spatial solver error: " + err.message);
  } finally {
    btn.disabled = false;
    spinner.style.display = "none";
    btnText.innerText = "Generate AI Design";
  }
}

// Render Recommendations Cards
function renderRecommendations(recs) {
  const container = document.getElementById("recs-grid");
  container.innerHTML = "";

  if (!recs || recs.length === 0) {
    container.innerHTML = '<span style="font-size:12px; color:#64748b;">No further add-ons required.</span>';
    return;
  }

  recs.forEach(r => {
    const card = document.createElement("div");
    card.className = "rec-card";
    const rule = r.rule || {};
    const lift = rule.lift ? `${rule.lift.toFixed(1)}x lift` : "High match";
    const conf = rule.confidence ? `${Math.round(rule.confidence * 100)}% conf` : "Recommended";
    const styleFit = r.style_fit ? `${Math.round(r.style_fit * 100)}% style fit` : "";

    card.innerHTML = `
      <div class="rec-header">
        <span class="rec-category">${r.category.replace("_", " ")}</span>
        <span class="rec-badge">+ Add</span>
      </div>
      <div class="rec-stats">
        <span>${conf}</span>
        <span>${lift}</span>
      </div>
      <div style="font-size:10px; color:#38bdf8; margin-top:2px;">${styleFit}</div>
    `;

    card.addEventListener("click", () => {
      card.classList.toggle("added");
      const badge = card.querySelector(".rec-badge");
      badge.innerText = card.classList.contains("added") ? "✓ Added" : "+ Add";
    });

    container.appendChild(card);
  });
}

// Bind UI Listeners
function setupListeners() {
  // BHK Segment Buttons
  document.querySelectorAll(".segment-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".segment-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Style Cards
  document.querySelectorAll(".style-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".style-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
    });
  });

  // Palette Chips Toggle
  document.querySelectorAll(".palette-chips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      chip.classList.toggle("active");
    });
  });

  // Generate Button Click
  document.getElementById("btn-generate").addEventListener("click", generateDesign);

  // View Tabs (3D vs 2D)
  const tab3d = document.getElementById("tab-3d");
  const tab2d = document.getElementById("tab-2d");
  const canvasCont = document.getElementById("canvas-container");
  const floorplanCont = document.getElementById("floorplan-container");

  tab3d.addEventListener("click", () => {
    tab3d.classList.add("active");
    tab2d.classList.remove("active");
    canvasCont.style.display = "block";
    floorplanCont.style.display = "none";
    if (renderer) onWindowResize();
  });

  tab2d.addEventListener("click", () => {
    tab2d.classList.add("active");
    tab3d.classList.remove("active");
    canvasCont.style.display = "none";
    floorplanCont.style.display = "flex";

    // Populate SVG if available
    const svgTarget = document.getElementById("floorplan-svg-target");
    if (currentDesignData && currentDesignData.scene) {
      // Basic 2D representation
      const rooms = currentDesignData.scene.rooms || [];
      const rects = rooms.map(r => `
        <rect x="${r.rect[0] * 60 + 20}" y="${r.rect[1] * 60 + 20}" width="${r.rect[2] * 60}" height="${r.rect[3] * 60}" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
        <text x="${r.rect[0] * 60 + 30}" y="${r.rect[1] * 60 + 40}" font-family="sans-serif" font-size="12" fill="#64748b">${r.label}</text>
      `).join("");
      const objs = currentDesignData.scene.objects.map(o => `
        <rect x="${o.position.x * 60 + 20 - 20}" y="${o.position.z * 60 + 20 - 15}" width="40" height="30" fill="#38bdf8" stroke="#0284c7" rx="3" opacity="0.8"/>
        <text x="${o.position.x * 60 + 20}" y="${o.position.z * 60 + 20}" font-family="sans-serif" font-size="9" fill="#0f172a" text-anchor="middle">${o.category}</text>
      `).join("");
      svgTarget.innerHTML = `<svg viewBox="0 0 550 400" width="550" height="400">${rects}${objs}</svg>`;
    }
  });
}

// Initial Boot
window.addEventListener("DOMContentLoaded", () => {
  initThree();
  setupListeners();
  generateDesign(); // Initial solve on load
});
