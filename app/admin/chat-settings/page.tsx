"use client";

/**
 * Chat Settings — bot auto-switch ka control panel.
 *
 * - Bot Enabled: master switch
 * - Bot Auto Mode: ON = admin online ho to bot khud off, offline ho to on
 * - Status card: abhi bot jawab de raha hai ya admin
 */
import { useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Bot, UserCheck, Wifi, WifiOff } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { useBotMode } from "@/lib/bot-mode";
import { PageHeader, LoadingState } from "@/components/admin/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/lib/i18n";

export default function ChatSettingsPage() {
  const { t } = useLanguage();
  const { settings, loaded, botActive, adminOnline } = useBotMode();
  const [saving, setSaving] = useState(false);

  async function update(patch: Record<string, unknown>) {
    if (!isFirebaseConfigured() || !db) {
      toast.error(t.chatSettings.notConfigured);
      return;
    }
    setSaving(true);
    try {
      await setDoc(
        doc(db, COLLECTIONS.siteSettings, "chat"),
        { ...patch, updatedAt: serverTimestamp() },
        { merge: true }
      );
      toast.success(t.chatSettings.saved);
    } catch {
      toast.error(t.chatSettings.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <LoadingState />;

  const s = settings ?? { botEnabled: true, botAutoMode: true };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t.chatSettings.title}
        subtitle={t.chatSettings.subtitle}
      />

      {/* Live status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {botActive ? (
              <Bot className="h-5 w-5 text-violet-600" />
            ) : (
              <UserCheck className="h-5 w-5 text-emerald-600" />
            )}
            {t.chatSettings.liveStatus}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge
            variant={botActive ? "default" : "secondary"}
            className="px-4 py-2 text-sm"
          >
            {botActive
              ? t.chatSettings.botAnswering
              : t.chatSettings.adminAnswering}
          </Badge>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {adminOnline ? (
              <>
                <Wifi className="h-4 w-4 text-emerald-600" />
                {t.chatSettings.adminOnline}
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                {t.chatSettings.adminOffline}
              </>
            )}
          </span>
        </CardContent>
      </Card>

      {/* Toggles */}
      <Card>
        <CardHeader>
          <CardTitle>{t.chatSettings.controls}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>{t.chatSettings.botEnabled}</Label>
              <p className="text-xs text-muted-foreground">
                {t.chatSettings.botEnabledDesc}
              </p>
            </div>
            <Switch
              checked={s.botEnabled}
              disabled={saving}
              onCheckedChange={(v) => update({ botEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>{t.chatSettings.autoMode}</Label>
              <p className="text-xs text-muted-foreground">
                {t.chatSettings.autoModeDesc}
              </p>
            </div>
            <Switch
              checked={s.botAutoMode}
              disabled={saving}
              onCheckedChange={(v) => update({ botAutoMode: v })}
            />
          </div>
          <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
            {t.chatSettings.howItWorks}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
