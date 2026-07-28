import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Toaster } from "../components/ui/sonner";
import { InputDialogModal } from "../components/ui/InputDialogModal";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { SyncStatusBadge } from "../components/SyncStatusBadge";
import {
  enqueueSubmission,
  getQueue,
  dequeueSubmission,
  cacheLocations,
  getCachedLocations,
} from "../lib/offlineQueue";
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
  AlertCircle,
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
  totalTime: string;
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
  totalTime: "",
  arrivalAck: false,
  editing: true,
});

/* ── helpers ── */
function calcTotal(start: string, stop: string) {
  if (!start || !stop) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = stop.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // Overnight shift compensation
  if (mins === 0) return "0m";
  const hours = Math.floor(mins / 60);
  const remainderMins = mins % 60;
  if (hours === 0) return `${remainderMins}m`;
  if (remainderMins === 0) return `${hours}h`;
  return `${hours}h ${remainderMins}m`;
}

function parseTotalMinutes(totalStr: string): number {
  if (!totalStr) return 0;
  const hMatch = totalStr.match(/(\d+)\s*h/i);
  const mMatch = totalStr.match(/(\d+)\s*m/i);
  if (hMatch || mMatch) {
    const hours = hMatch ? Number(hMatch[1]) : 0;
    const mins = mMatch ? Number(mMatch[1]) : 0;
    return hours * 60 + mins;
  }
  const num = parseFloat(totalStr);
  if (!isNaN(num) && num > 0) {
    if (num > 15) return Math.round(num);
    return Math.round(num * 60);
  }
  return 0;
}

