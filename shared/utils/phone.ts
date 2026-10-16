/** Maldivian numbers are 7 digits after the +960 country code. */
const MV_PHONE = /^\+960\d{7}$/;

/**
 * Normalises "777 1234", "+960-7771234", "9607771234" to "+9607771234".
 * Returns null when the input isn't a Maldivian number.
 */
export function normalizeMvPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let candidate: string;
  if (/^\d{7}$/.test(digits)) candidate = `+960${digits}`;
  else if (/^960\d{7}$/.test(digits)) candidate = `+${digits}`;
  else if (/^00960\d{7}$/.test(digits)) candidate = `+${digits.slice(2)}`;
  else candidate = digits;
  return MV_PHONE.test(candidate) ? candidate : null;
}

export function isMvPhone(value: string): boolean {
  return MV_PHONE.test(value);
}

/** "+9607771234" → "777-1234" for display. */
export function formatMvPhone(e164: string): string {
  if (!MV_PHONE.test(e164)) return e164;
  const local = e164.slice(4);
  return `${local.slice(0, 3)}-${local.slice(3)}`;
}

/** wa.me link for direct buyer→farmer contact. */
export function whatsappLink(e164: string, message?: string): string {
  const base = `https://wa.me/${e164.replace(/^\+/, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
