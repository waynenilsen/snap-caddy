/**
 * Record/Replay Dev Page
 *
 * This hidden page is only accessible in development mode (STAGE=dev).
 * It provides a UI for managing Replicate API recordings used in testing.
 *
 * Features:
 * - View current record/replay mode
 * - List all existing recordings
 * - Delete individual recordings
 * - Clear all recordings
 */

import { redirect } from "next/navigation";
import { isDev } from "@/lib/env";
import { RecordReplayDashboard } from "./RecordReplayDashboard";

export const dynamic = "force-dynamic";

export default function RecordReplayPage() {
  // Only accessible in dev mode
  if (!isDev()) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Replicate Record/Replay
          </h1>
          <p className="mt-2 text-muted-foreground">
            Development tool for managing API response recordings
          </p>
        </header>

        <RecordReplayDashboard />
      </div>
    </main>
  );
}
