/**
 * Custom 404 page.
 */
import Link from "next/link";
import { Home, Search } from "lucide-react";
import { SiteShell } from "@/components/customer/site-shell";

export default function NotFound() {
  return (
    <SiteShell>
      <div className="container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <p className="font-display text-[120px] font-extrabold leading-none text-[#D21F26] sm:text-[180px]">
          404
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">
          This page went missing
        </h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or was moved.
          Let&apos;s get you back to beautiful furniture.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D21F26] px-8 py-3.5 font-bold text-white transition hover:bg-[#a8161c]"
          >
            <Home size={17} /> Back to Home
          </Link>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center gap-2 rounded-full border px-8 py-3.5 font-bold transition hover:border-[#D21F26] hover:text-[#D21F26]"
          >
            <Search size={17} /> Browse Shop
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}
