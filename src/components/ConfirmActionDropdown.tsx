import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ConfirmActionDropdownProps {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  variant?: 'primary' | 'danger' | 'warning';
  onConfirm: () => void | Promise<void>;
  renderTrigger: (props: {
    onClick: (e: React.MouseEvent<HTMLElement>) => void;
    isOpen: boolean;
  }) => React.ReactNode;
}

export function ConfirmActionDropdown({
  title,
  message,
  confirmLabel,
  cancelLabel = 'إلغاء',
  busy = false,
  busyLabel,
  variant = 'primary',
  onConfirm,
  renderTrigger,
}: ConfirmActionDropdownProps) {
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
    const cardWidth = 280;
    const cardHeight = 160;
    const margin = 10;

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

  const resolvedTitle =
    title ||
    (variant === 'danger'
      ? 'تأكيد المسح'
      : variant === 'warning'
        ? 'تأكيد الإجراء'
        : 'تأكيد التعديل والحفظ');

  const resolvedConfirm =
    confirmLabel ||
    (variant === 'danger' ? 'نعم، مسح' : variant === 'warning' ? 'نعم، متابعة' : 'تأكيد الحفظ');

  const resolvedBusy =
    busyLabel || (variant === 'danger' ? 'جاري المسح...' : 'جاري التنفيذ...');

  const borderTone =
    variant === 'danger'
      ? 'border-rose-200'
      : variant === 'warning'
        ? 'border-amber-200'
        : 'border-blue-200';

  const headerTone =
    variant === 'danger'
      ? 'text-rose-700'
      : variant === 'warning'
        ? 'text-amber-700'
        : 'text-[#1E40AF]';

  const btnTone =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700'
      : variant === 'warning'
        ? 'bg-amber-600 hover:bg-amber-700'
        : 'bg-[#1E40AF] hover:bg-[#1E3A8A]';

  return (
    <>
      {renderTrigger({ onClick: handleToggle, isOpen: open })}

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => {
              if (!busy) setOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{ top: coords.top, left: coords.left }}
            className={`fixed z-50 w-[280px] bg-white border ${borderTone} rounded-xl shadow-xl p-4 text-right space-y-3 animate-fade-up`}
          >
            <div className={`flex items-center gap-1.5 font-bold text-xs ${headerTone}`}>
              {variant === 'primary' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{resolvedTitle}</span>
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
                className={`px-3 py-1.5 rounded-lg text-white text-xs font-medium disabled:opacity-60 cursor-pointer ${btnTone}`}
              >
                {busy ? resolvedBusy : resolvedConfirm}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
