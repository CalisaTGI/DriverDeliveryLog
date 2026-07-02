import { useState, useRef, useEffect, useCallback } from "react";
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
  "Dion Lewis",
  "Carlos Nunez",
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

/* ── helpers ─────────────────────────────────────────────────────────── */
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

/* ── tiny shared components ──────────────────────────────────────────── */
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
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown size={14} className="rotate-90" />
            </button>
            <span className="text-sm font-bold text-foreground">{MONTHS[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown size={14} className="-rotate-90" />
            </button>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-mono text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          {/* Date grid */}
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

function StatusPills({ value, onChange }: { value: Status; onChange: (v: Status) => void }) {
  const opts: { id: Status; label: string; icon: React.ElementType; active: string; inactive: string }[] = [
    { id: "not-started", label: "Not Started", icon: Circle, active: "bg-red-50 border-red-300 text-red-600", inactive: "bg-muted border-border text-muted-foreground" },
    { id: "in-progress", label: "In Progress", icon: Loader, active: "bg-amber-50 border-amber-300 text-amber-600", inactive: "bg-muted border-border text-muted-foreground" },
    { id: "completed", label: "Completed", icon: CheckCircle2, active: "bg-emerald-50 border-emerald-300 text-emerald-600", inactive: "bg-muted border-border text-muted-foreground" },
  ];
  return (
    <div className="flex gap-2">
      {opts.map(({ id, label, icon: Icon, active, inactive }) => (
        <button key={id} onClick={() => onChange(id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-150 ${value === id ? active : inactive}`}>
          <Icon size={12} />
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── Signature canvas ────────────────────────────────────────────────── */
function SignatureCanvas() {
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
    setSigned(true);
  };

  const end = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setSigned(false);
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

/* ── Job bubble ──────────────────────────────────────────────────────── */
function JobBubble({
  job,
  index,
  onChange,
  onDelete,
}: {
  job: Job;
  index: number;
  onChange: (updated: Partial<Job>) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      {/* Header stripe */}
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
        {/* Job # + Task + Paperwork */}
        <div className="flex items-stretch gap-0 rounded-2xl overflow-hidden border border-border bg-muted/30">
          {/* Big job number — wider left column */}
          <div className="flex flex-col gap-1.5 px-4 py-3.5 flex-[3] min-w-0 focus-within:bg-primary/4 transition-colors">
            <Label>Job #</Label>
            <input
              type="text"
              value={job.jobNumber}
              onChange={(e) => onChange({ jobNumber: e.target.value.replace(/\D/g, "").slice(0, 7) })}
              placeholder="100000"
              inputMode="numeric"
              className="bg-transparent w-full text-5xl font-extrabold text-primary leading-none focus:outline-none placeholder:text-primary/20"
              style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}
            />
          </div>

          <div className="w-px bg-border flex-shrink-0" />

          {/* Task + paperwork — narrower right column */}
          <div className="flex flex-col gap-3 px-4 py-3.5 flex-[2] min-w-0">
            <div>
              <Label>Task Code</Label>
              <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card focus-within:border-primary/40 transition-colors">
                <FileText size={12} className="text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={job.task}
                  onChange={(e) => onChange({ task: e.target.value.toUpperCase().slice(0, 6) })}
                  placeholder="A, BC…"
                  className="flex-1 bg-transparent text-sm font-bold font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none tracking-widest min-w-0"
                />
              </div>
            </div>
            <button
              onClick={() => onChange({ paperwork: !job.paperwork })}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                job.paperwork ? "bg-primary/8 border-primary/25" : "bg-card border-border hover:border-primary/20"
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

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Location */}
        <div className="flex flex-col gap-1.5">
          <Label>Delivery Location</Label>
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-muted/40 focus-within:border-primary/40 transition-colors">
            <MapPin size={14} className="text-primary flex-shrink-0" />
            <input
              type="text"
              value={job.location}
              onChange={(e) => onChange({ location: e.target.value })}
              placeholder="Enter address or location name…"
              className="flex-1 bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />
            {job.location && <Navigation size={12} className="text-primary flex-shrink-0" />}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Time tracking */}
        <div className="flex flex-col gap-2">
          <Label>Time Tracking</Label>
          <div className="grid grid-cols-3 gap-2">
            {/* Start */}
            <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-muted/40 px-3 py-3 focus-within:border-primary/30 transition-colors">
              <div className="flex items-center gap-1">
                <Clock size={10} className="text-muted-foreground" />
                <Label>Start</Label>
              </div>
              <input
                type="time"
                value={job.startTime}
                onChange={(e) => {
                  const st = e.target.value;
                  onChange({ startTime: st, status: st ? (job.stopTime ? "completed" : "in-progress") : "not-started" });
                }}
                className="bg-transparent text-sm font-bold font-mono text-foreground focus:outline-none w-full"
              />
            </div>
            {/* Stop */}
            <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-muted/40 px-3 py-3 focus-within:border-primary/30 transition-colors">
              <div className="flex items-center gap-1">
                <Clock size={10} className="text-muted-foreground" />
                <Label>Stop</Label>
              </div>
              <input
                type="time"
                value={job.stopTime}
                onChange={(e) => {
                  const sp = e.target.value;
                  onChange({ stopTime: sp, status: sp && job.startTime ? "completed" : job.startTime ? "in-progress" : "not-started" });
                }}
                className="bg-transparent text-sm font-bold font-mono text-foreground focus:outline-none w-full"
              />
            </div>
            {/* Total */}
            <div className={`flex flex-col gap-1.5 rounded-2xl border px-3 py-3 ${total ? "bg-primary/8 border-primary/25" : "bg-muted/40 border-border"}`}>
              <div className="flex items-center gap-1">
                <Timer size={10} className={total ? "text-primary" : "text-muted-foreground"} />
                <Label>Total</Label>
              </div>
              <span className={`text-sm font-bold font-mono ${total ? "text-primary" : "text-muted-foreground"}`}>
                {total || "—"}
              </span>
            </div>
          </div>

          {/* Arrival ACK */}
          <button
            onClick={() => onChange({ arrivalAck: !job.arrivalAck })}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
              job.arrivalAck
                ? "bg-emerald-50 border-emerald-200"
                : "bg-muted/40 border-border hover:border-emerald-200"
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

      {/* Edit / Delete footer */}
      <div className="flex border-t border-border">
        <button
          onClick={() => onChange({ editing: !job.editing })}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
        >
          <Pencil size={14} />
          {job.editing ? "Lock" : "Edit"}
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

/* ── App ─────────────────────────────────────────────────────────────── */
export default function App() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [driver, setDriver] = useState("Dion Lewis");
  const [jobs, setJobs] = useState<Job[]>([
    makeJob(1, "104200"),
    makeJob(2, "104201"),
  ]);

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

  return (
    <div
      className="size-full overflow-y-auto py-8 px-4"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "var(--background)" }}
    >
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-5">

        {/* Title */}
        <div className="text-center pt-1">
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
          <SignatureCanvas />
          <p className="text-[10px] font-mono text-muted-foreground text-center uppercase tracking-widest">
            By signing, I confirm all deliveries are accurate
          </p>
        </div>

        {/* Finish Day */}
        <button
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
        input[type="time"]::-webkit-calendar-picker-indicator { display: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(124,92,252,0.2); border-radius: 99px; }
      `}</style>
    </div>
  );
}
