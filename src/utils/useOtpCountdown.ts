import { useEffect, useState } from 'react';

export const OTP_EXPIRY_MS = 90_000;

export function formatOtpTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

export function useOtpCountdown(expiresAt: number | null): number {
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    if (expiresAt === null) {
      setSecondsRemaining(0);
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | undefined;
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0 && intervalId) clearInterval(intervalId);
    };

    intervalId = setInterval(updateCountdown, 1000);
    updateCountdown();
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [expiresAt]);

  return secondsRemaining;
}
