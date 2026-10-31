"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Check, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  push: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => undefined });

export function useToast() {
  return useContext(ToastContext);
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = Date.now() + Math.random();
      setItems((current) => [...current.slice(-2), { id, message, kind }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className="pointer-events-auto flex animate-fade-up items-start gap-2.5 rounded-2xl border border-line bg-paper px-4 py-3 text-[13px] text-ink shadow-[0_18px_40px_-24px_rgba(3,4,7,0.4)]"
          >
            <span className="mt-0.5 shrink-0">
              {item.kind === "success" ? (
                <Check size={14} className="text-success" />
              ) : item.kind === "error" ? (
                <X size={14} className="text-danger" />
              ) : (
                <Info size={14} className="text-secondary" />
              )}
            </span>
            <span className="flex-1 leading-snug">{item.message}</span>
            <button
              onClick={() => dismiss(item.id)}
              className="shrink-0 text-faint transition-colors hover:text-ink"
              aria-label="Dismiss notification"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
