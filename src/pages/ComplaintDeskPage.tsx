import { getRequestError } from '../utils/requestError';
import { useState, useMemo, useRef } from 'react';
import type { FormEvent } from 'react';
import { 
  Search, 
  ChevronDown, 
  CheckCircle, 
  ClipboardList,
  AlertTriangle,
  Wrench,
  Clock,
  ShieldCheck,
  UserCheck,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { PageSpinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { FilterBar, PageHeader, ScrollableTabs, StatGrid } from '../components/responsive/ResponsivePrimitives';
import { useAppSelector } from '../store/hooks';
import {
  useListComplaintsQuery,
  useAssignComplaintMutation,
  useUpdateComplaintStatusMutation,
} from '../features/api/complaintApi';
import { useListStaffForHostelQuery } from '../features/api/userApi';
import { useLazyVerifyRecordQuery } from '../features/api/blockchainApi';
import type { Complaint, ComplaintStatus, SeverityTier, BlockchainVerifyResponse } from '../types/api';

const severityWeights: Record<SeverityTier, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

export default function ComplaintDeskPage() {
  const user = useAppSelector((state) => state.auth.user);
  const hostelId = user?.hostelId ?? '';

  const {
    data: complaints = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useListComplaintsQuery();

  const { data: staffMembers = [] } = useListStaffForHostelQuery(hostelId, { skip: !hostelId });
  const activeStaffMembers = staffMembers.filter(
    (staff) => staff.isActive !== false && staff.emailVerified !== false
  );

  const [resolutionTarget, setResolutionTarget] = useState<string | null>(null);
  const statusRef = useRef(new Set<string>());
  const [pendingStatuses, setPendingStatuses] = useState<string[]>([]);
  const [updateStatusMutation] = useUpdateComplaintStatusMutation();
  const [assignMutation, { isLoading: isAssigning }] = useAssignComplaintMutation();
  const [triggerVerify, { isFetching: isVerifying }] = useLazyVerifyRecordQuery();

  const [activeTab, setActiveTab] = useState<'all' | ComplaintStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'priority'>('newest');

  // Modals
  const [assignModalComplaint, setAssignModalComplaint] = useState<Complaint | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [blockchainModalData, setBlockchainModalData] = useState<BlockchainVerifyResponse | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToasts((prev) => [...prev, { id: Date.now().toString(), type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Filtered & Sorted complaints
  const filteredComplaints = useMemo(() => {
    return complaints
      .filter((item) => {
        if (activeTab !== 'all' && item.status !== activeTab) return false;

        const query = searchQuery.toLowerCase();
        const matchesQuery =
          item.description.toLowerCase().includes(query) ||
          Boolean(item.title && item.title.toLowerCase().includes(query)) ||
          Boolean(item.category && item.category.toLowerCase().includes(query)) ||
          Boolean(item.residentId?.name && item.residentId.name.toLowerCase().includes(query)) ||
          Boolean(item.roomNumberAtSubmission?.toLowerCase().includes(query)) ||
          item.severityTier.toLowerCase().includes(query);

        return matchesQuery;
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          return severityWeights[b.severityTier] - severityWeights[a.severityTier];
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [complaints, activeTab, searchQuery, sortBy]);

  // Derived counts
  const totalCount = complaints.length;
  const pendingCount = complaints.filter((c) => c.status === 'Submitted').length;
  const inProgressCount = complaints.filter((c) => c.status === 'InReview').length;
  const awaitingVerificationCount = complaints.filter((c) => c.status === 'AwaitingAdminVerification').length;
  const resolvedCount = complaints.filter((c) => c.status === 'Resolved').length;

  const handleStatusChange = async (id: string, newStatus: ComplaintStatus) => {
    if (statusRef.current.has(id)) return;
    if (newStatus === 'Resolved' && resolutionTarget !== id) { setResolutionTarget(id); return; }
    statusRef.current.add(id); setPendingStatuses([...statusRef.current]);
    try {
      await updateStatusMutation({ id, status: newStatus }).unwrap();
      const statusLabel = newStatus === 'InReview'
        ? 'In Review'
        : newStatus === 'AwaitingAdminVerification'
        ? 'Awaiting Admin Verification'
        : newStatus;
      addToast('success', `Complaint marked as "${statusLabel}".`);
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to update complaint status.');
    } finally { statusRef.current.delete(id); setPendingStatuses([...statusRef.current]); setResolutionTarget(null); }
  };

  const handleAssignSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!assignModalComplaint || !selectedStaffId) return;

    try {
      await assignMutation({
        id: assignModalComplaint._id,
        staffId: selectedStaffId,
      }).unwrap();
      setAssignModalComplaint(null);
      setSelectedStaffId('');
      addToast('success', 'Staff assigned to complaint.');
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to assign staff.');
    }
  };

  const handleVerifyBlockchain = async (complaintId: string) => {
    try {
      const res = await triggerVerify({
        sourceType: 'Complaint',
        sourceId: complaintId,
      }).unwrap();
      setBlockchainModalData(res);
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Blockchain record verification not yet anchored.');
    }
  };

  return (
    <div className="workspace-page space-y-6 max-w-[1240px] mx-auto pb-12">
      {/* Page Title & Controls */}
      <PageHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1329] tracking-tight">Complaint Desk</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Review completed repairs before resolving complaints and track resident requests.
          </p>
        </div>
      </PageHeader>

      {/* Metric Cards Header */}
      <StatGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">TOTAL COMPLAINTS</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-[#0b1329]">{totalCount}</span>
            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">All time</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-rose-200/80 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SUBMITTED (PENDING)</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-rose-600">{pendingCount}</span>
            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200/70 px-2 py-0.5 rounded">
              Needs Action
            </span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-amber-200/80 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">IN REVIEW / ASSIGNED</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-amber-600">{inProgressCount}</span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
              In Progress
            </span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-sky-200/80 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">AWAITING ADMIN VERIFICATION</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-sky-700">{awaitingVerificationCount}</span>
            <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded">
              Review repair
            </span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">RESOLVED</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-emerald-600">{resolvedCount}</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              Closed
            </span>
          </div>
        </div>
      </StatGrid>

      {isError && (
        <ErrorBanner
          message={getRequestError(error)?.message || 'Failed to load complaints.'}
          onRetry={refetch}
        />
      )}

      {/* Navigation Tabs, Search & Sort */}
      <FilterBar className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 pt-1">
        {/* Filter Tabs */}
        <ScrollableTabs className="flex items-center gap-1.5 bg-slate-100/70 p-1 rounded-xl border border-slate-200/60 overflow-x-auto scroll-thin">
          <button
            type="button"
            aria-pressed={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 ${
              activeTab === 'all' ? 'bg-[#0b1329] text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All Tickets ({totalCount})
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'Submitted'}
            onClick={() => setActiveTab('Submitted')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 ${
              activeTab === 'Submitted' ? 'bg-[#0b1329] text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Submitted ({pendingCount})
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'InReview'}
            onClick={() => setActiveTab('InReview')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 ${
              activeTab === 'InReview' ? 'bg-[#0b1329] text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            In Review ({inProgressCount})
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'AwaitingAdminVerification'}
            onClick={() => setActiveTab('AwaitingAdminVerification')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 ${
              activeTab === 'AwaitingAdminVerification' ? 'bg-[#0b1329] text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Verify Repairs ({awaitingVerificationCount})
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'Resolved'}
            onClick={() => setActiveTab('Resolved')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 ${
              activeTab === 'Resolved' ? 'bg-[#0b1329] text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Resolved ({resolvedCount})
          </button>
        </ScrollableTabs>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search complaints..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20 text-slate-800 placeholder:text-slate-400 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 shrink-0">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs cursor-pointer focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="priority">Priority First</option>
            </select>
          </div>
        </div>
      </FilterBar>

      {/* Complaint Tickets List */}
      {isLoading ? (
        <PageSpinner message="Loading complaint desk tickets..." />
      ) : filteredComplaints.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6">
          <EmptyState
            title="No Complaints Found"
            description="There are no complaint tickets matching your active filter or search criteria."
            actionText="Show All Tickets"
            onAction={() => {
              setActiveTab('all');
              setSearchQuery('');
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredComplaints.map((item) => {
            const resident = item.residentId;
            const staff = item.assignedStaffId;
            const room = typeof item.roomId === 'object' ? item.roomId : null;
            const roomNumber = item.roomNumberAtSubmission || room?.roomNumber;

            return (
              <div
                key={item._id}
                className={`mobile-complaint-card p-6 bg-white rounded-2xl border shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-stretch gap-6 transition-colors ${
                  item.status === 'Resolved' ? 'border-slate-200/60 bg-slate-50/40 opacity-85' : 'border-slate-200/80'
                }`}
              >
                {/* Left Content Area */}
                <div className="complaint-card-content min-w-0 flex-1 space-y-3">
                  {/* Category & Priority Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.severityTier === 'Critical' && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> CRITICAL SEVERITY
                      </span>
                    )}
                    {item.severityTier === 'High' && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> HIGH SEVERITY
                      </span>
                    )}
                    {item.severityTier === 'Medium' && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded">
                        MEDIUM SEVERITY
                      </span>
                    )}
                    {item.severityTier === 'Low' && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        LOW SEVERITY
                      </span>
                    )}

                    {item.category && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded">
                        {item.category}
                      </span>
                    )}

                    {item.blockchainRef && (
                      <button
                        type="button"
                        onClick={() => handleVerifyBlockchain(item._id)}
                        disabled={isVerifying}
                        className="text-[9px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                      >
                        <ShieldCheck className="w-2.5 h-2.5 text-indigo-600" /> Verified On-Chain
                      </button>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    {item.title && (
                      <h4 className="complaint-title text-sm font-semibold text-[#0b1329] mb-1">
                        {item.title}
                      </h4>
                    )}
                    <p
                      className={`complaint-description text-xs mt-0.5 leading-relaxed ${
                        item.status === 'Resolved' ? 'text-slate-500' : 'text-slate-700'
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>

                  {item.photoUrls?.length ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Resident photos</p>
                      <div className="flex flex-wrap gap-2">
                        {item.photoUrls.map((url, index) => (
                          <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" aria-label={`Open resident complaint photo ${index + 1}`}>
                            <img src={url} alt={`Complaint evidence ${index + 1}`} className="h-20 w-24 rounded-lg border border-slate-200 object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {item.repairNote || item.repairProofImageUrl ? (
                    <div className="space-y-2 rounded-xl border border-sky-100 bg-sky-50/70 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Staff repair evidence</p>
                      {item.repairNote ? <p className="text-xs leading-relaxed text-slate-700">{item.repairNote}</p> : null}
                      {item.repairProofImageUrl ? (
                        <a href={item.repairProofImageUrl} target="_blank" rel="noreferrer" aria-label="Open staff repair proof photo">
                          <img src={item.repairProofImageUrl} alt="Staff repair proof" className="h-28 max-w-full rounded-lg border border-sky-100 object-cover" />
                        </a>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Resident Profile Footer */}
                  <div className="complaint-reporter-row flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center border border-slate-200">
                        {resident?.name ? resident.name.slice(0, 2).toUpperCase() : 'ST'}
                      </div>
                      <div className="complaint-reporter-copy text-xs min-w-0">
                        <span className="font-bold text-[#0b1329]">{resident?.name || 'Resident'}</span>
                        <span className="text-slate-400 font-normal ml-2">{resident?.email}</span>
                        <span className="text-slate-500 font-medium ml-2 border-l border-slate-200 pl-2">
                          {roomNumber ? `Room ${roomNumber}` : 'Room not recorded'}
                        </span>
                      </div>
                    </div>

                    {staff && (
                      <div className="text-xs text-slate-500 border-l border-slate-200 pl-3 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>Assigned to: <strong className="text-slate-700">{staff.name}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Controls & Actions Column */}
                <div className="complaint-card-actions w-full md:w-56 md:pl-6 md:border-l border-slate-100 flex flex-col justify-between items-start md:items-end text-left md:text-right pt-4 md:pt-0 border-t md:border-t-0">
                  <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-300" />
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>

                  <div className="complaint-card-action-controls w-full space-y-3 mt-4 md:mt-0">
                    {/* Status Dropdown */}
                    <div>
                      <label htmlFor={`complaint-status-${item._id}`} className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Current status{pendingStatuses.includes(item._id) ? ' - Updating...' : ''}</label>
                      <div className="relative">
                        <select
                          id={`complaint-status-${item._id}`} aria-label={`Status of complaint ${item.title || item._id}`} disabled={pendingStatuses.includes(item._id)}
                          value={item.status}
                          onChange={(e) => handleStatusChange(item._id, e.target.value as ComplaintStatus)}
                          className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#0b1329] focus:outline-none cursor-pointer"
                        >
                          <option value="Submitted">Submitted</option>
                          <option value="InReview">In Review</option>
                          <option value="AwaitingAdminVerification" disabled>Awaiting Admin Verification</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      {item.status === 'AwaitingAdminVerification' ? (
                        <p className="mt-1.5 text-[10px] leading-relaxed text-sky-700">
                          Inspect the repair, then choose Resolved to approve it or In Review to request more work.
                        </p>
                      ) : null}
                    </div>

                    {/* Assign Staff Button */}
                    {item.status !== 'Resolved' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAssignModalComplaint(item);
                          setSelectedStaffId(item.assignedStaffId?._id || '');
                        }}
                        className="w-full py-2 px-3 text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 transition-colors shadow-2xs flex items-center justify-center gap-1.5"
                      >
                        <Wrench className="w-3.5 h-3.5 text-slate-500" />
                        <span>{staff ? 'Reassign Staff' : 'Assign Staff'}</span>
                      </button>
                    )}

                    {item.status === 'Resolved' && (
                      <div className="flex items-center justify-start md:justify-end gap-1.5 text-xs font-semibold text-emerald-600 py-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Resolved</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* End of List Indicator */}
      <div className="pt-8 flex flex-col items-center justify-center text-slate-400 gap-1.5">
        <ClipboardList className="w-6 h-6 stroke-[1.5]" />
        <span className="text-[11px] font-medium">End of active complaints list</span>
      </div>

      {/* Assign Staff Modal */}
      <Modal
        isOpen={Boolean(assignModalComplaint)}
        onClose={() => setAssignModalComplaint(null)}
        title="Assign Staff Member"
        description="Select a cleaning/maintenance staff member to handle this complaint."
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <div>
            <label htmlFor="complaintdeskpage-field-1" className="block text-xs font-bold text-slate-700 mb-1">
              Select Staff Member <span className="text-rose-500">*</span>
            </label>
            <select id="complaintdeskpage-field-1"
              required
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
            >
              <option value="">Choose a staff member...</option>
              {activeStaffMembers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.role}) - {s.email}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setAssignModalComplaint(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAssigning || !selectedStaffId}
              className="px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 disabled:opacity-75 flex items-center gap-1.5"
            >
              {isAssigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Assignment</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Blockchain Verification Modal */}
      <Modal
        isOpen={Boolean(blockchainModalData)}
        onClose={() => setBlockchainModalData(null)}
        title="Blockchain Immutability Verification"
        description="Source integrity and blockchain transaction verification."
      >
        {blockchainModalData && (
          <div className="space-y-3 text-xs">
            <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold">
                {blockchainModalData.sourceMatches === false || blockchainModalData.snapshotMatches === false
                  ? 'Integrity mismatch: the record needs investigation'
                  : blockchainModalData.onChainVerified === true && blockchainModalData.sourceMatches === true
                    ? 'Source and on-chain transaction verified'
                    : `Verification: ${blockchainModalData.verificationState || 'Not confirmed'}`}
              </p>
              <p className="mt-1 text-slate-600">A saved reference alone does not confirm that the current source matches a successful blockchain transaction.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 font-mono">
              <div>
                <span className="text-slate-400 block text-[10px] font-sans font-bold uppercase">Record Hash</span>
                <span className="text-slate-800 break-all text-[11px]">{blockchainModalData.hash}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-sans font-bold uppercase">Block Reference</span>
                <span className="text-slate-800 break-all text-[11px]">{blockchainModalData.blockRef}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-sans font-bold uppercase">Network</span>
                <span className="text-slate-800 text-[11px]">{blockchainModalData.network}</span>
              </div>
            </div>

            {blockchainModalData.explorerUrl && (
              <a
                href={blockchainModalData.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                <span>View on Explorer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setBlockchainModalData(null)}
                className="px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationDialog open={Boolean(resolutionTarget)} title="Confirm repair resolution" message="Have you inspected the repair and confirmed that the reported issue is resolved?" onClose={() => setResolutionTarget(null)} onConfirm={() => { if (resolutionTarget) void handleStatusChange(resolutionTarget, 'Resolved'); }} busy={Boolean(resolutionTarget && pendingStatuses.includes(resolutionTarget))} confirmLabel="Confirm resolved" />
      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
