import { useState, useEffect, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  Calendar, 
  ShieldCheck, 
  Building, 
  Camera,
  Lock,
  ArrowRight,
  Loader2
} from 'lucide-react';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { PageSpinner, ErrorBanner } from '../components/Feedback';
import { PageHeader } from '../components/responsive/ResponsivePrimitives';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logOut, updateCurrentUser } from '../features/auth/authSlice';
import { baseApi } from '../features/api/baseApi';
import { useChangePasswordMutation } from '../features/api/authApi';
import { useGetUserByIdQuery, useUpdateProfileMutation } from '../features/api/userApi';
import { useUploadImageMutation } from '../features/api/uploadApi';
import { useGetHostelByIdQuery } from '../features/api/hostelApi';
import PhoneInputWithCountry from '../components/PhoneInputWithCountry';
import {
  type CountryInfo,
  formatPhoneDisplay,
  parseExistingPhone,
  validateAndFormatPhone,
  isE164Valid,
} from '../utils/phoneUtils';

export default function AdminProfilePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const authUser = useAppSelector((state) => state.auth.user);

  const {
    data: userData,
    isLoading: isUserLoading,
    isError: isUserError,
    error: userFetchError,
    refetch: refetchUser,
  } = useGetUserByIdQuery(authUser?._id ?? '', {
    skip: !authUser?._id,
  });

  const effectiveUser = userData || authUser;
  const hostelId = effectiveUser?.hostelId;

  const {
    data: hostelData,
    isLoading: isHostelLoading,
  } = useGetHostelByIdQuery(hostelId ?? '', {
    skip: !hostelId,
  });

  const [updateProfileMutation, { isLoading: isUpdatingProfile }] = useUpdateProfileMutation();
  const [uploadImageMutation, { isLoading: isUploadingPhoto }] = useUploadImageMutation();
  const [changePasswordMutation, { isLoading: isChangingPassword }] = useChangePasswordMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [adminName, setAdminName] = useState(effectiveUser?.name || 'Administrator');
  const [adminEmail, setAdminEmail] = useState(effectiveUser?.email || '');
  const [adminPhone, setAdminPhone] = useState(effectiveUser?.phone || '+92 300 1234567');

  useEffect(() => {
    if (effectiveUser) {
      if (effectiveUser.name) setAdminName(effectiveUser.name);
      if (effectiveUser.email) setAdminEmail(effectiveUser.email);
      if (effectiveUser.phone) setAdminPhone(effectiveUser.phone);
    }
  }, [effectiveUser]);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editName, setEditName] = useState(adminName);
  const [editEmail, setEditEmail] = useState(adminEmail);
  const [editCountry, setEditCountry] = useState<CountryInfo>(
    () => parseExistingPhone(adminPhone).country
  );
  const [editPhone, setEditPhone] = useState<string>(
    () => parseExistingPhone(adminPhone).nationalNumber
  );
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToasts((prev) => [...prev, { id: Date.now().toString(), type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!effectiveUser?._id) return;
    setPhoneError(null);

    let finalPhone = editPhone.trim();
    if (!finalPhone) {
      setPhoneError('Phone number is required.');
      return;
    }

    const validation = validateAndFormatPhone(finalPhone, editCountry.code);
    if (!validation.isValid || !validation.e164) {
      setPhoneError(validation.error || 'Please enter a valid phone number.');
      return;
    }
    finalPhone = validation.e164;

    try {
      const updated = await updateProfileMutation({
        id: effectiveUser._id,
        data: {
          name: editName,
          phone: finalPhone,
        },
      }).unwrap();

      setAdminName(updated.name);
      if (updated.phone) setAdminPhone(updated.phone);
      dispatch(updateCurrentUser({ name: updated.name, phone: updated.phone }));
      setShowEditModal(false);
      addToast('success', 'Administrator profile details updated successfully.');
    } catch (err: any) {
      addToast('error', err?.data?.message || err?.message || 'Failed to update profile.');
    }
  };

  const handleProfileImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input value so selecting the same file again still fires change
    e.target.value = '';

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
      addToast('error', 'Please select a JPG, PNG, or WebP image.');
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024; // 5 MB limit matching backend
    if (file.size > maxSizeBytes) {
      addToast('error', 'Image size exceeds the 5 MB limit. Please select a smaller photo.');
      return;
    }

    if (!effectiveUser?._id) return;

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', '/profiles');

      const uploadRes = await uploadImageMutation(formData).unwrap();
      if (!uploadRes?.url) {
        throw new Error('Upload did not return an image URL.');
      }

      const updatedUser = await updateProfileMutation({
        id: effectiveUser._id,
        data: {
          profileImageUrl: uploadRes.url,
        },
      }).unwrap();

      const newImageUrl = updatedUser.profileImageUrl || uploadRes.url;
      dispatch(updateCurrentUser({ profileImageUrl: newImageUrl }));
      addToast('success', 'Profile photo updated successfully.');
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[PROFILE PHOTO UPLOAD ERROR]', err);
      addToast(
        'error',
        err?.data?.message || err?.message || 'Failed to update profile photo. Please try again.'
      );
    }
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (!currentPassword) {
      setPasswordError('Current password is required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    try {
      await changePasswordMutation({ currentPassword, newPassword }).unwrap();
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      dispatch(logOut());
      dispatch(baseApi.util.resetApiState());
      navigate('/login', { replace: true, state: { passwordChanged: true } });
    } catch (err: unknown) {
      const requestError = err as { data?: { message?: string }; message?: string };
      setPasswordError(
        requestError.data?.message || requestError.message || 'Failed to update your passcode.'
      );
    }
  };

  const formattedSinceDate = effectiveUser?.createdAt
    ? new Date(effectiveUser.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'October 12, 2023';

  if (isUserLoading && !authUser) {
    return <PageSpinner message="Loading administrator profile..." />;
  }

  return (
    <div className="workspace-page space-y-6 max-w-[1240px] mx-auto pb-12">
      {/* Page Header */}
      <PageHeader>
        <h1 className="text-2xl font-bold text-[#0b1329] tracking-tight">Profile Settings</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          Manage your administrative credentials, property access, and security notifications.
        </p>
      </PageHeader>

      {isUserError && (
        <ErrorBanner
          message={(userFetchError as any)?.message || 'Failed to load user profile.'}
          onRetry={refetchUser}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Profile Identity & Credentials */}
        <div className="lg:col-span-8 space-y-6">
          {/* Main Profile Info Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleProfileImageChange}
                  />
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-xs bg-slate-100 flex items-center justify-center relative">
                    {effectiveUser?.profileImageUrl ? (
                      <img
                        src={effectiveUser.profileImageUrl}
                        alt="Admin Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-slate-700">
                        {adminName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    {isUploadingPhoto && (
                      <div className="absolute inset-0 bg-[#0b1329]/60 backdrop-blur-2xs flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto || isUpdatingProfile}
                    className="absolute -bottom-1 -right-1 p-1.5 bg-[#0b1329] text-white rounded-lg shadow-sm hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isUploadingPhoto ? 'Uploading photo...' : 'Change Avatar'}
                    aria-label="Change Avatar"
                  >
                    {isUploadingPhoto ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Camera className="w-3 h-3" />
                    )}
                  </button>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#0b1329]">{adminName}</h2>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> {effectiveUser?.role || 'Admin'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {hostelData ? hostelData.name : 'HostelHive Property Administrator'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditName(adminName);
                  setEditEmail(adminEmail);
                  const parsed = parseExistingPhone(adminPhone);
                  setEditCountry(parsed.country);
                  setEditPhone(parsed.nationalNumber);
                  setPhoneError(null);
                  setShowEditModal(true);
                }}
                className="px-4 py-2 bg-[#0b1329] text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors uppercase tracking-wider shadow-2xs"
              >
                EDIT PROFILE
              </button>
            </div>

            {/* Field Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  ADMIN NAME
                </span>
                <p className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  {adminName}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  INSTITUTIONAL EMAIL
                </span>
                <p className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {adminEmail}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    PHONE NO
                  </span>
                  {isE164Valid(adminPhone) && (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Valid number
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {formatPhoneDisplay(adminPhone)}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  ADMIN SINCE
                </span>
                <p className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {formattedSinceDate}
                </p>
              </div>
            </div>
          </div>

          {/* Security & Credentials Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#0b1329]">Security & Authentication</h3>
                <p className="text-xs text-slate-400 mt-0.5">Manage passcode and multi-factor security credentials</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" /> Change Passcode
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Property Assignment & Notifications */}
        <div className="lg:col-span-4 space-y-6">
          {/* Property Assignment Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              ASSIGNED HOSTEL PROPERTY
            </p>

            {isHostelLoading ? (
              <div className="p-4 rounded-xl bg-slate-100 animate-pulse text-xs text-slate-400">
                Loading property details...
              </div>
            ) : hostelData ? (
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2 shadow-xs">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-sm">{hostelData.name}</h4>
                </div>
                <p className="text-[11px] text-slate-300">{hostelData.location}</p>
                <div className="flex items-center gap-2 pt-2 text-[10px] text-slate-400 border-t border-white/10">
                  <span>Price Tier: RS. {hostelData.priceTier}/mo</span>
                  <span>•</span>
                  <span>Facilities: {hostelData.facilities?.length || 0}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-2">
                <Building className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">No Hostel Registered</p>
                <p className="text-[11px] text-slate-400">Register your property branch to begin room allocations.</p>
                <Link
                  to="/hostel-reg"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0b1329] text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors mt-1"
                >
                  Register Now <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Administrator Profile"
        description="Update your contact credentials on HostelHive."
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label htmlFor="adminprofilepage-field-1" className="block text-xs font-bold text-slate-700 mb-1">
              Admin Name <span className="text-rose-500">*</span>
            </label>
            <input id="adminprofilepage-field-1"
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="adminprofilepage-field-2" className="block text-xs font-bold text-slate-700 mb-1">
              Institutional Email <span className="text-rose-500">*</span>
            </label>
            <input id="adminprofilepage-field-2"
              type="email"
              disabled
              value={editEmail}
              className="w-full px-3.5 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl font-semibold text-slate-500 cursor-not-allowed"
            />
            <p className="text-[10px] text-slate-400 mt-1">Email address is managed by system institution admin.</p>
          </div>

          <PhoneInputWithCountry
            label="Phone Number"
            required
            value={editPhone}
            country={editCountry}
            onChangeNumber={(val) => {
              setEditPhone(val);
              if (phoneError) setPhoneError(null);
            }}
            onSelectCountry={setEditCountry}
            error={phoneError}
            showValidBadge
            helperText="Stored in international E.164 format (e.g. +923012345678)."
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 disabled:opacity-75 flex items-center gap-1.5"
            >
              {isUpdatingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          if (!isChangingPassword) setShowPasswordModal(false);
        }}
        title="Update Security Passcode"
        description="Enter your current and new administrator password."
      >
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {passwordError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-semibold">
              {passwordError}
            </div>
          )}

          <div>
            <label htmlFor="adminprofilepage-field-3" className="block text-xs font-bold text-slate-700 mb-1">Current Passcode</label>
            <input id="adminprofilepage-field-3"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="adminprofilepage-field-4" className="block text-xs font-bold text-slate-700 mb-1">New Passcode</label>
            <input id="adminprofilepage-field-4"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="adminprofilepage-field-5" className="block text-xs font-bold text-slate-700 mb-1">Confirm New Passcode</label>
            <input id="adminprofilepage-field-5"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowPasswordModal(false)}
              disabled={isChangingPassword}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isChangingPassword}
              className="px-4 py-2 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 disabled:opacity-75 flex items-center gap-1.5"
            >
              {isChangingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isChangingPassword ? 'Updating…' : 'Update Passcode'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
