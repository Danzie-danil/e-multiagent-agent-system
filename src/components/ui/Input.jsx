// components/ui/Input.jsx
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '../../utils/cn'
import { formatNumberWithCommas, unformatNumber } from '../../utils/formatters'
import './Input.css'

export function Input({
  id,
  name,
  label,
  placeholder,
  type = 'text',
  value,
  defaultValue,
  onChange,
  onBlur,
  error,
  hint,
  required,
  disabled,
  readOnly,
  autoComplete,
  size = 'md',
  prefix,
  suffix,
  className,
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isNumber = type === 'number'
  const inputType = type === 'password' ? (showPassword ? 'text' : 'password') : (isNumber ? 'text' : type)

  const handleInputChange = (e) => {
    if (isNumber) {
      // Remove everything except numbers
      const raw = e.target.value.replace(/\D/g, '')
      // Update target value to be raw number for the parent component logic
      e.target.value = raw
      onChange?.(e)
    } else {
      onChange?.(e)
    }
  }

  // Display value formatting
  const getDisplayValue = () => {
    if (isNumber) {
      return formatNumberWithCommas(value ?? defaultValue ?? '')
    }
    return value ?? defaultValue
  }

  return (
    <div className={cn(
      'input-field', 
      `input-field--${size}`, 
      error && 'input-field--error', 
      disabled && 'input-field--disabled',
      prefix && 'input-field--has-prefix-val',
      (suffix || type === 'password') && 'input-field--has-suffix-val',
      className
    )}>
      {label && (
        <label htmlFor={id} className="input-field__label">
          {label}
          {required && <span className="input-field__required" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="input-field__wrapper">
        {prefix && <span className="input-field__prefix">{prefix}</span>}
        <input
          id={id}
          name={name}
          type={inputType}
          placeholder={placeholder}
          value={getDisplayValue()}
          onChange={handleInputChange}
          onBlur={onBlur}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          autoComplete={autoComplete}
          className="input-field__input"
          inputMode={isNumber ? 'numeric' : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...props}
        />
        {type === 'password' && (
          <button
            type="button"
            className="input-field__suffix input-field__suffix--btn"
            onClick={() => setShowPassword(v => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
        {suffix && type !== 'password' && <span className="input-field__suffix">{suffix}</span>}
      </div>
      {error && <p id={`${id}-error`} className="input-field__error" role="alert">{error}</p>}
      {hint && !error && <p id={`${id}-hint`} className="input-field__hint">{hint}</p>}
    </div>
  )
}
