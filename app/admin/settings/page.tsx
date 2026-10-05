"use client";

/**
 * Site settings: edits the single siteSettings/main doc per lib/types.ts —
 * site name, tagline, logo, contact info, social links, announcement bar,
 * free-shipping threshold — plus a coupons manager.
 */
import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, TicketPercent, Truck, MessageCircle } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Coupon, IntegrationSettings, SiteSettings } from "@/lib/types";
import { formatPKR } from "@/lib/format";
import { useCollection, useDoc, fmtDate, timestampToDateInput, dateInputToTimestamp } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import ImageUpload from "@/components/admin/ImageUpload";
import { TextField, TextAreaField, SwitchField } from "@/components/admin/FormFields";
import { PageHeader, EmptyState, LoadingState, ConfirmDialog } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SETTINGS_DOC_ID = "main";

const settingsSchema = z.object({
  siteName: z.string().min(2, "Site name is required"),
  tagline: z.string().optional(),
  whatsappNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  facebookUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
  tiktokUrl: z.string().optional(),
  youtubeUrl: z.string().optional(),
  announcementBar: z.string().optional(),
  freeShippingThreshold: z.coerce.number().min(0).optional().or(z.literal("")),
});
type SettingsValues = z.input<typeof settingsSchema>;

/* Integration keys (courier + WhatsApp) — stored on siteSettings/main too. */
const integrationSchema = z.object({
  courierTcsApiKey: z.string().optional(),
  courierTcsApiSecret: z.string().optional(),
  courierTcsAccountNo: z.string().optional(),
  courierLeopardsApiKey: z.string().optional(),
  courierLeopardsApiSecret: z.string().optional(),
  courierLeopardsAccountNo: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional(),
  whatsappAccessToken: z.string().optional(),
  whatsappOwnerNumber: z.string().optional(),
});
type IntegrationValues = z.input<typeof integrationSchema>;

const EMPTY_INTEGRATIONS: IntegrationValues = {
  courierTcsApiKey: "", courierTcsApiSecret: "", courierTcsAccountNo: "",
  courierLeopardsApiKey: "", courierLeopardsApiSecret: "", courierLeopardsAccountNo: "",
  whatsappPhoneNumberId: "", whatsappAccessToken: "", whatsappOwnerNumber: "",
};

const couponSchema = z.object({
  code: z.string().min(2, "Code is required"),
  type: z.enum(["percent", "flat"]),
  value: z.coerce.number().min(0, "Value must be ≥ 0"),
  minOrder: z.coerce.number().min(0).optional().or(z.literal("")),
  maxUses: z.coerce.number().int().min(1).optional().or(z.literal("")),
  expiresAt: z.string().optional(),
  enabled: z.boolean().default(true),
});
type CouponValues = z.input<typeof couponSchema>;

