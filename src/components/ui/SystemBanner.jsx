import { AlertTriangle, Info, ShieldAlert, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase/client'
import './SystemBanner.css'

const iconMap = {
  INFO: <Info size={16} />,
  WARNING: <AlertTriangle size={16} />,
  ERROR: <ShieldAlert size={16} />
}

export function SystemBanner({ banner }) {
  const { user } = useAuth()
  if (!banner) return null

  const canDismiss = user?.role === 'PLATFORM_ADMIN' || user?.role === 'SUPERVISOR'

  const handleDismiss = async () => {
    try {
      await supabase.from('system_banners').update({ is_active: false }).eq('id', banner.id)
    } catch (err) {
      console.error('Failed to dismiss banner', err)
    }
  }

  return (
    <div className={`system-banner system-banner--${banner.type.toLowerCase()}`}>
      <div className="system-banner__content">
        <span className="system-banner__icon">
          {iconMap[banner.type] || <Info size={16} />}
        </span>
        <span className="system-banner__title">{banner.title}:</span>
        <span className="system-banner__message">{banner.message}</span>
      </div>
      {canDismiss && (
        <button 
          className="system-banner__dismiss" 
          onClick={handleDismiss}
          aria-label="Revoke Banner"
          title="Revoke Banner for everyone"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
