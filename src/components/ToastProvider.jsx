import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const STYLES = {
  success: { icon: CheckCircle2, className: 'bg-green-50 border-green-200 text-green-800', iconClassName: 'text-green-500' },
  error: { icon: XCircle, className: 'bg-red-50 border-red-200 text-red-800', iconClassName: 'text-red-500' },
  info: { icon: Info, className: 'bg-blue-50 border-blue-200 text-blue-800', iconClassName: 'text-blue-500' }
};

let idCounter = 0;

// Replaces the browser's native alert() with a non-blocking, styled toast stack —
// alert() dialogs are ugly, block the whole page, and (worse) leak raw backend error
// text verbatim in a "localhost says" box with no visual distinction from a success
// message. showToast(message, type) renders a dismissible, auto-expiring card instead.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const showToast = useCallback(
    (message, type = 'info', duration = 6000) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      timers.current[id] = setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const style = STYLES[t.type] || STYLES.info;
          const Icon = style.icon;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2 border rounded-lg shadow-lg px-4 py-3 text-sm ${style.className}`}
            >
              <Icon size={18} className={`shrink-0 mt-0.5 ${style.iconClassName}`} />
              <div className="flex-1 whitespace-pre-line break-words">{t.message}</div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-current opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
