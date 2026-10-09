/**
 * Floating chat widget: login required; realtime messages at
 * chats/{uid}/messages; text + image upload to Vercel Blob (via /api/upload);
 * read receipts, typing indicator (typing field on the chat doc),
 * unread badge, and attachable reference cards (product / service /
 * project) — via the in-chat picker or "Ask about this" buttons.
 *
 * Brand routing: product refs and shop routes go to the MTR Store inbox,
 * everything else to HTC Support. The brand is stored on each user
 * message and merged onto the parent chat doc.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  Check,
  CheckCheck,
  ImagePlus,
  Loader2,
  MessageCircle,
  Package,
  Send,
  X,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import {
  uploadImage,
  isUploadsConfigured,
} from "@/lib/uploads";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { useAuth } from "@/components/providers";
import { useChatUiStore } from "@/lib/store/chat-ui";
import {
  useChatMessages,
  useChatMeta,
  type ChatMessageDoc,
} from "@/components/customer/data-hooks";
import { brandForRefCard, normalizeRefCard } from "@/lib/chat-ref";
import { brandForRoute } from "@/lib/brand";
import { ChatRefPicker } from "./chat-ref-picker";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import type { ChatBrand, ChatRefCard } from "@/lib/types";

/** Renders a message's ref card (product / service / project). */
function RefCard({ card }: { card: ChatRefCard }) {
  return (
    <Link
      href={card.href}
      className="mb-2 flex items-center gap-2.5 rounded-xl bg-black/10 p-2 dark:bg-white/10"
    >
      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg">
        <Image
          src={card.image}
          alt=""
          fill
          className="object-cover"
          sizes="44px"
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold">{card.name}</span>
        <span className="block truncate text-xs font-extrabold">
          {card.detail}
        </span>
      </span>
    </Link>
  );
}

