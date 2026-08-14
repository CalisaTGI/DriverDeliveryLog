"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog";
import { Loader2 } from "lucide-react";

export interface InputDialogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => Promise<boolean | void> | boolean | void;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: React.ReactNode;
}

export function InputDialogModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  description,
  label,
  placeholder = "Type here...",
  initialValue = "",
  confirmText = "Save",
  cancelText = "Cancel",
  icon,
}: InputDialogModalProps) {
  const [value, setValue] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setError(null);
      setIsLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialValue]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Please enter a value.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const result = await onSubmit(trimmed);
      if (result !== false) {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl border border-primary/20 bg-card p-6 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                {icon}
              </div>
            )}
            <div>
              <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 my-2">
          <div className="flex flex-col gap-1.5">
            {label && (
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground font-medium">
                {label}
              </label>
            )}
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder={placeholder}
              disabled={isLoading}
              className={`w-full px-4 py-3 rounded-2xl border text-sm font-medium transition-all focus:outline-none ${
                error
                  ? "border-destructive focus:ring-2 focus:ring-destructive/30"
                  : "border-border focus:border-primary focus:ring-2 focus:ring-primary/20 bg-muted/30"
              }`}
            />
            {error && (
              <p className="text-xs text-destructive font-medium pl-1 animate-pulse">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {cancelText}
            </button>
            <button
              type="submit"
              disabled={isLoading || !value.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs text-white transition-all bg-primary hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/25"
            >
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              {confirmText}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
