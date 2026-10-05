/**
 * Client-side Firestore data hooks for the customer site.
 *
 * Every hook guards with isFirebaseConfigured() and returns graceful
 * empty data + skeletons when Firebase isn't configured, so the site
 * renders (and `npx tsc --noEmit` passes) with or without env keys.
 */
import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS, type CollectionPath } from "@/lib/firebase/collections";
import type {
  AboutContent,
  Category,
  ChatMessage,
  GalleryImage,
  GalleryVideo,
  HeroSlide,
  Order,
  Product,
  Project,
  Review,
  Service,
  Shipment,
  SiteSettings,
  WithId,
} from "@/lib/types";

function toWithId<T>(id: string, data: DocumentData): WithId<T> {
  return { id, ...(data as T) } as WithId<T>;
}

export async function fetchCollection<T>(
  col: CollectionPath,
  ...constraints: QueryConstraint[]
): Promise<WithId<T>[]> {
  if (!db || !isFirebaseConfigured()) return [];
  const ref = collection(db, col);
  const snap = await getDocs(
    constraints.length ? query(ref, ...constraints) : ref
  );
  return snap.docs.map((d) => toWithId<T>(d.id, d.data()));
}

interface QueryState<T> {
  items: WithId<T>[];
  loading: boolean;
  configured: boolean;
}

