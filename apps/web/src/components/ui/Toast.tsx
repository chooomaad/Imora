"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Toast = { id: number; message: ReactNode; tone: "success" | "error" };
type ToastFn = (message: ReactNode, tone?: Toast["tone"]) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback<ToastFn>((message, tone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, message, tone }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex max-w-md animate-fade-up items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-lift",
              t.tone === "success" ? "bg-ink text-on-ink" : "bg-danger text-white",
            )}
          >
            {t.tone === "success" ? <CheckCircle2 className="mt-px size-4 shrink-0 text-gold-bright" /> : <AlertCircle className="mt-px size-4 shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
