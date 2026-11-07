import { getRequestError } from '../utils/requestError';
/**
 * StripeCompletePage — /admin/stripe/complete
 *
 * Stripe redirects the Admin here after they return from the hosted onboarding flow
 * (STRIPE_CONNECT_RETURN_URL). This page:
 *  1. Reads the logged-in user's hostelId from Redux state.
 *  2. Calls GET /api/hostels/:hostelId/stripe/status to sync onboarding
 *     readiness live from Stripe.
 *  3. If ready: displays connection success and smoothly redirects to Payout Settings.
 *  4. If requirements remain: displays incomplete notice with "Continue Stripe Setup"
 *     reusing the existing connected account.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { useAppSelector } from '../store/hooks';
import {
  useLazyGetStripeStatusQuery,
  useLazyGetStripeOnboardLinkQuery,
} from '../features/api/hostelApi';

export default function StripeCompletePage() {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const hostelId = user?.hostelId ?? '';

  const [triggerSync, { isLoading, data, isError, error }] = useLazyGetStripeStatusQuery();
  const [triggerOnboard, { isLoading: isGeneratingLink }] = useLazyGetStripeOnboardLinkQuery();
  const hasFired = useRef(false);
  const [onboardError, setOnboardError] = useState('');

  const [countdown, setCountdown] = useState(3);

  // Fire live sync on mount (preferCacheValue = false guarantees fresh network check)
  useEffect(() => {
    if (!hasFired.current && hostelId) {
      hasFired.current = true;
      triggerSync(hostelId, false);
    }
  }, [hostelId, triggerSync]);

  const isConnected = Boolean(data?.isConnected || (data?.connected && data?.onboardingComplete));
  const chargesEnabled = Boolean(data?.chargesEnabled);
  const requirementsPending = Boolean(data?.requirementsPending);

  // Auto-redirect countdown ONLY when successfully connected
  useEffect(() => {
    if (isLoading || !isConnected) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate('/hostel-reg?tab=payouts', { replace: true });
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading, isConnected, navigate]);

  const handleContinueSetup = async () => {
    setOnboardError('');
    try {
      const res = await triggerOnboard(hostelId).unwrap();
      if (res?.url) {
        window.location.href = res.url;
      } else {
        setOnboardError('No onboarding URL returned. Please retry.');
      }
    } catch (caughtError: unknown) {
      const err = getRequestError(caughtError);
      setOnboardError(
        err?.data?.message || err?.message || 'Failed to generate continuation link.'
      );
    }
  };

  // If there's no hostelId (not yet registered), redirect immediately
  if (!hostelId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 max-w-md w-full text-center shadow-md space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-lg font-bold text-[#0b1329]">No Hostel Found</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your account does not have a hostel registered yet. Please complete
            hostel registration first.
          </p>
          <button
            type="button"
            onClick={() => navigate('/hostel-reg', { replace: true })}
            className="w-full py-2.5 bg-[#0b1329] text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Go to Hostel Registration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 max-w-md w-full text-center shadow-md space-y-5">
        {isLoading ? (
          <>
            <Loader2 className="w-10 h-10 text-slate-600 animate-spin mx-auto" />
            <h1 className="text-lg font-bold text-[#0b1329]">Verifying Stripe Status…</h1>
            <p className="text-xs text-slate-500">
              Retrieving the latest onboarding state from Stripe. This takes a moment.
            </p>
          </>
        ) : isError ? (
          <>
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <h1 className="text-lg font-bold text-[#0b1329]">Verification Issue</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              We couldn't retrieve your Stripe status right now.
              {getRequestError(error)?.data?.message && (
                <span className="block mt-1 text-rose-600 font-medium">
                  {getRequestError(error).data?.message}
                </span>
              )}
            </p>
            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={() => triggerSync(hostelId, false)}
                className="w-full py-2.5 bg-[#0b1329] text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Retry Verification
              </button>
              <button
                type="button"
                onClick={() => navigate('/hostel-reg?tab=payouts', { replace: true })}
                className="w-full py-2.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Return to Payout Settings
              </button>
            </div>
          </>
        ) : isConnected ? (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h1 className="text-lg font-bold text-[#0b1329]">Stripe Connected!</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your hostel is now linked to your Stripe Express account.{' '}
              {chargesEnabled
                ? 'Charges are active and direct rent payouts are ready.'
                : 'Account is verified. Transfers and payouts are active.'}
            </p>
            <div className="pt-2 space-y-3">
              <p className="text-xs text-slate-400">
                Returning to Payout Settings in <strong>{countdown}</strong> second{countdown !== 1 ? 's' : ''}…
              </p>
              <button
                type="button"
                onClick={() => navigate('/hostel-reg?tab=payouts', { replace: true })}
                className="w-full py-2.5 bg-[#0b1329] text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Go to Payout Settings Now
              </button>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <h1 className="text-lg font-bold text-[#0b1329]">Onboarding Incomplete</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              Stripe onboarding still requires additional information or verification before payouts can be activated.
              {requirementsPending && (
                <span className="block mt-1 text-amber-700 font-medium">
                  Additional business or identity requirements are currently pending on Stripe.
                </span>
              )}
            </p>
            {onboardError && (
              <p className="text-xs text-rose-600 font-medium">{onboardError}</p>
            )}
            <div className="pt-2 space-y-3">
              <button
                type="button"
                disabled={isGeneratingLink}
                onClick={handleContinueSetup}
                className="w-full py-2.5 bg-[#0b1329] text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingLink ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Stripe Session…</span>
                  </>
                ) : (
                  <>
                    <span>Continue Stripe Setup</span>
                    <ExternalLink className="w-4 h-4" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/hostel-reg?tab=payouts', { replace: true })}
                className="w-full py-2.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Return to Payout Settings
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
