"use client";

/**
 * Reusable cloud uploader (Vercel Blob via POST /api/upload — see lib/uploads.ts).
 *
 * - <ImageUpload /> : drag & drop zone returning download URLs with live
 *   progress, preview, reorder and delete.
 * - uploadFilesToStorage() : low-level multi-file uploader with per-file
 *   progress callbacks. (Name kept for compatibility; it uploads to Vercel
 *   Blob, not Firebase Storage.)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  uploadFile,
  isUploadsConfigured,
  UPLOADS_NOT_CONFIGURED_MESSAGE,
} from "@/lib/uploads";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UploadCloud, X, ChevronLeft, ChevronRight, ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* --------------------------- low-level uploader --------------------------- */

export interface UploadProgress {
  file: File;
  percent: number;
}

/** Upload files to the cloud; resolves with download URLs in the same order. */
export async function uploadFilesToStorage(
  files: File[],
  folder: string,
  onProgress?: (p: UploadProgress) => void
): Promise<string[]> {
  if (!isUploadsConfigured()) throw new Error(UPLOADS_NOT_CONFIGURED_MESSAGE);
  const uploads = files.map((file) =>
    uploadFile(file, {
      resourceType: "auto",
      folder: `htc-website/${folder}`,
      onProgress: (percent) => onProgress?.({ file, percent }),
    })
  );
  return Promise.all(uploads);
}

/* -------------------------------- component -------------------------------- */

export interface ImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  /** Storage folder, e.g. "products". */
  folder: string;
  multiple?: boolean;
  accept?: string;
  max?: number;
  compact?: boolean;
  label?: string;
  hint?: string;
}

interface PendingFile {
  id: string;
  file: File;
  preview: string;
  percent: number;
}

export default function ImageUpload({
  value,
  onChange,
  folder,
  multiple = true,
  accept = "image/*",
  max = 20,
  compact = false,
  label,
  hint,
}: ImageUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startUpload = useCallback(
    async (files: File[]) => {
      if (!isUploadsConfigured()) {
        toast.error(UPLOADS_NOT_CONFIGURED_MESSAGE, { duration: 6000 });
        return;
      }
      const slot = max - value.length - pending.length;
      const batch = files.slice(0, Math.max(0, slot));
      if (batch.length === 0) {
        toast.warning(`Maximum ${max} files.`);
        return;
      }
      if (busyRef.current) return;
      busyRef.current = true;

      const pendings: PendingFile[] = batch.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
        percent: 0,
      }));
      setPending((prev) => [...prev, ...pendings]);

      try {
        const urls = await uploadFilesToStorage(batch, folder, ({ file, percent }) => {
          setPending((prev) =>
            prev.map((p) => (p.file === file ? { ...p, percent } : p))
          );
        });
        onChange([...value, ...urls]);
        toast.success(`${urls.length} file${urls.length > 1 ? "s" : ""} uploaded.`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Upload failed. Please try again.",
          { duration: 6000 }
        );
      } finally {
        pendings.forEach((p) => URL.revokeObjectURL(p.preview));
        setPending((prev) => prev.filter((p) => !pendings.includes(p)));
        busyRef.current = false;
      }
    },
    [folder, max, onChange, pending.length, value]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      accept === "*/*" ? true : f.type.startsWith(accept.split("/")[0]!)
    );
    if (files.length) void startUpload(files);
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...value];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j]!, next[index]!];
    onChange(next);
  };

  const removeAt = (index: number) => {
    // Blob files aren't deleted server-side on remove —
    // dropping the URL from the form is the actual "delete".
    onChange(value.filter((_, i) => i !== index));
  };

  const isVideo = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url);

  return (
    <div className="space-y-3">
      {label && (
        <p className="text-sm font-medium">
          {label}
          {hint && <span className="ml-2 font-normal text-muted-foreground">{hint}</span>}
        </p>
      )}

      {/* drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "cursor-pointer rounded-xl border-2 border-dashed transition-colors",
          compact ? "p-4" : "p-8",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/60 hover:bg-muted/40"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) void startUpload(files);
            e.target.value = "";
          }}
        />
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="rounded-full bg-primary/10 p-3">
            {busyRef.current ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <UploadCloud className="h-5 w-5 text-primary" />
            )}
          </div>
          <p className="text-sm font-medium">
            Drag & drop {accept.includes("video") ? "videos" : "images"} here, or{" "}
            <span className="text-primary underline">browse</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Cloud upload{multiple ? ` — up to ${max} files` : ""}
          </p>
        </div>
      </div>

      {/* uploading */}
      <AnimatePresence>
        {pending.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 rounded-lg border p-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="uploading" className="h-12 w-12 rounded object-cover" />
            <div className="flex-1">
              <p className="truncate text-xs">{p.file.name}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${p.percent}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{p.percent}%</span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* uploaded previews */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence>
            {value.map((url, i) => (
              <motion.div
                key={url}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative overflow-hidden rounded-lg border bg-muted"
              >
                {isVideo(url) ? (
                  <video src={url} className="h-28 w-full object-cover" muted />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={url} alt={`upload ${i + 1}`} className="h-28 w-full object-cover" />
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-6 w-6"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      aria-label="Move left"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-6 w-6"
                      disabled={i === value.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label="Move right"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="h-6 w-6"
                    onClick={() => void removeAt(i)}
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {i === 0 && multiple && (
                  <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Cover
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {value.length === 0 && pending.length === 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImagePlus className="h-3.5 w-3.5" /> No files yet.
        </p>
      )}
    </div>
  );
}
