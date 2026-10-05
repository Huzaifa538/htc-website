/**
 * /profile — account details, saved addresses (CRUD on users/{uid}),
 * order count, sign out. Login required.
 */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  Heart,
  Loader2,
  LogOut,
  MapPin,
  Package,
  Pencil,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { useAuth } from "@/components/providers";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal } from "@/components/customer/reveal";
import { EmptyState } from "@/components/customer/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOrders } from "@/components/customer/data-hooks";
import { useWishlistStore } from "@/lib/store/wishlist";
import type { AppUser, OrderAddress } from "@/lib/types";

const addressSchema = z.object({
  name: z.string().min(3, "Enter the recipient name"),
  phone: z
    .string()
    .min(10, "Enter a valid phone number")
    .regex(/^[+0-9][0-9\s-]{9,15}$/, "Enter a valid phone number"),
  address: z.string().min(10, "Enter the complete street address"),
  city: z.string().min(2, "Enter the city"),
});

type AddressForm = z.infer<typeof addressSchema>;

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { orders } = useOrders(user?.uid);
  const wishlistCount = useWishlistStore((s) => s.productIds.length);

  const [addresses, setAddresses] = useState<OrderAddress[]>([]);
  const [loadingAddr, setLoadingAddr] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressForm>({ resolver: zodResolver(addressSchema) });

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/profile");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user || !db || !isFirebaseConfigured()) {
      setLoadingAddr(false);
      return;
    }
    getDoc(doc(db, COLLECTIONS.users, user.uid))
      .then((snap) => {
        if (snap.exists()) {
          setAddresses((snap.data() as AppUser).addresses ?? []);
        }
        setLoadingAddr(false);
      })
      .catch(() => setLoadingAddr(false));
  }, [user]);

  async function persist(next: OrderAddress[]) {
    if (!db || !user) return;
    await setDoc(
      doc(db, COLLECTIONS.users, user.uid),
      {
        email: user.email ?? "",
        name: user.displayName ?? next[0]?.name ?? "",
        addresses: next,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    setAddresses(next);
  }

  function openAdd() {
    setEditing(null);
    reset({ name: user?.displayName ?? "", phone: "", address: "", city: "" });
    setDialogOpen(true);
  }

  function openEdit(i: number) {
    setEditing(i);
    reset(addresses[i]!);
    setDialogOpen(true);
  }

  async function onSubmit(data: AddressForm) {
    setSaving(true);
    try {
      const next = [...addresses];
      if (editing == null) next.push(data);
      else next[editing] = data;
      await persist(next.slice(-5));
      toast.success(editing == null ? "Address added" : "Address updated");
      setDialogOpen(false);
    } catch {
      toast.error("Could not save address — please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAddress(i: number) {
    try {
      await persist(addresses.filter((_, x) => x !== i));
      toast("Address removed");
    } catch {
      toast.error("Could not remove address.");
    }
  }

  if (authLoading) {
    return (
      <SiteShell>
        <div className="container flex min-h-[50vh] items-center justify-center">
          <Loader2 className="animate-spin text-[#D21F26]" size={36} />
        </div>
      </SiteShell>
    );
  }

  if (!user) {
    return (
      <SiteShell>
        <div className="container py-16">
          <EmptyState
            title="Sign in required"
            description="Sign in to view your profile."
            actionLabel="Sign In"
            actionHref="/login?next=/profile"
          />
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="container max-w-4xl py-10">
        <Reveal>
          <div className="flex flex-wrap items-center gap-5 rounded-3xl bg-[#FBF3E4] p-6 sm:p-8 dark:bg-stone-900/60">
            {user.photoURL ? (
              <Image
                src={user.photoURL}
                alt=""
                width={72}
                height={72}
                className="h-[72px] w-[72px] rounded-full object-cover"
              />
            ) : (
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#D21F26]/15 text-[#D21F26]">
                <User size={32} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-2xl font-extrabold">
                {user.displayName ?? "Customer"}
              </h1>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                void signOut();
                router.push("/");
              }}
              className="rounded-full"
            >
              <LogOut size={15} className="mr-2" /> Sign out
            </Button>
          </div>
        </Reveal>

        {/* Quick stats */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <Link
            href="/orders"
            className="flex items-center gap-4 rounded-3xl border bg-card p-5 transition hover:shadow-lg"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D21F26]/10 text-[#D21F26]">
              <Package size={22} />
            </span>
            <span>
              <span className="block font-display text-2xl font-extrabold">
                {orders.length}
              </span>
              <span className="text-sm text-muted-foreground">Orders</span>
            </span>
          </Link>
          <Link
            href="/wishlist"
            className="flex items-center gap-4 rounded-3xl border bg-card p-5 transition hover:shadow-lg"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D21F26]/10 text-[#D21F26]">
              <Heart size={22} />
            </span>
            <span>
              <span className="block font-display text-2xl font-extrabold">
                {wishlistCount}
              </span>
              <span className="text-sm text-muted-foreground">Wishlist items</span>
            </span>
          </Link>
        </div>

        {/* Addresses */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
              <MapPin size={20} className="text-[#D21F26]" /> Saved Addresses
            </h2>
            <Button onClick={openAdd} className="rounded-full bg-[#D21F26] hover:bg-[#a8161c]">
              <Plus size={15} className="mr-1.5" /> Add
            </Button>
          </div>
          {loadingAddr ? (
            <div className="mt-4 flex justify-center py-8">
              <Loader2 className="animate-spin text-[#D21F26]" size={28} />
            </div>
          ) : addresses.length === 0 ? (
            <p className="mt-4 rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No saved addresses yet — add one to check out faster.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {addresses.map((a, i) => (
                <div key={i} className="rounded-3xl border bg-card p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold">{a.name}</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(i)}
                        aria-label="Edit address"
                        className="rounded-full p-2 hover:bg-muted"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => removeAddress(i)}
                        aria-label="Delete address"
                        className="rounded-full p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {a.address}, {a.city}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{a.phone}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing == null ? "Add Address" : "Edit Address"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <div>
              <Label>Recipient name *</Label>
              <Input {...register("name")} className="mt-1.5 rounded-xl" />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div>
              <Label>Phone *</Label>
              <Input {...register("phone")} className="mt-1.5 rounded-xl" />
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
            </div>
            <div>
              <Label>Street address *</Label>
              <Textarea {...register("address")} rows={2} className="mt-1.5 rounded-xl" />
              {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address.message}</p>}
            </div>
            <div>
              <Label>City *</Label>
              <Input {...register("city")} className="mt-1.5 rounded-xl" />
              {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city.message}</p>}
            </div>
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-full bg-[#D21F26] hover:bg-[#a8161c]"
              >
                {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                Save Address
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="rounded-full"
              >
                <X size={16} />
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SiteShell>
  );
}
