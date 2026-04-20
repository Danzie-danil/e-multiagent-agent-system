// components/ui/Badge.jsx
import { cn } from '../../utils/cn'
import './Badge.css'

export function Badge({ children, variant = 'default', size = 'sm', dot, className }) {
  return (
    <span className={cn('badge', `badge--${variant}`, `badge--${size}`, className)}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

export function WalletBadge({ scheme }) {
  return (
    <span className={cn('wallet-badge', `wallet-badge--${scheme?.toLowerCase()}`)}>
      {scheme}
    </span>
  )
}

export function StatusBadge({ status }) {
  const map = {
    COMPLETED:  'success',
    ACTIVE:     'success',
    HEALTHY:    'success',
    PENDING:    'pending',
    PROCESSING: 'info',
    FAILED:     'error',
    REVERSED:   'error',
    SUSPENDED:  'error',
    LOW:        'warning',
    CRITICAL:   'error',
    MEDIUM:     'warning',
    HIGH:       'error',
  }
  const variant = map[status] || 'pending'
  return <span className={cn('status-badge', `status-badge--${variant}`)}>{status}</span>
}

export function RoleBadge({ role }) {
  const map = {
    PLATFORM_ADMIN: 'platform',
    TENANT_ADMIN:   'tenant',
    SUPERVISOR:    'super',
    AGENT:          'agent',
  }
  const labels = {
    PLATFORM_ADMIN: 'Platform Admin',
    TENANT_ADMIN:   'Tenant Admin',
    SUPERVISOR:    'Supervisor',
    AGENT:          'Agent',
  }
  return <span className={cn('role-badge', `role-badge--${map[role]}`)}>{labels[role] || role}</span>
}