function useCollection<T>(
  col: CollectionPath,
  build: () => QueryConstraint[],
  deps: unknown[] = []
): QueryState<T> {
  const [items, setItems] = useState<WithId<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchCollection<T>(col, ...build())
      .then((rows) => {
        if (!cancelled) {
          setItems(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, col, ...deps]);

  return { items, loading, configured };
}

/* ---------------- single docs ---------------- */

function useDoc<T>(col: CollectionPath, docId: string) {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured || !db) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getDoc(doc(db, col, docId))
      .then((snap) => {
        if (!cancelled) {
          setData(snap.exists() ? toWithId<T>(snap.id, snap.data()) : null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, col, docId]);

  return { data, loading, configured };
}

export function useSiteSettings() {
  const { data, loading, configured } = useDoc<SiteSettings>(
    COLLECTIONS.siteSettings,
    "main"
  );
  return { settings: data, loading, configured };
}

/** Fallback time slots when the admin hasn't configured custom ones. */
export const DEFAULT_APPOINTMENT_SLOTS = [
  "10:00 AM – 12:00 PM",
  "12:00 PM – 2:00 PM",
  "2:00 PM – 4:00 PM",
  "4:00 PM – 6:00 PM",
] as const;

/** Consultation time slots from siteSettings/main, with sane defaults. */
export function useAppointmentSlots(): string[] {
  const { settings } = useSiteSettings();
  const configured = settings?.appointmentTimeSlots;
  if (configured && configured.length > 0) {
    return configured.map((s) => s.trim()).filter(Boolean);
  }
  return [...DEFAULT_APPOINTMENT_SLOTS];
}

export function useAboutContent() {
  const { data, loading, configured } = useDoc<AboutContent>(
    COLLECTIONS.aboutContent,
    "main"
  );
  return { about: data, loading, configured };
}

/* ---------------- catalog ---------------- */

export function useProducts() {
  const { items, loading, configured } = useCollection<Product>(
    COLLECTIONS.products,
    () => [where("published", "==", true), limit(500)]
  );
  return { products: items, loading, configured };
}

/** Resolve a product by Firestore id OR slug (route param). */
export function useProduct(idOrSlug: string) {
  const [product, setProduct] = useState<WithId<Product> | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  const refresh = useCallback(async () => {
    if (!configured || !db || !idOrSlug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const direct = await getDoc(doc(db, COLLECTIONS.products, idOrSlug));
      if (direct.exists()) {
        setProduct(toWithId<Product>(direct.id, direct.data()));
      } else {
        const rows = await fetchCollection<Product>(
          COLLECTIONS.products,
          where("slug", "==", idOrSlug),
          limit(1)
        );
        setProduct(rows[0] ?? null);
      }
    } catch {
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [configured, idOrSlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { product, loading, configured, refresh };
}

export function useCategories() {
  return useCollection<Category>(COLLECTIONS.categories, () => [
    where("enabled", "==", true),
    limit(100),
  ]);
}

export function useHeroSlides() {
  return useCollection<HeroSlide>(COLLECTIONS.heroSlides, () => [
    where("enabled", "==", true),
    limit(15),
  ]);
}

export function useServices() {
  return useCollection<Service>(COLLECTIONS.services, () => [
    where("enabled", "==", true),
    limit(100),
  ]);
}

export function useService(idOrSlug: string) {
  const [service, setService] = useState<WithId<Service> | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured || !db || !idOrSlug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const direct = await getDoc(doc(db!, COLLECTIONS.services, idOrSlug));
        let row: WithId<Service> | null = null;
        if (direct.exists()) row = toWithId<Service>(direct.id, direct.data());
        else {
          const rows = await fetchCollection<Service>(
            COLLECTIONS.services,
            where("slug", "==", idOrSlug),
            limit(1)
          );
          row = rows[0] ?? null;
        }
        if (!cancelled) setService(row);
      } catch {
        if (!cancelled) setService(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, idOrSlug]);

  return { service, loading, configured };
}

export function useProjects() {
  return useCollection<Project>(COLLECTIONS.projects, () => [limit(200)]);
}

export function useProject(id: string) {
  const { data, loading, configured } = useDoc<Project>(
    COLLECTIONS.projects,
    id
  );
  return { project: data, loading, configured };
}

export function useGalleryVideos() {
  return useCollection<GalleryVideo>(COLLECTIONS.galleryVideos, () => [
    where("enabled", "==", true),
    limit(200),
  ]);
}

export function useGalleryImages() {
  return useCollection<GalleryImage>(COLLECTIONS.galleryImages, () => [
    where("enabled", "==", true),
    limit(300),
  ]);
}

export function useReviews(productId: string) {
  const { items, loading, configured } = useCollection<Review>(
    COLLECTIONS.reviews,
    () => [where("productId", "==", productId), limit(100)],
    [productId]
  );
  // Approval is filtered client-side to avoid a composite index.
  const reviews = items.filter((r) => r.approved);
  return { reviews, loading, configured };
}

export function useOrders(uid: string | undefined) {
  const { items, loading, configured } = useCollection<Order>(
    COLLECTIONS.orders,
    () => [where("userId", "==", uid ?? "__none__"), limit(200)],
    [uid]
  );
  return { orders: items, loading, configured };
}

/** Shipments for one customer (userId is always stored on shipment docs). */
export function useShipments(uid: string | undefined) {
  const { items, loading, configured } = useCollection<Shipment>(
    COLLECTIONS.shipments,
    () => [where("userId", "==", uid ?? "__none__"), limit(200)],
    [uid]
  );
  return { shipments: items, loading, configured };
}

/* ---------------- gallery comments (subcollection, realtime) ---------------- */

export interface VideoComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: unknown;
}

export function useVideoComments(videoId: string) {
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured || !db || !videoId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, COLLECTIONS.galleryVideos, videoId, "comments"),
      orderBy("createdAt", "asc"),
      limit(200)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VideoComment, "id">) }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [configured, videoId]);

  return { comments, loading, configured };
}

/* ---------------- chat (realtime) ---------------- */

export type ChatMessageDoc = ChatMessage;

export function useChatMessages(uid: string | undefined) {
  const [messages, setMessages] = useState<ChatMessageDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured || !db || !uid) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, COLLECTIONS.chats, uid, "messages"),
      orderBy("createdAt", "asc"),
      limit(200)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessageDoc, "id">) }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [configured, uid]);

  return { messages, loading, configured };
}

export interface ChatMeta {
  typing?: "user" | "admin" | null;
  updatedAt?: unknown;
}

export function useChatMeta(uid: string | undefined) {
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured || !db || !uid) return;
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.chats, uid),
      (snap) => setMeta(snap.exists() ? (snap.data() as ChatMeta) : null),
      () => setMeta(null)
    );
    return unsub;
  }, [configured, uid]);

  return { meta, configured };
}
