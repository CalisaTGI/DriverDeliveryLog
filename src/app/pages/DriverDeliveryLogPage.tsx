import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Toaster } from "../components/ui/sonner";
import { InputDialogModal } from "../components/ui/InputDialogModal";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { SyncStatusBadge } from "../components/SyncStatusBadge";
import { JobBubble } from "../components/JobBubble";
import { SignatureCanvas } from "../components/SignatureCanvas";
import { Dropdown } from "../components/Dropdown";
import { CalendarPicker } from "../components/CalendarPicker";
import { Job, makeJob, getNextJobId } from "../types/deliveryLog";
import { DRIVERS } from "../constants/drivers";
import { calcTotal, sumTimes } from "../utils/timeCalculations";
import {
  enqueueSubmission,
  getQueue,
  dequeueSubmission,
  cacheLocations,
  getCachedLocations,
} from "../lib/offlineQueue";
import {
  MapPin,
  Clock,
  Timer,
  User,
  FileText,
  Plus,
  Flag,
  AlertCircle,
} from "lucide-react";

export default function DriverDeliveryLogPage() {
  const today = (() => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const adjusted = new Date(local.getTime() - offset * 60 * 1000);
    return adjusted.toISOString().split("T")[0];
  })();

  const [date, setDate] = useState(today);
  const [driver, setDriver] = useState("Dion Lewis");
  const [jobs, setJobs] = useState<Job[]>([
    makeJob(1, "104200"),
    makeJob(2, "104201"),
  ]);
  const [isSigned, setIsSigned] = useState(false);
  const [signatureError, setSignatureError] = useState(false);
  const signatureCardRef = useRef<HTMLDivElement>(null);
  const [arrivalTimeBack, setArrivalTimeBack] = useState("");
  const [signatureResetKey, setSignatureResetKey] = useState(0);

  const handleSignatureChange = useCallback((signed: boolean) => {
    setIsSigned(signed);
    if (signed) {
      setSignatureError(false);
    }
  }, []);

  const isOnline = useOnlineStatus();
  const [queuedCount, setQueuedCount] = useState<number>(() => getQueue().length);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshQueueCount = useCallback(() => {
    setQueuedCount(getQueue().length);
  }, []);

  const [locationOptions, setLocationOptions] = useState<string[]>(() =>
    getCachedLocations()
  );
  const [isAddLocationModalOpen, setIsAddLocationModalOpen] = useState(false);
  const [targetJobIdForNewLocation, setTargetJobIdForNewLocation] = useState<
    number | null
  >(null);

  // Fetch locations from backend server, falling back to local cache if offline/unreachable
  const refreshLocations = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:5000/api/locations");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setLocationOptions(data);
          cacheLocations(data);
          return;
        }
      }
    } catch {
      // Backend server is offline or unreachable; fall back to cached locations
    }
    setLocationOptions(getCachedLocations());
  }, []);

  useEffect(() => {
    refreshLocations();
  }, [refreshLocations]);

  const updateJob = useCallback((id: number, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const deleteJob = useCallback((id: number) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const addJob = () => {
    const lastNum = jobs.length
      ? Number(jobs[jobs.length - 1].jobNumber) + 1
      : 104202;
    setJobs((prev) => [...prev, makeJob(getNextJobId(), String(lastNum))]);
  };

  const handleSaveNewLocation = async (newLocName: string) => {
    try {
      const response = await fetch("http://localhost:5000/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLocName.trim() }),
      });

      if (response.ok) {
        if (targetJobIdForNewLocation !== null) {
          updateJob(targetJobIdForNewLocation, { location: newLocName.trim() });
        }
        await refreshLocations();
        toast.success("Location Added", {
          description: `"${newLocName.trim()}" was added to your quick-pick list.`,
        });
        return true;
      } else {
        const errorData = await response.json();
        toast.error("Location Save Error", {
          description:
            errorData?.error || "This location name already exists or failed to save.",
        });
        return false;
      }
    } catch (err) {
      console.error("Failed to add location:", err);
      toast.error("Connection Error", {
        description: "Failed to connect to server to save location.",
      });
      return false;
    }
  };

  // Background Auto-Sync Engine
  const processQueue = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;

    for (const item of queue) {
      try {
        const response = await fetch("http://localhost:5000/api/submit-day", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });

        if (response.ok) {
          dequeueSubmission(item.id);
          successCount++;
        }
      } catch (err) {
        console.error("Failed to sync queued item:", err);
        break;
      }
    }

    setIsSyncing(false);
    refreshQueueCount();

    if (successCount > 0) {
      toast.success(
        `Auto-synced ${successCount} offline delivery log${
          successCount > 1 ? "s" : ""
        } to database!`
      );
    }
  }, [refreshQueueCount]);

  useEffect(() => {
    if (isOnline && getQueue().length > 0) {
      processQueue();
    }
  }, [isOnline, processQueue]);

  const driveTotal = sumTimes(jobs);

  const executeFinishDay = async () => {
    if (!isSigned) {
      setSignatureError(true);
      if (signatureCardRef.current) {
        signatureCardRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      toast.error("Signature Required", {
        description:
          "Please provide a driver signature confirming deliveries before finishing the day.",
        duration: 4000,
      });
      return;
    }

    if (jobs.length === 0) {
      toast.error("No Delivery Log Entries", {
        description:
          "Please add at least one delivery log entry before completing your day.",
        duration: 4000,
      });
      return;
    }

    const clientTxId = `tx_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    const payload = {
      clientTxId,
      date: date,
      driver: driver,
      jobs: jobs.map((job) => ({
        jobNumber: job.jobNumber,
        task: job.task,
        paperwork: job.paperwork,
        location: job.location,
        startTime: job.startTime,
        stopTime: job.stopTime,
        totalTime: job.totalTime || calcTotal(job.startTime, job.stopTime),
      })),
      arrivalBackTime: arrivalTimeBack || "—",
    };

    const resetForm = () => {
      setJobs([makeJob(getNextJobId(), "104202")]);
      setArrivalTimeBack("");
      setIsSigned(false);
      setSignatureError(false);
      setSignatureResetKey((prev) => prev + 1);
    };

    if (!isOnline) {
      enqueueSubmission(payload);
      refreshQueueCount();
      toast.info(
        "Offline: Daily log saved to local queue. Will sync automatically when connected."
      );
      resetForm();
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/submit-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success("Success! Your daily delivery logs have been saved.");
        resetForm();
      } else {
        const errorMsg = await response.json();
        toast.error("Database Error", {
          description:
            errorMsg.error || "An error occurred while saving delivery logs.",
          duration: 5000,
        });
      }
    } catch (error) {
      console.warn(
        "Network transmission broken, falling back to offline queue:",
        error
      );
      enqueueSubmission(payload);
      refreshQueueCount();
      toast.info(
        "Connection lost: Daily log saved to local queue. Will sync when server is reachable."
      );
      resetForm();
    }
  };

  return (
    <div
      className="size-full overflow-y-auto py-8 px-4"
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: "var(--background)",
      }}
    >
      <Toaster />
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-5">
        {/* Title & Sync Status */}
        <div className="text-center pt-1 relative">
          <div className="sm:absolute sm:right-0 sm:top-1 flex justify-center mb-3 sm:mb-0">
            <SyncStatusBadge
              isOnline={isOnline}
              queuedCount={queuedCount}
              isSyncing={isSyncing}
              onManualSync={processQueue}
            />
          </div>
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <FileText size={15} className="text-white" />
            </div>
          </div>
          <h1
            className="text-3xl font-extrabold text-foreground"
            style={{ letterSpacing: "-0.02em" }}
          >
            Driver Delivery Log
          </h1>
          <p className="text-muted-foreground text-xs font-mono mt-1 uppercase tracking-widest">
            Daily Route Record
          </p>
        </div>

        {/* Date + Driver */}
        <div className="flex gap-3">
          <CalendarPicker value={date} onChange={setDate} />
          <Dropdown
            label="Driver"
            icon={User}
            options={DRIVERS}
            value={driver}
            onChange={setDriver}
          />
        </div>

        {/* Job bubbles */}
        {jobs.map((job, i) => (
          <JobBubble
            key={job.id}
            job={job}
            index={i}
            locationOptions={locationOptions}
            onRefreshLocations={refreshLocations}
            onOpenAddLocation={() => {
              setTargetJobIdForNewLocation(job.id);
              setIsAddLocationModalOpen(true);
            }}
            onChange={(patch) => updateJob(job.id, patch)}
            onDelete={() => deleteJob(job.id)}
          />
        ))}

        {/* Add another job */}
        <button
          type="button"
          onClick={addJob}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl border-2 border-dashed border-primary/30 text-primary text-sm font-semibold hover:bg-primary/5 hover:border-primary/50 transition-all"
        >
          <Plus size={16} />
          Add Another Job
        </button>

        {/* New Field: Arrival Time Back at Building*/}
        <div
          className="rounded-2xl border bg-card px-5 py-4 flex flex-col gap-3"
          style={{
            borderColor: "rgba(124,92,252,0.15)",
            boxShadow: "0 2px 12px rgba(124,92,252,0.07)",
          }}
        >
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Route End Tracker
            </p>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              Arrival Time Back at Building
            </p>
          </div>

          <div
            onClick={(e) => {
              e.stopPropagation();
              const input = e.currentTarget.querySelector("input");
              if (input) {
                if (!arrivalTimeBack) {
                  const now = new Date();
                  const currentStr = `${String(now.getHours()).padStart(
                    2,
                    "0"
                  )}:${String(now.getMinutes()).padStart(2, "0")}`;
                  setArrivalTimeBack(currentStr);
                }
                if (typeof input.showPicker === "function") input.showPicker();
              }
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/40 transition-colors cursor-pointer"
          >
            <Clock size={14} className="text-primary flex-shrink-0" />
            <input
              type="time"
              value={arrivalTimeBack}
              onChange={(e) => setArrivalTimeBack(e.target.value)}
              className="flex-1 bg-transparent text-sm font-bold font-mono text-foreground focus:outline-none cursor-pointer [color-scheme:light]"
            />
          </div>
        </div>

        {/* Drive Time Today */}
        <div
          className="rounded-2xl border bg-card px-5 py-4 flex items-center justify-between"
          style={{
            borderColor: "rgba(124,92,252,0.15)",
            boxShadow: "0 2px 12px rgba(124,92,252,0.07)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Timer size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                Drive Time Today
              </p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                Total across all jobs
              </p>
            </div>
          </div>
          <span
            className="text-2xl font-extrabold text-primary font-mono"
            style={{ letterSpacing: "-0.02em" }}
          >
            {driveTotal}
          </span>
        </div>

        {/* Signature bubble */}
        <div
          ref={signatureCardRef}
          className={`rounded-3xl border bg-card px-5 py-5 flex flex-col gap-4 transition-all duration-300 ${
            signatureError ? "animate-shake ring-2 ring-destructive/60" : ""
          }`}
          style={{
            borderColor: signatureError
              ? "rgba(239, 68, 68, 0.6)"
              : "rgba(124,92,252,0.15)",
            boxShadow: signatureError
              ? "0 4px 20px rgba(239, 68, 68, 0.18)"
              : "0 2px 16px rgba(124,92,252,0.07)",
          }}
        >
          <SignatureCanvas
            key={signatureResetKey}
            onSignatureChange={handleSignatureChange}
            hasError={signatureError}
          />
          {signatureError ? (
            <p className="text-xs font-semibold text-destructive text-center flex items-center justify-center gap-1.5 animate-pulse">
              <AlertCircle size={14} /> Signature is required to complete submission
            </p>
          ) : (
            <p className="text-[10px] font-mono text-muted-foreground text-center uppercase tracking-widest">
              By signing, I confirm all deliveries are accurate
            </p>
          )}
        </div>

        {/* Finish Day */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            executeFinishDay();
          }}
          className="w-full flex items-center justify-center gap-3 py-5 rounded-3xl font-bold text-base text-white transition-all hover:brightness-110 active:scale-[0.99]"
          style={{
            background: "linear-gradient(135deg, #7c5cfc 0%, #5a3de0 100%)",
            boxShadow: "0 6px 28px rgba(124,92,252,0.35)",
          }}
        >
          <Flag size={18} />
          Finish Day
        </button>

        <div className="pb-6" />
      </div>

      <InputDialogModal
        isOpen={isAddLocationModalOpen}
        onClose={() => setIsAddLocationModalOpen(false)}
        onSubmit={handleSaveNewLocation}
        title="Add Quick-Pick Location"
        description="Enter a location name or address to add it to your quick-pick list for future entries."
        label="Location Name"
        placeholder="e.g. Warehouse B, Building 4 Dock..."
        confirmText="Save Location"
        cancelText="Cancel"
        icon={<MapPin size={18} />}
      />

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
        input[type="time"]::-webkit-calendar-picker-indicator {
          position: absolute;
          right: 0;
          top: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
        }
        input[type="time"] {
          position: relative;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(124,92,252,0.2); border-radius: 99px; }
      `}</style>
    </div>
  );
}
