import React from "react";
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";

interface SyncStatusBadgeProps {
  isOnline: boolean;
  queuedCount: number;
  isSyncing: boolean;
  onManualSync?: () => void;
  onViewQueue?: () => void;
}

export function SyncStatusBadge({
  isOnline,
  queuedCount,
  isSyncing,
  onManualSync,
  onViewQueue,
}: SyncStatusBadgeProps) {
  if (isSyncing) {
    return (
      <button
        type="button"
        onClick={onViewQueue}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium animate-pulse cursor-pointer hover:bg-primary/20 transition-all"
        title="View pending offline records"
      >
        <RefreshCw size={13} className="animate-spin text-primary" />
        <span>Syncing {queuedCount} log{queuedCount > 1 ? "s" : ""}…</span>
      </button>
    );
  }

  if (!isOnline) {
    return (
      <button
        type="button"
        onClick={onViewQueue}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-all cursor-pointer"
        title="Click to view offline queued records"
      >
        <WifiOff size={13} className="text-amber-500 flex-shrink-0" />
        <span>
          Offline {queuedCount > 0 ? `(${queuedCount} queued)` : ""}
        </span>
      </button>
    );
  }

  if (queuedCount > 0) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={onViewQueue}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-all cursor-pointer"
          title="Click to view offline records queue"
        >
          <span>{queuedCount} Queued</span>
        </button>
        <button
          type="button"
          onClick={onManualSync}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-xs font-semibold transition-all cursor-pointer"
          title="Click to sync queued logs now"
        >
          <RefreshCw size={13} className="text-primary flex-shrink-0" />
          <span>Sync Now</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onViewQueue}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all cursor-pointer"
      title="Click to inspect offline queue"
    >
      <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
      <span>Online</span>
    </button>
  );
}
