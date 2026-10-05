/**
 * Firestore collection names — the single source of truth.
 *
 * Other agents: import { COLLECTIONS } from "@/lib/firebase/collections"
 * and use these constants everywhere (queries, security rules docs,
 * seed scripts). Never hard-code a collection string elsewhere.
 */
export const COLLECTIONS = {
  users: "users",
  admins: "admins",
  products: "products",
  categories: "categories",
  orders: "orders",
  carts: "carts",
  wishlists: "wishlists",
  reviews: "reviews",
  heroSlides: "heroSlides",
  services: "services",
  serviceInquiries: "serviceInquiries",
  projects: "projects",
  galleryVideos: "galleryVideos",
  galleryImages: "galleryImages",
  aboutContent: "aboutContent",
  siteSettings: "siteSettings",
  coupons: "coupons",
  chats: "chats",
  notifications: "notifications",
  contactMessages: "contactMessages",
  shipments: "shipments",
  quotations: "quotations",
  expenses: "expenses",
  staff: "staff",
  appointments: "appointments",
} as const;

export type CollectionName = keyof typeof COLLECTIONS;
export type CollectionPath = (typeof COLLECTIONS)[CollectionName];
