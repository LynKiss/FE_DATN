import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
};

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'lg',
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal backdrop"
        className="absolute inset-0 bg-[#0b1f17]/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`admin-modal relative z-[101] w-full ${sizeClasses[size]}`}>
        <div className="flex items-start justify-between gap-4 border-b border-on-surface/8 px-6 py-5">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-primary">{title}</h3>
            {description ? <p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-on-surface/10 p-2 text-on-surface-variant transition hover:border-primary/20 hover:text-primary"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-3 border-t border-on-surface/8 px-6 py-5">{footer}</div> : null}
      </div>
    </div>
  );
}
