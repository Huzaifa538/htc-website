"use client";

/** New product page. */
import { isFirebaseConfigured } from "@/lib/firebase/client";
import SetupWarning from "@/components/admin/SetupWarning";
import ProductForm from "@/components/admin/product/ProductForm";
import { PageHeader } from "@/components/admin/ui";

export default function NewProductPage() {
  if (!isFirebaseConfigured()) return <SetupWarning feature="Product management" />;
  return (
    <>
      <PageHeader title="Add product" subtitle="Create a new product with variants." />
      <ProductForm />
    </>
  );
}
