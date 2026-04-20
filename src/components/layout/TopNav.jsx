// components/layout/TopNav.jsx
import { useState } from 'react'
import { Bell, Search, Menu, Megaphone } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { RoleBadge } from '../ui/Badge'
import { ThemeToggle } from '../ui/ThemeToggle'
import { NotificationsDrawer } from '../ui/NotificationsDrawer'
import { BroadcastModal } from '../ui/BroadcastModal'
import { SystemBanner } from '../ui/SystemBanner'
import './TopNav.css'

export function TopNav({ title, subtitle, actions, onMenuClick, logoLabel }) {
  const { user } = useAuth()
  const { unreadCount, activeBanners } = useNotifications()
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false)

  return (
    <div className="topnav-wrapper">
      <header className="topnav">
        <div className="topnav__left">
          <button className="topnav__menu-btn" onClick={onMenuClick} aria-label="Toggle menu">
            <Menu size={20} />
          </button>

          <div className="topnav__logo">
            <div className="topnav__logo-text">
              <span className="topnav__brand">e-WAKALA</span>
              <span className="topnav__subbrand">{logoLabel || 'Portal'}</span>
            </div>
          </div>

          <div className="topnav__divider" aria-hidden="true" />

          <div className="topnav__title-block">
            {title && <h1 className="topnav__title">{title}</h1>}
            {subtitle && <span className="topnav__subtitle">{subtitle}</span>}
          </div>
        </div>

        <div className="topnav__right">
          {actions}
          <ThemeToggle />
          <button className="topnav__icon-btn" aria-label="Search">
            <Search size={18} />
          </button>
          {user && user.role === 'PLATFORM_ADMIN' && (
            <button 
              className="topnav__icon-btn" 
              aria-label="Broadcast Message"
              onClick={() => setIsBroadcastOpen(true)}
              style={{ color: 'var(--color-primary)' }}
            >
              <Megaphone size={18} />
            </button>
          )}
          <button 
            className="topnav__icon-btn topnav__icon-btn--alert" 
            aria-label="Notifications"
            onClick={() => setIsNotificationsOpen(true)}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="topnav__notification-dot">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <div className="topnav__user-chip">
            <div className="topnav__user-avatar topnav__user-avatar--brand">
              {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
            </div>
            <span className="topnav__user-name">{user?.name}</span>
          </div>
        </div>
      </header>

      {user?.role !== 'PLATFORM_ADMIN' && activeBanners && activeBanners.length > 0 && (
        <div className="topnav-banners">
          {activeBanners.map(banner => (
            <SystemBanner key={banner.id} banner={banner} />
          ))}
        </div>
      )}

      <NotificationsDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
      <BroadcastModal isOpen={isBroadcastOpen} onClose={() => setIsBroadcastOpen(false)} />
    </div>
  )
}
