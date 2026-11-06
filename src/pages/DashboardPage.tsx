import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Wallet,
  AlertTriangle,
  Bed,
  UserCheck,
  User,
  CreditCard,
  Wrench,
  Plus,
  UserPlus,
  Building,
  ArrowRight
} from 'lucide-react';
import { AdminNotificationInbox } from '../components/AdminNotificationInbox';
import { useAdminUnreadCountQuery } from '../features/api/notificationApi';
import Modal from '../components/Modal';
import { PageSpinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { useAppSelector } from '../store/hooks';
import { PageHeader, StatGrid } from '../components/responsive/ResponsivePrimitives';
import {
  useGetDashboardSummaryQuery,
  useGetRecentActivityQuery,
} from '../features/api/dashboardApi';

const getResidentName = (studentId: any) => {
  if (studentId && typeof studentId === 'object' && studentId.name) {
    return studentId.name;
  }
  return 'Unknown Resident';
};

const getRoomDisplay = (roomId: any) => {
  if (roomId && typeof roomId === 'object' && roomId.roomNumber) {
    return `Room ${roomId.roomNumber}`;
  }
  return 'Room unavailable';
};

const getResidentCode = (b: any) => {
  if (b.residentCode) return b.residentCode;
  if (b.studentId && typeof b.studentId === 'object' && b.studentId.residentCode) {
    return b.studentId.residentCode;
  }
  return null;
};

const getBookingStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'CheckedIn':
      return 'text-emerald-700 bg-emerald-50 border-emerald-100';
    case 'Approved':
      return 'text-blue-700 bg-blue-50 border-blue-100';
    case 'Pending':
      return 'text-amber-700 bg-amber-50 border-amber-100';
    case 'CheckedOut':
      return 'text-slate-700 bg-slate-100 border-slate-200';
    case 'Rejected':
    case 'Cancelled':
      return 'text-rose-700 bg-rose-50 border-rose-100';
    default:
      return 'text-slate-700 bg-slate-50 border-slate-100';
  }
};

