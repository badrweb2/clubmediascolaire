import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDeleteDropdownProps {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  renderTrigger: (props: {
    onClick: (e: React.MouseEvent<HTMLElement>) => void;
    isOpen: boolean;
  }) => React.ReactNode;
}

export function ConfirmDeleteDropdown({
  title = 'تأكيد المسح',
  message,
  confirmLabel = 'نعم، مسح',
  cancelLabel = 'إلغاء',
  busy = false,
  onConfirm,
  renderTrigger,
}: ConfirmDeleteDropdownProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) setOpen(false);
    };
    const onScrollOrResize = () => {
      if (!busy) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, busy]);

  const handleToggle = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const cardWidth = 264;
    const cardHeight = 154;
    const margin = 12;

    let left = rect.left;
    if (left + cardWidth > window.innerWidth - margin) {
      left = window.innerWidth - cardWidth - margin;
    }
    if (left < margin) {
      left = margin;
    }

    let top = rect.bottom + 8;
    if (top + cardHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - cardHeight - 8);
    }

    setCoords({ top, left });
    setOpen(true);
  };

  const handleConfirm = async () => {
    await onConfirm();
    setOpen(false);
  };

  const popover =
    open && typeof document !== 'undefined'
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-[90] bg-transparent"
              onClick={() => {
                if (!busy) setOpen(false);
              }}
            />
            <div
              role="dialog"
              aria-modal="true"
              style={{ top: coords.top, left: coords.left }}
              className="fixed z-[100] w-[264px] bg-white border border-rose-200 rounded-xl shadow-2xl p-3.5 text-right space-y-2.5 animate-fade-up"
            >
              <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{title}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{message}</p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleConfirm}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
                >
                  {busy ? 'جاري المسح...' : confirmLabel}
                </button>
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      {renderTrigger({ onClick: handleToggle, isOpen: open })}
      {popover}
    </>
  );
}
