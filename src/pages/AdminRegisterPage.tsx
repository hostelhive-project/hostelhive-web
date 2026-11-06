import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import OtpInput from '../components/auth/OtpInput';
import PasswordInput from '../components/auth/PasswordInput';
import PhoneInputWithCountry from '../components/PhoneInputWithCountry';
import {
  useRegisterMutation,
  useResendVerificationMutation,
  useVerifyEmailMutation,
} from '../features/api/authApi';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setCredentials } from '../features/auth/authSlice';
import { type CountryInfo, DEFAULT_COUNTRY, validateAndFormatPhone } from '../utils/phoneUtils';
import { OTP_EXPIRY_MS, formatOtpTime, useOtpCountdown } from '../utils/useOtpCountdown';

function errorText(error: unknown, fallback: string) {
  const value = error as { data?: { message?: string }; message?: string };
  return value?.data?.message || value?.message || fallback;
}

export default function AdminRegisterPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const [registerMutation, { isLoading: isRegisterLoading }] = useRegisterMutation();
  const [verifyEmailMutation, { isLoading: isVerifying }] = useVerifyEmailMutation();
  const [resendVerificationMutation, { isLoading: isResending }] = useResendVerificationMutation();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<CountryInfo>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [verificationStep, setVerificationStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const otpSecondsRemaining = useOtpCountdown(otpExpiresAt);
  const [verificationNotice, setVerificationNotice] = useState('');
  const passwordsMatch = Boolean(confirmPasscode) && passcode === confirmPasscode;

  useEffect(() => {
    if (currentUser?.role === 'Admin') navigate('/dashboard', { replace: true });
  }, [currentUser, navigate]);

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    if (passcode !== confirmPasscode) { setErrorMsg('Passwords do not match. Please check both fields.'); return; }
    if (!termsAccepted) { setErrorMsg('Please accept the administrator guidelines to continue.'); return; }
    setErrorMsg('');
    setPhoneError('');
    let finalPhone: string | undefined;
    if (phone.trim()) {
      const validation = validateAndFormatPhone(phone.trim(), phoneCountry.code);
      if (!validation.isValid || !validation.e164) { setPhoneError(validation.error || 'Enter a valid phone number.'); return; }
      finalPhone = validation.e164;
    }
    try {
      const result = await registerMutation({ name: fullName, email, password: passcode, role: 'Admin', phone: finalPhone }).unwrap();
      setEmail(result.email);
      setOtp('');
      setOtpExpiresAt(Date.now() + OTP_EXPIRY_MS);
      setVerificationStep(true);
      setVerificationNotice('We sent a six-digit code to your email.');
    } catch (error) {
      setErrorMsg(errorText(error, 'Registration failed. Check your details and try again.'));
      if ((error as { status?: number })?.status === 503) { setVerificationStep(true); setOtpExpiresAt(null); }
    }
  };

  const handleVerifyEmail = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMsg('');
    try {
      const result = await verifyEmailMutation({ email, otp }).unwrap();
      dispatch(setCredentials({ user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken, rememberMe: true }));
      navigate('/hostel-reg');
    } catch (error) { setErrorMsg(errorText(error, 'Could not verify this code. Check it and try again.')); }
  };

  const handleResendCode = async () => {
    setErrorMsg('');
    try {
      await resendVerificationMutation({ email }).unwrap();
      setOtp('');
      setOtpExpiresAt(Date.now() + OTP_EXPIRY_MS);
      setVerificationNotice('If this email is awaiting verification, a new code has been sent.');
    } catch (error) { setErrorMsg(errorText(error, 'Could not resend the code.')); }
  };

  const changeEmail = () => {
    setVerificationStep(false);
    setErrorMsg('');
    setOtp('');
    setOtpExpiresAt(null);
  };

  return (
    <AuthLayout panelLabel="Create an admin account" footer={<>Already have an account? <Link to="/login" className="auth-link">Sign in <ArrowRight aria-hidden="true" size={14} /></Link></>}>
      <div className="auth-stepper" aria-label="Registration progress">
        <span className={`auth-stepper-item ${verificationStep ? 'is-done' : 'is-active'}`}><span className="auth-stepper-number">{verificationStep ? <CheckCircle2 size={14} /> : '1'}</span>Account</span>
        <span className="auth-stepper-line" aria-hidden="true" />
        <span className={`auth-stepper-item ${verificationStep ? 'is-active' : ''}`}><span className="auth-stepper-number">2</span>Verify email</span>
      </div>

      <header className="auth-form-header">
        <p className="auth-kicker">Admin account</p>
        <h2>{verificationStep ? 'Check your email' : 'Create your account'}</h2>
        <p>{verificationStep ? 'Enter the code we sent to confirm your email address.' : 'Set up your administrator access to manage a hostel.'}</p>
      </header>

      {errorMsg && <div className="auth-error-banner" role="alert" aria-live="polite"><AlertCircle aria-hidden="true" /><span>{errorMsg}</span></div>}

      {verificationStep ? (
        <form onSubmit={handleVerifyEmail} className="auth-form">
          <div className="auth-success-banner" role="status"><Mail aria-hidden="true" size={16} /> {verificationNotice || `A six-digit verification code was sent to ${email}.`}</div>
          <div className="auth-email-summary"><span>{email}</span><button type="button" className="auth-link" onClick={changeEmail}>Change email</button></div>
          <OtpInput label="Email verification code" value={otp} onChange={setOtp} disabled={isVerifying || isResending} />
          {otpExpiresAt !== null && <p className="auth-inline-helper" aria-live="polite">{otpSecondsRemaining > 0 ? `Code expires in ${formatOtpTime(otpSecondsRemaining)}.` : 'This code has expired. Request a new one to continue.'}</p>}
          <button type="button" onClick={handleResendCode} disabled={isResending || otpSecondsRemaining > 0} className="auth-link resend-link">{isResending ? 'Sending code…' : otpSecondsRemaining > 0 ? `Resend code in ${formatOtpTime(otpSecondsRemaining)}` : 'Resend code'}</button>
          <button type="submit" disabled={isVerifying || isResending || !/^\d{6}$/.test(otp) || (otpExpiresAt !== null && otpSecondsRemaining === 0)} className="auth-primary-button">{isVerifying ? <><Loader2 className="animate-spin" /> Verifying…</> : <>Verify email <ArrowRight aria-hidden="true" /></>}</button>
          <button type="button" onClick={changeEmail} className="auth-back-button"><ArrowLeft aria-hidden="true" /> Back to account details</button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="auth-form">
          <div className="auth-field"><label htmlFor="reg-fullname" className="auth-label">Full name</label><input id="reg-fullname" type="text" required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="e.g. Abu Huraira" autoComplete="name" className="auth-input" /></div>
          <div className="auth-field"><label htmlFor="reg-email" className="auth-label">Email</label><div className="auth-input-wrap"><Mail aria-hidden="true" className="auth-input-icon" /><input id="reg-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@gmail.com" autoComplete="email" className="auth-input auth-input-with-icon" /></div></div>
          <div className="auth-phone-field"><PhoneInputWithCountry label="Phone number" value={phone} country={phoneCountry} onChangeNumber={(value) => { setPhone(value); if (phoneError) setPhoneError(''); }} onSelectCountry={setPhoneCountry} error={phoneError} showValidBadge helperText="Optional" appearance="auth" /></div>
          <div className="auth-input-row">
            <PasswordInput id="reg-password" label="Password" value={passcode} onChange={setPasscode} showStrength />
            <div>
              <PasswordInput id="reg-confirm-password" label="Confirm password" value={confirmPasscode} onChange={setConfirmPasscode} placeholder="Re-enter password" />
              {confirmPasscode && <p className={`password-match ${passwordsMatch ? 'is-matched' : 'is-unmatched'}`} role="status">{passwordsMatch ? <><CheckCircle2 aria-hidden="true" /> Passwords match</> : <>Passwords do not match</>}</p>}
            </div>
          </div>
          <label className="auth-check-row auth-terms"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span>I agree to the <Link to="/legal/guidelines" target="_blank" rel="noreferrer" className="auth-link">administrator guidelines</Link> and <Link to="/legal/privacy" target="_blank" rel="noreferrer" className="auth-link">Privacy Policy</Link>. <Link to="/legal/terms" target="_blank" rel="noreferrer" className="auth-link">Read Terms of Service</Link>.</span></label>
          <button type="submit" disabled={isRegisterLoading} className="auth-primary-button">{isRegisterLoading ? <><Loader2 className="animate-spin" /> Creating account…</> : <>Create account <ArrowRight aria-hidden="true" /></>}</button>
        </form>
      )}
    </AuthLayout>
  );
}
