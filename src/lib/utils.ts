import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Some upstream data uses non-ISO aliases like "UK" for the United Kingdom.
// libphonenumber-js / Google Maps expect ISO 3166-1 alpha-2 ("GB" for UK).
// Normalize before passing to phone/country libraries.
const COUNTRY_CODE_ALIASES: Record<string, string> = {
  UK: 'GB',
};

export function normalizeCountryCode(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase();
  return COUNTRY_CODE_ALIASES[upper] ?? upper;
}
