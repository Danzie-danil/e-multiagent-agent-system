// utils/validators.js

export const validators = {
  required: (value) => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return 'This field is required'
    }
    return null
  },

  phone: (value) => {
    if (!value) return null
    const cleaned = value.replace(/\D/g, '')
    if (!/^(255|0)\d{9}$/.test(cleaned) && !/^\d{9,12}$/.test(cleaned)) {
      return 'Enter a valid Tanzanian phone number (e.g. 0712 345 678)'
    }
    return null
  },

  amount: (value, min = 100, max = 10_000_000) => {
    const num = parseFloat(value)
    if (isNaN(num)) return 'Enter a valid amount'
    if (num < min)  return `Minimum amount is TZS ${min.toLocaleString()}`
    if (num > max)  return `Maximum amount is TZS ${max.toLocaleString()}`
    return null
  },

  pin: (value) => {
    if (!value) return 'PIN is required'
    if (!/^\d{4,6}$/.test(value)) return 'PIN must be 4–6 digits'
    return null
  },

  email: (value) => {
    if (!value) return null
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address'
    return null
  },

  minLength: (min) => (value) => {
    if (!value || value.length < min) return `Must be at least ${min} characters`
    return null
  },

  maxLength: (max) => (value) => {
    if (value && value.length > max) return `Must be no more than ${max} characters`
    return null
  },
}

/**
 * Run multiple validators on a value, return first error
 */
export function validate(value, rules) {
  for (const rule of rules) {
    const error = rule(value)
    if (error) return error
  }
  return null
}

/**
 * Validate an entire form object
 * @param {Object} values - form field values
 * @param {Object} schema - { fieldName: [validator, ...] }
 * @returns {Object} errors - { fieldName: errorString | null }
 */
export function validateForm(values, schema) {
  const errors = {}
  let hasErrors = false

  for (const [field, rules] of Object.entries(schema)) {
    const error = validate(values[field], rules)
    errors[field] = error
    if (error) hasErrors = true
  }

  return { errors, isValid: !hasErrors }
}
