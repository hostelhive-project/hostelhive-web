import { useEffect } from 'react';
import { AlertTriangle, Clock3, ExternalLink, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useListPaymentsForInvoiceQuery } from '../features/api/paymentApi';
import { useVerifyRecordQuery } from '../features/api/blockchainApi';
import type { Payment } from '../types/api';

function publicExplorerUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

function PaymentAudit({ payment }: { payment: Payment }) {
  const { currentData: record, isFetching, error, isError, refetch } = useVerifyRecordQuery(
    { sourceType: 'Payment', sourceId: payment._id },
    { refetchOnMountOrArgChange: true }
  );
  const auditMissing = error && 'status' in error && error.status === 404;
  const isPending = (!record && auditMissing) || record?.status === 'Pending' || record?.verificationState === 'Pending';
  useEffect(() => {
    if (!isPending || isFetching) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refetch();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [isPending, isFetching, refetch]);

  const simulated = record?.status === 'Simulated' || record?.network === 'simulated' || record?.verificationState === 'Simulated';
  const mismatch = record?.sourceMatches === false || record?.snapshotMatches === false || record?.verificationState === 'Mismatch';
  const verified = !isError && !mismatch && record?.onChainVerified === true && record.sourceMatches === true;
  const explorerUrl = simulated ? null : publicExplorerUrl(record?.explorerUrl);
  const method = payment.paymentMethod === 'BankTransfer' ? 'Bank transfer' : payment.paymentMethod;

  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-800">{method} payment · PKR {payment.amount.toLocaleString()}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{new Date(payment.transactionDate || payment.createdAt).toLocaleString()}</p>
        </div>
        <button type="button" onClick={() => { void refetch(); }} disabled={isFetching}
          aria-label={`Refresh blockchain audit for payment ${payment._id.slice(-8)}`}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={12} className={isFetching ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
          {isFetching ? 'Checking' : 'Refresh'}
        </button>
      </div>

      {!record && isFetching ? (
        <p role="status" className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading blockchain audit…</p>
      ) : isPending && !record ? (
        <p role="status" className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-amber-700"><Clock3 size={14} className="mt-0.5 shrink-0" aria-hidden="true" />The payment is recorded. Its blockchain audit is being prepared; this view checks again automatically.</p>
      ) : !record ? (
        <p role="alert" className="mt-3 text-xs text-amber-700">Could not load the blockchain audit. Use Refresh to try again.</p>
      ) : (
        <div className="mt-3 space-y-3">
          <p role="status" className={`flex items-start gap-1.5 text-xs leading-relaxed ${mismatch ? 'text-rose-700' : verified ? 'text-emerald-700' : 'text-slate-600'}`}>
            {verified ? <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />}
            {mismatch ? 'Integrity mismatch. Investigate this audit record.'
              : isError ? 'Could not refresh verification. Showing the last available audit record.'
              : simulated ? 'Simulated audit record. A public explorer link is unavailable.'
              : verified ? 'Payment record and blockchain transaction verified.'
              : isPending ? 'Blockchain confirmation is pending.'
              : 'Audit record available; on-chain verification is not confirmed.'}
          </p>
          <dl className="min-w-0 space-y-2 rounded-lg bg-slate-50 p-3">
            <div><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Audit transaction reference</dt><dd className="mt-1 select-all break-all font-mono text-[11px] text-slate-800">{record.blockRef || 'Transaction not submitted yet'}</dd></div>
            <div><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Network</dt><dd className="mt-0.5 text-xs text-slate-700">{record.network}</dd></div>
          </dl>
          {explorerUrl ? (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
              aria-label={`View blockchain audit for payment ${payment._id.slice(-8)} on explorer (opens a new tab)`}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0b1329] px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
              View on Explorer <ExternalLink size={14} aria-hidden="true" />
            </a>
          ) : !simulated && <p className="text-xs text-slate-500">The explorer link will appear when the audit transaction is available.</p>}
        </div>
      )}
    </article>
  );
}

export default function InvoiceBlockchainAudit({ invoiceId }: { invoiceId: string }) {
  const { currentData: payments, isFetching, isError, refetch } = useListPaymentsForInvoiceQuery(invoiceId, {
    refetchOnMountOrArgChange: true,
  });
  const confirmedPayments = payments?.filter((payment) => payment.paymentStatus === 'Paid') || [];
  return (
    <section className="min-w-0 space-y-3 border-t border-slate-200 pt-4" aria-label="Payment blockchain audits">
      <div className="flex items-start gap-2">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-slate-600" aria-hidden="true" />
        <div><h3 className="text-sm font-semibold text-slate-900">Blockchain payment audit</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">Explore the audit record for each confirmed payment against this invoice.</p></div>
      </div>
      {isError && payments && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><p>Could not refresh payments. Showing the last available transactions.</p><button type="button" onClick={() => { void refetch(); }} disabled={isFetching} className="mt-2 min-h-8 font-semibold underline underline-offset-2">Retry</button></div>}
      {!payments && isFetching ? <p role="status" className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading payments…</p>
        : isError && !payments ? <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><p>Could not load payment transactions.</p><button type="button" onClick={() => { void refetch(); }} disabled={isFetching} className="mt-2 min-h-8 font-semibold underline underline-offset-2">Retry</button></div>
        : confirmedPayments.length ? <div className="space-y-3">{confirmedPayments.map((payment) => <PaymentAudit key={payment._id} payment={payment} />)}</div>
        : <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">No confirmed payment transaction is recorded for this invoice, so there is no payment audit to explore.</p>}
    </section>
  );
}
