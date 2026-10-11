/**
 * Ar3DView — 3D AR preview for the product page.
 *
 * Replaces the old 2D-photo AR overlay. Renders the real 3D model
 * (same templates as the 3D viewer) over a live camera feed, or over
 * a photo the customer uploads. Drag to place, pinch/scroll to resize,
 * finish variants included.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { X, Camera, ImagePlus, RotateCcw } from "lucide-react";
import { buildModel } from "@/lib/three/models";
import { useLanguage } from "@/lib/i18n";

const FINISHES = {
  black: { color: 0x1b1b1d, roughness: 0.42, label: "Matte Black" },
  gold: { color: 0xcfa14a, roughness: 0.28, label: "Golden" },
  steel: { color: 0xb9b9c0, roughness: 0.34, label: "Steel" },
} as const;

type FinishKey = keyof typeof FINISHES;

export function Ar3DView({
  templateId,
  productName,
  onClose,
}: {
  templateId: string;
  productName: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const apiRef = useRef<{
    setFinish: (f: FinishKey) => void;
    setScale: (s: number) => void;
    reset: () => void;
    toggleRotate: () => void;
    getScale: () => number;
  } | null>(null);

  const [mode, setMode] = useState<"camera" | "photo">("camera");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [camError, setCamError] = useState(false);
  const [finish, setFinishState] = useState<FinishKey>("black");
  const [rotating, setRotating] = useState(true);
  const [, setScalePct] = useState(100);

  const v = t.ar;

  // camera lifecycle
  useEffect(() => {
    if (mode !== "camera") {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) setCamError(true);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, [mode]);

  // three.js scene — transparent canvas over camera/photo
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText =
      "width:100%;height:100%;display:block;touch-action:none;cursor:grab;";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);

    const rig = new THREE.Group();
    scene.add(rig);
    const model = buildModel(templateId);
    if (model) rig.add(model);

    const box = new THREE.Box3().setFromObject(rig);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);

    camera.position.set(center.x, center.y + maxDim * 0.6, center.z + maxDim * 2.6);
    camera.lookAt(center);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(center.x + 8, center.y + 14, center.z + 10);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(center.x - 10, center.y + 4, center.z - 6);
    scene.add(fill);

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

    // drag = move in screen space, pinch/wheel = resize
    const pts = new Map<number, { x: number; y: number }>();
    let lastPinch = 0;
    const wpp = () =>
      (2 * camera.position.distanceTo(center) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
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
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) {
        const k = wpp();
        rig.position.x = THREE.MathUtils.clamp(rig.position.x + dx * k, -maxDim * 3, maxDim * 3);
        rig.position.y = THREE.MathUtils.clamp(rig.position.y - dy * k, -maxDim * 3, maxDim * 3);
      } else if (pts.size === 2) {
        const a = Array.from(pts.values());
        const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (lastPinch > 0 && d > 0) setScale(scale * (lastPinch / d));
        lastPinch = d;
      }
    };
    const onUp = (e: PointerEvent) => { pts.delete(e.pointerId); lastPinch = 0; };
    const onWheel = (e: WheelEvent) => {
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
      setFinish: (f) => { applyFinish(f); setFinishState(f); },
      setScale,
      reset: () => { rig.position.set(0, 0, 0); setScale(1); },
      toggleRotate: () => {
        rotatingOn = !rotatingOn;
        setRotating(rotatingOn);
      },
      getScale: () => scale,
    };

    function resize() {
      const w = mount?.clientWidth ?? 0, h = mount?.clientHeight ?? 0;
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
      if (rotatingOn) rig.rotation.y += 0.008;
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
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      apiRef.current = null;
    };
  }, [templateId]);

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    const url = URL.createObjectURL(f);
    setPhotoUrl(url);
    setMode("photo");
  }

  function backToCamera() {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setCamError(false);
    setMode("camera");
  }

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black">
      {/* top bar */}
      <div className="flex items-center justify-between bg-black/60 px-4 py-3 text-white">
        <p className="text-sm font-semibold">{v.title3d ?? "3D AR Preview"}</p>
        <button
          onClick={onClose}
          aria-label={v.close}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
        >
          <X size={18} />
        </button>
      </div>

      {/* stage: camera or photo + 3D overlay */}
      <div className="relative flex-1 overflow-hidden">
        {mode === "camera" ? (
          camError ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-white/70">
              {v.cameraDenied}
            </div>
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
            />
          )
        ) : (
          photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={productName}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )
        )}
        {/* 3D model overlay */}
        <div ref={mountRef} className="absolute inset-0" />
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-4 py-1.5 text-xs text-white/85 backdrop-blur">
          {v.dragHint3d ?? "3D product ko drag karke rakho"}
        </div>
      </div>

      {/* finish selector */}
      <div className="flex gap-2 bg-black/60 px-4 pt-3">
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

      {/* controls */}
      <div className="flex items-center justify-center gap-2 bg-black/60 px-4 py-4 text-white">
        <button
          onClick={() => (mode === "camera" ? photoInputRef.current?.click() : backToCamera())}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/15 py-2.5 text-sm font-bold hover:bg-white/25"
        >
          {mode === "camera" ? <ImagePlus size={16} /> : <Camera size={16} />}
          {mode === "camera" ? (v.usePhoto ?? "Photo upload karo") : (v.useCamera ?? "Camera")}
        </button>
        <button
          onClick={() => apiRef.current?.toggleRotate()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          aria-label="rotate"
        >
          <RotateCcw size={18} className={rotating ? "animate-[spin_3s_linear_infinite]" : ""} />
        </button>
        <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={onPhoto} />
      </div>
    </div>
  );
}
