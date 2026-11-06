import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route, Navigate } from 'react-router-dom';

// Layout
import DashboardLayout from './layouts/DashboardLayout';
import RequireAuth from './context/RequireAuth';

// Auth Pages
import AdminLoginPage from './pages/AdminLoginPage';
import AdminRegisterPage from './pages/AdminRegisterPage';
import LegalDocumentPage from './pages/LegalDocumentPage';

// Workspace Modules
import DashboardPage from './pages/DashboardPage';
import HostelRegistrationPage from './pages/HostelRegistrationPage';
import RoomAllocationPage from './pages/RoomAllocationPage';
import ResidentsPage from './pages/ResidentsPage';
import ComplaintDeskPage from './pages/ComplaintDeskPage';
import RentLedgerPage from './pages/RentLedgerPage';
import CleaningSchedulePage from './pages/CleaningSchedulePage';
import StaffPage from './pages/StaffPage';
import AdminProfilePage from './pages/AdminProfilePage';

// Stripe Connect callback pages (standalone — no DashboardLayout chrome)
import StripeCompletePage from './pages/StripeCompletePage';
import StripeRefreshPage from './pages/StripeRefreshPage';

const router = createBrowserRouter(createRoutesFromElements(
      <>
        {/* Auth Routes */}
        <Route path="/login" element={<AdminLoginPage />} />
        <Route path="/register" element={<AdminRegisterPage />} />
        <Route path="/legal/:kind" element={<LegalDocumentPage />} />

        {/* Stripe Connect Callback Routes — protected but no DashboardLayout */}
        <Route
          path="/admin/stripe/complete"
          element={
            <RequireAuth>
              <StripeCompletePage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/stripe/refresh"
          element={
            <RequireAuth>
              <StripeRefreshPage />
            </RequireAuth>
          }
        />

        {/* Dashboard Protected Routes */}
        <Route
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/hostel-reg" element={<HostelRegistrationPage />} />
          <Route path="/rooms" element={<RoomAllocationPage />} />
          <Route path="/residents" element={<ResidentsPage />} />
          <Route path="/complaints" element={<ComplaintDeskPage />} />
          <Route path="/payments" element={<RentLedgerPage />} />
          <Route path="/cleaning" element={<CleaningSchedulePage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/profile" element={<AdminProfilePage />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </>
));

export default function App() { return <RouterProvider router={router} />; }
