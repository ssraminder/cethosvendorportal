/**
 * Convert Arabic-Indic (U+0660–U+0669) and Extended Arabic-Indic / Persian
 * (U+06F0–U+06F9) digits to ASCII 0–9. Vendors on Arabic, Persian or Urdu
 * keyboards type these into OTP fields; a plain `/\D/g` strip silently
 * deleted them, so the code box looked like it ignored their typing.
 */
export function toAsciiDigits(input: string): string {
  return input.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/** Normalise non-ASCII digits, then keep only 0–9. Use for OTP/code inputs. */
export function digitsOnly(input: string): string {
  return toAsciiDigits(input).replace(/\D/g, "");
}
