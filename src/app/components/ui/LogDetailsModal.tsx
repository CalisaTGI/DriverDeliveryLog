import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog";
import {
  FileText,
  User,
  Calendar,
  Hash,
  MapPin,
  Clock,
  Timer,
  CheckCircle2,
  XCircle,
  Building,
  Printer,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export interface DatabaseLog {
  id: number;
  log_date: string;
  driver_name: string;
  job_number: string;
  task_letter: string;
  paperwork: number;
  location: string;
  start_time: string;
  stop_time: string;
  total_time: string;
  arrival_back_time: string;
  signature?: string;
  client_signature?: string;
  received_by_name?: string;
  client_email?: string;
  instructions?: string;
  details?: string;
}

interface LogDetailsModalProps {
  log: DatabaseLog | null;
  isOpen: boolean;
  onClose: () => void;
}

  export function LogDetailsModal({ log: initialLog, isOpen, onClose }: LogDetailsModalProps) {
    // Automatically merge saved delivery request data from localStorage if available
    const log = React.useMemo(() => {
      if (!initialLog) return null;
      if (!initialLog.job_number) return initialLog;
  
      const savedReqStr = localStorage.getItem(`delivery_request_${initialLog.job_number}`);
      if (savedReqStr) {
        try {
          const parsed = JSON.parse(savedReqStr);
          return {
          ...initialLog,
          client_signature: initialLog.client_signature || parsed.clientSignature || '',
          received_by_name: initialLog.received_by_name || parsed.receivedByName || '',
          client_email: initialLog.client_email || parsed.clientEmail || '',
        };
      } catch (e) {}
    }
    return initialLog;
  }, [initialLog]);

  if (!log) return null;

  const formatDisplayDate = (isoStr: string) => {
    if (!isoStr) return "—";
    const d = new Date(isoStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleCopySummary = () => {
    const summary = `
    === Driver Delivery Log Details ===
    Record ID: #${log.id}
    Date: ${formatDisplayDate(log.log_date)}
    Driver: ${log.driver_name}
    Job #: ${log.job_number}
    Task Code: ${log.task_letter || "N/A"}
    Paperwork: ${log.paperwork === 1 ? "Completed" : "No"}
    Location: ${log.location || "N/A"}
    Start Time: ${log.start_time || "N/A"}
    Stop Time: ${log.stop_time || "N/A"}
    Total Time: ${log.total_time || "N/A"}
    Arrival Back: ${log.arrival_back_time || "N/A"}
    Client Signed: ${log.client_signature ? "Yes (" + (log.received_by_name || "Client") + ")" : "No"}
        `.trim();
    navigator.clipboard.writeText(summary);
    toast.success("Log summary copied to clipboard!");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <DialogHeader className="pb-4 border-b border-slate-100 flex flex-col gap-2 text-left">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold font-mono">
              <FileText size={13} />
              Record #{log.id}
            </div>
            <span className="text-xs font-mono font-semibold text-slate-400">
              {formatDisplayDate(log.log_date)}
            </span>
          </div>

          <DialogTitle className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <User size={20} className="text-primary" />
            {log.driver_name}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-medium">
            Detailed delivery time log entry breakdown & sign-offs
          </DialogDescription>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex flex-col gap-4 py-3 overflow-y-auto flex-1 pr-1 my-1">
          {/* Key Job Info Card */}
          <div className="grid grid-cols-2 gap-3">
            {/* Job Number */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1">
              <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                <Hash size={12} className="text-primary" />
                Job Number
              </div>
              <span className="text-base font-extrabold font-mono text-slate-900">
                {log.job_number || "—"}
              </span>
            </div>

            {/* Task Letter */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1">
              <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                <FileText size={12} className="text-primary" />
                Task Code
              </div>
              <span className="text-base font-extrabold font-mono text-slate-900">
                {log.task_letter || "—"}
              </span>
            </div>
          </div>

          {/* Paperwork Status Badge */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {log.paperwork === 1 ? (
                <CheckCircle2 size={18} className="text-emerald-600" />
              ) : (
                <XCircle size={18} className="text-slate-400" />
              )}
              <span className="text-xs font-bold text-slate-700">
                Paperwork Status
              </span>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold font-mono uppercase ${
                log.paperwork === 1
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}
            >
              {log.paperwork === 1 ? "Completed" : "Not Completed"}
            </span>
          </div>

          {/* Location Details */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
              <MapPin size={13} className="text-primary" />
              Pick Up / Delivery Location
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-snug">
              {log.location || "No location recorded"}
            </p>
          </div>

          {/* Time Tracking Grid */}
          <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-violet-100 pb-2">
              <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                <Clock size={13} /> Time Breakdown
              </span>
              <span className="text-xs font-bold font-mono text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                Total: {log.total_time || "—"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {/* Start */}
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex flex-col gap-0.5">
                <span className="text-[9px] font-mono font-semibold text-slate-400 uppercase">
                  Start Time
                </span>
                <span className="text-xs font-bold font-mono text-slate-800">
                  {log.start_time || "—"}
                </span>
              </div>

              {/* Stop */}
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex flex-col gap-0.5">
                <span className="text-[9px] font-mono font-semibold text-slate-400 uppercase">
                  Stop Time
                </span>
                <span className="text-xs font-bold font-mono text-slate-800">
                  {log.stop_time || "—"}
                </span>
              </div>

              {/* Total */}
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex flex-col gap-0.5">
                <span className="text-[9px] font-mono font-semibold text-primary uppercase">
                  Drive Total
                </span>
                <span className="text-xs font-extrabold font-mono text-primary">
                  {log.total_time || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Arrival Back at Building */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Building size={16} className="text-primary" />
              Arrival Back at Building
            </div>
            <span className="text-xs font-extrabold font-mono text-slate-900 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-2xs">
              {log.arrival_back_time || "—"}
            </span>
          </div>

          {/* Driver Signature Section */}
          <div className="rounded-2xl border bg-slate-50 p-4 flex flex-col gap-2">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
              Driver Signature (Shift Confirmation)
            </span>
            {log.signature ? (
              <div className="border rounded-xl bg-white p-2 inline-block max-w-xs">
                <img src={log.signature} alt="Driver Signature" className="max-h-16 object-contain" />
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No driver signature recorded.</p>
            )}
          </div>

          {/* Client Delivery Request Signed Indicator & Access */}
          <div className="rounded-2xl border bg-slate-50 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                  Client Delivery Request Status
                </span>
                <div className="mt-1">
                  {log.client_signature ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                      <Check size={12} /> Signed by Client ({log.received_by_name || 'Valued Client'})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-300">
                      Pending / No Client Signature Yet
                    </span>
                  )}
                </div>
              </div>
            </div>

            {log.client_signature && (
              <div className="pt-3 border-t border-slate-200 flex flex-col gap-2.5">
                <span className="text-xs font-bold text-slate-700">Signed Delivery Request Copy:</span>
                <div className="border border-slate-200 rounded-xl bg-white p-3 inline-block max-w-xs">
                  <img src={log.client_signature} alt="Client Signature" className="max-h-20 object-contain mx-auto" />
                </div>
                <div className="text-xs text-slate-600 space-y-1 font-medium">
                  <div><strong className="text-slate-900">Received By:</strong> {log.received_by_name || '—'}</div>
                  <div><strong className="text-slate-900">Client Email:</strong> {log.client_email || '—'}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="pt-3 border-t border-slate-100 flex flex-row items-center justify-between sm:justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Copy size={13} />
              Copy
            </button>
            <button
              type="button"
              onClick={() => {
                let hrs = '';
                let min = '';
                if (log.start_time && log.stop_time) {
                  const [startH, startM] = log.start_time.split(':').map(Number);
                  const [stopH, stopM] = log.stop_time.split(':').map(Number);
                  const startTotalMin = startH * 60 + startM;
                  const stopTotalMin = stopH * 60 + stopM;
                  const diffMin = Math.max(0, stopTotalMin - startTotalMin);
                  hrs = Math.floor(diffMin / 60).toString();
                  min = (diffMin % 60).toString();
                }
                window.location.href = `/delivery-request?job=${encodeURIComponent(log.job_number || '')}&task=${encodeURIComponent(log.task_letter || '')}&date=${encodeURIComponent(log.log_date || '')}&driver=${encodeURIComponent(log.driver_name || '')}&hrs=${encodeURIComponent(hrs)}&min=${encodeURIComponent(min)}`;
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer"
            >
              <FileText size={13} />
              View Delivery Request
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:brightness-110 shadow-md shadow-primary/20 transition-all cursor-pointer"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}