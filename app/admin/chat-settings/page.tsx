"use client";

/**
 * Chat Settings — do bots ka auto-switch control panel.
 *
 * HTC Bot (purple): services, interior design, consultation, projects
 * MTR Bot (blue): products, shopping, orders, delivery
 *
 * Har bot ke liye: Enabled (master) + Auto Mode (admin online → bot off).
 */
import { useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Bot, UserCheck, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { useBotMode, isBotActiveForBrand, type ChatBotSettings } from "@/lib/bot-mode";
import { PageHeader, LoadingState } from "@/components/admin/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/lib/i18n";
import type { ChatBrand } from "@/lib/types";

function BotSection({
  brand,
  settings,
  saving,
  onUpdate,
}: {
  brand: ChatBrand;
  settings: ChatBotSettings;
  saving: boolean;
  onUpdate: (brand: ChatBrand, patch: Record<string, unknown>) => void;
}) {
  const { t } = useLanguage();
  const b = settings[brand];
  const active = isBotActiveForBrand(settings, brand);
  const isHtc = brand === "htc";
  const accent = isHtc ? "text-violet-600" : "text-blue-600";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className={cn("h-5 w-5", accent)} />
          {isHtc ? t.chatSettings.htcBot : t.chatSettings.mtrBot}
          <Badge
            variant={active ? "default" : "secondary"}
            className="ml-1 px-3 py-1 text-xs"
          >
            {active
              ? t.chatSettings.botAnswering
              : t.chatSettings.adminAnswering}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {isHtc ? t.chatSettings.htcBotDesc : t.chatSettings.mtrBotDesc}
        </p>
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
            checked={b.botEnabled}
            disabled={saving}
            onCheckedChange={(v) => onUpdate(brand, { botEnabled: v })}
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
            checked={b.botAutoMode}
            disabled={saving}
            onCheckedChange={(v) => onUpdate(brand, { botAutoMode: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ChatSettingsPage() {
  const { t } = useLanguage();
  const { settings, loaded, adminOnline } = useBotMode();
  const [saving, setSaving] = useState(false);

  async function update(brand: ChatBrand, patch: Record<string, unknown>) {
    if (!isFirebaseConfigured() || !db) {
      toast.error(t.chatSettings.notConfigured);
      return;
    }
    setSaving(true);
    try {
      await setDoc(
        doc(db, COLLECTIONS.siteSettings, "chat"),
        { [brand]: patch, updatedAt: serverTimestamp() },
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

  const s: ChatBotSettings = settings ?? {
    htc: { botEnabled: true, botAutoMode: true },
    mtr: { botEnabled: true, botAutoMode: true },
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t.chatSettings.title}
        subtitle={t.chatSettings.subtitle}
      />

      {/* Admin online status */}
      <Card>
        <CardContent className="flex items-center gap-2 pt-6">
          {adminOnline ? (
            <>
              <Wifi className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium">
                {t.chatSettings.adminOnline}
              </span>
              <span className="text-xs text-muted-foreground">
                — {t.chatSettings.adminOnlineHint}
              </span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {t.chatSettings.adminOffline}
              </span>
              <span className="text-xs text-muted-foreground">
                — {t.chatSettings.adminOfflineHint}
              </span>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <BotSection
          brand="htc"
          settings={s}
          saving={saving}
          onUpdate={update}
        />
        <BotSection
          brand="mtr"
          settings={s}
          saving={saving}
          onUpdate={update}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4" />
            {t.chatSettings.howItWorksTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t.chatSettings.howItWorks}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
