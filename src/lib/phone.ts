// Shared Bangladeshi phone number helpers.
// - Converts Bangla digits (০-৯) to English digits
// - Strips non-numeric characters
// - Caps length at 11 digits
// - Validates against BD mobile format: 01[3-9]XXXXXXXX

export const banglaToEnglishDigits = (s: string): string =>
  s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));

export const normalizeBdPhone = (raw: string): string =>
  banglaToEnglishDigits(raw ?? "").replace(/\D/g, "").slice(0, 11);

export const isValidBdPhone = (p: string): boolean => /^01[3-9]\d{8}$/.test(p ?? "");

export const BD_PHONE_ERROR = "সঠিক ১১ ডিজিটের বাংলাদেশি ফোন নম্বর দিন (01[3-9]XXXXXXXX)";
