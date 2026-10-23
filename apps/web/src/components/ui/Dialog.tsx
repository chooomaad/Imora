"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

/**
 * Accessible modal built on the native <dialog> element (focus trap, Esc, inert background).
 * Renders as a bottom sheet on mobile and a centered card from `sm` up.
 */
export function Dialog({
  open, onClose, title, children, className, footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useTranslations("common");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[28px] bg-surface p-0 text-ink shadow-lift backdrop:bg-black/45 backdrop:backdrop-blur-[2px]",
        "sm:m-auto sm:max-w-lg sm:rounded-[28px]",
        "open:animate-sheet-up sm:open:animate-fade-up",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-surface-2 text-muted hover:text-ink" aria-label={t("close")}>
              <X className="size-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 pb-6">{children}</div>
          {footer && <div className="border-t border-line px-6 py-4 pb-safe">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, text, confirmLabel, loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  text: ReactNode;
  confirmLabel: ReactNode;
  loading?: boolean;
}) {
  const t = useTranslations("common");
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-[15px] leading-relaxed text-muted">{text}</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onClose}>{t("cancel")}</Button>
        <Button onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}
