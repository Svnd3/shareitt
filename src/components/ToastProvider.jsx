import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

function Toast({ toast, onClose }) {
  const typeClasses = {
    success: "bg-emerald-600 text-white",
    error: "bg-rose-600 text-white",
    warning: "bg-amber-600 text-slate-950",
    info: "bg-slate-900 text-white",
  };

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-3xl px-4 py-3 shadow-2xl shadow-slate-900/10 ${
        typeClasses[toast.type] || typeClasses.info
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-6">{toast.message}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold opacity-80 transition hover:opacity-100"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "info") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => ({ showToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <Toast toast={toast} onClose={() => setToast(null)} /> : null}
    </ToastContext.Provider>
  );
}
