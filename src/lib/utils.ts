import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Strip HTML tags and dangerous characters from a string.
 * Use for any user-supplied content that is written to exports,
 * displayed in plain-text contexts, or passed to non-HTML sinks.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/[&<>"']/g, (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch,
    )
    .replace(/^\s*[\r\n]+/gm, "");
}

/**
 * Strip leading formula-injection characters from cell values
 * so that spreadsheet apps (Excel, Sheets) do not interpret them
 * as formulas when opened from an export.
 */
export function stripFormulaPrefix(value: string): string {
  if (/^[=+\-@\t\r]./.test(value)) return "'" + value;
  return value;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
