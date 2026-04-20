// components/ui/Card.jsx
import { cn } from '../../utils/cn'
import './Card.css'

export function Card({ children, className, padding = 'md', hover = false, onClick, ...props }) {
  return (
    <div
      className={cn('card', `card--pad-${padding}`, hover && 'card--hover', onClick && 'card--clickable', className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick(e) : undefined}
      {...props}
    >
      {children}
    </div>
  )
}

export function StatCard({ label, value, subvalue, icon, action, trend, trendLabel, color, loading }) {
  const trendUp = trend > 0
  return (
    <Card padding="sm" className={`stat-card ${color ? `stat-card--${color}` : ''}`}>
      <div className="stat-card__header">
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span className="stat-card__label">{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {action && <div className="stat-card__action">{action}</div>}
          {icon && <span className="stat-card__icon">{icon}</span>}
        </div>
      </div>
      {loading ? (
        <div className="skeleton skeleton--h3" style={{ width: '60%', marginTop: 'var(--space-2)' }} />
      ) : (
        <div className="stat-card__value animate-countUp">{value}</div>
      )}
      {(subvalue || trend !== undefined) && (
        <div className="stat-card__footer">
          {subvalue && <span className="stat-card__subvalue">{subvalue}</span>}
          {trend !== undefined && (
            <span className={`stat-card__trend ${trendUp ? 'stat-card__trend--up' : 'stat-card__trend--down'}`}>
              {trendUp ? '↑' : '↓'} {Math.abs(trend)}% {trendLabel || ''}
            </span>
          )}
        </div>
      )}
    </Card>
  )
}
