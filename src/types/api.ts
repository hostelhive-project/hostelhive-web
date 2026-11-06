export type Role = 'Student' | 'Admin' | 'CleaningStaff';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified?: boolean;
  phone?: string;
  residentCode?: string | null;
  profileImageUrl?: string | null;
  hostelId?: string | null;
  isActive?: boolean;
  deviceToken?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

export interface RegistrationPendingResponse {
  email: string;
  requiresEmailVerification: true;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role?: Role;
  phone?: string;
  hostelId?: string;
}

export interface CreateStaffPayload {
  name: string;
  email: string;
  phone?: string;
}

export interface UpdateStaffPayload {
  name?: string;
  phone?: string | null;
}

export interface PropertyInfo {
  gateOpenTime?: string;
  gateCloseTime?: string;
  houseRules?: string[];
  receptionContact?: string;
  nearbyLandmarks?: string;
}

export interface ChatbotInfo {
  wifiPassword?: string;
  emergencyContact?: string;
  additionalInfo?: string;
  checkInTime?: string;
  checkOutTime?: string;
  rules?: string[];
  contactNumber?: string;
  nearbyLandmarks?: string;
  updatedAt?: string | null;
}

export interface Hostel {
  publicationStatus?: 'Draft' | 'Published';
  _id: string;
  name: string;
  location: string;
  priceTier: number;
  facilities: string[];
  bannerImage?: string;
  images?: string[];
  propertyInfo?: PropertyInfo;
  ratingAvg?: number;
  reviewCount?: number;
  ownerAdminId?: string | User;
  stripeAccountId?: string | null;
  stripeOnboardingComplete?: boolean;
  chatbotInfo?: ChatbotInfo;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateHostelPayload {
  publicationStatus?: 'Draft' | 'Published';
  name: string;
  location: string;
  priceTier: number;
  facilities?: string[];
  bannerImage?: string;
  images?: string[];
  propertyInfo?: PropertyInfo;
}

export type RoomLayout = 'Single' | 'Shared-2' | 'Shared-4';

export interface Room {
  _id: string;
  hostelId: string | Hostel;
  roomNumber: string;
  layoutType: RoomLayout;
  capacity: number;
  occupiedCount: number;
  isLocked: boolean;
  uiColorTag?: string;
  monthlyRent?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateRoomPayload {
  roomNumber: string;
  layoutType: RoomLayout;
  capacity: number;
  monthlyRent?: number | null;
}

export interface UpdateRoomStatusPayload {
  isLocked?: boolean;
  uiColorTag?: string;
}

export type BookingStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'CheckedIn' | 'CheckedOut';

export interface Booking {
  _id: string;
  studentId: User;
  roomId: Room;
  status: BookingStatus;
  bookingDate?: string;
  emergencyContact?: string;
  cnicFrontUrl?: string;
  cnicBackUrl?: string;
  termsAcceptedAt?: string;
  rejectionReason?: string | null;
  monthlyRent?: number | null;
  approvedAt?: string | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  residentCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = 'Unpaid' | 'PartiallyPaid' | 'Paid' | 'Overdue';

export interface Invoice {
  _id: string;
  bookingId: string | Booking;
  billingMonth: string;
  rentAmount: number;
  totalDue: number;
  status: InvoiceStatus;
  refundedAmount?: number;
  disputeStatus?: string | null;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  booking?: {
    _id: string;
    student?: User;
    roomNumber?: string;
  } | null;
}

export type PaymentStatus = 'Unpaid' | 'Paid' | 'Processing' | 'Failed';
export type PaymentMethod = 'Card' | 'Cash' | 'BankTransfer' | 'JazzCash' | 'EasyPaisa';

export interface Payment {
  _id: string;
  invoiceId: string | Invoice;
  hostelId: string | Hostel;
  amount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  stripeAccountId: string | null;
  refundedAmount?: number;
  disputedAmount?: number;
  disputeLossAmount?: number;
  disputeStatus?: string | null;
  recordedBy?: string | null;
  transactionReference?: string;
  transactionDate?: string;
  blockchainRef?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SeverityTier = 'Low' | 'Medium' | 'High' | 'Critical';
export type ComplaintStatus = 'Submitted' | 'InReview' | 'AwaitingAdminVerification' | 'Resolved';

export interface Complaint {
  _id: string;
  residentId: User;
  hostelId?: string | Hostel;
  roomId?: string | { _id: string; roomNumber: string; floor?: string; layoutType?: string } | null;
  roomNumberAtSubmission?: string | null;
  assignedStaffId?: User | null;
  title?: string;
  category?: string;
  description: string;
  photoUrls?: string[];
  severityTier: SeverityTier;
  status: ComplaintStatus;
  statusHistory?: Array<{
    status: ComplaintStatus;
    changedBy: string;
    changedAt: string;
  }>;
  repairNote?: string;
  repairProofImageUrl?: string | null;
  residentConfirmedAt?: string | null;
  blockchainRef?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskType = 'Routine' | 'DeepClean' | 'Emergency';
export type TaskStatus = 'Scheduled' | 'InProgress' | 'Completed' | 'Delayed';

export interface CleaningAssessment {
  status: 'Pending' | 'Processing' | 'Assessed' | 'ManualReview' | 'Unavailable';
  score: number | null;
  breakdown?: { waste: number | null; floor: number | null; surfaces: number | null; tidiness: number | null } | null;
  estimated?: boolean;
  imageQuality?: 'Good' | 'Limited' | 'Unusable' | null;
  evidenceCoverage?: number | null;
  comparison?: 'Improved' | 'Similar' | 'Worse' | 'Unclear';
  summary?: string;
  improvements?: string[];
  issues?: string[];
  limitations?: string[];
  reason?: string | null;
  model?: string;
  assessedAt?: string | null;
}

export interface CleaningTask {
  _id: string;
  roomId: Room;
  assignedStaffId: User;
  taskType: TaskType;
  status: TaskStatus;
  scheduledTime: string;
  startedAt?: string | null;
  completedAt?: string | null;
  staffNotes?: string;
  beforeImageUri?: string | null;
  afterImageUri?: string | null;
  uiStatusBadgeColor?: string;
  delayReason?: string | null;
  cleaningAssessment?: CleaningAssessment;
  createdAt: string;
  updatedAt: string;
}

export interface CleaningDirectiveResponse {
  directive: string | null;
  rawDirective?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
  isToday?: boolean;
}

export interface BroadcastDirectiveResponse {
  directive: string;
  recipientCount: number;
  message: string;
}

export interface DashboardSummary {
  rentCollectedThisMonth: number;
  occupancy: {
    occupied: number;
    capacity: number;
    percent: number;
  };
  openComplaints: number;
  staff: {
    total: number;
    currentlyOnTask: number;
  };
  roomCount: number;
}

export interface DashboardRecentActivity {
  recentBookings: Array<{
    _id: string;
    status: BookingStatus;
    updatedAt: string;
    studentId:
      | string
      | {
          _id: string;
          name?: string;
          email?: string;
          phone?: string;
          residentCode?: string;
        };
    roomId:
      | string
      | {
          _id: string;
          roomNumber?: string;
          layoutType?: string;
        };
    residentCode?: string | null;
  }>;
  recentComplaints: Array<{
    _id: string;
    status: ComplaintStatus;
    severityTier: SeverityTier;
    updatedAt: string;
    description: string;
  }>;
}

export interface BlockchainVerifyResponse {
  hash: string;
  blockRef: string;
  network: string;
  explorerUrl: string | null;
  status?: 'Pending' | 'Confirmed' | 'Simulated';
  sourceMatches?: boolean;
  snapshotMatches?: boolean | null;
  onChainVerified?: boolean;
  verificationState?: 'Verified' | 'Simulated' | 'Pending' | 'Unavailable' | 'Mismatch';
}
