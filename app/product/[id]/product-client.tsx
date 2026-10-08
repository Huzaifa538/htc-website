/**
 * /product/[id] — gallery (thumbnails, zoom, lightbox), variant selectors
 * (price/stock/image update via combinations[]), qty, Add to Cart, Buy Now,
 * wishlist, YouTube installation guide, reviews (login to add), related
 * products, "Chat about this product".
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Loader2,
  MessageCircle,
  Minus,
  Play,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Truck,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { useAuth } from "@/components/providers";
import { SiteShell } from "@/components/customer/site-shell";
import { ProductCard } from "@/components/customer/product-card";
import { Reveal } from "@/components/customer/reveal";
import { Stars, StarPicker } from "@/components/customer/stars";
import { EmptyState } from "@/components/customer/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useProduct, useProducts, useReviews } from "@/components/customer/data-hooks";
import { WhatsAppOrderButton } from "@/components/customer/whatsapp-order-button";
import { useCartStore } from "@/lib/store/cart";
import { useWishlistStore } from "@/lib/store/wishlist";
import { useUiStore } from "@/lib/store/ui";
import { useChatUiStore } from "@/lib/store/chat-ui";
import { formatPKR, formatPrice, isPriceUnset } from "@/lib/format";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/uploads";
import {
  findCombination,
  getCombinationPrice,
  getProductPrice,
  productYoutubeUrl,
  youtubeEmbedUrl,
} from "@/components/customer/product-utils";

function ZoomImage({ src, alt }: { src: string; alt: string }) {
  const [origin, setOrigin] = useState("50% 50%");
  const [zoomed, setZoomed] = useState(false);
  return (
    <div
      className="relative aspect-[4/3] cursor-zoom-in overflow-hidden rounded-3xl bg-muted"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setOrigin(
          `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}% ${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`
        );
      }}
      onMouseEnter={() => setZoomed(true)}
      onMouseLeave={() => setZoomed(false)}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 100vw, 55vw"
        className="object-cover transition-transform duration-200"
        style={{
          transform: zoomed ? "scale(1.9)" : "scale(1)",
          transformOrigin: origin,
        }}
        priority
      />
    </div>
  );
}

export default function ProductPage({ id: propId }: { id?: string }) {
  const params = useParams();
  const id = propId ?? (params?.id as string) ?? "";
  const router = useRouter();
  const { user } = useAuth();
  const { product, loading, configured } = useProduct(id);
  const { products } = useProducts();

  const addLine = useCartStore((s) => s.addLine);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const wished = useWishlistStore((s) => (product ? s.productIds.includes(product.id) : false));
  const openDrawer = useUiStore((s) => s.setCartDrawerOpen);
  const openChat = useChatUiStore((s) => s.openChat);

  const [imgIndex, setImgIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [qty, setQty] = useState(1);
  const [options, setOptions] = useState<Record<string, string>>({});
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  // Pending review photos (local File objects with preview URLs).
  const [reviewFiles, setReviewFiles] = useState<{ file: File; preview: string }[]>([]);
  const [reviewUploading, setReviewUploading] = useState(false);
  // Lightbox for review photos: { photos, index } or null.
  const [reviewLightbox, setReviewLightbox] = useState<{ photos: string[]; index: number } | null>(null);

  const { reviews, loading: reviewsLoading } = useReviews(product?.id ?? "__none__");

  // Default each variant axis to its first value once the product loads.
  useEffect(() => {
    if (product && product.variantTypes.length > 0) {
      setOptions((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const init: Record<string, string> = {};
        for (const t of product.variantTypes) init[t.name] = t.values[0] ?? "";
        return init;
      });
    }
  }, [product]);

  const gallery = useMemo(() => {
    if (!product) return [] as string[];
    const imgs = [...(product.images ?? [])];
    for (const c of product.combinations) {
      if (c.image && !imgs.includes(c.image)) imgs.push(c.image);
    }
    return imgs;
  }, [product]);

  const combination = useMemo(
    () => (product ? findCombination(product, options) : undefined),
    [product, options]
  );

  const priceInfo = useMemo(() => {
    if (!product) return null;
    return combination
      ? getCombinationPrice(product, combination)
      : getProductPrice(product);
  }, [product, combination]);

  const displayImage = combination?.image ?? gallery[imgIndex] ?? "/logo.png";

  const related = useMemo(() => {
    if (!product) return [];
    return products
      .filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
      .slice(0, 4);
  }, [products, product]);

  const youtubeUrl = product ? productYoutubeUrl(product) : undefined;
  const embedUrl = youtubeUrl ? youtubeEmbedUrl(youtubeUrl) : null;

  // Demo video: Huzaifa uploads the actual product demo videos later.
  // Accepts a YouTube link (embedded) or a direct mp4/webm URL (native player).
  // The whole section stays hidden until a video URL is set on the product.
  const demoVideoUrl = product?.videoUrl?.trim() || "";
  const demoEmbedUrl = demoVideoUrl ? youtubeEmbedUrl(demoVideoUrl) : null;

  function selectOption(typeName: string, value: string) {
    setOptions((o) => ({ ...o, [typeName]: value }));
    setImgIndex(0);
  }

  function currentLine() {
    if (!product || !priceInfo) return null;
    return {
      productId: product.id,
      combinationId: combination?.id,
      variant: combination?.options ?? options,
      name: product.name,
      image: displayImage,
      unitPrice: priceInfo.price,
      stock: priceInfo.stock,
      qty,
    };
  }

  function handleAdd(buyNow = false) {
    const line = currentLine();
    if (!line) return;
    if (line.stock <= 0) {
      toast.error("This item is out of stock");
      return;
    }
    addLine(line);
    if (buyNow) {
      router.push("/checkout");
    } else {
      toast.success(`${product!.name} added to cart`);
      openDrawer(true);
    }
  }

  function handleChatAbout() {
    if (!product || !priceInfo) return;
    if (!user) {
      toast.error("Please sign in to chat about this product");
      router.push(`/login?next=${encodeURIComponent(`/product/${id}`)}`);
      return;
    }
    openChat({
      kind: "product",
      id: product.id,
      name: product.name,
      image: displayImage,
      detail: formatPrice(priceInfo.price),
      href: `/product/${product.slug || product.id}`,
    });
    toast.success("Chat opened — ask us anything about this product");
  }

  function pickReviewPhotos(files: FileList | null) {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) {
      toast.error("Please choose image files.");
      return;
    }
    setReviewFiles((prev) => {
      const next = [
        ...prev,
        ...imgs.map((file) => ({ file, preview: URL.createObjectURL(file) })),
      ].slice(0, 4);
      if (prev.length + imgs.length > 4) toast.error("You can attach up to 4 photos.");
      return next;
    });
  }

  function removeReviewPhoto(preview: string) {
    setReviewFiles((prev) => {
      const target = prev.find((p) => p.preview === preview);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.preview !== preview);
    });
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !product || !db) return;
    if (!reviewText.trim()) {
      toast.error("Please write your review");
      return;
    }
    setReviewBusy(true);
    try {
      // Upload review photos first (signed-in customers may use the reviews/ folder).
      let images: string[] = [];
      if (reviewFiles.length > 0) {
        setReviewUploading(true);
        try {
          const idToken = await user.getIdToken();
          images = await Promise.all(
            reviewFiles.map((p) => uploadFile(p.file, { folder: "reviews", idToken }))
          );
        } finally {
          setReviewUploading(false);
        }
      }
      await addDoc(collection(db, COLLECTIONS.reviews), {
        productId: product.id,
        userId: user.uid,
        userName: user.displayName ?? user.email ?? "Customer",
        rating: reviewRating,
        title: reviewTitle.trim() || undefined,
        comment: reviewText.trim(),
        ...(images.length > 0 ? { images } : {}),
        approved: false,
        createdAt: serverTimestamp(),
      });
      toast.success("Review submitted — it will appear after approval.");
      setReviewTitle("");
      setReviewText("");
      setReviewRating(5);
      reviewFiles.forEach((p) => URL.revokeObjectURL(p.preview));
      setReviewFiles([]);
    } catch {
      toast.error("Could not submit review — please try again.");
    } finally {
      setReviewBusy(false);
    }
  }

  if (loading) {
    return (
      <SiteShell>
        <div className="container grid gap-10 py-10 lg:grid-cols-2">
          <Skeleton className="aspect-[4/3] w-full rounded-3xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full rounded-full" />
          </div>
        </div>
      </SiteShell>
    );
  }

  if (!configured || !product) {
    return (
      <SiteShell>
        <div className="container py-16">
          <EmptyState
            title="Product not found"
            description="This product may have been removed or is unavailable."
            actionLabel="Back to Shop"
            actionHref="/shop"
          />
        </div>
      </SiteShell>
    );
  }

  const inStock = (priceInfo?.stock ?? 0) > 0;

  return (
    <SiteShell>
      <div className="container py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link href="/shop" className="hover:text-foreground">Shop</Link>
          <span>/</span>
          <span className="truncate font-medium text-foreground">{product.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2">
          {/* Gallery */}
          <div>
            <div onClick={() => setLightbox(true)}>
              <ZoomImage src={displayImage} alt={product.name} />
            </div>
            {gallery.length > 1 && (
              <div className="mt-4 grid grid-cols-5 gap-3">
                {gallery.map((src, i) => (
                  <button
                    key={src + i}
                    onClick={() => setImgIndex(i)}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-2xl ring-2 transition",
                      (combination?.image === src || (!combination?.image && imgIndex === i))
                        ? "ring-[#D21F26]"
                        : "ring-transparent hover:ring-black/20"
                    )}
                  >
                    <Image src={src} alt={`${product.name} — image ${i + 1}`} fill className="object-cover" sizes="120px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {product.name}
                </h1>
                {product.urduName && (
                  <p className="mt-1 text-lg font-semibold text-muted-foreground" dir="rtl" lang="ur">
                    {product.urduName}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Stars rating={product.rating} size={16} />
                  <span className="text-sm text-muted-foreground">
                    {product.rating.toFixed(1)} · {product.reviewCount} reviews ·{" "}
                    {product.soldCount} sold
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  toggleWishlist(product.id);
                  toast(wished ? "Removed from wishlist" : "Saved to wishlist");
                }}
                aria-label="Toggle wishlist"
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition",
                  wished
                    ? "border-[#D21F26] bg-[#D21F26] text-white"
                    : "hover:border-[#D21F26] hover:text-[#D21F26]"
                )}
              >
                <Heart size={19} className={wished ? "fill-current" : ""} />
              </button>
            </div>

            {/* Price */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[#D21F26] px-5 py-2.5 text-2xl font-extrabold text-white">
                {formatPrice(priceInfo!.price)}
              </span>
              {priceInfo!.compareAt && (
                <>
                  <s className="text-lg text-muted-foreground">
                    {formatPKR(priceInfo!.compareAt)}
                  </s>
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-700 dark:bg-green-950 dark:text-green-300">
                    Save {priceInfo!.discountPct}%
                  </span>
                </>
              )}
              {(product.deliveredCount ?? 0) > 0 && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  ✅ {product.deliveredCount} times delivered
                </span>
              )}
            </div>

            {product.shortDescription && (
              <p className="mt-4 leading-relaxed text-muted-foreground">
                {product.shortDescription}
              </p>
            )}

            {/* Variant selectors */}
            {product.variantTypes.map((t) => (
              <div key={t.id} className="mt-6">
                <p className="mb-2.5 text-sm font-bold">
                  {t.name}
                  {options[t.name] && (
                    <span className="ml-2 font-medium text-muted-foreground">
                      — {options[t.name]}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {t.values.map((v) => {
                    const selected = (options[t.name] ?? t.values[0]) === v;
                    if (t.kind === "color") {
                      return (
                        <button
                          key={v}
                          onClick={() => selectOption(t.name, v)}
                          title={v}
                          aria-label={`${t.name} ${v}`}
                          className={cn(
                            "flex h-11 w-11 items-center justify-center rounded-full ring-2 ring-offset-2 transition",
                            selected ? "ring-[#D21F26]" : "ring-black/10 hover:ring-black/30"
                          )}
                          style={{ backgroundColor: t.colors?.[v] ?? "#ddd" }}
                        >
                          {selected && <Check size={16} className="text-white drop-shadow" />}
                        </button>
                      );
                    }
                    return (
                      <button
                        key={v}
                        onClick={() => selectOption(t.name, v)}
                        className={cn(
                          "rounded-full border px-5 py-2.5 text-sm font-medium transition",
                          selected
                            ? "border-[#D21F26] bg-[#D21F26]/10 font-bold text-[#D21F26]"
                            : "hover:border-foreground/50"
                        )}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Stock + qty */}
            <div className="mt-6 flex items-center gap-4">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold",
                  inStock
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", inStock ? "bg-green-600" : "bg-red-600")} />
                {inStock ? `In stock (${priceInfo!.stock})` : "Out of stock"}
              </span>
              {combination && (
                <span className="text-xs text-muted-foreground">SKU: {combination.sku}</span>
              )}
              {!combination && product.sku && (
                <span className="text-xs text-muted-foreground">SKU: {product.sku}</span>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 rounded-full border px-2 py-1.5">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                >
                  <Minus size={16} />
                </button>
                <span className="min-w-10 text-center text-lg font-extrabold">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(Math.max(priceInfo!.stock, 1), q + 1))}
                  aria-label="Increase quantity"
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                >
                  <Plus size={16} />
                </button>
              </div>
              <Button
                onClick={() => handleAdd(false)}
                disabled={!inStock || isPriceUnset(priceInfo!.price)}
                className="flex-1 rounded-full bg-[#7C4A21] py-6 text-base font-bold text-white hover:bg-[#5f3a19]"
              >
                <ShoppingCart size={18} className="mr-2" /> Add to Cart
              </Button>
            </div>
            {isPriceUnset(priceInfo!.price) ? (
              <div className="mt-3">
                <Button
                  asChild
                  className="w-full rounded-full bg-[#25D366] py-6 text-base font-bold text-white hover:bg-[#1da851]"
                >
                  <a
                    href={`https://wa.me/923212476150?text=${encodeURIComponent(
                      `Assalam-o-Alaikum! I want to inquire about "${product.name}" (Rs price on request).`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={18} className="mr-2" /> Ask Price on WhatsApp
                  </a>
                </Button>
              </div>
            ) : (
            <div className="mt-3 flex gap-3">
              <Button
                onClick={() => handleAdd(true)}
                disabled={!inStock}
                className="flex-1 rounded-full bg-[#D21F26] py-6 text-base font-bold hover:bg-[#a8161c]"
              >
                <Zap size={18} className="mr-2" /> Buy Now
              </Button>
              <Button
                variant="outline"
                onClick={handleChatAbout}
                className="flex-1 rounded-full py-6 font-bold"
              >
                <MessageCircle size={18} className="mr-2" /> Chat about this
              </Button>
            </div>
            )}

            {/* WhatsApp direct order — pre-filled with product + price */}
            {!isPriceUnset(priceInfo!.price) && (
              <div className="mt-3">
                <WhatsAppOrderButton
                  productName={product.name}
                  priceLabel={formatPrice(priceInfo!.price)}
                  productUrl={
                    typeof window !== "undefined"
                      ? window.location.href
                      : `/product/${product.slug || product.id}`
                  }
                  quantity={qty}
                />
              </div>
            )}

            {/* Trust badges */}
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                { icon: Truck, label: "Nationwide delivery" },
                { icon: ShieldCheck, label: "Cash on delivery" },
                { icon: Check, label: "Quality checked" },
              ].map((b) => (
                <div key={b.label} className="rounded-2xl bg-muted/60 px-2 py-4">
                  <b.icon size={20} className="mx-auto text-[#D21F26]" />
                  <p className="mt-1.5 text-xs font-semibold">{b.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Description */}
        <Reveal className="mt-14">
          <div className="rounded-3xl border bg-card p-6 sm:p-8">
            <h2 className="font-display text-2xl font-extrabold">Description</h2>
            <div className="prose mt-4 max-w-none whitespace-pre-wrap text-[15px] leading-relaxed text-muted-foreground dark:prose-invert">
              {product.description}
            </div>
            {product.tags?.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {product.tags.map((t) => (
                  <span key={t} className="rounded-full bg-muted px-3.5 py-1.5 text-xs font-medium">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Reveal>

        {/* Installation guide */}
        {embedUrl && (
          <Reveal className="mt-8">
            <div className="rounded-3xl border bg-card p-6 sm:p-8">
              <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold">
                <Play size={22} className="text-[#D21F26]" /> Installation Guide
              </h2>
              <div className="mt-4 aspect-video overflow-hidden rounded-2xl">
                <iframe
                  src={embedUrl}
                  title="Installation guide"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            </div>
          </Reveal>
        )}

        {/* Product demo video — only renders when a video URL is set */}
        {demoVideoUrl && (
          <Reveal className="mt-8">
            <div className="rounded-3xl border bg-card p-6 sm:p-8">
              <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold">
                <Play size={22} className="text-[#D21F26]" /> Product Demo
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Watch this product in action.
              </p>
              <div className="mt-4 aspect-video overflow-hidden rounded-2xl bg-black">
                {demoEmbedUrl ? (
                  <iframe
                    src={demoEmbedUrl}
                    title="Product demo video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full"
                  />
                ) : (
                  <video
                    src={demoVideoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-full w-full"
                  />
                )}
              </div>
            </div>
          </Reveal>
        )}

        {/* Reviews */}
        <Reveal className="mt-8">
          <div className="rounded-3xl border bg-card p-6 sm:p-8">
            <h2 className="font-display text-2xl font-extrabold">
              Customer Reviews ({product.reviewCount})
            </h2>

            {reviewsLoading ? (
              <div className="mt-6 space-y-4">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No reviews yet — be the first to share your experience.
              </p>
            ) : (
              <ul className="mt-6 space-y-5">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-2xl bg-muted/50 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D21F26]/10 font-display font-extrabold text-[#D21F26]">
                          {r.userName.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <p className="text-sm font-bold">{r.userName}</p>
                          <Stars rating={r.rating} size={13} />
                        </div>
                      </div>
                    </div>
                    {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {r.comment}
                    </p>
                    {r.images && r.images.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {r.images.map((src, i) => (
                          <button
                            key={src}
                            type="button"
                            onClick={() => setReviewLightbox({ photos: r.images!, index: i })}
                            className="relative h-16 w-16 overflow-hidden rounded-xl border transition hover:opacity-85"
                            aria-label={`View review photo ${i + 1}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={`Review photo ${i + 1}`} className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Add review */}
            <div className="mt-8 border-t pt-6">
              <h3 className="font-display text-lg font-bold">Write a review</h3>
              {!isFirebaseConfigured() ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Reviews are unavailable while the store backend is being configured.
                </p>
              ) : !user ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  <Link href={`/login?next=${encodeURIComponent(`/product/${id}`)}`} className="font-bold text-[#D21F26] hover:underline">
                    Sign in
                  </Link>{" "}
                  to write a review.
                </p>
              ) : (
                <form onSubmit={submitReview} className="mt-4 space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-semibold">Your rating</p>
                    <StarPicker value={reviewRating} onChange={setReviewRating} />
                  </div>
                  <Input
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder="Review title (optional)"
                    className="rounded-xl"
                  />
                  <Textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Share your experience with this product…"
                    rows={4}
                    className="rounded-xl"
                  />
                  <div>
                    <p className="mb-2 text-sm font-semibold">
                      Photos <span className="font-normal text-muted-foreground">(optional, up to 4)</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {reviewFiles.map((p) => (
                        <div key={p.preview} className="relative h-16 w-16 overflow-hidden rounded-xl border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.preview} alt="Review photo preview" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeReviewPhoto(p.preview)}
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-[#D21F26]"
                            aria-label="Remove photo"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      {reviewFiles.length < 4 && (
                        <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground transition hover:border-[#D21F26] hover:text-[#D21F26]">
                          <Camera size={20} />
                          <span className="text-[10px] font-semibold">Add</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => pickReviewPhotos(e.target.files)}
                          />
                        </label>
                      )}
                    </div>
                    {reviewUploading && (
                      <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 size={12} className="animate-spin" /> Uploading photos…
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={reviewBusy}
                    className="rounded-full bg-[#D21F26] px-8 hover:bg-[#a8161c]"
                  >
                    {reviewBusy ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                    Submit Review
                  </Button>
                </form>
              )}
            </div>
          </div>
        </Reveal>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-14">
            <h2 className="mb-6 font-display text-2xl font-extrabold">
              Related Products
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <Dialog open={lightbox} onOpenChange={setLightbox}>
        <DialogContent className="max-w-4xl border-0 bg-black/95 p-2">
          <div className="relative aspect-video w-full">
            <Image
              src={displayImage}
              alt={product.name}
              fill
              className="object-contain"
              sizes="90vw"
            />
            {gallery.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setImgIndex((i) => (i - 1 + gallery.length) % gallery.length);
                  }}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-[#D21F26]"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setImgIndex((i) => (i + 1) % gallery.length);
                  }}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-[#D21F26]"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Review photo lightbox */}
      <Dialog open={reviewLightbox !== null} onOpenChange={(o) => !o && setReviewLightbox(null)}>
        <DialogContent className="max-w-4xl border-0 bg-black/95 p-2">
          {reviewLightbox && (
            <div className="relative aspect-video w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={reviewLightbox.photos[reviewLightbox.index]}
                alt={`Review photo ${reviewLightbox.index + 1}`}
                className="h-full w-full object-contain"
              />
              {reviewLightbox.photos.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setReviewLightbox((s) =>
                        s ? { photos: s.photos, index: (s.index - 1 + s.photos.length) % s.photos.length } : s
                      );
                    }}
                    aria-label="Previous photo"
                    className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-[#D21F26]"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setReviewLightbox((s) =>
                        s ? { photos: s.photos, index: (s.index + 1) % s.photos.length } : s
                      );
                    }}
                    aria-label="Next photo"
                    className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-[#D21F26]"
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SiteShell>
  );
}