export function ChatWidget() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const { open, refCard, openChat, closeChat, clearRefCard, setUnread } =
    useChatUiStore();
  const uid = user?.uid;
  // Always subscribed while signed in so the unread badge works when closed.
  const { messages } = useChatMessages(uid);
  const { meta } = useChatMeta(uid);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const configured = isFirebaseConfigured();

  // Brand for this chat context: an attached card decides first
  // (product → MTR, service/project → HTC), otherwise the route does.
  const contextBrand: ChatBrand =
    brandForRefCard(refCard) ?? brandForRoute(pathname);
  const isMtr = contextBrand === "mtr";

  // Unread badge: unread admin messages (updates even when panel is closed).
  useEffect(() => {
    if (!uid) {
      setUnread(0);
      return;
    }
    const n = messages.filter((m) => m.sender === "admin" && !m.read).length;
    setUnread(n);
  }, [messages, uid, setUnread]);

  // Mark admin messages as read while the panel is open.
  useEffect(() => {
    const fdb = db;
    if (!open || !fdb || !uid) return;
    messages
      .filter((m) => m.sender === "admin" && !m.read)
      .forEach((m) => {
        updateDoc(doc(fdb, COLLECTIONS.chats, uid, "messages", m.id), {
          read: true,
        }).catch(() => undefined);
      });
  }, [open, messages, uid]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, open]);

  function requireLogin(): boolean {
    if (!user) {
      toast.error(t.chat.signInToChat);
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return false;
    }
    return true;
  }

  async function setTyping(v: "user" | null) {
    if (!db || !uid) return;
    try {
      await setDoc(
        doc(db, COLLECTIONS.chats, uid),
        { userId: uid, typing: v, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch {
      /* best effort */
    }
  }

  function onType(value: string) {
    setText(value);
    if (!db || !uid) return;
    setTyping("user");
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(null), 2500);
  }

  async function sendMessage(imageUrl?: string) {
    const body = text.trim();
    if ((!body && !imageUrl) || !db || !uid || sending) return;
    if (!requireLogin()) return;
    setSending(true);
    try {
      await setTyping(null);
      // Brand routing: product ref → "mtr", service/project ref → "htc",
      // otherwise the current route decides (shop routes → "mtr").
      const card = refCard;
      const brand: ChatBrand = brandForRefCard(card) ?? brandForRoute(pathname);
      // Message sending is server-side (POST /api/chat/messages): the API
      // verifies the caller's ID token matches the chat owner and validates
      // the payload before writing.
      const idToken = await user.getIdToken();
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          userId: uid,
          text: body,
          ...(imageUrl ? { imageUrl } : {}),
          brand,
          ...(card
            ? {
                refCard: {
                  kind: card.kind,
                  id: card.id,
                  name: card.name,
                  image: card.image,
                  detail: card.detail,
                  href: card.href,
                },
              }
            : {}),
        }),
      });
      if (!res.ok) throw new Error("send-failed");
      setText("");
      setPickerOpen(false);
      clearRefCard();
    } catch {
      toast.error(t.chat.messageFailed);
    } finally {
      setSending(false);
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uid) return;
    if (!requireLogin()) return;
    if (!isUploadsConfigured()) {
      toast.error(t.chat.uploadsUnavailable, { duration: 6000 });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t.chat.imageTooBig);
      return;
    }
    setUploading(true);
    try {
      const idToken = await user.getIdToken();
      const url = await uploadImage(file, { idToken });
      await sendMessage(url);
    } catch {
      toast.error(t.chat.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  if (!configured) return null;

  return (
    <>
      {/* Floating button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => {
          if (!requireLogin()) return;
          if (open) closeChat();
          else openChat();
        }}
        aria-label={t.chat.chatWithUs}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#D21F26] text-white shadow-2xl transition hover:bg-[#a8161c]"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        <ChatBadge />
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && user && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            className="fixed bottom-40 right-5 z-40 flex h-[480px] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-3xl border bg-white shadow-2xl dark:bg-stone-950"
          >
            {/* Header — brand-aware */}
            <div className="flex items-center gap-3 bg-[#D21F26] px-4 py-3.5 text-white">
              {isMtr ? (
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
                  <Image
                    src="/mtr-logo.png"
                    alt="MTR Store"
                    width={40}
                    height={40}
                    className="object-cover"
                  />
                </span>
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 font-display font-extrabold">
                  H
                </span>
              )}
              <div className="flex-1">
                <p className="font-display text-sm font-bold">
                  {isMtr ? t.chat.mtrStore : t.chat.htcSupport}
                </p>
                <p className="text-xs text-white/80">
                  {meta?.typing === "admin"
                    ? t.chat.typing
                    : t.chat.repliesWithin}
                </p>
              </div>
              <button
                onClick={closeChat}
                aria-label={t.chat.closeChat}
                className="rounded-full p-1.5 hover:bg-white/20"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-stone-50 px-4 py-4 dark:bg-black/40">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <MessageCircle size={36} className="text-muted-foreground/40" />
                  <p className="mt-3 text-sm font-semibold">Assalam-o-Alaikum!</p>
                  <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                    {t.chat.startConversation}
                  </p>
                </div>
              )}
              {messages.map((m: ChatMessageDoc) => {
                const mine = m.sender === "user";
                const card = normalizeRefCard(m);
                return (
                  <div
                    key={m.id}
                    className={cn("flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div className="max-w-[80%]">
                      {m.sender === "bot" && (
                        <p className="mb-0.5 flex items-center gap-1 text-[10px] font-bold text-violet-600">
                          <Bot size={11} /> {t.chatBot.title}
                        </p>
                      )}
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                          mine
                            ? "rounded-br-md bg-[#D21F26] text-white"
                            : "rounded-bl-md bg-white text-foreground dark:bg-stone-900"
                        )}
                      >
                      {card && <RefCard card={card} />}
                      {m.imageUrl && (
                        <a
                          href={m.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mb-1.5 block"
                        >
                          <span className="relative block h-36 w-48 overflow-hidden rounded-xl">
                            <Image
                              src={m.imageUrl}
                              alt={t.chat.sharedImage}
                              fill
                              className="object-cover"
                              sizes="192px"
                            />
                          </span>
                        </a>
                      )}
                      {m.text && (
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      )}
                      {mine && (
                        <span className="mt-1 flex justify-end text-white/70">
                          {m.read ? <CheckCheck size={14} /> : <Check size={14} />}
                        </span>
                      )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {meta?.typing === "admin" && (
                <div className="flex justify-start">
                  <div className="flex gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm dark:bg-stone-900">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                        className="h-2 w-2 rounded-full bg-stone-400"
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Item picker (products for MTR, services/projects for HTC) */}
            <AnimatePresence>
              {pickerOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <ChatRefPicker
                    brand={contextBrand}
                    onClose={() => setPickerOpen(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Ref card chip */}
            {refCard && (
              <div className="flex items-center gap-2 border-t bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
                <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={refCard.image}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="36px"
                  />
                </span>
                <p className="min-w-0 flex-1 truncate text-xs font-semibold">
                  Asking about: {refCard.name}
                </p>
                <button
                  onClick={clearRefCard}
                  aria-label="Remove reference"
                  className="rounded-full p-1 hover:bg-black/10"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Composer */}
            <div className="flex items-center gap-2 border-t px-3 py-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickImage}
              />
              {/* Attach an item (product / service / project) to the message */}
              <button
                onClick={() => {
                  if (!requireLogin()) return;
                  setPickerOpen((v) => !v);
                }}
                aria-label="Attach a product, service, or project"
                title="Attach a product, service, or project"
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-muted",
                  pickerOpen && "bg-muted"
                )}
              >
                <Package size={18} />
              </button>
              {isUploadsConfigured() && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || loading}
                  aria-label="Send image"
                  title="Send image"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-muted disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ImagePlus size={18} />
                  )}
                </button>
              )}
              <input
                value={text}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={t.chat.typeMessage}
                className="w-full rounded-full bg-muted px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#D21F26]/40"
              />
              <button
                onClick={() => sendMessage()}
                disabled={sending || !text.trim()}
                aria-label={t.chat.sendMessage}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D21F26] text-white transition hover:bg-[#a8161c] disabled:opacity-40"
              >
                {sending ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Send size={17} />
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ChatBadge() {
  const unread = useChatUiStore((s) => s.unread);
  const open = useChatUiStore((s) => s.open);
  if (open || unread === 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-stone-950 px-1.5 text-[11px] font-bold text-white dark:bg-white dark:text-black">
      {unread}
    </span>
  );
}
