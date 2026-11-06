import { useEffect, useRef } from 'react';
import type { ClipboardEvent } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}

export default function OtpInput({ value, onChange, label, disabled = false }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const digits = Array.from({ length: 6 }, (_, index) => value[index]?.trim() || '');

  const handleChange = (index: number, raw: string) => {
    const incoming = raw.replace(/\D/g, '');
    if (!incoming) {
      const next = value.padEnd(6, ' ').split('');
      next[index] = ' ';
      onChange(next.join('').slice(0, 6).trimEnd());
      return;
    }
    const next = value.padEnd(6, ' ').split('');
    incoming.slice(0, 6 - index).split('').forEach((digit, offset) => { next[index + offset] = digit; });
    onChange(next.join('').slice(0, 6).trimEnd());
    refs.current[Math.min(index + incoming.length, 5)]?.focus();
  };

  const handleKeyDown = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) refs.current[index - 1]?.focus();
    if (key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (key === 'ArrowRight' && index < 5) refs.current[index + 1]?.focus();
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="otp-field">
      <span className="auth-label">{label}</span>
      <div className="otp-boxes" onPaste={handlePaste} role="group" aria-label={label}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => { refs.current[index] = element; }}
            aria-label={`Digit ${index + 1} of 6`}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event.key)}
            className="otp-box"
          />
        ))}
      </div>
    </div>
  );
}
