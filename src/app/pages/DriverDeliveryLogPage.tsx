import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Toaster } from "../components/ui/sonner";
import { InputDialogModal } from "../components/ui/InputDialogModal";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { getApiUrl } from "../lib/apiConfig";
import { SyncStatusBadge } from "../components/SyncStatusBadge";
import { OfflineQueueModal } from "../components/OfflineQueueModal";
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
  saveShiftDraft,
  getShiftDraft,
  clearShiftDraft,
} from "../lib/shiftDraftStorage";
import {
  MapPin,
  Clock,
  Timer,
  User,
  FileText,
  Plus,
  Flag,
  AlertCircle,
  Save,
  RotateCcw,
  Check,
  Trash2,
  X,
  WifiOff,
} from "lucide-react";

export default function DriverDeliveryLogPage() {
  const today = (() => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const adjusted = new Date(local.getTime() - offset * 60 * 1000);
    return adjusted.toISOString().split("T")[0];
  })();

  // Restore initial state from saved active shift draft if present
  const initialDraft = getShiftDraft();

  const [date, setDate] = useState(today); // Forces today's date as default on load
  const [driver, setDriver] = useState(initialDraft?.driver || "Dion Lewis");
  
  // Guarantee unique IDs across all loaded or initial jobs to prevent state-bleeding
  const [jobs, setJobs] = useState<Job[]>(() => {
    const draftJobs = initialDraft?.jobs;
    if (draftJobs && draftJobs.length > 0) {
      return draftJobs.map((j, index) => ({
        ...j,
        id: Date.now() + index, // Assigns a guaranteed unique ID
      }));
    }
    return [makeJob(Date.now(), "104200"), makeJob(Date.now() + 1, "104201")];
  });

  const [isSigned, setIsSigned] = useState(false);
  const [signatureData, setSignatureData] = useState<string>("");
  const [signatureError, setSignatureError] = useState(false);
  const signatureCardRef = useRef<HTMLDivElement>(null);
  const [arrivalTimeBack, setArrivalTimeBack] = useState(
    initialDraft?.arrivalTimeBack || ""
  );
  const [signatureResetKey, setSignatureResetKey] = useState(0);
  const [lastDraftSavedTime, setLastDraftSavedTime] = useState<string | null>(
    initialDraft?.lastSavedAt
      ? new Date(initialDraft.lastSavedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null
  );

  // Auto-save active shift draft whenever form inputs change
  useEffect(() => {
    saveShiftDraft({ date, driver, jobs, arrivalTimeBack });
    setLastDraftSavedTime(
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }, [date, driver, jobs, arrivalTimeBack]);

  const handleSignatureChange = useCallback((signed: boolean, dataUrl?: string) => {
    setIsSigned(signed);
    if (dataUrl) {
      setSignatureData(dataUrl);
    }
    if (signed) {
      setSignatureError(false);
    }
  }, []);

  const isOnline = useOnlineStatus();
  const [queuedCount, setQueuedCount] = useState<number>(() => getQueue().length);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState<boolean>(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState<boolean>(false);

  const handleConfirmDiscardDraft = useCallback(() => {
    clearShiftDraft();
    setDate(today);
    setDriver("Dion Lewis");
    setJobs([makeJob(Date.now(), "104202")]);
    setArrivalTimeBack("");
    setIsSigned(false);
    setSignatureResetKey((prev) => prev + 1);
    setLastDraftSavedTime(null);
    toast.info("Cleared active shift draft");
  }, [today]);

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
      const res = await fetch(getApiUrl("/api/locations"));
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
    setJobs((prev) => [...prev, makeJob(Date.now() + Math.random(), String(lastNum))]);
  };

  const handleSaveNewLocation = async (newLocName: string) => {
    try {
      const response = await fetch(getApiUrl("/api/locations"), {
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
        const response = await fetch(getApiUrl("/api/submit-day"), {
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
    if (!arrivalTimeBack || arrivalTimeBack.trim() === "") {
      toast.error("Arrival Time Required", {
        description: "Please record your arrival time back at the building before finishing your day.", duration: 4000,
        });
        return;
      }

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
      signature: signatureData,
      jobs: jobs.map((job) => {
        const lockedJobs = JSON.parse(localStorage.getItem('locked_delivery_jobs') || '[]');
        const isLocked = lockedJobs.includes(job.jobNumber);

        const savedReqStr = localStorage.getItem(`delivery_request_${job.jobNumber}`) || localStorage.getItem(`client_data_${job.jobNumber}`) || '{}';
        let savedReq: any = {};
        try {
          savedReq = JSON.parse(savedReqStr);
        } catch (e) {}

        const clientSig = savedReq.clientSignature || savedReq.signature || localStorage.getItem(`client_sig_${job.jobNumber}`) || localStorage.getItem(`client_signature_${job.jobNumber}`) || (isLocked ? 'data:image/png;base64,locked' : '');
        const receivedByName = savedReq.receivedByName || savedReq.name || localStorage.getItem(`received_by_${job.jobNumber}`) || 'Valued Client';
        const clientEmail = savedReq.clientEmail || savedReq.email || localStorage.getItem(`client_email_${job.jobNumber}`) || '';

        return {
          jobNumber: job.jobNumber,
          task: job.task,
          paperwork: job.paperwork,
          location: job.location,
          startTime: job.startTime,
          stopTime: job.stopTime,
          totalTime: job.totalTime || calcTotal(job.startTime, job.stopTime),
          status: isLocked ? "completed" : "pending",
          client_signature: clientSig,
          received_by_name: receivedByName,
          client_email: clientEmail,
        };
      }),
      arrivalBackTime: arrivalTimeBack || "—",
    };  

    const resetForm = () => {
      clearShiftDraft();
      setJobs([makeJob(Date.now(), "104202")]);
      setArrivalTimeBack("");
      setIsSigned(false);
      setSignatureError(false);
      setSignatureResetKey((prev) => prev + 1);
      setLastDraftSavedTime(null);
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
      const response = await fetch(getApiUrl("/api/submit-day"), {
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
              onViewQueue={() => setIsQueueModalOpen(true)}
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

        {/* Offline Persistent Banner */}
        {!isOnline && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <WifiOff size={14} className="text-amber-600 dark:text-amber-400 animate-pulse" />
              </div>
              <div>
                <span className="font-bold">Offline Mode Active: </span>
                <span>You're currently disconnected. Changes and submissions are being saved safely to device storage.</span>
              </div>
            </div>
          </div>
        )}

        {/* Active Shift Draft Indicator & Quick Save Bar */}
        <div className="bg-primary/10 border border-primary/25 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs shadow-sm">
          <div className="flex items-center gap-2 text-primary font-bold">
            <Save size={15} className="text-primary animate-pulse" />
            <span>Shift In-Progress Draft Active</span>
            {lastDraftSavedTime && (
              <span className="text-muted-foreground font-mono text-[11px] font-normal">
                (Auto-saved at {lastDraftSavedTime})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                saveShiftDraft({ date, driver, jobs, arrivalTimeBack });
                toast.success("Shift draft saved to device storage!");
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary font-bold transition-all cursor-pointer"
            >
              <Save size={12} />
              Save Progress
            </button>
            <button
              type="button"
              onClick={() => setIsDiscardModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
              title="Discard draft and reset form"
            >
              <RotateCcw size={12} />
              Discard
            </button>
          </div>
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
        {jobs.map((job, i) => {
          const lockedJobs = JSON.parse(localStorage.getItem('locked_delivery_jobs') || '[]');
          const isJobLocked = lockedJobs.includes(job.jobNumber);
          
          return (
            <div key={job.id} className={`flex flex-col gap-2 p-3 rounded-2xl border transition-all ${isJobLocked ? 'bg-muted/30 border-primary/20 opacity-95' : 'border-transparent'}`}>
              {isJobLocked && (
                <div className="flex items-center justify-between px-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold bg-primary/10 text-primary rounded-xl border border-primary/20">
                    <Check size={12} /> Delivery Request Signed & Completed (Locked)
                  </span>
                </div>
              )}
              <div className={isJobLocked ? "pointer-events-none opacity-75" : ""}>
                <JobBubble
                  job={{ ...job, editing: isJobLocked ? false : job.editing }}  
                  index={i}
                  locationOptions={locationOptions}
                  onRefreshLocations={refreshLocations}
                  onOpenAddLocation={() => {
                    setTargetJobIdForNewLocation(job.id);
                    setIsAddLocationModalOpen(true);
                  }}
                  onChange={(patch) => {
                    if (Object.keys(patch).length === 1 && "totalTime" in patch) return;
                    updateJob(job.id, patch);
                  }}
                  onDelete={() => deleteJob(job.id)}
                />
              </div>

              {/* Action Bar: Fill Delivery Request Button */}
              <div className="flex items-center justify-end px-1 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isJobLocked) return;

                    // 1. Validate Job Number
                    if (!job.jobNumber || !job.jobNumber.trim()) {
                      toast.error("Job Number Required", {
                        description: "Please enter a Job Number before proceeding to the Delivery Request.",
                      });
                      return;
                    }

                    // 2. Validate Task Code
                    if (!job.task || !job.task.trim()) {
                      toast.error("Task Code Required", {
                        description: "Please enter a Task Code before proceeding to the Delivery Request.",
                      });
                      return;
                    }

                    // 3. Validate Delivery Location
                    if (!job.location || !job.location.trim()) {
                      toast.error("Delivery Location Required", {
                        description: "Please enter or select a Delivery Location before proceeding to the Delivery Request.",
                      });
                      return;
                    }

                    // 4. Validate Arrival Acknowledged
                    const isAcknowledged = Object.entries(job).some(([key, val]) => {
                      const k = key.toLowerCase();
                      return (k.includes('arriv') || k.includes('ack') || k.includes('confirm')) && Boolean(val);
                    });

                    if (!isAcknowledged) {
                      toast.error("Arrival Acknowledged Required", {
                        description: "Please check 'Arrival Acknowledged' before proceeding to the Delivery Request.",
                      });
                      return;
                    }

                    // 5. Validate Start and Stop Times
                    if (!job.startTime || !job.stopTime) {
                      toast.error("Times Required", {
                        description: "Please enter both Start Time and Stop Time before filling the Delivery Request.",
                      });
                      return;
                    }

                    let hrs = '';
                    let min = '';
                    if (job.startTime && job.stopTime) {
                      const [startH, startM] = job.startTime.split(':').map(Number);
                      const [stopH, stopM] = job.stopTime.split(':').map(Number);
                      const startTotalMin = startH * 60 + startM;
                      const stopTotalMin = stopH * 60 + stopM;
                      const diffMin = Math.max(0, stopTotalMin - startTotalMin);
                      hrs = Math.floor(diffMin / 60).toString();
                      min = (diffMin % 60).toString();
                    }

                    window.location.href = `/delivery-request?job=${encodeURIComponent(job.jobNumber || '')}&task=${encodeURIComponent(job.task || '')}&date=${encodeURIComponent(date)}&driver=${encodeURIComponent(driver)}&hrs=${encodeURIComponent(hrs)}&min=${encodeURIComponent(min)}`;
                  }}
                  disabled={isJobLocked}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    isJobLocked
                      ? 'bg-muted text-muted-foreground border-border cursor-not-allowed opacity-60'
                      : 'bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary cursor-pointer shadow-sm'
                  }`}
                >
                  <FileText size={12} />
                  {isJobLocked ? 'Delivery Request Completed' : 'Fill Delivery Request'}
                </button>
              </div>
            </div>
          );
        })}

        {/* Add another job */}
        <button
          type="button"
          onClick={addJob}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl border-2 border-dashed border-primary/30 text-primary text-sm font-semibold hover:bg-primary/5 hover:border-primary/50 transition-all"
        >
          <Plus size={16} />
          Add Another Job
        </button>

        {/* Arrival Time Back at Building */}
        <div
          className="rounded-2xl border bg-card px-5 py-4 flex flex-col gap-3"
          style={{
            borderColor: "rgba(124,92,252,0.15)",
            boxShadow: "0 2px 12px rgba(124,92,252,0.07)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                Route End Tracker
              </p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                Arrival Time Back at Building
              </p>
            </div>
            {arrivalTimeBack && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setArrivalTimeBack("");
                }}
                className="text-[10px] font-mono font-semibold text-muted-foreground hover:text-destructive transition-colors cursor-pointer flex items-center gap-0.5"
                title="Clear arrival time"
              >
                <X size={10} /> Clear Time
              </button>
            )}
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
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-muted/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 flex-1">
              <Clock size={14} className="text-primary flex-shrink-0" />
              <input
                type="time"
                value={arrivalTimeBack}
                onChange={(e) => setArrivalTimeBack(e.target.value)}
                className="flex-1 bg-transparent text-sm font-bold font-mono text-foreground focus:outline-none cursor-pointer [color-scheme:light]"
              />
            </div>
            {arrivalTimeBack && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setArrivalTimeBack("");
                }}
                className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-destructive rounded-full bg-muted/80 transition-all cursor-pointer flex-shrink-0"
                title="Clear arrival time"
              >
                <X size={14} />
              </button>
            )}
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

      <OfflineQueueModal
        isOpen={isQueueModalOpen}
        onClose={() => setIsQueueModalOpen(false)}
        isOnline={isOnline}
        onSyncAll={processQueue}
        onQueueUpdated={refreshQueueCount}
      />

      <ConfirmModal
        isOpen={isDiscardModalOpen}
        onClose={() => setIsDiscardModalOpen(false)}
        onConfirm={handleConfirmDiscardDraft}
        title="Discard In-Progress Shift Draft?"
        description="Are you sure you want to discard your current shift draft and reset the form? All unsaved progress for this shift will be removed."
        confirmText="Discard Shift Draft"
        cancelText="Keep Editing"
        variant="destructive"
        icon={<Trash2 size={20} />}
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