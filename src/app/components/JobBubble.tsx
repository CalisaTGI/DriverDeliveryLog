import React, { useState } from "react";
import { Job } from "../types/deliveryLog";
import { calcTotal } from "../utils/timeCalculations";
import {
  MapPin,
  Clock,
  CheckSquare,
  Timer,
  Navigation,
  FileText,
  Hash,
  Pencil,
  Trash2,
  Plus,
  X,
} from "lucide-react";

interface JobBubbleProps {
  job: Job;
  index: number;
  locationOptions: string[];
  onRefreshLocations: () => void;
  onOpenAddLocation: () => void;
  onChange: (updated: Partial<Job>) => void;
  onDelete: () => void;
}

export function JobBubble({
  job,
  index,
  locationOptions,
  onOpenAddLocation,
  onChange,
  onDelete,
}: JobBubbleProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const total = calcTotal(job.startTime, job.stopTime);

  const displayTotal =
    job.totalTime !== undefined && job.totalTime !== "" ? job.totalTime : total;

  return (
    <div
      className="rounded-3xl border bg-card flex flex-col gap-5 overflow-hidden"
      style={{
        borderColor: job.editing
          ? "rgba(124,92,252,0.25)"
          : "rgba(124,92,252,0.1)",
        boxShadow: job.editing
          ? "0 6px 32px rgba(124,92,252,0.12), 0 1px 0 rgba(255,255,255,0.9) inset"
          : "0 2px 12px rgba(100,90,180,0.07), 0 1px 0 rgba(255,255,255,0.9) inset",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary font-mono">
              {index + 1}
            </span>
          </div>
          <span className="text-sm font-semibold text-foreground">
            Delivery Entry #{index + 1}
          </span>
        </div>
        <button
          type="button"
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
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Job #
            </span>
            <div
              className={`flex items-center gap-2 px-3.5 py-3 rounded-2xl border border-border bg-muted/40 focus-within:border-primary/40 transition-colors ${
                !job.editing ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
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
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Task Code
              </span>
              <span className="text-[9px] font-mono text-muted-foreground uppercase">
                (e.g. A, B, C)
              </span>
            </div>
            <div
              className={`flex items-center gap-2 px-3.5 py-3 rounded-2xl border border-border bg-muted/40 focus-within:border-primary/40 transition-colors ${
                !job.editing ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              <FileText
                size={14}
                className="text-muted-foreground flex-shrink-0"
              />
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
          type="button"
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
            <div
              className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors ${
                job.paperwork
                  ? "border-primary bg-primary text-white"
                  : "border-muted-foreground/40"
              }`}
            >
              {job.paperwork && <span className="text-xs font-bold">✓</span>}
            </div>
            <span className="text-xs font-semibold text-foreground">
              Paperwork Completed
            </span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {job.paperwork ? "Yes" : "No"}
          </span>
        </button>

        {/* Location Selector */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Delivery Location
          </span>
          <div className="relative">
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-muted/40 focus-within:border-primary/40 transition-colors ${
                !job.editing ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              <MapPin size={14} className="text-primary flex-shrink-0" />
              <input
                type="text"
                value={job.location}
                disabled={!job.editing}
                onFocus={() => {
                  if (job.editing) setShowLocationDropdown(true);
                }}
                onBlur={() =>
                  setTimeout(() => setShowLocationDropdown(false), 250)
                }
                onChange={(e) => onChange({ location: e.target.value })}
                placeholder="Enter address or location name…"
                className={`flex-1 bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/40 focus:outline-none ${
                  !job.editing ? "cursor-not-allowed" : ""
                }`}
              />
              {job.location && (
                <Navigation size={12} className="text-primary flex-shrink-0" />
              )}
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

        {/* Time Tracking */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Time Tracking
            </span>
            {job.editing && (job.startTime || job.stopTime || job.totalTime) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange({
                    startTime: "",
                    stopTime: "",
                    totalTime: "",
                    status: "not-started",
                  });
                }}
                className="text-[10px] font-mono font-semibold text-muted-foreground hover:text-destructive transition-colors cursor-pointer flex items-center gap-0.5"
                title="Clear all times for this entry"
              >
                <X size={10} /> Clear Times
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {/* Start Time */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (!job.editing) return;
                const input = e.currentTarget.querySelector("input");
                if (input) {
                  if (!job.startTime) {
                    const now = new Date();
                    const currentStr = `${String(now.getHours()).padStart(
                      2,
                      "0"
                    )}:${String(now.getMinutes()).padStart(2, "0")}`;
                    const autoTotal = calcTotal(currentStr, job.stopTime);
                    onChange({
                      startTime: currentStr,
                      totalTime: autoTotal || job.totalTime,
                      status: job.stopTime ? "completed" : "in-progress",
                    });
                  }
                  if (typeof input.showPicker === "function") input.showPicker();
                }
              }}
              className={`flex flex-col gap-1.5 rounded-2xl border border-border bg-muted/40 px-3 py-3 focus-within:border-primary/30 transition-colors ${
                !job.editing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Clock size={10} className="text-muted-foreground" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Start
                  </span>
                </div>
                {job.editing && job.startTime && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const autoTotal = calcTotal("", job.stopTime);
                      onChange({
                        startTime: "",
                        totalTime: autoTotal || "",
                        status: job.stopTime ? "in-progress" : "not-started",
                      });
                    }}
                    title="Clear start time"
                    className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-destructive rounded-full transition-all cursor-pointer bg-muted/80"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <input
                type="time"
                value={job.startTime || ""}
                disabled={!job.editing}
                onChange={(e) => {
                  const st = e.target.value;
                  const autoTotal = calcTotal(st, job.stopTime);
                  onChange({
                    startTime: st,
                    totalTime: autoTotal || job.totalTime,
                    status: st
                      ? job.stopTime
                        ? "completed"
                        : "in-progress"
                      : "not-started",
                  });
                }}
                className={`bg-transparent text-sm font-bold font-mono text-foreground focus:outline-none w-full [color-scheme:light] ${
                  !job.editing ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              />
            </div>

            {/* Stop Time */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (!job.editing) return;
                const input = e.currentTarget.querySelector("input");
                if (input) {
                  if (!job.stopTime) {
                    const now = new Date();
                    const currentStr = `${String(now.getHours()).padStart(
                      2,
                      "0"
                    )}:${String(now.getMinutes()).padStart(2, "0")}`;
                    const autoTotal = calcTotal(job.startTime, currentStr);
                    onChange({
                      stopTime: currentStr,
                      totalTime: autoTotal || job.totalTime,
                      status: job.startTime ? "completed" : "not-started",
                    });
                  }
                  if (typeof input.showPicker === "function") input.showPicker();
                }
              }}
              className={`flex flex-col gap-1.5 rounded-2xl border border-border bg-muted/40 px-3 py-3 focus-within:border-primary/30 transition-colors ${
                !job.editing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Clock size={10} className="text-muted-foreground" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Stop
                  </span>
                </div>
                {job.editing && job.stopTime && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const autoTotal = calcTotal(job.startTime, "");
                      onChange({
                        stopTime: "",
                        totalTime: autoTotal || "",
                        status: job.startTime ? "in-progress" : "not-started",
                      });
                    }}
                    title="Clear stop time"
                    className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-destructive rounded-full transition-all cursor-pointer bg-muted/80"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <input
                type="time"
                value={job.stopTime || ""}
                disabled={!job.editing}
                onChange={(e) => {
                  const sp = e.target.value;
                  const autoTotal = calcTotal(job.startTime, sp);
                  onChange({
                    stopTime: sp,
                    totalTime: autoTotal || job.totalTime,
                    status:
                      sp && job.startTime
                        ? "completed"
                        : job.startTime
                        ? "in-progress"
                        : "not-started",
                  });
                }}
                className={`bg-transparent text-sm font-bold font-mono text-foreground focus:outline-none w-full [color-scheme:light] ${
                  !job.editing ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              />
            </div>

            {/* Total Time (Auto-computed & Editable) */}
            <div
              className={`flex flex-col gap-1.5 rounded-2xl border px-3 py-3 transition-colors ${
                !job.editing ? "opacity-60 cursor-not-allowed" : ""
              } ${
                displayTotal
                  ? "bg-primary/8 border-primary/25 focus-within:border-primary/40"
                  : "bg-muted/40 border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Timer
                    size={10}
                    className={
                      displayTotal ? "text-primary" : "text-muted-foreground"
                    }
                  />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Total
                  </span>
                </div>
                {job.editing && displayTotal && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange({ totalTime: "" });
                    }}
                    title="Clear total time"
                    className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-destructive rounded-full transition-all cursor-pointer bg-muted/80"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <input
                type="text"
                value={displayTotal}
                disabled={!job.editing}
                onChange={(e) => onChange({ totalTime: e.target.value })}
                placeholder="Auto..."
                className={`bg-transparent text-sm font-bold font-mono focus:outline-none w-full ${
                  displayTotal ? "text-primary font-bold" : "text-muted-foreground"
                } ${!job.editing ? "cursor-not-allowed" : ""}`}
              />
            </div>
          </div>

          {/* Arrival Acknowledged Button */}
          <button
            type="button"
            onClick={() => {
              if (!job.editing) return;
              onChange({ arrivalAck: !job.arrivalAck });
            }}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
              !job.editing ? "opacity-60 cursor-not-allowed" : ""
            } ${
              job.arrivalAck
                ? "bg-emerald-50 border-emerald-200"
                : "bg-muted/40 border-border hover:border-emerald-200"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                job.arrivalAck ? "bg-emerald-100" : "bg-muted"
              }`}
            >
              <Navigation
                size={14}
                className={
                  job.arrivalAck ? "text-emerald-600" : "text-muted-foreground"
                }
              />
            </div>
            <div className="flex-1 text-left">
              <p
                className={`text-xs font-semibold ${
                  job.arrivalAck ? "text-emerald-700" : "text-muted-foreground"
                }`}
              >
                Arrival Acknowledged
              </p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                {job.arrivalAck
                  ? "Driver confirmed on-site"
                  : "Tap to confirm arrival"}
              </p>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                job.arrivalAck
                  ? "border-emerald-500 bg-emerald-500"
                  : "border-muted-foreground/40"
              }`}
            >
              {job.arrivalAck && (
                <span className="text-white text-[9px] font-bold">✓</span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Delete / Actions Footer */}
      <div className="flex border-t border-border bg-muted/20">
        {confirmDelete ? (
          <>
            <button
              type="button"
              onClick={onDelete}
              className="flex-1 py-3 text-xs font-bold text-white bg-destructive hover:bg-destructive/90 transition-colors"
            >
              Confirm Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-3 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1"
            >
              <X size={14} /> Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}
