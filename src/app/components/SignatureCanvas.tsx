import React, { useState, useRef } from "react";
import { RotateCcw } from "lucide-react";

interface SignatureCanvasProps {
  onSignatureChange: (isSigned: boolean) => void;
  hasError?: boolean;
}

export function SignatureCanvas({
  onSignatureChange,
  hasError = false,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
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

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setSigned(false);
    onSignatureChange(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-mono uppercase tracking-widest ${
            hasError ? "text-destructive font-semibold" : "text-muted-foreground"
          }`}
        >
          Driver Signature
        </span>
        {signed && (
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors font-mono"
          >
            <RotateCcw size={11} /> Clear
          </button>
        )}
      </div>
      <div
        className={`relative rounded-2xl border bg-white overflow-hidden transition-all duration-300 ${
          hasError
            ? "border-destructive/70 ring-2 ring-destructive/20 bg-destructive/[0.02]"
            : "border-border"
        }`}
        style={{
          boxShadow: hasError
            ? "0 0 12px rgba(239, 68, 68, 0.15)"
            : "inset 0 1px 4px rgba(100,90,180,0.06)",
        }}
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
            <span
              className={`text-sm font-mono italic ${
                hasError
                  ? "text-destructive/70 font-medium"
                  : "text-muted-foreground/50"
              }`}
            >
              {hasError ? "⚠️ Please sign here before submitting…" : "Sign here…"}
            </span>
          </div>
        )}
        <div
          className={`absolute bottom-2 left-4 right-4 h-px border-b border-dashed ${
            hasError ? "border-destructive/30" : "border-muted-foreground/20"
          }`}
        />
      </div>
    </div>
  );
}
