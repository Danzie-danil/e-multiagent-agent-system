import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase/client'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

const NotificationContext = createContext({})

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const { info, success, warning, error } = useToast()
  const [notifications, setNotifications] = useState([])
  const [activeBanners, setActiveBanners] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    const { data, err } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (err) {
      console.error('Error fetching notifications:', err)
      return
    }
    setNotifications(data)
    setUnreadCount(data.filter(n => !n.is_read).length)
  }, [user])

  const fetchBanners = useCallback(async () => {
    if (!user) return
    const { data, err } = await supabase
      .from('system_banners')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      
    if (!err && data) {
      setActiveBanners(data)
    }
  }, [user])

  useEffect(() => {
    fetchNotifications()
    fetchBanners()

    if (!user) return

    const channel = supabase.channel('realtime_notifications')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications', 
        filter: `user_id=eq.${user.id}` 
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newNotif = payload.new
          setNotifications(prev => [newNotif, ...prev])
          setUnreadCount(prev => prev + 1)
          
          const typeToastMap = {
            'FRAUD': error,
            'LIQUIDITY': warning,
            'SYSTEM': info,
            'TRANSACTION': success,
            'COMMISSION': success,
            'NETWORK': warning,
            'BROADCAST': info
          }
          
          const showToast = typeToastMap[newNotif.type] || info
          showToast(newNotif.title, newNotif.message)
        } else if (payload.eventType === 'UPDATE') {
          const updatedNotif = payload.new
          setNotifications(prev => prev.map(n => n.id === updatedNotif.id ? updatedNotif : n))
          // Recalculate unread count based on current state to be accurate
          setUnreadCount(prev => updatedNotif.is_read ? Math.max(0, prev - 1) : prev)
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old.id
          setNotifications(prev => prev.filter(n => n.id !== deletedId))
          // Refresh count from DB or state to ensure sync
          fetchNotifications()
        }
      })
      .subscribe()

    const signalChannel = supabase.channel('realtime_signals')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'realtime_signals' 
      }, (payload) => {
        const signal = payload.new
        if (signal.event_type === 'BANNER_UPDATE') {
          fetchBanners()
        }
        // If it's a notification signal, we could also fetch notifications here
        // but currently notifications are handled by their own filtered channel below
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(signalChannel)
    }
  }, [user, fetchNotifications, fetchBanners, info, success, warning, error])

  const markAsRead = async (notificationId) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId)
  }

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
  }

  return (
    <NotificationContext.Provider value={{ notifications, activeBanners, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationContext)
