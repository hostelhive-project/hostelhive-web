import { getRequestError } from '../utils/requestError';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { 
  Plus, 
  Pencil,
  Trash2,
  Download,
  Send,
  Building,
  Loader2,
  Clock,
  UserCheck,
  Eye,
  Calendar,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Phone,
  Mail,
  ZoomIn,
  X
} from 'lucide-react';
import Modal from '../components/Modal';
import CleaningAssessmentPanel, { CleaningAssessmentBadge } from '../components/CleaningAssessment';
import Toast from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { PageSpinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { PageHeader, ResponsiveTable } from '../components/responsive/ResponsivePrimitives';
import { useAppSelector } from '../store/hooks';
import {
  useListCleaningTasksForHostelQuery,
  useGetCleaningTaskByIdQuery,
  useAssignCleaningTaskMutation,
  useGetCleaningDirectiveQuery,
  useBroadcastCleaningDirectiveMutation,
} from '../features/api/taskApi';
import { useListRoomsQuery } from '../features/api/roomApi';
import {
  useListStaffForHostelQuery,
  useCreateStaffMutation,
  useUpdateStaffMutation,
  useUpdateStaffInvitationMutation,
  useResendStaffInvitationMutation,
  useCancelStaffInvitationMutation,
  useDeleteStaffMutation,
} from '../features/api/userApi';
import PhoneInputWithCountry from '../components/PhoneInputWithCountry';
import {
  type CountryInfo,
  DEFAULT_COUNTRY,
  formatPhoneDisplay,
  parseExistingPhone,
  validateAndFormatPhone,
} from '../utils/phoneUtils';
import type { TaskStatus, TaskType, CleaningTask, User } from '../types/api';

function formatCsvDateTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  if (str === '') return '""';

  // Prevent formula injection in spreadsheet software (=, +, -, @)
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export default function CleaningSchedulePage({ staffOnly = false }: { staffOnly?: boolean }) {
  const user = useAppSelector((state) => state.auth.user);
  const hostelId = user?.hostelId ?? '';

  const [statusFilter, setStatusFilter] = useState<'ALL' | TaskStatus>('ALL');
  const [guidelineInput, setGuidelineInput] = useState('');

  const {
    data: directiveData,
    isLoading: isLoadingDirective,
  } = useGetCleaningDirectiveQuery(undefined, { skip: staffOnly });

  const [broadcastDirectiveMutation, { isLoading: isBroadcasting }] =
    useBroadcastCleaningDirectiveMutation();

  const {
    data: tasks = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useListCleaningTasksForHostelQuery(
    {
      hostelId,
      statusFilter: statusFilter === 'ALL' ? undefined : statusFilter,
    },
    { skip: !hostelId || staffOnly }
  );

  const { data: rooms = [] } = useListRoomsQuery(hostelId, { skip: !hostelId });
  const { data: staffMembers = [], isLoading: isStaffLoading, isError: isStaffError, refetch: refetchStaff } = useListStaffForHostelQuery(hostelId, { skip: !hostelId });
  const activeStaffMembers = staffMembers.filter(
    (staff) => staff.isActive !== false && staff.emailVerified !== false
  );
  const pendingStaffInvites = staffMembers.filter(
    (staff) => staff.isActive === false || staff.emailVerified === false
  );

  const [assignTaskMutation, { isLoading: isAssigning }] = useAssignCleaningTaskMutation();
  const [createStaffMutation, { isLoading: isCreatingStaff }] = useCreateStaffMutation();
  const [updateStaffMutation, { isLoading: isUpdatingStaff }] = useUpdateStaffMutation();
  const [updateStaffInvitationMutation, { isLoading: isUpdatingInvitation }] = useUpdateStaffInvitationMutation();
  const [resendStaffInvitationMutation, { isLoading: isResendingInvitation }] = useResendStaffInvitationMutation();
  const [cancelStaffInvitationMutation, { isLoading: isCancelingInvitation }] = useCancelStaffInvitationMutation();
  const [deleteStaffMutation, { isLoading: isDeletingStaff }] = useDeleteStaffMutation();

  // Modals & toasts
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<User | null>(null);
  const [invitationToEdit, setInvitationToEdit] = useState<User | null>(null);
  const [invitationEmail, setInvitationEmail] = useState('');
  const [invitationToCancel, setInvitationToCancel] = useState<User | null>(null);
  const [selectedDelayedTask, setSelectedDelayedTask] = useState<CleaningTask | null>(null);
  const [selectedTaskSnapshot, setSelectedDetailTask] = useState<CleaningTask | null>(null);
  const { currentData: freshDetailTask, isFetching: isDetailFetching, isError: isDetailError, refetch: refetchDetail } = useGetCleaningTaskByIdQuery(selectedTaskSnapshot?._id || '', {
    skip: !selectedTaskSnapshot,
    pollingInterval: selectedTaskSnapshot ? 10000 : 0,
    skipPollingIfUnfocused: true,
    refetchOnMountOrArgChange: true,
  });
  const selectedDetailTask = freshDetailTask || selectedTaskSnapshot;
  const hasPendingAssessments = tasks.some((task) => ['Pending', 'Processing'].includes(task.cleaningAssessment?.status || ''));
  useEffect(() => {
    if (!hasPendingAssessments || !hostelId || staffOnly) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refetch(); }, 10000);
    return () => window.clearInterval(timer);
  }, [hasPendingAssessments, hostelId, staffOnly, refetch]);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isExporting, setIsExporting] = useState(false);

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

  // Task form state
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('Routine');
  const [scheduledTime, setScheduledTime] = useState(() =>
    new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 16)
  );

  // Staff form state
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffCountry, setStaffCountry] = useState<CountryInfo>(DEFAULT_COUNTRY);
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPhoneError, setStaffPhoneError] = useState<string | null>(null);
  const [staffEditName, setStaffEditName] = useState('');
  const [staffEditCountry, setStaffEditCountry] = useState<CountryInfo>(DEFAULT_COUNTRY);
  const [staffEditPhone, setStaffEditPhone] = useState('');
  const [staffEditPhoneError, setStaffEditPhoneError] = useState<string | null>(null);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToasts((prev) => [...prev, { id: Date.now().toString(), type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleExport = () => {
    if (isExporting) return;

    if (!tasks || tasks.length === 0) {
      addToast('info', 'No cleaning tasks available to export.');
      return;
    }

    try {
      setIsExporting(true);

      const headers = [
        'Room Unit',
        'Room Type',
        'Task Type',
        'Scheduled Time',
        'Assigned Staff',
        'Status',
        'Delay Reason',
        'Started At',
        'Completed At',
      ];

      const rows = tasks.map((task) => [
        sanitizeCsvCell(task.roomId?.roomNumber ? `Room ${task.roomId.roomNumber}` : '—'),
        sanitizeCsvCell(task.roomId?.layoutType || '—'),
        sanitizeCsvCell(task.taskType || '—'),
        sanitizeCsvCell(formatCsvDateTime(task.scheduledTime)),
        sanitizeCsvCell(task.assignedStaffId?.name || 'Unassigned'),
        sanitizeCsvCell(task.status || '—'),
        sanitizeCsvCell(task.status === 'Delayed' ? (task.delayReason || 'No delay reason provided') : ''),
        sanitizeCsvCell(formatCsvDateTime(task.startedAt)),
        sanitizeCsvCell(formatCsvDateTime(task.completedAt)),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\r\n');

      const blob = new Blob([`\uFEFF${csvContent}`], {
        type: 'text/csv;charset=utf-8;',
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = `hostelhive-cleaning-schedule-${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast('success', 'Sanitation schedule exported.');
    } catch {
      addToast('error', 'Failed to export cleaning schedule.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleBroadcast = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = guidelineInput.trim();
    if (!trimmed || isBroadcasting) return;

    try {
      const res = await broadcastDirectiveMutation({
        directive: trimmed,
      }).unwrap();

      setGuidelineInput('');
      if (res.recipientCount === 0) {
        addToast('info', res.message || 'No cleaning staff are currently assigned to this hostel.');
      } else {
        addToast(
          'success',
          res.message ||
            `Broadcast to ${res.recipientCount} cleaning staff member${res.recipientCount > 1 ? 's' : ''}.`
        );
      }
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to broadcast directive.');
    }
  };

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId || !selectedStaffId) return;

    try {
      await assignTaskMutation({
        roomId: selectedRoomId,
        assignedStaffId: selectedStaffId,
        taskType,
        scheduledTime: new Date(scheduledTime).toISOString(),
      }).unwrap();

      setShowNewTaskModal(false);
      setSelectedRoomId('');
      setSelectedStaffId('');
      setTaskType('Routine');
      addToast('success', 'Cleaning task scheduled and dispatched to staff.');
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to schedule task.');
    }
  };

  const handleCreateStaff = async (e: FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim()) return;
    setStaffPhoneError(null);

    let finalPhone: string | undefined = undefined;
    if (staffPhone.trim()) {
      const validation = validateAndFormatPhone(staffPhone.trim(), staffCountry.code);
      if (!validation.isValid || !validation.e164) {
        setStaffPhoneError(validation.error || 'Please enter a valid phone number.');
        return;
      }
      finalPhone = validation.e164;
    }

    try {
      await createStaffMutation({
        name: staffName.trim(),
        email: staffEmail.trim().toLowerCase(),
        phone: finalPhone,
      }).unwrap();

      setShowAddStaffModal(false);
      setStaffName('');
      setStaffEmail('');
      setStaffPhone('');
      setStaffCountry(DEFAULT_COUNTRY);
      setStaffPhoneError(null);
      addToast('success', `Invitation sent to ${staffEmail.trim()}. They can verify their email and set a password in the mobile app.`);
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to enroll staff member.');
    }
  };

  const openStaffEditor = (staff: User) => {
    setSelectedStaff(staff);
    const parsedPhone = parseExistingPhone(staff.phone);
    setStaffEditName(staff.name);
    setStaffEditCountry(parsedPhone.country);
    setStaffEditPhone(parsedPhone.nationalNumber);
    setStaffEditPhoneError(null);
  };

  const closeStaffEditor = () => {
    setSelectedStaff(null);
    setStaffEditPhoneError(null);
  };

  const handleUpdateStaff = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !staffEditName.trim()) return;
    setStaffEditPhoneError(null);

    let finalPhone: string | null = null;
    if (staffEditPhone.trim()) {
      const validation = validateAndFormatPhone(staffEditPhone.trim(), staffEditCountry.code);
      if (!validation.isValid || !validation.e164) {
        setStaffEditPhoneError(validation.error || 'Please enter a valid phone number.');
        return;
      }
      finalPhone = validation.e164;
    }

    try {
      await updateStaffMutation({
        id: selectedStaff._id,
        data: { name: staffEditName.trim(), phone: finalPhone },
      }).unwrap();
      setSelectedStaff(null);
      addToast('success', 'Staff details updated successfully.');
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to update staff details.');
    }
  };

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return;
    try {
      await deleteStaffMutation(staffToDelete._id).unwrap();
      const removedName = staffToDelete.name;
      setStaffToDelete(null);
      addToast('success', `${removedName} was removed from your staff list.`);
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to remove staff member.');
    }
  };

  const openInvitationEditor = (invitation: User) => {
    setInvitationToEdit(invitation);
    setInvitationEmail(invitation.email);
  };

  const handleUpdateInvitationEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!invitationToEdit || !invitationEmail.trim()) return;

    try {
      await updateStaffInvitationMutation({
        id: invitationToEdit._id,
        email: invitationEmail.trim().toLowerCase(),
      }).unwrap();
      const correctedEmail = invitationEmail.trim().toLowerCase();
      setInvitationToEdit(null);
      setInvitationEmail('');
      addToast('success', `Invitation updated. A new code was sent to ${correctedEmail}.`);
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to update the invitation email.');
    }
  };

  const handleResendInvitation = async (invitation: User) => {
    try {
      await resendStaffInvitationMutation(invitation._id).unwrap();
      addToast('success', `A new verification code was sent to ${invitation.email}.`);
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Could not resend the invitation code.');
    }
  };

  const handleCancelInvitation = async () => {
    if (!invitationToCancel) return;
    try {
      await cancelStaffInvitationMutation(invitationToCancel._id).unwrap();
      const cancelledName = invitationToCancel.name;
      setInvitationToCancel(null);
      addToast('success', `Invitation for ${cancelledName} was cancelled.`);
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      addToast('error', err?.data?.message || err?.message || 'Failed to cancel the invitation.');
    }
  };

  if (!hostelId) {
    return (
      <EmptyState
        icon={Building}
        title="Hostel Not Registered"
        description="Please register your hostel property to organize cleaning tasks and room sanitation schedules."
        actionText="Register Hostel Now"
        onAction={() => (window.location.href = '/hostel-reg')}
      />
    );
  }

  const scheduledCount = tasks.filter((t) => t.status === 'Scheduled').length;
  const inProgressCount = tasks.filter((t) => t.status === 'InProgress').length;
  const completedCount = tasks.filter((t) => t.status === 'Completed').length;

  return (
    <div className="workspace-page space-y-6 max-w-[1240px] mx-auto pb-12 relative">
      {/* Page Header */}
      <PageHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1329] tracking-tight">{staffOnly ? 'Staff & invitations' : 'Cleaning Schedule'}</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            {staffOnly ? 'Invite staff, manage access and keep contact details current.' : 'Manage daily cleaning tasks and room disinfection.'}
          </p>
        </div>

        {staffOnly ? (<button type="button" className="auth-secondary-button" onClick={() => setShowAddStaffModal(true)}>Invite staff member</button>) : (<div className="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'EXPORTING...' : 'EXPORT'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNewTaskModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>SCHEDULE TASK</span>
          </button>
        </div>)}
      </PageHeader>

      {/* Guidelines Directive Banner */}
      {!staffOnly && (<div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            TODAY'S ACTIVE CLEANING DIRECTIVE
          </p>
          {directiveData?.directive && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              Live on Staff Portals
            </span>
          )}
        </div>

        <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/70 font-medium leading-relaxed">
          {isLoadingDirective ? (
            <span className="text-slate-400">Loading today's active directive...</span>
          ) : directiveData?.directive ? (
            <span>"{directiveData.directive}"</span>
          ) : (
            <span className="text-slate-400 italic">No active cleaning directive for today.</span>
          )}
        </div>

        <form onSubmit={handleBroadcast} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={guidelineInput}
            onChange={(e) => setGuidelineInput(e.target.value)}
            disabled={isBroadcasting}
            placeholder="Type new directive (e.g. Disinfect common study rooms after 11 PM)..."
            className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20 text-slate-800 placeholder:text-slate-400 font-medium disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isBroadcasting || !guidelineInput.trim()}
            className="px-5 py-2.5 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 transition-colors uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isBroadcasting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{isBroadcasting ? 'BROADCASTING...' : 'BROADCAST TO STAFF'}</span>
          </button>
        </form>
      </div>)}

      {isError && (
        <ErrorBanner
          message={getRequestError(error)?.message || 'Failed to load cleaning schedule.'}
          onRetry={refetch}
        />
      )}

      {staffOnly && isStaffLoading && <PageSpinner message="Loading staff..." />}
      {staffOnly && isStaffError && <ErrorBanner message="Unable to load staff accounts." onRetry={refetchStaff} />}
      {/* Main Grid Section */}
      {!(staffOnly && (isStaffLoading || isStaffError)) && (<div className={staffOnly ? "grid grid-cols-1 gap-6 max-w-3xl" : "grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"}>
        {/* Cleaning Tasks (2/3 width) */}
        {!staffOnly && (<div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  CLEANING & SANITATION TASKS
                </span>
                <span className="text-xs text-slate-500 font-semibold">{tasks.length} active assignments</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">Filter:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Tasks</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="InProgress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Delayed">Delayed</option>
                </select>
              </div>
            </div>

            {isLoading ? (
              <PageSpinner message="Loading cleaning tasks..." />
            ) : tasks.length === 0 ? (
              <EmptyState
                title="No Tasks Scheduled"
                description="There are currently no housekeeping tasks in the queue for this filter."
                actionText="Schedule New Task"
                onAction={() => setShowNewTaskModal(true)}
              />
            ) : (
              <ResponsiveTable className="overflow-x-auto scroll-thin">
                <table className="responsive-table w-full text-left border-collapse min-w-[620px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-6">ROOM UNIT</th>
                      <th className="py-3.5 px-6">TASK TYPE</th>
                      <th className="py-3.5 px-6">SCHEDULED TIME</th>
                      <th className="py-3.5 px-6">ASSIGNED STAFF</th>
                      <th className="py-3.5 px-6 text-right">STATUS</th>
                      <th className="py-3.5 px-6 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium">
                    {tasks.map((task) => (
                      <tr key={task._id} className="hover:bg-slate-50/50 transition-colors">
                        <td data-label="Room unit" data-card-primary="true" className="py-4 px-6 font-bold text-[#0b1329]">
                          Room {task.roomId?.roomNumber || '—'}
                          <span className="block text-[10px] font-normal text-slate-400">
                            {task.roomId?.layoutType}
                          </span>
                        </td>
                        <td data-label="Task type" className="py-4 px-6">
                          <span className="font-semibold text-slate-700">{task.taskType}</span>
                        </td>
                        <td data-label="Scheduled time" className="py-4 px-6 text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {task.scheduledTime
                                ? new Date(task.scheduledTime).toLocaleString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Immediate'}
                            </span>
                          </div>
                        </td>
                        <td data-label="Assigned staff" className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-800">
                              {task.assignedStaffId?.name || 'Unassigned'}
                            </span>
                          </div>
                        </td>
                        <td data-label="Status" data-card-status="true" className="py-4 px-6 text-right">
                          {task.status === 'Completed' && (
                            <div className="flex flex-col items-end gap-2">
                              <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">COMPLETED</span>
                              <CleaningAssessmentBadge assessment={task.cleaningAssessment} />
                            </div>
                          )}
                          {task.status === 'InProgress' && (
                            <span className="px-2 py-0.5 text-[9px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 rounded">
                              IN PROGRESS
                            </span>
                          )}
                          {task.status === 'Scheduled' && (
                            <span className="px-2 py-0.5 text-[9px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 rounded">
                              SCHEDULED
                            </span>
                          )}
                          {task.status === 'Delayed' && (
                            <div className="flex flex-col items-end gap-1">
                              <span className="px-2 py-0.5 text-[9px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 rounded">
                                DELAYED
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedDelayedTask(task)}
                                className="text-[10px] font-bold text-rose-600 hover:text-rose-800 underline underline-offset-2 transition-colors cursor-pointer"
                              >
                                View reason
                              </button>
                            </div>
                          )}
                        </td>
                        <td data-label="Actions" data-card-actions="true" className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailTask(task)}
                            title="View Details"
                            aria-label="View Details"
                            className="p-1.5 text-slate-400 hover:text-[#0b1329] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveTable>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Showing {tasks.length} total tasks</span>
          </div>
        </div>)}

        {/* Right Column: Shift Status & Metrics (1/3 width) */}
        <div className="space-y-6">
          {!staffOnly && (<div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              TASK METRICS OVERVIEW
            </p>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xl font-bold text-[#0b1329]">{scheduledCount}</span>
                <span className="block text-[10px] font-medium text-slate-400">Scheduled</span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <span className="text-xl font-bold text-amber-700">{inProgressCount}</span>
                <span className="block text-[10px] font-medium text-amber-600">In Action</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-xl font-bold text-emerald-700">{completedCount}</span>
                <span className="block text-[10px] font-medium text-emerald-600">Done</span>
              </div>
            </div>
          </div>)}

          {staffOnly ? (<div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                ACTIVE STAFF ({activeStaffMembers.length})
              </p>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(true)}
                className="flex items-center gap-1 text-[11px] font-bold text-[#0b1329] hover:text-slate-600 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Staff</span>
              </button>
            </div>
            {staffMembers.length === 0 ? (
              <p className="text-xs text-slate-400">No staff members or pending invitations yet.</p>
            ) : (
              <div className="space-y-2">
                {activeStaffMembers.map((s) => (
                  <div key={s._id} className="flex items-center justify-between gap-2 text-xs p-2 rounded-xl bg-slate-50">
                    <span className="min-w-0 font-semibold text-slate-800 truncate">{s.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        Active
                      </span>
                      <button
                        type="button"
                        onClick={() => openStaffEditor(s)}
                        aria-label={`Edit ${s.name}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:border-slate-300 hover:text-[#0b1329] transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStaffToDelete(s)}
                        aria-label={`Delete ${s.name}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-rose-200 bg-white text-[10px] font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
                {activeStaffMembers.length === 0 && (
                  <p className="text-xs text-slate-500">No staff have activated their accounts yet.</p>
                )}
                {pendingStaffInvites.length > 0 && (
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      Pending Invitations ({pendingStaffInvites.length})
                    </p>
                    {pendingStaffInvites.map((invitation) => (
                      <div
                        key={invitation._id}
                        className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-xs"
                      >
                        <div className="min-w-0 space-y-1">
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold leading-tight text-amber-800">
                            Pending verification
                          </span>
                          <p className="break-words font-semibold leading-snug text-slate-800">{invitation.name}</p>
                          <p className="break-all text-[11px] leading-snug text-slate-500">{invitation.email}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => openInvitationEditor(invitation)}
                            disabled={isUpdatingInvitation || isResendingInvitation || isCancelingInvitation}
                            className="flex min-w-0 w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-1.5 text-center text-[9px] font-bold leading-tight text-slate-700 hover:border-slate-300 disabled:opacity-50"
                          >
                            <Pencil className="h-3 w-3" />
                            Correct email
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResendInvitation(invitation)}
                            disabled={isUpdatingInvitation || isResendingInvitation || isCancelingInvitation}
                            className="flex min-w-0 w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-1.5 text-center text-[9px] font-bold leading-tight text-slate-700 hover:border-slate-300 disabled:opacity-50"
                          >
                            <Mail className="h-3 w-3" />
                            {isResendingInvitation ? 'Sending…' : 'Resend code'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setInvitationToCancel(invitation)}
                            disabled={isUpdatingInvitation || isResendingInvitation || isCancelingInvitation}
                            className="flex min-w-0 w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-rose-200 bg-white px-1 py-1.5 text-center text-[9px] font-bold leading-tight text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>) : (<div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3"><h2>Staff management</h2><p className="text-sm text-slate-600">{activeStaffMembers.length} active accounts and {pendingStaffInvites.length} pending invitations.</p><Link to="/staff" className="auth-link">Manage staff & invitations</Link></div>)}
        </div>
      </div>)}

      {/* Schedule Task Modal */}
      <Modal
        isOpen={showNewTaskModal}
        onClose={() => setShowNewTaskModal(false)}
        title="Schedule Housekeeping Task"
        description="Assign a room sanitation ticket to a staff member."
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label htmlFor="staff-schedule-form-1" className="block text-xs font-bold text-slate-700 mb-1">
              Select Room <span className="text-rose-500">*</span>
            </label>
            <select id="staff-schedule-form-1"
              required
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
            >
              <option value="">Choose a room...</option>
              {rooms.map((r) => (
                <option key={r._id} value={r._id}>
                  Room {r.roomNumber} ({r.layoutType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="staff-schedule-form-2" className="block text-xs font-bold text-slate-700 mb-1">
              Assign Staff Member <span className="text-rose-500">*</span>
            </label>
            <select id="staff-schedule-form-2"
              required
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
            >
              <option value="">Choose an employee...</option>
              {activeStaffMembers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="staff-schedule-form-3" className="block text-xs font-bold text-slate-700 mb-1">Task Type</label>
              <select id="staff-schedule-form-3"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as TaskType)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
              >
                <option value="Routine">Routine Cleaning</option>
                <option value="DeepClean">Deep Clean</option>
                <option value="Emergency">Emergency Sanitization</option>
              </select>
            </div>

            <div>
              <label htmlFor="staff-schedule-form-4" className="block text-xs font-bold text-slate-700 mb-1">Scheduled Time</label>
              <input id="staff-schedule-form-4"
                type="datetime-local"
                required
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowNewTaskModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAssigning || !selectedRoomId || !selectedStaffId}
              className="px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 disabled:opacity-75 flex items-center gap-1.5"
            >
              {isAssigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Schedule Task</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Staff Modal */}
      <Modal
        isOpen={showAddStaffModal}
        onClose={() => setShowAddStaffModal(false)}
        title="Invite Cleaning Staff Member"
        description="Send an email verification code. The staff member will set their own password in the mobile app."
      >
        <form onSubmit={handleCreateStaff} className="space-y-4">
          <div>
            <label htmlFor="staff-schedule-form-5" className="block text-xs font-bold text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input id="staff-schedule-form-5"
              type="text"
              required
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="e.g. Tariq Ahmed"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20"
            />
          </div>

          <div>
            <label htmlFor="staff-schedule-form-6" className="block text-xs font-bold text-slate-700 mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input id="staff-schedule-form-6"
              type="email"
              required
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              placeholder="example@gmail.com"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20"
            />
          </div>

          <PhoneInputWithCountry
            label="Phone Number"
            optional
            value={staffPhone}
            country={staffCountry}
            onChangeNumber={(val) => {
              setStaffPhone(val);
              if (staffPhoneError) setStaffPhoneError(null);
            }}
            onSelectCountry={setStaffCountry}
            error={staffPhoneError}
            showValidBadge
            helperText="Stored in international E.164 format (e.g. +923012345678)."
          />

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowAddStaffModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingStaff}
              className="px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 disabled:opacity-75 flex items-center gap-1.5"
            >
              {isCreatingStaff && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Send Invite</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Correct Pending Staff Invitation */}
      <Modal
        isOpen={Boolean(invitationToEdit)}
        onClose={() => setInvitationToEdit(null)}
        title="Correct Invitation Email"
        description={invitationToEdit?.name}
        maxWidth="sm"
      >
        {invitationToEdit && (
          <form onSubmit={handleUpdateInvitationEmail} className="space-y-4">
            <div>
              <label htmlFor="staff-schedule-form-7" className="mb-1 block text-xs font-bold text-slate-700">
                Correct Email Address <span className="text-rose-500">*</span>
              </label>
              <input id="staff-schedule-form-7"
                type="email"
                required
                value={invitationEmail}
                onChange={(event) => setInvitationEmail(event.target.value)}
                placeholder="example@gmail.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20"
              />
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                The old code will stop working. A fresh verification code will be sent to this address.
              </p>
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInvitationToEdit(null)}
                disabled={isUpdatingInvitation}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isUpdatingInvitation ||
                  isResendingInvitation ||
                  isCancelingInvitation ||
                  !invitationEmail.trim() ||
                  invitationEmail.trim().toLowerCase() === invitationToEdit.email.toLowerCase()
                }
                className="flex items-center gap-1.5 rounded-xl bg-[#0b1329] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {isUpdatingInvitation && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Email & Send Code
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Cancel Pending Staff Invitation */}
      <Modal
        isOpen={Boolean(invitationToCancel)}
        onClose={() => setInvitationToCancel(null)}
        title="Cancel Staff Invitation"
        description={invitationToCancel?.name}
        maxWidth="sm"
      >
        {invitationToCancel && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-900">Cancel this pending invitation?</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">
                The pending account for {invitationToCancel.email} will be removed. You can invite the correct address afterward.
              </p>
            </div>
            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setInvitationToCancel(null)}
                disabled={isCancelingInvitation}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Keep Invitation
              </button>
              <button
                type="button"
                onClick={handleCancelInvitation}
                disabled={isCancelingInvitation || isUpdatingInvitation || isResendingInvitation}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {isCancelingInvitation && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Cancel Invitation
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        isOpen={Boolean(selectedStaff)}
        onClose={closeStaffEditor}
        title="Edit Cleaning Staff"
        description={selectedStaff?.name}
        maxWidth="sm"
      >
        {selectedStaff && (
          <form onSubmit={handleUpdateStaff} className="space-y-4">
            <div>
              <label htmlFor="staff-schedule-form-8" className="block text-xs font-bold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input id="staff-schedule-form-8"
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={staffEditName}
                onChange={(e) => setStaffEditName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20"
              />
            </div>

            <PhoneInputWithCountry
              label="Phone Number"
              optional
              value={staffEditPhone}
              country={staffEditCountry}
              onChangeNumber={(value) => {
                setStaffEditPhone(value);
                if (staffEditPhoneError) setStaffEditPhoneError(null);
              }}
              onSelectCountry={setStaffEditCountry}
              error={staffEditPhoneError}
              helperText="Leave blank to clear the phone number."
            />

            <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              Login email: <span className="font-semibold text-slate-700">{selectedStaff.email}</span>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={closeStaffEditor}
                disabled={isUpdatingStaff}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingStaff || isDeletingStaff || !staffEditName.trim()}
                className="px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 disabled:opacity-60 flex items-center gap-1.5"
              >
                {isUpdatingStaff && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Staff Confirmation Modal */}
      <Modal
        isOpen={Boolean(staffToDelete)}
        onClose={() => setStaffToDelete(null)}
        title="Delete Cleaning Staff"
        description={staffToDelete?.name}
        maxWidth="sm"
      >
        {staffToDelete && (
          <div className="space-y-4">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-bold text-rose-800">Remove {staffToDelete.name}?</p>
              <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                They will lose access and disappear from the available staff list. Their past task records will be kept.
              </p>
              <p className="text-[11px] text-rose-700 mt-2 leading-relaxed">
                Reassign or complete any unfinished tasks before removing them.
              </p>
            </div>
            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                disabled={isDeletingStaff}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStaff}
                disabled={isDeletingStaff || isUpdatingStaff}
                className="px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-60 flex items-center gap-1.5"
              >
                {isDeletingStaff && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delay Reason Modal */}
      <Modal
        isOpen={Boolean(selectedDelayedTask)}
        onClose={() => setSelectedDelayedTask(null)}
        title="Delayed Task"
        description="Reported obstruction preventing staff from completing cleaning on schedule."
        maxWidth="sm"
      >
        {selectedDelayedTask && (
          <div className="space-y-4 pt-1">
            <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Room:</span>
                <span className="font-bold text-[#0b1329]">
                  Room {selectedDelayedTask.roomId?.roomNumber || '—'}
                  {selectedDelayedTask.roomId?.layoutType ? ` (${selectedDelayedTask.roomId.layoutType})` : ''}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Task Type:</span>
                <span className="font-semibold text-slate-800">{selectedDelayedTask.taskType}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Assigned Staff:</span>
                <span className="font-semibold text-slate-800">
                  {selectedDelayedTask.assignedStaffId?.name || 'Unassigned'}
                </span>
              </div>

              {selectedDelayedTask.updatedAt && (
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Reported At:</span>
                  <span className="text-slate-600 font-medium">
                    {new Date(selectedDelayedTask.updatedAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                REASON FOR DELAY
              </p>
              <div className="p-3.5 bg-rose-50/60 border border-rose-200/80 rounded-xl">
                <p className="text-xs text-rose-950 font-medium leading-relaxed break-words">
                  {selectedDelayedTask.delayReason && selectedDelayedTask.delayReason.trim().length > 0
                    ? selectedDelayedTask.delayReason.trim()
                    : 'No delay reason was provided.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDelayedTask(null)}
                className="px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cleaning Task Details Modal */}
      <Modal
        isOpen={Boolean(selectedDetailTask)}
        onClose={() => setSelectedDetailTask(null)}
        title="Cleaning Task Details"
        description="Comprehensive task status, room details, timeline, and photo proof-of-work."
        maxWidth="2xl"
      >
        {selectedDetailTask && (
          <div className="space-y-5 pt-1">
            {/* 1. Overview Card */}
            <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    ROOM UNIT & LAYOUT
                  </span>
                  <h4 className="text-base font-bold text-[#0b1329] mt-0.5">
                    Room {selectedDetailTask.roomId?.roomNumber || '—'}
                    {selectedDetailTask.roomId?.layoutType ? (
                      <span className="text-xs font-normal text-slate-500 ml-2">
                        ({selectedDetailTask.roomId.layoutType})
                      </span>
                    ) : null}
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-bold bg-white text-slate-700 border border-slate-200 rounded-lg shadow-2xs">
                    {selectedDetailTask.taskType} Cleaning
                  </span>
                  {selectedDetailTask.status === 'Completed' && (
                    <span className="px-2.5 py-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
                      COMPLETED
                    </span>
                  )}
                  {selectedDetailTask.status === 'InProgress' && (
                    <span className="px-2.5 py-1 text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg">
                      IN PROGRESS
                    </span>
                  )}
                  {selectedDetailTask.status === 'Scheduled' && (
                    <span className="px-2.5 py-1 text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 rounded-lg">
                      SCHEDULED
                    </span>
                  )}
                  {selectedDetailTask.status === 'Delayed' && (
                    <span className="px-2.5 py-1 text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg">
                      DELAYED
                    </span>
                  )}
                </div>
              </div>

              {/* Staff Details */}
              <div className="pt-2.5 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Assigned Cleaner</span>
                  <div className="flex items-center gap-1.5 mt-0.5 font-semibold text-slate-800">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{selectedDetailTask.assignedStaffId?.name || 'Unassigned'}</span>
                  </div>
                </div>

                {selectedDetailTask.assignedStaffId?.email ? (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Cleaner Email</span>
                    <div className="flex items-center gap-1.5 mt-0.5 text-slate-600 font-medium">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{selectedDetailTask.assignedStaffId.email}</span>
                    </div>
                  </div>
                ) : null}

                {selectedDetailTask.assignedStaffId?.phone ? (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Cleaner Phone</span>
                    <div className="flex items-center gap-1.5 mt-0.5 text-slate-600 font-medium">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{formatPhoneDisplay(selectedDetailTask.assignedStaffId.phone)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* 2. Timeline Grid */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                TASK TIMELINE
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Scheduled
                  </span>
                  <p className="font-semibold text-slate-800 mt-1">
                    {selectedDetailTask.scheduledTime
                      ? new Date(selectedDetailTask.scheduledTime).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Immediate'}
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Started
                  </span>
                  <p className="font-semibold text-slate-800 mt-1">
                    {selectedDetailTask.startedAt
                      ? new Date(selectedDetailTask.startedAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Not started yet'}
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Completed
                  </span>
                  <p className="font-semibold text-slate-800 mt-1">
                    {selectedDetailTask.completedAt
                      ? new Date(selectedDetailTask.completedAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : selectedDetailTask.status === 'Completed'
                      ? 'Completed'
                      : 'Not completed yet'}
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Created</span>
                  <p className="font-semibold text-slate-600 mt-1">
                    {selectedDetailTask.createdAt
                      ? new Date(selectedDetailTask.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Last Updated</span>
                  <p className="font-semibold text-slate-600 mt-1">
                    {selectedDetailTask.updatedAt
                      ? new Date(selectedDetailTask.updatedAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Reason for Delay (if Delayed or delayReason exists) */}
            {(selectedDetailTask.status === 'Delayed' ||
              (selectedDetailTask.delayReason && selectedDetailTask.delayReason.trim().length > 0)) && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  REASON FOR DELAY
                </p>
                <div className="p-3.5 bg-rose-50/60 border border-rose-200/80 rounded-xl">
                  <p className="text-xs text-rose-950 font-medium leading-relaxed break-words">
                    {selectedDetailTask.delayReason && selectedDetailTask.delayReason.trim().length > 0
                      ? selectedDetailTask.delayReason.trim()
                      : 'No delay reason was provided.'}
                  </p>
                </div>
              </div>
            )}

            {/* 4. Staff Notes */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                STAFF NOTES
              </p>
              {selectedDetailTask.staffNotes && selectedDetailTask.staffNotes.trim().length > 0 ? (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs text-slate-800 font-medium leading-relaxed whitespace-pre-wrap break-words">
                    {selectedDetailTask.staffNotes.trim()}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-slate-50/60 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs text-slate-400 italic">No notes added.</p>
                </div>
              )}
            </div>

            {/* 5. Proof of Work (Before & After Photos) */}
            {selectedDetailTask.status === 'Completed' && (
              <div className="space-y-2">
                {isDetailError && <p role="alert" className="text-xs text-amber-700">Could not refresh this task. Showing the last available details.</p>}
                <CleaningAssessmentPanel assessment={selectedDetailTask.cleaningAssessment} onRefresh={() => { void refetchDetail(); }} refreshing={isDetailFetching} />
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                  PROOF OF WORK
                </p>
                <span className="text-[11px] text-slate-400 font-medium">Click photo to view larger preview</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Before Cleaning */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 block">Before Cleaning</span>
                  {selectedDetailTask.beforeImageUri ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewImage({
                          url: selectedDetailTask.beforeImageUri!,
                          title: `Before Cleaning Photo — Room ${selectedDetailTask.roomId?.roomNumber || ''}`,
                        })
                      }
                      className="group relative w-full h-48 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 block cursor-pointer transition-all hover:shadow-md hover:border-slate-300"
                    >
                      <img
                        src={selectedDetailTask.beforeImageUri}
                        alt="Before Cleaning"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                        <ZoomIn className="w-4 h-4" />
                        <span>Enlarge Photo</span>
                      </div>
                    </button>
                  ) : (
                    <div className="w-full h-48 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
                      <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-xs font-semibold text-slate-600">No before photo uploaded</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Required when cleaner begins room sanitation
                      </p>
                    </div>
                  )}
                </div>

                {/* After Cleaning */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 block">After Cleaning</span>
                  {selectedDetailTask.afterImageUri ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewImage({
                          url: selectedDetailTask.afterImageUri!,
                          title: `After Cleaning Photo — Room ${selectedDetailTask.roomId?.roomNumber || ''}`,
                        })
                      }
                      className="group relative w-full h-48 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 block cursor-pointer transition-all hover:shadow-md hover:border-slate-300"
                    >
                      <img
                        src={selectedDetailTask.afterImageUri}
                        alt="After Cleaning"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                        <ZoomIn className="w-4 h-4" />
                        <span>Enlarge Photo</span>
                      </div>
                    </button>
                  ) : (
                    <div className="w-full h-48 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
                      <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-xs font-semibold text-slate-600">No after photo uploaded</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Required to verify completed room sanitation
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedDetailTask(null)}
                className="px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
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
          <div className="relative z-10 max-w-4xl max-h-[90vh] bg-white rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
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

      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
