import { useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import { 
  Search, 
  Plus, 
  Info,
  Download,
  Receipt,
  CheckCircle,
  Building,
  Loader2,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { PageSpinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { FilterBar, PageHeader, ResponsiveTable, StatGrid } from '../components/responsive/ResponsivePrimitives';
import { useAppSelector } from '../store/hooks';
import {
  useListInvoicesForHostelQuery,
  useMarkInvoicePaidMutation,
  useGenerateAllInvoicesMutation,
  useGenerateInvoiceForBookingMutation,
} from '../features/api/invoiceApi';
import { useListResidentsForHostelQuery } from '../features/api/bookingApi';
import type { Invoice, InvoiceStatus } from '../types/api';

export default function RentLedgerPage() {
  const user = useAppSelector((state) => state.auth.user);
  const hostelId = user?.hostelId ?? '';

  const [statusFilter, setStatusFilter] = useState<'ALL' | InvoiceStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: invoices = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useListInvoicesForHostelQuery(
    {
      hostelId,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    },
    { skip: !hostelId }
  );

  const { data: residents = [] } = useListResidentsForHostelQuery(hostelId, { skip: !hostelId });

  const [markPaidMutation, { isLoading: isMarkingPaid }] = useMarkInvoicePaidMutation();
  const [generateAllMutation, { isLoading: isGeneratingAll }] = useGenerateAllInvoicesMutation();
  const [generateBookingInvoiceMutation, { isLoading: isGeneratingSingle }] =
    useGenerateInvoiceForBookingMutation();

  // Modals & Menu states
  const [showGenerateAllModal, setShowGenerateAllModal] = useState(false);
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState<Invoice | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Form states
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [bulkBillingMonth, setBulkBillingMonth] = useState(currentMonthStr);
  const [selectedBookingId, setSelectedBookingId] = useState('');

  // Selected resident booking and snapshotted contractual rent
  const selectedBooking = useMemo(() => {
    return residents.find((r) => r._id === selectedBookingId);
  }, [residents, selectedBookingId]);

  const selectedRent = useMemo(() => {
    if (!selectedBooking) return null;
    const room = selectedBooking.roomId || (selectedBooking as any).room;
    return selectedBooking.monthlyRent ?? room?.monthlyRent ?? null;
  }, [selectedBooking]);

  const isAlreadyBilled = useMemo(() => {
    if (!selectedBookingId) return false;
    return invoices.some((inv) => {
      const invBookingId = typeof inv.bookingId === 'string' ? inv.bookingId : inv.bookingId?._id;
      return invBookingId === selectedBookingId && inv.billingMonth === currentMonthStr;
    });
  }, [invoices, selectedBookingId, currentMonthStr]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToasts((prev) => [...prev, { id: Date.now().toString(), type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Filtered ledger records
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const studentName = inv.booking?.student?.name || '';
      const roomNum = inv.booking?.roomNumber || '';
      const month = inv.billingMonth || '';
      const query = searchQuery.toLowerCase();

      return (
        studentName.toLowerCase().includes(query) ||
        roomNum.toLowerCase().includes(query) ||
        month.toLowerCase().includes(query)
      );
    });
  }, [invoices, searchQuery]);

  // Derived financial metrics
  const totalBilled = useMemo(
    () => invoices.reduce((sum, inv) => sum + (inv.totalDue || 0), 0),
    [invoices]
  );
  const totalCollected = useMemo(
    () =>
      invoices
        .filter((inv) => inv.status === 'Paid')
        .reduce((sum, inv) => sum + (inv.totalDue || 0), 0),
    [invoices]
  );
  const totalOutstanding = totalBilled - totalCollected;

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      await markPaidMutation(invoiceId).unwrap();
      addToast('success', 'Invoice status updated to Paid.');
    } catch (err: any) {
      addToast('error', err?.data?.message || err?.message || 'Failed to settle invoice.');
    }
  };

  const handleGenerateAll = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await generateAllMutation({ billingMonth: bulkBillingMonth }).unwrap();
      setShowGenerateAllModal(false);
      const count = Array.isArray(res) ? res.filter((r) => r.status === 'ok').length : 0;
      addToast(
        'success',
        `Generated ${count} invoice${count === 1 ? '' : 's'} for cycle ${bulkBillingMonth}.`
      );
    } catch (err: any) {
      addToast('error', err?.data?.message || err?.message || 'Failed to generate bulk invoices.');
    }
  };

  const handleGenerateSingle = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId) return;

    if (isAlreadyBilled) {
      addToast('error', `Invoice already exists for this resident and billing month (${currentMonthStr}).`);
      return;
    }

    try {
      await generateBookingInvoiceMutation(selectedBookingId).unwrap();
      setShowSingleModal(false);
      setSelectedBookingId('');
      addToast('success', `Invoice generated successfully for ${currentMonthStr}.`);
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Failed to generate invoice.';
      addToast('error', msg);
    }
  };

  const handleExportSheet = () => {
    if (invoices.length === 0) {
      addToast('info', 'No invoice records available to export.');
      return;
    }
    const headers = ['Invoice ID', 'Resident', 'Room', 'Month', 'Rent', 'Total Due', 'Status', 'Due Date'];
    const rows = invoices.map((inv) => [
      inv._id,
      inv.booking?.student?.name || 'Resident',
      inv.booking?.roomNumber || '—',
      inv.billingMonth,
      inv.rentAmount,
      inv.totalDue,
      inv.status,
      new Date(inv.dueDate).toLocaleDateString(),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hostel-rent-ledger-${currentMonthStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('success', 'Rent ledger exported successfully.');
  };

  if (!hostelId) {
    return (
      <EmptyState
        icon={Building}
        title="Hostel Not Registered"
        description="Please register your hostel property to manage rent ledger and billing invoices."
        actionText="Register Hostel Now"
        onAction={() => (window.location.href = '/hostel-reg')}
      />
    );
  }

  return (
    <div className="workspace-page space-y-6 max-w-[1240px] mx-auto pb-12">
      {/* Page Title & Top Header Buttons */}
      <PageHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1329] tracking-tight">Rent Ledger</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Accounts, recurring rent invoices, and payment collection tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleExportSheet}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white border border-slate-200/80 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setShowSingleModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 border border-slate-200 rounded-xl text-slate-800 hover:bg-slate-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Single Invoice</span>
          </button>
          <button
            type="button"
            onClick={() => setShowGenerateAllModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Generate Monthly Billing</span>
          </button>
        </div>
      </PageHeader>

      {/* Top Cards Row */}
      <StatGrid className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">TOTAL BILLED</p>
          <p className="text-2xl font-bold text-[#0b1329] mt-2 tracking-tight">
            Rs. {totalBilled.toLocaleString()}
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-4">
            <div className="bg-[#0b1329] h-full w-full" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">COLLECTED REVENUE</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2 tracking-tight">
            Rs. {totalCollected.toLocaleString()}
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-4">
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{ width: `${totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">OUTSTANDING DUE</p>
          <p className="text-2xl font-bold text-amber-600 mt-2 tracking-tight">
            Rs. {totalOutstanding.toLocaleString()}
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-4">
            <div
              className="bg-amber-500 h-full transition-all"
              style={{ width: `${totalBilled > 0 ? (totalOutstanding / totalBilled) * 100 : 0}%` }}
            />
          </div>
        </div>
      </StatGrid>

      {isError && (
        <ErrorBanner
          message={(error as any)?.message || 'Failed to load rent invoices.'}
          onRetry={refetch}
        />
      )}

      {/* Search & Status Filter Bar */}
      <FilterBar className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by resident name, room number, or month..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20 text-slate-800 placeholder:text-slate-400 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs font-semibold text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none shadow-2xs cursor-pointer"
          >
            <option value="ALL">All Invoices</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Overdue">Overdue</option>
            <option value="PartiallyPaid">Partially Paid</option>
          </select>
        </div>
      </FilterBar>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {isLoading ? (
          <PageSpinner message="Loading rent ledger invoices..." />
        ) : filteredInvoices.length === 0 ? (
          <EmptyState
            title="No Invoices Recorded"
            description={
              invoices.length === 0
                ? 'No billing invoices generated yet. Click "Generate Monthly Billing" to bill active residents.'
                : 'No invoices match your current search filters.'
            }
            actionText={invoices.length === 0 ? 'Generate Monthly Billing' : 'Reset Search'}
            onAction={() => {
              if (invoices.length === 0) {
                setShowGenerateAllModal(true);
              } else {
                setSearchQuery('');
                setStatusFilter('ALL');
              }
            }}
          />
        ) : (
          <ResponsiveTable className="overflow-x-auto scroll-thin">
            <table className="responsive-table w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-6">RESIDENT & ROOM</th>
                  <th className="py-4 px-6">BILLING MONTH</th>
                  <th className="py-4 px-6">BREAKDOWN</th>
                  <th className="py-4 px-6">TOTAL DUE</th>
                  <th className="py-4 px-6">STATUS</th>
                  <th className="py-4 px-6 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {filteredInvoices.map((inv) => {
                  const student = inv.booking?.student;
                  const roomNum = inv.booking?.roomNumber;

                  return (
                    <tr key={inv._id} className="hover:bg-slate-50/60 transition-colors">
                      <td data-label="Resident & room" data-card-primary="true" className="py-4 px-6">
                        <div className="font-bold text-[#0b1329]">{student?.name || 'Resident'}</div>
                        <div className="text-[11px] text-slate-400">
                          {roomNum ? `Room ${roomNum}` : 'Room unassigned'} • {student?.email}
                        </div>
                      </td>
                      <td data-label="Billing month" className="py-4 px-6 text-slate-700 font-semibold">{inv.billingMonth}</td>
                      <td data-label="Breakdown" className="py-4 px-6 text-slate-500">
                        <div>Rs. {inv.rentAmount.toLocaleString()}</div>
                      </td>
                      <td data-label="Total due" className="py-4 px-6 font-bold text-[#0b1329]">
                        Rs. {inv.totalDue.toLocaleString()}
                      </td>
                      <td data-label="Status" data-card-status="true" className="py-4 px-6">
                        {(inv.refundedAmount || inv.disputeStatus) ? (
                          <p className="mb-2 text-xs text-amber-700">
                            {inv.refundedAmount ? `Refunded: Rs. ${inv.refundedAmount.toLocaleString()}. ` : ''}
                            {inv.disputeStatus ? `Dispute: ${inv.disputeStatus}.` : ''}
                          </p>
                        ) : null}
                        {inv.status === 'Paid' && (
                          <span className="px-2.5 py-1 text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md tracking-wider">
                            PAID
                          </span>
                        )}
                        {inv.status === 'Unpaid' && (
                          <span className="px-2.5 py-1 text-[9px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 rounded-md tracking-wider">
                            UNPAID
                          </span>
                        )}
                        {inv.status === 'Overdue' && (
                          <span className="px-2.5 py-1 text-[9px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 rounded-md tracking-wider">
                            OVERDUE
                          </span>
                        )}
                        {inv.status === 'PartiallyPaid' && (
                          <span className="px-2.5 py-1 text-[9px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 rounded-md tracking-wider">
                            PARTIAL
                          </span>
                        )}
                      </td>
                      <td data-label="Actions" data-card-actions="true" className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowReceiptModal(inv)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Invoice Receipt"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>

                          {inv.status !== 'Paid' && (
                            <button
                              type="button"
                              disabled={isMarkingPaid}
                              onClick={() => handleMarkAsPaid(inv._id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Mark Paid</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTable>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 text-xs text-slate-400 font-medium">
          <span>Showing {filteredInvoices.length} of {invoices.length} invoices</span>
        </div>
      </div>

      {/* Generate All Monthly Billing Modal */}
      <Modal
        isOpen={showGenerateAllModal}
        onClose={() => setShowGenerateAllModal(false)}
        title="Generate Monthly Invoices"
        description="Creates rent invoices for all residents currently checked into rooms."
      >
        <form onSubmit={handleGenerateAll} className="space-y-4">
          <div>
            <label htmlFor="rentledgerpage-field-1" className="block text-xs font-bold text-slate-700 mb-1">
              Billing Month Cycle (YYYY-MM) <span className="text-rose-500">*</span>
            </label>
            <input id="rentledgerpage-field-1"
              type="month"
              required
              value={bulkBillingMonth}
              onChange={(e) => setBulkBillingMonth(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
            <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <p>
              Invoices will only be generated for active bookings that have not already been billed for cycle {bulkBillingMonth}.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowGenerateAllModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGeneratingAll}
              className="px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 disabled:opacity-75 flex items-center gap-1.5"
            >
              {isGeneratingAll && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Generate Invoices</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Generate Single Booking Invoice Modal */}
      <Modal
        isOpen={showSingleModal}
        onClose={() => setShowSingleModal(false)}
        title="Create Single Resident Invoice"
        description="Manually bill a specific resident."
      >
        <form onSubmit={handleGenerateSingle} className="space-y-4">
          <div>
            <label htmlFor="rentledgerpage-field-2" className="block text-xs font-bold text-slate-700 mb-1">
              Select Resident <span className="text-rose-500">*</span>
            </label>
            <select id="rentledgerpage-field-2"
              required
              value={selectedBookingId}
              onChange={(e) => setSelectedBookingId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
            >
              <option value="">Select a resident booking...</option>
              {residents.map((r) => {
                const student = r.studentId || (r as any).student;
                const room = r.roomId || (r as any).room;
                return (
                  <option key={r._id} value={r._id}>
                    {student?.name || 'Resident'} - Room {room?.roomNumber || '—'}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Billing Month</label>
            <div className="w-full px-3.5 py-2.5 text-xs bg-slate-100 border border-slate-200 rounded-xl font-semibold text-slate-700 flex items-center justify-between">
              <span>{currentMonthStr}</span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                Current Billing Cycle
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Monthly rent invoices are generated for the active billing cycle ({currentMonthStr}).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Contractual Monthly Rent</label>
            <div className="w-full px-3.5 py-2.5 text-xs bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-900 flex items-center justify-between">
              <span>
                {selectedRent != null
                  ? `PKR ${selectedRent.toLocaleString()}`
                  : selectedBooking
                  ? 'Derived from Booking Snapshot'
                  : 'Select a resident to view contract rent'}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-200/80 px-2 py-0.5 rounded">
                Fixed Snapshot Rate
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Snapshotted directly from the resident's booking agreement. Cannot be manually overridden.
            </p>
          </div>

          {isAlreadyBilled && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>An invoice for this resident has already been issued for {currentMonthStr}.</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowSingleModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGeneratingSingle || !selectedBookingId || isAlreadyBilled}
              className="px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isGeneratingSingle && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Issue Invoice</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Invoice Receipt Modal */}
      <Modal
        isOpen={Boolean(showReceiptModal)}
        onClose={() => setShowReceiptModal(null)}
        title="Official Rent Receipt"
        description="Formal invoice receipt voucher."
      >
        {showReceiptModal && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">INVOICE NO</span>
                <span className="font-mono font-bold text-slate-800">{showReceiptModal._id}</span>
              </div>
              <span
                className={`px-2.5 py-1 text-[9px] font-extrabold rounded-md uppercase tracking-wider ${
                  showReceiptModal.status === 'Paid'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {showReceiptModal.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Resident Name</span>
                <p className="font-bold text-slate-800 mt-0.5">
                  {showReceiptModal.booking?.student?.name || 'Resident'}
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Room Allocation</span>
                <p className="font-bold text-slate-800 mt-0.5">
                  Room {showReceiptModal.booking?.roomNumber || '—'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              {(showReceiptModal.refundedAmount || showReceiptModal.disputeStatus) ? (
                <p role="status" className="text-amber-700">
                  {showReceiptModal.refundedAmount ? `Refund recorded: Rs. ${showReceiptModal.refundedAmount.toLocaleString()}. ` : ''}
                  {showReceiptModal.disputeStatus ? `Dispute: ${showReceiptModal.disputeStatus}. ` : ''}
                  Amounts below show the original invoice, before payment adjustments.
                </p>
              ) : null}
              <div className="flex justify-between">
                <span className="text-slate-500">Rent Charges:</span>
                <span className="font-semibold text-slate-800">
                  Rs. {showReceiptModal.rentAmount.toLocaleString()}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-sm text-[#0b1329]">
                <span>Total Amount:</span>
                <span>Rs. {showReceiptModal.totalDue.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReceiptModal(null)}
                className="px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
