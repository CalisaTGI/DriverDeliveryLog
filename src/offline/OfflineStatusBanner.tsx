import { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi, RefreshCw, X } from 'lucide-react';

interface OfflineStatusBannerProps {
  onSyncAll?: () => void;
  isSyncing?: boolean;
}

export function OfflineStatusBanner({ onSyncAll, isSyncing }: OfflineStatusBannerProps) {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true
  );
  const [showReconnected, setShowReconnected] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Swipe / Drag states
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const isDragging = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setIsDismissed(false);
      const timer = setTimeout(() => setShowReconnected(false), 2000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
      setIsDismissed(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isDismissed || (isOnline && !showReconnected)) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || touchStartX === null || touchStartY === null) return;
    const deltaX = e.touches[0].clientX - touchStartX;
    const deltaY = e.touches[0].clientY - touchStartY;
    setTranslateX(deltaX);
    if (deltaY > 0) setTranslateY(deltaY);
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (Math.abs(translateX) > 70 || translateY > 50) {
      setIsDismissed(true);
    } else {
      setTranslateX(0);
      setTranslateY(0);
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  return (
    <div
      onClick={() => setIsDismissed(true)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translate(calc(-50% + ${translateX}px), ${translateY}px)`,
        opacity: Math.max(0.2, 1 - (Math.abs(translateX) + translateY) / 150),
      }}
      className={`fixed bottom-4 left-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 border text-xs font-semibold backdrop-blur-md transition-all duration-150 cursor-pointer select-none ${
        !isOnline
          ? 'bg-amber-950/90 text-amber-200 border-amber-500/40 shadow-amber-950/40'
          : 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-emerald-950/40'
      }`}
      role="status"
      aria-live="polite"
      title="Tap or swipe to dismiss"
    >
      {!isOnline ? (
        <>
          <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 animate-pulse">
            <WifiOff size={14} className="text-amber-400" />
          </div>
          <div>
            <p className="font-bold text-amber-100">You're currently offline</p>
            <p className="text-[11px] text-amber-300/80 font-normal">
              Changes will sync automatically when connection returns.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            {isSyncing ? (
              <RefreshCw size={14} className="text-emerald-400 animate-spin" />
            ) : (
              <Wifi size={14} className="text-emerald-400" />
            )}
          </div>
          <div>
            <p className="font-bold text-emerald-100">Back online</p>
            <p className="text-[11px] text-emerald-300/80 font-normal">
              {isSyncing ? 'Syncing queued offline logs...' : 'Network connection restored.'}
            </p>
          </div>
          {onSyncAll && isSyncing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSyncAll();
              }}
              className="ml-2 px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 transition-colors text-[10px] font-bold"
            >
              Sync Now
            </button>
          )}
        </>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsDismissed(true);
        }}
        className="ml-1 p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-white/10 transition-all"
        title="Dismiss alert"
      >
        <X size={14} />
      </button>
    </div>
  );
}

