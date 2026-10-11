/**
 * Product3DViewer — interactive 3D product viewer for the product page.
 *
 * Shown only when the admin enables "3D view" for the product and picks a
 * matching 3D model template. Features: drag to rotate, scroll to zoom,
 * finish variants, and "try on your photo" (place the product on a photo
 * of the customer's own cabinet/door).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { X, RotateCcw, Camera, Plus, Minus } from "lucide-react";
import { buildModel } from "@/lib/three/models";
import { useLanguage } from "@/lib/i18n";

const FINISHES = {
  black: { color: 0x1b1b1d, roughness: 0.42, label: "Matte Black" },
  gold: { color: 0xcfa14a, roughness: 0.28, label: "Golden" },
  steel: { color: 0xb9b9c0, roughness: 0.34, label: "Steel" },
} as const;

type FinishKey = keyof typeof FINISHES;

export function Product3DViewer({
  templateId,
}: {
  templateId: string;
}) {
  const { t } = useLanguage();
  const mountRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const apiRef = useRef<{
    setFinish: (f: FinishKey) => void;
    setPhoto: (url: string | null) => void;
    setPlacing: (v: boolean) => void;
    setScale: (s: number) => void;
    toggleSecond: () => void;
    reset: () => void;
    toggleRotate: () => void;
    getState: () => { placing: boolean; second: boolean; rotating: boolean; scale: number };
  } | null>(null);

  const [finish, setFinishState] = useState<FinishKey>("black");
  const [placing, setPlacingState] = useState(false);
  const [hasSecond, setHasSecond] = useState(false);
  const [rotating, setRotating] = useState(true);
  const [scalePct, setScalePct] = useState(100);
  const [open, setOpen] = useState(false);

  const v = t.viewer3d;

  useEffect(() => {
    if (!open || !mountRef.current) return;
    const mount = mountRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText =
      "width:100%;height:100%;display:block;touch-action:none;cursor:grab;";

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);

    // rig holds the model(s); place-mode drag/scale moves the rig
    const rig = new THREE.Group();
    scene.add(rig);
    const model = buildModel(templateId);
    if (model) rig.add(model);

    // auto-frame from bounding box
    const box = new THREE.Box3().setFromObject(rig);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const homeDist = maxDim * 2.6;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = maxDim * 1.1;
    controls.maxDistance = maxDim * 8;
    controls.target.copy(center);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.6;
    const homePos = new THREE.Vector3(
      center.x + homeDist * 0.5,
      center.y + homeDist * 0.28,
      center.z + homeDist * 0.85
    );
    camera.position.copy(homePos);

    // lights
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(center.x + 10, center.y + 16, center.z + 12);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = maxDim * 1.2;
    key.shadow.camera.left = -sc; key.shadow.camera.right = sc;
    key.shadow.camera.top = sc; key.shadow.camera.bottom = -sc;
    scene.add(key);
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(maxDim * 8, maxDim * 8),
      new THREE.ShadowMaterial({ opacity: 0.28 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = box.min.y - 0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // ---- state ----
    let placingMode = false;
    let second: THREE.Group | null = null;
    let scale = 1;
    let rotatingOn = true;
    const listeners: (() => void)[] = [];

    function applyFinish(f: FinishKey) {
      const def = FINISHES[f];
      rig.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          const m = mesh.material as THREE.MeshPhysicalMaterial;
          if (m && typeof m.metalness === "number" && m.metalness >= 0.9) {
            m.color.setHex(def.color);
            m.roughness = def.roughness;
          }
        }
      });
    }

    function setScale(s: number) {
      scale = THREE.MathUtils.clamp(s, 0.4, 2.5);
      rig.scale.setScalar(scale);
      setScalePct(Math.round(scale * 100));
    }

    // place-mode drag: move rig in screen space
    const pts = new Map<number, { x: number; y: number }>();
    let lastPinch = 0;
    const wpp = () =>
      (2 * controls.getDistance() * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
      renderer.domElement.clientHeight;
    const onDown = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const a = Array.from(pts.values());
        lastPinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p || !placingMode) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) {
        const k = wpp();
        rig.position.x = THREE.MathUtils.clamp(rig.position.x + dx * k, -maxDim * 2, maxDim * 2);
        rig.position.y = THREE.MathUtils.clamp(rig.position.y - dy * k, -maxDim * 1.6, maxDim * 1.6);
      } else if (pts.size === 2) {
        const a = Array.from(pts.values());
        const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (lastPinch > 0 && d > 0) setScale(scale * (lastPinch / d));
        lastPinch = d;
      }
    };
    const onUp = (e: PointerEvent) => { pts.delete(e.pointerId); lastPinch = 0; };
    const onWheel = (e: WheelEvent) => {
      if (!placingMode) return;
      e.preventDefault();
      setScale(scale * (1 - Math.sign(e.deltaY) * 0.08));
    };
    const el = renderer.domElement;
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    apiRef.current = {
      setFinish: (f: FinishKey) => { applyFinish(f); setFinishState(f); },
      setPhoto: (url: string | null) => {
        (mount.parentElement as HTMLElement).style.backgroundImage = url ? `url("${url}")` : "";
      },
      setPlacing: (val: boolean) => {
        placingMode = val;
        controls.enabled = !val;
        controls.autoRotate = !val && rotatingOn;
        if (!val) { rig.position.set(0, 0, 0); }
        setPlacingState(val);
      },
      setScale,
      toggleSecond: () => {
        if (second) {
          rig.remove(second); second = null; setHasSecond(false);
        } else if (model) {
          second = model.clone();
          second.position.x = size.x * 1.6;
          rig.add(second); setHasSecond(true);
        }
      },
      reset: () => {
        camera.position.copy(homePos);
        controls.target.copy(center);
        rig.position.set(0, 0, 0);
        setScale(1);
      },
      toggleRotate: () => {
        rotatingOn = !rotatingOn;
        controls.autoRotate = rotatingOn && !placingMode;
        setRotating(rotatingOn);
      },
      getState: () => ({ placing: placingMode, second: !!second, rotating: rotatingOn, scale }),
    };

    function resize() {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);
    listeners.push(() => window.removeEventListener("resize", resize));

    let raf = 0;
    (function tick() {
      raf = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    })();

    return () => {
      cancelAnimationFrame(raf);
      listeners.forEach((fn) => fn());
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      pmrem.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      apiRef.current = null;
    };
  }, [open, templateId]);

  // photo upload
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    const url = URL.createObjectURL(f);
    setPhotoUrl(url);
    apiRef.current?.setPhoto(url);
    apiRef.current?.setPlacing(true);
  }
  function clearPhoto() {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    apiRef.current?.setPhoto(null);
    apiRef.current?.setPlacing(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#D21F26]/50 bg-[#D21F26]/5 py-4 font-bold text-[#D21F26] transition hover:bg-[#D21F26]/10"
      >
        <RotateCcw size={18} />
        {v.button ?? "3D mein dekho"}
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border bg-black">
      {/* 3D stage */}
      <div className="relative h-[380px] sm:h-[440px] bg-cover bg-center" id="htc-3d-stage">
        <div ref={mountRef} className="absolute inset-0" />
        {placing && (
          <div className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-4 py-1.5 text-xs font-bold text-black shadow">
            {v.placeHint ?? "Product ko drag karke rakho"}
          </div>
        )}
        <button
          onClick={() => { clearPhoto(); setOpen(false); }}
          className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80"
          aria-label={v.close ?? "Close"}
        >
          <X size={18} />
        </button>
        {!placing && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-4 py-1.5 text-xs text-white/80 backdrop-blur">
            {v.dragHint ?? "Drag ghumao • Scroll se zoom"}
          </div>
        )}
      </div>

      {/* controls */}
      <div className="space-y-4 bg-[#141417] p-4 sm:p-5">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
            {v.finish ?? "Finish"}
          </p>
          <div className="flex gap-2">
            {(Object.keys(FINISHES) as FinishKey[]).map((k) => (
              <button
                key={k}
                onClick={() => apiRef.current?.setFinish(k)}
                className={`flex-1 rounded-xl border-2 px-2 py-2 text-xs font-semibold transition ${
                  finish === k
                    ? "border-[#D21F26] text-white"
                    : "border-white/10 text-white/60 hover:border-white/25"
                }`}
              >
                {FINISHES[k].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
            {v.tryOn ?? "Apne ghar par try karo"}
          </p>
          {!placing ? (
            <button
              onClick={() => inputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/20 py-3 text-sm font-bold text-white/90 hover:border-amber-400/60"
            >
              <Camera size={17} /> {v.uploadPhoto ?? "Photo lo / Upload karo"}
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-xs text-white/60">
                  <span>{v.sizeLabel ?? "Size"}</span>
                  <span>{scalePct}%</span>
                </div>
                <input
                  type="range" min={40} max={250} value={scalePct}
                  onChange={(e) => apiRef.current?.setScale(Number(e.target.value) / 100)}
                  className="w-full accent-amber-400"
                />
              </div>
              <div className="flex gap-2">
                {templateId === "bar-handle" && (
                  <button
                    onClick={() => apiRef.current?.toggleSecond()}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white hover:bg-white/15"
                  >
                    {hasSecond ? <Minus size={15} /> : <Plus size={15} />}
                    {v.second ?? "Doosra"}
                  </button>
                )}
                <button
                  onClick={clearPhoto}
                  className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white hover:bg-white/15"
                >
                  {v.removePhoto ?? "Photo hatao"}
                </button>
              </div>
            </div>
          )}
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={onPhoto} />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => apiRef.current?.toggleRotate()}
            className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white hover:bg-white/15"
          >
            ⟳ {rotating ? (v.autoRotateOn ?? "ON") : (v.autoRotateOff ?? "OFF")}
          </button>
          <button
            onClick={() => apiRef.current?.reset()}
            className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white hover:bg-white/15"
          >
            {v.resetView ?? "Reset view"}
          </button>
        </div>
      </div>
    </div>
  );
}
