import { getRequestError } from '../utils/requestError';
import { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  MoreVertical,
  Eye,
  LogOut,
  Building,
  UserCheck,
  Phone,
  Calendar,
  AlertTriangle,
  Loader2,
  ZoomIn,
  X,
  CreditCard,
  Image as ImageIcon
} from 'lucide-react';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { PageSpinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { FilterBar, PageHeader, ResponsiveTable, ScrollableTabs } from '../components/responsive/ResponsivePrimitives';
import { useAppSelector } from '../store/hooks';
import { formatPhoneDisplay } from '../utils/phoneFormatter';
import {
  useListResidentsForHostelQuery,
  useListApprovedBookingsQuery,
  useCheckInBookingMutation,
  useCheckOutBookingMutation,
} from '../features/api/bookingApi';
import type { Booking } from '../types/api';

export default function ResidentsPage() {
  const user = useAppSelector((state) => state.auth.user);
  const hostelId = user?.hostelId ?? '';

  const {
    data: bookings = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useListResidentsForHostelQuery(hostelId, { skip: !hostelId });

  const {
    data: approvedBookings = [],
    isLoading: isApprovedLoading,
    isError: isApprovedError,
    error: approvedError,
    refetch: refetchApproved,
  } = useListApprovedBookingsQuery(hostelId, { skip: !hostelId });

  const [checkInBookingMutation, { isLoading: isCheckingIn }] = useCheckInBookingMutation();
  const [checkOutBookingMutation, { isLoading: isCheckingOut }] = useCheckOutBookingMutation();

  const [activeTab, setActiveTab] = useState<'checkedIn' | 'approved'>('checkedIn');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals & Menu states
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<Booking | null>(null);
  const [checkInTarget, setCheckInTarget] = useState<Booking | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Close image preview on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewImage) {
        setPreviewImage(null);
      }
    };
    if (previewImage) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToasts((prev) => [...prev, { id: Date.now().toString(), type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Filtered bookings list (all are active CheckedIn residents)
  const filteredResidents = useMemo(() => {
    return bookings.filter((b) => {
      const student = b.studentId || b.student;
      const room = b.roomId || b.room;
      const studentName = student?.name || '';
      const residentId = student?.residentCode || b.residentCode || '';
      const roomNum = room?.roomNumber || '';
      const phone = student?.phone || '';
      const query = searchQuery.toLowerCase();

      return (
        studentName.toLowerCase().includes(query) ||
        residentId.toLowerCase().includes(query) ||
        roomNum.toLowerCase().includes(query) ||
        phone.toLowerCase().includes(query)
      );
    });
  }, [bookings, searchQuery]);

  const occupiedRoomsCount = useMemo(() => {
    const set = new Set();
    bookings.forEach((b) => {
      const room = b.roomId || b.room;
      if (room?._id) set.add(room._id);
    });
    return set.size;
  }, [bookings]);

  const filteredApproved = useMemo(() => {
    return approvedBookings.filter((b) => {
      const studentName = b.studentId?.name || '';
      const residentId = b.studentId?.residentCode || b.residentCode || '';
      const roomNum = b.roomId?.roomNumber || '';
      const phone = b.studentId?.phone || '';
      const query = searchQuery.toLowerCase();

      return (
        studentName.toLowerCase().includes(query) ||
        residentId.toLowerCase().includes(query) ||
        roomNum.toLowerCase().includes(query) ||
        phone.toLowerCase().includes(query)
      );
    });
  }, [approvedBookings, searchQuery]);

  const handleConfirmCheckIn = async () => {
    if (!checkInTarget) return;
    try {
      const updatedBooking = await checkInBookingMutation(checkInTarget._id).unwrap();
      const name = checkInTarget.studentId?.name || 'Student';
      const assignedId = updatedBooking?.studentId?.residentCode || updatedBooking?.residentCode;
      setCheckInTarget(null);
      const idMsg = assignedId ? ` Resident ID: ${assignedId}.` : '';
      addToast('success', `${name} has been checked in successfully.${idMsg}`);
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to check in resident.');
    }
  };

  const handleConfirmCheckOut = async () => {
    if (!checkoutTarget) return;
    try {
      await checkOutBookingMutation(checkoutTarget._id).unwrap();
      const student = checkoutTarget.studentId || checkoutTarget.student;
      const name = student?.name || 'Resident';
      setCheckoutTarget(null);
      addToast('success', `${name} has been checked out successfully. Allocated bed released.`);
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to check out resident.');
    }
  };

  if (!hostelId) {
    return (
      <EmptyState
        icon={Building}
        title="Hostel Not Registered"
        description="Please register your hostel property to manage resident directories."
        actionText="Register Hostel Now"
        onAction={() => (window.location.href = '/hostel-reg')}
      />
    );
  }

  return (
    <div className="workspace-page space-y-6 max-w-[1240px] mx-auto min-h-[calc(100vh-80px)] flex flex-col justify-between pb-8">
      <div className="space-y-6">
        {/* Page heading and directory search */}
        <PageHeader className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0b1329] tracking-tight">Residents</h1>
            <p className="mt-1 text-sm text-slate-500">Review active stays and complete approved check-ins.</p>
          </div>
          <FilterBar className="relative w-full sm:max-w-[360px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'checkedIn'
                  ? 'Search active residents by name, Resident ID, phone, or room...'
                  : 'Search awaiting check-in by name, Resident ID, phone, or room...'
              }
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20 text-slate-800 placeholder:text-slate-400 shadow-2xs"
            />
          </FilterBar>
        </PageHeader>

        {isError && (
          <ErrorBanner
            message={getRequestError(error)?.message || 'Failed to load residents.'}
            onRetry={refetch}
          />
        )}
        {isApprovedError && (
          <ErrorBanner
            message={getRequestError(approvedError)?.message || 'Failed to load approved bookings.'}
            onRetry={refetchApproved}
          />
        )}

        {/* Resident Directory Section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {/* Header Metrics */}
          <div className="p-5 pb-4 flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
            <div className="flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-100 divide-x divide-slate-200 text-center text-xs self-stretch sm:self-auto justify-around">
              <div className="px-4 py-1">
                <span className="font-bold text-emerald-600">{bookings.length}</span>
                <span className="block text-[10px] font-medium text-slate-400">Checked In</span>
              </div>
              <div className="px-4 py-1">
                <span className="font-bold text-amber-600">{approvedBookings.length}</span>
                <span className="block text-[10px] font-medium text-slate-400">Awaiting Check-In</span>
              </div>
              <div className="px-4 py-1">
                <span className="font-bold text-[#0b1329]">{occupiedRoomsCount}</span>
                <span className="block text-[10px] font-medium text-slate-400">Rooms Occupied</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <ScrollableTabs className="flex border-b border-slate-100 px-6 gap-6">
            <button
              type="button"
              aria-pressed={activeTab === 'checkedIn'}
              onClick={() => setActiveTab('checkedIn')}
              className={`pb-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'checkedIn'
                  ? 'border-[#0b1329] text-[#0b1329]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <span>Active Residents</span>
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-600">
                {bookings.length}
              </span>
            </button>
            <button
              type="button"
              aria-pressed={activeTab === 'approved'}
              onClick={() => setActiveTab('approved')}
              className={`pb-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'approved'
                  ? 'border-[#0b1329] text-[#0b1329]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <span>Awaiting Check-In</span>
              {approvedBookings.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-700 font-bold">
                  {approvedBookings.length}
                </span>
              )}
            </button>
          </ScrollableTabs>

          {/* Directory Table */}
          {activeTab === 'checkedIn' ? (
            isLoading ? (
              <PageSpinner message="Loading resident directory..." />
            ) : filteredResidents.length === 0 ? (
              <EmptyState
                icon={UserCheck}
                title="No Residents Found"
                description="No active residents matched your current search filters."
                actionText={searchQuery ? "Reset Search" : undefined}
                onAction={searchQuery ? () => setSearchQuery('') : undefined}
              />
            ) : (
              <ResponsiveTable className="overflow-x-auto scroll-thin min-h-[220px]">
                <table className="responsive-table w-full text-left border-collapse min-w-[750px]">
                  <thead>
                    <tr className="border-y border-slate-200/80 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-6">Full Name</th>
                      <th className="py-3.5 px-6">Resident ID</th>
                      <th className="py-3.5 px-6">Mobile Number</th>
                      <th className="py-3.5 px-6">Room / Layout</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium">
                    {filteredResidents.map((b, idx) => {
                      const student = b.studentId || b.student;
                      const room = b.roomId || b.room;
                      const initials = student?.name
                        ? student.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                        : 'ST';

                      return (
                        <tr key={b._id} className="hover:bg-slate-50/50 transition-colors">
                          {/* Name with Avatar */}
                          <td data-label="Resident" data-card-primary="true" className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center border border-blue-100 shrink-0">
                                {student?.profileImageUrl ? (
                                  <img
                                    src={student.profileImageUrl}
                                    alt={student.name}
                                    className="w-full h-full object-cover rounded-xl"
                                  />
                                ) : (
                                  initials
                                )}
                              </div>
                              <div>
                                <span className="font-bold text-[#0b1329] block">
                                  {student?.name || 'Resident'}
                                </span>
                                <span className="text-[10px] text-slate-400">{student?.email}</span>
                              </div>
                            </div>
                          </td>

                          {/* Resident ID */}
                          <td data-label="Resident ID" className="py-4 px-6 font-mono text-[11px] font-semibold text-slate-700">
                            {student?.residentCode || b.residentCode || '—'}
                          </td>

                          {/* Mobile Number */}
                          <td data-label="Phone" className="py-4 px-6 text-slate-600">
                            {formatPhoneDisplay(student?.phone || b.emergencyContact)}
                          </td>

                          {/* Room Badge */}
                          <td data-label="Room / layout" className="py-4 px-6">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200/60 px-2.5 py-0.5 rounded-md">
                                Room {room?.roomNumber || '—'}
                              </span>
                              <span className="text-[10px] text-slate-400">({room?.layoutType})</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td data-label="Status" data-card-status="true" className="py-4 px-6">
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded uppercase">
                              CHECKED IN
                            </span>
                          </td>

                          {/* Action buttons */}
                          <td data-label="Actions" data-card-actions="true" className="py-4 px-6 text-right relative">
                            <div className="inline-block relative">
                              <button
                                type="button"
                                onClick={() => setActiveMenuId(activeMenuId === b._id ? null : b._id)}
                                aria-label="Resident options"
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {activeMenuId === b._id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setActiveMenuId(null)}
                                  />
                                  <div
                                    className={`responsive-action-menu absolute right-0 ${
                                      idx > 0 && idx >= filteredResidents.length - 2
                                        ? 'bottom-full mb-1'
                                        : 'top-full mt-1'
                                    } w-44 bg-white rounded-xl shadow-xl border border-slate-200/80 py-1.5 z-20 text-left text-xs font-semibold`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedBooking(b);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-slate-500" /> View Profile
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCheckoutTarget(b);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                                    >
                                      <LogOut className="w-3.5 h-3.5 text-rose-500" /> Check Out
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ResponsiveTable>
            )
          ) : (
            isApprovedLoading ? (
              <PageSpinner message="Loading approved bookings..." />
            ) : filteredApproved.length === 0 ? (
              <EmptyState
                icon={UserCheck}
                title="No Bookings Awaiting Check-In"
                description={
                  searchQuery
                    ? "No approved bookings match your current search query."
                    : "There are currently no approved student bookings awaiting physical check-in."
                }
                actionText={searchQuery ? "Reset Search" : undefined}
                onAction={searchQuery ? () => setSearchQuery('') : undefined}
              />
            ) : (
              <ResponsiveTable className="overflow-x-auto scroll-thin min-h-[220px]">
                <table className="responsive-table w-full text-left border-collapse min-w-[750px]">
                  <thead>
                    <tr className="border-y border-slate-200/80 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-6">Full Name</th>
                      <th className="py-3.5 px-6">Resident ID</th>
                      <th className="py-3.5 px-6">Mobile Number</th>
                      <th className="py-3.5 px-6">Room / Layout</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium">
                    {filteredApproved.map((b) => {
                      const student = b.studentId;
                      const room = b.roomId;
                      const initials = student?.name
                        ? student.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                        : 'ST';

                      return (
                        <tr key={b._id} className="hover:bg-slate-50/50 transition-colors">
                          {/* Name with Avatar */}
                          <td data-label="Student" data-card-primary="true" className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold flex items-center justify-center border border-amber-100 shrink-0">
                                {student?.profileImageUrl ? (
                                  <img
                                    src={student.profileImageUrl}
                                    alt={student.name}
                                    className="w-full h-full object-cover rounded-xl"
                                  />
                                ) : (
                                  initials
                                )}
                              </div>
                              <div>
                                <span className="font-bold text-[#0b1329] block">
                                  {student?.name || 'Student'}
                                </span>
                                <span className="text-[10px] text-slate-400">{student?.email}</span>
                              </div>
                            </div>
                          </td>

                          {/* Resident ID */}
                          <td data-label="Resident ID" className="py-4 px-6 font-mono text-[11px] text-slate-500">
                            {student?.residentCode || b.residentCode || 'Pending Check-In'}
                          </td>

                          {/* Mobile Number */}
                          <td data-label="Phone" className="py-4 px-6 text-slate-600">
                            {formatPhoneDisplay(student?.phone || b.emergencyContact)}
                          </td>

                          {/* Room Badge */}
                          <td data-label="Room / layout" className="py-4 px-6">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200/60 px-2.5 py-0.5 rounded-md">
                                Room {room?.roomNumber || '—'}
                              </span>
                              <span className="text-[10px] text-slate-400">({room?.layoutType})</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td data-label="Status" data-card-status="true" className="py-4 px-6">
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded uppercase">
                              APPROVED
                            </span>
                          </td>

                          {/* Action buttons */}
                          <td data-label="Actions" data-card-actions="true" className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedBooking(b)}
                                aria-label="View Profile"
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCheckInTarget(b)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Check In</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ResponsiveTable>
            )
          )}

          {/* Table Pagination Footer */}
          <div className="py-3.5 px-6 bg-slate-50/40 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>
              {activeTab === 'checkedIn'
                ? `Showing ${filteredResidents.length} of ${bookings.length} active residents`
                : `Showing ${filteredApproved.length} of ${approvedBookings.length} approved bookings awaiting check-in`}
            </span>
          </div>
        </div>
      </div>

      {/* Resident Profile Details Modal */}
      <Modal
        isOpen={Boolean(selectedBooking)}
        onClose={() => setSelectedBooking(null)}
        title="Resident Profile Details"
        description="Comprehensive profile details and institutional verification info."
        maxWidth="lg"
        variant="fullScreenMobile"
      >
        {selectedBooking && (() => {
          const student = selectedBooking.studentId || selectedBooking.student;
          const room = selectedBooking.roomId || selectedBooking.room;
          const studentName = student?.name || 'Resident';
          return (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#0b1329] text-white flex items-center justify-center font-bold text-base">
                  {student?.name
                    ? student.name.slice(0, 2).toUpperCase()
                    : 'ST'}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#0b1329]">
                    {student?.name || 'Resident'}
                  </h4>
                  <p className="text-slate-400">{student?.email}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    {selectedBooking.status || 'CheckedIn'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Resident ID</span>
                  <p className="font-mono font-bold text-[#0b1329] mt-0.5 text-xs">
                    {student?.residentCode || selectedBooking.residentCode || 'Not Assigned'}
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Phone</span>
                  <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {student?.phone ? formatPhoneDisplay(student.phone) : 'Not provided'}
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Room Allocation</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    Room {room?.roomNumber || '—'} {room?.layoutType ? `(${room.layoutType})` : ''}
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Emergency Contact</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {selectedBooking.emergencyContact || 'None recorded'}
                  </p>
                </div>
              </div>

              {/* Identity Verification Section */}
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                    IDENTITY VERIFICATION (CNIC / STUDENT ID)
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium">Click card to zoom</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* CNIC Front */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedBooking.cnicFrontUrl ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        CNIC / ID Front
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                        {selectedBooking.cnicFrontUrl ? 'Attached' : 'Missing'}
                      </span>
                    </div>
                    {selectedBooking.cnicFrontUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            url: selectedBooking.cnicFrontUrl!,
                            title: `CNIC Front — ${studentName}`,
                          })
                        }
                        className="group relative w-full h-32 bg-slate-900/5 flex items-center justify-center overflow-hidden cursor-pointer"
                      >
                        <img
                          src={selectedBooking.cnicFrontUrl}
                          alt={`CNIC Front — ${studentName}`}
                          className="w-full h-full object-contain p-1.5 transition-transform duration-200 group-hover:scale-102"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-[#0b1329]/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-[11px] font-bold backdrop-blur-2xs">
                          <ZoomIn className="w-4 h-4" />
                          <span>View Full Document</span>
                        </div>
                        <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-md bg-[#0b1329]/70 backdrop-blur-xs text-white text-[9px] font-semibold flex items-center gap-1 pointer-events-none group-hover:opacity-0 transition-opacity">
                          <ZoomIn className="w-2.5 h-2.5" /> Enlarge
                        </span>
                      </button>
                    ) : (
                      <div className="w-full h-32 flex flex-col items-center justify-center p-3 text-center bg-slate-50/50">
                        <CreditCard className="w-6 h-6 text-slate-300 mb-1" />
                        <span className="text-slate-500 font-semibold text-[11px]">
                          Front ID image not available
                        </span>
                        <span className="text-slate-400 text-[10px] mt-0.5">
                          No document provided during booking
                        </span>
                      </div>
                    )}
                  </div>

                  {/* CNIC Back */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedBooking.cnicBackUrl ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        CNIC / ID Back
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                        {selectedBooking.cnicBackUrl ? 'Attached' : 'Missing'}
                      </span>
                    </div>
                    {selectedBooking.cnicBackUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            url: selectedBooking.cnicBackUrl!,
                            title: `CNIC Back — ${studentName}`,
                          })
                        }
                        className="group relative w-full h-32 bg-slate-900/5 flex items-center justify-center overflow-hidden cursor-pointer"
                      >
                        <img
                          src={selectedBooking.cnicBackUrl}
                          alt={`CNIC Back — ${studentName}`}
                          className="w-full h-full object-contain p-1.5 transition-transform duration-200 group-hover:scale-102"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-[#0b1329]/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-[11px] font-bold backdrop-blur-2xs">
                          <ZoomIn className="w-4 h-4" />
                          <span>View Full Document</span>
                        </div>
                        <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-md bg-[#0b1329]/70 backdrop-blur-xs text-white text-[9px] font-semibold flex items-center gap-1 pointer-events-none group-hover:opacity-0 transition-opacity">
                          <ZoomIn className="w-2.5 h-2.5" /> Enlarge
                        </span>
                      </button>
                    ) : (
                      <div className="w-full h-32 flex flex-col items-center justify-center p-3 text-center bg-slate-50/50">
                        <CreditCard className="w-6 h-6 text-slate-300 mb-1" />
                        <span className="text-slate-500 font-semibold text-[11px]">
                          Back ID image not available
                        </span>
                        <span className="text-slate-400 text-[10px] mt-0.5">
                          No document provided during booking
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedBooking.createdAt && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2 text-slate-500">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>
                    Booking registered on {new Date(selectedBooking.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Check-In Confirmation Modal */}
      <Modal
        isOpen={Boolean(checkInTarget)}
        onClose={() => setCheckInTarget(null)}
        title="Check In Resident"
        description="Verify student identity credentials and confirm room check-in."
        maxWidth="lg"
      >
        {checkInTarget && (() => {
          const student = checkInTarget.studentId || checkInTarget.student;
          const room = checkInTarget.roomId || checkInTarget.room;
          const studentName = student?.name || 'Student';
          const hasIncompleteIdentity = !checkInTarget.cnicFrontUrl || !checkInTarget.cnicBackUrl;

          return (
            <div className="space-y-4 text-xs">
              {/* Resident Summary Banner */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0b1329] text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {studentName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#0b1329]">{studentName}</h4>
                    <p className="text-slate-400 text-[11px]">{student?.email || '—'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Room Unit</span>
                  <span className="font-bold text-slate-800 text-xs">
                    Room {room?.roomNumber || '—'} {room?.layoutType ? `(${room.layoutType})` : ''}
                  </span>
                </div>
              </div>

              {/* Student Metadata Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Emergency Contact</span>
                  <p className="font-semibold text-slate-800 mt-0.5 truncate">
                    {checkInTarget.emergencyContact || 'None recorded'}
                  </p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Phone</span>
                  <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {student?.phone ? formatPhoneDisplay(student.phone) : 'Not provided'}
                  </p>
                </div>
              </div>

              {/* Warning if ID is incomplete */}
              {hasIncompleteIdentity && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-xs">Identity document is incomplete.</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      This booking application is missing one or both CNIC / identity verification photos.
                    </p>
                  </div>
                </div>
              )}

              {/* Identity Verification Section */}
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                    IDENTITY VERIFICATION (CNIC / STUDENT ID)
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium">Click card to zoom</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* CNIC Front */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${checkInTarget.cnicFrontUrl ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        CNIC / ID Front
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                        {checkInTarget.cnicFrontUrl ? 'Attached' : 'Missing'}
                      </span>
                    </div>
                    {checkInTarget.cnicFrontUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            url: checkInTarget.cnicFrontUrl!,
                            title: `CNIC Front — ${studentName}`,
                          })
                        }
                        className="group relative w-full h-32 bg-slate-900/5 flex items-center justify-center overflow-hidden cursor-pointer"
                      >
                        <img
                          src={checkInTarget.cnicFrontUrl}
                          alt={`CNIC Front — ${studentName}`}
                          className="w-full h-full object-contain p-1.5 transition-transform duration-200 group-hover:scale-102"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-[#0b1329]/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-[11px] font-bold backdrop-blur-2xs">
                          <ZoomIn className="w-4 h-4" />
                          <span>View Full Document</span>
                        </div>
                        <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-md bg-[#0b1329]/70 backdrop-blur-xs text-white text-[9px] font-semibold flex items-center gap-1 pointer-events-none group-hover:opacity-0 transition-opacity">
                          <ZoomIn className="w-2.5 h-2.5" /> Enlarge
                        </span>
                      </button>
                    ) : (
                      <div className="w-full h-32 flex flex-col items-center justify-center p-3 text-center bg-slate-50/50">
                        <CreditCard className="w-6 h-6 text-slate-300 mb-1" />
                        <span className="text-slate-500 font-semibold text-[11px]">
                          Front ID image not available
                        </span>
                        <span className="text-slate-400 text-[10px] mt-0.5">
                          No document provided during booking
                        </span>
                      </div>
                    )}
                  </div>

                  {/* CNIC Back */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${checkInTarget.cnicBackUrl ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        CNIC / ID Back
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                        {checkInTarget.cnicBackUrl ? 'Attached' : 'Missing'}
                      </span>
                    </div>
                    {checkInTarget.cnicBackUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            url: checkInTarget.cnicBackUrl!,
                            title: `CNIC Back — ${studentName}`,
                          })
                        }
                        className="group relative w-full h-32 bg-slate-900/5 flex items-center justify-center overflow-hidden cursor-pointer"
                      >
                        <img
                          src={checkInTarget.cnicBackUrl}
                          alt={`CNIC Back — ${studentName}`}
                          className="w-full h-full object-contain p-1.5 transition-transform duration-200 group-hover:scale-102"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-[#0b1329]/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-[11px] font-bold backdrop-blur-2xs">
                          <ZoomIn className="w-4 h-4" />
                          <span>View Full Document</span>
                        </div>
                        <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-md bg-[#0b1329]/70 backdrop-blur-xs text-white text-[9px] font-semibold flex items-center gap-1 pointer-events-none group-hover:opacity-0 transition-opacity">
                          <ZoomIn className="w-2.5 h-2.5" /> Enlarge
                        </span>
                      </button>
                    ) : (
                      <div className="w-full h-32 flex flex-col items-center justify-center p-3 text-center bg-slate-50/50">
                        <CreditCard className="w-6 h-6 text-slate-300 mb-1" />
                        <span className="text-slate-500 font-semibold text-[11px]">
                          Back ID image not available
                        </span>
                        <span className="text-slate-400 text-[10px] mt-0.5">
                          No document provided during booking
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Note */}
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/60 flex items-start gap-2 text-emerald-900 text-[11px]">
                <UserCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600 mt-0.5" />
                <p>
                  Confirming check-in assigns a permanent HostelHive Resident ID, marks this booking as <strong>CheckedIn</strong>, and activates the resident.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCheckInTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isCheckingIn}
                  onClick={handleConfirmCheckIn}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-75 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {isCheckingIn && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Check In</span>
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Lightbox Modal for Large Image Preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-[#0b1329]/80 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setPreviewImage(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 max-w-3xl max-h-[90vh] bg-white rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-sm text-[#0b1329] flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-slate-500" />
                <span>{previewImage.title}</span>
              </h4>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close image preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl bg-slate-950 flex items-center justify-center max-w-full">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[75vh] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Checkout Confirmation Modal */}
      <Modal
        isOpen={Boolean(checkoutTarget)}
        onClose={() => setCheckoutTarget(null)}
        title="Confirm Resident Checkout"
        description="Check out this resident? This will end their active residency and release the allocated bed."
      >
        {checkoutTarget && (() => {
          const student = checkoutTarget.studentId || checkoutTarget.student;
          const room = checkoutTarget.roomId || checkoutTarget.room;
          return (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200/80 flex items-start gap-2.5 text-amber-900">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <p>
                  Checking out <strong>{student?.name || 'Resident'}</strong> from Room{' '}
                  <strong>{room?.roomNumber || '—'}</strong> will update their status to{' '}
                  <span className="font-bold">CheckedOut</span> and automatically decrement the room's occupied count.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCheckoutTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isCheckingOut}
                  onClick={handleConfirmCheckOut}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl disabled:opacity-75 flex items-center gap-1.5 cursor-pointer"
                >
                  {isCheckingOut && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Check Out</span>
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