export default function DashboardPage() {
  const user = useAppSelector((state) => state.auth.user);
  const hostelId = user?.hostelId;
  const { data: unreadResponse } = useAdminUnreadCountQuery(undefined, { pollingInterval: 60000 });
  const unreadAlerts = unreadResponse?.count ?? 0;

  const {
    data: summary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    error: summaryError,
    refetch: refetchSummary,
  } = useGetDashboardSummaryQuery(undefined, {
    skip: !hostelId,
  });

  const {
    data: recentActivity,
    isLoading: isActivityLoading,
  } = useGetRecentActivityQuery(10, {
    skip: !hostelId,
  });

  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  useEffect(() => {
    const openNotifications = () => setShowNotificationsModal(true);
    window.addEventListener('hh:open-admin-notifications', openNotifications);
    return () => window.removeEventListener('hh:open-admin-notifications', openNotifications);
  }, []);

  // If no hostel is registered yet, show prompt
  if (!hostelId) {
    return (
      <div className="workspace-page space-y-6 max-w-[1240px] mx-auto py-8">
        <div className="bg-[#0b1220] text-white rounded-xl p-8 sm:p-12 shadow-sm">
          <div className="max-w-xl space-y-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-emerald-400">
              <Building className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome to HostelHive, {user?.name || 'Admin'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Your administrative account is ready. To unlock room allocations, resident directories, automated rent collection, and AI chatbot grounding, please register your hostel property branch.
            </p>
            <div className="pt-2">
              <Link
                to="/hostel-reg"
                className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
              >
                <span>Register Hostel Property</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const rentCollected = summary?.rentCollectedThisMonth ?? 0;
  const openComplaints = summary?.openComplaints ?? 0;
  const occupiedBeds = summary?.occupancy?.occupied ?? 0;
  const totalBeds = summary?.occupancy?.capacity ?? 0;
  const occupancyPercent = summary?.occupancy?.percent ?? 0;
  const activeStaff = summary?.staff?.currentlyOnTask ?? 0;
  const totalStaff = summary?.staff?.total ?? 0;

  return (
    <div className="workspace-page space-y-6 max-w-[1240px] mx-auto pb-8">
      {/* Top Workspace Header */}
      <PageHeader className="dashboard-page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1329] tracking-tight">Welcome back, {user?.name?.split(' ')[0] || 'Admin'}</h1>
          <p className="mt-1 text-sm text-slate-500">Your hostel activity at a glance.</p>
        </div>

        {/* Action Buttons Top Right */}
        <div className="dashboard-header-actions flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setShowNotificationsModal(true)}
            aria-label="View notifications"
            className="relative p-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Bell className="w-4 h-4" />
            {unreadAlerts > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
            )}
          </button>
          {/* <Link
            to="/residents"
            aria-label="Search residents"
            className="p-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Search className="w-4 h-4" />
          </Link> */}
        </div>
      </PageHeader>

      {isSummaryError && (
        <ErrorBanner
          message={(summaryError as any)?.message || 'Failed to load dashboard statistics.'}
          onRetry={refetchSummary}
        />
      )}

      {/* 4 Metric Cards Row */}
      {isSummaryLoading ? (
        <PageSpinner message="Loading live property metrics..." />
      ) : (
        <StatGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Rent Collection */}
          <Link
            to="/payments"
            className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all group"
          >
            <div className="flex justify-between items-center">
              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 group-hover:bg-slate-100 transition-colors">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                Live
              </span>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-400">Rent Collection</p>
              <p className="text-2xl font-bold text-[#0b1329] mt-0.5 tracking-tight">
                Rs. {rentCollected.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">Collected this month</p>
            </div>
          </Link>

          {/* Complaints */}
          <Link
            to="/complaints"
            className="p-5 bg-white rounded-2xl border border-rose-200/90 shadow-2xs flex flex-col justify-between hover:border-rose-400 transition-all group"
          >
            <div className="flex justify-between items-center">
              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-500">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200/70 px-2.5 py-0.5 rounded-md">
                {openComplaints > 0 ? 'Action Needed' : 'All Clear'}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-400">Complaints</p>
              <p className="text-2xl font-bold text-[#0b1329] mt-0.5 tracking-tight">
                {openComplaints > 0 ? `${openComplaints} open` : 'All clear'}
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">{openComplaints > 0 ? 'Needs your attention' : 'No complaints to review'}</p>
            </div>
          </Link>

          {/* Occupancy Rate */}
          <Link
            to="/rooms"
            className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all group"
          >
            <div className="flex justify-between items-center">
              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 group-hover:bg-slate-100 transition-colors">
                <Bed className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                {occupancyPercent}% Rate
              </span>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-400">Occupancy Rate</p>
              <p className="text-2xl font-bold text-[#0b1329] mt-0.5 tracking-tight">
                {occupiedBeds} / {totalBeds} Beds
              </p>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-[#0b1329] h-full rounded-full transition-all"
                  style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
                ></div>
              </div>
            </div>
          </Link>

          {/* Staff Duty */}
          <Link
            to="/cleaning"
            className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all group"
          >
            <div className="flex justify-between items-center">
              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 group-hover:bg-slate-100 transition-colors">
                <UserCheck className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                {activeStaff} Active
              </span>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-400">Staff Duty</p>
              <p className="text-2xl font-bold text-[#0b1329] mt-0.5 tracking-tight">
                {activeStaff} / {totalStaff} On Task
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                Housekeeping: <span className="text-emerald-600 font-semibold">Active</span>
              </p>
            </div>
          </Link>
        </StatGrid>
      )}

      {/* Main Section: Recent Activity (2/3) + Quick Actions (1/3) */}
      <div className="dashboard-main-grid grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Recent Activity Container */}
        <div className="dashboard-recent lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="font-bold text-base text-[#0b1329]">Recent Activity</h2>
              <p className="text-xs text-slate-400 font-medium">Real-time property event stream</p>
            </div>
            <button
              type="button"
              onClick={() => setShowActivityModal(true)}
              className="text-xs font-bold text-slate-700 hover:text-[#0b1329] hover:underline"
            >
              View Full History →
            </button>
          </div>

          {isActivityLoading ? (
            <PageSpinner message="Loading recent activities..." />
          ) : !recentActivity || (recentActivity.recentBookings.length === 0 && recentActivity.recentComplaints.length === 0) ? (
            <EmptyState
              title="No Recent Activity"
              description="No bookings or maintenance complaints have occurred recently."
            />
          ) : (
            <div className="space-y-4">
              {recentActivity.recentBookings.map((b) => {
                const residentName = getResidentName(b.studentId);
                const roomDisplay = getRoomDisplay(b.roomId);
                const residentCode = getResidentCode(b);

                return (
                  <div
                    key={b._id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Booking: {b.status}</p>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {residentName}
                          {residentCode ? ` • ${residentCode}` : ''} • {roomDisplay}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-slate-800">
                        {new Date(b.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mt-0.5 border ${getBookingStatusBadgeClass(b.status)}`}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                );
              })}

              {recentActivity.recentComplaints.map((c) => (
                <div
                  key={c._id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{c.description}</p>
                      <p className="text-xs text-slate-400 font-medium">Severity: {c.severityTier}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-slate-800">
                      {new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mt-0.5 text-rose-700 bg-rose-50 border border-rose-100">
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Stack Cards */}
        <div className="dashboard-quick-actions-stack space-y-4">
          {/* Compact actions use a neutral surface so activity remains the primary focus. */}
          <div className="dashboard-quick-actions bg-white text-[#0b1329] rounded-xl border border-slate-200 p-5 shadow-2xs">
            <h3 className="font-bold text-sm mb-3">Go to</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                to="/rooms"
                className="flex flex-col items-center justify-center p-3 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-4 h-4 mb-1 text-slate-600" />
                <span>Assign Room</span>
              </Link>
              <Link
                to="/residents"
                className="flex flex-col items-center justify-center p-3 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors"
              >
                <UserPlus className="w-4 h-4 mb-1 text-slate-600" />
                <span>Residents</span>
              </Link>
              <Link
                to="/payments"
                className="flex flex-col items-center justify-center p-3 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors"
              >
                <CreditCard className="w-4 h-4 mb-1 text-slate-600" />
                <span>Rent Ledger</span>
              </Link>
              <Link
                to="/complaints"
                className="flex flex-col items-center justify-center p-3 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors"
              >
                <AlertTriangle className="w-4 h-4 mb-1 text-slate-600" />
                <span>Complaints</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Modal */}
      <Modal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        title="Administrative Notifications"
        description="System events, maintenance tickets, and rent updates."
      >
        <AdminNotificationInbox onClose={() => setShowNotificationsModal(false)} />
      </Modal>

      {/* Activity History Modal */}
      <Modal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        title="Full Property Activity Stream"
        description="Detailed chronological log of bookings and maintenance events."
      >
        <div className="space-y-3 max-h-96 overflow-y-auto scroll-thin text-xs">
          {recentActivity?.recentBookings.map((b) => {
            const residentName = getResidentName(b.studentId);
            const roomDisplay = getRoomDisplay(b.roomId);
            const residentCode = getResidentCode(b);

            return (
              <div key={b._id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">Booking: {b.status}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border ${getBookingStatusBadgeClass(b.status)}`}>
                      {b.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(b.updatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <p className="text-slate-600 mt-1 font-medium">
                  {residentName}
                  {residentCode ? ` • ${residentCode}` : ''} • {roomDisplay}
                </p>
              </div>
            );
          })}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowActivityModal(false)}
              className="px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
