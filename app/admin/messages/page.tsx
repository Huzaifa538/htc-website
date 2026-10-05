/**
 * /admin/messages — legacy route, superseded by the brand-split inboxes.
 * Redirects to the MTR Store inbox.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MessagesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/mtr/messages");
  }, [router]);
  return null;
}
