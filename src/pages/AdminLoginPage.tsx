import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, LifeBuoy, Loader2, Mail } from 'lucide-react';
import Modal from '../components/Modal';
import AuthLayout from '../components/auth/AuthLayout';
import OtpInput from '../components/auth/OtpInput';
import PasswordInput from '../components/auth/PasswordInput';
import {
  useLoginMutation,
  useRequestPasswordResetMutation,
  useResetPasswordMutation,
} from '../features/api/authApi';
import { OTP_EXPIRY_MS, formatOtpTime, useOtpCountdown } from '../utils/useOtpCountdown';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logOut, setCredentials } from '../features/auth/authSlice';

interface LoginLocationState {
  accessDenied?: boolean;
  passwordChanged?: boolean;
  from?: { pathname?: string; search?: string; hash?: string };
}

function getSafeLoginDestination(state: unknown): string {
  if (!state || typeof state !== 'object') return '/dashboard';
  const from = (state as LoginLocationState).from;
  if (!from?.pathname || !from.pathname.startsWith('/') || from.pathname.startsWith('//')) return '/dashboard';
  return `${from.pathname}${from.search || ''}${from.hash || ''}`;
}

function errorText(error: unknown, fallback: string) {
  const value = error as { data?: { message?: string }; message?: string };
  return value?.data?.message || value?.message || fallback;
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const [loginMutation, { isLoading: isLoginLoading }] = useLoginMutation();
  const [requestPasswordReset, { isLoading: isRequestingReset }] = useRequestPasswordResetMutation();
  const [resetPassword, { isLoading: isResettingPassword }] = useResetPasswordMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState((location.state as LoginLocationState | null)?.accessDenied ? 'This account does not have administrator access.' : '');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showForgotFlow, setShowForgotFlow] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'code' | 'password' | 'done'>('request');
  const [resetError, setResetError] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetOtpExpiresAt, setResetOtpExpiresAt] = useState<number | null>(null);
  const resetOtpSecondsRemaining = useOtpCountdown(resetOtpExpiresAt);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    if (currentUser?.role === 'Admin') navigate(getSafeLoginDestination(location.state), { replace: true });
    else if (currentUser) dispatch(logOut());
  }, [currentUser, dispatch, location.state, navigate]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    try {
      const result = await loginMutation({ email, password }).unwrap();
      if (result.user.role !== 'Admin') {
        setErrorMessage('This account does not have administrator access.');
        return;
      }
      dispatch(setCredentials({ user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken, rememberMe }));
      navigate(getSafeLoginDestination(location.state), { replace: true });
    } catch (error) {
      setErrorMessage(errorText(error, 'Login failed. Check your email and password, then try again.'));
    }
  };

  const openForgotFlow = () => {
    setResetEmail(email.trim());
    setResetStep('request');
    setResetError('');
    setShowForgotFlow(true);
  };

  const closeForgotFlow = () => {
    setShowForgotFlow(false);
    setResetStep('request');
    setResetError('');
    setResetOtp('');
    setResetOtpExpiresAt(null);
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const handleRequestReset = async (event: FormEvent) => {
    event.preventDefault();
    setResetError('');
    try {
      await requestPasswordReset({ email: resetEmail }).unwrap();
      setResetOtp('');
      setResetOtpExpiresAt(Date.now() + OTP_EXPIRY_MS);
      setResetStep('code');
    } catch (error) { setResetError(errorText(error, 'Could not request a reset code.')); }
  };

  const handleResendResetCode = async () => {
    setResetError('');
    try {
      await requestPasswordReset({ email: resetEmail }).unwrap();
      setResetOtp('');
      setResetOtpExpiresAt(Date.now() + OTP_EXPIRY_MS);
    } catch (error) { setResetError(errorText(error, 'Could not resend the reset code.')); }
  };

  const handleContinueReset = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(resetOtp) || resetOtpSecondsRemaining === 0) return;
    setResetError('');
    setResetStep('password');
  };

  const handleCompletePasswordReset = async (event: FormEvent) => {
    event.preventDefault();
    setResetError('');
    if (newPassword !== confirmNewPassword) {
      setResetError('Passwords do not match. Check both fields and try again.');
      return;
    }
    try {
      await resetPassword({ email: resetEmail, otp: resetOtp, newPassword }).unwrap();
      setResetStep('done');
    } catch (error) { setResetError(errorText(error, 'Could not reset the password. Check the code and try again.')); }
  };

  const authFooter = showForgotFlow ? (
    <button type="button" className="auth-link" onClick={closeForgotFlow}>Back to sign in</button>
  ) : (
    <>
      <div>New to HostelHive? <Link className="auth-link" to="/register">Create an admin account <ArrowRight aria-hidden="true" size={14} /></Link></div>
      <div className="auth-footer-help"><span>Need help accessing your account?</span><button type="button" className="auth-link" onClick={() => setShowSupportModal(true)}>Contact support</button></div>
    </>
  );

  return (
    <>
      <AuthLayout footer={authFooter} panelLabel="Hostel administration">
        {!showForgotFlow ? (
          <>
            <header className="auth-form-header">
              <p className="auth-kicker">Admin workspace</p>
              <h2>Welcome back</h2>
              <p>Sign in to manage your hostel and daily operations.</p>
            </header>
            {errorMessage && <div className="auth-error-banner" role="alert" aria-live="polite"><AlertCircle aria-hidden="true" /><span>{errorMessage}</span></div>}
            {(location.state as LoginLocationState | null)?.passwordChanged && (
              <p role="status" className="text-sm text-emerald-700">Your password was changed. Sign in again with your new password.</p>
            )}
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="auth-field">
                <label htmlFor="login-email" className="auth-label">Email</label>
                <div className="auth-input-wrap"><Mail aria-hidden="true" className="auth-input-icon" /><input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@gmail.com" required autoComplete="username" className="auth-input auth-input-with-icon" /></div>
              </div>
              <PasswordInput id="login-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" placeholder="Enter your password" showStrength={false} />
              <div className="auth-form-between">
                <label className="auth-check-row"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>Keep me signed in</span></label>
                <button type="button" className="auth-link" onClick={openForgotFlow}>Forgot password?</button>
              </div>
              <button type="submit" disabled={isLoginLoading} className="auth-primary-button">{isLoginLoading ? <><Loader2 className="animate-spin" /> Signing in…</> : <>Sign in <ArrowRight aria-hidden="true" /></>}</button>
            </form>
          </>
        ) : (
          <>
            <div className="auth-stepper" aria-label="Password reset progress">
              {['Email', 'Code', 'New password'].map((label, index) => {
                const stepOrder = { request: 0, code: 1, password: 2, done: 3 }[resetStep];
                return <span key={label} className={`auth-stepper-item ${stepOrder >= index ? 'is-active' : ''}`}><span className="auth-stepper-number">{index + 1}</span>{label}</span>;
              })}
            </div>
            <header className="auth-form-header">
              <p className="auth-kicker">Password recovery</p>
              <h2>{resetStep === 'done' ? 'Password updated' : resetStep === 'request' ? 'Reset your password' : resetStep === 'code' ? 'Check your email' : 'Choose a new password'}</h2>
              <p>{resetStep === 'request' ? 'Enter the email on your administrator account and we’ll send a reset code.' : resetStep === 'code' ? `Enter the six-digit code sent to ${resetEmail}.` : resetStep === 'password' ? 'Create a new password for your administrator account.' : 'You can now sign in with your new password.'}</p>
            </header>
            {resetError && <div className="auth-error-banner" role="alert" aria-live="polite"><AlertCircle aria-hidden="true" /><span>{resetError}</span></div>}
            {resetStep === 'request' && <form className="auth-form" onSubmit={handleRequestReset}>
              <div className="auth-field"><label htmlFor="reset-email" className="auth-label">Email</label><div className="auth-input-wrap"><Mail aria-hidden="true" className="auth-input-icon" /><input id="reset-email" type="email" required value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="example@gmail.com" autoComplete="email" className="auth-input auth-input-with-icon" /></div></div>
              <button type="submit" disabled={isRequestingReset} className="auth-primary-button">{isRequestingReset ? <><Loader2 className="animate-spin" /> Sending code…</> : <>Send reset code <ArrowRight aria-hidden="true" /></>}</button>
            </form>}
            {resetStep === 'code' && <form className="auth-form" onSubmit={handleContinueReset}>
              <OtpInput label="6-digit verification code" value={resetOtp} onChange={setResetOtp} disabled={isRequestingReset} />
              <p className="auth-inline-helper">{resetOtpSecondsRemaining > 0 ? `This code expires in ${formatOtpTime(resetOtpSecondsRemaining)}.` : 'This code has expired. Request a new one to continue.'}</p>
              <button type="button" className="auth-link resend-link" onClick={handleResendResetCode} disabled={isRequestingReset || resetOtpSecondsRemaining > 0}>{isRequestingReset ? 'Sending code…' : resetOtpSecondsRemaining > 0 ? `Resend code in ${formatOtpTime(resetOtpSecondsRemaining)}` : 'Resend code'}</button>
              <button type="submit" disabled={!/^\d{6}$/.test(resetOtp) || resetOtpSecondsRemaining === 0} className="auth-primary-button">Continue <ArrowRight aria-hidden="true" /></button>
              <button type="button" className="auth-back-button" onClick={() => setResetStep('request')}><ArrowLeft aria-hidden="true" /> Use a different email</button>
            </form>}
            {resetStep === 'password' && <form className="auth-form" onSubmit={handleCompletePasswordReset}>
              <PasswordInput id="reset-new-password" label="New password" value={newPassword} onChange={setNewPassword} showStrength />
              <PasswordInput id="reset-confirm-password" label="Confirm new password" value={confirmNewPassword} onChange={setConfirmNewPassword} placeholder="Re-enter your new password" />
              <p className="auth-inline-helper">The verification code is checked when you save your new password.</p>
              <button type="submit" disabled={isResettingPassword || isRequestingReset || !/^\d{6}$/.test(resetOtp) || resetOtpSecondsRemaining === 0} className="auth-primary-button">{isResettingPassword ? <><Loader2 className="animate-spin" /> Updating password…</> : <>Update password <ArrowRight aria-hidden="true" /></>}</button>
              <button type="button" className="auth-back-button" onClick={() => setResetStep('code')}><ArrowLeft aria-hidden="true" /> Back to code</button>
            </form>}
            {resetStep === 'done' && <div className="auth-form"><div className="auth-success-banner" role="status"><CheckCircle2 aria-hidden="true" /> Your password has been changed successfully.</div><button type="button" className="auth-primary-button" onClick={() => { setEmail(resetEmail); closeForgotFlow(); }}>Back to sign in <ArrowRight aria-hidden="true" /></button></div>}
          </>
        )}
      </AuthLayout>

      <Modal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} title="Contact administrator support" description="For help with hostel administrator access.">
        <div className="space-y-4 text-sm text-slate-600">
          <p className="leading-relaxed">For property onboarding or account access, contact your campus coordinator or system administrator.</p>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5"><p className="font-semibold text-slate-800">Campus Tech Desk: +92 (42) 111-467-835</p><p>Email: support@hostelhive.edu.pk</p><p>Monday–Saturday, 8:00 AM–8:00 PM PKT</p></div>
          <div className="flex justify-end"><button type="button" onClick={() => setShowSupportModal(false)} className="auth-secondary-button inline-flex items-center gap-2"><LifeBuoy size={15} /> Close</button></div>
        </div>
      </Modal>
    </>
  );
}
