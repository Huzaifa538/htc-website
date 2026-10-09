/**
 * Abandoned carts — 24 ghante purani carts jin par order nahi hua.
 *
 * Logged-in users ki carts Firestore mein sync hoti hain (carts collection).
 * Yahan wo carts dikhti hain jo 24h+ purani hain aur jinke baad koi order
 * nahi aaya. Admin ek click par customer ko WhatsApp reminder bhej sakta
 * hai (wa.me link — phone par WhatsApp khulta hai).
 */
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { AppUser, Order, Product, WithId } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";
import { formatPKR } from "@/lib/format";
import { getProductPrice } from "@/components/customer/product-utils";
import {
  useCollection,
  useDoc,
  fmtDateTime,
  tsMillis,
} from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import {
  PageHeader,
  EmptyState,
  LoadingState,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CartDoc {
  id: string; // = userId
  userId: string;
  items: { productId: string; qty: number }[];
  updatedAt: Timestamp | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function AbandonedRow({ cart }: { cart: WithId<CartDoc> }) {
  const { data: user } = useDoc<AppUser>(COLLECTIONS.users, cart.userId);
  const { data: products } = useCollection<Product>(COLLECTIONS.products);

  const lines = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return (cart.items ?? [])
      .map((i) => ({ item: i, product: byId.get(i.productId) }))
      .filter((l) => l.product);
  }, [products, cart.items]);

  const total = useMemo(
    () =>
      lines.reduce(
        (sum, l) => sum + getProductPrice(l.product!).price * l.item.qty,
        0
      ),
    [lines]
  );

  const phone = (user?.phone ?? "").replace(/\D/g, "");
  const message =
    `Assalam-o-Alaikum${user?.name ? ` ${user.name}` : ""}! ` +
    `Aap ne MTR Store par kuch products cart mein rakhe thay (${formatPKR(total)}). ` +
    `Order complete karna chahte hain? Hum help kar sakte hain! 🛒`;
  const waHref = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : undefined;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-bold">{user?.name ?? "Customer"}</p>
            <p className="text-sm text-muted-foreground">
              {user?.phone ?? "phone nahi hai"} · {user?.email ?? ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cart update: {fmtDateTime(cart.updatedAt)}
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full">
            {lines.reduce((s, l) => s + l.item.qty, 0)} items · {formatPKR(total)}
          </Badge>
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          {lines.slice(0, 4).map((l) => (
            <li key={l.item.productId} className="flex justify-between gap-2">
              <Link
                href={`/product/${l.product!.slug || l.product!.id}`}
                className="truncate hover:underline"
              >
                {l.product!.name}
              </Link>
              <span className="shrink-0 text-muted-foreground">×{l.item.qty}</span>
            </li>
          ))}
          {lines.length > 4 && (
            <li className="text-xs text-muted-foreground">
              +{lines.length - 4} aur items…
            </li>
          )}
        </ul>
        <div className="mt-4">
          {waHref ? (
            <a href={waHref} target="_blank" rel="noopener noreferrer">
              <Button className="rounded-full bg-[#25D366] hover:brightness-95">
                <MessageCircle size={15} className="mr-1.5" /> WhatsApp Reminder
              </Button>
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">
              Customer ka phone number nahi hai — WhatsApp nahi bhej sakte.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AbandonedCartsPage() {
  const { data: carts, loading: cartsLoading } = useCollection<CartDoc>(COLLECTIONS.carts);
  const { data: orders, loading: ordersLoading } = useCollection<Order>(COLLECTIONS.orders);

  const abandoned = useMemo(() => {
    const cutoff = Date.now() - DAY_MS;
    // Har user ka aakhri order kab aaya?
    const lastOrderByUser = new Map<string, number>();
    for (const o of orders) {
      const t = tsMillis(o.createdAt);
      const prev = lastOrderByUser.get(o.userId) ?? 0;
      if (t > prev) lastOrderByUser.set(o.userId, t);
    }
    return carts
      .filter((c) => {
        const updated = tsMillis(c.updatedAt);
        if (!updated || updated > cutoff) return false; // 24h se nayi
        if ((c.items ?? []).length === 0) return false; // khaali cart
        const lastOrder = lastOrderByUser.get(c.userId) ?? 0;
        return lastOrder < updated; // cart ke baad koi order nahi
      })
      .sort((a, b) => tsMillis(a.updatedAt) - tsMillis(b.updatedAt));
  }, [carts, orders]);

  if (!isFirebaseConfigured()) return <SetupWarning feature="Abandoned carts" />;
  const loading = cartsLoading || ordersLoading;

  return (
    <div>
      <PageHeader
        title="Abandoned Carts"
        subtitle="24+ ghante purani carts jin par order nahi hua — WhatsApp reminder bhejo"
      />
      {loading ? (
        <LoadingState rows={4} />
      ) : abandoned.length === 0 ? (
        <EmptyState
          title="Koi abandoned cart nahi"
          description="Sab customers ne order kar liya — ya carts 24 ghante se nayi hain."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {abandoned.map((c) => (
            <AbandonedRow key={c.id} cart={c} />
          ))}
        </div>
      )}
    </div>
  );
}
