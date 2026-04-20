// utils/formatters.js

/**
 * Format currency in Tanzanian Shillings
 */
export function formatCurrencyTZS(amount) {
  if (amount === null || amount === undefined) return 'TZS —'
  return new Intl.NumberFormat('sw-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Compact currency format for cards
 */
export function formatCurrencyCompact(amount) {
  if (!amount && amount !== 0) return '—'
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000)    return `${(amount / 1_000).toFixed(1)}K`
  return amount.toString()
}

/**
 * Format number with commas (e.g. 1000 -> 1,000)
 */
export function formatNumberWithCommas(val) {
  if (val === null || val === undefined || val === '') return ''
  const num = val.toString().replace(/\D/g, '')
  if (!num) return ''
  return new Intl.NumberFormat('en-US').format(num)
}

/**
 * Remove commas from number string (e.g. 1,000 -> 1000)
 */
export function unformatNumber(val) {
  if (!val && val !== 0) return ''
  return val.toString().replace(/,/g, '')
}

/**
 * Format phone number for Tanzania
 */
export function formatPhoneTZ(phone) {
  if (!phone) return '—'
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('255') && cleaned.length === 12) {
    return `+255 ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`
  }
  return phone
}

/**
 * Format transaction reference
 */
export function formatTxRef(id) {
  if (!id) return '—'
  return `#${id.slice(0, 8).toUpperCase()}`
}

/**
 * Format date to readable string
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-TZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr))
}

/**
 * Format datetime to readable string
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-TZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

/**
 * Format relative time (e.g., "2 min ago")
 */
export function formatRelativeTime(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/**
 * Generate a unique idempotency key
 */
export function generateIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Mask sensitive data (e.g. account number)
 */
export function maskSensitive(str, visibleChars = 4) {
  if (!str) return '—'
  return '•'.repeat(str.length - visibleChars) + str.slice(-visibleChars)
}
