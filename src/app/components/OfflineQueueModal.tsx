import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { ConfirmModal } from "./ui/ConfirmModal";
import {
  QueuedSubmission,
  getQueue,
  dequeueSubmission,
  clearQueue,
} from "../lib/offlineQueue";
import {
  HardDrive,
  Wifi,
  WifiOff,
  Trash2,
  RefreshCw,
  Calendar,
  User,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface OfflineQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  onSyncAll?: () => Promise<void> | void;
  onQueueUpdated?: () => void;
}

export function OfflineQueueModal({
  isOpen,
  onClose,
  isOnline,
  onSyncAll,
  onQueueUpdated,
}: OfflineQueueModalProps) {
  const [items, setItems] = useState<QueuedSubmission[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const loadQueue = () => {
    const queue = getQueue();
    setItems(queue);
    if (onQueueUpdated) onQueueUpdated();
  };

  useEffect(() => {
    if (isOpen) {
      loadQueue();
    }
  }, [isOpen]);

  const handleDeleteItem = (id: string, date: string) => {
    dequeueSubmission(id);
    toast.success(`Deleted queued log for ${date}`);
    loadQueue();
  };

  const handleClearAllConfirm = () => {
    clearQueue();
    toast.info("Cleared all queued offline logs");
    loadQueue();
  };

  const handleSyncAll = async () => {
    if (!isOnline) {
      toast.error("You are currently offline. Please reconnect to sync.");
      return;
    }
    if (!onSyncAll) return;
    try {
      setIsSyncing(true);
      await onSyncAll();
      toast.success("Successfully synced offline queue with backend server!");
      loadQueue();
    } catch (err: any) {
      toast.error("Failed to sync queue: " + (err?.message || "Server error"));
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-primary/20 bg-card p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <HardDrive size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
                  Offline Records Queue
                </DialogTitle>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {items.length} Pending
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Logs saved locally while offline. They will automatically push to the server when online.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Network & Toolbar Status Bar */}
        <div className="flex items-center justify-between bg-muted/40 p-3 rounded-2xl border border-border/50 my-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Wifi size={14} /> Server Available
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <WifiOff size={14} /> Device Offline
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setIsClearModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                title="Discard all queued offline records"
              >
                <Trash2 size={13} />
                Clear All
              </button>
            )}
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={!isOnline || items.length === 0 || isSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-primary text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-primary/20"
            >
              <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Syncing..." : "Sync All Now"}
            </button>
          </div>
        </div>

        {/* Queue Items List */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 py-1">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-3">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-sm font-bold text-foreground">All Clear!</h3>
              <p className="text-xs max-w-xs mt-1 text-muted-foreground">
                There are no pending offline records stored locally. All logs have been synced to the database.
              </p>
            </div>
          ) : (
            items.map((item, index) => {
              const isExpanded = expandedId === item.id;
              const formattedCreated = new Date(item.createdAt).toLocaleString(
                undefined,
                {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }
              );

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border/80 bg-card hover:border-primary/40 transition-all overflow-hidden shadow-sm"
                >
                  {/* Card Header */}
                  <div
                    onClick={() => toggleExpand(item.id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground flex items-center gap-1">
                            <User size={13} className="text-muted-foreground" />
                            {item.payload.driver}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                            <Calendar size={12} />
                            {item.payload.date}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <span>
                            {item.payload.jobs?.length || 0} Job
                            {(item.payload.jobs?.length || 0) === 1 ? "" : "s"}
                          </span>
                          <span>•</span>
                          <span>Saved {formattedCreated}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(item.id, item.payload.date);
                        }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete this record"
                      >
                        <Trash2 size={15} />
                      </button>
                      <div className="text-muted-foreground">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content Details */}
                  {isExpanded && (
                    <div className="p-3.5 pt-0 border-t border-border/40 bg-muted/20 text-xs flex flex-col gap-3">
                      <div className="flex items-center justify-between text-muted-foreground pt-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
                          Client TX ID: {item.id}
                        </span>
                        {item.payload.arrivalBackTime && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground bg-background px-2.5 py-1 rounded-lg border border-border">
                            <Clock size={12} className="text-primary" />
                            Returned: {item.payload.arrivalBackTime}
                          </span>
                        )}
                      </div>

                      {/* Jobs Table */}
                      <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/60 text-muted-foreground font-mono uppercase text-[10px] border-b border-border/40">
                            <tr>
                              <th className="py-2 px-3">Job #</th>
                              <th className="py-2 px-3">Task</th>
                              <th className="py-2 px-3">Location</th>
                              <th className="py-2 px-3">Times</th>
                              <th className="py-2 px-3 text-center">Paper</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30 font-medium">
                            {item.payload.jobs.map((job, jIdx) => (
                              <tr key={jIdx} className="hover:bg-muted/20">
                                <td className="py-2 px-3 font-semibold text-primary">
                                  #{job.jobNumber || "N/A"}
                                </td>
                                <td className="py-2 px-3">{job.task || "—"}</td>
                                <td className="py-2 px-3 text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin size={11} className="text-muted-foreground" />
                                    {job.location || "—"}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px]">
                                  {job.startTime || "—"} - {job.stopTime || "—"}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {job.paperwork ? (
                                    <span className="inline-flex items-center text-emerald-500 font-bold">
                                      <CheckCircle2 size={13} />
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center text-muted-foreground/40">
                                      <XCircle size={13} />
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>

      <ConfirmModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleClearAllConfirm}
        title="Clear All Offline Queued Logs?"
        description="Are you sure you want to clear all pending offline delivery logs? They will be permanently removed from your device storage and cannot be recovered."
        confirmText="Clear All Logs"
        cancelText="Cancel"
        variant="destructive"
        icon={<Trash2 size={20} />}
      />
    </Dialog>
  );
}
