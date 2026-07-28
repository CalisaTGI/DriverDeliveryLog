import BillingDashboard from "./BillingDashboard";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { SyncStatusBadge } from "./components/SyncStatusBadge";
import {
  enqueueSubmission,
  getQueue,
  dequeueSubmission,
  cacheLocations,
  getCachedLocations,
} from "./lib/offlineQueue";
import {
  ChevronDown,
  MapPin,
  Clock,
  CheckSquare,
  Square,
  CheckCircle2,
  Circle,
  Timer,
  Navigation,
  CalendarDays,
  User,
  Hash,
  FileText,
  Loader,
  Pencil,
  Trash2,
  Plus,
  X,
  RotateCcw,
  Flag,
} from "lucide-react";

const DRIVERS = [
  "Adam Safford",
  "Brandon Bowen",
  "Carlos Nunez",
  "Dion Lewis",
  "James LeFevre",
];

type Status = "not-started" | "in-progress" | "completed";

interface Job {
  id: number;
  jobNumber: string;
  task: string;
  paperwork: boolean;
  status: Status;
  location: string;
  startTime: string;
  stopTime: string;
  arrivalAck: boolean;
  editing: boolean;
}

let nextId = 3;

const makeJob = (id: number, jobNum: string): Job => ({
  id,
  jobNumber: jobNum,
  task: "",
  paperwork: false,
  status: "not-started",
  location: "",
  startTime: "",
  stopTime: "",
  arrivalAck: false,
  editing: true,
});

/* ── helpers ── */
function calcTotal(start: string, stop: string) {
  if (!start || !stop) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = stop.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) return "";
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function sumTimes(jobs: Job[]) {
  let total = 0;
  jobs.forEach((j) => {
    if (!j.startTime || !j.stopTime) return;
    const [sh, sm] = j.startTime.split(":").map(Number);
    const [eh, em] = j.stopTime.split(":").map(Number);
    const m = eh * 60 + em - (sh * 60 + sm);
    if (m > 0) total += m;
  });
  if (!total) return "—";
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/* ── tiny shared components ── */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}

