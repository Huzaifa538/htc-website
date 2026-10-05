"use client";

/** Edit product page. */
import { useParams } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Product } from "@/lib/types";
import { useDoc } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import ProductForm from "@/components/admin/product/ProductForm";
import { PageHeader, LoadingState, EmptyState } from "@/components/admin/ui";

export default function EditProductPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : undefined;
  const { data: product, loading } = useDoc<Product>(COLLECTIONS.products, id);

  if (!isFirebaseConfigured()) return <SetupWarning feature="Product management" />;

  return (
    <>
      <PageHeader
        title={product ? `Edit: ${product.name}` : "Edit product"}
        subtitle={product ? `SKU ${product.sku}` : undefined}
      />
      {loading ? (
        <LoadingState rows={10} />
      ) : !product ? (
        <EmptyState title="Product not found" description="It may have been deleted." />
      ) : (
        <ProductForm product={product} />
      )}
    </>
  );
}
