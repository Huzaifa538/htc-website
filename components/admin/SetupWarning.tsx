"use client";

/** Empty state shown on every admin page when Firebase env keys are missing. */
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SetupWarning({ feature }: { feature?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Firebase not configured
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            {feature ? `${feature} needs` : "This feature needs"} a live Firebase
            connection.
          </p>
          <p>
            Add your <code className="rounded bg-muted px-1">NEXT_PUBLIC_FIREBASE_*</code>{" "}
            keys to <code className="rounded bg-muted px-1">.env.local</code> (see{" "}
            <code className="rounded bg-muted px-1">.env.example</code>) and restart
            the dev server.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
