"use client";

/**
 * Global providers + Firebase Auth context.
 *
 * Exports: useAuth() -> { user, isAdmin, role, roleLoading, refreshRole,
 *   adminSession, loading, configured, signInWithGoogle, signOut }
 *
 * Admin session flow (see README "Admin session flow"):
 * 1. User signs in with Google (client SDK).
 * 2. The client POSTs the ID token to /api/auth/session, which verifies it
 *    with the Admin SDK, checks the email against NEXT_PUBLIC_ADMIN_EMAILS
 *    and the `staff` roster, sets the httpOnly `htc_admin=1` cookie and
 *    merges the { admin: true, role } custom claims.
 * 3. Edge middleware checks that cookie to protect /admin/* and /api/admin/*.
 * 4. signOut() deletes the cookie via DELETE /api/auth/session.
 * Role: read from the ID token's `role` custom claim ("owner" when
 * claims.admin is true and no role is set).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ThemeProvider } from "next-themes";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase/client";
import { isAdminEmail } from "@/lib/auth";
import type { StaffRole } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  /** Staff role from the ID token's `role` custom claim.
   * "owner" when claims.admin is true and no role claim is set
   * (backward compat for the bootstrap owner). null while loading or
   * when the signed-in user is not an admin. */
  role: StaffRole | null;
  /** True while the role is being read from the ID token. */
  roleLoading: boolean;
  /** Re-read the ID token's custom claims and update `role`. */
  refreshRole: () => Promise<void>;
  /** Admin session-cookie state: "unknown" (not checked yet), "pending"
   * (check/mint in flight), "ok" (cookie minted/present), "failed"
   * (no cookie — /admin would bounce back to /login). */
  adminSession: "unknown" | "pending" | "ok" | "failed";
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const VALID_ROLES: readonly StaffRole[] = ["owner", "manager", "staff", "viewer"];

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <Providers>");
  return ctx;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [adminSession, setAdminSession] = useState<"unknown" | "pending" | "ok" | "failed">("unknown");
  const configured = isFirebaseConfigured();

  /** Read the staff role from the current ID token's custom claims. */
  const refreshRole = useCallback(async () => {
    const u = auth?.currentUser;
    if (!u) {
      setRole(null);
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    try {
      const tokenResult = await u.getIdTokenResult();
      const claims = tokenResult.claims as {
        admin?: boolean;
        role?: unknown;
      };
      if (claims.admin === true) {
        const claimed = typeof claims.role === "string" ? claims.role : null;
        setRole(
          claimed && (VALID_ROLES as readonly string[]).includes(claimed)
            ? (claimed as StaffRole)
            : "owner"
        );
      } else {
        setRole(null);
      }
    } catch {
      setRole(null);
    } finally {
      setRoleLoading(false);
    }
  }, []);

  /** Ask the server whether the admin session cookie is present. */
  const refreshAdminSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { method: "GET" });
      const data = await res.json();
      if (data?.admin) {
        setAdminSession("ok");
        // Ensure the client's ID token carries the fresh `admin: true`
        // custom claim (the server sets it during login; tokens minted
        // before that lack it, which breaks Firestore `isAdmin()` rules).
        try {
          await auth?.currentUser?.getIdToken(true);
          await refreshRole();
        } catch {
          /* best effort */
        }
      } else {
        setAdminSession("failed");
      }
    } catch {
      setAdminSession("failed");
    }
  }, [refreshRole]);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      // Keep the staff role in sync with the ID token's custom claims.
      void refreshRole();
      // Verify the server session cookie exists (covers page reloads where
      // signInWithGoogle didn't run). Runs for every signed-in user — the
      // server decides who is an admin (allow-list or staff roster).
      if (u) {
        setAdminSession("pending");
        refreshAdminSession();
      } else {
        setAdminSession("unknown");
      }
    });
    return unsub;
  }, [refreshAdminSession, refreshRole]);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* keys to .env.local");
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    // Mint the admin session cookie via the server for every sign-in — the
    // server decides (ADMIN_EMAILS allow-list or the staff roster) whether
    // this user is an admin. The login page only redirects to /admin when
    // this reports "ok", which breaks the /login <-> /admin loop when
    // minting fails.
    setAdminSession("pending");
    try {
      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (res.ok) {
        // The server may have just set the `admin: true` / `role` custom
        // claims; force-refresh the ID token so Firestore rules and the
        // role badge see them.
        try {
          await cred.user.getIdToken(true);
        } catch {
          /* best effort */
        }
        await refreshRole();
      }
      setAdminSession(res.ok ? "ok" : "failed");
    } catch {
      // Cookie minting failed — user is still signed in; middleware will
      // simply not treat them as an admin until it succeeds.
      setAdminSession("failed");
    }
  }, [refreshRole]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch {
      /* best effort */
    }
    if (auth) await firebaseSignOut(auth);
    setUser(null);
    setRole(null);
    setRoleLoading(false);
    setAdminSession("unknown");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      // Staff roster members (role claim) count as admins even when their
      // email is not in NEXT_PUBLIC_ADMIN_EMAILS.
      isAdmin: isAdminEmail(user?.email) || role !== null,
      role,
      roleLoading,
      refreshRole,
      adminSession,
      loading,
      configured,
      signInWithGoogle,
      signOut,
    }),
    [user, role, roleLoading, refreshRole, adminSession, loading, configured, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
