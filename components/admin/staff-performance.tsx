/**
 * Staff performance — har staff member ne kitne orders handle kiye.
 *
 * Orders par "assignedTo" (staff email) set hota hai order detail page se.
 * Yahan per-staff stats nikalte hain: assigned orders, delivered,
 * total revenue handled.
 */
"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";

import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Order, StaffMember, WithId } from "@/lib/types";
import { formatPKR } from "@/lib/format";
import { useCollection } from "@/components/admin/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, EmptyState } from "@/components/admin/ui";

export function StaffPerformance({ staff }: { staff: WithId<StaffMember>[] }) {
  const { data: orders, loading } = useCollection<Order>(COLLECTIONS.orders);

  const stats = useMemo(() => {
    return staff.map((s) => {
      const mine = orders.filter((o) => o.assignedTo === s.email);
      const delivered = mine.filter((o) => o.status === "Delivered").length;
      const revenue = mine
        .filter((o) => o.status !== "Cancelled")
        .reduce((sum, o) => sum + (o.total ?? 0), 0);
      return { member: s, assigned: mine.length, delivered, revenue };
    });
  }, [staff, orders]);

  const totalAssigned = stats.reduce((s, x) => s + x.assigned, 0);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp size={17} className="text-[#D21F26]" />
          Performance — orders handled
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingState rows={3} />
        ) : totalAssigned === 0 ? (
          <EmptyState
            title="Abhi koi assignment nahi"
            description="Order detail page par jaa kar orders staff ko assign karo — phir yahan stats nazar ayenge."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map(({ member, assigned, delivered, revenue }) => (
              <div key={member.id} className="rounded-2xl border p-4">
                <p className="truncate font-bold">{member.name}</p>
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="font-display text-xl font-extrabold">{assigned}</p>
                    <p className="text-[11px] text-muted-foreground">Assigned</p>
                  </div>
                  <div>
                    <p className="font-display text-xl font-extrabold text-emerald-600">{delivered}</p>
                    <p className="text-[11px] text-muted-foreground">Delivered</p>
                  </div>
                  <div>
                    <p className="font-display text-sm font-extrabold">{formatPKR(revenue)}</p>
                    <p className="text-[11px] text-muted-foreground">Revenue</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
