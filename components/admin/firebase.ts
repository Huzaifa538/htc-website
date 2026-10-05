"use client";

/**
 * Shared admin utilities: guarded Firestore helpers + realtime hooks.
 *
 * Firebase may be unconfigured (db === undefined) — every helper guards
 * with db checks and every page renders <SetupWarning /> when
 * isFirebaseConfigured() is false.
 */
import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Timestamp,
  type DocumentData,
  type QueryConstraint,
  type Firestore,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { WithId } from "@/lib/types";

export function getDb(): Firestore | undefined {
  return db;
}

/* ----------------------------- realtime hooks ----------------------------- */

export interface CollectionState<T> {
  data: WithId<T>[];
  loading: boolean;
  error: Error | null;
}

/** Realtime subscription to a collection. Pass query constraints optionally. */
export function useCollection<T extends DocumentData = DocumentData>(
  collectionPath: string | undefined,
  constraints: QueryConstraint[] = []
): CollectionState<T> {
  const [data, setData] = useState<WithId<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!db || !collectionPath) {
      setLoading(false);
      return;
    }
    const ref = collection(db, collectionPath);
    const q = constraints.length > 0 ? query(ref, ...constraints) : ref;
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }) as WithId<T>)
        );
        setLoading(false);
      },
      (e) => {
        setError(e as Error);
        setLoading(false);
      }
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath, JSON.stringify(constraints)]);

  return { data, loading, error };
}

export interface DocState<T> {
  data: WithId<T> | null;
  loading: boolean;
  error: Error | null;
}

/** Realtime subscription to a single document. */
export function useDoc<T extends DocumentData = DocumentData>(
  collectionPath: string | undefined,
  id: string | undefined
): DocState<T> {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!db || !collectionPath || !id) {
      setLoading(false);
      return;
    }
    const ref = doc(db, collectionPath, id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setData(
          snap.exists()
            ? ({ ...(snap.data() as T), id: snap.id } as WithId<T>)
            : null
        );
        setLoading(false);
      },
      (e) => {
        setError(e as Error);
        setLoading(false);
      }
    );
    return unsub;
  }, [collectionPath, id]);

  return { data, loading, error };
}

/* ------------------------------ formatting ------------------------------ */

/** Safely format a Firestore Timestamp (or undefined) as a date string. */
export function fmtDate(ts: Timestamp | undefined | null): string {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleDateString("en-PK", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

/** Safely format a Firestore Timestamp as date + time. */
export function fmtDateTime(ts: Timestamp | undefined | null): string {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleString("en-PK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** Milliseconds for a Firestore Timestamp (0 when missing). */
export function tsMillis(ts: Timestamp | undefined | null): number {
  if (!ts) return 0;
  try {
    return ts.toMillis();
  } catch {
    return 0;
  }
}

/** Shorten a Firestore doc id for display. */
export function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

/** Convert a date-input value (YYYY-MM-DD) to a Firestore Timestamp. */
export function dateInputToTimestamp(value: string): Timestamp | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
}

/** Convert a Firestore Timestamp to a date-input value (YYYY-MM-DD). */
export function timestampToDateInput(ts: Timestamp | undefined | null): string {
  if (!ts) return "";
  try {
    const d = ts.toDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch {
    return "";
  }
}

/** Slugify a name for product/service/category slugs. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Download a CSV string as a file. */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
