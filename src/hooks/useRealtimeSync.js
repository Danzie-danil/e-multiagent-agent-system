import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase/client'

/**
 * useRealtimeSync
 * @param {string} eventType - The type of signal to listen for (e.g., 'TX_ACTIVITY', 'BANNER_UPDATE')
 * @param {Function} onSync - Callback to execute on signal
 */
export function useRealtimeSync(eventType, onSync) {
  const [livePulse, setLivePulse] = useState(false)
  const onSyncRef = useRef(onSync)

  useEffect(() => {
    onSyncRef.current = onSync
  }, [onSync])

  useEffect(() => {
    if (!eventType) return

    const channel = supabase
      .channel(`signal_${eventType}_${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'realtime_signals',
        filter: `event_type=eq.${eventType}`
      }, (payload) => {
        setLivePulse(true)
        setTimeout(() => setLivePulse(false), 2000)
        if (onSyncRef.current) onSyncRef.current(payload.new)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventType])

  return { livePulse }
}
