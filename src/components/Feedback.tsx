import { Loader2, AlertCircle, SearchX } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export function PageSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="page-loading-state" role="status" aria-live="polite">
      <Loader2 className="page-loading-icon" aria-hidden="true" />
      <div className="page-loading-lines" aria-hidden="true"><span /><span /><span /></div>
      <p>{message}</p>
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start justify-between gap-3 my-4">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-bold">Failed to load data</p>
          <p className="text-xs text-rose-700 mt-0.5">{message || 'An unexpected error occurred while communicating with the server.'}</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-bold underline hover:text-rose-950 shrink-0"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon = SearchX,
  title,
  description,
  actionText,
  onAction,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state py-12 px-4 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <Icon className="w-6 h-6 stroke-[1.75]" />
      </div>
      <h4 className="text-sm font-bold text-[#0b1329]">{title}</h4>
      <p className="text-xs text-slate-400 font-medium max-w-sm mt-1">{description}</p>
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-4 py-2 bg-[#0b1329] text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-2xs"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
