"use client";

/**
 * Record/Replay Dashboard Client Component
 *
 * Provides interactive UI for managing Replicate API recordings.
 */

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Recording {
  hash: string;
  filename: string;
  timestamp: string;
  method: string;
  url: string;
}

interface StatusData {
  stage: string;
  recordMode: string;
  baseUrl: string;
  fixturesDir: string;
  recordingsCount: number;
}

export function RecordReplayDashboard() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [statusRes, recordingsRes] = await Promise.all([
        fetch("/api/dev/record-replay/status"),
        fetch("/api/dev/record-replay/recordings"),
      ]);

      if (!statusRes.ok || !recordingsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const statusData = await statusRes.json();
      const recordingsData = await recordingsRes.json();

      setStatus(statusData);
      setRecordings(recordingsData.recordings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteRecording = async (hash: string) => {
    try {
      const res = await fetch(`/api/dev/record-replay/recordings/${hash}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete recording");
      }

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleClearAll = async () => {
    try {
      const res = await fetch("/api/dev/record-replay/recordings", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to clear recordings");
      }

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchData} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Configuration</CardTitle>
          <CardDescription>
            Environment settings for record/replay functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Stage</div>
              <Badge variant="outline" className="text-sm">
                {status?.stage}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Record Mode</div>
              <Badge
                variant={
                  status?.recordMode === "record"
                    ? "destructive"
                    : status?.recordMode === "replay"
                      ? "default"
                      : "secondary"
                }
                className="text-sm"
              >
                {status?.recordMode}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Replicate Base URL
              </div>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {status?.baseUrl}
              </code>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Fixtures Directory
              </div>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {status?.fixturesDir}
              </code>
            </div>
          </div>

          {status?.recordMode === "record" && (
            <div className="mt-4 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="text-sm text-destructive font-medium">
                Recording Mode Active
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                API responses are being recorded to disk. This should only be
                used temporarily during development.
              </p>
            </div>
          )}

          {status?.recordMode === "replay" && (
            <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm text-primary font-medium">
                Replay Mode Active
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                API calls will use recorded responses. No actual API calls are
                made.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Environment Variables Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
          <CardDescription>
            Set these to control record/replay behavior
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 font-mono text-sm">
            <div className="p-2 bg-muted rounded">
              <span className="text-muted-foreground"># Enable recording</span>
              <br />
              REPLICATE_RECORD_MODE=record
            </div>
            <div className="p-2 bg-muted rounded">
              <span className="text-muted-foreground"># Enable replay</span>
              <br />
              REPLICATE_RECORD_MODE=replay
            </div>
            <div className="p-2 bg-muted rounded">
              <span className="text-muted-foreground">
                # Override base URL (optional)
              </span>
              <br />
              REPLICATE_BASE_URL=http://localhost:8080
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recordings Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recordings ({recordings.length})</CardTitle>
            <CardDescription>
              Stored API response recordings for replay
            </CardDescription>
          </div>
          {recordings.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all recordings?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all {recordings.length} recording(s). This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll}>
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardHeader>
        <CardContent>
          {recordings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No recordings found.</p>
              <p className="text-sm mt-2">
                Set <code>REPLICATE_RECORD_MODE=record</code> and make API calls
                to create recordings.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hash</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordings.map((recording) => (
                  <TableRow key={recording.hash}>
                    <TableCell className="font-mono text-xs">
                      {recording.hash}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{recording.method}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-xs">
                      {recording.url}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(recording.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete this recording?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will delete the recording for hash{" "}
                              <code>{recording.hash}</code>. Replay mode will
                              fail for this request until re-recorded.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleDeleteRecording(recording.hash)
                              }
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Documentation Link */}
      <Card>
        <CardHeader>
          <CardTitle>Documentation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            For comprehensive documentation on the record/replay strategy, see:
          </p>
          <code className="mt-2 block text-xs bg-muted p-2 rounded">
            docs/record-replay.md
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
