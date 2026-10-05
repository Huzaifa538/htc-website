"use client";

/**
 * Image Fixer: Quick visual review and replacement of product images.
 * Shows all products in a grid with their current images.
 * Click any product to upload a replacement image.
 */
import { useMemo, useRef, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Search, Upload, Check, Loader2 } from "lucide-react";

import { db } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Product } from "@/lib/types";
import { useCollection } from "@/components/admin/firebase";
import { PageHeader, LoadingState, EmptyState } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function ImageFixerPage() {
  const { data: products, loading } = useCollection<Product>(COLLECTIONS.products);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [fixed, setFixed] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const handleFileSelect = (product: Product) => {
    setActiveProduct(product);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProduct) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Sirf image file upload karein");
      return;
    }

    setUploading(activeProduct.id);
    try {
      if (!db) throw new Error("Firebase not configured");
      // Upload to Vercel Blob via /api/upload
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url } = await uploadRes.json();

      // Update product images in Firestore (replace first image)
      const productRef = doc(db, COLLECTIONS.products, activeProduct.id);
      const currentImages = activeProduct.images || [];
      const newImages = currentImages.length > 0 
        ? [url, ...currentImages.slice(1)]
        : [url];
      
      await updateDoc(productRef, { images: newImages });
      
      setFixed(prev => new Set(prev).add(activeProduct.id));
      toast.success(`${activeProduct.name.substring(0, 30)}... ki image update ho gayi!`);
    } catch (err) {
      toast.error("Image upload fail ho gaya");
      console.error(err);
    } finally {
      setUploading(null);
      setActiveProduct(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Image Fixer"
        subtitle={`${products.length} products • ${fixed.size} fixed iss session mein • Galat image par click karke sahi wali upload karein`}
      />

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Product search karein..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary">
          {sorted.length} products
        </Badge>
        {fixed.size > 0 && (
          <Badge variant="default" className="bg-green-600">
            <Check className="h-3 w-3 mr-1" /> {fixed.size} fixed
          </Badge>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {sorted.length === 0 ? (
        <EmptyState title="Koi product nahi mila" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {sorted.map((product) => {
            const img = product.images?.[0];
            const isFixed = fixed.has(product.id);
            const isUploading = uploading === product.id;
            
            return (
              <div
                key={product.id}
                className={`relative group border rounded-lg overflow-hidden bg-card hover:shadow-lg transition-shadow ${
                  isFixed ? "ring-2 ring-green-500" : ""
                }`}
              >
                <div className="aspect-square relative bg-muted">
                  {img ? (
                    <img
                      src={img}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      No image
                    </div>
                  )}
                  
                  {isFixed && (
                    <div className="absolute top-2 right-2 bg-green-600 text-white rounded-full p-1">
                      <Check className="h-4 w-4" />
                    </div>
                  )}

                  <button
                    onClick={() => handleFileSelect(product)}
                    disabled={isUploading}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white"
                  >
                    {isUploading ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-8 w-8" />
                        <span className="text-xs font-medium px-2 text-center">
                          Sahi image upload karein
                        </span>
                      </>
                    )}
                  </button>
                </div>
                
                <div className="p-2">
                  <p className="text-xs font-medium truncate" title={product.name}>
                    {product.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {product.sku}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
