import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Megaphone, X, Send } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../supabase/client'
import { Button } from './Button'
import './BroadcastModal.css'

export function BroadcastModal({ isOpen, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { success, error } = useToast()
  
  const [target, setTarget] = useState('ALL')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [broadcastType, setBroadcastType] = useState('NOTIFICATION')
  const [alertLevel, setAlertLevel] = useState('INFO')
  const [durationHours, setDurationHours] = useState('24')
  const [isSending, setIsSending] = useState(false)

  if (!isOpen) return null

  const handleSend = async (e) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) return

    setIsSending(true)
    
    try {
      if (broadcastType === 'BANNER') {
        let expiresAt = null
        if (durationHours !== 'FOREVER') {
          expiresAt = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000).toISOString()
        }
        
        const bannerPayload = {
          title: title.trim(),
          message: message.trim(),
          target_role: target,
          type: alertLevel,
          expires_at: expiresAt,
          created_by: user.id
        }

        const { error: insertErr } = await supabase.from('system_banners').insert(bannerPayload)
        if (insertErr) throw insertErr
        
        success('Banner Deployed', 'Sticky banner has been published to the network.')
      } else {
        // Notification fan-out logic
        let targetUserIds = []

        if (user.role === 'PLATFORM_ADMIN') {
          let query = supabase.from('users').select('id')
          if (target !== 'ALL') {
            query = query.eq('role', target)
          }
          const { data } = await query
          targetUserIds = data.map(u => u.id)
        } else if (user.role === 'SUPERVISOR') {
          const { data } = await supabase.from('users').select('id').eq('SUPERVISOR_id', user.id).eq('role', 'AGENT')
          targetUserIds = data.map(u => u.id)
        }

        if (targetUserIds.length === 0) {
          error('Broadcast Failed', 'No valid users found for the selected target.')
          setIsSending(false)
          return
        }

      const payload = targetUserIds.map(uid => ({
        user_id: uid,
        type: 'BROADCAST',
        title: title.trim(),
        message: message.trim(),
        is_read: false,
        metadata: { sender_id: user.id }
      }))

      const { error: insertErr } = await supabase.from('notifications').insert(payload)
      
      if (insertErr) throw insertErr

      success('Broadcast Sent', `Successfully dispatched message to ${targetUserIds.length} users.`)
      }

      setTitle('')
      setMessage('')
      onClose()
    } catch (err) {
      console.error(err)
      error('Broadcast Failed', 'An error occurred while dispatching the message.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="broadcast-modal-overlay">
      <div className="broadcast-modal">
        <div className="broadcast-modal__header">
          <div className="broadcast-modal__title-group">
            <Megaphone size={18} className="broadcast-modal__icon" />
            <h2 className="broadcast-modal__title">Send Broadcast</h2>
          </div>
          <button className="broadcast-modal__close" onClick={onClose}><X size={20}/></button>
        </div>

        <form onSubmit={handleSend} className="broadcast-modal__body">
          
          <div className="form-group">
            <label className="form-label">Format</label>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                <input type="radio" value="NOTIFICATION" checked={broadcastType === 'NOTIFICATION'} onChange={e => setBroadcastType(e.target.value)} />
                Push Notification
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                <input type="radio" value="BANNER" checked={broadcastType === 'BANNER'} onChange={e => setBroadcastType(e.target.value)} />
                Global Sticky Banner
              </label>
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label className="form-label">Alert Level</label>
              <select className="form-input" value={alertLevel} onChange={e => setAlertLevel(e.target.value)}>
                <option value="INFO">Informational</option>
                <option value="WARNING">Warning</option>
                <option value="ERROR">Critical Incident</option>
              </select>
            </div>
            
            {broadcastType === 'BANNER' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label className="form-label">Duration</label>
                <select className="form-input" value={durationHours} onChange={e => setDurationHours(e.target.value)}>
                  <option value="1">1 Hour</option>
                  <option value="24">24 Hours</option>
                  <option value="168">7 Days</option>
                  <option value="FOREVER">Until Revoked Manually</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Target Audience</label>
            <select className="form-input" value={target} onChange={e => setTarget(e.target.value)}>
              {user.role === 'PLATFORM_ADMIN' ? (
                <>
                  <option value="ALL">Entire Network (Everyone)</option>
                  <option value="SUPERVISOR">All Supervisors</option>
                  <option value="AGENT">All Agents</option>
                </>
              ) : (
                <option value="MY_AGENTS">My Downline Agents</option>
              )}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Quick Templates</label>
            <div className="broadcast-modal__templates">
              {[
                { label: '🔧 Maintenance', title: 'Scheduled Maintenance', msg: 'Services will be temporarily unavailable during the maintenance window. We apologize for any inconvenience.' },
                { label: '🚨 Outage', title: 'Service Disruption', msg: 'We are currently experiencing a service disruption. Our team is actively working to restore normal operations.' },
                { label: '✅ Resolved', title: 'Issue Resolved', msg: 'The previously reported issue has been resolved. All services are now operating normally.' },
                { label: '📢 Update', title: 'Platform Update', msg: 'A new platform update has been deployed with improvements and bug fixes.' },
                { label: '💰 Rates', title: 'Rate Change Notice', msg: 'Please be advised that commission rates have been updated effective immediately.' },
                { label: '🛡️ Security', title: 'Security Advisory', msg: 'An important security update requires your attention. Please review your account settings.' },
              ].map(tpl => (
                <button
                  key={tpl.label}
                  type="button"
                  className={`broadcast-modal__template-chip ${title === tpl.title ? 'broadcast-modal__template-chip--active' : ''}`}
                  onClick={() => { setTitle(tpl.title); if (!message) setMessage(tpl.msg) }}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Broadcast Title</label>
            <input 
              required
              type="text" 
              className="form-input" 
              placeholder="e.g. Scheduled Maintenance"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Message Content</label>
            <textarea 
              required
              className="form-input" 
              placeholder="Enter your message here..."
              rows={3}
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </div>
        </form>

        <div className="broadcast-modal__footer">
          <div style={{ marginRight: 'auto' }}>
            {user.role === 'PLATFORM_ADMIN' && (
              <Button 
                type="button" 
                variant="ghost" 
                label="Manage Active" 
                onClick={() => { onClose(); navigate('/broadcasts') }} 
              />
            )}
          </div>
          <Button type="button" variant="secondary" label="Cancel" onClick={onClose} disabled={isSending} />
          <Button type="submit" variant="primary" label={isSending ? "Dispatching..." : "Send Broadcast"} icon={!isSending && <Send size={16}/>} disabled={isSending || !title || !message} onClick={handleSend} />
        </div>
      </div>
    </div>
  )
}
