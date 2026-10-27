import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="bg-surface p-8 rounded-xl border-3 border-ink shadow-brutal text-center flex flex-col items-center justify-center max-w-md mx-auto my-8">
      <div className="w-14 h-14 rounded-full bg-surface-2 border-2 border-ink shadow-brutal-sm flex items-center justify-center mb-4 text-ink">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="font-display font-extrabold text-xl text-ink mb-1">{title}</h3>
      <p className="text-sm text-muted mb-6 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn-brutal px-4 py-2 bg-cobalt text-white rounded-lg font-bold border-2 border-ink shadow-brutal-sm text-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  requestId?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, requestId, onRetry }: ErrorStateProps) {
  return (
    <div className="bg-coral/10 border-3 border-coral p-6 rounded-xl shadow-brutal max-w-lg mx-auto my-8">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-md bg-coral text-white font-bold flex items-center justify-center text-xl shrink-0 border-2 border-ink">
          !
        </div>
        <div className="flex-1">
          <h3 className="font-display font-extrabold text-lg text-ink mb-1">{title}</h3>
          <p className="text-sm text-ink mb-3">{message}</p>
          {requestId && (
            <p className="font-mono text-xs text-muted mb-4 bg-surface p-1.5 rounded border border-ink/30">
              Request ID: {requestId}
            </p>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="btn-brutal px-4 py-1.5 bg-surface text-ink font-bold text-xs rounded border-2 border-ink shadow-brutal-sm"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className = 'h-6 w-full' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-muted/20 border border-ink/20 rounded ${className}`}
    />
  );
}

export function Banner({
  variant = 'info',
  message,
  actionLabel,
  onAction,
}: {
  variant?: 'info' | 'warning' | 'error' | 'success';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const bg = {
    info: 'bg-cobalt/10 border-cobalt text-cobalt',
    warning: 'bg-sun/20 border-sun text-ink',
    error: 'bg-coral/15 border-coral text-coral',
    success: 'bg-mint/20 border-mint text-ink',
  }[variant];

  return (
    <div className={`p-3 rounded-lg border-2 font-medium text-sm flex items-center justify-between gap-3 shadow-brutal-sm ${bg}`}>
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="text-xs font-bold underline hover:no-underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center p-4">
      <div className="bg-surface max-w-md w-full p-6 rounded-xl border-3 border-ink shadow-brutal-lg animate-in fade-in zoom-in-95">
        <h3 className="font-display font-extrabold text-xl text-ink mb-2">{title}</h3>
        <p className="text-sm text-muted mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="btn-brutal px-4 py-2 bg-surface text-ink border-2 border-ink rounded-lg font-bold text-sm shadow-brutal-sm"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`btn-brutal px-4 py-2 rounded-lg font-bold text-sm border-2 border-ink shadow-brutal-sm text-white ${
              isDestructive ? 'bg-coral' : 'bg-cobalt'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
