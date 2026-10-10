/**
 * ChatInbox — shared brand-scoped admin chat inbox.
 *
 * Mounted at /admin/mtr/messages (brand "mtr") and /admin/htc/messages
 * (brand "htc"). Each inbox lists only the conversations routed to its
 * brand (`chats.brand == brand`), with message-level ref cards (product /
 * service / project) so staff see which item the customer is asking about.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { toast } from "sonner";
import { Search, Send, ImagePlus, Check, CheckCheck, ArrowLeft } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { ChatBrand, ChatMessage, WithId } from "@/lib/types";
import { normalizeRefCard } from "@/lib/chat-ref";
import { useCollection, tsMillis, fmtDateTime } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import { uploadFilesToStorage } from "@/components/admin/ImageUpload";
import { PageHeader, EmptyState, LoadingState } from "@/components/admin/ui";
import { AdminRefCard } from "@/components/admin/ref-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Chat metadata doc in the `chats` collection (id === userId). */
interface ChatThread extends DocumentData {
  id: string;
  userId: string;
  userName?: string;
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  unreadCount?: number;
}

/** Page header with an optional brand logo (the MTR badge). */
function InboxHeader({
  title,
  subtitle,
  logo,
}: {
  title: string;
  subtitle: string;
  logo?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={`${title} logo`}
          width={44}
          height={44}
          className="shrink-0 rounded-xl"
        />
      )}
      <div className="min-w-0 flex-1">
        <PageHeader title={title} subtitle={subtitle} />
      </div>
    </div>
  );
}

function useMessages(chatId: string | null) {
  const [messages, setMessages] = useState<WithId<ChatMessage>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!db || !chatId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, COLLECTIONS.chats, chatId, "messages"),
      orderBy("createdAt", "asc"),
      limit(200)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map((d) => ({ ...(d.data() as ChatMessage), id: d.id }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [chatId]);

  return { messages, loading };
}

export function ChatInbox({
  brand,
  title,
  subtitle,
  logo,
}: {
  brand: ChatBrand;
  title: string;
  subtitle: string;
  /** Optional brand logo rendered beside the page header (MTR badge). */
  logo?: string;
}) {
  // Only this brand's conversations. Sorted client-side (no composite index needed).
  const { data: threads, loading: threadsLoading } = useCollection<ChatThread>(
    COLLECTIONS.chats,
    [where("brand", "==", brand)]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { messages, loading: messagesLoading } = useMessages(selectedId);

  const selected = useMemo(
    () => threads.find((t) => t.id === selectedId) ?? null,
    [threads, selectedId]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads
      .filter((t) =>
        q ? `${t.userName ?? ""} ${t.userId}`.toLowerCase().includes(q) : true
      )
      .sort((a, b) => tsMillis(b.lastMessageAt) - tsMillis(a.lastMessageAt));
  }, [threads, search]);

  // auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, selectedId]);

  // mark user messages as read when the thread is open
  useEffect(() => {
    if (!db || !selectedId || messages.length === 0) return;
    const unread = messages.filter((m) => m.sender === "user" && !m.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    for (const m of unread) {
      batch.update(doc(db, COLLECTIONS.chats, selectedId, "messages", m.id), { read: true });
    }
    batch.update(doc(db, COLLECTIONS.chats, selectedId), { unreadCount: 0 });
    batch.commit().catch(() => {});
  }, [messages, selectedId]);

  const sendMessage = async (text: string, imageUrl?: string) => {
    if (!db || !selectedId) return;
    if (!text.trim() && !imageUrl) return;
    setSending(true);
    try {
      await addDoc(collection(db, COLLECTIONS.chats, selectedId, "messages"), {
        chatId: selectedId,
        sender: "admin",
        text: text.trim(),
        imageUrl: imageUrl ?? null,
        brand,
        read: false,
        createdAt: Timestamp.now(),
      });
      await updateDoc(doc(db, COLLECTIONS.chats, selectedId), {
        lastMessage: imageUrl ? "📷 Image" : text.trim().slice(0, 120),
        lastMessageAt: Timestamp.now(),
        unreadCount: 0,
      });
      setDraft("");
    } catch {
      toast.error("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const sendImage = async (file: File) => {
    try {
      const [url] = await uploadFilesToStorage([file], "chats");
      await sendMessage("", url);
      toast.success("Image sent.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Image upload failed.",
        { duration: 6000 }
      );
    }
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Customer chat" />;
  if (threadsLoading)
    return (
      <>
        <InboxHeader title={title} subtitle={subtitle} logo={logo} />
        <LoadingState rows={6} />
      </>
    );

  const threadList = (
    <div className="flex h-full flex-col">
      <div className="relative p-3">
        <Search className="absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No conversations yet.</p>
        ) : (
          filtered.map((t) => {
            const active = t.id === selectedId;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b p-3 text-left transition-colors hover:bg-muted/50",
                  active && "bg-primary/5"
                )}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback>{(t.userName ?? "U").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{t.userName ?? t.userId.slice(0, 10)}</p>
                    {(t.unreadCount ?? 0) > 0 && (
                      <Badge className="shrink-0 bg-primary">{t.unreadCount}</Badge>
                    )}
                  </div>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{t.lastMessage ?? "—"}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtDateTime(t.lastMessageAt)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const chatWindow = selected ? (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center gap-3 border-b p-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedId(null)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarFallback>{(selected.userName ?? "U").slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold">{selected.userName ?? "Customer"}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{selected.userId}</p>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messagesLoading ? (
          <p className="text-center text-sm text-muted-foreground">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No messages yet. Say hello! 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender === "admin";
            const card = normalizeRefCard(m);
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                    mine
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-muted"
                  )}
                >
                  {card && <AdminRefCard card={card} />}
                  {m.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.imageUrl} alt="attachment" className="mb-1 max-h-56 rounded-lg object-cover" />
                  )}
                  {(m as { audioUrl?: string }).audioUrl && (
                    <audio
                      controls
                      src={(m as { audioUrl?: string }).audioUrl}
                      className="mb-1 w-48 max-w-full"
                      preload="metadata"
                    />
                  )}
                  {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                  <p
                    className={cn(
                      "mt-1 flex items-center justify-end gap-1 text-[10px]",
                      mine ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}
                  >
                    {m.createdAt
                      ? new Date(tsMillis(m.createdAt)).toLocaleTimeString("en-PK", {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : ""}
                    {mine && (m.read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* composer */}
      <div className="border-t p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void sendImage(f);
            e.target.value = "";
          }}
        />
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(draft);
          }}
        >
          <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} disabled={sending}>
            <ImagePlus className="h-5 w-5" />
          </Button>
          <Input
            placeholder="Type a message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !draft.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  ) : (
    <EmptyState title="Select a conversation" description="Choose a customer from the list to start chatting." />
  );

  return (
    <>
      <InboxHeader title={title} subtitle={subtitle} logo={logo} />
      <div className="grid h-[calc(100vh-220px)] min-h-[480px] overflow-hidden rounded-xl border">
        {/* desktop: side-by-side; mobile: list OR chat */}
        <div className="hidden md:grid md:grid-cols-[320px_1fr]">
          <div className="border-r">{threadList}</div>
          <div>{chatWindow}</div>
        </div>
        <div className="md:hidden">
          {selectedId ? chatWindow : threadList}
        </div>
      </div>
    </>
  );
}
