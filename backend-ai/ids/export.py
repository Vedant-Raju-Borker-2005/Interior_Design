"""Workflow 3 — single-file interactive 3D HTML assembly."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def assemble_html(
    out_path: str | Path,
    catalog: Any,
    variants: dict[str, Any],
    textures: dict[str, Any] | str | Path,
    model: dict[str, Any],
    viewer_js: str | Path | None = None,
    defaults: dict[str, Any] | None = None,
) -> Path:
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    if isinstance(textures, (str, Path)):
        tp = Path(textures)
        tex_data = json.loads(tp.read_text(encoding="utf-8")) if tp.exists() else {"maps": {}}
    else:
        tex_data = textures

    app_data = {
        "variants": variants,
        "textures": tex_data,
        "model": model,
        "defaults": defaults or {},
    }
    json_blob = json.dumps(app_data, separators=(",", ":"))

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Automated Interior Design System — 3D Scene Viewer</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; overflow: hidden; height: 100vh; display: flex; }}
    #viewport {{ flex: 1; height: 100vh; position: relative; }}
    #sidebar {{ width: 380px; background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(16px); border-right: 1px solid #334155; height: 100vh; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; z-index: 10; }}
    .badge {{ display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: #1e293b; color: #38bdf8; border: 1px solid #0284c7; }}
    h1 {{ font-size: 20px; font-weight: 700; color: #f1f5f9; }}
    .card {{ background: #1e293b; border-radius: 12px; padding: 16px; border: 1px solid #334155; }}
    .card-title {{ font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 8px; font-weight: 700; }}
    .price-value {{ font-size: 28px; font-weight: 800; color: #38bdf8; }}
    .palette-swatches {{ display: flex; gap: 8px; margin-top: 8px; }}
    .swatch {{ width: 32px; height: 32px; border-radius: 6px; border: 2px solid #475569; }}
    .item-list {{ display: flex; flex-direction: column; gap: 8px; max-height: 240px; overflow-y: auto; }}
    .item-row {{ display: flex; justify-content: space-between; font-size: 13px; padding: 6px 8px; background: #0f172a; border-radius: 6px; }}
    .recs-badge {{ background: #064e3b; color: #34d399; padding: 2px 6px; border-radius: 4px; font-size: 11px; }}
    #hint {{ position: absolute; bottom: 20px; left: 20px; background: rgba(15, 23, 42, 0.75); padding: 8px 14px; border-radius: 8px; font-size: 12px; color: #94a3b8; pointer-events: none; }}
  </style>
</head>
<body>
  <div id="sidebar">
    <div>
      <span class="badge">Workflow 3 Delivery</span>
      <h1 style="margin-top: 8px;">Automated Interior Design</h1>
      <p style="font-size: 13px; color: #94a3b8; margin-top: 4px;" id="brief-line">3 BHK · Luxury · Mumbai</p>
    </div>

    <div class="card">
      <div class="card-title">Predicted Investment</div>
      <div class="price-value" id="price-display">₹0</div>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Client-side tree-evaluated estimate</div>
    </div>

    <div class="card">
      <div class="card-title">Color Palette</div>
      <div class="palette-swatches" id="palette-swatches">
        <div class="swatch" style="background: #f8fafc;" title="Dominant"></div>
        <div class="swatch" style="background: #334155;" title="Secondary"></div>
        <div class="swatch" style="background: #d97706;" title="Accent"></div>
      </div>
    </div>

    <div class="card" style="flex: 1; display: flex; flex-direction: column;">
      <div class="card-title">Placed Scene Objects</div>
      <div class="item-list" id="object-list"></div>
    </div>
  </div>

  <div id="viewport">
    <div id="hint">Left click + drag to Orbit · Right click to Pan · Scroll to Zoom</div>
  </div>

  <script>
    const DATA = {json_blob};

    // Initialize UI
    const defs = DATA.defaults || {{}};
    document.getElementById("brief-line").innerText = `${{defs.bhk || "2 BHK"}} · ${{defs.style || "Modern"}} · ${{defs.city || "Mumbai"}}`;

    // Locate active variant scene
    const varKey = `${{defs.bhk || "2 BHK"}}|${{defs.quality || "Standard"}}`;
    let activeVariant = DATA.variants[varKey] || Object.values(DATA.variants)[0];
    const sceneData = activeVariant ? activeVariant.scene : {{ rooms: [], objects: [] }};

    // Populate objects
    const objListEl = document.getElementById("object-list");
    (sceneData.objects || []).forEach(o => {{
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `<span>${{o.category}}</span><span style="color:#64748b;">${{o.room_id}}</span>`;
      objListEl.appendChild(row);
    }});

    // Client-side tree evaluation for Price Parity
    function evalPrice(exported, items, bhk, style, tier, city) {{
      if (!exported || !exported.trees) return 1250000;
      let y = exported.init || 0;
      const x = [];
      const present = new Set(items);
      const rows = exported.catalog || [];
      const byCat = {{}};
      (DATA.model.catalog || []).forEach(r => byCat[r.category] = r);

      let base = 0, foot = 0;
      present.forEach(cat => {{
        if (byCat[cat]) {{
          base += byCat[cat].base_price || 0;
          foot += byCat[cat].footprint || 0;
        }}
      }});

      const tierIdx = (exported.tiers || []).indexOf(tier);
      const styleIdx = (exported.styles || []).indexOf(style);
      const cityMult = (exported.city_mult || {{}})[city] || 1.0;

      x.push(present.size, bhk, tierIdx >= 0 ? tierIdx : 1, cityMult, styleIdx >= 0 ? styleIdx : 0, foot, base, Math.log1p(base));
      (DATA.model.catalog || []).forEach(r => {{
        x.push(present.has(r.category) ? 1.0 : 0.0);
      }});

      for (const t of exported.trees) {{
        let n = 0;
        while (t.left[n] !== -1) {{
          n = (x[t.feature[n]] <= t.threshold[n]) ? t.left[n] : t.right[n];
        }}
        y += exported.lr * t.value[n];
      }}
      return exported.log_target ? Math.exp(y) : y;
    }}

    const activeCats = (sceneData.objects || []).map(o => o.category);
    const est = evalPrice(DATA.model.price, activeCats, parseInt(defs.bhk) || 2, defs.style || "Modern", defs.quality || "Standard", defs.city || "Mumbai");
    document.getElementById("price-display").innerText = "₹" + Math.round(est).toLocaleString("en-IN");

    // Three.js 3D Viewport Setup
    const container = document.getElementById("viewport");
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(7, 8, 10);

    const renderer = new THREE.WebGLRenderer({{ antialias: true }});
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(3, 0, 2);
    controls.update();

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(6, 12, 8);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Floor and Rooms
    const floorMat = new THREE.MeshStandardMaterial({{ color: 0x334155, roughness: 0.8 }});
    (sceneData.rooms || []).forEach(r => {{
      const [rx, ry, rw, rd] = r.rect;
      const geom = new THREE.BoxGeometry(rw, 0.1, rd);
      const mesh = new THREE.Mesh(geom, floorMat);
      mesh.position.set(rx + rw/2, -0.05, ry + rd/2);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }});

    // Furniture Objects
    const furnMat = new THREE.MeshStandardMaterial({{ color: 0x38bdf8, roughness: 0.4, metalness: 0.2 }});
    (sceneData.objects || []).forEach(o => {{
      const w = o.dimensions.width || 1;
      const d = o.dimensions.depth || 1;
      const h = o.dimensions.height || 0.8;
      const geom = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geom, furnMat);
      mesh.position.set(o.position.x, h/2, o.position.z);
      mesh.rotation.y = (o.rotation.yaw || 0) * (Math.PI / 180);
      mesh.castShadow = true;
      scene.add(mesh);
    }});

    window.addEventListener("resize", () => {{
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }});

    function animate() {{
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }}
    animate();
  </script>
</body>
</html>"""

    out.write_text(html_content, encoding="utf-8")
    return out
