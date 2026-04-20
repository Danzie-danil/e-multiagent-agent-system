import { X, CheckCircle, AlertTriangle, Info, Bell, Activity } from 'lucide-react'
import { useNotifications } from '../../context/NotificationContext'
import { formatDistanceToNow } from 'date-fns'
import './NotificationsDrawer.css'

const iconMap = {
  FRAUD: <AlertTriangle size={18} style={{ color: 'var(--color-error)' }} />,
  LIQUIDITY: <Activity size={18} style={{ color: 'var(--color-warning)' }} />,
  SYSTEM: <Info size={18} style={{ color: 'var(--color-primary)' }} />,
  TRANSACTION: <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />,
  COMMISSION: <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />,
  NETWORK: <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />,
  BROADCAST: <Bell size={18} style={{ color: 'var(--color-primary)' }} />
}

export function NotificationsDrawer({ isOpen, onClose }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()

  return (
    <>
      <div 
        className={`notifications-overlay ${isOpen ? 'notifications-overlay--open' : ''}`} 
        onClick={onClose} 
        aria-hidden="true" 
      />
      
      <div className={`notifications-drawer ${isOpen ? 'notifications-drawer--open' : ''}`}>
        <div className="notifications-drawer__header">
          <div className="notifications-drawer__header-left">
            <h2 className="notifications-drawer__title">Notifications</h2>
            {unreadCount > 0 && <span className="notifications-drawer__badge">{unreadCount} New</span>}
          </div>
          <button className="notifications-drawer__close" onClick={onClose} aria-label="Close Notifications">
            <X size={20} />
          </button>
        </div>

        {unreadCount > 0 && (
          <div className="notifications-drawer__actions">
            <button className="notifications-drawer__mark-all" onClick={markAllAsRead}>
              Mark all as read
            </button>
          </div>
        )}

        <div className="notifications-drawer__list">
          {notifications.length === 0 ? (
            <div className="notifications-drawer__empty">
              <Bell size={32} />
              <p>You're all caught up!</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`notification-item ${!notif.is_read ? 'notification-item--unread' : ''}`}
                onClick={() => { if (!notif.is_read) markAsRead(notif.id) }}
              >
                <div className="notification-item__icon">
                  {iconMap[notif.type] || <Info size={18} style={{ color: 'var(--color-text-muted)' }}/>}
                </div>
                <div className="notification-item__content">
                  <h4 className="notification-item__title">{notif.title}</h4>
                  <p className="notification-item__message">{notif.message}</p>
                  <span className="notification-item__time">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                  </span>
                </div>
                {!notif.is_read && <div className="notification-item__dot" />}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