function sumTimes(jobs: Job[]) {
  let totalMins = 0;
  jobs.forEach((j) => {
    const displayTotal = j.totalTime !== undefined && j.totalTime !== "" ? j.totalTime : calcTotal(j.startTime, j.stopTime);
    if (displayTotal) {
      totalMins += parseTotalMinutes(displayTotal);
    }
  });
  if (totalMins <= 0) return "—";
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/* ── tiny shared components ── */
function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] font-mono uppercase tracking-widest text-muted-foreground ${className}`}>
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
          <div className="grid grid-cols-7 text-center mb-1">
            {DAYS.map((d) => (
              <span key={d} className="text-[10px] font-mono text-muted-foreground font-semibold py-1">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isSel = iso === value;
              const isTod = iso === today;
              return (
                <button
                  key={idx}
                  onClick={() => select(day)}
                  className={`h-8 w-8 mx-auto rounded-xl text-xs font-semibold transition-all flex items-center justify-center ${
                    isSel
                      ? "bg-primary text-white shadow-md shadow-primary/30"
                      : isTod
                      ? "border border-primary text-primary font-bold"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
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
function SignatureCanvas({
  onSignatureChange,
  hasError = false,
}: {
  onSignatureChange: (isSigned: boolean) => void;
  hasError?: boolean;
}) {
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
        <Label className={hasError ? "text-destructive font-semibold" : ""}>Driver Signature</Label>
        {signed && (
          <button onClick={clear} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors font-mono">
            <RotateCcw size={11} /> Clear
          </button>
        )}
      </div>
      <div
        className={`relative rounded-2xl border bg-white overflow-hidden transition-all duration-300 ${
          hasError ? "border-destructive/70 ring-2 ring-destructive/20 bg-destructive/[0.02]" : "border-border"
        }`}
        style={{ boxShadow: hasError ? "0 0 12px rgba(239, 68, 68, 0.15)" : "inset 0 1px 4px rgba(100,90,180,0.06)" }}
      >
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
            <span className={`text-sm font-mono italic ${hasError ? "text-destructive/70 font-medium" : "text-muted-foreground/50"}`}>
              {hasError ? "⚠️ Please sign here before submitting…" : "Sign here…"}
            </span>
          </div>
        )}
        <div className={`absolute bottom-2 left-4 right-4 h-px border-b border-dashed ${hasError ? "border-destructive/30" : "border-muted-foreground/20"}`} />
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
  onOpenAddLocation,
  onChange,
  onDelete,
}: {
  job: Job;
  index: number;
  locationOptions: string[];
  onRefreshLocations: () => void;
  onOpenAddLocation: () => void;
  onChange: (updated: Partial<Job>) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const total = calcTotal(job.startTime, job.stopTime);

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
            <span className="text-xs font-bold text-primary font-mono">{index + 1}</span>
          </div>
          <span className="text-sm font-semibold text-foreground">Delivery Entry #{index + 1}</span>
        </div>
        <button
          onClick={() => onChange({ editing: !job.editing })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            job.editing
              ? "bg-primary text-white shadow-sm shadow-primary/30"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {job.editing ? <CheckSquare size={13} /> : <Pencil size={13} />}
          {job.editing ? "Done Editing" : "Edit Details"}
        </button>
      </div>

      <div className="px-5 flex flex-col gap-4">
        {/* Job # + Task Letter */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Job #</Label>
            <div className={`flex items-center gap-2 px-3.5 py-3 rounded-2xl border border-border bg-muted/40 focus-within:border-primary/40 transition-colors ${
              !job.editing ? "opacity-60 cursor-not-allowed" : ""
            }`}>
              <Hash size={14} className="text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={job.jobNumber}
                disabled={!job.editing}
                onChange={(e) => onChange({ jobNumber: e.target.value })}
                placeholder="104200"
                className={`w-full bg-transparent text-sm font-bold font-mono text-foreground focus:outline-none ${
                  !job.editing ? "cursor-not-allowed" : ""
                }`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Task Code</Label>
              <span className="text-[9px] font-mono text-muted-foreground uppercase">(e.g. A, B, C)</span>
            </div>
            <div className={`flex items-center gap-2 px-3.5 py-3 rounded-2xl border border-border bg-muted/40 focus-within:border-primary/40 transition-colors ${
              !job.editing ? "opacity-60 cursor-not-allowed" : ""
            }`}>
              <FileText size={14} className="text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={job.task}
                disabled={!job.editing}
                onChange={(e) => onChange({ task: e.target.value.toUpperCase() })}
                placeholder="A"
                maxLength={4}
                className={`w-full bg-transparent text-sm font-bold font-mono text-foreground focus:outline-none uppercase ${
                  !job.editing ? "cursor-not-allowed" : ""
                }`}
              />
            </div>
          </div>
        </div>

        {/* Paperwork Checkbox */}
        <button
          onClick={() => {
            if (!job.editing) return;
            onChange({ paperwork: !job.paperwork });
          }}
          className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
            !job.editing ? "opacity-60 cursor-not-allowed" : ""
          } ${
            job.paperwork
              ? "bg-primary/8 border-primary/30 text-primary font-semibold"
              : "bg-muted/40 border-border text-muted-foreground hover:border-border/80"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors ${
              job.paperwork ? "border-primary bg-primary text-white" : "border-muted-foreground/40"
            }`}>
              {job.paperwork && <span className="text-xs font-bold">✓</span>}
            </div>
            <span className="text-xs font-semibold text-foreground">Paperwork Completed</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {job.paperwork ? "Yes" : "No"}
          </span>
        </button>

        {/* Location Selector */}
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
                    setShowLocationDropdown(false);
                    onOpenAddLocation();
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
                    const autoTotal = calcTotal(currentStr, job.stopTime);
                    onChange({ startTime: currentStr, totalTime: autoTotal || job.totalTime, status: job.stopTime ? "completed" : "in-progress" });
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
                  const autoTotal = calcTotal(st, job.stopTime);
                  onChange({ startTime: st, totalTime: autoTotal || job.totalTime, status: st ? (job.stopTime ? "completed" : "in-progress") : "not-started" });
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
                    const autoTotal = calcTotal(job.startTime, currentStr);
                    onChange({ stopTime: currentStr, totalTime: autoTotal || job.totalTime, status: job.startTime ? "completed" : "not-started" });
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
                  const autoTotal = calcTotal(job.startTime, sp);
                  onChange({ stopTime: sp, totalTime: autoTotal || job.totalTime, status: sp && job.startTime ? "completed" : job.startTime ? "in-progress" : "not-started" });
                }}
                className={`bg-transparent text-sm font-bold font-mono text-foreground focus:outline-none w-full [color-scheme:light] ${
                  !job.editing ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              />
            </div>

            <div className={`flex flex-col gap-1.5 rounded-2xl border px-3 py-3 transition-colors ${
              !job.editing ? "opacity-60 cursor-not-allowed" : ""
            } ${job.totalTime || total ? "bg-primary/8 border-primary/25 focus-within:border-primary/40" : "bg-muted/40 border-border"}`}>
              <div className="flex items-center gap-1">
                <Timer size={10} className={job.totalTime || total ? "text-primary" : "text-muted-foreground"} />
                <Label>Total</Label>
              </div>
              <input
                type="text"
                value={job.totalTime !== undefined && job.totalTime !== "" ? job.totalTime : total}
                disabled={!job.editing}
                onChange={(e) => onChange({ totalTime: e.target.value })}
                placeholder="Auto..."
                className={`bg-transparent text-sm font-bold font-mono focus:outline-none w-full ${
                  job.totalTime || total ? "text-primary font-bold" : "text-muted-foreground"
                } ${!job.editing ? "cursor-not-allowed" : ""}`}
              />
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
        {confirmDelete ? (
          <>
            <button onClick={onDelete} className="flex-1 py-3 text-xs font-bold text-white bg-destructive hover:bg-destructive/90 transition-colors">
              Confirm Delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="flex-1 py-3 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1">
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

/* ── Driver Delivery Log Page Component ── */
export default function DriverDeliveryLogPage() {
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

  const [locationOptions, setLocationOptions] = useState<string[]>(() => getCachedLocations());
  const [isAddLocationModalOpen, setIsAddLocationModalOpen] = useState(false);
  const [targetJobIdForNewLocation, setTargetJobIdForNewLocation] = useState<number | null>(null);

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
          description: errorData?.error || "This location name already exists or failed to save.",
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
      setSignatureError(true);
      if (signatureCardRef.current) {
        signatureCardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      toast.error("Signature Required", {
        description: "Please provide a driver signature confirming deliveries before finishing the day.",
        duration: 4000,
      });
      return;
    }

    if (jobs.length === 0) {
      toast.error("No Delivery Log Entries", {
        description: "Please add at least one delivery log entry before completing your day.",
        duration: 4000,
      });
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
        totalTime: job.totalTime || calcTotal(job.startTime, job.stopTime),
      })),
      arrivalBackTime: arrivalTimeBack || "—",
    };

    const resetForm = () => {
      setJobs([makeJob(nextId++, "104202")]);
      setArrivalTimeBack("");
      setIsSigned(false);
      setSignatureError(false);
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
        toast.error("Database Error", {
          description: errorMsg.error || "An error occurred while saving delivery logs.",
          duration: 5000,
        });
      }
    } catch (error) {
      console.warn("Network transmission broken, falling back to offline queue:", error);
      enqueueSubmission(payload);
      refreshQueueCount();
      toast.info("Connection lost: Daily log saved to local queue. Will sync when server is reachable.");
      resetForm();
    }
  };

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
          ref={signatureCardRef}
          className={`rounded-3xl border bg-card px-5 py-5 flex flex-col gap-4 transition-all duration-300 ${
            signatureError ? "animate-shake ring-2 ring-destructive/60" : ""
          }`}
          style={{
            borderColor: signatureError ? "rgba(239, 68, 68, 0.6)" : "rgba(124,92,252,0.15)",
            boxShadow: signatureError ? "0 4px 20px rgba(239, 68, 68, 0.18)" : "0 2px 16px rgba(124,92,252,0.07)",
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
