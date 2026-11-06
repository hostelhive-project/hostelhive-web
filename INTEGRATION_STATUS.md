# HostelHive Web — Backend Integration Status (Redux Toolkit + RTK Query)

This document tracks the integration status of the `hostelhive-web` Admin dashboard with the `hostelhive-backend` REST API.

---

## 1. Architecture Overview

- **State Management**: Redux Toolkit + RTK Query (`@reduxjs/toolkit`, `react-redux`).
- **Base Query**: Custom `axiosBaseQuery` wrapped over `axios` in [`src/features/api/baseApi.ts`](file:///d:/HostelHive%20FYP/hostelhive-project/hostelhive-web/src/features/api/baseApi.ts):
  - Uses `VITE_API_BASE_URL` from `.env` (defaults to `http://localhost:5000/api`).
  - Automatically attaches `Authorization: Bearer <token>` from `localStorage.getItem('token')`.
  - Unwraps the backend `{ success: true, data: ... }` envelope so RTK Query hooks receive pure entity data directly.
  - Intercepts HTTP 401 unauthorized errors, clears credentials from `localStorage`, and cleanly redirects to `/login`.
- **Auth Credentials & Token Storage**:
  - Tokens (`token`, `refreshToken`) reside strictly in `localStorage` (never placed in Redux state or DevTools).
  - [`authSlice.ts`](file:///d:/HostelHive%20FYP/hostelhive-project/hostelhive-web/src/features/auth/authSlice.ts) holds `{ user: User | null, isAuthenticated: boolean }` and optimistically rehydrates on app boot from `localStorage.getItem('user')` to prevent login flashes.
  - Route protection is managed by [`RequireAuth.tsx`](file:///d:/HostelHive%20FYP/hostelhive-project/hostelhive-web/src/context/RequireAuth.tsx), wrapping the protected layout in [`App.tsx`](file:///d:/HostelHive%20FYP/hostelhive-project/hostelhive-web/src/App.tsx).

---

## 2. RTK Query API Endpoints

The API is structured with `injectEndpoints` on `baseApi`:

| API Slice | Endpoints | Method & URL | Cache Tags |
| :--- | :--- | :--- | :--- |
| **`authApi`** | `login`<br>`register`<br>`logout`<br>`getCurrentUser`<br>`refreshToken` | `POST /auth/login`<br>`POST /auth/register`<br>`POST /auth/logout`<br>`GET /auth/me`<br>`POST /auth/refresh` | Inval: `['User', 'DashboardSummary']`<br>Prov: `['User']` |
| **`userApi`** | `getUserById`<br>`updateProfile`<br>`listStaffForHostel` | `GET /users/:id`<br>`PUT /users/:id`<br>`GET /users/hostel/:hostelId/staff` | Prov: `[{ type: 'User', id }]`<br>Inval: `['User']` |
| **`hostelApi`** | `getHostelById`<br>`createHostel`<br>`updateHostel`<br>`getChatbotInfo`<br>`updateChatbotInfo`<br>`getStripeOnboardLink`<br>`getStripeStatus` | `GET /hostels/:id`<br>`POST /hostels`<br>`PUT /hostels/:id`<br>`GET /hostels/:hostelId/chatbot-info`<br>`PUT /hostels/:hostelId/chatbot-info`<br>`GET /hostels/:hostelId/stripe/onboard`<br>`GET /hostels/:hostelId/stripe/status` | Prov: `['Hostel']`<br>Inval: `['Hostel', 'User', 'DashboardSummary']` |
| **`roomApi`** | `listRooms`<br>`getRoomById`<br>`createRoom`<br>`updateRoom`<br>`updateRoomStatus`<br>`deleteRoom` | `GET /hostels/:hostelId/rooms`<br>`GET /rooms/:id`<br>`POST /hostels/:hostelId/rooms`<br>`PUT /rooms/:id`<br>`PATCH /rooms/:id/status`<br>`DELETE /rooms/:id` | Prov: `['Room']`<br>Inval: `['Room', 'DashboardSummary']` |
| **`bookingApi`** | `listBookingsForHostel`<br>`listPendingBookings`<br>`listResidentsForHostel`<br>`getBookingById`<br>`approveBooking`<br>`rejectBooking`<br>`checkInBooking` | `GET /bookings/hostel/:hostelId`<br>`GET /bookings/hostel/:hostelId/pending`<br>`GET /bookings/hostel/:hostelId/residents`<br>`GET /bookings/:id`<br>`PATCH /bookings/:id/approve`<br>`PATCH /bookings/:id/reject`<br>`PATCH /bookings/:id/checkin` | Prov: `['Booking']`<br>Inval: `['Booking', 'Room', 'DashboardSummary']` |
| **`invoiceApi`** | `listInvoicesForHostel`<br>`getInvoiceById`<br>`listInvoicesForBooking`<br>`markInvoicePaid`<br>`generateInvoiceForBooking`<br>`generateAllInvoices` | `GET /invoices/hostel/:hostelId`<br>`GET /invoices/:id`<br>`GET /invoices/booking/:bookingId`<br>`PATCH /invoices/:id/mark-paid`<br>`POST /invoices/booking/:bookingId/generate`<br>`POST /invoices/generate-all` | Prov: `['Invoice']`<br>Inval: `['Invoice', 'DashboardSummary']` |
| **`paymentApi`** | `getPaymentById`<br>`listPaymentsForInvoice` | `GET /payments/:id`<br>`GET /payments/invoice/:invoiceId` | Prov: `['Payment']` |
| **`complaintApi`** | `listComplaints`<br>`getComplaintById`<br>`assignComplaint`<br>`updateComplaintStatus` | `GET /complaints`<br>`GET /complaints/:id`<br>`PATCH /complaints/:id/assign`<br>`PATCH /complaints/:id/status` | Prov: `['Complaint']`<br>Inval: `['Complaint', 'DashboardSummary']` |
| **`taskApi`** | `listCleaningTasksForHostel`<br>`getCleaningTaskById`<br>`assignCleaningTask` | `GET /cleaning-tasks/hostel/:hostelId`<br>`GET /cleaning-tasks/:id`<br>`POST /cleaning-tasks` | Prov: `['Task']`<br>Inval: `['Task', 'DashboardSummary']` |
| **`dashboardApi`** | `getDashboardSummary`<br>`getRecentActivity` | `GET /admin/dashboard/summary`<br>`GET /admin/dashboard/recent-activity` | Prov: `['DashboardSummary']` |
| **`blockchainApi`** | `verifyRecord` | `GET /blockchain/:sourceType/:sourceId/verify` | Direct verification |

---

## 3. RTK Query Cache Invalidation Matrix

Cross-resource synchronization ensures metrics and views remain immediately consistent:

| Mutation Action | Cache Invalidation Triggers |
| :--- | :--- |
| **Approve / Reject Booking** | Invalidates `Booking` (pending/all lists), `Room` (occupancy counts), `DashboardSummary` (occupancy rate %). |
| **Check-in Booking** | Invalidates `Booking` (moves to active directory), `DashboardSummary`. |
| **Mark Invoice Paid** | Invalidates `Invoice` (status update), `DashboardSummary` (rent collected updates). |
| **Generate Invoices** | Invalidates `Invoice` (new invoices in ledger), `DashboardSummary`. |
| **Assign / Update Complaint** | Invalidates `Complaint` (complaint desk lists), `DashboardSummary` (open complaints count). |
| **Create / Delete Room** | Invalidates `Room` (room inventory list), `DashboardSummary` (room count & capacity). |
| **Assign Cleaning Task** | Invalidates `Task` (cleaning schedule list), `DashboardSummary` (active staff on task). |
| **Update Hostel / Chatbot** | Invalidates `Hostel` (property card & details), `DashboardSummary`. |

---

## 4. Page Integration Status

| Page | File | Integrated Features |
| :--- | :--- | :--- |
| **Login** | [`AdminLoginPage.tsx`](file:///d:/HostelHive%20FYP/hostelhive-project/hostelhive-web/src/pages/AdminLoginPage.tsx) | `useLoginMutation`, token & user rehydration, real backend error alerts. |
| **Register** | [`AdminRegisterPage.tsx`](file:///d:/HostelHive%20FYP/hostelhive-project/hostelhive-web/src/pages/AdminRegisterPage.tsx) | `useRegisterMutation`, auto-login upon creation, redirect to onboarding. |
| **Dashboard** | [`DashboardPage.tsx`](file:///d:/HostelHive%20FYP/hostelhive-project/hostelhive-web/src/pages/DashboardPage.tsx) | `useGetDashboardSummaryQuery`, `useGetRecentActivityQuery`, unassigned hostel onboarding card. |
| **Hostel Registration** | [`HostelRegistrationPage.tsx`](file:///d:/HostelHive%20FYP/hostelhive-project/hostelhive-web/src/pages/HostelRegistrationPage.tsx) | `useCreateHostelMutation`, `useUpdateHostelMutation`, `useUpdateChatbotInfoMutation`, Stripe Connect onboarding link. |
| **Room Allocation** | [`RoomAllocationPage.tsx`](file:///d:/HostelHive%20FYP/hostelhive-project/hostelhive-web/src/pages/RoomAllocationPage.tsx) | `useListRoomsQuery`, `useCreateRoomMutation`, `useUpdateRoomStatusMutation`, `useDeleteRoomMutation`, `useListPendingBookingsQuery`, `useApproveBookingMutation`, `useRejectBookingMutation`. |
| **Residents** | [`ResidentsPage.tsx`](file:///d:/HostelHive%20FYP/hostelhive-project/hostelhive-web/src/pages/ResidentsPage.tsx) | `useListResidentsForHostelQuery`, `useCheckInBookingMutation`, student profile inspection modal. |
| **Complaints Desk** | [`ComplaintDeskPage.tsx`](file:///d:/HostelHive%20FYP/hostelhive-project/hostelhive-web/src/pages/ComplaintDeskPage.tsx) | `useListComplaintsQuery`, `useUpdateComplaintStatusMutation`, `useAssignComplaintMutation`, `useLazyVerifyRecordQuery` for blockchain proof. |
| **Rent Ledger** | [`RentLedgerPage.tsx`](file:///d:/HostelHive%20FYP/hostelhive-project/hostelhive-web/src/pages/RentLedgerPage.tsx) | `useListInvoicesForHostelQuery`, `useMarkInvoicePaidMutation`, `useGenerateAllInvoicesMutation`, `useGenerateInvoiceForBookingMutation`, CSV export. |
| **Cleaning Schedule** | [`CleaningSchedulePage.tsx`](file:///d:/HostelHive%20FYP/hostelhive-project/hostelhive-web/src/pages/CleaningSchedulePage.tsx) | `useListCleaningTasksForHostelQuery`, `useAssignCleaningTaskMutation`, dynamic room and staff dropdowns. |
| **Profile Settings** | [`AdminProfilePage.tsx`](file:///d:/HostelHive%20FYP/hostelhive-project/hostelhive-web/src/pages/AdminProfilePage.tsx) | `useGetUserByIdQuery`, `useUpdateProfileMutation`, `useGetHostelByIdQuery`. |

> **Scope Note**: Attendance and shift management are outside the current scope of HostelHive. CleaningStaff workflow is strictly centered on assigned cleaning tasks, task lifecycle updates, proof-of-work photos, and operational notifications.

---

## 5. Verification & Build Integrity

- **TypeScript Compilation (`npx tsc -b`)**: Exit code 0 (zero errors, strict `noUnusedLocals` and `verbatimModuleSyntax` compliant).
- **Production Build (`npm run build`)**: Exit code 0 (Vite built 1,948 modules, production chunks rendered to `dist/`).
