/**
 * AR preview (basic) — camera kholo, product ki photo overlay mein dekho.
 *
 * Full AR (plane detection) ke liye native app chahiye hoti hai; web par
 * ye simple version hai: live camera feed par product image drag/resize
 * karke andaza lagao ke ghar mein kaisa lagega.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera, Move, ZoomIn, ZoomOut } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export function ArPreview({
  image,
  productName,
  onClose,
}: {
  image: string;
  productName: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState(false);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        setError(true);
      }
    })();
    return () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  // Image ko ungli/mouse se drag karo
  function onPointerDown(e: React.PointerEvent) {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setPos({
      x: dragStart.current.px + (e.clientX - dragStart.current.x),
      y: dragStart.current.py + (e.clientY - dragStart.current.y),
    });
  }
  function onPointerUp() {
    setDragging(false);
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex items-center justify-between bg-black/60 px-4 py-3 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Camera size={16} /> {t.ar.title}
        </p>
        <button
          onClick={onClose}
          aria-label={t.ar.close}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
        >
          <X size={18} />
        </button>
      </div>

      {/* Camera + overlay */}
      <div
        className="relative flex-1 touch-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {error ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-white/70">
            {t.ar.cameraDenied}
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* Product overlay — drag + resize */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={productName}
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 max-h-[60%] select-none rounded-xl shadow-2xl"
          style={{
            width: `${220 * scale}px`,
            transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
            opacity: 0.92,
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 bg-black/60 px-4 py-4 text-white">
        <Move size={16} className="text-white/60" />
        <span className="text-xs text-white/60">{t.ar.dragHint}</span>
        <button
          onClick={() => setScale((s) => Math.max(0.4, s - 0.15))}
          aria-label={t.ar.smaller}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
          aria-label={t.ar.bigger}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
        >
          <ZoomIn size={18} />
        </button>
      </div>
    </div>
  );
}
