"use client";

/**
 * /login — Google sign-in for customers and admins.
 *
 * Admins (emails in NEXT_PUBLIC_ADMIN_EMAILS) are redirected to /admin
 * ONLY after the AuthProvider confirms the htc_admin session cookie was
 * minted by POST /api/auth/session. If minting fails, the user stays here
 * with an error instead of bouncing between /login and /admin forever.
 * Regular users land back on "next" (default "/").
 */
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin, adminSession, loading, roleLoading, configured, signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const justSignedIn = useRef(false);
  const next = searchParams.get("next") ?? "/";

  useEffect(() => {
    // roleLoading gates staff members: their admin status comes from the
    // ID token's role claim, which resolves async after sign-in.
    if (loading || roleLoading || !user) return;
    if (!isAdmin) {
      router.replace(next);
      return;
    }
    // Admin-email user: only enter /admin when the server session cookie
    // was actually minted — otherwise middleware would bounce us straight
    // back here in an infinite loop.
    if (adminSession === "ok") {
      router.replace("/admin");
      return;
    }
    if (adminSession === "pending" || adminSession === "unknown") return;
    // adminSession === "failed"
    if (justSignedIn.current) {
      setError(
        "Signed in, but admin access could not be verified on the server. Please try signing in again."
      );
    } else {
      // Landed here without a fresh sign-in and without a valid admin
      // session (e.g. bounced from middleware) — go to the customer site
      // instead of looping back to /admin.
      router.replace("/");
    }
  }, [user, isAdmin, adminSession, loading, roleLoading, next, router]);

  async function handleGoogle() {
    setError(null);
    setSigningIn(true);
    try {
      justSignedIn.current = true;
      await signInWithGoogle();
      // Redirect happens via the effect above once auth state settles.
    } catch {
      setError("Google sign-in failed. Please try again.");
      justSignedIn.current = false;
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <Image src="/logo.png" alt="HTC — Hammer Trading" width={64} height={64} />
          <p className="mt-1 text-xs font-medium text-muted-foreground">Hammer Trading Company</p>
          <CardTitle className="mt-2 text-2xl">Welcome to HTC</CardTitle>
          <CardDescription>Hammer Trading — sign in with your Google account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!configured && (
            <p className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Firebase is not configured on this deployment. Add the
              NEXT_PUBLIC_FIREBASE_* keys to enable sign-in.
            </p>
          )}
          <Button className="w-full" size="lg" onClick={handleGoogle} disabled={loading || signingIn || !configured}>
            {loading || signingIn ? "Please wait…" : "Continue with Google"}
          </Button>
          {error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Admins and staff sign in with their authorized Google account to access the dashboard.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
