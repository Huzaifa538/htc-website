/**
 * Shared data contracts for HTC (Hammer Trading).
 *
 * These interfaces mirror the Firestore collections defined in
 * lib/firebase/collections.ts. Other agents (customer pages, admin panel)
 * must use these types rather than inventing their own shapes.
 *
 * All timestamp fields are Firestore Timestamps. On the client they can be
 * created with `serverTimestamp()` / `Timestamp.now()` from firebase/firestore.
 */
import type { Timestamp } from "firebase/firestore";

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

/** One variant axis of a product, e.g. Size (size) or Color (color). */
export interface VariantType {
  id: string;
  name: string;
  kind: "size" | "color" | "custom";
  values: string[];
  /** Only for kind === "color": map value -> CSS hex, e.g. { Red: "#D21F26" } */
  colors?: Record<string, string>;
}

/** A sellable combination of variant options, e.g. { Size: "L", Color: "Red" }. */
export interface VariantCombination {
  id: string;
  options: Record<string, string>;
  price: number; // PKR
  compareAtPrice?: number; // PKR, original price when discounted
  stock: number;
  sku: string;
  image?: string;
}

export interface Product {
  id: string;
  name: string;
  /** Urdu name (shown on product page when available; for the Urdu site version). */
  urduName?: string;
  slug: string;
  description: string;
  shortDescription?: string;
  categoryId: string;
  images: string[];
  /** Empty variants = simple product with base price/stock. */
  variantTypes: VariantType[];
  combinations: VariantCombination[];
  basePrice: number; // PKR
  baseCompareAtPrice?: number; // PKR
  baseStock: number;
  /** Stock level at/below which the product shows a low-stock alert. Defaults to 10. */
  lowStockThreshold?: number;
  /** Optional purchase/cost price (PKR) — used for profit reports. */
  costPrice?: number;
  sku: string;
  tags: string[];
  featured: boolean;
  published: boolean;
  rating: number; // 0–5 aggregate
  reviewCount: number;
  soldCount: number;
  /** Times this product was delivered to a customer (historical + tracked). */
  deliveredCount?: number;
  /** Demo video URL (YouTube link or direct mp4) — shown in a "Product demo"
   *  section on the product page when set. Huzaifa uploads the actual demo
   *  videos later; empty means no video section is rendered. */
  videoUrl?: string;
  /** 3D viewer: shown on the product page only when the admin enables it. */
  show3d?: boolean;
  /** 3D model template id (see lib/three/models.ts MODEL_TEMPLATES). */
  model3d?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
  icon?: string; // lucide icon name, e.g. "Sofa"
  parentId?: string; // sub-categories
  order: number;
  enabled: boolean;
  createdAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export interface OrderItem {
  productId: string;
  name: string;
  variant: Record<string, string>; // chosen options, e.g. { Size: "L" }
  price: number; // PKR, unit price at purchase time
  qty: number;
  image: string;
}

export interface OrderAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
}

export type OrderStatus = "Pending" | "Confirmed" | "Shipped" | "Delivered" | "Cancelled";
export type PaymentMethod = "COD" | "BankTransfer" | "Card";

