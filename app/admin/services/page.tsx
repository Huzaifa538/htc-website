"use client";

/**
 * Services: CRUD (name, description, image, starting price, icon) plus a
 * service-inquiry pipeline board (New → Contacted → Closed).
 */
import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Phone, Mail, ArrowRight } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Service, ServiceInquiry } from "@/lib/types";
import { formatPKR } from "@/lib/format";
import { useCollection, fmtDateTime, slugify } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import ImageUpload from "@/components/admin/ImageUpload";
import { TextField, TextAreaField, SwitchField } from "@/components/admin/FormFields";
import { PageHeader, EmptyState, LoadingState, ConfirmDialog, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().min(10, "Description should be at least 10 characters"),
  icon: z.string().optional(),
  priceFrom: z.coerce.number().min(0).optional().or(z.literal("")),
  order: z.coerce.number().int().default(0),
  enabled: z.boolean().default(true),
});

type FormValues = z.input<typeof schema>;

const INQUIRY_STAGES: ServiceInquiry["status"][] = ["New", "Contacted", "Closed"];

export default function ServicesPage() {
  const { data: services, loading } = useCollection<Service>(COLLECTIONS.services);
  const { data: inquiries } = useCollection<ServiceInquiry>(COLLECTIONS.serviceInquiries);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [image, setImage] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<Service | null>(null);
  const [confirmInqDelete, setConfirmInqDelete] = useState<ServiceInquiry | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", icon: "", priceFrom: "", order: 0, enabled: true },
  });
  const { control, handleSubmit, reset } = form;

  const sorted = useMemo(
    () => services.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [services]
  );

  const openCreate = () => {
    setEditing(null);
    reset({ name: "", description: "", icon: "", priceFrom: "", order: services.length, enabled: true });
    setImage([]);
    setDialogOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    reset({
      name: s.name,
      description: s.description,
      icon: s.icon ?? "",
      priceFrom: s.priceFrom ?? ("" as unknown as number),
      order: s.order ?? 0,
      enabled: s.enabled,
    });
    setImage(s.image ? [s.image] : []);
    setDialogOpen(true);
  };

  const onSubmit = async (values: FormValues) => {
    if (!db) return;
    if (image.length === 0) {
      toast.error("Please upload a service image.");
      return;
    }
    try {
      const payload = {
        name: values.name.trim(),
        slug: slugify(values.name),
        description: values.description.trim(),
        image: image[0]!,
        icon: values.icon?.trim() || null,
        priceFrom:
          values.priceFrom === "" || values.priceFrom == null
            ? null
            : Number(values.priceFrom),
        order: values.order ?? 0,
        enabled: values.enabled,
      };
      if (editing) {
        await updateDoc(doc(db, COLLECTIONS.services, editing.id), payload);
        toast.success("Service updated.");
      } else {
        await addDoc(collection(db, COLLECTIONS.services), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Service created.");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Save failed.");
    }
  };

  const toggleEnabled = async (s: Service) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.services, s.id), { enabled: !s.enabled });
    } catch {
      toast.error("Update failed.");
    }
  };

  const doDelete = async () => {
    if (!db || !confirmDelete) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.services, confirmDelete.id));
      toast.success("Service deleted.");
    } catch {
      toast.error("Delete failed.");
    }
  };

  const moveInquiry = async (inq: ServiceInquiry, status: ServiceInquiry["status"]) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.serviceInquiries, inq.id), { status });
    } catch {
      toast.error("Update failed.");
    }
  };

  const deleteInquiry = async () => {
    if (!db || !confirmInqDelete) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.serviceInquiries, confirmInqDelete.id));
      toast.success("Inquiry deleted.");
    } catch {
      toast.error("Delete failed.");
    }
  };

  const newCount = inquiries.filter((i) => i.status === "New").length;

  if (!isFirebaseConfigured()) return <SetupWarning feature="Service management" />;
  if (loading)
    return (
      <>
        <PageHeader title="Services" />
        <LoadingState rows={6} />
      </>
    );

  return (
    <>
      <PageHeader
        title="Services"
        subtitle={`${services.length} services · ${newCount} new inquiries`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add service
          </Button>
        }
      />

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="inquiries">
            Inquiries {newCount > 0 && <Badge className="ml-1 bg-primary">{newCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-4">
          {sorted.length === 0 ? (
            <EmptyState
              title="No services yet"
              description="Add interior-design services offered by HTC."
              action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add service</Button>}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sorted.map((s) => (
                <Card key={s.id} className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image} alt={s.name} className="h-40 w-full object-cover" />
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">
                        {s.icon && <span className="mr-1">{s.icon}</span>}
                        {s.name}
                      </p>
                      <Badge variant={s.enabled ? "default" : "secondary"}>
                        {s.enabled ? "On" : "Off"}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                    {s.priceFrom != null && (
                      <p className="text-sm font-semibold text-primary">
                        From {formatPKR(s.priceFrom)}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(s)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void toggleEnabled(s)}>
                        {s.enabled ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inquiries" className="mt-4">
          {inquiries.length === 0 ? (
            <EmptyState title="No inquiries yet" description="Customer service inquiries will appear here." />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {INQUIRY_STAGES.map((stage) => {
                const items = inquiries
                  .filter((i) => i.status === stage)
                  .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
                return (
                  <Card key={stage}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-base">
                        <StatusBadge status={stage} />
                        <span className="text-sm text-muted-foreground">{items.length}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {items.map((inq) => {
                        const next = INQUIRY_STAGES[INQUIRY_STAGES.indexOf(stage) + 1];
                        return (
                          <div key={inq.id} className="rounded-lg border p-3 text-sm">
                            <p className="font-medium">{inq.name}</p>
                            <p className="text-xs text-primary">{inq.serviceName}</p>
                            <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{inq.message}</p>
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              <p className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {inq.phone}
                              </p>
                              {inq.email && (
                                <p className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {inq.email}
                                </p>
                              )}
                              <p>{fmtDateTime(inq.createdAt)}</p>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              {next ? (
                                <Button size="sm" variant="outline" onClick={() => void moveInquiry(inq, next)}>
                                  {next} <ArrowRight className="ml-1 h-3 w-3" />
                                </Button>
                              ) : (
                                <span />
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => setConfirmInqDelete(inq)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      {items.length === 0 && (
                        <p className="py-6 text-center text-xs text-muted-foreground">Empty</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit service" : "New service"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <TextField control={control} name="name" label="Service name" placeholder="e.g. Modular Kitchen Design" />
            <TextAreaField control={control} name="description" label="Description" rows={4} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={control} name="icon" label="Icon" placeholder="Lucide name or emoji" />
              <TextField control={control} name="priceFrom" label="Starting price (PKR)" type="number" placeholder="Optional" />
            </div>
            <TextField control={control} name="order" label="Sort order" type="number" />
            <ImageUpload value={image} onChange={setImage} folder="services" multiple={false} max={1} compact label="Service image" hint="(required)" />
            <SwitchField control={control} name="enabled" label="Enabled" hint="Visible on the storefront" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save changes" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete service?"
        description={`"${confirmDelete?.name}" will be permanently deleted.`}
        onConfirm={() => {
          void doDelete();
          setConfirmDelete(null);
        }}
      />
      <ConfirmDialog
        open={confirmInqDelete !== null}
        onOpenChange={(o) => !o && setConfirmInqDelete(null)}
        title="Delete inquiry?"
        description={`Inquiry from "${confirmInqDelete?.name}" will be permanently deleted.`}
        onConfirm={() => {
          void deleteInquiry();
          setConfirmInqDelete(null);
        }}
      />
    </>
  );
}
