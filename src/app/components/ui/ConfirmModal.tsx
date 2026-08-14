import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "./alert-dialog";
import { AlertTriangle, Trash2 } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "warning" | "default";
  icon?: React.ReactNode;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "destructive",
  icon,
}: ConfirmModalProps) {
  const handleConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    onConfirm();
    onClose();
  };

  const getIconBg = () => {
    if (variant === "destructive")
      return "bg-destructive/10 text-destructive border-destructive/20";
    if (variant === "warning")
      return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    return "bg-primary/10 text-primary border-primary/20";
  };

  const getConfirmBtnStyle = () => {
    if (variant === "destructive")
      return "bg-destructive text-white hover:bg-destructive/90 shadow-destructive/20 shadow-md";
    if (variant === "warning")
      return "bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20 shadow-md";
    return "bg-primary text-white hover:brightness-110 shadow-primary/20 shadow-md";
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-md rounded-3xl border border-border/80 bg-card p-6 shadow-2xl backdrop-blur-xl">
        <AlertDialogHeader className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${getIconBg()}`}
            >
              {icon || <AlertTriangle size={20} />}
            </div>
            <div>
              <AlertDialogTitle className="text-lg font-extrabold text-foreground tracking-tight">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex items-center justify-end gap-2 pt-4 border-t border-border/40 mt-2">
          <AlertDialogCancel
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 border-0 transition-colors"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${getConfirmBtnStyle()}`}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