export interface Order {
  id: string;
  userId: string;
  /** All storefront orders are MTR; kept so reports can filter by brand. */
  brand?: ChatBrand;
  items: OrderItem[];
  subtotal: number; // PKR
  discount: number; // PKR
  shipping: number; // PKR
  tax: number; // PKR
  total: number; // PKR
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  address: OrderAddress;
  coupon?: string; // coupon code applied
  notes?: string;
  /** True when this order was imported from historical data (not placed on the storefront). */
  imported?: boolean;
  /** Staff member (email) ye order handle kar raha hai — performance tracking ke liye. */
  assignedTo?: string;
  /** Origin of the order: "store" (default) or "history" (one-time historical import). */
  source?: "history" | "store";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Coupon {
  id: string;
  code: string;
  type: "percent" | "flat";
  value: number; // percent (0–100) or flat PKR
  minOrder?: number; // PKR
  maxUses?: number;
  usedCount: number;
  enabled: boolean;
  expiresAt?: Timestamp;
  createdAt: Timestamp;
}

/**
 * Flash sale — a site-wide time-boxed discount shown as a countdown
 * banner on the storefront. Only one is active at a time (the admin
 * enables/disables them); the frontend picks the enabled sale whose
 * window contains "now".
 */
export interface FlashSale {
  id: string;
  title: string; // e.g. "Eid Flash Sale"
  discountPct: number; // 1–90
  startsAt: Timestamp;
  endsAt: Timestamp;
  enabled: boolean;
  /** Optional: only these category ids get the discount (empty = all). */
  categoryIds?: string[];
  createdAt: Timestamp;
}

/**
 * Festival sale — Eid/Diwali/Christmas jaisi khaas mauqaon par discount.
 * Flash sale jaisa hi kaam karta hai, lekin naam se pata chalta hai ke
 * ye festival offer hai. Dono ek saath active hon to zyada discount
 * wali apply hoti hai (customer ke faide mein).
 */
export interface FestivalSale {
  id: string;
  name: string; // e.g. "Eid ul-Fitr", "Diwali", "Christmas"
  discountPct: number; // 1–90
  startsAt: Timestamp;
  endsAt: Timestamp;
  enabled: boolean;
  createdAt: Timestamp;
}

/**
 * Combo deal — a bundle of products sold together at a bundle price.
 * e.g. "Complete Door Kit": handle + lock + hinges.
 */
export interface Combo {
  id: string;
  title: string; // e.g. "Complete Door Kit"
  description?: string;
  image?: string;
  /** Product ids included in the bundle. */
  productIds: string[];
  /** Bundle price in PKR (must be < sum of product prices to make sense). */
  bundlePrice: number;
  enabled: boolean;
  order: number;
  createdAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Carts, wishlists, reviews                                           */
/* ------------------------------------------------------------------ */

export interface CartItem {
  productId: string;
  combinationId?: string; // VariantCombination.id when applicable
  variant: Record<string, string>;
  qty: number;
  addedAt: Timestamp;
}

export interface Cart {
  id: string; // userId
  userId: string;
  items: CartItem[];
  updatedAt: Timestamp;
}

export interface Wishlist {
  id: string; // userId
  userId: string;
  productIds: string[];
  updatedAt: Timestamp;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number; // 1–5
  title?: string;
  comment: string;
  images?: string[];
  approved: boolean;
  createdAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Interior-design services & projects                                 */
/* ------------------------------------------------------------------ */

export interface Service {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  icon?: string;
  priceFrom?: number; // PKR, "starting from"
  order: number;
  enabled: boolean;
  createdAt: Timestamp;
}

export interface ServiceInquiry {
  id: string;
  serviceId: string;
  serviceName: string;
  name: string;
  phone: string;
  email?: string;
  message: string;
  status: "New" | "Contacted" | "Closed";
  createdAt: Timestamp;
}

export type ProjectStatus = "Ongoing" | "Completed" | "Upcoming";

export interface Project {
  id: string;
  title: string;
  client: string;
  location: string;
  status: ProjectStatus;
  progress: number; // 0–100
  startDate: Timestamp;
  endDate?: Timestamp;
  description: string;
  images: string[];
  videos: string[];
  /** Before/after pair for the portfolio comparison slider (optional). */
  beforeImage?: string;
  afterImage?: string;
  featured: boolean;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Gallery                                                             */
/* ------------------------------------------------------------------ */

export interface GalleryVideo {
  id: string;
  title: string;
  description: string;
  category: string;
  videoUrl: string;
  thumbnailUrl: string;
  likes: number;
  order: number;
  enabled: boolean;
  createdAt: Timestamp;
}

export interface GalleryImage {
  id: string;
  title?: string;
  category: string;
  imageUrl: string;
  order: number;
  enabled: boolean;
  createdAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* CMS content                                                         */
/* ------------------------------------------------------------------ */

export interface HeroSlide {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  order: number;
  enabled: boolean;
  createdAt: Timestamp;
}

export interface AboutContent {
  id: string; // single doc, e.g. "main"
  heading: string;
  body: string;
  images: string[];
  stats: { label: string; value: string }[];
  updatedAt: Timestamp;
}

export interface SiteSettings {
  id: string; // single doc, e.g. "main"
  siteName: string;
  tagline: string;
  logoUrl: string;
  whatsappNumber: string;
  phone: string;
  email: string;
  address: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  announcementBar?: string;
  freeShippingThreshold?: number; // PKR
  /** Configurable consultation time slots, one label per line (admin/settings). */
  appointmentTimeSlots?: string[];
  updatedAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Users, admins, auth                                                 */
/* ------------------------------------------------------------------ */

export interface AppUser {
  id: string; // Firebase Auth uid
  email: string;
  name: string;
  phone?: string;
  photoURL?: string;
  addresses: OrderAddress[];
  /** Loyalty points balance. Rs 100 spent = 1 point, 1 point = Rs 1 off. */
  loyaltyPoints?: number;
  /** Is user ka apna referral code (e.g. "HTC-X7K2P9"). */
  referralCode?: string;
  /** Jis user ke code se ye join hua (referrer ka uid). Pehle order par dono ko bonus. */
  referredBy?: string;
  /** Internal admin notes, e.g. "prefers COD", "wholesale buyer". Never shown to the customer. */
  notes?: string;
  createdAt: Timestamp;
}

export interface AdminRecord {
  id: string; // Firebase Auth uid
  email: string;
  name: string;
  role: "owner" | "manager" | "staff";
  createdAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Chats, notifications, contact                                       */
/* ------------------------------------------------------------------ */

/** Which business a chat / order belongs to: MTR (hardware store) or HTC (company). */
export type ChatBrand = "mtr" | "htc";

/** Kind of item a chat can reference: a store product, a company service, or a project. */
export type ChatRefKind = "product" | "service" | "project";

/**
 * Reference card attached to a chat message — the product / service /
 * project the customer is asking about. Rendered as a small card with a
 * deep link in both the customer widget and the admin inbox.
 */
export interface ChatRefCard {
  kind: ChatRefKind;
  id: string;
  name: string;
  image: string;
  /** Short detail line: price for products, "From Rs X" for services, "Location · Status" for projects. */
  detail: string;
  /** Deep link, e.g. /product/abc, /services/xyz, /projects/123. */
  href: string;
}

export interface ChatMessage {
  id: string;
  chatId: string; // === userId
  sender: "user" | "admin" | "bot";
  text: string;
  imageUrl?: string;
  /** Brand routing for the conversation (set on user messages + merged onto the parent chat doc). */
  brand?: ChatBrand;
  refCard?: ChatRefCard;
  /**
   * @deprecated Legacy shape (pre brand-split). New messages use `refCard`.
   * Kept for reading old documents — renderers fall back to it.
   */
  productRef?: { id: string; name: string; image: string; price: number };
  read: boolean;
  createdAt: Timestamp;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: "order" | "promo" | "chat" | "system";
  link?: string;
  read: boolean;
  createdAt: Timestamp;
}

export interface ContactMessage {
  id: string;
  name: string;
  phone: string;
  email?: string;
  subject: string;
  message: string;
  status: "New" | "Read" | "Replied";
  createdAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Management upgrades: shipments, expenses, staff, appointments        */
/* ------------------------------------------------------------------ */

/** Courier shipment linked to an order. */
export type CourierName = "TCS" | "Leopards" | "Other";
export type ShipmentStatus = "Booked" | "InTransit" | "Delivered" | "Cancelled";

export interface Shipment {
  id: string;
  orderId: string;
  /** Firestore uid of the order's customer — required so customers can read their own shipments. */
  userId: string;
  courier: CourierName;
  trackingNumber: string;
  status: ShipmentStatus;
  /** "manual" until live API credentials are configured. */
  mode: "manual" | "api";
  bookedBy?: string; // staff email
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Business expense (kharcha) record. */
export type ExpenseCategory =
  | "Rent"
  | "Salary"
  | "Utilities"
  | "Stock"
  | "Marketing"
  | "Transport"
  | "Other";

export interface Expense {
  id: string;
  date: Timestamp;
  category: ExpenseCategory;
  amount: number; // PKR
  note?: string;
  receiptUrl?: string;
  addedBy?: string; // staff email
  createdAt: Timestamp;
}

/**
 * Supplier — samaan kahan se aata hai. Rates compare karne ke liye
 * har supplier ke paas category + notes + rating hoti hai.
 */
export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  category: string; // e.g. "Locks", "Handles", "Paint"
  notes?: string;
  /** 1–5, sasta + reliable = zyada stars */
  rating?: number;
  createdAt: Timestamp;
}

/** Staff member with role-based access. */
export type StaffRole = "owner" | "manager" | "staff" | "viewer";

export interface StaffMember {
  id: string; // email (lowercased) as doc id
  email: string;
  name?: string;
  role: StaffRole;
  active: boolean;
  addedBy?: string;
  createdAt: Timestamp;
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
  viewer: "Viewer",
};

/** Interior-design consultation appointment. */
export type AppointmentStatus =
  | "Pending"
  | "Confirmed"
  | "Cancelled"
  | "Completed";

export interface Appointment {
  id: string;
  name: string;
  phone: string;
  email?: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "10:00 AM – 12:00 PM"
  serviceType: string;
  notes?: string;
  status: AppointmentStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Hardware installation booking — a technician visits the customer's home/shop. */
export type InstallationBookingStatus =
  | "Pending"
  | "Confirmed"
  | "Cancelled"
  | "Completed";

export interface InstallationBooking {
  id: string;
  productId: string;
  productName: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "10:00 AM – 12:00 PM"
  notes?: string;
  userId?: string; // set when the customer is signed in
  status: InstallationBookingStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Courier + WhatsApp integration settings (stored in siteSettings/main). */
export interface IntegrationSettings {
  courierTcsApiKey?: string;
  courierTcsApiSecret?: string;
  courierTcsAccountNo?: string;
  courierLeopardsApiKey?: string;
  courierLeopardsApiSecret?: string;
  courierLeopardsAccountNo?: string;
  whatsappPhoneNumberId?: string;
  whatsappAccessToken?: string;
  whatsappOwnerNumber?: string; // e.g. 923001234567 — where order alerts go
  appointmentTimeSlots?: string[]; // configurable slots
}

/* ------------------------------------------------------------------ */
/* Quotations                                                          */
/* ------------------------------------------------------------------ */

/** One line on a quotation: a product or a manually entered service item. */
export interface QuotationItem {
  name: string;
  qty: number;
  unitPrice: number; // PKR
}

/** Quotation lifecycle: draft → sent → accepted → converted (into an order). */
export type QuotationStatus = "draft" | "sent" | "accepted" | "converted";

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  converted: "Converted",
};

/**
 * A price quotation. MTR brand = hardware/store items; HTC brand =
 * interior-design services. Admin-created via /admin/quotations, or
 * customer-requested from a service detail page (status "sent", brand "htc").
 */
export interface Quotation {
  id: string;
  customerName: string;
  phone: string;
  email?: string;
  /** Firestore uid when requested by a signed-in customer; absent for walk-ins. */
  userId?: string;
  items: QuotationItem[];
  subtotal: number; // PKR
  discount: number; // PKR (flat)
  tax?: number; // PKR (flat, optional)
  total: number; // PKR
  status: QuotationStatus;
  brand: ChatBrand;
  notes?: string;
  /** Set when requested from a service detail page. */
  serviceId?: string;
  serviceName?: string;
  /** Order id after "Convert to Order". */
  convertedOrderId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/* ------------------------------------------------------------------ */
/* Firestore document helpers                                          */
/* ------------------------------------------------------------------ */

/** A Firestore doc snapshot merged with its id. */
export type WithId<T> = T & { id: string };

/** Payload used when creating a new document (id + timestamps omitted). */
export type NewDoc<
  T extends { id: string } & Partial<{ createdAt: unknown; updatedAt: unknown }>,
> = Omit<T, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<T, "createdAt" | "updatedAt">>;
