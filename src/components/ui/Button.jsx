// components/ui/Button.jsx
import { cn } from '../../utils/cn'
import './Button.css'

export function Button({
  id,
  label,
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconRight,
  onClick,
  className,
  ...props
}) {
  const content = children || label

  return (
    <button
      id={id}
      type={type}
      className={cn(
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        fullWidth && 'btn--full',
        loading && 'btn--loading',
        className
      )}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={label}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <span className="btn__spinner" aria-hidden="true" />
      ) : icon ? (
        <span className="btn__icon" aria-hidden="true">{icon}</span>
      ) : null}
      {content && <span className="btn__label">{content}</span>}
      {!loading && iconRight && <span className="btn__icon-right" aria-hidden="true">{iconRight}</span>}
    </button>
  )
}
