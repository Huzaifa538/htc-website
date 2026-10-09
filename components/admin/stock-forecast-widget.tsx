/**
 * Stock forecast widget — admin dashboard ke liye.
 * Batata hai kaunsa product kitne din chalega aur kitna
 * reorder karna chahiye (sales trend ki buniyad par).
 */
"use client";

import { useMemo } from "react";
import { TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCollection } from "@/components/admin/firebase";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Order, Product } from "@/lib/types";
import { forecastDemand } from "@/lib/forecast";

export function StockForecastWidget() {
  const { data: products } = useCollection<Product>(COLLECTIONS.products);
  const { data: orders } = useCollection<Order>(COLLECTIONS.orders);

  const forecasts = useMemo(() => {
    if (products.length === 0) return [];
    return forecastDemand(products, orders)
      .filter((f) => f.status === "low")
      .sort((a, b) => a.daysOfStock - b.daysOfStock)
      .slice(0, 5);
  }, [products, orders]);

  const nameOf = (id: string) =>
    products.find((p) => p.id === id)?.name ?? id;

  if (forecasts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-amber-600" />
          Stock Forecast
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          Sales trend ke hisaab se ye products jald khatm hone wale hain:
        </p>
        <div className="space-y-2">
          {forecasts.map((f) => (
            <div
              key={f.productId}
              className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{nameOf(f.productId)}</p>
                <p className="text-xs text-muted-foreground">
                  ~{f.daysOfStock === 999 ? "—" : Math.round(f.daysOfStock)} din ka stock bacha
                </p>
              </div>
              {f.suggestedReorder > 0 && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  +{f.suggestedReorder} mangwao
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
