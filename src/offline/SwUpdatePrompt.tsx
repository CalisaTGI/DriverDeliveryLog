import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Sparkles, RefreshCw, X } from 'lucide-react';

export function SwUpdatePrompt() {
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      console.log(`Service Worker registered from ${swUrl}`, r);
      if (r) {
        // Periodically check for SW updates every hour
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('Service Worker registration error:', error);
    },
  });

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      // updateServiceWorker(true) sends SKIP_WAITING to registration.waiting
      // and attaches a 'controllerchange' listener to reload the page once the new SW activates.
      await updateServiceWorker(true);

      // Fallback reload after 2 seconds if controllerchange listener didn't trigger reload
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Failed to trigger SW skipWaiting:', err);
      window.location.reload();
    }
  };

  const close = () => {
    setNeedRefresh(false);
  };

  if (!needRefresh) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 max-w-md w-[calc(100vw-2rem)] p-4 rounded-2xl bg-slate-900/95 border border-primary/40 shadow-2xl text-white backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0 text-primary">
          <Sparkles size={18} />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-sm text-white">App Update Available</h4>
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
            A new version of Driver Delivery Log is ready. Update now to load the latest features.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <RefreshCw size={13} className={isUpdating ? 'animate-spin' : ''} />
              {isUpdating ? 'Updating...' : 'Update & Refresh'}
            </button>
            <button
              onClick={close}
              disabled={isUpdating}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
        <button
          onClick={close}
          className="text-slate-400 hover:text-white p-1 transition-colors"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

