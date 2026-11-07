import { getRequestError } from '../utils/requestError';
/**
 * StripeRefreshPage — /admin/stripe/refresh
 *
 * Stripe redirects the Admin here when the onboarding link expires or the
 * Admin needs to restart onboarding (STRIPE_CONNECT_REFRESH_URL).
 * This page:
 *  1. Reads the logged-in user's hostelId from Redux state.
 *  2. Calls GET /api/hostels/:hostelId/stripe/onboard to generate a fresh
 *     onboarding link from Stripe.
 *  3. Immediately opens the new link in the same tab, or shows an error.
 *
 * No Stripe secrets are exposed — the link is generated server-side.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { useAppSelector } from '../store/hooks';
import { useLazyGetStripeOnboardLinkQuery } from '../features/api/hostelApi';

export default function StripeRefreshPage() {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const hostelId = user?.hostelId ?? '';

  const [triggerOnboard, { isLoading, isError, error }] = useLazyGetStripeOnboardLinkQuery();
  const hasFired = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!hasFired.current && hostelId) {
      hasFired.current = true;

      triggerOnboard(hostelId)
        .unwrap()
        .then((res) => {
          if (res?.url) {
            // Replace this tab with the Stripe onboarding URL, matching the
            // pattern Stripe expects for onboarding restarts.
            window.location.href = res.url;
          } else {
            setErrorMessage('No onboarding URL returned from the server.');
          }
        })
        .catch((err) => {
          setErrorMessage(
            err?.data?.message || err?.message || 'Failed to generate a new Stripe onboarding link.'
          );
        });
    }
  }, [hostelId, triggerOnboard]);

  if (!hostelId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 max-w-md w-full text-center shadow-md space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-lg font-bold text-[#0b1329]">No Hostel Found</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your account does not have a hostel registered yet. Please register
            your hostel before connecting Stripe.
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
        {isLoading && !errorMessage ? (
          <>
            <Loader2 className="w-10 h-10 text-slate-600 animate-spin mx-auto" />
            <h1 className="text-lg font-bold text-[#0b1329]">Refreshing Onboarding Link…</h1>
            <p className="text-xs text-slate-500">
              Generating a new Stripe onboarding session. You will be redirected
              to Stripe automatically.
            </p>
          </>
        ) : (isError || errorMessage) ? (
          <>
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
            <h1 className="text-lg font-bold text-[#0b1329]">Onboarding Link Failed</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              {errorMessage ||
                getRequestError(error)?.data?.message ||
                'We could not generate a fresh Stripe onboarding link. Please try again from Payout Settings.'}
            </p>
            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={() => {
                  hasFired.current = false;
                  setErrorMessage('');
                  triggerOnboard(hostelId)
                    .unwrap()
                    .then((res) => {
                      if (res?.url) window.location.href = res.url;
                    })
                    .catch((err) =>
                      setErrorMessage(
                        err?.data?.message || err?.message || 'Failed again. Please try from Payout Settings.'
                      )
                    );
                }}
                disabled={isLoading}
                className="w-full py-2.5 bg-[#0b1329] text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ExternalLink className="w-4 h-4" />
                Retry Stripe Onboarding
              </button>
              <button
                type="button"
                onClick={() => navigate('/hostel-reg?tab=payouts', { replace: true })}
                className="w-full py-2.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Back to Payout Settings
              </button>
            </div>
          </>
        ) : (
          // Transitional state while Stripe redirect is happening
          <>
            <Loader2 className="w-10 h-10 text-slate-600 animate-spin mx-auto" />
            <h1 className="text-lg font-bold text-[#0b1329]">Redirecting to Stripe…</h1>
            <p className="text-xs text-slate-500">
              Opening Stripe onboarding. Please wait.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

