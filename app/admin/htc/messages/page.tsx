"use client";

/**
 * /admin/htc/messages — HTC Company inbox: services, projects and
 * appointments chats ("htc" brand).
 */
import { ChatInbox } from "@/components/admin/chat-inbox";

export default function HtcMessagesPage() {
  return (
    <ChatInbox
      brand="htc"
      title="HTC Messages"
      subtitle="Company chats — services, projects, appointments"
    />
  );
}
