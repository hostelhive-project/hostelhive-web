import { useId, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Clock3 } from 'lucide-react';
import Modal from './Modal';

interface TimePickerProps {
  id?: string;
  label: string;
  /** A local wall-clock time in 24-hour HH:mm format, or an empty value. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestedTimes?: string[];
  helperText?: string;
  error?: string | null;
  disabled?: boolean;
}

type Period = 'AM' | 'PM';

function parseTime(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return { hours, minutes };
}

function displayTime(value: string) {
  const time = parseTime(value);
  if (!time) return value;
  return `${String(time.hours % 12 || 12).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')} ${time.hours >= 12 ? 'PM' : 'AM'}`;
}

export default function TimePicker({
  id,
  label,
  value,
  onChange,
  placeholder = 'Select a time',
  suggestedTimes = [],
  helperText,
  error,
  disabled = false,
}: TimePickerProps) {
  const generatedId = useId();
  const inputId = id || `time-${generatedId}`;
  const hintId = `${inputId}-hint`;
  const draftErrorId = `${inputId}-draft-error`;
  const [isOpen, setIsOpen] = useState(false);
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [period, setPeriod] = useState<Period>('AM');
  const [draftError, setDraftError] = useState('');
  const currentTime = parseTime(value);

  const setDraft = (hours: number, minutes: number) => {
    setHour(String(hours % 12 || 12).padStart(2, '0'));
    setMinute(String(minutes).padStart(2, '0'));
    setPeriod(hours >= 12 ? 'PM' : 'AM');
    setDraftError('');
  };

  const openPicker = () => {
    if (disabled) return;
    // An unset field stays unset until the user explicitly selects Set time.
    const time = currentTime || parseTime(suggestedTimes[0] || '') || { hours: 9, minutes: 0 };
    setDraft(time.hours, time.minutes);
    setIsOpen(true);
  };

  const getDraftTime = () => {
    if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) return null;
    const hours = Number(hour);
    const minutes = Number(minute);
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    return { hours: hours % 12 + (period === 'PM' ? 12 : 0), minutes };
  };

  const adjustTime = (unit: 'hour' | 'minute', direction: number) => {
    const time = getDraftTime();
    if (!time) {
      setDraftError('Enter an hour from 1 to 12 and minutes from 00 to 59.');
      return;
    }
    const totalMinutes = (time.hours * 60 + time.minutes + direction * (unit === 'hour' ? 60 : 1) + 1440) % 1440;
    setDraft(Math.floor(totalMinutes / 60), totalMinutes % 60);
  };

  const applyTime = () => {
    if (disabled) return;
    const time = getDraftTime();
    if (!time) {
      setDraftError('Enter an hour from 1 to 12 and minutes from 00 to 59.');
      return;
    }
    onChange(`${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`);
    setIsOpen(false);
  };

  return (
    <div className="hh-time-picker">
      <label htmlFor={inputId} className="hh-time-label">{label}</label>
      <button
        id={inputId}
        type="button"
        className={`hh-time-trigger ${error ? 'has-error' : ''} ${value ? 'has-value' : ''}`}
        disabled={disabled}
        onClick={openPicker}
        aria-label={`${label}: ${value ? displayTime(value) : 'not set'}. Choose time`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-describedby={error || helperText ? hintId : undefined}
      >
        <span className="hh-time-trigger-icon" aria-hidden="true"><Clock3 /></span>
        <span className="hh-time-trigger-value">{value ? displayTime(value) : placeholder}</span>
        <ChevronDown className="hh-time-trigger-chevron" aria-hidden="true" />
      </button>
      {(error || helperText) && <p id={hintId} className={`hh-time-hint ${error ? 'has-error' : ''}`} role={error ? 'alert' : undefined}>{error || helperText}</p>}

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={label} description="Choose the exact time in your hostel's local time." maxWidth="sm">
        <div
          className="hh-time-editor"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.stopPropagation();
              applyTime();
            }
          }}
        >
          <div className="hh-time-editor-caption"><Clock3 aria-hidden="true" /><span>Select time</span><span>12-hour clock</span></div>
          <div className="hh-time-digits">
            {(['hour', 'minute'] as const).map((unit) => {
              const isHour = unit === 'hour';
              const number = isHour ? hour : minute;
              const min = isHour ? 1 : 0;
              const max = isHour ? 12 : 59;
              const valid = /^\d{1,2}$/.test(number) && Number(number) >= min && Number(number) <= max;
              return (
                <div className="hh-time-unit" key={unit}>
                  <button type="button" className="hh-time-adjust" onClick={() => adjustTime(unit, 1)} aria-label={`Increase ${unit}`}><ChevronUp aria-hidden="true" /></button>
                  <input
                    id={`${inputId}-${unit}`}
                    className="hh-time-value-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={2}
                    value={number}
                    role="spinbutton"
                    aria-valuemin={min}
                    aria-valuemax={max}
                    aria-valuenow={valid ? Number(number) : undefined}
                    aria-invalid={Boolean(draftError) && !valid}
                    aria-describedby={draftError ? draftErrorId : undefined}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, '').slice(0, 2);
                      if (isHour) setHour(digits); else setMinute(digits);
                      setDraftError('');
                    }}
                    onBlur={() => {
                      if (valid) {
                        if (isHour) setHour(number.padStart(2, '0')); else setMinute(number.padStart(2, '0'));
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                        event.preventDefault();
                        adjustTime(unit, event.key === 'ArrowUp' ? 1 : -1);
                      }
                    }}
                  />
                  <button type="button" className="hh-time-adjust" onClick={() => adjustTime(unit, -1)} aria-label={`Decrease ${unit}`}><ChevronDown aria-hidden="true" /></button>
                  <label htmlFor={`${inputId}-${unit}`}>{isHour ? 'Hour' : 'Minute'}</label>
                </div>
              );
            })}
            <span className="hh-time-colon" aria-hidden="true">:</span>
          </div>
          <div className="hh-time-period" role="group" aria-label="Time of day">
            {(['AM', 'PM'] as const).map((option) => <button key={option} type="button" aria-pressed={period === option} onClick={() => { setPeriod(option); setDraftError(''); }}>{option}<span>{option === 'AM' ? 'Midnight to noon' : 'Noon to midnight'}</span>{period === option && <Check aria-hidden="true" />}</button>)}
          </div>
          {draftError && <p id={draftErrorId} className="hh-time-error" role="alert">{draftError}</p>}
          {suggestedTimes.some((time) => parseTime(time)) && <div className="hh-time-suggestions"><p>Quick picks</p><div>{suggestedTimes.filter((time) => parseTime(time)).map((time) => {
            const parsed = parseTime(time)!;
            const draft = getDraftTime();
            return <button key={time} type="button" aria-pressed={draft?.hours === parsed.hours && draft.minutes === parsed.minutes} onClick={() => setDraft(parsed.hours, parsed.minutes)}>{displayTime(time)}</button>;
          })}</div></div>}
          <div className="hh-time-actions">
            {value && <button type="button" className="hh-time-clear" disabled={disabled} onClick={() => { onChange(''); setIsOpen(false); }}>Clear time</button>}
            <button type="button" className="hh-time-cancel" onClick={() => setIsOpen(false)}>Cancel</button>
            <button type="button" className="hh-time-apply" disabled={disabled} onClick={applyTime}>Set time<Check aria-hidden="true" /></button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
