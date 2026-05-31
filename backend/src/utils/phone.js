import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js'

export function normalizePhone(raw) {
  let cleaned = raw.replace(/[^\d+]/g, '')

  if (cleaned.startsWith('+')) return cleaned

  // Remove leading 55 only if followed by valid DDD (10 or 11 digits remaining after 55)
  // e.g. "5517992010557" → remove leading "55" → "17992010557" → add "+55"
  if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
    cleaned = cleaned.slice(2)
  }

  return '+55' + cleaned
}

export function classifyPhone(phone) {
  try {
    if (!isValidPhoneNumber(phone)) return { valid: false, type: null }

    const parsed = parsePhoneNumber(phone)
    const national = parsed.nationalNumber

    if (parsed.country !== 'BR') {
      return { valid: true, type: 'mobile' }
    }

    // After country code +55 and DDD (2 digits), check next digit
    const afterDDD = national.slice(2)
    const firstDigit = parseInt(afterDDD[0])

    if (firstDigit === 9) return { valid: true, type: 'mobile' }
    if ([2, 3, 4, 5].includes(firstDigit)) return { valid: true, type: 'landline' }

    return { valid: true, type: 'mobile' }
  } catch {
    return { valid: false, type: null }
  }
}

export function formatE164(phone) {
  try {
    const parsed = parsePhoneNumber(phone)
    return parsed.format('E.164')
  } catch {
    return phone
  }
}
