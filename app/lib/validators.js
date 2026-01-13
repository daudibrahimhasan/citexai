// ============================================================================
// VALIDATORS - DOI/ISBN/URL/Year validation
// ============================================================================

const CURRENT_YEAR = new Date().getFullYear();

export function isValidDOI(doi) {
  if (!doi) return false;
  return /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i.test(doi);
}

export function isValidISBN(isbn) {
  if (!isbn) return false;

  const digits = isbn.replace(/[-\s]/g, '');

  // ISBN-10
  if (digits.length === 10) {
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(digits[i]) * (10 - i);
    }
    const checksum = digits[9] === 'X' ? 10 : parseInt(digits[9]);
    sum += checksum;
    return sum % 11 === 0;
  }

  // ISBN-13
  if (digits.length === 13) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checksum = (10 - (sum % 10)) % 10;
    return checksum === parseInt(digits[12]);
  }

  return false;
}

export function isValidYear(year) {
  if (!year) return false;
  return year >= 1400 && year <= CURRENT_YEAR + 1;
}

export function isValidPageRange(pages) {
  if (!pages) return true;
  const match = pages.match(/^(\d+)[-–](\d+)$/);
  if (!match) return false;
  const start = parseInt(match[1]);
  const end = parseInt(match[2]);
  return start < end && start > 0 && end < 100000;
}

export function isValidVolumeIssue(value) {
  if (!value) return true;
  return /^\d+$/.test(value);
}

export async function validateURL(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeoutId);

    return { valid: response.ok, status: response.status };
  } catch {
    return { valid: false, status: 0 };
  }
}
