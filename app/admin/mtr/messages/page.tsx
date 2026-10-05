"use client";

/**
 * /admin/mtr/messages — MTR Store inbox: product & order chats routed
 * from the storefront ("mtr" brand).
 */
import { ChatInbox } from "@/components/admin/chat-inbox";

export default function MtrMessagesPage() {
  return (
    <ChatInbox
      brand="mtr"
      title="MTR Messages"
      subtitle="Store chats — product and order inquiries"
      logo="/mtr-logo.png"
    />
  );
}
