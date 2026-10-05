/**
 * AdminRefCard — renders a message's reference card (product / service /
 * project) inside the admin chat inbox, so staff can see which item the
 * customer is asking about. Links to the matching storefront page.
 */
import Link from "next/link";
import type { ChatRefCard } from "@/lib/types";

const KIND_LABEL: Record<ChatRefCard["kind"], string> = {
  product: "Product",
  service: "Service",
  project: "Project",
};

export function AdminRefCard({ card }: { card: ChatRefCard }) {
  return (
    <Link
      href={card.href}
      target="_blank"
      rel="noreferrer"
      className="mb-1.5 flex items-center gap-2.5 rounded-xl bg-black/10 p-2 dark:bg-white/10"
      title={`${KIND_LABEL[card.kind]} — open page`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={card.image}
        alt=""
        className="h-11 w-11 shrink-0 rounded-lg object-cover"
      />
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wide opacity-60">
          {KIND_LABEL[card.kind]}
        </span>
        <span className="block truncate text-xs font-bold">{card.name}</span>
        <span className="block truncate text-xs font-extrabold">
          {card.detail}
        </span>
      </span>
    </Link>
  );
}
