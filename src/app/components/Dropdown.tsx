import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface DropdownProps {
  label: string;
  icon: React.ElementType;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}

export function Dropdown({
  label,
  icon: Icon,
  options,
  value,
  onChange,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border bg-card shadow-sm text-foreground transition-all hover:border-primary/40 focus:outline-none"
        style={{
          boxShadow: open
            ? "0 0 0 2px rgba(124,92,252,0.18)"
            : "0 1px 4px rgba(100,90,180,0.08)",
        }}
      >
        <Icon size={15} className="text-primary flex-shrink-0" />
        <div className="flex-1 text-left min-w-0">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest leading-none mb-0.5">
            {label}
          </p>
          <p className="text-sm font-semibold text-foreground truncate">
            {value}
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
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                opt === value
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
