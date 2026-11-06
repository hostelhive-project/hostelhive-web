import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export interface CountryInfo {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
  example: string;
}

export const COUNTRIES: CountryInfo[] = [
  { code: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰', example: '301 2345678' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', example: '50 123 4567' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', example: '50 123 4567' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', example: '7911 123456' },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', example: '202 555 0123' },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', example: '416 555 0123' },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦', example: '3312 3456' },
  { code: 'OM', name: 'Oman', dialCode: '+968', flag: '🇴🇲', example: '9123 4567' },
  { code: 'KW', name: 'Kuwait', dialCode: '+965', flag: '🇰🇼', example: '9123 4567' },
  { code: 'BH', name: 'Bahrain', dialCode: '+973', flag: '🇧🇭', example: '3612 3456' },
  { code: 'TR', name: 'Turkey', dialCode: '+90', flag: '🇹🇷', example: '501 234 5678' },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾', example: '12 345 6789' },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', example: '412 345 678' },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', example: '151 23456789' },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', example: '6 12 34 56 78' },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳', example: '131 2345 6789' },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', example: '98765 43210' },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩', example: '1712 345678' },
];

export const DEFAULT_COUNTRY: CountryInfo = COUNTRIES[0]; // Pakistan (+92)

/**
 * Validates and normalizes phone input for a given country code.
 * Rejects non-numeric characters, "0331", and invalid lengths.
 * Strips leading 0 if appropriate for international standard format.
 */
export function validateAndFormatPhone(
  input: string,
  countryCode: CountryCode = 'PK'
): { isValid: boolean; e164?: string; formatted?: string; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Phone number is required.' };
  }

  // Quick check for alphabetic characters
  if (/[a-zA-Z]/.test(trimmed)) {
    return { isValid: false, error: 'Phone number cannot contain letters.' };
  }

  try {
    const parsed = trimmed.startsWith('+')
      ? parsePhoneNumberFromString(trimmed)
      : parsePhoneNumberFromString(trimmed, countryCode);

    if (parsed && parsed.isValid()) {
      return {
        isValid: true,
        e164: parsed.number, // E.164 (e.g. +923012345678)
        formatted: parsed.formatInternational(), // e.g. +92 301 2345678
      };
    }
  } catch {
    // ignore
  }

  const country = COUNTRIES.find((c) => c.code === countryCode) || DEFAULT_COUNTRY;
  return {
    isValid: false,
    error: `Enter a valid phone number for ${country.name}.`,
  };
}

/**
 * Checks whether an existing phone string is valid E.164.
 */
export function isE164Valid(phone?: string | null): boolean {
  if (!phone || !phone.trim()) return false;
  try {
    const parsed = parsePhoneNumberFromString(phone.trim(), 'PK');
    return !!(parsed && parsed.isValid());
  } catch {
    return false;
  }
}

/**
 * Parses an existing DB phone string (e.g. '+923012345678' or legacy '0331')
 * into CountryInfo, national number, and validity status.
 */
export function parseExistingPhone(phone?: string | null): {
  country: CountryInfo;
  nationalNumber: string;
  isValid: boolean;
} {
  if (!phone || !phone.trim()) {
    return { country: DEFAULT_COUNTRY, nationalNumber: '', isValid: false };
  }

  const trimmed = phone.trim();

  try {
    const parsed = trimmed.startsWith('+')
      ? parsePhoneNumberFromString(trimmed)
      : parsePhoneNumberFromString(trimmed, 'PK');

    if (parsed && parsed.isValid()) {
      const matched = COUNTRIES.find((c) => c.code === parsed.country);
      return {
        country: matched || {
          code: parsed.country as CountryCode,
          name: parsed.country || 'Unknown',
          dialCode: `+${parsed.countryCallingCode}`,
          flag: '🌐',
          example: '',
        },
        nationalNumber: parsed.nationalNumber,
        isValid: true,
      };
    }
  } catch {
    // ignore
  }

  // Legacy invalid format (e.g. '0331')
  return {
    country: DEFAULT_COUNTRY,
    nationalNumber: trimmed,
    isValid: false,
  };
}

/**
 * Clean display formatter for phone numbers (e.g. +92 301 2345678).
 */
export function formatPhoneDisplay(phone?: string | null): string {
  if (!phone || !phone.trim()) return '—';
  try {
    const parsed = parsePhoneNumberFromString(phone.trim(), 'PK');
    if (parsed && parsed.isValid()) {
      return parsed.formatInternational();
    }
  } catch {
    // ignore
  }
  return phone;
}

