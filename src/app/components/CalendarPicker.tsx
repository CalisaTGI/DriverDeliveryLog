import React, { useState, useRef, useEffect } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { formatDate } from "../utils/timeCalculations";

interface CalendarPickerProps {
  value: string;
  onChange: (v: string) => void;
}

export function CalendarPicker({ value, onChange }: CalendarPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = new Date(value + "T00:00:00");
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const select = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;
    onChange(iso);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border bg-card text-foreground transition-all hover:border-primary/40 focus:outline-none"
        style={{
          boxShadow: open
            ? "0 0 0 2px rgba(124,92,252,0.18)"
            : "0 1px 4px rgba(100,90,180,0.08)",
        }}
      >
        <CalendarDays size={15} className="text-primary flex-shrink-0" />
        <div className="flex-1 text-left">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest leading-none mb-0.5">
            Date
          </p>
          <p className="text-sm font-semibold text-foreground">
            {formatDate(value)}
          </p>
        </div>
        <ChevronDown
          size={13}
          className={`text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-card border border-border rounded-2xl shadow-xl z-50 p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown size={14} className="rotate-90" />
            </button>
            <span className="text-sm font-bold text-foreground">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown size={14} className="-rotate-90" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center mb-1">
            {DAYS.map((d) => (
              <span
                key={d}
                className="text-[10px] font-mono text-muted-foreground font-semibold py-1"
              >
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const iso = `${viewYear}-${String(viewMonth + 1).padStart(
                2,
                "0"
              )}-${String(day).padStart(2, "0")}`;
              const isSel = iso === value;
              const isTod = iso === today;
              return (
                <button
                  key={idx}
                  type="button"
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
