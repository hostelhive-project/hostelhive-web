import { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Search, Check, CheckCircle2 } from 'lucide-react';
import {
  COUNTRIES,
  type CountryInfo,
  DEFAULT_COUNTRY,
  validateAndFormatPhone,
} from '../utils/phoneUtils';

export interface PhoneInputWithCountryProps {
  label?: string;
  required?: boolean;
  optional?: boolean;
  value: string;
  country?: CountryInfo;
  onChangeNumber: (val: string) => void;
  onSelectCountry?: (country: CountryInfo) => void;
  error?: string | null;
  helperText?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  showValidBadge?: boolean;
  className?: string;
  appearance?: 'default' | 'auth';
}

export default function PhoneInputWithCountry({
  label,
  required = false,
  optional = false,
  value,
  country = DEFAULT_COUNTRY,
  onChangeNumber,
  onSelectCountry,
  error,
  helperText,
  disabled = false,
  placeholder,
  id: customId,
  showValidBadge = false,
  className = '',
  appearance = 'default',
}: PhoneInputWithCountryProps) {
  const generatedId = useId();
  const inputId = customId || generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Auto-focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.dialCode.includes(searchQuery) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectCountry = (selected: CountryInfo) => {
    onSelectCountry?.(selected);
    setIsOpen(false);
    setSearchQuery('');
  };

  const validation = validateAndFormatPhone(value, country.code);
  const isInputValid = value.trim().length > 0 && validation.isValid;
  const isAuthAppearance = appearance === 'auth';

  return (
    <div className={`space-y-1 ${className}`} ref={dropdownRef}>
      {/* Label Row */}
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor={inputId}
            className={`block text-xs ${isAuthAppearance ? 'font-semibold text-slate-800' : 'font-bold text-slate-700'}`}
          >
            {label}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
            {optional && <span className="text-slate-400 font-normal ml-1">(Optional)</span>}
          </label>
          {showValidBadge && isInputValid && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Valid number
            </span>
          )}
        </div>
      )}

      {/* Input Group */}
      <div className="relative">
        <div
          className={`flex items-center w-full border rounded-xl overflow-hidden transition-colors ${isAuthAppearance ? 'h-[52px] bg-white' : 'bg-slate-50'} ${
            error
              ? 'border-rose-400 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/10'
              : isAuthAppearance
              ? 'border-slate-200 focus-within:border-[#0B192C] focus-within:ring-2 focus-within:ring-[#0B192C]/10'
              : 'border-slate-200 focus-within:border-[#0b1329] focus-within:ring-2 focus-within:ring-[#0b1329]/10'
          } ${disabled ? 'opacity-60 bg-slate-100 cursor-not-allowed' : ''}`}
        >
          {/* Country Selector Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-1.5 px-3 ${isAuthAppearance ? 'h-full bg-white hover:bg-slate-50' : 'py-2 bg-slate-100 hover:bg-slate-200'} border-r border-slate-200 text-xs font-semibold text-slate-700 transition-colors shrink-0 disabled:pointer-events-none`}
            title={`${country.name} (${country.dialCode})`}
          >
            <span className="text-base leading-none">{country.flag}</span>
            <span className="font-mono text-slate-800">{country.dialCode}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* National Number Input */}
          <input
            id={inputId}
            type="tel"
            disabled={disabled}
            value={value}
            onChange={(e) => onChangeNumber(e.target.value)}
            placeholder={placeholder || country.example || '300 1234567'}
            className={`w-full px-3 ${isAuthAppearance ? 'h-full text-sm font-medium' : 'py-2 text-xs font-semibold'} text-slate-800 bg-transparent focus:outline-none placeholder:text-slate-400`}
          />
        </div>

        {/* Country Selector Dropdown */}
        {isOpen && (
          <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Search Bar */}
            <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country or code..."
                className="w-full text-xs bg-transparent text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Country List */}
            <div className="max-h-56 overflow-y-auto scroll-thin divide-y divide-slate-50">
              {filteredCountries.length > 0 ? (
                filteredCountries.map((c) => {
                  const isSelected = c.code === country.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleSelectCountry(c)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50 ${
                        isSelected ? 'bg-blue-50 font-bold text-blue-900' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="text-base">{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-mono text-slate-500">{c.dialCode}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-3 text-center text-xs text-slate-400">No countries found</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Validation Error or Helper Text */}
      {error ? (
        <p className="text-[11px] text-rose-500 font-medium mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-[10px] text-slate-400 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
}