export default function SettingsPage() {
  const { data: settings, loading } = useDoc<SiteSettings & IntegrationSettings>(COLLECTIONS.siteSettings, SETTINGS_DOC_ID);
  const { data: coupons, loading: couponsLoading } = useCollection<Coupon>(COLLECTIONS.coupons);

  const [logo, setLogo] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [slotsText, setSlotsText] = useState("");
  const [savingSlots, setSavingSlots] = useState(false);
  const [savingIntegrations, setSavingIntegrations] = useState(false);

  const [couponDialog, setCouponDialog] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [confirmCouponDelete, setConfirmCouponDelete] = useState<Coupon | null>(null);

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      siteName: "", tagline: "", whatsappNumber: "", phone: "", email: "",
      address: "", facebookUrl: "", instagramUrl: "", tiktokUrl: "",
      youtubeUrl: "", announcementBar: "", freeShippingThreshold: "",
    },
  });
  const { control, handleSubmit, reset } = form;

  useEffect(() => {
    if (settings) {
      reset({
        siteName: settings.siteName ?? "",
        tagline: settings.tagline ?? "",
        whatsappNumber: settings.whatsappNumber ?? "",
        phone: settings.phone ?? "",
        email: settings.email ?? "",
        address: settings.address ?? "",
        facebookUrl: settings.facebookUrl ?? "",
        instagramUrl: settings.instagramUrl ?? "",
        tiktokUrl: settings.tiktokUrl ?? "",
        youtubeUrl: settings.youtubeUrl ?? "",
        announcementBar: settings.announcementBar ?? "",
        freeShippingThreshold: settings.freeShippingThreshold ?? ("" as unknown as number),
      });
      setLogo(settings.logoUrl ? [settings.logoUrl] : []);
      setSlotsText((settings.appointmentTimeSlots ?? []).join("\n"));
    }
  }, [settings, reset]);

  const couponForm = useForm<CouponValues>({
    resolver: zodResolver(couponSchema),
    defaultValues: { code: "", type: "percent", value: 10, minOrder: "", maxUses: "", expiresAt: "", enabled: true },
  });

  const integrationForm = useForm<IntegrationValues>({
    resolver: zodResolver(integrationSchema),
    defaultValues: EMPTY_INTEGRATIONS,
  });

  useEffect(() => {
    if (settings) {
      integrationForm.reset({
        courierTcsApiKey: settings.courierTcsApiKey ?? "",
        courierTcsApiSecret: settings.courierTcsApiSecret ?? "",
        courierTcsAccountNo: settings.courierTcsAccountNo ?? "",
        courierLeopardsApiKey: settings.courierLeopardsApiKey ?? "",
        courierLeopardsApiSecret: settings.courierLeopardsApiSecret ?? "",
        courierLeopardsAccountNo: settings.courierLeopardsAccountNo ?? "",
        whatsappPhoneNumberId: settings.whatsappPhoneNumberId ?? "",
        whatsappAccessToken: settings.whatsappAccessToken ?? "",
        whatsappOwnerNumber: settings.whatsappOwnerNumber ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const onSaveSettings = async (values: SettingsValues) => {
    if (!db) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, COLLECTIONS.siteSettings, SETTINGS_DOC_ID),
        {
          siteName: values.siteName.trim(),
          tagline: values.tagline?.trim() ?? "",
          logoUrl: logo[0] ?? "",
          whatsappNumber: values.whatsappNumber?.trim() ?? "",
          phone: values.phone?.trim() ?? "",
          email: values.email?.trim() ?? "",
          address: values.address?.trim() ?? "",
          facebookUrl: values.facebookUrl?.trim() || null,
          instagramUrl: values.instagramUrl?.trim() || null,
          tiktokUrl: values.tiktokUrl?.trim() || null,
          youtubeUrl: values.youtubeUrl?.trim() || null,
          announcementBar: values.announcementBar?.trim() || null,
          freeShippingThreshold:
            values.freeShippingThreshold === "" || values.freeShippingThreshold == null
              ? null
              : Number(values.freeShippingThreshold),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast.success("Settings saved.");
    } catch {
      toast.error("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  /* ----------------------------- integrations ----------------------------- */

  const onSaveIntegrations = async (values: IntegrationValues) => {
    if (!db) return;
    setSavingIntegrations(true);
    try {
      await setDoc(
        doc(db, COLLECTIONS.siteSettings, SETTINGS_DOC_ID),
        {
          courierTcsApiKey: values.courierTcsApiKey?.trim() || null,
          courierTcsApiSecret: values.courierTcsApiSecret?.trim() || null,
          courierTcsAccountNo: values.courierTcsAccountNo?.trim() || null,
          courierLeopardsApiKey: values.courierLeopardsApiKey?.trim() || null,
          courierLeopardsApiSecret: values.courierLeopardsApiSecret?.trim() || null,
          courierLeopardsAccountNo: values.courierLeopardsAccountNo?.trim() || null,
          whatsappPhoneNumberId: values.whatsappPhoneNumberId?.trim() || null,
          whatsappAccessToken: values.whatsappAccessToken?.trim() || null,
          whatsappOwnerNumber: values.whatsappOwnerNumber?.replace(/\D/g, "") || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast.success("Integration settings saved.");
    } catch {
      toast.error("Save failed.");
    } finally {
      setSavingIntegrations(false);
    }
  };

  /* ------------------------- appointment time slots ------------------------ */

  const onSaveSlots = async () => {
    if (!db) return;
    const slots = slotsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    setSavingSlots(true);
    try {
      await setDoc(
        doc(db, COLLECTIONS.siteSettings, SETTINGS_DOC_ID),
        { appointmentTimeSlots: slots, updatedAt: serverTimestamp() },
        { merge: true }
      );
      toast.success("Time slots saved.");
    } catch {
      toast.error("Save failed.");
    } finally {
      setSavingSlots(false);
    }
  };

  /* ------------------------------- coupons ------------------------------- */

  const openCouponCreate = () => {
    setEditingCoupon(null);
    couponForm.reset({ code: "", type: "percent", value: 10, minOrder: "", maxUses: "", expiresAt: "", enabled: true });
    setCouponDialog(true);
  };

  const openCouponEdit = (c: Coupon) => {
    setEditingCoupon(c);
    couponForm.reset({
      code: c.code,
      type: c.type,
      value: c.value,
      minOrder: c.minOrder ?? ("" as unknown as number),
      maxUses: c.maxUses ?? ("" as unknown as number),
      expiresAt: timestampToDateInput(c.expiresAt),
      enabled: c.enabled,
    });
    setCouponDialog(true);
  };

  const submitCoupon = async (values: CouponValues) => {
    if (!db) return;
    if (values.type === "percent" && Number(values.value) > 100) {
      toast.error("Percent discount cannot exceed 100%.");
      return;
    }
    try {
      const payload = {
        code: values.code.trim().toUpperCase(),
        type: values.type,
        value: Number(values.value),
        minOrder: values.minOrder === "" || values.minOrder == null ? null : Number(values.minOrder),
        maxUses: values.maxUses === "" || values.maxUses == null ? null : Math.floor(Number(values.maxUses)),
        expiresAt: values.expiresAt ? dateInputToTimestamp(values.expiresAt) : null,
        enabled: values.enabled,
      };
      if (editingCoupon) {
        await updateDoc(doc(db, COLLECTIONS.coupons, editingCoupon.id), payload);
        toast.success("Coupon updated.");
      } else {
        const dup = coupons.some((c) => c.code.toUpperCase() === payload.code);
        if (dup) {
          toast.error("A coupon with this code already exists.");
          return;
        }
        await addDoc(collection(db, COLLECTIONS.coupons), {
          ...payload,
          usedCount: 0,
          createdAt: serverTimestamp(),
        });
        toast.success("Coupon created.");
      }
      setCouponDialog(false);
    } catch {
      toast.error("Save failed.");
    }
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Site settings" />;
  if (loading || couponsLoading)
    return (
      <>
        <PageHeader title="Site Settings" />
        <LoadingState rows={8} />
      </>
    );

  return (
    <>
      <PageHeader title="Site Settings" subtitle="Store identity, contact info, announcement, coupons and integrations." />

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="contact">Contact & socials</TabsTrigger>
          <TabsTrigger value="announcement">Announcement</TabsTrigger>
          <TabsTrigger value="courier">
            <Truck className="mr-1 h-3.5 w-3.5" /> Courier
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <MessageCircle className="mr-1 h-3.5 w-3.5" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="coupons">
            Coupons <Badge className="ml-1 bg-primary">{coupons.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* general */}
        <TabsContent value="general" className="mt-4">
          <form onSubmit={handleSubmit(onSaveSettings)} className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Store identity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <TextField control={control} name="siteName" label="Site name" placeholder="Hammer Trading" />
                <TextField control={control} name="tagline" label="Tagline" placeholder="Handcrafted furniture & interiors" />
                <TextField
                  control={control}
                  name="freeShippingThreshold"
                  label="Free-shipping threshold (PKR)"
                  type="number"
                  hint="Optional — orders above this get free shipping"
                />
              </CardContent>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Logo</CardTitle>
                </CardHeader>
                <CardContent>
                  <ImageUpload value={logo} onChange={setLogo} folder="site" multiple={false} max={1} compact label="Site logo" />
                </CardContent>
              </Card>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* contact */}
        <TabsContent value="contact" className="mt-4">
          <form onSubmit={handleSubmit(onSaveSettings)} className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Contact info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <TextField control={control} name="whatsappNumber" label="WhatsApp number" placeholder="+92 3XX XXXXXXX" />
                <TextField control={control} name="phone" label="Phone" placeholder="+92 42 XXXXXXXX" />
                <TextField control={control} name="email" label="Email" placeholder="info@htc.pk" />
                <TextAreaField control={control} name="address" label="Address" rows={3} placeholder="Showroom address" />
              </CardContent>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Social links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <TextField control={control} name="facebookUrl" label="Facebook URL" placeholder="https://facebook.com/…" />
                  <TextField control={control} name="instagramUrl" label="Instagram URL" placeholder="https://instagram.com/…" />
                  <TextField control={control} name="tiktokUrl" label="TikTok URL" placeholder="https://tiktok.com/…" />
                  <TextField control={control} name="youtubeUrl" label="YouTube URL" placeholder="https://youtube.com/…" />
                </CardContent>
              </Card>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* announcement */}
        <TabsContent value="announcement" className="mt-4">
          <form onSubmit={handleSubmit(onSaveSettings)}>
            <Card>
              <CardHeader>
                <CardTitle>Announcement bar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <TextAreaField
                  control={control}
                  name="announcementBar"
                  label="Announcement text"
                  rows={3}
                  hint="Leave empty to hide the bar. Supports plain text."
                  placeholder="🚚 Free delivery on orders above Rs 50,000!"
                />
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save settings"}
                </Button>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* appointment time slots */}
        <TabsContent value="appointments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Consultation time slots</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="appt-slots">Time slots (one per line)</Label>
                <Textarea
                  id="appt-slots"
                  rows={6}
                  value={slotsText}
                  onChange={(e) => setSlotsText(e.target.value)}
                  placeholder={"10:00 AM – 12:00 PM\n12:00 PM – 2:00 PM\n2:00 PM – 4:00 PM\n4:00 PM – 6:00 PM"}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  These appear in the /book-consultation time-slot picker and
                  the admin reschedule dialog. Leave empty to use the defaults.
                </p>
              </div>
              <Button onClick={() => void onSaveSlots()} disabled={savingSlots}>
                {savingSlots ? "Saving…" : "Save time slots"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* courier integrations */}
        <TabsContent value="courier" className="mt-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-bold">Manual mode is active</p>
            <p className="mt-1">
              Live API booking is disabled until credentials are entered and
              verified. For now, use manual mode: book on the courier&apos;s
              portal, then enter the tracking number here (Courier → Book
              Courier).
            </p>
          </div>
          <form onSubmit={integrationForm.handleSubmit(onSaveIntegrations)} className="mt-4 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" /> TCS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <TextField control={integrationForm.control} name="courierTcsApiKey" label="TCS API Key" placeholder="Paste TCS API key" />
                <TextField control={integrationForm.control} name="courierTcsApiSecret" label="TCS API Secret" type="password" placeholder="Paste TCS API secret" hint="Never share this key — it stays in your database." />
                <TextField control={integrationForm.control} name="courierTcsAccountNo" label="TCS Account No" placeholder="Your TCS merchant account number" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" /> Leopards Courier
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <TextField control={integrationForm.control} name="courierLeopardsApiKey" label="Leopards API Key" placeholder="Paste Leopards API key" />
                <TextField control={integrationForm.control} name="courierLeopardsApiSecret" label="Leopards API Secret" type="password" placeholder="Paste Leopards API secret" hint="Never share this key — it stays in your database." />
                <TextField control={integrationForm.control} name="courierLeopardsAccountNo" label="Leopards Account No" placeholder="Your Leopards merchant account number" />
              </CardContent>
            </Card>
            <div className="lg:col-span-2">
              <Button type="submit" disabled={savingIntegrations}>
                {savingIntegrations ? "Saving…" : "Save integration settings"}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* whatsapp alerts */}
        <TabsContent value="whatsapp" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" /> WhatsApp Cloud API
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={integrationForm.handleSubmit(onSaveIntegrations)} className="space-y-4">
                  <TextField control={integrationForm.control} name="whatsappPhoneNumberId" label="Phone Number ID" placeholder="e.g. 123456789012345" hint="From the WhatsApp product in your Meta developer app." />
                  <TextField control={integrationForm.control} name="whatsappAccessToken" label="Access Token" type="password" placeholder="Paste token" hint="Never share this token — it stays in your database." />
                  <TextField control={integrationForm.control} name="whatsappOwnerNumber" label="Owner WhatsApp number" placeholder="e.g. 923001234567" hint="Where new-order alerts are sent. Digits only, with country code." />
                  <Button type="submit" disabled={savingIntegrations}>
                    {savingIntegrations ? "Saving…" : "Save integration settings"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Setup steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                    <span>Create a Meta developer app at <span className="font-mono font-bold">developers.facebook.com</span>.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                    <span>Add the <span className="font-bold">WhatsApp</span> product → copy the <span className="font-bold">Phone Number ID</span> and a temporary or permanent <span className="font-bold">access token</span>.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                    <span>Paste them here and save — new-order alerts will then be sent over the official WhatsApp Cloud API.</span>
                  </li>
                </ol>
                <div className="rounded-xl border p-3 text-xs text-muted-foreground">
                  <p className="font-bold text-foreground">Good to know</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    <li>WhatsApp free tier: <span className="font-bold">1,000 service conversations/month</span>.</li>
                    <li>Only the official Meta WhatsApp Cloud API is used — no unofficial APIs.</li>
                    <li>Until credentials are saved, order alerts are stored as admin notifications instead.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* coupons */}
        <TabsContent value="coupons" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCouponCreate}>
              <Plus className="mr-2 h-4 w-4" /> New coupon
            </Button>
          </div>
          {coupons.length === 0 ? (
            <EmptyState
              title="No coupons yet"
              description="Create discount codes for your customers."
              action={
                <Button onClick={openCouponCreate}>
                  <TicketPercent className="mr-2 h-4 w-4" /> New coupon
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Min order</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm font-bold">{c.code}</code>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {c.type === "percent" ? `${c.value}%` : formatPKR(c.value)}
                      </TableCell>
                      <TableCell>{c.minOrder != null ? formatPKR(c.minOrder) : "—"}</TableCell>
                      <TableCell>
                        {c.usedCount ?? 0}{c.maxUses != null ? ` / ${c.maxUses}` : ""}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(c.expiresAt)}</TableCell>
                      <TableCell>
                        <Badge variant={c.enabled ? "default" : "secondary"}>
                          {c.enabled ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openCouponEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setConfirmCouponDelete(c)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* coupon dialog */}
      <Dialog open={couponDialog} onOpenChange={setCouponDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCoupon ? "Edit coupon" : "New coupon"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={couponForm.handleSubmit(submitCoupon)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={couponForm.control} name="code" label="Code" placeholder="EID20" hint="Uppercase recommended" />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Discount type</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={couponForm.watch("type")}
                  onChange={(e) => couponForm.setValue("type", e.target.value as "percent" | "flat")}
                >
                  <option value="percent">Percent (%)</option>
                  <option value="flat">Flat (PKR)</option>
                </select>
              </div>
              <TextField control={couponForm.control} name="value" label={couponForm.watch("type") === "percent" ? "Percent (0–100)" : "Amount (PKR)"} type="number" />
              <TextField control={couponForm.control} name="minOrder" label="Min order (PKR)" type="number" placeholder="Optional" />
              <TextField control={couponForm.control} name="maxUses" label="Usage limit" type="number" placeholder="Optional" />
              <TextField control={couponForm.control} name="expiresAt" label="Expiry date" type="date" />
            </div>
            <SwitchField control={couponForm.control} name="enabled" label="Enabled" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCouponDialog(false)}>Cancel</Button>
              <Button type="submit">{editingCoupon ? "Save changes" : "Create coupon"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmCouponDelete !== null}
        onOpenChange={(o) => !o && setConfirmCouponDelete(null)}
        title="Delete coupon?"
        description={`Code "${confirmCouponDelete?.code}" will be permanently deleted.`}
        onConfirm={async () => {
          if (db && confirmCouponDelete) {
            await deleteDoc(doc(db, COLLECTIONS.coupons, confirmCouponDelete.id));
            toast.success("Coupon deleted.");
          }
          setConfirmCouponDelete(null);
        }}
      />
    </>
  );
}
