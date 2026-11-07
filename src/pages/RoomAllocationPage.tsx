import { getRequestError } from '../utils/requestError';
import { useState, useMemo, useRef } from 'react';
import type { FormEvent } from 'react';
import { 
  Plus, 
  MoreVertical, 
  Search, 
  Filter,
  Lock,
  Unlock,
  Trash2,
  CheckCircle,
  XCircle,
  UserCheck,
  Building,
  Loader2,
  Clock
} from 'lucide-react';
import { ActionMenu } from '../components/ActionMenu';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { PageSpinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { PageHeader, ResponsiveTable, ScrollableTabs, StatGrid } from '../components/responsive/ResponsivePrimitives';
import { useAppSelector } from '../store/hooks';
import {
  useListRoomsQuery,
  useCreateRoomMutation,
  useUpdateRoomStatusMutation,
  useDeleteRoomMutation,
} from '../features/api/roomApi';
import {
  useListPendingBookingsQuery,
  useApproveBookingMutation,
  useRejectBookingMutation,
} from '../features/api/bookingApi';
import type { RoomLayout, Room } from '../types/api';

export default function RoomAllocationPage() {
  const user = useAppSelector((state) => state.auth.user);
  const hostelId = user?.hostelId ?? '';

  // RTK Query Hooks
  const {
    data: rooms = [],
    isLoading: isRoomsLoading,
    isError: isRoomsError,
    error: roomsError,
    refetch: refetchRooms,
  } = useListRoomsQuery(hostelId, { skip: !hostelId });

  const {
    data: pendingBookings = [],
    isLoading: isPendingLoading,
  } = useListPendingBookingsQuery(hostelId, { skip: !hostelId });

  const [createRoomMutation, { isLoading: isCreatingRoom }] = useCreateRoomMutation();
  const [updateRoomStatusMutation] = useUpdateRoomStatusMutation();
  const [deleteRoomMutation] = useDeleteRoomMutation();
  const [approveBookingMutation, { isLoading: isApproving }] = useApproveBookingMutation();
  const [rejectBookingMutation, { isLoading: isRejecting }] = useRejectBookingMutation();

  // Local UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OCCUPIED' | 'VACANT' | 'PARTIAL' | 'LOCKED'>('ALL');
  const [activeTab, setActiveTab] = useState<'rooms' | 'pending'>('rooms');
  
  // Modals & Menu states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const pendingRef = useRef(new Set<string>());
  const [pendingRooms, setPendingRooms] = useState<string[]>([]);
  const [roomToDelete, setRoomToDelete] = useState<{ id: string; roomNum: string } | null>(null);
  const setRoomBusy = (id: string, busy: boolean) => { if (busy) pendingRef.current.add(id); else pendingRef.current.delete(id); setPendingRooms([...pendingRef.current]); };
  const [activeMenuRoomId, setActiveMenuRoomId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Create Room Form state
  const [roomNumber, setRoomNumber] = useState('');
  const [layoutType, setLayoutType] = useState<RoomLayout>('Shared-2');
  const [capacity, setCapacity] = useState(2);
  const [monthlyRent, setMonthlyRent] = useState('');

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToasts((prev) => [...prev, { id: Date.now().toString(), type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Helper to determine status string
  const getRoomStatus = (room: Room): 'OCCUPIED' | 'VACANT' | 'PARTIAL' | 'LOCKED' => {
    if (room.isLocked) return 'LOCKED';
    if (room.occupiedCount === 0) return 'VACANT';
    if (room.occupiedCount >= room.capacity) return 'OCCUPIED';
    return 'PARTIAL';
  };

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const status = getRoomStatus(room);
      const matchesSearch =
        room.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.layoutType.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rooms, searchQuery, statusFilter]);

  // Derived metrics
  const totalUnits = rooms.length;
  const vacantUnits = rooms.filter((r) => !r.isLocked && r.occupiedCount === 0).length;
  const occupiedUnits = rooms.filter((r) => !r.isLocked && r.occupiedCount >= r.capacity).length;
  const partialUnits = rooms.filter((r) => !r.isLocked && r.occupiedCount > 0 && r.occupiedCount < r.capacity).length;

  const handleCreateRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim() || !hostelId) return;

    try {
      await createRoomMutation({
        hostelId,
        data: {
          roomNumber: roomNumber.trim(),
          layoutType,
          capacity: Number(capacity),
          monthlyRent: monthlyRent.trim() ? Number(monthlyRent) : null,
        },
      }).unwrap();

      setShowCreateModal(false);
      setRoomNumber('');
      setLayoutType('Shared-2');
      setCapacity(2);
      setMonthlyRent('');
      addToast('success', `Room ${roomNumber} created successfully!`);
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to create room.');
    }
  };

  const handleToggleLock = async (room: Room) => {
    if (pendingRef.current.has(room._id)) return;
    setRoomBusy(room._id, true);
    try {
      await updateRoomStatusMutation({
        id: room._id,
        data: { isLocked: !room.isLocked },
      }).unwrap();
      setActiveMenuRoomId(null);
      addToast('info', `Room ${room.roomNumber} ${room.isLocked ? 'unlocked' : 'locked'}.`);
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to update room.');
    } finally { setRoomBusy(room._id, false); }
  };

  const handleDeleteRoom = async (id: string, roomNum: string) => {
    if (pendingRef.current.has(id)) return;
    setRoomBusy(id, true);
    try {
      await deleteRoomMutation(id).unwrap();
      setActiveMenuRoomId(null);
      addToast('info', `Room ${roomNum} deleted.`);
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to delete room.');
    } finally { setRoomBusy(id, false); setRoomToDelete(null); }
  };

  const handleApproveBooking = async (bookingId: string) => {
    try {
      await approveBookingMutation(bookingId).unwrap();
      addToast('success', 'Booking approved and resident allocated to room.');
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to approve booking.');
    }
  };

  const handleRejectBooking = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId) return;

    try {
      await rejectBookingMutation({
        id: selectedBookingId,
        reason: rejectionReason || undefined,
      }).unwrap();
      setShowRejectModal(false);
      setSelectedBookingId(null);
      setRejectionReason('');
      addToast('info', 'Booking request rejected.');
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to reject booking.');
    }
  };

  if (!hostelId) {
    return (
      <EmptyState
        icon={Building}
        title="Hostel Not Registered"
        description="Please complete your hostel registration first before configuring room allocations."
        actionText="Register Hostel Now"
        onAction={() => (window.location.href = '/hostel-reg')}
      />
    );
  }

  return (
    <div className="workspace-page space-y-6 max-w-[1240px] mx-auto text-slate-800 pb-12">
      {/* Top Bar Header */}
      <PageHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1329] tracking-tight">Room Allocation</h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Manage room inventory and review resident allocation requests.
          </p>
        </div>

        {/* Action Buttons Top Right */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0b1329] text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Room</span>
          </button>
        </div>
      </PageHeader>

      {/* Tabs */}
      <ScrollableTabs className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          aria-pressed={activeTab === 'rooms'}
          onClick={() => setActiveTab('rooms')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'rooms'
              ? 'border-[#0b1329] text-[#0b1329]'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Active Rooms ({rooms.length})
        </button>
        <button
          type="button"
          aria-pressed={activeTab === 'pending'}
          onClick={() => setActiveTab('pending')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-[#0b1329] text-[#0b1329]'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <span>Pending Approvals</span>
          {pendingBookings.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
              {pendingBookings.length}
            </span>
          )}
        </button>
      </ScrollableTabs>

      {/* Metric Cards Row */}
      <StatGrid className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="border-r border-slate-100 pr-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Units</p>
          <p className="text-2xl font-bold text-[#0b1329] mt-1">{totalUnits} active</p>
        </div>
        <div className="border-r border-slate-100 pr-4 pl-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Available (Vacant)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{vacantUnits}</p>
        </div>
        <div className="border-r border-slate-100 pr-4 pl-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Fully Occupied</p>
          <p className="text-2xl font-bold text-[#0b1329] mt-1">{occupiedUnits}</p>
        </div>
        <div className="pl-2">
          <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Partial Occupancy</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{partialUnits}</p>
        </div>
      </StatGrid>

      {isRoomsError && (
        <ErrorBanner
          message={getRequestError(roomsError)?.message || 'Failed to load rooms.'}
          onRetry={refetchRooms}
        />
      )}

      {activeTab === 'rooms' ? (
        <>
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by room number or layout type..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20 text-slate-800 placeholder:text-slate-400 shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Status:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none shadow-2xs cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="OCCUPIED">Occupied</option>
                <option value="VACANT">Vacant</option>
                <option value="PARTIAL">Partial</option>
                <option value="LOCKED">Locked</option>
              </select>
            </div>
          </div>

          {/* Main Allocation Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            {isRoomsLoading ? (
              <PageSpinner message="Loading room allocations..." />
            ) : filteredRooms.length === 0 ? (
              <EmptyState
                title="No Rooms Found"
                description={
                  rooms.length === 0
                    ? 'No room units created yet. Add your first room to get started.'
                    : 'No room units matched your current filter criteria.'
                }
                actionText={rooms.length === 0 ? 'Add First Room' : 'Clear Filters'}
                onAction={() => {
                  if (rooms.length === 0) {
                    setShowCreateModal(true);
                  } else {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                  }
                }}
              />
            ) : (
              <ResponsiveTable className="overflow-x-auto scroll-thin min-h-[220px]">
                <table className="responsive-table w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-4 px-6">ROOM NO.</th>
                      <th className="py-4 px-6">LAYOUT TIER</th>
                      <th className="py-4 px-6">MONTHLY RENT</th>
                      <th className="py-4 px-6">CAPACITY</th>
                      <th className="py-4 px-6">OCCUPANCY</th>
                      <th className="py-4 px-6">STATUS</th>
                      <th className="py-4 px-6 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium">
                    {filteredRooms.map((room, idx) => {
                      const status = getRoomStatus(room);
                      return (
                        <tr key={room._id} className="hover:bg-slate-50/60 transition-colors relative">
                          <td data-label="Room" data-card-primary="true" className="py-4 px-6 font-bold text-[#0b1329]">{room.roomNumber}</td>
                          <td data-label="Layout" className="py-4 px-6 text-slate-600">{room.layoutType}</td>
                          <td data-label="Monthly rent" className="py-4 px-6 text-slate-700 font-semibold">
                            {room.monthlyRent != null && room.monthlyRent > 0 ? (
                              `Rs. ${room.monthlyRent.toLocaleString()}`
                            ) : (
                              <span className="text-slate-400 font-normal">Base Tier</span>
                            )}
                          </td>
                          <td data-label="Capacity" className="py-4 px-6 text-slate-600 font-semibold">{room.capacity} beds</td>
                          <td data-label="Occupancy" className="py-4 px-6">
                            <span className="font-semibold text-slate-800">
                              {room.occupiedCount} / {room.capacity}
                            </span>
                          </td>
                          <td data-label="Status" data-card-status="true" className="py-4 px-6">
                            {status === 'OCCUPIED' && (
                              <span className="px-2.5 py-1 text-[9px] font-extrabold bg-[#0b1329] text-white rounded-md tracking-wider">
                                OCCUPIED
                              </span>
                            )}
                            {status === 'VACANT' && (
                              <span className="px-2.5 py-1 text-[9px] font-extrabold bg-slate-100 text-slate-500 rounded-md tracking-wider border border-slate-200">
                                VACANT
                              </span>
                            )}
                            {status === 'PARTIAL' && (
                              <span className="px-2.5 py-1 text-[9px] font-extrabold text-amber-800 bg-amber-50 border border-amber-300 rounded-md tracking-wider">
                                PARTIAL
                              </span>
                            )}
                            {status === 'LOCKED' && (
                              <span className="px-2.5 py-1 text-[9px] font-extrabold text-rose-800 bg-rose-50 border border-rose-300 rounded-md tracking-wider">
                                LOCKED
                              </span>
                            )}
                          </td>
                          <td data-label="Actions" data-card-actions="true" className="py-4 px-6 text-right relative">
                            <div className="inline-block relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveMenuRoomId(activeMenuRoomId === room._id ? null : room._id)
                                }
                                id={`room-menu-trigger-${room._id}`} aria-label={`Actions for room ${room.roomNumber}`} aria-haspopup="menu" aria-expanded={activeMenuRoomId === room._id} aria-controls={`room-menu-${room._id}`} disabled={pendingRooms.includes(room._id)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <MoreVertical className="w-4 h-4" />{pendingRooms.includes(room._id) && <span>Updating...</span>}
                              </button>

                              {/* Dropdown Menu */}
                              {activeMenuRoomId === room._id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setActiveMenuRoomId(null)}
                                  />
                                  <ActionMenu id={`room-menu-${room._id}`} triggerId={`room-menu-trigger-${room._id}`} onClose={() => setActiveMenuRoomId(null)}
                                    className={`responsive-action-menu absolute right-0 ${
                                      idx > 0 && idx >= filteredRooms.length - 2
                                        ? 'bottom-full mb-1'
                                        : 'top-full mt-1'
                                    } w-44 bg-white rounded-xl shadow-xl border border-slate-200/80 py-1.5 z-20 text-left text-xs font-semibold`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleToggleLock(room);
                                        setActiveMenuRoomId(null);
                                      }}
                                      className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                                    >
                                      {room.isLocked ? (
                                        <>
                                          <Unlock className="w-3.5 h-3.5 text-emerald-600" /> Unlock Room
                                        </>
                                      ) : (
                                        <>
                                          <Lock className="w-3.5 h-3.5 text-amber-600" /> Lock Room
                                        </>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRoomToDelete({ id: room._id, roomNum: room.roomNumber });
                                        setActiveMenuRoomId(null);
                                      }}
                                      className="w-full px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Delete Room
                                    </button>
</ActionMenu>
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
            )}

            {/* Table Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 text-xs text-slate-400 font-medium">
              <span>Showing {filteredRooms.length} of {rooms.length} units</span>
            </div>
          </div>
        </>
      ) : (
        /* Pending Bookings Tab */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {isPendingLoading ? (
            <PageSpinner message="Loading pending booking applications..." />
          ) : pendingBookings.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="No Pending Applications"
              description="There are currently no new student booking applications awaiting review."
            />
          ) : (
            <ResponsiveTable className="overflow-x-auto scroll-thin">
              <table className="responsive-table w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-4 px-6">STUDENT NAME</th>
                    <th className="py-4 px-6">ROOM REQUESTED</th>
                    <th className="py-4 px-6">CONTACT & ID</th>
                    <th className="py-4 px-6">DATE SUBMITTED</th>
                    <th className="py-4 px-6 text-right">DECISION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {pendingBookings.map((b) => (
                    <tr key={b._id} className="hover:bg-slate-50/60 transition-colors">
                      <td data-label="Student" data-card-primary="true" className="py-4 px-6">
                        <div className="font-bold text-[#0b1329]">{b.studentId?.name || 'Applicant'}</div>
                        <div className="text-[11px] text-slate-400">{b.studentId?.email}</div>
                      </td>
                      <td data-label="Room requested" className="py-4 px-6">
                        <span className="font-semibold text-slate-800">
                          Room {b.roomId?.roomNumber || 'N/A'}
                        </span>
                        <div className="text-[11px] text-slate-400">{b.roomId?.layoutType}</div>
                      </td>
                      <td data-label="Contact" className="py-4 px-6 text-slate-600">
                        <div>{b.studentId?.phone || b.emergencyContact || 'No phone'}</div>
                      </td>
                      <td data-label="Submitted" className="py-4 px-6 text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td data-label="Decision" data-card-actions="true" className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isApproving}
                            onClick={() => handleApproveBooking(b._id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-75"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            disabled={isRejecting}
                            onClick={() => {
                              setSelectedBookingId(b._id);
                              setShowRejectModal(true);
                            }}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          )}
        </div>
      )}

      <ConfirmationDialog open={Boolean(roomToDelete)} title="Delete room?" message={roomToDelete ? `Room ${roomToDelete.roomNum} will be removed. Rooms with active residents or bookings cannot be deleted.` : ''} busy={Boolean(roomToDelete && pendingRooms.includes(roomToDelete.id))} onClose={() => setRoomToDelete(null)} onConfirm={() => { if (roomToDelete) void handleDeleteRoom(roomToDelete.id, roomToDelete.roomNum); }} confirmLabel="Delete room" />
      {/* Create Room Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add New Room Unit"
        description="Configure new room inventory in your hostel property."
      >
        <form onSubmit={handleCreateRoom} className="space-y-4">
          <div>
            <label htmlFor="room-form-1" className="block text-xs font-bold text-slate-700 mb-1">
              Room Number <span className="text-rose-500">*</span>
            </label>
            <input id="room-form-1"
              type="text"
              required
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="e.g. 302-B"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20"
            />
          </div>

          <div>
            <label htmlFor="room-form-2" className="block text-xs font-bold text-slate-700 mb-1">
              Layout Type <span className="text-rose-500">*</span>
            </label>
            <select id="room-form-2"
              value={layoutType}
              onChange={(e) => {
                const val = e.target.value as RoomLayout;
                setLayoutType(val);
                if (val === 'Single') setCapacity(1);
                else if (val === 'Shared-2') setCapacity(2);
                else if (val === 'Shared-4') setCapacity(4);
              }}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
            >
              <option value="Single">Single (1 Bed)</option>
              <option value="Shared-2">Shared-2 (2 Beds)</option>
              <option value="Shared-4">Shared-4 (4 Beds)</option>
            </select>
          </div>

          <div>
            <label htmlFor="room-form-3" className="block text-xs font-bold text-slate-700 mb-1">
              Bed Capacity <span className="text-rose-500">*</span>
            </label>
            <input id="room-form-3"
              type="number"
              min={1}
              max={8}
              required
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="room-form-4" className="block text-xs font-bold text-slate-700 mb-1">
              Monthly Rent (PKR) <span className="text-slate-400 font-normal">(Optional — defaults to hostel base price)</span>
            </label>
            <input id="room-form-4"
              type="number"
              min={0}
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value)}
              placeholder="e.g. 18000"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingRoom}
              className="px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 disabled:opacity-75 flex items-center gap-1.5"
            >
              {isCreatingRoom && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Create Unit</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Reject Booking Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedBookingId(null);
        }}
        title="Reject Booking Request"
        description="Provide an optional reason for rejecting this student's room application."
      >
        <form onSubmit={handleRejectBooking} className="space-y-4">
          <div>
            <label htmlFor="room-form-5" className="block text-xs font-bold text-slate-700 mb-1">
              Reason for Rejection
            </label>
            <textarea id="room-form-5"
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Desired room tier is at full capacity"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => {
                setShowRejectModal(false);
                setSelectedBookingId(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRejecting}
              className="px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-75"
            >
              Confirm Rejection
            </button>
          </div>
        </form>
      </Modal>

      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
