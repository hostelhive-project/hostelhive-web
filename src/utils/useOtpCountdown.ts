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
    if (expiresAt === null) return;
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0 && intervalId) clearInterval(intervalId);
    };

    const intervalId = setInterval(updateCountdown, 1000);
    const initialUpdate = setTimeout(updateCountdown, 0);
    return () => {
      clearTimeout(initialUpdate);
      clearInterval(intervalId);
    };
  }, [expiresAt]);

  return expiresAt === null ? 0 : secondsRemaining;
}