function Dropdown({
  label,
  icon: Icon,
  options,
  value,
  onChange,
}: {
  label: string;
  icon: React.ElementType;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative flex-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border bg-card shadow-sm text-foreground transition-all hover:border-primary/40 focus:outline-none"
        style={{ boxShadow: open ? "0 0 0 2px rgba(124,92,252,0.18)" : "0 1px 4px rgba(100,90,180,0.08)" }}
      >
        <Icon size={15} className="text-primary flex-shrink-0" />
        <div className="flex-1 text-left min-w-0">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest leading-none mb-0.5">{label}</p>
          <p className="text-sm font-semibold text-foreground truncate">{value}</p>
        </div>
        <ChevronDown size={13} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
          {options.map((opt) => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${opt === value ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-muted"}`}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = new Date(value + "T00:00:00");
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const select = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(iso);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex-1">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border bg-card text-foreground transition-all hover:border-primary/40 focus:outline-none"
        style={{ boxShadow: open ? "0 0 0 2px rgba(124,92,252,0.18)" : "0 1px 4px rgba(100,90,180,0.08)" }}>
        <CalendarDays size={15} className="text-primary flex-shrink-0" />
        <div className="flex-1 text-left">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest leading-none mb-0.5">Date</p>
          <p className="text-sm font-semibold text-foreground">{formatDate(value)}</p>
        </div>
        <ChevronDown size={13} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-card border border-border rounded-2xl shadow-xl z-50 p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown size={14} className="rotate-90" />
            </button>
            <span className="text-sm font-bold text-foreground">{MONTHS[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown size={14} className="-rotate-90" />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-mono text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isSelected = iso === value;
              const isToday = iso === today;
              return (
                <button key={i} onClick={() => select(day)}
                  className={`w-8 h-8 mx-auto rounded-xl text-xs font-semibold transition-all ${
                    isSelected ? "bg-primary text-white" :
                    isToday ? "border border-primary/40 text-primary" :
                    "text-foreground hover:bg-muted"
                  }`}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Signature canvas ── */
function SignatureCanvas({ onSignatureChange }: { onSignatureChange: (isSigned: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = "#7c5cfc";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    if (!signed) {
      setSigned(true);
      onSignatureChange(true);
    }
  };

  const end = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setSigned(false);
    onSignatureChange(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Driver Signature</Label>
        {signed && (
          <button onClick={clear} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors font-mono">
            <RotateCcw size={11} /> Clear
          </button>
        )}
      </div>
      <div className="relative rounded-2xl border border-border bg-white overflow-hidden" style={{ boxShadow: "inset 0 1px 4px rgba(100,90,180,0.06)" }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={160}
          className="w-full touch-none cursor-crosshair block"
          style={{ height: 100 }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
        {!signed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm text-muted-foreground/50 font-mono italic">Sign here…</span>
          </div>
        )}
        <div className="absolute bottom-2 left-4 right-4 h-px border-b border-dashed border-muted-foreground/20" />
      </div>
    </div>
  );
}

/* ── Job bubble ── */
function JobBubble({
  job,
  index,
  locationOptions,
  onRefreshLocations,
  onChange,
  onDelete,
}: {
  job: Job;
  index: number;
  locationOptions: string[];
  onRefreshLocations: () => void;
  onChange: (updated: Partial<Job>) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const total = calcTotal(job.startTime, job.stopTime);

  const handleAddNewLocation = async () => {
    const newLoc = prompt("Enter the name of the new location to add to your quick-pick list:");
    if (!newLoc || !newLoc.trim()) return;

    try {
      const response = await fetch("http://localhost:5000/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLoc.trim() })
      });

      if (response.ok) {
        onChange({ location: newLoc.trim() });
        onRefreshLocations();
      } else {
        alert("This location name already exists or failed to save.");
      }
    } catch (err) {
      console.error("Failed to add location:", err);
    }
  };

  return (
    <div
      className="rounded-3xl border bg-card flex flex-col gap-5 overflow-hidden"
      style={{
        borderColor: job.editing ? "rgba(124,92,252,0.25)" : "rgba(124,92,252,0.1)",
        boxShadow: job.editing
          ? "0 6px 32px rgba(124,92,252,0.12), 0 1px 0 rgba(255,255,255,0.9) inset"
          : "0 2px 12px rgba(100,90,180,0.07), 0 1px 0 rgba(255,255,255,0.9) inset",
      }}
    >
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Hash size={13} className="text-primary" />
          </div>
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            Job {index + 1}
          </span>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-mono font-semibold border ${
          job.status === "completed" ? "bg-emerald-50 border-emerald-200 text-emerald-600"
          : job.status === "in-progress" ? "bg-amber-50 border-amber-200 text-amber-600"
          : "bg-red-50 border-red-200 text-red-600"
        }`}>
          {job.status === "not-started" ? "Not Started" : job.status === "in-progress" ? "In Progress" : "Completed"}
        </div>
      </div>

      <div className="px-5 flex flex-col gap-4">
        <div className="flex items-stretch gap-0 rounded-2xl overflow-hidden border border-border bg-muted/30">
          <div className="flex flex-col gap-1.5 px-4 py-3.5 flex-1 min-w-0 focus-within:bg-primary/4 transition-colors">
            <Label>Job #</Label>
            <input
              type="text"
              value={job.jobNumber}
              disabled={!job.editing}
              onChange={(e) => onChange({ jobNumber: e.target.value.replace(/\D/g, "").slice(0, 7) })}
              placeholder="100000"
              inputMode="numeric"
              className={`bg-transparent w-full text-5xl font-extrabold text-primary leading-none focus:outline-none placeholder:text-primary/20 ${!job.editing ? "opacity-60 cursor-not-allowed" : ""}`}
              style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}
            />
          </div>

          <div className="w-px bg-border flex-shrink-0" />

          <div className="flex flex-col gap-3 px-4 py-3.5 flex-1 min-w-0">
            <div>
              <Label>Task Code</Label>
              <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card focus-within:border-primary/40 transition-colors">
                <FileText size={12} className="text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={job.task}
                  disabled={!job.editing}
                  onChange={(e) => onChange({ task: e.target.value.toUpperCase().slice(0, 50) })}
                  placeholder="A, BC…"
                  className={`flex-1 bg-transparent text-sm font-bold font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none tracking-widest min-w-0 ${
                  !job.editing ? "opacity-60 cursor-not-allowed" : ""}`}
                />
              </div>
            </div>
            <button
              onClick={() => {
                if (!job.editing) return;
                onChange({ paperwork: !job.paperwork });
              }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                !job.editing ? "opacity-60 cursor-not-allowed" : "hover:border-primary/20"
              } ${
                job.paperwork ? "bg-primary/8 border-primary/25" : "bg-card border-border"
              }`}
            >
              {job.paperwork
                ? <CheckSquare size={15} className="text-primary flex-shrink-0" />
                : <Square size={15} className="text-muted-foreground flex-shrink-0" />}
              <span className={`text-xs font-semibold ${job.paperwork ? "text-primary" : "text-muted-foreground"}`}>
                Paperwork
              </span>
              {job.paperwork && <span className="ml-auto text-[10px] font-mono bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">✓</span>}
            </button>
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="flex flex-col gap-1.5">
          <Label>Delivery Location</Label>
          <div className="relative">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-muted/40 focus-within:border-primary/40 transition-colors ${
              !job.editing ? "opacity-60 cursor-not-allowed" : ""
            }`}>
              <MapPin size={14} className="text-primary flex-shrink-0" />
              <input
                type="text"
                value={job.location}
                disabled={!job.editing}
                onFocus={() => { if (job.editing) setShowLocationDropdown(true); }}
                onBlur={() => setTimeout(() => setShowLocationDropdown(false), 250)}
                onChange={(e) => onChange({ location: e.target.value })}
                placeholder="Enter address or location name…"
                className={`flex-1 bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/40 focus:outline-none ${
                  !job.editing ? "cursor-not-allowed" : ""
                }`}
              />
              {job.location && <Navigation size={12} className="text-primary flex-shrink-0" />}
            </div>

            {showLocationDropdown && job.editing && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                {locationOptions.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onMouseDown={(e) => {
                      // Using onMouseDown prevents the input onBlur from firing before the click registers
                      e.preventDefault(); 
                      onChange({ location: loc });
                      setShowLocationDropdown(false);
                    }}
                    className="w-full text-left px-4 py-3 text-sm font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors border-b border-border last:border-0"
                  >
                    📍 {loc}
                  </button>
                ))}
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleAddNewLocation();
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-bold bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all flex items-center gap-2 sticky bottom-0 border-t border-primary/20"
                >
                  <Plus size={14} /> Add new location…
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="h-px bg-border" />

        <div className="flex flex-col gap-2">
          <Label>Time Tracking</Label>
          <div className="grid grid-cols-3 gap-2">
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (!job.editing) return;
                const input = e.currentTarget.querySelector('input');
                if (input) {
                  if (!job.startTime) {
                    const now = new Date();
                    const currentStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    onChange({ startTime: currentStr, status: job.stopTime ? "completed" : "in-progress" });
                  }
                  if (typeof input.showPicker === 'function') input.showPicker();
                }
              }}
              className={`flex flex-col gap-1.5 rounded-2xl border border-border bg-muted/40 px-3 py-3 focus-within:border-primary/30 transition-colors ${
                !job.editing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <div className="flex items-center gap-1">
                <Clock size={10} className="text-muted-foreground" />
                <Label>Start</Label>
              </div>
              <input
                type="time"
                value={job.startTime || ""}
                disabled={!job.editing}
                onChange={(e) => {
                  const st = e.target.value;
                  onChange({ startTime: st, status: st ? (job.stopTime ? "completed" : "in-progress") : "not-started" });
                }}
                className={`bg-transparent text-sm font-bold font-mono text-foreground focus:outline-none w-full [color-scheme:light] ${
                  !job.editing ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              />
            </div>

            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (!job.editing) return;
                const input = e.currentTarget.querySelector('input');
                if (input) {
                  if (!job.stopTime) {
                    const now = new Date();
                    const currentStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    onChange({ stopTime: currentStr, status: job.startTime ? "completed" : "not-started" });
                  }
                  if (typeof input.showPicker === 'function') input.showPicker();
                }
              }}
              className={`flex flex-col gap-1.5 rounded-2xl border border-border bg-muted/40 px-3 py-3 focus-within:border-primary/30 transition-colors ${
                !job.editing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <div className="flex items-center gap-1">
                <Clock size={10} className="text-muted-foreground" />
                <Label>Stop</Label>
              </div>
              <input
                type="time"
                value={job.stopTime || ""}
                disabled={!job.editing}
                onChange={(e) => {
                  const sp = e.target.value;
                  onChange({ stopTime: sp, status: sp && job.startTime ? "completed" : job.startTime ? "in-progress" : "not-started" });
                }}
                className={`bg-transparent text-sm font-bold font-mono text-foreground focus:outline-none w-full [color-scheme:light] ${
                  !job.editing ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              />
            </div>

            <div className={`flex flex-col gap-1.5 rounded-2xl border px-3 py-3 ${
              !job.editing ? "opacity-60" : ""
            } ${total ? "bg-primary/8 border-primary/25" : "bg-muted/40 border-border"}`}>
              <div className="flex items-center gap-1">
                <Timer size={10} className={total ? "text-primary" : "text-muted-foreground"} />
                <Label>Total</Label>
              </div>
              <span className={`text-sm font-bold font-mono ${total ? "text-primary" : "text-muted-foreground"}`}>
                {total || "—"}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              if (!job.editing) return;
              onChange({ arrivalAck: !job.arrivalAck });
            }}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
              !job.editing ? "opacity-60 cursor-not-allowed" : ""
            } ${
              job.arrivalAck ? "bg-emerald-50 border-emerald-200" : "bg-muted/40 border-border hover:border-emerald-200"
            }`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${job.arrivalAck ? "bg-emerald-100" : "bg-muted"}`}>
              <Navigation size={14} className={job.arrivalAck ? "text-emerald-600" : "text-muted-foreground"} />
            </div>
            <div className="flex-1 text-left">
              <p className={`text-xs font-semibold ${job.arrivalAck ? "text-emerald-700" : "text-muted-foreground"}`}>
                Arrival Acknowledged
              </p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                {job.arrivalAck ? "Driver confirmed on-site" : "Tap to confirm arrival"}
              </p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              job.arrivalAck ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/40"
            }`}>
              {job.arrivalAck && <span className="text-white text-[9px] font-bold">✓</span>}
            </div>
          </button>
        </div>
      </div>

      <div className="flex border-t border-border bg-muted/20">
        <button
          onClick={() => onChange({ editing: !job.editing })}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
        >
          {job.editing ? <CheckSquare size={14} /> : <Pencil size={14} />}
          {job.editing ? "Lock Entry" : "Edit Details"}
        </button>
        <div className="w-px bg-border" />
        {confirmDelete ? (
          <>
            <button onClick={onDelete}
              className="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-semibold text-destructive hover:bg-destructive/5 transition-colors">
              <Trash2 size={14} /> Confirm
            </button>
            <div className="w-px bg-border" />
            <button onClick={() => setConfirmDelete(false)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">
              <X size={14} /> Cancel
            </button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

/* ── App ── */
export default function App() {
  const isAdminPath = typeof window !== "undefined" && window.location.pathname === "/admin";
  const today = (() => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const adjusted = new Date(local.getTime() - (offset * 60 * 1000));
    return adjusted.toISOString().split("T")[0];
  })();

  const [date, setDate] = useState(today);
  const [driver, setDriver] = useState("Dion Lewis");
  const [jobs, setJobs] = useState<Job[]>([
    makeJob(1, "104200"),
    makeJob(2, "104201"),
  ]);
  const [isSigned, setIsSigned] = useState(false);
  const [arrivalTimeBack, setArrivalTimeBack] = useState("");
  const [signatureResetKey, setSignatureResetKey] = useState(0);

  const isOnline = useOnlineStatus();
  const [queuedCount, setQueuedCount] = useState<number>(() => getQueue().length);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshQueueCount = useCallback(() => {
    setQueuedCount(getQueue().length);
  }, []);

  const [locationOptions, setLocationOptions] = useState<string[]>(() => getCachedLocations());

  // Fetch initial locations on mount & cache them
  useEffect(() => {
    fetch("http://localhost:5000/api/locations")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLocationOptions(data);
          cacheLocations(data);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch locations from server, using cached fallback:", err);
        setLocationOptions(getCachedLocations());
      });
  }, []);

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
      toast.success(`Auto-synced ${successCount} offline delivery log${successCount > 1 ? "s" : ""} to database!`);
    }
  }, [refreshQueueCount]);

  useEffect(() => {
    if (isOnline && getQueue().length > 0) {
      processQueue();
    }
  }, [isOnline, processQueue]);

  const updateJob = useCallback((id: number, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const deleteJob = useCallback((id: number) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const addJob = () => {
    const lastNum = jobs.length ? Number(jobs[jobs.length - 1].jobNumber) + 1 : 104202;
    setJobs((prev) => [...prev, makeJob(nextId++, String(lastNum))]);
  };

  const driveTotal = sumTimes(jobs);

  const executeFinishDay = async () => {
    if (!isSigned) {
      alert("Validation Error: Please provide a driver signature confirming deliveries before finishing the day.");
      return;
    }

    if (jobs.length === 0) {
      alert("Please add at least one delivery log entry before completing your day.");
      return;
    }

    const clientTxId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
      })),
      arrivalBackTime: arrivalTimeBack || "—",
    };

    const resetForm = () => {
      setJobs([makeJob(nextId++, "104202")]);
      setArrivalTimeBack("");
      setIsSigned(false);
      setSignatureResetKey((prev) => prev + 1);
    };

    if (!isOnline) {
      enqueueSubmission(payload);
      refreshQueueCount();
      toast.info("Offline: Daily log saved to local queue. Will sync automatically when connected.");
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
        alert(`Database Error: ${errorMsg.error}`);
      }
    } catch (error) {
      console.warn("Network transmission broken, falling back to offline queue:", error);
      enqueueSubmission(payload);
      refreshQueueCount();
      toast.info("Connection lost: Daily log saved to local queue. Will sync when server is reachable.");
      resetForm();
    }
  };

  if (isAdminPath) {
    return <BillingDashboard />;
  }

  return (
    <div
      className="size-full overflow-y-auto py-8 px-4"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "var(--background)" }}
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
          <h1 className="text-3xl font-extrabold text-foreground" style={{ letterSpacing: "-0.02em" }}>
            Driver Delivery Log
          </h1>
          <p className="text-muted-foreground text-xs font-mono mt-1 uppercase tracking-widest">
            Daily Route Record
          </p>
        </div>

        {/* Date + Driver */}
        <div className="flex gap-3">
          <CalendarPicker value={date} onChange={setDate} />
          <Dropdown label="Driver" icon={User} options={DRIVERS} value={driver} onChange={setDriver} />
        </div>

        {/* Job bubbles */}
        {jobs.map((job, i) => (
          <JobBubble
            key={job.id}
            job={job}
            index={i}
            locationOptions={locationOptions}
            onRefreshLocations={() => {
              fetch("http://localhost:5000/api/locations")
                .then((res) => res.json())
                .then((data) => setLocationOptions(data));
            }}
            onChange={(patch) => updateJob(job.id, patch)}
            onDelete={() => deleteJob(job.id)}
          />
        ))}

        {/* Add another job */}
        <button
          onClick={addJob}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl border-2 border-dashed border-primary/30 text-primary text-sm font-semibold hover:bg-primary/5 hover:border-primary/50 transition-all"
        >
          <Plus size={16} />
          Add Another Job
        </button>

        {/* New Field: Arrival Time Back at Building*/}
        <div 
          className="rounded-2xl border bg-card px-5 py-4 flex flex-col gap-3" 
          style={{ borderColor: "rgba(124,92,252,0.15)", boxShadow: "0 2px 12px rgba(124,92,252,0.07)" }}
        >
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Route End Tracker</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">Arrival Time Back at Building</p>
          </div>
          
          <div 
            onClick={(e) => {
              e.stopPropagation();
              const input = e.currentTarget.querySelector('input');
              if (input) {
                if (!arrivalTimeBack) {
                  const now = new Date();
                  const currentStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                  setArrivalTimeBack(currentStr); 
                }
                if (typeof input.showPicker === 'function') input.showPicker();
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
          style={{ borderColor: "rgba(124,92,252,0.15)", boxShadow: "0 2px 12px rgba(124,92,252,0.07)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Timer size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Drive Time Today</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">Total across all jobs</p>
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
          className="rounded-3xl border bg-card px-5 py-5 flex flex-col gap-4"
          style={{ borderColor: "rgba(124,92,252,0.15)", boxShadow: "0 2px 16px rgba(124,92,252,0.07)" }}
        >
          <SignatureCanvas key={signatureResetKey} onSignatureChange={setIsSigned} />
          <p className="text-[10px] font-mono text-muted-foreground text-center uppercase tracking-widest">
            By signing, I confirm all deliveries are accurate
          </p>
        </div>

        {/* Finish Day */}
        <button
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

      <style>{`
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