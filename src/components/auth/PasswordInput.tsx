import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  showStrength?: boolean;
  error?: string;
}

function getStrength(value: string) {
  if (!value) return 0;
  return [value.length >= 8, /[A-Z]/.test(value) && /[a-z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
}

export default function PasswordInput({
  id, label, value, onChange, autoComplete = 'new-password', placeholder = 'At least 8 characters',
  required = true, minLength = 8, showStrength = false, error,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const strength = getStrength(value);
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];

  return (
    <div className="auth-field">
      <label htmlFor={id} className="auth-label">{label}{required && <span aria-hidden="true"> *</span>}</label>
      <div className={`auth-input-wrap ${error ? 'has-error' : ''}`}>
        <LockKeyhole aria-hidden="true" className="auth-input-icon" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : showStrength && value ? `${id}-strength` : undefined}
          className="auth-input auth-input-with-icon auth-input-with-action"
        />
        <button type="button" className="auth-input-action" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
      {error && <p id={`${id}-error`} className="auth-field-error" role="alert">{error}</p>}
      {showStrength && value && (
        <div id={`${id}-strength`} className="password-strength" aria-live="polite">
          <div className="password-strength-bars" aria-hidden="true">{[1, 2, 3, 4].map((bar) => <span key={bar} className={strength >= bar ? `is-strength-${strength}` : ''} />)}</div>
          <span>Password strength: {strengthLabel}</span>
        </div>
      )}
    </div>
  );
}
